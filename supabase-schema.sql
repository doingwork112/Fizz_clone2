-- ============================================================
-- FIZZ CLONE - SUPABASE SQL SCHEMA
-- 在 Supabase 的 SQL Editor 里运行这个文件
-- ============================================================

-- 启用 UUID 扩展
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES 表（用户资料，关联 auth.users）
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  school text not null,
  avatar_color text not null default '#7c6ff7',
  avatar_initials text not null default '??',
  total_fizzups integer not null default 0,
  created_at timestamptz default now()
);

-- 自动创建 profile（注册时触发）
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, school, avatar_color, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'school', '未知学校'),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#7c6ff7'),
    coalesce(new.raw_user_meta_data->>'avatar_initials', '??')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. POSTS 表
-- ============================================================
create table public.posts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  is_anon boolean not null default true,
  school text not null,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  is_hot boolean not null default false,
  poll jsonb default null,   -- { question, options: [], votes: [] }
  created_at timestamptz default now()
);

-- ============================================================
-- 3. FIZZUPS 表（点赞记录，防止重复）
-- ============================================================
create table public.fizzups (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- 点赞时自动更新 likes_count 和作者 total_fizzups
create or replace function public.handle_fizzup_insert()
returns trigger as $$
begin
  update public.posts set likes_count = likes_count + 1 where id = new.post_id;
  update public.profiles set total_fizzups = total_fizzups + 1
    where id = (select user_id from public.posts where id = new.post_id);
  -- 超过100赞自动标记为热门
  update public.posts set is_hot = true where id = new.post_id and likes_count >= 100;
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.handle_fizzup_delete()
returns trigger as $$
begin
  update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  update public.profiles set total_fizzups = greatest(total_fizzups - 1, 0)
    where id = (select user_id from public.posts where id = old.post_id);
  return old;
end;
$$ language plpgsql security definer;

create trigger on_fizzup_insert
  after insert on public.fizzups
  for each row execute procedure public.handle_fizzup_insert();

create trigger on_fizzup_delete
  after delete on public.fizzups
  for each row execute procedure public.handle_fizzup_delete();

-- ============================================================
-- 4. COMMENTS 表
-- ============================================================
create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);

create or replace function public.handle_comment_insert()
returns trigger as $$
begin
  update public.posts set comments_count = comments_count + 1 where id = new.post_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_comment_insert
  after insert on public.comments
  for each row execute procedure public.handle_comment_insert();

-- ============================================================
-- 5. MARKETPLACE LISTINGS 表
-- ============================================================
create table public.listings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  price numeric(10,2) not null default 0,
  category text not null default 'other', -- books, electronics, clothes, other
  description text,
  emoji text not null default '📦',
  school text not null,
  is_sold boolean not null default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 6. EVENTS 表
-- ============================================================
create table public.events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  event_date date not null,
  location text,
  description text,
  school text not null,
  going_count integer not null default 1,
  created_at timestamptz default now()
);

-- ============================================================
-- 7. EVENT_GOING 表（参加活动记录）
-- ============================================================
create table public.event_going (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

create or replace function public.handle_going_insert()
returns trigger as $$
begin
  update public.events set going_count = going_count + 1 where id = new.event_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_going_insert
  after insert on public.event_going
  for each row execute procedure public.handle_going_insert();

-- ============================================================
-- 8. MESSAGES 表（私信）
-- ============================================================
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  from_user_id uuid references public.profiles(id) on delete cascade not null,
  to_user_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 9. ONLINE PRESENCE 表（在线人数）
-- ============================================================
create table public.presence (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  last_seen timestamptz default now(),
  school text
);

-- ============================================================
-- RLS POLICIES（行级安全）
-- ============================================================
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.fizzups enable row level security;
alter table public.comments enable row level security;
alter table public.listings enable row level security;
alter table public.events enable row level security;
alter table public.event_going enable row level security;
alter table public.messages enable row level security;
alter table public.presence enable row level security;

-- Profiles: 所有人可读，本人可写
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Posts: 所有人可读，登录用户可发布，本人可删除
create policy "posts_select" on public.posts for select using (true);
create policy "posts_insert" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_update" on public.posts for update using (auth.uid() = user_id);
create policy "posts_delete" on public.posts for delete using (auth.uid() = user_id);

-- Fizzups: 所有人可读，登录用户可操作
create policy "fizzups_select" on public.fizzups for select using (true);
create policy "fizzups_insert" on public.fizzups for insert with check (auth.uid() = user_id);
create policy "fizzups_delete" on public.fizzups for delete using (auth.uid() = user_id);

-- Comments: 所有人可读，登录用户可发，本人可删
create policy "comments_select" on public.comments for select using (true);
create policy "comments_insert" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments_delete" on public.comments for delete using (auth.uid() = user_id);

-- Listings: 所有人可读，登录用户可发，本人可修改删除
create policy "listings_select" on public.listings for select using (true);
create policy "listings_insert" on public.listings for insert with check (auth.uid() = user_id);
create policy "listings_update" on public.listings for update using (auth.uid() = user_id);
create policy "listings_delete" on public.listings for delete using (auth.uid() = user_id);

-- Events: 所有人可读，登录用户可发
create policy "events_select" on public.events for select using (true);
create policy "events_insert" on public.events for insert with check (auth.uid() = user_id);

-- Event going
create policy "going_select" on public.event_going for select using (true);
create policy "going_insert" on public.event_going for insert with check (auth.uid() = user_id);
create policy "going_delete" on public.event_going for delete using (auth.uid() = user_id);

-- Messages: 只有发件人和收件人可读
create policy "messages_select" on public.messages for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "messages_insert" on public.messages for insert with check (auth.uid() = from_user_id);

-- Presence: 所有人可读，本人可写
create policy "presence_select" on public.presence for select using (true);
create policy "presence_upsert" on public.presence for insert with check (auth.uid() = user_id);
create policy "presence_update" on public.presence for update using (auth.uid() = user_id);

-- ============================================================
-- 种子数据（可选，测试用）
-- ============================================================
-- 注意：种子数据需要先注册用户，然后手动执行
-- 或者注册后在 posts 表里直接 insert
