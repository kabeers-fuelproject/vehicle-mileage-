-- Hiring and assigning are two independent states: a vehicle can be assigned,
-- hired, both, or neither (neither = row is deleted instead).
-- Converts the earlier selection_type column (if present) into the flags.

alter table public.summary_vehicle_selection
  add column if not exists is_assigned boolean not null default false;

alter table public.summary_vehicle_selection
  add column if not exists is_hired boolean not null default false;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'summary_vehicle_selection'
      and column_name = 'selection_type'
  ) then
    update public.summary_vehicle_selection
      set is_assigned = true
      where selection_type = 'assigned';

    update public.summary_vehicle_selection
      set is_hired = true
      where selection_type = 'hired';

    alter table public.summary_vehicle_selection
      drop column selection_type;
  end if;
end $$;

alter table public.summary_vehicle_selection
  drop constraint if exists summary_vehicle_selection_has_state_check;

alter table public.summary_vehicle_selection
  add constraint summary_vehicle_selection_has_state_check
  check (is_assigned or is_hired);
