create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  used integer not null default 0 check (used >= 0),
  bonus integer not null default 0 check (bonus >= 0)
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.daily_usage enable row level security;

create policy "users manage own conversations" on public.conversations
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users read own messages" on public.messages
for select using (auth.uid() = user_id);

create policy "users add own messages" on public.messages
for insert with check (auth.uid() = user_id and role = 'user');

create policy "users read own usage" on public.daily_usage
for select using (auth.uid() = user_id);

create or replace function public.consume_chat_message()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid(); row_usage public.daily_usage%rowtype;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.daily_usage(user_id,usage_date,used,bonus)
  values(uid,(now() at time zone 'utc')::date,0,0)
  on conflict(user_id) do nothing;

  select * into row_usage from public.daily_usage where user_id=uid for update;
  if row_usage.usage_date <> (now() at time zone 'utc')::date then
    update public.daily_usage set usage_date=(now() at time zone 'utc')::date,used=0,bonus=0
    where user_id=uid returning * into row_usage;
  end if;

  if row_usage.used < 10 then
    update public.daily_usage set used=used+1 where user_id=uid returning * into row_usage;
  elsif row_usage.bonus > 0 then
    update public.daily_usage set bonus=bonus-1 where user_id=uid returning * into row_usage;
  else
    return jsonb_build_object('allowed',false,'used',row_usage.used,'bonus',row_usage.bonus);
  end if;
  return jsonb_build_object('allowed',true,'used',row_usage.used,'bonus',row_usage.bonus);
end;
$$;

revoke all on function public.consume_chat_message() from public;
grant execute on function public.consume_chat_message() to authenticated;

create or replace function public.touch_conversation()
returns trigger language plpgsql as $$
begin update public.conversations set updated_at=now() where id=new.conversation_id; return new; end; $$;
drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation after insert on public.messages
for each row execute function public.touch_conversation();

-- Reward credits are intentionally NOT writable by browser clients.
-- Add a verified ad-network server callback before enabling bonus rewards.