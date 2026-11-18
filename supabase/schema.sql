-- =====================================================================
-- ECO POINT COLLEGE — Supabase schema
-- Rules: 1 bottle = 1 point, 20 bottles ≈ 1 kg.
-- Points move ONLY through SECURITY DEFINER functions called by admins.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  college       text not null default '',
  group_name    text not null default '',
  student_id    text not null default '',
  role          text not null default 'student' check (role in ('student','admin')),
  points        integer not null default 0 check (points >= 0),
  total_bottles integer not null default 0 check (total_bottles >= 0),
  created_at    timestamptz not null default now()
);
create unique index if not exists profiles_student_id_uq
  on public.profiles (lower(student_id)) where student_id <> '';

-- ---------- SUBMISSIONS ----------
create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null unique,                 -- idempotency key from the client
  user_id      uuid not null references public.profiles(id) on delete cascade,
  bottles      integer not null check (bottles between 1 and 500),
  collected_on date not null check (collected_on <= current_date + 1),
  photo_url    text,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note   text,
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
-- Same student, same date, same amount can't be submitted twice (unless rejected).
create unique index if not exists submissions_no_dupes
  on public.submissions (user_id, collected_on, bottles) where status <> 'rejected';
create index if not exists submissions_status_idx on public.submissions (status, created_at desc);
create index if not exists submissions_user_idx on public.submissions (user_id, created_at desc);

-- ---------- REWARDS ----------
create table if not exists public.rewards (
  id          uuid primary key default gen_random_uuid(),
  title_kk    text not null,
  title_ru    text not null,
  desc_kk     text not null default '',
  desc_ru     text not null default '',
  category    text not null check (category in ('merch','stationery','eco','certificate','gift')),
  cost        integer not null check (cost > 0),
  stock       integer not null default 0 check (stock >= 0),
  icon        text not null default 'gift',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- REDEMPTIONS ----------
create table if not exists public.redemptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  reward_id   uuid not null references public.rewards(id),
  cost        integer not null check (cost > 0),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists redemptions_status_idx on public.redemptions (status, created_at desc);

-- ---------- TRANSACTIONS (immutable ledger) ----------
create table if not exists public.point_ledger (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      integer not null,                       -- + earn, - spend
  kind        text not null check (kind in ('earn','spend','adjust')),
  ref_id      uuid,
  description text not null default '',
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists point_ledger_user_idx on public.point_ledger (user_id, created_at desc);

-- ---------- HELPERS ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- New auth user -> profile (from sign-up metadata). Role is ALWAYS student.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, college, group_name, student_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'college',''),
    coalesce(new.raw_user_meta_data->>'group_name',''),
    coalesce(new.raw_user_meta_data->>'student_id','')
  );
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that existed before this schema.
insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1))
from auth.users u on conflict (id) do nothing;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles     enable row level security;
alter table public.submissions  enable row level security;
alter table public.rewards      enable row level security;
alter table public.redemptions  enable row level security;
alter table public.point_ledger enable row level security;

-- profiles: everyone signed in can read (leaderboard); students edit only safe columns
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, college, group_name) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;

-- submissions: students insert own pending rows, read own; admins read all. No direct updates.
drop policy if exists sub_insert_own on public.submissions;
create policy sub_insert_own on public.submissions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null);
drop policy if exists sub_read on public.submissions;
create policy sub_read on public.submissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke update, delete on public.submissions from authenticated, anon;

-- rewards: readable by all signed-in users; managed by admins
drop policy if exists rewards_read on public.rewards;
create policy rewards_read on public.rewards for select to authenticated using (active or public.is_admin());
drop policy if exists rewards_admin_write on public.rewards;
create policy rewards_admin_write on public.rewards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- redemptions: created via RPC only; read own or admin
drop policy if exists red_read on public.redemptions;
create policy red_read on public.redemptions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.redemptions from authenticated, anon;

-- transactions: read own or admin; written only by functions
drop policy if exists tx_read on public.point_ledger;
create policy tx_read on public.point_ledger for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.point_ledger from authenticated, anon;

-- ---------- RPC: review a bottle submission (admin only) ----------
create or replace function public.review_submission(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s public.submissions;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into s from public.submissions where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if s.status <> 'pending' then raise exception 'already_reviewed'; end if;
  if s.user_id = auth.uid() then raise exception 'cannot_review_own'; end if;

  update public.submissions
     set status = case when p_approve then 'approved' else 'rejected' end,
         admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;

  if p_approve then
    update public.profiles
       set points = points + s.bottles, total_bottles = total_bottles + s.bottles
     where id = s.user_id;
    insert into public.point_ledger (user_id, amount, kind, ref_id, description, created_by)
    values (s.user_id, s.bottles, 'earn', s.id, s.bottles || ' bottles', auth.uid());
  end if;
end $$;

-- ---------- RPC: student requests a reward (points held until approval) ----------
create or replace function public.request_reward(p_reward uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.rewards; avail integer; new_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into r from public.rewards where id = p_reward and active;
  if not found then raise exception 'reward_not_found'; end if;
  if r.stock <= 0 then raise exception 'out_of_stock'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;   -- serialize per student
  select p.points - coalesce((select sum(cost) from public.redemptions
                               where user_id = p.id and status = 'pending'), 0)
    into avail from public.profiles p where p.id = auth.uid();
  if avail < r.cost then raise exception 'not_enough_points'; end if;
  insert into public.redemptions (user_id, reward_id, cost) values (auth.uid(), r.id, r.cost)
  returning id into new_id;
  return new_id;
end $$;

-- ---------- RPC: admin approves / rejects a redemption ----------
create or replace function public.review_redemption(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare d public.redemptions; pts integer; rw public.rewards;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into d from public.redemptions where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if d.status <> 'pending' then raise exception 'already_reviewed'; end if;
  if d.user_id = auth.uid() then raise exception 'cannot_review_own'; end if;

  if p_approve then
    select points into pts from public.profiles where id = d.user_id for update;
    if pts < d.cost then raise exception 'not_enough_points'; end if;
    select * into rw from public.rewards where id = d.reward_id for update;
    if rw.stock <= 0 then raise exception 'out_of_stock'; end if;
    update public.rewards set stock = stock - 1 where id = rw.id;
    update public.profiles set points = points - d.cost where id = d.user_id;
    insert into public.point_ledger (user_id, amount, kind, ref_id, description, created_by)
    values (d.user_id, -d.cost, 'spend', d.id, rw.title_ru, auth.uid());
  end if;

  update public.redemptions
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
end $$;

-- ---------- RPC: admin manual points adjustment ----------
create or replace function public.adjust_points(p_user uuid, p_amount integer, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_user = auth.uid() then raise exception 'cannot_adjust_own'; end if;
  if p_amount = 0 then return; end if;
  update public.profiles set points = points + p_amount where id = p_user;  -- check (points>=0) guards
  insert into public.point_ledger (user_id, amount, kind, description, created_by)
  values (p_user, p_amount, 'adjust', coalesce(p_reason,''), auth.uid());
end $$;

-- ---------- RPC: admin changes a user's role ----------
create or replace function public.set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_user = auth.uid() then raise exception 'cannot_change_own_role'; end if;
  if p_role not in ('student','admin') then raise exception 'bad_role'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

-- ---------- RPC: leaderboard (overall | month) ----------
create or replace function public.leaderboard(p_period text default 'overall', p_limit int default 10)
returns table (rank bigint, id uuid, full_name text, group_name text, points bigint)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, p.full_name, p.group_name,
      case when p_period = 'month' then
        coalesce((select sum(t.amount) from public.point_ledger t
                   where t.user_id = p.id and t.kind = 'earn'
                     and t.created_at >= date_trunc('month', now())), 0)
      else p.total_bottles::bigint end as points
    from public.profiles p where p.role = 'student'
  )
  select rank() over (order by points desc, full_name), id, full_name, group_name, points
    from base where points > 0
   order by points desc, full_name limit p_limit;
$$;

-- My overall rank
create or replace function public.my_rank()
returns bigint language sql stable security definer set search_path = public as $$
  select r from (
    select id, rank() over (order by total_bottles desc) r from public.profiles where role = 'student'
  ) x where id = auth.uid();
$$;

-- ---------- RPC: environmental statistics ----------
create or replace function public.global_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total_bottles',   coalesce((select sum(total_bottles) from public.profiles), 0),
    'students',        (select count(*) from public.profiles where role = 'student'),
    'active_students', (select count(distinct user_id) from public.submissions
                         where status = 'approved' and created_at >= now() - interval '30 days'),
    'pending_submissions', (select count(*) from public.submissions where status = 'pending'),
    'pending_redemptions', (select count(*) from public.redemptions where status = 'pending'),
    'monthly', coalesce((
      select json_agg(json_build_object('month', to_char(m, 'YYYY-MM'), 'bottles', b) order by m)
      from (
        select gs as m,
               coalesce((select sum(bottles) from public.submissions s
                          where s.status = 'approved'
                            and date_trunc('month', s.reviewed_at) = gs), 0) as b
        from generate_series(date_trunc('month', now()) - interval '5 months',
                             date_trunc('month', now()), interval '1 month') gs
      ) q), '[]'::json),
    'groups', coalesce((
      select json_agg(g order by g.bottles desc) from (
        select group_name as name, sum(total_bottles) as bottles, count(*) as students
        from public.profiles where role = 'student' and group_name <> ''
        group by group_name order by sum(total_bottles) desc limit 10
      ) g), '[]'::json)
  );
$$;

revoke execute on function public.review_submission(uuid, boolean, text), public.request_reward(uuid),
  public.review_redemption(uuid, boolean), public.adjust_points(uuid, integer, text), public.set_role(uuid, text),
  public.leaderboard(text, integer), public.my_rank(), public.global_stats(), public.is_admin(),
  public.handle_new_user() from public, anon;
revoke execute on function public.handle_new_user() from authenticated;
grant execute on function public.review_submission, public.request_reward, public.review_redemption,
  public.adjust_points, public.set_role, public.leaderboard, public.my_rank, public.global_stats,
  public.is_admin to authenticated;

-- ---------- REALTIME ----------
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.submissions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.redemptions;
exception when duplicate_object then null; end $$;

-- ---------- STORAGE (bottle photos) ----------
insert into storage.buckets (id, name, public) values ('bottle-photos', 'bottle-photos', true)
on conflict (id) do nothing;
drop policy if exists photos_upload_own on storage.objects;
create policy photos_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'bottle-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'bottle-photos');

-- ---------- SEED REWARDS ----------
insert into public.rewards (title_kk, title_ru, desc_kk, desc_ru, category, cost, stock, icon)
select * from (values
  ('Колледж футболкасы','Футболка колледжа','Колледж логотипі бар мақта футболка','Хлопковая футболка с логотипом колледжа','merch',300,25,'tshirt-crew'),
  ('Колледж худиі','Худи колледжа','Жылы худи, эко-коллекция','Тёплое худи из эко-коллекции','merch',600,10,'hanger'),
  ('Эко-дәптер','Эко-тетрадь','Қайта өңделген қағаздан жасалған дәптер','Тетрадь из переработанной бумаги','stationery',60,100,'notebook'),
  ('Кеңсе тауарлары жиынтығы','Набор канцелярии','Қалам, қарындаш, сызғыш','Ручка, карандаш, линейка','stationery',120,50,'pencil-ruler'),
  ('Бамбук бөтелке','Бамбуковая бутылка','Қайта қолданылатын су бөтелкесі','Многоразовая бутылка для воды','eco',250,30,'bottle-tonic-outline'),
  ('Шоппер-сөмке','Эко-сумка шоппер','Пластик пакеттің орнына','Замена пластиковым пакетам','eco',150,40,'shopping-outline'),
  ('Эко-белсенді сертификаты','Сертификат эко-активиста','Ресми колледж сертификаты','Официальный сертификат колледжа','certificate',200,999,'certificate-outline'),
  ('Құрмет грамотасы','Почётная грамота','Директордың атынан грамота','Грамота от имени директора','certificate',400,999,'medal-outline'),
  ('Кинотеатрға билет','Билет в кинотеатр','Демалыс күніне сыйлық','Подарок на выходные','gift',500,15,'ticket-outline'),
  ('Құпия сыйлық','Секретный подарок','Ең белсенділерге арнайы сыйлық','Специальный подарок для самых активных','gift',1000,5,'gift-outline')
) v(title_kk,title_ru,desc_kk,desc_ru,category,cost,stock,icon)
where not exists (select 1 from public.rewards);
