-- Tamamlanmış bir işe bağlı ama kendisi açık olan istekler iş yükünde tek başına sayılır.
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
    select distinct wir.request_id
      from public.work_item_requests wir
      join public.work_items w on w.id = wir.work_item_id
     where w.status <> 'completed'
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
