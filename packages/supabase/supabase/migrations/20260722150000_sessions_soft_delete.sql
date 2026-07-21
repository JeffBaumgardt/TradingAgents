-- Soft-delete sessions instead of hard-deleting rows (preserve audit + usage history).

alter table public.sessions
  add column if not exists deleted_on timestamptz;

comment on column public.sessions.deleted_on is
  'Set when the session is soft-deleted; null means the session is visible to the user.';

create index if not exists idx_sessions_user_id_active
  on public.sessions (user_id, analysis_date desc, created_at desc)
  where deleted_on is null;
