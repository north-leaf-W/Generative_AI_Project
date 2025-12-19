# 多智能体对话平台 (AI Agent Platform)

一个基于 React + Express + LangChain 的多智能体对话平台，支持阿里云百炼 DashScope 的兼容模式并提供服务端推送（SSE）流式输出。前端参考 Stripe 的简洁与渐变风格，聊天页参考 DeepSeek 的布局（左侧会话历史 + 右侧对话区）。

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ 特性

- **现代化 UI 重构**：采用高级渐变背景、毛玻璃质感 (Glassmorphism) 和悬浮元素设计，打造沉浸式视觉体验。
- **趣味交互体验**：对话界面引入扁平化极简小 IP，实现眼球跟随鼠标移动的趣味动画交互。
- **完善的消息中心**：支持管理员审核提醒、用户审核结果通知及智能体下架提醒，具备一键已读和列表刷新功能。
- **RAG 增强**：内置 **理工助手Pro** 高级智能体，基于 RAG (检索增强生成) 技术，支持上传 PDF 知识库，能够准确回答特定领域的私有知识问题。
- **智能爬虫**：提供自动化脚本，支持智能抓取学校官网的政策性、概念性文档，并自动转换为 Markdown 格式入库，解决知识库数据获取难题。
- **双路召回与混合检索**：支持同时开启 **联网搜索** 和 **知识库检索**，AI 能够智能融合互联网实时信息与本地私有文档，提供全方位的回答。
- **智能体全生命周期管理**：
  - 用户：支持创建、编辑、申请发布、查看审核状态（含修改审核中及被拒草稿保留）及下架操作。
  - 资源优化：支持自定义头像上传（1MB 限制），采用“提交时上传”策略避免垃圾文件，并实现智能体删除时自动清理关联图片资源。
  - 管理员：具备独立的管理后台，支持查看 System Prompt、审核发布/修改申请、强制下架及分离的对话/详情入口。
- **热门智能体排行**：基于真实收藏数据实时统计，首页动态展示最受欢迎的智能体，支持按热度排序。
- **极致性能与动画**：全局集成 Framer Motion，深度优化侧边栏折叠、会话切换及加载状态的动画表现，消除布局抖动，确保丝滑流畅的操作体验。
- **多智能体支持**：内置多种角色的 AI 智能体，支持自定义系统提示词与头像。
- **流式对话**：基于 Server-Sent Events (SSE) 的实时流式响应，打字机效果体验。
- **多模态与附件支持**：支持上传图片和多种格式文件（PDF, TXT, DOC, DOCX, MD），实现图文混合对话和文件内容解析。
- **Markdown 渲染增强**：全面支持 Markdown 格式，包含代码高亮、表格、列表等，并优化了长文本的显示体验。
- **智能体广场重构**：实现了前端极速筛选与排序，消除加载闪烁；优化了高级智能体展示逻辑，确保置顶推荐的稳定性。
- **交互细节打磨**：
  - **消息中心**：新增审核通过的庆祝彩带特效 (Confetti)，增强用户成就感。
  - **收藏功能**：实现乐观 UI 更新 (Optimistic UI)，点击收藏即时响应，多端数据实时同步。
  - **登录保持**：优化了 Token 校验机制，解决了网络波动导致的意外登出问题。
- **智能会话管理**：支持基于 LLM 的会话标题自动生成（根据对话内容智能总结）及手动重命名，提供高效的会话切换与管理能力。
- **综合对话平台**：新增“综合对话平台”核心模块，支持多智能体协作路由。
  - **智能路由**：基于 LangGraph 框架，系统能根据用户输入自动匹配最合适的垂直领域智能体进行回答。
  - **联网搜索**：集成阿里云 DashScope 联网搜索能力，实时获取互联网最新信息。
  - **多模态交互**：支持在综合对话中直接上传图片（调用 VL 模型）和文档（自动解析），与单个智能体对话体验完全一致。
- **用户认证**：基于 Supabase Auth 的注册、登录、密码重置及个人资料管理（支持用户头像上传与自动清理）。
- **安全可靠**：后端鉴权 + 数据库行级安全 (RLS) 策略。

## 🛠 技术栈

- **前端**：`React 18`、`TypeScript`、`Vite`、`TailwindCSS`、`Zustand` (状态管理)、`React Router`
- **后端**：`Express 4`、`TypeScript`、`LangChain`、`LangGraph` (多智能体编排)
- **数据库**：`Supabase (PostgreSQL)` + `pgvector` (向量检索)
- **AI 模型**：
  - LLM: `阿里云 DashScope (通义千问)`
  - Embedding: `text-embedding-v4` (1024维)
  - Rerank: `gte-rerank` (阿里云 DashScope 兼容)
- **部署**：`Vercel (Frontend + Serverless Functions)`

## 💡 RAG 技术架构与优化

本项目实现了完整的高级 RAG (Retrieval-Augmented Generation) 流程，采用了多项优化策略以提升检索质量和回答准确性：

1.  **数据入库 (Ingestion Pipeline)**
    *   **智能切片**: 使用 `RecursiveCharacterTextSplitter` 将 PDF 文档切分为 1000 字符的片段 (Chunk)，并保留 200 字符的重叠 (Overlap) 以保持上下文连贯性。
    *   **增量更新**: 脚本自动检测已存在的文档来源，避免重复处理。
    *   **元数据提取**: 自动从文件名和内容中提取年份、部门等关键信息，用于精确过滤。

2.  **混合检索 (Hybrid Search)**
    *   结合 **向量检索 (Semantic Search)** 和 **关键词全文检索 (Keyword Search)**。
    *   向量检索擅长理解语义匹配（如“保研政策”匹配“推免规定”），关键词检索擅长精确匹配专有名词。
    *   通过加权合并两者结果，大幅提升召回率。

3.  **重排序 (Rerank)**
    *   在初步召回大量文档 (Top-K * 4) 后，使用专门的 Cross-Encoder 模型 (阿里云 Rerank) 对候选文档进行精细打分。
    *   重排序能够有效识别“语义相关但逻辑不符”的文档，将真正高质量的片段排在最前，喂给 LLM。

4.  **双路召回 (Dual Retrieval)**
    *   支持同时激活 **Tavily Web Search** 和 **Local Knowledge Base**。
    *   AI 能够根据用户问题，同时参考互联网最新资讯和内部私有文档，并在回答中标注信息来源。

## 📂 目录结构

```
src/             # 前端代码
  ├── components/# UI 组件
  ├── pages/     # 路由页面
  ├── stores/    # Zustand 状态管理
  ├── config/    # 前端配置
  └── lib/       # 工具函数
server/          # 后端核心逻辑 (Express App)
  ├── routes/    # API 路由
  ├── middleware/# 中间件 (Auth)
  ├── services/  # 业务逻辑 (LangChain)
  ├── scripts/   # 实用脚本 (如 RAG 数据入库)
  └── config/    # 后端配置
api/             # Vercel Serverless 入口
  └── index.ts   # 统一入口文件
shared/          # 前后端共享类型定义
supabase/        # 数据库相关
  └── migrations/# SQL 初始化脚本
documents/       # RAG 知识库源文件
```

## 🚀 快速开始

### 1. 环境准备

- `Node.js >= 18`
- 一个 [Supabase](https://supabase.com/) 项目
- 一个阿里云 [DashScope](https://dashscope.console.aliyun.com/) API Key
- 一个 [Tavily](https://tavily.com/) API Key (可选，用于联网搜索)

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

```ini
# DashScope
DASHSCOPE_API_KEY=你的_dashscope_api_key
DASHSCOPE_MODEL=qwen-max

# Tavily (Web Search)
TAVILY_API_KEY=你的_tavily_api_key

# Supabase
SUPABASE_URL=你的_supabase_url
SUPABASE_ANON_KEY=你的_supabase_anon_key
SUPABASE_SERVICE_KEY=你的_supabase_service_key # 用于后端管理操作

# Server
PORT=3001
NODE_ENV=development
JWT_SECRET=你的JWT密钥

# Frontend
VITE_API_URL=/api # 本地开发时如有代理配置可设为 /api
```

### 3. 初始化数据库

在 Supabase SQL Editor 中依次执行 `supabase/migrations` 目录下的所有 SQL 脚本。
**注意：** RAG 相关功能需要按顺序执行 `20251213` 开头的脚本。

### 4. 导入知识库 (RAG)

本项目提供了一套完整的数据获取与处理工具链，位于 `scripts/` 和 `server/scripts/` 目录下。

#### 第一步：获取数据 (爬虫与下载)

我们提供了两个独立的工具脚本来获取学校官网数据，位于根目录 `scripts/` 下：

1.  **爬取官网正文**:
    ```bash
    npx tsx scripts/crawl-school-website.ts
    ```
    *   功能：自动抓取青岛理工大学及信控学院官网的政策性、概念性文档。
    *   输出：Markdown 文件保存在 `documents/source/crawled/`。

2.  **下载附件文档**:
    ```bash
    npx tsx scripts/download-attachments.ts
    ```
    *   功能：扫描已爬取的 Markdown 文件，自动下载其中的附件（PDF, Word, Excel）。
    *   **注意**：如下载遇到验证码，脚本会弹出浏览器窗口，请手动输入验证码后脚本将自动继续。
    *   输出：文件保存在 `documents/source/`。

#### 第二步：数据入库 (向量化)

获取数据后，使用后端脚本将数据存入 Supabase 向量数据库，位于 `server/scripts/` 下：

```bash
npx tsx server/scripts/ingest-docs.ts
```
*   功能：读取 `documents/source/` (PDF/Word/Excel) 和 `documents/source/crawled/` (Markdown) 中的所有文件，进行切片、向量化并存入数据库。
*   特性：支持增量更新，会自动跳过已处理的文件。

### 5. 安装与启动

```bash
# 安装依赖
npm install

# 启动开发服务器 (同时启动前端和后端)
npm run dev
```

- 前端地址：`http://localhost:5173`
- 后端 API：`http://localhost:3001/api`

## ☁️ 部署指南 (Vercel)

本项目已配置为支持 Vercel 零配置部署（前端静态托管 + 后端 Serverless Functions）。

1.  **Fork 本仓库** 到你的 GitHub。
2.  在 **Vercel** 中导入该项目。
3.  在 **Environment Variables** 中配置以下环境变量：
    - `DASHSCOPE_API_KEY`
    - `DASHSCOPE_MODEL`
    - `TAVILY_API_KEY`
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_KEY`
    - `JWT_SECRET`
4.  **Deploy**！

> 注意：`vercel.json` 已配置路由重写规则，将 `/api/*` 请求转发至后端 Serverless Function。

## 📝 常见问题

- **部署后 404**：检查 `vercel.json` 的 rewrites 配置是否生效。
- **注册/登录失败**：检查 Vercel 环境变量中的 `SUPABASE_SERVICE_KEY` 是否正确且无空格。
- **RAG 检索报错**: 确认数据库已启用 `pgvector` 扩展，且向量维度与模型一致 (text-embedding-v4 为 1024)。

## 📄 License

MIT