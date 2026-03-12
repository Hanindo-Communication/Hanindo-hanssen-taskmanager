-- Overview "List of Projects" (Members & projects) – persist per workspace so it syncs across devices.
-- Run in Supabase Dashboard → SQL Editor.

create table if not exists public.overview_member_projects (
  workspace text primary key,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger overview_member_projects_updated_at
  before update on public.overview_member_projects
  for each row execute function public.set_updated_at();

alter table public.overview_member_projects enable row level security;

create policy "Allow all on overview_member_projects" on public.overview_member_projects
  for all using (true) with check (true);
