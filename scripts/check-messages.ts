
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLatestMessages() {
  console.log('Checking latest messages...');
  
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  console.log('Latest 5 messages:');
  messages.forEach(msg => {
    console.log('-----------------------------------');
    console.log(`ID: ${msg.id}`);
    console.log(`Role: ${msg.role}`);
    console.log(`Content Preview: ${msg.content?.substring(0, 50)}...`);
    console.log(`Files:`, JSON.stringify(msg.files, null, 2));
    console.log(`Images:`, msg.images?.length || 0);
  });
}

checkLatestMessages();
