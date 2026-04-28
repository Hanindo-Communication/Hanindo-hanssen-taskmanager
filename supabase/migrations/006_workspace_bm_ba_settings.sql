-- BM/BA settings (Hanssen / Kezia job desc + client rows) — singleton payload JSON
create table if not exists public.workspace_bm_ba_settings (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger workspace_bm_ba_settings_updated_at
  before update on public.workspace_bm_ba_settings
  for each row execute function public.set_updated_at();

alter table public.workspace_bm_ba_settings enable row level security;

create policy "Allow all on workspace_bm_ba_settings" on public.workspace_bm_ba_settings
  for all using (true) with check (true);
