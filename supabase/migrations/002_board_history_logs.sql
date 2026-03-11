-- History logs per board (untuk audit perubahan oleh user)
alter table public.boards
  add column if not exists history_logs jsonb not null default '[]';

comment on column public.boards.history_logs is 'Array of { id, timestamp, actor, action, details? } for audit trail';
