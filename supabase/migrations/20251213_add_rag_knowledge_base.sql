-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store your documents
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  content text,
  metadata jsonb,
  embedding vector(1536), -- Aliyun text-embedding-v4 default dimension
  created_at timestamptz default now()
);

-- Create a function to search for documents
create or replace function match_documents (
  query_embedding vector(1536),
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

-- Enable RLS
alter table documents enable row level security;

-- Create a policy that allows anyone to read documents (Public Knowledge Base)
create policy "Allow public read access"
  on documents
  for select
  to public
  using (true);

-- Create a policy that allows authenticated users (admins/creators) to insert documents
-- Ideally this should be restricted to admins only, but for now we allow authenticated users
create policy "Allow authenticated insert access"
  on documents
  for insert
  to authenticated
  with check (true);
