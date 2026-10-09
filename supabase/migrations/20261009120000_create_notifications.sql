-- Stores notifications (e.g. new mileage updates) so they persist across sessions.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

create index if not exists notifications_is_read_idx
  on public.notifications (is_read);

alter table public.notifications enable row level security;

drop policy if exists "allow all on notifications"
  on public.notifications;

create policy "allow all on notifications"
  on public.notifications
  for all
  using (true)
  with check (true);