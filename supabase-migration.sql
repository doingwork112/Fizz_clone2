-- ============================================================
-- FIZZ APP - Migration: Add missing columns and tables
-- 在 Supabase SQL Editor 里运行这个文件
-- ============================================================

-- 1. Posts: add missing columns
alter table public.posts
  add column if not exists dislikes_count integer not null default 0,
  add column if not exists reposts_count integer not null default 0,
  add column if not exists images text[] default '{}',
  add column if not exists repost_of_id uuid references public.posts(id) on delete set null;

-- Allow any authenticated user to update vote counts on posts
-- (needed because post owner RLS would block voters from other users)
drop policy if exists "posts_update" on public.posts;
create policy "posts_update" on public.posts for update using (auth.uid() is not null);

-- 2. Add vote_type to fizzups (so downvotes are tracked separately)
alter table public.fizzups add column if not exists vote_type text not null default 'up';

-- Update fizzup insert trigger to handle vote_type
create or replace function public.handle_fizzup_insert()
returns trigger as $$
begin
  if new.vote_type = 'up' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
    update public.profiles set total_fizzups = total_fizzups + 1
      where id = (select user_id from public.posts where id = new.post_id);
    update public.posts set is_hot = true where id = new.post_id and likes_count >= 100;
  else
    update public.posts set dislikes_count = dislikes_count + 1 where id = new.post_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Update fizzup delete trigger to handle vote_type
create or replace function public.handle_fizzup_delete()
returns trigger as $$
begin
  if old.vote_type = 'up' then
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
    update public.profiles set total_fizzups = greatest(total_fizzups - 1, 0)
      where id = (select user_id from public.posts where id = old.post_id);
  else
    update public.posts set dislikes_count = greatest(dislikes_count - 1, 0) where id = old.post_id;
  end if;
  return old;
end;
$$ language plpgsql security definer;

-- 3. Comments: add missing columns
alter table public.comments
  add column if not exists likes_count integer not null default 0,
  add column if not exists dislikes_count integer not null default 0,
  add column if not exists is_anon boolean not null default false,
  add column if not exists parent_id uuid references public.comments(id) on delete cascade,
  add column if not exists images text[] default '{}';

-- 4. Create comment_votes table
create table if not exists public.comment_votes (
  id uuid default uuid_generate_v4() primary key,
  comment_id uuid references public.comments(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  vote_type text not null default 'up',
  created_at timestamptz default now(),
  unique(comment_id, user_id)
);

alter table public.comment_votes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='comment_votes' and policyname='comment_votes_select') then
    create policy "comment_votes_select" on public.comment_votes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='comment_votes' and policyname='comment_votes_insert') then
    create policy "comment_votes_insert" on public.comment_votes for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='comment_votes' and policyname='comment_votes_delete') then
    create policy "comment_votes_delete" on public.comment_votes for delete using (auth.uid() = user_id);
  end if;
end $$;

-- Triggers to update comment vote counts (bypasses RLS)
create or replace function public.handle_comment_vote_insert()
returns trigger as $$
begin
  if new.vote_type = 'up' then
    update public.comments set likes_count = likes_count + 1 where id = new.comment_id;
  else
    update public.comments set dislikes_count = dislikes_count + 1 where id = new.comment_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.handle_comment_vote_delete()
returns trigger as $$
begin
  if old.vote_type = 'up' then
    update public.comments set likes_count = greatest(likes_count - 1, 0) where id = old.comment_id;
  else
    update public.comments set dislikes_count = greatest(dislikes_count - 1, 0) where id = old.comment_id;
  end if;
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists on_comment_vote_insert on public.comment_votes;
create trigger on_comment_vote_insert
  after insert on public.comment_votes
  for each row execute procedure public.handle_comment_vote_insert();

drop trigger if exists on_comment_vote_delete on public.comment_votes;
create trigger on_comment_vote_delete
  after delete on public.comment_votes
  for each row execute procedure public.handle_comment_vote_delete();

-- 5. Listings: add images column
alter table public.listings add column if not exists images text[] default '{}';

-- 6. Create reposts table (if not exists)
create table if not exists public.reposts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  original_post_id uuid references public.posts(id) on delete cascade not null,
  text text,
  is_anon boolean not null default true,
  school text not null,
  created_at timestamptz default now()
);

alter table public.reposts enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='reposts' and policyname='reposts_select') then
    create policy "reposts_select" on public.reposts for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='reposts' and policyname='reposts_insert') then
    create policy "reposts_insert" on public.reposts for insert with check (auth.uid() = user_id);
  end if;
end $$;

-- 7. Security definer function to increment reposts_count safely
create or replace function public.increment_reposts_count(post_id uuid)
returns void as $$
begin
  update public.posts set reposts_count = reposts_count + 1 where id = post_id;
end;
$$ language plpgsql security definer;
