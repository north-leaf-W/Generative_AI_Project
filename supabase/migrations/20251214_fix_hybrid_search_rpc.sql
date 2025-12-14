-- 修复 hybrid_match_documents 函数的返回类型问题
-- 问题描述：原函数定义中 keyword_score 为 float8，但 ts_rank 返回 float4 (real)，导致 RPC 调用失败
-- 修复方法：显式转换类型为 float8

create or replace function hybrid_match_documents (
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  query_text text,
  full_text_weight float default 1.0,
  semantic_weight float default 1.0
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float,
  keyword_score float
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
      (1 - (documents.embedding <=> query_embedding))::float8 as similarity,
      0.0::float8 as keyword_score
    from documents
    where 1 - (documents.embedding <=> query_embedding) > match_threshold
    order by documents.embedding <=> query_embedding
    limit match_count * 2
  ),
  keyword_search as (
    -- 2. 关键词检索结果 (Keyword Search)
    select
      documents.id,
      documents.content,
      documents.metadata,
      0.0::float8 as similarity,
      (ts_rank(to_tsvector('simple', documents.content), websearch_to_tsquery('simple', query_text)))::float8 as keyword_score
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
    coalesce(v.similarity, 0.0::float8) as similarity,
    coalesce(k.keyword_score, 0.0::float8) as keyword_score
  from vector_search v
  full outer join keyword_search k on v.id = k.id
  limit match_count * 3; 
end;
$$;
