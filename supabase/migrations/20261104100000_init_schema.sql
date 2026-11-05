-- Tıpplus İstek Yönetim Sistemi — temel şema
-- Tüm tablolar owner_id ile kullanıcıya bağlıdır ve RLS ile izole edilir.
-- İlişki tablolarındaki (x_id, owner_id) bileşik yabancı anahtarları farklı
-- kullanıcıların kayıtlarının birbirine bağlanmasını veritabanı düzeyinde engeller.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Ortak tetikleyiciler
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- requests: yalnızca son görülme bilgisi değiştiğinde updated_at ilerlemez.
create or replace function public.requests_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - array['last_seen_at', 'last_import_batch_id', 'source_elapsed_time', 'updated_at', 'external_no_sort'])
     is distinct from
     (to_jsonb(old) - array['last_seen_at', 'last_import_batch_id', 'source_elapsed_time', 'updated_at', 'external_no_sort']) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- import_batches: Excel aktarım geçmişi
-- ---------------------------------------------------------------------------

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  file_size integer not null check (file_size >= 0),
  status text not null default 'preview'
    check (status in ('preview', 'completed', 'failed', 'cancelled', 'expired')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_count integer not null default 0 check (valid_count >= 0),
  new_count integer not null default 0 check (new_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  unchanged_count integer not null default 0 check (unchanged_count >= 0),
  restored_count integer not null default 0 check (restored_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  error_message text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

-- ---------------------------------------------------------------------------
-- requests: kaynak istekler
-- ---------------------------------------------------------------------------

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  external_no text not null check (char_length(btrim(external_no)) between 1 and 64),

  -- Kaynak (Excel) alanları
  institution_name text,
  subject text,
  module_name text,
  description text,
  tracked_by text,
  replied_by text,
  requested_by text,
  form_name text,
  source_request_type text,
  source_urgency text,
  source_elapsed_time text,
  source_hash text not null,
  content_hash text not null,

  -- Uygulama tarafından yönetilen alanlar
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed')),
  user_notes text,
  started_at timestamptz,
  completed_at timestamptz,
  closing_message text,
  deleted_at timestamptz,

  -- AI durumu ve güncel analizin özet alanları (listeleme/sıralama için)
  ai_status text not null default 'pending'
    check (ai_status in ('pending', 'queued', 'processing', 'done', 'stale', 'needs_review', 'failed')),
  ai_status_message text,
  current_analysis_id uuid,
  ai_summary text,
  ai_category text,
  ai_difficulty text check (ai_difficulty in ('easy', 'medium', 'hard', 'very_hard')),
  ai_hours_min numeric(6, 1) check (ai_hours_min >= 0),
  ai_hours_max numeric(6, 1) check (ai_hours_max >= 0),
  ai_analyzed_at timestamptz,
  -- Kullanıcının onayladığı maskelenmiş AI girdisi; content_hash değişince geçersizdir.
  ai_input_override text,
  ai_input_override_hash text,

  -- Kullanıcının manuel tahminleri (AI analizi bunları ezmez)
  manual_difficulty text check (manual_difficulty in ('easy', 'medium', 'hard', 'very_hard')),
  manual_hours_min numeric(6, 1) check (manual_hours_min >= 0),
  manual_hours_max numeric(6, 1) check (manual_hours_max >= 0),

  external_no_sort bigint generated always as (
    case when external_no ~ '^[0-9]{1,18}$' then external_no::bigint end
  ) stored,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_import_batch_id uuid references public.import_batches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (owner_id, external_no),
  unique (id, owner_id),
  check (completed_at is null or status = 'completed'),
  check (ai_hours_min is null or ai_hours_max is null or ai_hours_min <= ai_hours_max),
  check (manual_hours_min is null or manual_hours_max is null or manual_hours_min <= manual_hours_max)
);

create trigger requests_updated_at
  before update on public.requests
  for each row execute function public.requests_set_updated_at();

-- ---------------------------------------------------------------------------
-- import_batch_rows: önizleme için geçici satırlar (uygulandıktan sonra silinir)
-- ---------------------------------------------------------------------------

create table public.import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  batch_id uuid not null,
  row_number integer not null check (row_number > 0),
  external_no text,
  data jsonb not null default '{}'::jsonb,
  source_hash text,
  content_hash text,
  action text not null
    check (action in ('new', 'update', 'unchanged', 'restore', 'invalid', 'duplicate')),
  changed_fields text[] not null default '{}',
  errors text[] not null default '{}',
  existing_request_id uuid,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (batch_id, owner_id) references public.import_batches (id, owner_id) on delete cascade,
  unique (batch_id, row_number)
);

-- ---------------------------------------------------------------------------
-- ai_analyses: istek bazlı AI analiz geçmişi
-- ---------------------------------------------------------------------------

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  request_id uuid not null,
  source_hash text not null,
  prompt_version text not null,
  model_name text not null,
  analysis_status text not null check (analysis_status in ('completed', 'failed')),
  short_summary text,
  problem_description text,
  expected_behavior text,
  current_behavior text,
  technical_analysis jsonb not null default '[]'::jsonb,
  suggested_solution jsonb not null default '[]'::jsonb,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  difficulty text check (difficulty in ('easy', 'medium', 'hard', 'very_hard')),
  estimated_hours_min numeric(6, 1) check (estimated_hours_min >= 0),
  estimated_hours_max numeric(6, 1) check (estimated_hours_max >= 0),
  estimate_confidence text check (estimate_confidence in ('low', 'medium', 'high')),
  estimated_time_reason text,
  generated_agent_prompt text,
  category text,
  tags text[] not null default '{}',
  error_message text,
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (request_id, owner_id) references public.requests (id, owner_id) on delete cascade,
  unique (id, owner_id)
);

alter table public.requests
  add constraint requests_current_analysis_fk
  foreign key (current_analysis_id) references public.ai_analyses (id) on delete set null;

-- ---------------------------------------------------------------------------
-- work_items: yapılacak teknik işler
-- ---------------------------------------------------------------------------

create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  summary text,
  description text,
  category text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed')),
  ai_difficulty text check (ai_difficulty in ('easy', 'medium', 'hard', 'very_hard')),
  manual_difficulty text check (manual_difficulty in ('easy', 'medium', 'hard', 'very_hard')),
  ai_estimated_hours_min numeric(6, 1) check (ai_estimated_hours_min >= 0),
  ai_estimated_hours_max numeric(6, 1) check (ai_estimated_hours_max >= 0),
  manual_estimated_hours_min numeric(6, 1) check (manual_estimated_hours_min >= 0),
  manual_estimated_hours_max numeric(6, 1) check (manual_estimated_hours_max >= 0),
  technical_notes text,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  work_notes text,
  source_suggestion_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, owner_id),
  check (completed_at is null or status = 'completed'),
  check (manual_estimated_hours_min is null or manual_estimated_hours_max is null
         or manual_estimated_hours_min <= manual_estimated_hours_max)
);

create trigger work_items_updated_at
  before update on public.work_items
  for each row execute function public.set_updated_at();

create table public.work_item_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_item_id uuid not null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (work_item_id, owner_id) references public.work_items (id, owner_id) on delete cascade,
  foreign key (request_id, owner_id) references public.requests (id, owner_id) on delete cascade,
  unique (work_item_id, request_id)
);

-- ---------------------------------------------------------------------------
-- ai_group_suggestions: AI iş grubu önerileri (kullanıcı onayı bekler)
-- ---------------------------------------------------------------------------

create table public.ai_group_suggestions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  suggested_title text not null,
  explanation text,
  summary text,
  category text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard', 'very_hard')),
  estimated_hours_min numeric(6, 1) check (estimated_hours_min >= 0),
  estimated_hours_max numeric(6, 1) check (estimated_hours_max >= 0),
  confidence numeric(3, 2) check (confidence between 0 and 1),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  request_set_key text not null,
  model_name text,
  prompt_version text,
  work_item_id uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (id, owner_id),
  foreign key (work_item_id, owner_id) references public.work_items (id, owner_id) on delete set null (work_item_id)
);

alter table public.work_items
  add constraint work_items_source_suggestion_fk
  foreign key (source_suggestion_id) references public.ai_group_suggestions (id) on delete set null;

create table public.ai_group_suggestion_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  suggestion_id uuid not null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (suggestion_id, owner_id) references public.ai_group_suggestions (id, owner_id) on delete cascade,
  foreign key (request_id, owner_id) references public.requests (id, owner_id) on delete cascade,
  unique (suggestion_id, request_id)
);

-- ---------------------------------------------------------------------------
-- agent_prompts: istek veya iş için kod agent'ı promptu
-- ---------------------------------------------------------------------------

create table public.agent_prompts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  request_id uuid,
  work_item_id uuid,
  content text not null check (char_length(content) between 1 and 60000),
  is_edited boolean not null default false,
  generated_by text not null default 'ai' check (generated_by in ('analysis', 'ai', 'manual')),
  model_name text,
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (request_id, owner_id) references public.requests (id, owner_id) on delete cascade,
  foreign key (work_item_id, owner_id) references public.work_items (id, owner_id) on delete cascade,
  check (num_nonnulls(request_id, work_item_id) = 1),
  unique (request_id),
  unique (work_item_id)
);

create trigger agent_prompts_updated_at
  before update on public.agent_prompts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- request_events: istek işlem geçmişi (yalnızca ekleme)
-- ---------------------------------------------------------------------------

create table public.request_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  request_id uuid not null,
  work_item_id uuid,
  event_type text not null check (event_type in (
    'created', 'import_updated', 'import_restored', 'ai_analyzed', 'ai_failed', 'ai_review_required',
    'linked_work_item', 'unlinked_work_item', 'status_changed', 'completed', 'reopened',
    'deleted', 'note_updated', 'estimate_updated', 'prompt_saved'
  )),
  actor_id uuid default auth.uid(),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (request_id, owner_id) references public.requests (id, owner_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- ai_jobs / ai_job_items: kayıt bazlı, yeniden denenebilir toplu AI işlemleri
-- ---------------------------------------------------------------------------

create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'bulk_analysis' check (kind in ('bulk_analysis')),
  status text not null default 'running' check (status in ('running', 'completed', 'cancelled')),
  total_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (id, owner_id)
);

create trigger ai_jobs_updated_at
  before update on public.ai_jobs
  for each row execute function public.set_updated_at();

create table public.ai_job_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid not null,
  request_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'done', 'failed', 'skipped', 'needs_review')),
  attempts integer not null default 0 check (attempts >= 0),
  error_message text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (job_id, owner_id) references public.ai_jobs (id, owner_id) on delete cascade,
  foreign key (request_id, owner_id) references public.requests (id, owner_id) on delete cascade,
  unique (job_id, request_id)
);

create trigger ai_job_items_updated_at
  before update on public.ai_job_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- İndeksler
-- ---------------------------------------------------------------------------

create index requests_owner_status_idx on public.requests (owner_id, status) where deleted_at is null;
create index requests_owner_institution_idx on public.requests (owner_id, institution_name);
create index requests_owner_module_idx on public.requests (owner_id, module_name);
create index requests_owner_ai_status_idx on public.requests (owner_id, ai_status);
create index requests_owner_sort_idx on public.requests (owner_id, external_no_sort desc);
create index requests_created_at_idx on public.requests (created_at);
create index requests_last_seen_at_idx on public.requests (last_seen_at);
create index requests_updated_at_idx on public.requests (owner_id, updated_at desc);
create index requests_subject_trgm_idx on public.requests using gin (subject extensions.gin_trgm_ops);
create index requests_description_trgm_idx on public.requests using gin (description extensions.gin_trgm_ops);

create index import_batches_owner_created_idx on public.import_batches (owner_id, created_at desc);
create index import_batch_rows_batch_idx on public.import_batch_rows (batch_id, row_number);
create index import_batch_rows_owner_idx on public.import_batch_rows (owner_id);

create index ai_analyses_request_idx on public.ai_analyses (request_id, created_at desc);
create index ai_analyses_owner_status_idx on public.ai_analyses (owner_id, analysis_status);

create index work_items_owner_status_idx on public.work_items (owner_id, status);
create index work_item_requests_work_item_idx on public.work_item_requests (work_item_id);
create index work_item_requests_request_idx on public.work_item_requests (request_id);
create index work_item_requests_owner_idx on public.work_item_requests (owner_id);

create index ai_group_suggestions_owner_status_idx on public.ai_group_suggestions (owner_id, status);
create index ai_group_suggestions_set_key_idx on public.ai_group_suggestions (owner_id, request_set_key);
create index ai_group_suggestion_requests_suggestion_idx on public.ai_group_suggestion_requests (suggestion_id);
create index ai_group_suggestion_requests_request_idx on public.ai_group_suggestion_requests (request_id);

create index agent_prompts_owner_idx on public.agent_prompts (owner_id);
create index request_events_request_idx on public.request_events (request_id, created_at desc);
create index request_events_owner_idx on public.request_events (owner_id, created_at desc);

create index ai_jobs_owner_status_idx on public.ai_jobs (owner_id, status);
create index ai_job_items_job_status_idx on public.ai_job_items (job_id, status);
create index ai_job_items_request_idx on public.ai_job_items (request_id);
create index ai_job_items_owner_idx on public.ai_job_items (owner_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'import_batches', 'requests', 'import_batch_rows', 'ai_analyses', 'work_items',
    'work_item_requests', 'ai_group_suggestions', 'ai_group_suggestion_requests',
    'agent_prompts', 'ai_jobs', 'ai_job_items'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (owner_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end;
$$;

-- İşlem geçmişi değiştirilemez: yalnızca okuma ve ekleme.
alter table public.request_events enable row level security;
create policy request_events_select_own on public.request_events
  for select to authenticated using (owner_id = (select auth.uid()));
create policy request_events_insert_own on public.request_events
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (actor_id is null or actor_id = (select auth.uid())));

-- Anonim rol hiçbir tabloya erişemez.
revoke all on all tables in schema public from anon;
