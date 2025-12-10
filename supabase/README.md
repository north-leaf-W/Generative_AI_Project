# Supabase 数据库文档

本文档描述了项目的 Supabase 数据库结构、表关系、权限策略（RLS）以及迁移历史。

## 1. 数据库概览

本项目使用 PostgreSQL (Supabase) 作为主要数据库，启用了行级安全策略（RLS）以确保数据安全。

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
- `tags`: TEXT[] - 标签数组 (目前前端强制单选，标准值: `'效率工具'`, `'文本创作'`, `'学习教育'`, `'代码助手'`, `'生活方式'`, `'游戏娱乐'`, `'角色扮演'`)
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
- `created_at`: TIMESTAMPTZ

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

## 2. 权限与安全 (RLS)

所有表均已启用 RLS (Row Level Security)。

### 访问策略摘要
*   **Users**:
    *   用户只能查看和更新自己的资料。
    *   管理员可以查看所有用户资料。
*   **Agents**:
    *   `public` 状态的智能体所有人可见。
    *   用户可以查看、创建、更新、删除自己创建的智能体。
    *   管理员可以查看、更新、删除所有智能体。
*   **Sessions / Messages**:
    *   用户只能访问（增删改查）属于自己的会话和消息。
*   **Agent Revisions**:
    *   用户只能查看和管理自己的修订版本。
    *   管理员可以查看和审核所有待处理的修订版本。
*   **Notifications**:
    *   用户只能查看和更新（标记已读）自己的通知。
*   **Favorites**:
    *   用户只能管理自己的收藏列表。

---

## 3. 迁移历史 (Migrations)

数据库变更记录在 `supabase/migrations` 目录下：

1.  `20251206_initial_schema.sql`: 初始化基础表结构 (`users`, `agents`, `sessions`, `messages`)。
2.  `20251206_enable_rls.sql`: 为基础表启用 RLS 并配置基本策略。
3.  `20251207_add_admin_role.sql`: 添加用户角色 (`admin`) 及相关 RLS 策略。
4.  `20251207_add_admin_user.sql`: 创建初始管理员账号及种子数据。
5.  `20251207_add_agent_creation.sql`: 完善智能体表 (`creator_id`, `status`) 及相关权限。
6.  `20251207_add_notifications_and_revisions.sql`: 添加通知系统和审核修订表。
7.  `20251207_add_session_mode.sql`: 为会话添加 `mode` 字段（调试/普通）。
8.  `20251210_add_tags_and_favorites.sql`: 添加标签系统和收藏功能。
9.  `20251210_update_agent_tags_v2.sql`: 标签数据清洗与迁移（标准化分类）。

## 4. 维护说明

*   **修改数据库**: 请务必通过新建 Migration SQL 文件进行，不要直接在生产环境执行 SQL，以保证环境一致性。
*   **管理员权限**: 管理员权限通过 `users.role = 'admin'` 字段控制，配合 RLS 策略生效。
