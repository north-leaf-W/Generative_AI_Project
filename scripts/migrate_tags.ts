
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 加载环境变量 (默认读取当前工作目录下的 .env)
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TAG_MAPPINGS = [
  { old: '通用', new: '效率工具' },
  { old: '效率', new: '效率工具' },
  { old: '生活', new: '生活方式' },
  { old: '创作', new: '文本创作' },
  { old: '教育', new: '学习教育' },
  { old: '编程', new: '代码助手' },
];

async function migrateTags() {
  console.log('Starting tag migration...');

  try {
    // 1. Fetch all agents
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, tags');

    if (error) throw error;
    if (!agents) {
        console.log('No agents found.');
        return;
    }

    console.log(`Found ${agents.length} agents to check.`);

    let updateCount = 0;

    for (const agent of agents) {
      if (!agent.tags || agent.tags.length === 0) continue;

      let newTag = null;
      
      // Check for specific tags in priority order (Programming > Education > Creation > Lifestyle > Efficiency/General)
      if (agent.tags.includes('编程')) newTag = '代码助手';
      else if (agent.tags.includes('教育')) newTag = '学习教育';
      else if (agent.tags.includes('创作')) newTag = '文本创作';
      else if (agent.tags.includes('生活')) newTag = '生活方式';
      else if (agent.tags.includes('效率') || agent.tags.includes('通用')) newTag = '效率工具';

      // Also check if they already have one of the new tags (skip if so, unless we want to enforce single tag)
      // If the user wants "Current existing agents tags are still old tags, help me fix it", and "Single selection",
      // I should enforce single selection even if they somehow have new tags mixed with old (unlikely).
      
      // If newTag is found, update it.
      if (newTag) {
          // Update to single tag array
          const { error: updateError } = await supabase
            .from('agents')
            .update({ tags: [newTag] })
            .eq('id', agent.id);
            
          if (updateError) {
              console.error(`Failed to update agent ${agent.id}:`, updateError);
          } else {
              console.log(`Updated agent ${agent.id}: ${agent.tags} -> ['${newTag}']`);
              updateCount++;
          }
      }
    }

    console.log(`Migration completed. Updated ${updateCount} agents.`);

  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrateTags();
