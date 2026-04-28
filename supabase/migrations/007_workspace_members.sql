-- Workspace roles per email (Settings → Role per member).
-- Safe to re-run: drops/recreates policy by name.

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member', 'viewer'))
);

alter table public.workspace_members enable row level security;

drop policy if exists "Allow all for anon" on public.workspace_members;
create policy "Allow all for anon" on public.workspace_members
  for all using (true) with check (true);
