import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// import pdf from 'pdf-parse'; // Avoid index.js side effects
import pdf from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
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

async function extractText(filePath: string): Promise<{ text: string; page_count?: number; info?: any }> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return {
      text: data.text,
      page_count: data.numpages,
      info: data.info
    };
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      text: result.value,
      page_count: 1 // DOCX doesn't easily give page count without rendering
    };
  } else if (ext === '.doc') {
    console.warn(`⚠️  Skipping .doc file (binary format not supported, please convert to .docx): ${path.basename(filePath)}`);
    return { text: '' }; // TODO: Support legacy .doc if needed (requires external tools usually)
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
    let text = '';
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      text += `Sheet: ${sheetName}\n`;
      text += XLSX.utils.sheet_to_txt(sheet);
      text += '\n\n';
    });
    return {
      text: text,
      page_count: workbook.SheetNames.length
    };
  } else if (ext === '.md') {
    const text = fs.readFileSync(filePath, 'utf-8');
    return {
      text: text,
      page_count: 1
    };
  }
  
  return { text: '' };
}

async function processFile(filePath: string) {
  console.log(`📄 Processing file: ${filePath}`);
  
  const { text, page_count, info } = await extractText(filePath);

  if (!text || text.trim().length === 0) {
    console.warn(`⚠️  No text extracted from ${path.basename(filePath)}, skipping.`);
    return;
  }
  
  // Basic metadata
  const metadata = {
    source: path.basename(filePath),
    page_count: page_count || 1,
    info: info || {},
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

  const docs = await splitter.createDocuments([text], [enrichedMetadata]);
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
  // Ensure docs dir exists
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`❌ Documents directory not found: ${DOCS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(DOCS_DIR).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.pdf', '.docx', '.xlsx', '.xls', '.md'].includes(ext);
  });

  // Also scan crawled directory
  const CRAWLED_DIR = path.join(DOCS_DIR, 'crawled');
  if (fs.existsSync(CRAWLED_DIR)) {
      const crawledFiles = fs.readdirSync(CRAWLED_DIR).filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.md'].includes(ext);
      });
      console.log(`📂 Found ${crawledFiles.length} crawled documents in ${CRAWLED_DIR}`);
      
      // Process crawled files
      for (const file of crawledFiles) {
          const filePath = path.join(CRAWLED_DIR, file);
           // Check if already processed (simple check based on source filename)
           const { data: existingDocs } = await supabase
             .from('documents')
             .select('id')
             .contains('metadata', { source: file })
             .limit(1);
      
           if (existingDocs && existingDocs.length > 0) {
             console.log(`⏭️  Skipping already processed file: ${file}`);
             continue;
           }
      
           await processFile(filePath);
      }
  }

  console.log(`📂 Found ${files.length} documents in ${DOCS_DIR}`);

  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file);
    
    // Check if already processed (simple check based on source filename)
    // In a real app, you might want a hash check
    const { data: existingDocs, error } = await supabase
      .from('documents')
      .select('id')
      .contains('metadata', { source: file })
      .limit(1);

    if (existingDocs && existingDocs.length > 0) {
      console.log(`⏭️  Skipping already processed file: ${file}`);
      continue;
    }

    await processFile(filePath);
  }
  
  console.log('🎉 All documents processed!');
}

main().catch(console.error);
