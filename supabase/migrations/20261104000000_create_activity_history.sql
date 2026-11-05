-- Stores history of activities like PDF downloads
create table if not exists public.activity_history (
  id uuid primary key default gen_random_uuid(),
  activity_type text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_history_created_at_idx
  on public.activity_history (created_at desc);

create index if not exists activity_history_type_idx
  on public.activity_history (activity_type);

alter table public.activity_history enable row level security;

drop policy if exists "allow all on activity_history"
  on public.activity_history;

create policy "allow all on activity_history"
  on public.activity_history
  for all
  using (true)
  with check (true);
