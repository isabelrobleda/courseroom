-- ============================================================
-- Courseroom schema. Paste this whole file into the Supabase
-- SQL editor (Dashboard -> SQL Editor -> New query) and run it.
-- ============================================================

-- ---------- Profiles (one row per auth user) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

-- Auto-create profile on sign-up. Change the email below to make yourself admin
-- automatically; you can also promote anyone later with:
--   update public.profiles set role = 'admin' where email = 'someone@example.com';
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when lower(new.email) = lower('isabel.robleda@auto1.com') then 'admin' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- Content ----------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  position int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  type text not null check (type in ('text', 'image', 'pdf', 'video')),
  title text not null,
  body text,          -- markdown-ish text, or the video URL
  file_path text,     -- path inside the "content" storage bucket
  position int not null default 0
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null unique references public.modules(id) on delete cascade,
  title text not null default 'Quiz',
  pass_score int
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_index int not null default 0,
  position int not null default 0
);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null unique references public.modules(id) on delete cascade,
  title text not null default 'Homework',
  instructions text,
  allow_file boolean not null default true,
  allow_text boolean not null default true
);

-- ---------- Student activity ----------
create table if not exists public.module_views (
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  score int not null,
  total int not null,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists quiz_attempts_user_quiz on public.quiz_attempts(user_id, quiz_id);

create table if not exists public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  homework_id uuid not null references public.homework(id) on delete cascade,
  text_answer text,
  file_path text,     -- path inside the private "homework" bucket
  file_name text,
  submitted_at timestamptz not null default now()
);
create index if not exists hw_sub_user_hw on public.homework_submissions(user_id, homework_id);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.content_items enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.homework enable row level security;
alter table public.module_views enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.homework_submissions enable row level security;

-- profiles: users see themselves; admins see everyone
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Students cannot promote themselves: only admins may change the role column.
create or replace function public.protect_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role <> old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_role();
drop policy if exists "profiles admin all" on public.profiles;
create policy "profiles admin all" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- content tables: admins do anything; signed-in students read published content
drop policy if exists "courses admin" on public.courses;
create policy "courses admin" on public.courses for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "courses read" on public.courses;
create policy "courses read" on public.courses for select using (auth.uid() is not null and published);

drop policy if exists "modules admin" on public.modules;
create policy "modules admin" on public.modules for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "modules read" on public.modules;
create policy "modules read" on public.modules for select using (
  auth.uid() is not null and published and exists (select 1 from public.courses c where c.id = course_id and c.published)
);

drop policy if exists "content admin" on public.content_items;
create policy "content admin" on public.content_items for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "content read" on public.content_items;
create policy "content read" on public.content_items for select using (
  auth.uid() is not null and exists (select 1 from public.modules m where m.id = module_id)
);

drop policy if exists "quizzes admin" on public.quizzes;
create policy "quizzes admin" on public.quizzes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "quizzes read" on public.quizzes;
create policy "quizzes read" on public.quizzes for select using (
  auth.uid() is not null and exists (select 1 from public.modules m where m.id = module_id)
);

-- Students can read questions (including correct_index) so the quiz is graded client-side.
-- Fine for a light course; move grading to an RPC if you ever need to hide answers.
drop policy if exists "questions admin" on public.quiz_questions;
create policy "questions admin" on public.quiz_questions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "questions read" on public.quiz_questions;
create policy "questions read" on public.quiz_questions for select using (
  auth.uid() is not null and exists (select 1 from public.quizzes q where q.id = quiz_id)
);

drop policy if exists "homework admin" on public.homework;
create policy "homework admin" on public.homework for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "homework read" on public.homework;
create policy "homework read" on public.homework for select using (
  auth.uid() is not null and exists (select 1 from public.modules m where m.id = module_id)
);

-- activity tables: students write their own rows, read their own; admins read all
drop policy if exists "views own" on public.module_views;
create policy "views own" on public.module_views for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "views admin" on public.module_views;
create policy "views admin" on public.module_views for select using (public.is_admin());

drop policy if exists "attempts own" on public.quiz_attempts;
create policy "attempts own" on public.quiz_attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "attempts admin" on public.quiz_attempts;
create policy "attempts admin" on public.quiz_attempts for select using (public.is_admin());

drop policy if exists "subs own" on public.homework_submissions;
create policy "subs own" on public.homework_submissions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "subs admin" on public.homework_submissions;
create policy "subs admin" on public.homework_submissions for select using (public.is_admin());

-- ---------- Storage buckets ----------
insert into storage.buckets (id, name, public) values ('content', 'content', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('homework', 'homework', false)
  on conflict (id) do nothing;

-- content bucket: anyone can read (public), only admins can write
drop policy if exists "content public read" on storage.objects;
create policy "content public read" on storage.objects for select using (bucket_id = 'content');
drop policy if exists "content admin write" on storage.objects;
create policy "content admin write" on storage.objects for insert with check (bucket_id = 'content' and public.is_admin());
drop policy if exists "content admin update" on storage.objects;
create policy "content admin update" on storage.objects for update using (bucket_id = 'content' and public.is_admin());
drop policy if exists "content admin delete" on storage.objects;
create policy "content admin delete" on storage.objects for delete using (bucket_id = 'content' and public.is_admin());

-- homework bucket: students upload into their own folder (<user_id>/...), read their own; admins read all
drop policy if exists "homework student upload" on storage.objects;
create policy "homework student upload" on storage.objects for insert with check (
  bucket_id = 'homework' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "homework read own or admin" on storage.objects;
create policy "homework read own or admin" on storage.objects for select using (
  bucket_id = 'homework' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

-- ---------- Report view (used by the admin Reports page + CSV) ----------
create or replace view public.student_module_report
with (security_invoker = true) as
select
  p.id            as user_id,
  p.email,
  p.full_name,
  c.id            as course_id,
  c.title         as course_title,
  m.id            as module_id,
  m.title         as module_title,
  m.position      as module_position,
  (mv.user_id is not null)                as module_read,
  mv.viewed_at,
  q.id            as quiz_id,
  qa.best_score,
  qa.total        as quiz_total,
  qa.attempts     as quiz_attempts,
  h.id            as homework_id,
  (hs.id is not null)                     as homework_submitted,
  hs.submitted_at as homework_submitted_at
from public.profiles p
cross join public.modules m
join public.courses c on c.id = m.course_id
left join public.module_views mv on mv.user_id = p.id and mv.module_id = m.id
left join public.quizzes q on q.module_id = m.id
left join lateral (
  select max(score) as best_score, max(total) as total, count(*) as attempts
  from public.quiz_attempts a where a.quiz_id = q.id and a.user_id = p.id
) qa on true
left join public.homework h on h.module_id = m.id
left join lateral (
  select s.id, s.submitted_at from public.homework_submissions s
  where s.homework_id = h.id and s.user_id = p.id
  order by s.submitted_at desc limit 1
) hs on true
where p.role = 'student';
