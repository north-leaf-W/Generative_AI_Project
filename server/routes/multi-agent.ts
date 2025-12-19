import express from 'express';
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { routingGraph, getAgentSystemPrompt } from '../services/multiAgentGraph.js';
import { createDashScopeModel, createStreamHandler, generateSessionTitle } from '../services/langchain.js';
import { authenticateToken } from '../middleware/auth.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// --- 会话管理接口 ---

// 获取综合对话会话列表
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { data: sessions, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .is('agent_id', null) // 筛选 agent_id 为 NULL 的会话
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: sessions });
  } catch (error: any) {
    console.error('Fetch sessions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建新会话
router.post('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { title } = req.body;
    
    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        user_id: userId,
        agent_id: null, // 明确设置为 NULL
        title: title || '新对话',
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data: session });
  } catch (error: any) {
    console.error('Create session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除会话
router.delete('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // 确保只能删除自己的

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新会话标题
router.patch('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { title } = req.body;

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取会话消息
router.get('/sessions/:id/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // 先验证 session 归属
    const { data: session, error: sessionError } = await supabaseAdmin
        .from('sessions')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
    
    if (sessionError || !session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data: messages });
  } catch (error: any) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 聊天接口 ---

router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { messages, sessionId, webSearch, images, files } = req.body;
    const userId = req.user!.id;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'Messages array is required' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 如果有 sessionId，验证并保存用户消息
    if (sessionId) {
       // 保存用户最新一条消息
       const lastMsg = messages[messages.length - 1];
       if (lastMsg.role === 'user') {
           console.log(`[MultiAgent] Saving user message. Session: ${sessionId}, Files: ${files?.length}, Images: ${images?.length}`);
           
           try {
               const { error: insertError } = await supabaseAdmin.from('messages').insert({
                   session_id: sessionId,
                   user_id: userId,
                   role: 'user',
                   content: lastMsg.content,
                   images: images || [],
                   files: files || []
               });

               if (insertError) {
                   console.error('[MultiAgent] Failed to save user message:', insertError);
                   // 如果是因为缺少 files 列，尝试降级保存（不存 files）
                   if (insertError.code === '42703' && insertError.message?.includes('files')) {
                       console.warn('[MultiAgent] Retrying without files column...');
                       await supabaseAdmin.from('messages').insert({
                           session_id: sessionId,
                           user_id: userId,
                           role: 'user',
                           content: lastMsg.content,
                           images: images || []
                       });
                   } else {
                       throw insertError;
                   }
               } else {
                   // 更新会话时间
                   await supabaseAdmin.from('sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
               }
           } catch (e) {
               console.error('[MultiAgent] Error saving message to DB:', e);
               // 不阻断流程，继续对话
           }
       }
    }

    // 准备发送给模型的消息
    let processedMessages = [...messages];
    
    // 处理最后一条消息，附加文件内容
    const lastMessageIndex = processedMessages.length - 1;
    let lastContent = processedMessages[lastMessageIndex].content;

    // 如果有文件，附加到内容中
    if (files && files.length > 0) {
      const filesContent = files.map((f: any) => `\n\n【附件：${f.name}】\n${f.content}\n\n`).join('');
      lastContent = (lastContent + filesContent).trim();
    }
    
    // 如果只有附件没有文字
    if (!lastContent && (images?.length || files?.length)) {
      lastContent = '请分析上传的内容。';
    }

    // 构造 LangChain 消息对象
    const langchainMessages = processedMessages.map((msg: any, index: number) => {
      let content = msg.content;
      if (index === lastMessageIndex) {
        content = lastContent;
        
        // 如果有图片，且是最后一条消息，构造多模态消息
        if (images && images.length > 0) {
           const contentParts: any[] = [{ type: 'text', text: content }];
           images.forEach((img: string) => {
             contentParts.push({
               type: 'image_url',
               image_url: { url: img }
             });
           });
           return new HumanMessage({ content: contentParts });
        }
      }
      
      if (msg.role === 'user') return new HumanMessage(content);
      if (msg.role === 'assistant') return new AIMessage(content);
      return new HumanMessage(content); // Default
    });

    // 1. Run Routing Graph to select agent
    const result = await routingGraph.invoke({ messages: langchainMessages });
    const selectedAgentId = result.selectedAgentId;
    
    // 2. Get System Prompt
    const systemPrompt = await getAgentSystemPrompt((selectedAgentId as string) || "DEFAULT");

    // 3. Create Model and Stream
    // 如果有图片，强制使用 VL 模型
    let modelName = undefined;
    if (images && images.length > 0) {
       modelName = process.env.DASHSCOPE_VL_MODEL || 'qwen-vl-max';
    }
    
    // 启用联网搜索
    const model = createDashScopeModel(modelName, { enableSearch: webSearch });
    
    // Get agent name for UI
    let agentName = "DEFAULT";
    let agentAvatar = "";
    if (selectedAgentId && selectedAgentId !== "DEFAULT") {
      const { data: agent } = await supabase
        .from('agents')
        .select('name, avatar_url')
        .eq('id', selectedAgentId)
        .single();
      if (agent) {
        agentName = agent.name;
        agentAvatar = agent.avatar_url;
      }
    }

    // 准备保存 AI 回复
    let fullResponse = "";

    const streamHandler = createStreamHandler(
      res, 
      (token) => { fullResponse += token; }, 
      async () => {
          // Stream 结束，保存 AI 回复到数据库
          if (sessionId) {
              try {
                  const metadata = {
                      agentId: selectedAgentId,
                      agentName,
                      agentAvatar
                  };
                  // 尝试带 metadata 插入
                  const { error } = await supabaseAdmin.from('messages').insert({
                      session_id: sessionId,
                      user_id: userId,
                      role: 'assistant',
                      content: fullResponse,
                      metadata // 需要 DB 支持 metadata 字段
                  });
                  
                  if (error) throw error;
              } catch (e: any) {
                  console.error('Failed to save AI response with metadata:', e);
                  // 如果是因为 metadata 列不存在 (Postgres error 42703: undefined_column)，则重试不带 metadata
                  if (e.code === '42703' || e.message?.includes('metadata')) {
                      try {
                          await supabaseAdmin.from('messages').insert({
                              session_id: sessionId,
                              user_id: userId,
                              role: 'assistant',
                              content: fullResponse
                          });
                      } catch (retryError) {
                           console.error('Failed to save AI response (retry):', retryError);
                      }
                  }
              }

              // Auto-generate title if it's the first message
              if (messages.length === 1) {
                  console.log('Auto-generating title for session:', sessionId);
                  generateSessionTitle(lastContent, fullResponse).then(async (newTitle) => {
                      console.log('Generated title:', newTitle);
                      if (newTitle && newTitle !== '新的对话') {
                          await supabaseAdmin
                              .from('sessions')
                              .update({ title: newTitle })
                              .eq('id', sessionId);
                      }
                  }).catch(err => console.error('Failed to auto-generate title:', err));
              }
          }
      } // Resolve callback
    );

    // Send a meta event indicating which agent was selected
    res.write(`data: ${JSON.stringify({ type: 'meta', agentName, agentAvatar })}\n\n`);

    const stream = await model.stream([
      new SystemMessage(systemPrompt),
      ...langchainMessages
    ]);

    for await (const chunk of stream) {
      if (chunk.content) {
        streamHandler.handleLLMNewToken(chunk.content as string);
      }
    }

    streamHandler.handleLLMEnd();

  } catch (error: any) {
    console.error('Multi-agent chat error:', error);
    // If headers sent, we can't send JSON error
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
