-- Run this entire script in Supabase Dashboard > SQL Editor.
-- Only manually-created authenticated users can insert/edit/delete, and only with MFA (AAL2).
create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  description text not null check (char_length(description) between 5 and 1500),
  technologies text[] not null default '{}',
  github_url text,
  demo_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portfolio_projects enable row level security;

revoke all on public.portfolio_projects from anon, authenticated;
grant select on public.portfolio_projects to anon, authenticated;
grant insert, update, delete on public.portfolio_projects to authenticated;

drop policy if exists "Published projects are public; owner sees own projects with MFA" on public.portfolio_projects;
create policy "Published projects are public; owner sees own projects with MFA"
  on public.portfolio_projects for select to anon, authenticated
  using (
    is_published = true
    or (
      owner_id = (select auth.uid())
      and (auth.jwt() ->> 'aal') = 'aal2'
    )
  );

drop policy if exists "Only MFA-verified owner can insert projects" on public.portfolio_projects;
create policy "Only MFA-verified owner can insert projects"
  on public.portfolio_projects for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists "Only MFA-verified owner can update projects" on public.portfolio_projects;
create policy "Only MFA-verified owner can update projects"
  on public.portfolio_projects for update to authenticated
  using (
    owner_id = (select auth.uid())
    and (auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    owner_id = (select auth.uid())
    and (auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists "Only MFA-verified owner can delete projects" on public.portfolio_projects;
create policy "Only MFA-verified owner can delete projects"
  on public.portfolio_projects for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and (auth.jwt() ->> 'aal') = 'aal2'
  );

create index if not exists portfolio_projects_published_created_idx
  on public.portfolio_projects (is_published, created_at desc);
