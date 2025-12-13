import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// import pdf from 'pdf-parse'; // Avoid index.js side effects
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { AlibabaTongyiEmbeddings } from '../utils/aliyun-embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !DASHSCOPE_API_KEY) {
  console.error('❌ Missing environment variables. Please check .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const embeddings = new AlibabaTongyiEmbeddings({
  apiKey: DASHSCOPE_API_KEY
});

const DOCS_DIR = path.resolve(__dirname, '../../documents/source');

async function processPdf(filePath: string) {
  console.log(`📄 Processing file: ${filePath}`);
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  // Basic metadata
  const metadata = {
    source: path.basename(filePath),
    page_count: data.numpages,
    info: data.info,
  };

  // Split text
  // 优化策略1：增大 Chunk Size 以保留更多上下文
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000, // 增大到 1000
    chunkOverlap: 200, // 增大重叠部分
  });

  // 优化策略4：元数据提取 (Metadata Extraction)
  // 尝试从文件名中提取年份和可能的部门信息
  // 例如: "信息与控制工程学院2024年推免工作实施细则.pdf"
  const fileName = path.basename(filePath);
  const yearMatch = fileName.match(/20\d{2}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : undefined;
  
  // 简单的关键词匹配部门 (可以根据实际情况扩展)
  let department = '学校';
  if (fileName.includes('信息与控制') || fileName.includes('信控')) {
    department = '信息与控制工程学院';
  } else if (fileName.includes('教务处')) {
    department = '教务处';
  }

  // 更新 metadata
  const enrichedMetadata = {
    ...metadata,
    year,
    department,
    // 添加一个用于混合检索的关键词字段，虽然 pgvector 也可以搜 content，但分开可能更清晰
    keywords: [year, department].filter(Boolean).join(' ') 
  };

  const docs = await splitter.createDocuments([data.text], [enrichedMetadata]);
  console.log(`✂️  Split into ${docs.length} chunks (Size: 1000, Overlap: 200).`);

  // Generate embeddings and save to Supabase
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const embedding = await embeddings.embedQuery(doc.pageContent);

    const { error } = await supabase.from('documents').insert({
      content: doc.pageContent,
      metadata: doc.metadata, // 使用增强后的 metadata
      embedding,
    });

    if (error) {
      console.error('❌ Error saving document chunk:', error);
    } else {
      process.stdout.write('.'); // Progress indicator
    }
  }
  console.log('\n✅ File processed successfully.');
}

async function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.log(`Creating directory: ${DOCS_DIR}`);
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  const files = fs.readdirSync(DOCS_DIR).filter(file => file.endsWith('.pdf'));

  if (files.length === 0) {
    console.log('⚠️  No PDF files found in documents/source. Please add some files to ingest.');
    return;
  }

  console.log(`🔍 Found ${files.length} PDF files.`);

  for (const file of files) {
    // Check if file already exists in database to avoid duplicates/re-embedding
    const { count, error } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .filter('metadata->>source', 'eq', file);
    
    if (error) {
      console.error(`❌ Error checking file status for ${file}:`, error);
      continue;
    }

    if (count && count > 0) {
      console.log(`⏩ Skipping ${file} (already processed). Use --force to re-process.`);
      continue;
    }

    await processPdf(path.join(DOCS_DIR, file));
  }

  console.log('🎉 All files processed!');
}

main().catch(console.error);
