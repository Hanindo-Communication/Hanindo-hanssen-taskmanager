-- BM/BA settings (Hanssen / Kezia job desc + client rows) — singleton payload JSON
-- Includes set_updated_at so this migration applies cleanly even if 001_initial_schema was never run.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.workspace_bm_ba_settings (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists workspace_bm_ba_settings_updated_at on public.workspace_bm_ba_settings;
create trigger workspace_bm_ba_settings_updated_at
  before update on public.workspace_bm_ba_settings
  for each row execute function public.set_updated_at();

alter table public.workspace_bm_ba_settings enable row level security;

drop policy if exists "Allow all on workspace_bm_ba_settings" on public.workspace_bm_ba_settings;
create policy "Allow all on workspace_bm_ba_settings" on public.workspace_bm_ba_settings
  for all using (true) with check (true);
