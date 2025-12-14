import fs from 'fs';
import path from 'path';
// import pdf from 'pdf-parse'; // Avoid index.js side effects
import pdf from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export async function extractTextFromFile(filePath: string, originalFilename?: string): Promise<{ text: string; page_count?: number; info?: any }> {
  const ext = path.extname(originalFilename || filePath).toLowerCase();
  
  try {
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
      return { text: '[Error: .doc format not supported, please convert to .docx]' }; 
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
    } else if (ext === '.md' || ext === '.txt' || ext === '.csv' || ext === '.json') {
      const text = fs.readFileSync(filePath, 'utf-8');
      return {
        text: text,
        page_count: 1
      };
    }
    
    return { text: '' };
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error);
    throw error;
  }
}
