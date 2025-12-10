
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const API_URL = 'http://127.0.0.1:3001/api';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function test() {
  // 1. 获取一个真实存在的用户
  const { data: users } = await supabase.from('users').select('id, email').limit(1);
  
  if (!users || users.length === 0) {
      console.error('No users found in DB.');
      return;
  }
  
  const user = users[0];
  console.log(`Using user: ${user.email} (${user.id})`);

  // 2. 直接签发 Token
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
  
  console.log('Generated token.');
  
  // 3. 获取一个智能体 ID
  const { data: agents } = await supabase.from('agents').select('id').eq('is_active', true).limit(1);
  if (!agents || agents.length === 0) {
      console.error('No active agents found.');
      return;
  }
  const agentId = agents[0].id;
  console.log(`Using agent ID: ${agentId}`);
  
  // 4. 测试收藏
  console.log(`Attempting to favorite agent ${agentId}...`);
  console.log(`Target URL: ${API_URL}/agents/${agentId}/favorite`);
  const favRes = await fetch(`${API_URL}/agents/${agentId}/favorite`, {
      method: 'POST',
      headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
      }
  });
  
  const favData = await favRes.json();
  console.log('Favorite response:', favRes.status, JSON.stringify(favData, null, 2));
  
  if (!favRes.ok) {
      console.error('❌ Favorite FAILED');
  } else {
      console.log('✅ Favorite SUCCESS');
  }

  // 5. 测试获取收藏列表
  console.log('Fetching favorites list...');
  const listRes = await fetch(`${API_URL}/agents/favorites`, {
      method: 'GET',
      headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
      }
  });
  
  const listData = await listRes.json();
  console.log('Favorites list response:', listRes.status, listData);
  
  // 6. 清理（取消收藏）
  if (favRes.ok) {
      console.log('Cleaning up (unfavoriting)...');
      await fetch(`${API_URL}/agents/${agentId}/favorite`, {
        method: 'DELETE',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
      });
  }
}

test().catch(console.error);
