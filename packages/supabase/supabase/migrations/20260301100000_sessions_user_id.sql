-- Add per-user ownership to sessions (for databases created before user_id existed).

alter table public.sessions
  add column if not exists user_id text references public.users (id);

create index if not exists idx_sessions_user_id on public.sessions (user_id);
