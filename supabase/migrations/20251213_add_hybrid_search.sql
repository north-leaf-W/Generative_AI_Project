
-- 优化策略2：混合检索 (Hybrid Search)
-- 虽然 pgvector 插件本身主要用于向量检索，但 PostgreSQL 内置了强大的全文检索功能。
-- 我们可以结合这两者来实现混合检索。
-- 注意：这里使用 'simple' 配置进行中文分词（按空格或标点），因为标准环境可能没有安装 zhparser。
-- 在应用层，我们需要简单地将用户的 query 分词（例如加空格）再传入。

drop function if exists hybrid_match_documents;

create or replace function hybrid_match_documents (
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  query_text text, -- 新增：用于全文检索的文本
  full_text_weight float default 1.0, -- 全文检索的权重 (暂未在排序中使用，仅用于过滤)
  semantic_weight float default 1.0
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float,
  keyword_score float -- 返回关键词匹配得分
)
language plpgsql
as $$
begin
  return query
  with vector_search as (
    -- 1. 向量检索结果 (Semantic Search)
    select
      documents.id,
      documents.content,
      documents.metadata,
      1 - (documents.embedding <=> query_embedding) as similarity,
      0.0 as keyword_score
    from documents
    where 1 - (documents.embedding <=> query_embedding) > match_threshold
    order by documents.embedding <=> query_embedding
    limit match_count * 2 -- 扩大召回，给 Rerank 留空间
  ),
  keyword_search as (
    -- 2. 关键词检索结果 (Keyword Search)
    -- 仅当 query_text 不为空时执行
    select
      documents.id,
      documents.content,
      documents.metadata,
      0.0 as similarity,
      ts_rank(to_tsvector('simple', documents.content), websearch_to_tsquery('simple', query_text)) as keyword_score
    from documents
    where query_text is not null 
      and length(query_text) > 0
      and to_tsvector('simple', documents.content) @@ websearch_to_tsquery('simple', query_text)
    order by keyword_score desc
    limit match_count * 2
  )
  -- 3. 合并结果 (Union)
  select
    coalesce(v.id, k.id) as id,
    coalesce(v.content, k.content) as content,
    coalesce(v.metadata, k.metadata) as metadata,
    coalesce(v.similarity, 0.0) as similarity,
    coalesce(k.keyword_score, 0.0) as keyword_score
  from vector_search v
  full outer join keyword_search k on v.id = k.id
  -- 最终返回去重后的并集，具体的排序交由应用层的 Rerank 模型处理
  limit match_count * 3; 
end;
$$;
