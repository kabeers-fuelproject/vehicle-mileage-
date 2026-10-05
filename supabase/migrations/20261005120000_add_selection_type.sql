-- Adds a selection type so each vehicle in the summary selection can be
-- either assigned or hired. Existing rows default to 'assigned'.
-- Vehicle Code / Used For still come from existing vehicle data only.

alter table public.summary_vehicle_selection
  add column if not exists selection_type text not null default 'assigned';

alter table public.summary_vehicle_selection
  drop constraint if exists summary_vehicle_selection_selection_type_check;

alter table public.summary_vehicle_selection
  add constraint summary_vehicle_selection_selection_type_check
  check (selection_type in ('assigned', 'hired'));
