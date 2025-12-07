# 多智能体对话平台

一个基于 React + Express + LangChain 的多智能体对话平台，支持阿里云百炼 DashScope 的兼容模式并提供服务端推送（SSE）流式输出。前端参考 Stripe 的简洁与渐变风格，聊天页参考 DeepSeek 的布局（左侧会话历史 + 右侧对话区）。

## 技术栈

- 前端：`React 18`、`TypeScript`、`Vite`、`TailwindCSS`
- 路由/状态：`react-router-dom`、`zustand`
- 后端：`Express 4`、`TypeScript`、`LangChain`
- 数据：`Supabase (PostgreSQL)`
- AI服务：`阿里云 DashScope（OpenAI 兼容模式）`
- 流式输出：`Server-Sent Events (SSE)`

## 目录结构

- `src/` 前端代码（页面、组件、状态）
- `api/` 后端代码（路由、服务、中间件）
- `shared/` 前后端共享类型定义
- `supabase/migrations/` 数据库初始化 SQL
- `.env` 环境变量配置文件

## 环境准备

- `Node.js >= 18`
- 一个可用的 `Supabase` 项目（获取 `SUPABASE_URL`、`ANON_KEY`、`SERVICE_KEY`）
- 一个可用的 `DashScope` API Key（在阿里云百炼控制台申请）

## 配置环境变量

在项目根目录创建并填写 `.env`（已提供模板）：

```
# DashScope
DASHSCOPE_API_KEY=你的_dashscope_api_key
DASHSCOPE_MODEL=qwen-turbo

# Supabase
SUPABASE_URL=你的_supabase_url
SUPABASE_ANON_KEY=你的_supabase_anon_key
SUPABASE_SERVICE_KEY=你的_supabase_service_key

# Server
PORT=3001
NODE_ENV=development
JWT_SECRET=任意安全随机字符串

# Frontend（可选，默认 http://localhost:3001/api）
VITE_API_URL=http://localhost:3001/api
```

注意：后端在启动时会检查上述变量，缺失将导致启动失败。

## 安装依赖

```
npm install
```

## 初始化数据库

- **基础表结构**：在 Supabase SQL 编辑器中执行 `supabase/migrations/20241201_initial_schema.sql`
- **启用行级安全（RLS）**：在 Supabase SQL 编辑器中执行 `supabase/migrations/20241206_enable_rls.sql`

初始化完成后，`agents` 表将包含示例智能体，便于直接测试。同时，RLS 策略将确保用户数据的安全性。

## 启动开发环境

- 同时启动前后端（开发模式）：

```
npm run dev
```

- 单独启动前端：

```
npm run client:dev
```

- 单独启动后端（需 `.env` 已配置）：

```
npm run server:dev
```

启动成功后：

- 前端：`http://localhost:5173`
- 后端健康检查：`http://localhost:3001/health`
- 后端 API 基址：`http://localhost:3001/api`

## 快速验证（示例）

1. 获取智能体列表：`GET /api/agents`
2. 创建会话：`POST /api/sessions`（需登录并携带 `Authorization: Bearer <token>`）
3. 发送流式消息：`POST /api/chat/stream`（SSE 输出，前端已封装 `streamRequest`）

前端页面：

- 首页：展示智能体卡片（头像、名称、简介）
- 聊天页：左侧会话历史，右侧消息区，底部输入框，AI流式输出

## 构建与预览

```
npm run build
npm run preview
```

## 常见问题

- 启动报错缺少环境变量：请检查 `.env` 是否填写完整
- DashScope 连接失败：确认 `DASHSCOPE_API_KEY` 与兼容模式 `baseURL` 正确
- 跨域问题（CORS）：开发模式下后端已允许 `http://localhost:5173`
- Supabase 表不存在：务必先执行数据库迁移 SQL
