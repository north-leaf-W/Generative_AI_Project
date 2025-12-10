import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL?.trim()!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim()!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.trim()!;

console.log('Supabase Config Check:', {
  hasUrl: !!supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  hasServiceKey: !!supabaseServiceKey,
  urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 8) : 'N/A',
  serviceKeyPrefix: supabaseServiceKey ? supabaseServiceKey.substring(0, 5) : 'N/A',
  serviceKeyLength: supabaseServiceKey ? supabaseServiceKey.length : 0
});

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  throw new Error('Missing Supabase environment variables');
}

// 客户端使用的Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 服务端使用的Supabase客户端（具有更高权限）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);