-- Selection/assignment settings for the vehicles used to generate the summary.
-- Stores only the relationship (vehicle identifiers) to the existing vehicle
-- data in the app. Vehicle Code / Used For are never duplicated here.

create table if not exists public.summary_vehicle_selection (
  id uuid primary key default gen_random_uuid(),
  vehicle_code text not null unique,
  unit_id text,
  created_at timestamptz not null default now()
);

create index if not exists summary_vehicle_selection_created_at_idx
  on public.summary_vehicle_selection (created_at);

alter table public.summary_vehicle_selection enable row level security;

drop policy if exists "allow all on summary_vehicle_selection"
  on public.summary_vehicle_selection;

create policy "allow all on summary_vehicle_selection"
  on public.summary_vehicle_selection
  for all
  using (true)
  with check (true);
