-- Overview "List of Projects" (Members & projects) – persist per workspace so it syncs across devices.
-- Run in Supabase Dashboard → SQL Editor.
-- Requires public.set_updated_at() (from 001_initial_schema.sql or 006_workspace_bm_ba_settings.sql).

create table if not exists public.overview_member_projects (
  workspace text primary key,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists overview_member_projects_updated_at on public.overview_member_projects;
create trigger overview_member_projects_updated_at
  before update on public.overview_member_projects
  for each row execute function public.set_updated_at();

alter table public.overview_member_projects enable row level security;

drop policy if exists "Allow all on overview_member_projects" on public.overview_member_projects;
create policy "Allow all on overview_member_projects" on public.overview_member_projects
  for all using (true) with check (true);
