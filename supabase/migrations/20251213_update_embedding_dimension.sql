-- Drop the function first as it depends on the table
drop function if exists match_documents;

-- Drop the table to ensure clean state and avoid dimension mismatch issues with existing data
drop table if exists documents;

-- Recreate the table with 1024 dimensions (Aliyun text-embedding-v4 default)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  content text,
  metadata jsonb,
  embedding vector(1024), 
  created_at timestamptz default now()
);

-- Enable RLS
alter table documents enable row level security;

-- Create policy for public read access
create policy "Allow public read access"
  on documents
  for select
  to public
  using (true);

-- Create policy for authenticated insert access
create policy "Allow authenticated insert access"
  on documents
  for insert
  to authenticated
  with check (true);

-- Recreate the match_documents function with 1024 dimensions
create or replace function match_documents (
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
