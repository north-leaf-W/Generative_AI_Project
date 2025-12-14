-- 创建计算智能体收藏数的函数
-- create or replace function get_agent_favorites_count(agent_id uuid)
-- returns bigint
-- language sql
-- security definer
-- as $$
--   select count(*)
--   from favorites
--   where agent_id = $1;
-- $$;

-- 或者更高效的方式：在查询时直接关联
-- 我们也可以创建一个视图来包含收藏数
create or replace view public_agents_with_counts as
select 
  a.*,
  (select count(*) from favorites f where f.agent_id = a.id) as favorites_count
from agents a
where a.status = 'public' and a.is_active = true;
