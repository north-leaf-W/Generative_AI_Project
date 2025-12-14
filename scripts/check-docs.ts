
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://saqoxmhanldzzprmqwfv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhcW94bWhhbmxkenpwcm1xd2Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTAxMzQyMCwiZXhwIjoyMDgwNTg5NDIwfQ.ulrBjsgUXOhobLCfYjFsVv-VX1iP9Nz0Wn3sAMt5gjk';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDocs() {
  console.log('Checking documents in Supabase...');

  // 1. Count total documents
  const { count, error: countError } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting documents:', countError);
    return;
  }
  console.log(`Total documents: ${count}`);

  if (count === 0) {
    console.log('No documents found. Please ingest some documents first.');
    return;
  }

  // 2. Search for "周炜" using simple text search
  console.log('Searching for "周炜" in document content...');
  // 尝试不带单引号的搜索，或者模糊搜索
  const { data: textMatches, error: searchError } = await supabase
    .from('documents')
    .select('id, content, metadata')
    .ilike('content', '%周炜%') 
    .limit(5);

  if (searchError) {
    console.error('Error searching documents:', searchError);
  } else {
    console.log(`Found ${textMatches?.length || 0} matches for "周炜" (ilike search):`);
    textMatches?.forEach(doc => {
      console.log(`- [${doc.id}] ${doc.content.substring(0, 50)}...`);
    });
  }
  
  // 3. Check embedding dimension
  const { data: sampleDoc } = await supabase
    .from('documents')
    .select('embedding')
    .limit(1)
    .single();
    
  if (sampleDoc && sampleDoc.embedding) {
      console.log('Sample embedding length:', JSON.parse(sampleDoc.embedding).length);
  }
}

checkDocs();
