-- 修复 Security Definer View 安全警告
-- 方案：将权限提升逻辑下沉到函数中，视图恢复为默认的 Security Invoker

-- 1. 创建一个 Security Definer 的函数来获取收藏数
-- 这样可以绕过 RLS 统计所有人的收藏，但只返回数字，不泄露用户 ID
create or replace function get_agent_favorites_count(target_agent_id uuid)
returns bigint
language sql
security definer
set search_path = public -- 最佳实践：重置搜索路径防止劫持
as $$
  select count(*)
  from favorites
  where agent_id = target_agent_id;
$$;

-- 2. 重建视图
-- 先删除旧视图以清除可能存在的属性
drop view if exists public_agents_with_counts;

-- 创建新视图 (默认就是 Security Invoker)
create or replace view public_agents_with_counts as
select 
  a.*,
  get_agent_favorites_count(a.id) as favorites_count
from agents a
where a.status = 'public' and a.is_active = true;

-- 3. 授权
-- 允许所有用户（登录和未登录）调用此函数和视图
grant execute on function get_agent_favorites_count(uuid) to authenticated, anon;
grant select on public_agents_with_counts to authenticated, anon;
