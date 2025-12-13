
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function renameAgent() {
  console.log('Renaming agent...');
  
  const { data, error } = await supabase
    .from('agents')
    .update({ name: '理工助手Pro' })
    .eq('name', '理工助手')
    .select();

  if (error) {
    console.error('Error renaming agent:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Agent renamed successfully:', data);
  } else {
    console.log('Agent "理工助手" not found or already renamed.');
  }
}

renameAgent();
