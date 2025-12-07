# 多智能体对话平台 (AI Agent Platform)

一个基于 React + Express + LangChain 的多智能体对话平台，支持阿里云百炼 DashScope 的兼容模式并提供服务端推送（SSE）流式输出。前端参考 Stripe 的简洁与渐变风格，聊天页参考 DeepSeek 的布局（左侧会话历史 + 右侧对话区）。

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ 特性

- **多智能体支持**：内置多种角色的 AI 智能体，支持自定义系统提示词。
- **流式对话**：基于 Server-Sent Events (SSE) 的实时流式响应，打字机效果体验。
- **会话管理**：完整的会话历史记录，支持创建新会话、切换历史会话。
- **用户认证**：基于 Supabase Auth 的注册、登录、密码重置及个人资料管理。
- **响应式设计**：现代化的 UI 设计，适配桌面端和移动端。
- **安全可靠**：后端鉴权 + 数据库行级安全 (RLS) 策略。

## 🛠 技术栈

- **前端**：`React 18`、`TypeScript`、`Vite`、`TailwindCSS`、`Zustand` (状态管理)、`React Router`
- **后端**：`Express 4`、`TypeScript`、`LangChain`
- **数据库**：`Supabase (PostgreSQL)`
- **AI 模型**：`阿里云 DashScope (通义千问)`
- **部署**：`Vercel (Frontend + Serverless Functions)`

## 📂 目录结构

```
src/             # 前端代码
  ├── components/# UI 组件
  ├── pages/     # 路由页面
  ├── stores/    # Zustand 状态管理
  ├── config/    # 前端配置
  └── lib/       # 工具函数
api/             # 后端代码 (Express App)
  ├── routes/    # API 路由
  ├── middleware/# 中间件 (Auth)
  ├── services/  # 业务逻辑 (LangChain)
  └── config/    # 后端配置
shared/          # 前后端共享类型定义
supabase/        # 数据库相关
  └── migrations/# SQL 初始化脚本
```

## 🚀 快速开始

### 1. 环境准备

- `Node.js >= 18`
- 一个 [Supabase](https://supabase.com/) 项目
- 一个阿里云 [DashScope](https://dashscope.console.aliyun.com/) API Key

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

```ini
# DashScope
DASHSCOPE_API_KEY=你的_dashscope_api_key
DASHSCOPE_MODEL=qwen-max

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

在 Supabase SQL Editor 中依次执行以下脚本：

1.  `supabase/migrations/20251206_initial_schema.sql` (建表)
2.  `supabase/migrations/20251206_enable_rls.sql` (启用安全策略)

### 4. 安装与启动

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
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_KEY` (注意：必须配置 Service Key 以支持用户注册和会话管理)
    - `JWT_SECRET`
4.  **Deploy**！

> 注意：`vercel.json` 已配置路由重写规则，将 `/api/*` 请求转发至后端 Serverless Function。

## 📝 常见问题

- **部署后 404**：检查 `vercel.json` 的 rewrites 配置是否生效。
- **注册/登录失败**：检查 Vercel 环境变量中的 `SUPABASE_SERVICE_KEY` 是否正确且无空格。
- **Invalid API Key**：确认 Supabase Key 是否对应（Anon vs Service）。

## 📄 License

MIT
