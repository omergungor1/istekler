-- Tıpplus İstek Yönetim Sistemi — görünümler ve veritabanı fonksiyonları
-- Tüm fonksiyonlar SECURITY INVOKER çalışır; RLS politikaları geçerliliğini korur.

-- ---------------------------------------------------------------------------
-- request_list: listeleme için etkin (manuel > AI) tahminler ve iş bağlantıları
-- ---------------------------------------------------------------------------

create or replace view public.request_list
with (security_invoker = true)
as
select
  r.id,
  r.owner_id,
  r.external_no,
  r.external_no_sort,
  r.institution_name,
  r.subject,
  r.module_name,
  r.description,
  r.status,
  r.ai_status,
  r.ai_category,
  r.ai_summary,
  r.deleted_at,
  r.completed_at,
  r.closing_message,
  r.created_at,
  r.updated_at,
  r.last_seen_at,
  coalesce(r.manual_difficulty, r.ai_difficulty) as eff_difficulty,
  case coalesce(r.manual_difficulty, r.ai_difficulty)
    when 'easy' then 1 when 'medium' then 2 when 'hard' then 3 when 'very_hard' then 4
  end as eff_difficulty_rank,
  coalesce(r.manual_hours_min, r.ai_hours_min) as eff_hours_min,
  coalesce(r.manual_hours_max, r.ai_hours_max) as eff_hours_max,
  coalesce(w.work_item_count, 0) as work_item_count,
  coalesce(w.work_item_titles, '{}') as work_item_titles,
  w.first_work_item_id
from public.requests r
left join lateral (
  select
    count(*)::int as work_item_count,
    array_agg(wi.title order by wi.created_at) as work_item_titles,
    (array_agg(wi.id order by wi.created_at))[1] as first_work_item_id
  from public.work_item_requests wir
  join public.work_items wi on wi.id = wir.work_item_id
  where wir.request_id = r.id
) w on true;

grant select on public.request_list to authenticated;

-- ---------------------------------------------------------------------------
-- Süresi dolan önizlemelerin temizlenmesi
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_expired_imports()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.import_batches
     set status = 'expired'
   where owner_id = auth.uid()
     and status = 'preview'
     and expires_at < now();
  get diagnostics v_count = row_count;

  delete from public.import_batch_rows r
   using public.import_batches b
   where r.batch_id = b.id
     and b.owner_id = auth.uid()
     and b.status <> 'preview';

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_import_batch: onaylanan önizlemeyi tek transaction içinde uygular
-- ---------------------------------------------------------------------------

create or replace function public.apply_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_batch public.import_batches%rowtype;
  v_row public.import_batch_rows%rowtype;
  v_req public.requests%rowtype;
  v_req_json jsonb;
  v_new_id uuid;
  v_changed text[];
  v_field text;
  v_restored boolean;
  v_content_changed boolean;
  v_new_ai_status text;
  v_new integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_restored_count integer := 0;
  v_completed_changed integer := 0;
  v_fields constant text[] := array[
    'institution_name', 'subject', 'module_name', 'description', 'tracked_by', 'replied_by',
    'requested_by', 'form_name', 'source_request_type', 'source_urgency'
  ];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_batch
    from public.import_batches
   where id = p_batch_id and owner_id = v_uid
   for update;

  if not found then
    raise exception 'batch_not_found' using errcode = 'P0002';
  end if;
  if v_batch.status <> 'preview' then
    raise exception 'batch_not_pending' using errcode = 'P0001';
  end if;
  if v_batch.expires_at < now() then
    raise exception 'batch_expired' using errcode = 'P0001';
  end if;

  for v_row in
    select * from public.import_batch_rows
     where batch_id = p_batch_id
       and owner_id = v_uid
       and action not in ('invalid', 'duplicate')
     order by row_number
  loop
    select * into v_req
      from public.requests
     where owner_id = v_uid and external_no = v_row.external_no
     for update;

    if not found then
      insert into public.requests (
        owner_id, external_no, institution_name, subject, module_name, description,
        tracked_by, replied_by, requested_by, form_name, source_request_type,
        source_urgency, source_elapsed_time, source_hash, content_hash,
        status, ai_status, last_import_batch_id
      ) values (
        v_uid, v_row.external_no,
        v_row.data ->> 'institution_name', v_row.data ->> 'subject', v_row.data ->> 'module_name',
        v_row.data ->> 'description', v_row.data ->> 'tracked_by', v_row.data ->> 'replied_by',
        v_row.data ->> 'requested_by', v_row.data ->> 'form_name', v_row.data ->> 'source_request_type',
        v_row.data ->> 'source_urgency', v_row.data ->> 'source_elapsed_time',
        v_row.source_hash, v_row.content_hash,
        'open', 'pending', p_batch_id
      )
      returning id into v_new_id;

      insert into public.request_events (owner_id, request_id, event_type, details)
      values (v_uid, v_new_id, 'created', jsonb_build_object('batch_id', p_batch_id, 'file_name', v_batch.file_name));

      v_new := v_new + 1;
      continue;
    end if;

    v_restored := v_req.deleted_at is not null;

    if v_req.source_hash = v_row.source_hash and not v_restored then
      update public.requests
         set last_seen_at = now(),
             last_import_batch_id = p_batch_id,
             source_elapsed_time = v_row.data ->> 'source_elapsed_time'
       where id = v_req.id;
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    v_req_json := to_jsonb(v_req);
    v_changed := '{}';
    foreach v_field in array v_fields loop
      if (v_row.data ->> v_field) is distinct from (v_req_json ->> v_field) then
        v_changed := v_changed || v_field;
      end if;
    end loop;

    v_content_changed := v_req.content_hash is distinct from v_row.content_hash;
    v_new_ai_status := case
      when not v_content_changed then v_req.ai_status
      when v_req.ai_status = 'done' then 'stale'
      when v_req.ai_status in ('needs_review', 'failed') then 'pending'
      else v_req.ai_status
    end;

    update public.requests
       set institution_name = v_row.data ->> 'institution_name',
           subject = v_row.data ->> 'subject',
           module_name = v_row.data ->> 'module_name',
           description = v_row.data ->> 'description',
           tracked_by = v_row.data ->> 'tracked_by',
           replied_by = v_row.data ->> 'replied_by',
           requested_by = v_row.data ->> 'requested_by',
           form_name = v_row.data ->> 'form_name',
           source_request_type = v_row.data ->> 'source_request_type',
           source_urgency = v_row.data ->> 'source_urgency',
           source_elapsed_time = v_row.data ->> 'source_elapsed_time',
           source_hash = v_row.source_hash,
           content_hash = v_row.content_hash,
           ai_status = v_new_ai_status,
           ai_status_message = case when v_content_changed then null else ai_status_message end,
           last_seen_at = now(),
           last_import_batch_id = p_batch_id,
           deleted_at = null,
           status = case when v_restored then 'open' else status end,
           completed_at = case when v_restored then null else completed_at end
     where id = v_req.id;

    if v_restored then
      insert into public.request_events (owner_id, request_id, event_type, details)
      values (v_uid, v_req.id, 'import_restored', jsonb_build_object(
        'batch_id', p_batch_id,
        'file_name', v_batch.file_name,
        'changed_fields', to_jsonb(v_changed),
        'previous_status', v_req.status
      ));
      v_restored_count := v_restored_count + 1;
    else
      insert into public.request_events (owner_id, request_id, event_type, details)
      values (v_uid, v_req.id, 'import_updated', jsonb_build_object(
        'batch_id', p_batch_id,
        'file_name', v_batch.file_name,
        'changed_fields', to_jsonb(v_changed),
        'completed_source_changed', v_req.status = 'completed'
      ));
      v_updated := v_updated + 1;
      if v_req.status = 'completed' then
        v_completed_changed := v_completed_changed + 1;
      end if;
    end if;
  end loop;

  update public.import_batches
     set status = 'completed',
         applied_at = now(),
         new_count = v_new,
         updated_count = v_updated,
         unchanged_count = v_unchanged,
         restored_count = v_restored_count,
         valid_count = v_new + v_updated + v_unchanged + v_restored_count
   where id = p_batch_id;

  -- Kişisel veri içerebilecek geçici satır kopyaları uygulamadan sonra tutulmaz.
  delete from public.import_batch_rows where batch_id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'new', v_new,
    'updated', v_updated,
    'unchanged', v_unchanged,
    'restored', v_restored_count,
    'completed_changed', v_completed_changed,
    'errors', v_batch.error_count,
    'duplicates', v_batch.duplicate_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_group_suggestion: öneriden iş oluşturur ve istekleri bağlar
-- ---------------------------------------------------------------------------

create or replace function public.approve_group_suggestion(
  p_suggestion_id uuid,
  p_title text,
  p_request_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.ai_group_suggestions%rowtype;
  v_ids uuid[];
  v_work_item_id uuid;
  v_title text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_s
    from public.ai_group_suggestions
   where id = p_suggestion_id and owner_id = v_uid
   for update;

  if not found then
    raise exception 'suggestion_not_found' using errcode = 'P0002';
  end if;
  if v_s.status <> 'pending' then
    raise exception 'suggestion_not_pending' using errcode = 'P0001';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_request_ids) as x where x is not null;
  if v_ids is null or array_length(v_ids, 1) = 0 then
    raise exception 'no_requests' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(v_ids) as rid
     where not exists (
       select 1 from public.requests r
        where r.id = rid and r.owner_id = v_uid and r.deleted_at is null
     )
  ) then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  v_title := coalesce(nullif(btrim(p_title), ''), v_s.suggested_title);

  insert into public.work_items (
    owner_id, title, summary, description, category, ai_difficulty,
    ai_estimated_hours_min, ai_estimated_hours_max, technical_notes, source_suggestion_id
  ) values (
    v_uid, left(v_title, 300), v_s.summary, v_s.explanation, v_s.category, v_s.difficulty,
    v_s.estimated_hours_min, v_s.estimated_hours_max, v_s.explanation, v_s.id
  )
  returning id into v_work_item_id;

  insert into public.work_item_requests (owner_id, work_item_id, request_id)
  select v_uid, v_work_item_id, rid from unnest(v_ids) as rid
  on conflict (work_item_id, request_id) do nothing;

  insert into public.request_events (owner_id, request_id, work_item_id, event_type, details)
  select v_uid, rid, v_work_item_id, 'linked_work_item',
         jsonb_build_object('title', v_title, 'source', 'ai_suggestion', 'suggestion_id', v_s.id)
    from unnest(v_ids) as rid;

  update public.ai_group_suggestions
     set status = 'approved', reviewed_at = now(), work_item_id = v_work_item_id
   where id = v_s.id;

  return v_work_item_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- split_work_item: seçilen istekleri yeni bir işe taşır
-- ---------------------------------------------------------------------------

create or replace function public.split_work_item(
  p_work_item_id uuid,
  p_title text,
  p_request_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_src public.work_items%rowtype;
  v_ids uuid[];
  v_new_id uuid;
  v_linked_count integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'title_required' using errcode = '22023';
  end if;

  select * into v_src
    from public.work_items
   where id = p_work_item_id and owner_id = v_uid
   for update;
  if not found then
    raise exception 'work_item_not_found' using errcode = 'P0002';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_request_ids) as x where x is not null;
  if v_ids is null then
    raise exception 'no_requests' using errcode = '22023';
  end if;

  select count(*) into v_linked_count
    from public.work_item_requests
   where work_item_id = p_work_item_id and request_id = any (v_ids);
  if v_linked_count <> array_length(v_ids, 1) then
    raise exception 'request_not_linked' using errcode = '22023';
  end if;

  insert into public.work_items (owner_id, title, category, status)
  values (v_uid, left(btrim(p_title), 300), v_src.category, 'open')
  returning id into v_new_id;

  update public.work_item_requests
     set work_item_id = v_new_id
   where work_item_id = p_work_item_id and request_id = any (v_ids);

  insert into public.request_events (owner_id, request_id, work_item_id, event_type, details)
  select v_uid, rid, p_work_item_id, 'unlinked_work_item',
         jsonb_build_object('title', v_src.title, 'reason', 'split')
    from unnest(v_ids) as rid;

  insert into public.request_events (owner_id, request_id, work_item_id, event_type, details)
  select v_uid, rid, v_new_id, 'linked_work_item',
         jsonb_build_object('title', btrim(p_title), 'source', 'split', 'from_work_item_id', p_work_item_id)
    from unnest(v_ids) as rid;

  return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_ai_job_items: toplu analiz kuyruğundan kontrollü sayıda kayıt alır
-- ---------------------------------------------------------------------------

create or replace function public.claim_ai_job_items(p_job_id uuid, p_limit integer)
returns setof public.ai_job_items
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Deneme hakkı biten ve takılı kalan kayıtlar başarısız sayılır.
  update public.ai_job_items
     set status = 'failed',
         error_message = coalesce(error_message, 'İşlem zaman aşımına uğradı.'),
         locked_at = null
   where job_id = p_job_id
     and owner_id = auth.uid()
     and status = 'processing'
     and locked_at < now() - interval '3 minutes'
     and attempts >= 3;

  return query
  update public.ai_job_items i
     set status = 'processing',
         locked_at = now(),
         attempts = i.attempts + 1
   where i.id in (
     select c.id
       from public.ai_job_items c
      where c.job_id = p_job_id
        and c.owner_id = auth.uid()
        and (c.status = 'queued'
             or (c.status = 'processing' and c.locked_at < now() - interval '3 minutes'))
        and c.attempts < 3
      order by c.created_at, c.id
      limit greatest(1, least(coalesce(p_limit, 3), 5))
      for update skip locked
   )
  returning i.*;
end;
$$;

-- ---------------------------------------------------------------------------
-- dashboard_stats: tekrar saymayan iş yükü ve dağılımlar
-- ---------------------------------------------------------------------------

create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with
  r as (
    select * from public.request_list where deleted_at is null
  ),
  linked as (
    select distinct request_id from public.work_item_requests
  ),
  unlinked as (
    select * from r
     where status <> 'completed'
       and not exists (select 1 from linked l where l.request_id = r.id)
  ),
  wopen as (
    select
      category,
      coalesce(manual_estimated_hours_min, ai_estimated_hours_min) as hmin,
      coalesce(manual_estimated_hours_max, ai_estimated_hours_max) as hmax
    from public.work_items
    where status <> 'completed'
  )
select jsonb_build_object(
  'total', (select count(*) from r),
  'open', (select count(*) from r where status = 'open'),
  'in_progress', (select count(*) from r where status = 'in_progress'),
  'completed', (select count(*) from r where status = 'completed'),
  'ai_pending', (select count(*) from r where status <> 'completed' and ai_status <> 'done'),
  'ai_needs_review', (select count(*) from r where status <> 'completed' and ai_status = 'needs_review'),
  'work_items_open', (select count(*) from wopen),
  'workload', jsonb_build_object(
    'work_items_min', (select coalesce(sum(hmin), 0) from wopen),
    'work_items_max', (select coalesce(sum(hmax), 0) from wopen),
    'work_items_unestimated', (select count(*) from wopen where hmax is null),
    'requests_count', (select count(*) from unlinked),
    'requests_min', (select coalesce(sum(eff_hours_min), 0) from unlinked),
    'requests_max', (select coalesce(sum(eff_hours_max), 0) from unlinked),
    'requests_unestimated', (select count(*) from unlinked where eff_hours_max is null)
  ),
  'by_module', (
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', cnt) order by cnt desc, label), '[]'::jsonb)
      from (
        select coalesce(nullif(btrim(module_name), ''), 'Belirtilmemiş') as label, count(*) as cnt
          from r group by 1 order by 2 desc, 1 limit 10
      ) x
  ),
  'by_institution', (
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', cnt) order by cnt desc, label), '[]'::jsonb)
      from (
        select coalesce(nullif(btrim(institution_name), ''), 'Belirtilmemiş') as label, count(*) as cnt
          from r group by 1 order by 2 desc, 1 limit 10
      ) x
  ),
  'by_difficulty', (
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', cnt) order by rank), '[]'::jsonb)
      from (
        select coalesce(eff_difficulty, 'unknown') as label,
               coalesce(eff_difficulty_rank, 9) as rank,
               count(*) as cnt
          from r where status <> 'completed'
         group by 1, 2
      ) x
  ),
  'by_status', (
    select coalesce(jsonb_agg(jsonb_build_object('label', status, 'value', cnt)), '[]'::jsonb)
      from (select status, count(*) as cnt from r group by status) x
  ),
  'workload_by_category', (
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'min', hmin, 'max', hmax) order by hmax desc nulls last, label), '[]'::jsonb)
      from (
        select coalesce(nullif(btrim(category), ''), 'Kategorisiz') as label,
               sum(hmin) as hmin, sum(hmax) as hmax
          from (
            select category, hmin, hmax from wopen
            union all
            select ai_category, eff_hours_min, eff_hours_max from unlinked
          ) u
         where hmax is not null
         group by 1
      ) x
  ),
  'last_import_at', (
    select max(applied_at) from public.import_batches where status = 'completed'
  )
);
$$;

revoke execute on function public.apply_import_batch(uuid) from public, anon;
revoke execute on function public.approve_group_suggestion(uuid, text, uuid[]) from public, anon;
revoke execute on function public.split_work_item(uuid, text, uuid[]) from public, anon;
revoke execute on function public.claim_ai_job_items(uuid, integer) from public, anon;
revoke execute on function public.dashboard_stats() from public, anon;
revoke execute on function public.cleanup_expired_imports() from public, anon;

grant execute on function public.apply_import_batch(uuid) to authenticated;
grant execute on function public.approve_group_suggestion(uuid, text, uuid[]) to authenticated;
grant execute on function public.split_work_item(uuid, text, uuid[]) to authenticated;
grant execute on function public.claim_ai_job_items(uuid, integer) to authenticated;
grant execute on function public.dashboard_stats() to authenticated;
grant execute on function public.cleanup_expired_imports() to authenticated;
