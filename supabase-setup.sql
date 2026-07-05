-- ============================================================
-- Supabase 后端初始化：收藏表 + 行级权限（RLS）
-- 在 Supabase 控制台 → SQL Editor 里整段粘贴执行一次即可。
-- 账号本身走 Supabase Auth（邮箱+密码），不需要自建用户表。
-- ============================================================

-- 1) 收藏表：每行 = 某用户收藏的某张卡
create table if not exists public.favorites (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  item_type  text not null,          -- 卡片类型：source / book / tool / program ...
  item_id    text not null,          -- 卡片 id
  created_at timestamptz not null default now(),
  -- 同一用户对同一张卡只能收藏一次
  unique (user_id, item_type, item_id)
);

-- 查询加速（按用户拉收藏）
create index if not exists favorites_user_id_idx on public.favorites (user_id);

-- 2) 打开行级安全：默认谁都读不到别人的数据
alter table public.favorites enable row level security;

-- 3) 权限策略：登录用户只能读写「自己」那几行
--    （drop 后重建，保证重复执行也不报错）
drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
  on public.favorites for select
  using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites for delete
  using (auth.uid() = user_id);
