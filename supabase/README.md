# Supabase 数据库文档

本文档描述了项目的 Supabase 数据库结构、表关系、权限策略（RLS）以及迁移历史。

## 1. 数据库概览

本项目使用 PostgreSQL (Supabase) 作为主要数据库，启用了行级安全策略（RLS）以确保数据安全。此外，还启用了 `pgvector` 扩展以支持向量检索 (RAG)。

### 核心表结构

#### `users` (用户表)
存储用户的基本信息和角色。
- `id`: UUID (PK) - 用户唯一标识
- `email`: VARCHAR(255) - 邮箱 (Unique)
- `password_hash`: VARCHAR(255) - 密码哈希
- `name`: VARCHAR(100) - 昵称
- `avatar_url`: TEXT - 头像链接
- `role`: VARCHAR(20) - 角色，取值: `'user'` (普通用户), `'admin'` (管理员)
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

#### `agents` (智能体表)
存储智能体的核心配置和元数据。
- `id`: UUID (PK)
- `name`: VARCHAR(100) - 名称
- `description`: TEXT - 描述
- `avatar_url`: TEXT - 头像链接
- `system_prompt`: TEXT - 系统提示词
- `config`: JSONB - 其他配置 (默认 `{}`)
- `is_active`: BOOLEAN - 是否激活 (逻辑删除)
- `creator_id`: UUID (FK -> users.id) - 创建者 ID
- `status`: VARCHAR(20) - 发布状态，取值: `'private'` (私有), `'pending'` (审核中), `'public'` (已发布)
- `category`: VARCHAR(50) - 分类 (Deprecated, use tags)
- `tags`: TEXT[] - 标签数组 (目前前端强制单选，标准值: `'效率工具'`, `'文本创作'`, `'学习教育'`, `'代码助手'`, `'生活方式'`, `'游戏娱乐'`, `'角色扮演'`, `'高级智能体'`, `'RAG'`)
- `created_at`: TIMESTAMPTZ

#### `sessions` (会话表)
存储用户与智能体的对话会话。
- `id`: UUID (PK)
- `user_id`: UUID (FK -> users.id) - 用户 ID
- `agent_id`: UUID (FK -> agents.id) - 智能体 ID
- `title`: VARCHAR(255) - 会话标题
- `mode`: TEXT - 会话模式，取值: `'public'` (普通对话), `'dev'` (调试模式)
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

#### `messages` (消息表)
存储会话中的具体消息记录。
- `id`: UUID (PK)
- `session_id`: UUID (FK -> sessions.id)
- `user_id`: UUID (FK -> users.id)
- `role`: VARCHAR(20) - 消息角色，取值: `'user'`, `'assistant'`, `'system'`
- `content`: TEXT - 消息内容
- `images`: TEXT[] - 图片 URL 数组 (支持多模态输入)
- `files`: JSONB - 附件文件列表 (包含 name, type, url, size 等元数据)
- `created_at`: TIMESTAMPTZ

#### `documents` (知识库文档表 - RAG)
存储用于 RAG 检索的文档片段及向量。
- `id`: UUID (PK)
- `content`: TEXT - 文档片段内容
- `metadata`: JSONB - 元数据 (包含 source, page, year, department 等)
- `embedding`: VECTOR(1024) - 文本向量 (使用 text-embedding-v4 模型)

#### `agent_revisions` (智能体修订表)
存储已发布智能体的修改审核记录。
- `id`: UUID (PK)
- `agent_id`: UUID (FK -> agents.id)
- `creator_id`: UUID (FK -> users.id)
- `changes`: JSONB - 修改内容的快照 (包含 name, description, system_prompt 等)
- `status`: VARCHAR(20) - 审核状态，取值: `'pending'`, `'rejected'`, `'draft'`
- `admin_feedback`: TEXT - 管理员反馈
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

#### `notifications` (通知表)
存储系统通知。
- `id`: UUID (PK)
- `user_id`: UUID (FK -> users.id)
- `type`: VARCHAR(50) - 类型 (e.g., `'system'`, `'audit_approved'`)
- `title`: VARCHAR(255)
- `content`: TEXT
- `is_read`: BOOLEAN
- `created_at`: TIMESTAMPTZ

#### `favorites` (收藏表)
存储用户收藏的智能体。
- `user_id`: UUID (FK -> users.id, PK)
- `agent_id`: UUID (FK -> agents.id, PK)
- `created_at`: TIMESTAMPTZ

---

## 2. 数据库函数 (RPC)

#### `match_documents`
基本的向量相似度检索函数。
- **参数**: `query_embedding` (vector), `match_threshold` (float), `match_count` (int)
- **功能**: 根据余弦距离返回最相似的文档片段。

#### `hybrid_match_documents`
**混合检索 (Hybrid Search)** 函数，结合向量检索与关键词全文检索。
- **参数**: `query_embedding`, `match_threshold`, `match_count`, `query_text`, `full_text_weight`, `semantic_weight`
- **功能**: 同时执行 Vector Search 和 PostgreSQL Full Text Search，合并结果并返回，有效提升专有名词和精确匹配的召回率。

---

## 3. 权限与安全 (RLS)

所有表均已启用 RLS (Row Level Security)。

### 数据表访问策略
*   **Users**: 用户只能查看和更新自己的资料；管理员可查看所有。
*   **Agents**: `public` 状态所有人可见；用户管理自己的；管理员管理所有。
*   **Sessions / Messages**: 用户只能访问属于自己的会话和消息。
*   **Documents**: 
    *   `select`: 允许所有认证用户查询 (用于 RAG 检索)。
    *   `insert/update/delete`: 仅允许 service_role (后端脚本) 操作。
*   **Agent Revisions**: 用户管理自己的修订；管理员审核所有。
*   **Notifications**: 用户管理自己的通知。
*   **Favorites**: 用户管理自己的收藏。

### 存储桶访问策略 (Storage)
Bucket: `agent-avatars` / `user-avatars`
*   **Public Access**: 允许公开读取。
*   **Upload**: 允许认证用户上传 (1MB 限制)。
*   **Update/Delete**: 仅允许用户操作自己上传的文件。

---

## 4. 迁移历史 (Migrations)

数据库变更记录在 `supabase/migrations` 目录下：

1.  `20251206_initial_schema.sql`: 初始化基础表结构。
2.  `20251206_enable_rls.sql`: 启用 RLS。
3.  `20251207_add_admin_role.sql`: 添加管理员角色。
4.  `20251207_add_admin_user.sql`: 初始管理员种子数据。
5.  `20251207_add_agent_creation.sql`: 智能体创建相关字段。
6.  `20251207_add_notifications_and_revisions.sql`: 通知与审核系统。
7.  `20251207_add_session_mode.sql`: 会话模式。
8.  `20251210_add_tags_and_favorites.sql`: 标签与收藏。
9.  `20251210_update_agent_tags_v2.sql`: 标签数据清洗。
10. `20251210_fix_storage_rls_v5.sql`: 存储桶 RLS 修复。
11. `20251211_add_user_avatars_storage.sql`: 用户头像存储。
12. `20251213_add_rag_knowledge_base.sql`: **RAG 基础建设** (启用 pgvector, 创建 documents 表, 添加 match_documents 函数)。
13. `20251213_add_science_assistant_agent.sql`: **添加理工助手智能体** (种子数据)。
14. `20251213_fix_embedding_dimensions.sql`: **修复向量维度** (1536 -> 1024, 适配 text-embedding-v4)。
15. `20251213_add_hybrid_search.sql`: **添加混合检索** (hybrid_match_documents 函数)。
16. `20251214_add_favorites_count_view.sql`: **添加收藏数统计视图** (创建 public_agents_with_counts 视图，优化热门智能体查询性能)。
17. `20251214_fix_hybrid_search_rpc.sql`: **修复混合检索 RPC** (修正参数类型匹配问题)。

---

## 5. 维护说明

*   **修改数据库**: 请务必通过新建 Migration SQL 文件进行。
*   **管理员权限**: 通过 `users.role = 'admin'` 字段控制。
*   **RAG 向量检索**: 依赖 `pgvector` 扩展，请确保数据库支持该扩展。