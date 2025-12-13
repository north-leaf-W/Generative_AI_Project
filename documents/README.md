# 知识库文档源文件目录

请将您下载的 PDF 文件放入 `source` 目录中。

## 如何导入知识库

1. 确保 `.env` 文件中已配置 `DASHSCOPE_API_KEY` (阿里云百炼 API Key)。
2. 确保数据库中已创建 `documents` 表及相关函数 (请在 Supabase SQL Editor 中运行 `supabase/migrations` 下所有以 `add_rag` 或 `fix_embedding` 开头的脚本)。
3. 运行入库脚本：

```bash
npx tsx server/scripts/ingest-docs.ts
```

### 脚本逻辑与优化

脚本会自动执行以下流程：
1.  **增量更新检查**：自动读取 `source` 目录下的所有 PDF 文件，并检查数据库中是否已存在该文件的记录（基于 `metadata->>source` 字段）。**如果文件已存在，将自动跳过，避免重复嵌入消耗 Token 和存储资源。**
2.  **文本切片 (Chunking)**：
    *   使用 `RecursiveCharacterTextSplitter` 进行智能切分。
    *   **Chunk Size**: 1000 字符 (保证上下文完整性)。
    *   **Chunk Overlap**: 200 字符 (保留上下文重叠，减少语义截断)。
3.  **元数据提取**：自动从文件名或内容中提取年份、部门等关键元数据，用于后续的精确过滤。
4.  **向量化 (Embedding)**：调用阿里云百炼 `text-embedding-v4` 模型生成 1024 维度的向量。
5.  **存储**：将文本内容、元数据及向量存入 Supabase 的 `documents` 表。

## 目录结构
- `source/`: 存放原始 PDF 文件
