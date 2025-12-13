# 知识库文档源文件目录

请将您下载的 PDF、Word (.docx)、Excel (.xlsx) 文件放入 `source` 目录中。

## 如何导入知识库

1. 确保 `.env` 文件中已配置 `DASHSCOPE_API_KEY` (阿里云百炼 API Key)。
2. 确保数据库中已创建 `documents` 表及相关函数 (请在 Supabase SQL Editor 中运行 `supabase/migrations` 下所有以 `add_rag` 或 `fix_embedding` 开头的脚本)。
3. 运行入库脚本：

```bash
npx tsx server/scripts/ingest-docs.ts
```

### 脚本逻辑与优化

脚本会自动执行以下流程：
1.  **多格式支持**：支持处理 `.pdf`, `.docx`, `.xlsx` 以及 `crawled` 目录下的 `.md` 文件。
2.  **增量更新检查**：自动读取 `source` 目录下的所有文件，并检查数据库中是否已存在该文件的记录（基于 `metadata->>source` 字段）。**如果文件已存在，将自动跳过，避免重复嵌入消耗 Token 和存储资源。**
3.  **文本切片 (Chunking)**：
    *   使用 `RecursiveCharacterTextSplitter` 进行智能切分。
    *   **Chunk Size**: 1000 字符 (保证上下文完整性)。
    *   **Chunk Overlap**: 200 字符 (保留上下文重叠，减少语义截断)。
4.  **元数据提取**：自动从文件名或内容中提取年份、部门等关键元数据，用于后续的精确过滤。
5.  **向量化 (Embedding)**：调用阿里云百炼 `text-embedding-v4` 模型生成 1024 维度的向量。
6.  **存储**：将文本内容、元数据及向量存入 Supabase 的 `documents` 表。

## 目录结构
- `source/`: 存放原始文档文件 (PDF, Word, Excel)
- `source/crawled/`: 存放爬虫自动抓取的 Markdown 文件

## 自动化数据获取工具

### 1. 自动爬取学校官网信息

我们提供了一个智能爬虫脚本，可以自动抓取学校官网（青岛理工大学及信控学院）的政策性、概念性文档（如培养方案、简介、章程等），并将其转换为 Markdown 格式存储在 `source/crawled/` 目录下。

```bash
npx tsx scripts/crawl-school-website.ts
```

**爬虫特性：**
*   **智能过滤**：自动过滤掉动态新闻、通知公告等时效性强的内容，专注于抓取相对稳定的政策和介绍类信息。
*   **格式转换**：自动将网页 HTML 内容转换为清晰的 Markdown 格式。
*   **深度控制**：默认爬取深度为 3 层，防止无限抓取。
*   **SSL 支持**：自动处理学校网站可能存在的 SSL 证书问题。

### 2. 自动下载附件

爬虫在抓取过程中会发现很多附件链接（如专业培养方案的 Word/PDF 文档）。我们提供了一个辅助脚本来批量下载这些附件。

```bash
npx tsx scripts/download-attachments.ts
```

**功能特性：**
*   **智能扫描**：自动扫描 `source/crawled/` 下所有 Markdown 文件中的附件链接。
*   **去重下载**：自动识别重复的链接，避免重复下载。
*   **验证码处理**：如果学校网站拦截下载并弹出验证码，脚本会**自动打开浏览器窗口**并暂停，等待您手动输入验证码后继续执行。下载的文件将自动保存在 `source/` 目录下，下次运行入库脚本时会自动处理。
