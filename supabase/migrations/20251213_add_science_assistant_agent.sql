-- 插入理工助手智能体
INSERT INTO agents (
  name, 
  description, 
  avatar_url, 
  system_prompt, 
  config, 
  status, 
  tags, 
  category
) VALUES (
  '理工助手',
  '专为理工学子打造的智能助手。基于RAG技术，内置信控学院政策文件、教务处通知等私有知识库，能够准确回答关于保研、体测、综测等具体问题。',
  'https://api.dicebear.com/7.x/bottts/svg?seed=polytechnic',
  '你是一个专为理工学子打造的智能助手。基于RAG技术，内置信控学院政策文件、教务处通知等私有知识库，能够准确回答关于保研、体测、综测等具体问题。请基于上下文信息回答用户的问题。',
  '{"rag_enabled": true}',
  'public',
  ARRAY['高级智能体', '校园助手', 'RAG'],
  'education'
);
