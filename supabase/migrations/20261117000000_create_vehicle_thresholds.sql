-- Per vehicle-type threshold overrides editable from the Settings page.
-- Types with no row here fall back to the built-in defaults in
-- frontend/src/thresholds.js.
create table if not exists public.vehicle_thresholds (
  veh_type text primary key,
  mileage numeric not null,
  working_hours text not null,
  updated_at timestamptz not null default now()
);

alter table public.vehicle_thresholds enable row level security;

drop policy if exists "allow all on vehicle_thresholds"
  on public.vehicle_thresholds;

create policy "allow all on vehicle_thresholds"
  on public.vehicle_thresholds
  for all
  using (true)
  with check (true);
