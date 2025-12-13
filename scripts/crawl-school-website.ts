
import { chromium, Browser, Page } from 'playwright';
import TurndownService from 'turndown';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  outputDir: path.join(__dirname, '../documents/source/crawled'),
  maxDepth: 3, // Depth of crawling: 0 = seed, 1 = nav links, 2 = lists, 3 = articles
  maxPages: 50, // Safety limit
  headless: true,
  keywords: [
    '简介', '概况', '师资', '队伍', '培养', '方案', '课程', 
    '规定', '办法', '细则', '章程', '政策', '评优', '保研', 
    '加分', '体测', '选拔', '组织', '机构', '领导', '委员会', 
    '系', '中心', '实验室', '沿革', '党委', '工会'
  ],
  excludeKeywords: [
    '新闻', '动态', '通知', '公告', '公示', '会议', '招聘', '招标', '中标',
    '大众网', '大众日报', '科技日报', '日报', '晚报', '快报', // Media
    '主题党日', '座谈会', '活动', '纪念', '收看', '讲授', '研讨', // Events
    '比赛', '竞赛', '获奖', '颁奖', '启动', '举行', '召开', '开展', // Events actions
    '宣传部', '团委', '学生会' // Often news sources
  ],
  seeds: [
    'https://ice.qut.edu.cn/', // Information and Control Engineering
    'https://www.qut.edu.cn/index.htm' // Main University Site
  ]
};

// Initialize Turndown
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// State
const visitedUrls = new Set<string>();
let pageCount = 0;

async function crawl() {
  console.log('🚀 Starting Smart School Crawler...');
  
  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  } else {
    // 增量爬取：读取已存在文件的 Source URL，避免重复访问
    console.log('📂 Checking existing files for incremental crawling...');
    const files = fs.readdirSync(CONFIG.outputDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const content = fs.readFileSync(path.join(CONFIG.outputDir, file), 'utf-8');
          const sourceMatch = content.match(/Source:\s*(https?:\/\/[^\s]+)/);
          if (sourceMatch) {
            visitedUrls.add(sourceMatch[1].trim());
          }
        } catch (e) {
          console.warn(`⚠️ Error reading ${file}:`, e);
        }
      }
    }
    console.log(`✅ Loaded ${visitedUrls.size} already crawled URLs.`);
  }

  const browser = await chromium.launch({ headless: CONFIG.headless });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // Queue: { url, depth, source }
  const queue: { url: string; depth: number; source: string }[] = CONFIG.seeds.map(url => ({ 
    url, 
    depth: 0, 
    source: 'seed' 
  }));

  try {
    while (queue.length > 0 && pageCount < CONFIG.maxPages) {
      const current = queue.shift();
      if (!current) break;
      
      const { url, depth } = current;

      if (visitedUrls.has(url)) continue;
      visitedUrls.add(url);

      console.log(`[${pageCount + 1}/${CONFIG.maxPages}] Visiting (Depth ${depth}): ${url}`);

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // 1. Analyze page type and extract content if it matches
        const isContent = await analyzeAndExtract(page, url);
        
        if (isContent) {
          pageCount++;
        }

        // 2. Discover new links if depth allows
        if (depth < CONFIG.maxDepth) {
          const links = await extractLinks(page, url);
          console.log(`   Found ${links.length} potential links`);
          for (const link of links) {
            if (!visitedUrls.has(link)) {
              queue.push({ url: link, depth: depth + 1, source: url });
            }
          }
        }

        // Polite delay
        await page.waitForTimeout(1000);

      } catch (e) {
        console.error(`❌ Error visiting ${url}:`, e);
      }
    }
  } finally {
    await browser.close();
    console.log('🏁 Crawling finished.');
  }
}

async function extractLinks(page: Page, currentUrl: string): Promise<string[]> {
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map(a => ({
        href: a.href,
        text: a.innerText.trim()
      }))
      .filter(link => link.href && link.href.startsWith('http'));
  });

  const validLinks: string[] = [];
  
  for (const link of links) {
    try {
      const urlObj = new URL(link.href);
      
      // Stay within the same domain (or related school domains)
      if (!urlObj.hostname.includes('qut.edu.cn')) continue;
      
      // Filter by file types to avoid downloading binaries directly here
      if (link.href.match(/\.(pdf|doc|docx|xls|xlsx|zip|rar|jpg|png)$/i)) continue;

      // Logic: 
      // 1. If text matches keywords, it's high priority.
      // 2. If it's a nav link, follow it.
      
      const hasKeyword = CONFIG.keywords.some(k => link.text.includes(k));
      const hasExclude = CONFIG.excludeKeywords.some(k => link.text.includes(k));

      if (hasExclude) continue;

      // Relaxed logic:
      // If it has a keyword, definitely add.
      // If no keyword, but looks like a navigation link (short text, sub-path), add it if depth is low.
      if (hasKeyword) {
         validLinks.push(link.href);
      } else if (link.href.includes(new URL(currentUrl).origin)) {
          // Internal link, add if it's not "home" or "index" which we likely already have
          validLinks.push(link.href);
      }
    } catch (e) {
      // invalid url
    }
  }
  
  return [...new Set(validLinks)];
}

async function analyzeAndExtract(page: Page, url: string): Promise<boolean> {
  // Check if this page looks like an article/content page
  // QUT sites often use specific containers for content
  
  const content = await page.evaluate(() => {
    // Common selectors for Chinese university CMS (VSB, etc.)
    const selectors = [
      '[id^="vsb_content"]', // Matches vsb_content_4, vsb_content_1001, etc.
      '.nyrt',
      '.v_news_content', 
      '#vsb_content', 
      '.article-content', 
      '.entry-content',
      '.con_text',
      '.content_box',
      '#content',
      'form[name="_newscontent_fromname"]' // specific for some older CMS
    ];
    
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerHTML.length > 200) { // Threshold for meaningful content
        return {
          html: el.innerHTML,
          title: document.title || document.querySelector('h1')?.innerText || ''
        };
      }
    }
    return null;
  });

  if (content) {
    // Check title against keywords to ensure relevance
    const title = content.title;
    const hasKeyword = CONFIG.keywords.some(k => title.includes(k));
    const hasExclude = CONFIG.excludeKeywords.some(k => title.includes(k));
    
    console.log(`   Checking content: "${title}"`);

    if (hasKeyword && !hasExclude) {
      console.log(`   ✅ Found relevant content: ${title}`);
      
      // Convert to Markdown
      const markdown = turndownService.turndown(content.html);
      const filename = sanitizeFilename(title) + '.md';
      const filepath = path.join(CONFIG.outputDir, filename);
      
      const fileContent = `# ${title}\n\nSource: ${url}\n\n${markdown}`;
      
      fs.writeFileSync(filepath, fileContent);
      return true;
    } else {
        console.log(`   Skipping content (no keyword match): "${title}"`);
    }
  } else {
      console.log(`   No content container found on ${url}`);
  }
  
  return false;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 100);
}

// Run
crawl().catch(console.error);
