import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedAgent() {
  console.log('Seeding Science Assistant Agent...');

  // Check if agent exists
  const { data: existingAgents, error: searchError } = await supabase
    .from('agents')
    .select('id')
    .eq('name', '理工助手')
    .limit(1);

  if (searchError) {
    console.error('Error checking for existing agent:', searchError);
    return;
  }

  if (existingAgents && existingAgents.length > 0) {
    console.log('Science Assistant Agent already exists. Skipping.');
    return;
  }

  // Insert Agent
  const { data, error } = await supabase
    .from('agents')
    .insert({
      name: '理工助手',
      description: '专为理工学子打造的智能助手。基于RAG技术，内置信控学院政策文件、教务处通知等私有知识库，能够准确回答关于保研、体测、综测等具体问题。',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=polytechnic',
      system_prompt: '你是一个专为理工学子打造的智能助手。基于RAG技术，内置信控学院政策文件、教务处通知等私有知识库，能够准确回答关于保研、体测、综测等具体问题。请基于上下文信息回答用户的问题。',
      config: { rag_enabled: true },
      status: 'public',
      tags: ['高级智能体', '校园助手', 'RAG'],
      category: 'education'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating agent:', error);
  } else {
    console.log('Successfully created Science Assistant Agent:', data);
  }
}

seedAgent();
