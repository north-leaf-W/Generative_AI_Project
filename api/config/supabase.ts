import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// 客户端使用的Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 服务端使用的Supabase客户端（具有更高权限）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);