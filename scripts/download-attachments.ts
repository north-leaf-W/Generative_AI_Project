
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCUMENTS_DIR = path.join(__dirname, '../documents/source/crawled');
const OUTPUT_DIR = path.join(__dirname, '../documents/source'); // Directly to source for RAG
const ATTACHMENT_PATTERNS = [
  /\.(doc|docx|pdf|xls|xlsx|zip|rar)$/i,
  /download\.jsp/i
];

interface Attachment {
  url: string;
  sourceFile: string;
  baseUrl: string;
  originalText: string;
}

async function scanForAttachments(): Promise<Attachment[]> {
  // Use forward slashes for glob pattern to ensure cross-platform compatibility
  const pattern = path.join(DOCUMENTS_DIR, '*.md').replace(/\\/g, '/');
  console.log(`🔍 Glob pattern: ${pattern}`);
  
  const files = await glob(pattern);
  const attachments: Attachment[] = [];

  console.log(`🔍 Scanning ${files.length} markdown files...`);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Extract Base URL from "Source: ..." line
    const sourceMatch = content.match(/Source:\s*(https?:\/\/[^\s]+)/);
    const baseUrl = sourceMatch ? sourceMatch[1] : '';

    if (!baseUrl) {
      console.warn(`⚠️  No Source URL found in ${path.basename(file)}, skipping relative links.`);
      continue;
    }

    // Match markdown links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const [_, text, url] = match;
      
      // Check if it looks like an attachment
      if (ATTACHMENT_PATTERNS.some(p => p.test(url))) {
        attachments.push({
          url: url.trim(),
          sourceFile: path.basename(file),
          baseUrl,
          originalText: text.trim()
        });
      }
    }
  }

  // Deduplicate by URL
  const uniqueAttachments = Array.from(new Map(attachments.map(item => [item.url, item])).values());
  return uniqueAttachments;
}

async function main() {
  const attachments = await scanForAttachments();
  console.log(`📋 Found ${attachments.length} unique attachments.`);

  if (attachments.length === 0) {
    console.log('No attachments found.');
    return;
  }

  console.log('🚀 Launching browser for downloading...');
  // Headful mode allows user to input captcha if needed
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 // Slow down slightly to observe
  });
  
  const context = await browser.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  // Helper to resolve absolute URL
  const resolveUrl = (base: string, relative: string) => {
    try {
      return new URL(relative, base).href;
    } catch (e) {
      return null;
    }
  };

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < attachments.length; i++) {
    const item = attachments[i];
    const absoluteUrl = resolveUrl(item.baseUrl, item.url);

    if (!absoluteUrl) {
      console.error(`❌ Invalid URL: ${item.url} (Base: ${item.baseUrl})`);
      failCount++;
      continue;
    }

    console.log(`\n[${i + 1}/${attachments.length}] Processing: ${item.originalText}`);
    console.log(`   Source: ${item.sourceFile}`);
    console.log(`   Target: ${absoluteUrl}`);

    try {
      // Strategy:
      // 1. Visit the base URL first to establish session/cookies if needed
      // 2. Then trigger the download
      
      // Check if we need to visit base URL (optimization: only if domain changes or first run)
      // For simplicity, we just visit the download link. 
      // If it fails or redirects to a captcha page, we might need manual intervention.

      // If it's a direct file link (ends in .pdf etc), try goto.
      // If it's download.jsp, try goto.
      
      // Intercept download event
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);

      try {
        await page.goto(absoluteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (e) {
        // Navigation might fail if it's a direct download that closes connection, 
        // or if it's a 204 No Content. We rely on downloadPromise.
        // console.log('   Navigation result:', e.message);
      }

      const download = await downloadPromise;

      if (download) {
        const suggestedFilename = download.suggestedFilename();
        const safeFilename = suggestedFilename.replace(/[\\/:*?"<>|]/g, '_');
        const savePath = path.join(OUTPUT_DIR, safeFilename);

        // Check if exists
        if (fs.existsSync(savePath)) {
            console.log(`   ⏭️  File already exists: ${safeFilename}`);
            await download.cancel();
            successCount++;
        } else {
            await download.saveAs(savePath);
            console.log(`   ✅ Downloaded: ${safeFilename}`);
            successCount++;
        }
      } else {
        // No download triggered automatically.
        // Check if we are on a captcha page or need manual interaction.
        console.warn('   ⚠️  No download triggered automatically.');
        
        // Simple heuristic: check page title or text
        const pageTitle = await page.title();
        console.log(`   Current Page Title: ${pageTitle}`);

        if (pageTitle.includes('验证') || pageTitle.includes('Security') || await page.getByText('验证码').count() > 0) {
           console.log('\n🔴 -----------------------------------------------------------');
           console.log('🔴 CAPTCHA DETECTED or MANUAL INTERACTION REQUIRED');
           console.log('🔴 Please switch to the browser window, enter the code, and start the download.');
           console.log('🔴 The script will wait for a download to start...');
           console.log('🔴 -----------------------------------------------------------\n');
           
           // Wait indefinitely (or long timeout) for user to trigger download
           try {
             const manualDownload = await page.waitForEvent('download', { timeout: 120000 }); // 2 mins to solve captcha
             const suggestedFilename = manualDownload.suggestedFilename();
             const safeFilename = suggestedFilename.replace(/[\\/:*?"<>|]/g, '_');
             const savePath = path.join(OUTPUT_DIR, safeFilename);
             await manualDownload.saveAs(savePath);
             console.log(`   ✅ Manually Downloaded: ${safeFilename}`);
             successCount++;
           } catch (e) {
             console.error('   ❌ Manual interaction timed out.');
             failCount++;
           }
        } else {
            console.error('   ❌ Failed to download (not a captcha page).');
            failCount++;
        }
      }

    } catch (e) {
      console.error('   ❌ Error:', e);
      failCount++;
    }

    // Polite delay
    await page.waitForTimeout(1000);
  }

  console.log(`\n🏁 Finished. Success: ${successCount}, Failed: ${failCount}`);
  await browser.close();
}

main().catch(console.error);
