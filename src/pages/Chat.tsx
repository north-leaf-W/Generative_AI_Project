import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Send, Menu, Plus, Trash2, User, Bot, Loader2, ArrowLeft, ChevronsLeft, X, AlertCircle, Star, Globe, Edit2, Check, Database, Paperclip, Image as ImageIcon, XCircle, FileText, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useChatStore } from '../stores/chat';
import { useAgentsStore } from '../stores/agents';
import { Agent, Session, Message } from '../../shared/types';
import { API_ENDPOINTS, apiRequest } from '../config/api';
import { AnimatePresence, motion } from 'framer-motion';
import PixelAgents from '../components/PixelAgents';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ConfirmationModal from '../components/ConfirmationModal';
import Loading from '../components/Loading';

const Chat: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const mode = (location.state as { mode?: 'public' | 'dev' })?.mode || 'public';
  const { user } = useAuthStore();
  const { agents, myAgents, fetchAgents, fetchAgent, toggleFavorite } = useAgentsStore();
  const { 
    sessions, 
    currentSession, 
    messages, 
    isLoading, 
    isStreaming,
    streamingSessionId,
    fetchSessions, 
    createSession, 
    fetchMessages, 
    sendMessage, 
    updateSession,
    deleteSession, 
    setCurrentSession,
    setSessions,
    clearChat,
    reset
  } = useChatStore();

  const [inputMessage, setInputMessage] = useState('');
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isRAGEnabled, setIsRAGEnabled] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentLoading, setAgentLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [pendingNew, setPendingNew] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [localAgent, setLocalAgent] = useState<Agent | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [userScrolledUp, setUserScrolledUp] = useState(false); // Track if user manually scrolled up
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({}); // Track expanded file contents
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ name: string; content: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentAgent = localAgent || agents.find(agent => agent.id === agentId) || myAgents.find(agent => agent.id === agentId);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [inputMessage]);

  // 当切换智能体时，根据智能体配置初始化 RAG 开关状态
  useEffect(() => {
    if (currentAgent) {
      setIsRAGEnabled(!!currentAgent.config?.rag_enabled);
    }
  }, [currentAgent?.id, currentAgent?.config?.rag_enabled]);

  // 自动滚动到底部逻辑优化
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
       messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // 监听滚动事件，判断用户是否向上滚动
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      // 如果距离底部超过 100px，认为用户向上滚动了
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setUserScrolledUp(!isNearBottom);
    }
  };

  // 仅当用户未向上滚动时，才自动滚动到底部 (用于流式输出时)
  useEffect(() => {
    if (!userScrolledUp && isStreaming) {
      scrollToBottom('smooth');
    }
  }, [messages, streamingContent, isStreaming]);

  // 使用 useLayoutEffect 确保在浏览器绘制前瞬间滚动到底部，避免从上到下的动画
  useLayoutEffect(() => {
     // 只有当不是流式传输且有消息时才强制瞬间滚动 (通常是切换会话或初始加载)
     if (!isStreaming && messages.length > 0) {
         scrollToBottom('auto');
     }
  }, [messages, isStreaming]);

  // 初始化聊天或发送新消息时，强制滚动到底部
  useEffect(() => {
    // 如果是第一条消息或者正在加载历史记录结束，强制滚动
    if (!messagesLoading) {
       scrollToBottom('auto');
    }
  }, [messagesLoading, currentSession?.id]);

  // 初始化聊天数据
  useEffect(() => {
    if (!agentId || !user) {
      navigate('/login');
      return;
    }

    const initChat = async () => {
      clearChat();
      setPendingNew(false);
      
      const cacheKey = `cachedSessions_${agentId}_${mode}`;
      const cachedSessions = localStorage.getItem(cacheKey);
      
      if (cachedSessions) {
          try {
              setSessions(JSON.parse(cachedSessions));
          } catch (e) {
              console.error('Failed to parse cached sessions', e);
          }
      }
      
      if (!cachedSessions) {
          setSessionsLoading(true);
      }
      
      // 获取该智能体的会话列表
      await fetchSessions(agentId, mode);
      
      // 更新缓存
      const currentSessions = useChatStore.getState().sessions;
      if (currentSessions.length > 0 || !cachedSessions) {
           localStorage.setItem(cacheKey, JSON.stringify(currentSessions));
      }
      
      setSessionsLoading(false);
    };

    initChat();

    // 组件卸载或 agentId 变化时清理状态
    return () => {
      // 不再重置整个 store，保留缓存
      // reset(); 
      // 仅清理当前聊天显示
      clearChat();
    };
  }, [agentId, user, navigate, fetchSessions, clearChat, reset, mode]);

  // 当刷新直接进入聊天页且未加载智能体列表时，尝试加载智能体详情
  useEffect(() => {
    if (agentId && !currentAgent && !agentLoading) {
      setAgentLoading(true);
      fetchAgent(agentId)
        .then(agent => {
          if (agent) setLocalAgent(agent);
        })
        .finally(() => setAgentLoading(false));
    }
  }, [agentId, currentAgent, fetchAgent, agentLoading]);

  // 根据智能体配置初始化 RAG 状态
  useEffect(() => {
    if (currentAgent?.config?.rag_enabled) {
      setIsRAGEnabled(true);
    } else {
      setIsRAGEnabled(false);
    }
  }, [currentAgent]);

  // 监听当前会话变化加载消息（不自动选择最新会话）
  useEffect(() => {
    if (currentSession && !pendingNew) {
      setMessagesLoading(true);
      fetchMessages(currentSession.id)
        .finally(() => setMessagesLoading(false));
    }
  }, [currentSession?.id]); // 仅当 session ID 变化时触发

  const handleSessionClick = (session: Session) => {
      setPendingNew(false);
      
      // 1. 同步尝试从缓存加载消息
      const cacheKey = `messages_${session.id}`; // 注意：useChatStore 内部可能没有使用 localStorage 缓存消息，而是使用 messageCache
      // 但为了解决闪烁，我们这里可以检查 useChatStore 的 messageCache
      const cachedMessages = useChatStore.getState().messageCache[session.id];
      
      if (cachedMessages) {
          // 如果 store 中已有缓存，直接切换 session 且不清除 messages
          // 修改 store 以支持同步切换：setCurrentSession 会导致 messages 变空吗？
          // 查看 store 代码：fetchMessages 会先检查缓存
          // 为了确保原子性，我们最好手动调用 store 的方法
          
          // 优化：我们手动设置当前 session 和 messages，避免中间状态
          useChatStore.setState({ 
              currentSession: session,
              messages: cachedMessages,
              error: null
          });
      } else {
          // 如果没有缓存，只能先切 session，store 会自动 fetchMessages (通过 useEffect 监听 currentSession)
          // 或者手动触发 fetchMessages
          setCurrentSession(session);
          fetchMessages(session.id);
      }
      
      // 移动端点击后自动关闭侧边栏
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
  };

  const handleCreateSession = async () => {
    if (!agentId) return;
    
    const newSession = await createSession(agentId, `新的对话`, mode);
    if (newSession) {
      setCurrentSession(newSession);
      fetchMessages(newSession.id);
      
      // Update Cache
      const currentSessions = useChatStore.getState().sessions;
      localStorage.setItem(`cachedSessions_${agentId}_${mode}`, JSON.stringify(currentSessions));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be selected again
    e.target.value = '';

    const isImage = file.type.startsWith('image/');

    if (isImage) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('图片大小不能超过 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setPendingImages(prev => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    } else {
      // Document upload
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await apiRequest<{ success: boolean; data: { text: string } }>(
          API_ENDPOINTS.chat.upload,
          {
            method: 'POST',
            body: formData
          }
        );

        if (response.success && response.data.text) {
            setPendingFiles(prev => [...prev, { name: file.name, content: response.data.text }]);
            // Focus input
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        } catch (error) {
        console.error('Upload error:', error);
        alert('文件解析失败，请稍后重试');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && pendingImages.length === 0 && pendingFiles.length === 0) || !agentId) return;
    
    // 仅当正在流式传输且是当前会话时才阻止发送
    if (isStreaming && currentSession?.id === streamingSessionId) return;

    let targetSessionId = currentSession?.id;

    if (!targetSessionId) {
      // 只要没有选中当前会话，发送消息时就自动创建新会话
      setPendingNew(true); // 标记为新会话，防止 useEffect 触发 fetchMessages 覆盖本地乐观更新的消息
      const newSession = await createSession(agentId, `新的对话`, mode);
      if (!newSession) {
        setPendingNew(false); // 创建失败，重置状态
        return;
      }
      setCurrentSession(newSession);
      // Update Cache
      const currentSessions = useChatStore.getState().sessions;
      localStorage.setItem(`cachedSessions_${agentId}_${mode}`, JSON.stringify(currentSessions));

      // 新建会话后不需要立即 fetchMessages，因为 sendMessage 会更新本地消息状态
      // setPendingNew(false); // 保持 pendingNew 为 true，防止 useEffect 触发 fetchMessages 覆盖本地状态
      targetSessionId = newSession.id;
    }

    if (!targetSessionId) return;
    
    // 标记是否是新创建的会话，用于后续决定是否刷新列表获取标题
    const isNewSession = !currentSession || currentSession.id !== targetSessionId;

    const message = inputMessage.trim();
    // 构造最终消息内容，包含附件文本
    // 修正：不再拼接文件内容到消息文本中，而是通过 files 字段传递
    let finalMessage = message;
    
    // 如果只有图片没有文字，给一个默认提示
    if (!finalMessage && (pendingImages.length > 0 || pendingFiles.length > 0)) {
       if (pendingImages.length > 0) {
          finalMessage = '发送了图片';
       } else {
          finalMessage = '发送了文件';
       }
    }
    
    setInputMessage('');
    setStreamingContent('');
    
    // 保存当前状态用于失败重试
    const currentImages = [...pendingImages];
    const currentFiles = [...pendingFiles];
    
    setPendingImages([]); // Clear images immediately
    setPendingFiles([]); // Clear files immediately

    try {
      await sendMessage(
        targetSessionId, 
        finalMessage, 
        agentId, 
        (token) => {
          // 仅当此 token 属于当前正在流式传输的会话时才更新 UI
          // 这防止了切换会话后，旧会话的流继续污染新会话的显示
          if (useChatStore.getState().streamingSessionId === targetSessionId) {
            setStreamingContent(prev => prev + token);
          }
        }, 
        isWebSearchEnabled, 
        isRAGEnabled,
        currentImages, // Pass images
        currentFiles // Pass files
      );
      
      // 仅当此会话结束流式传输时才清空（避免清空了新会话的内容）
      if (useChatStore.getState().streamingSessionId === targetSessionId) {
         setStreamingContent(''); 
      }
      
      // 发送消息完成后，重新获取一次会话列表，以确保标题更新（如果是第一次对话）
      // 延迟一点时间，给后端生成标题留出余地
      if (isNewSession) {
        setTimeout(() => {
          fetchSessions(agentId, mode).then(() => {
             const currentSessions = useChatStore.getState().sessions;
             localStorage.setItem(`cachedSessions_${agentId}_${mode}`, JSON.stringify(currentSessions));
          });
        }, 2000);
      } else if (targetSessionId === currentSession?.id && messages.length === 0) {
        // 兜底：如果当前看起来像是一个空会话（虽然理论上发完消息不应该空），也刷新一下
        setTimeout(() => {
          fetchSessions(agentId, mode).then(() => {
             const currentSessions = useChatStore.getState().sessions;
             localStorage.setItem(`cachedSessions_${agentId}_${mode}`, JSON.stringify(currentSessions));
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // 如果出错，且是当前会话，把消息放回输入框，方便用户重试
      if (currentSession?.id === targetSessionId) {
        setInputMessage(message);
        setPendingImages(currentImages); // Restore images
        setPendingFiles(currentFiles); // Restore files
        alert('发送消息失败，请检查网络或后端服务是否正常。');
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setDeleteConfirmation(sessionId);
  };

  const confirmDelete = async () => {
    if (deleteConfirmation) {
      await deleteSession(deleteConfirmation);
      setDeleteConfirmation(null);
      
      // Update Cache
      if (agentId) {
          const currentSessions = useChatStore.getState().sessions;
          localStorage.setItem(`cachedSessions_${agentId}_${mode}`, JSON.stringify(currentSessions));
      }
    }
  };

  const handleStartRename = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitleInput(session.title);
  };

  const handleRenameSubmit = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingSessionId && editTitleInput.trim()) {
      await updateSession(editingSessionId, { title: editTitleInput.trim() });
      setEditingSessionId(null);
      
      // Update Cache
      if (agentId) {
          const currentSessions = useChatStore.getState().sessions;
          localStorage.setItem(`cachedSessions_${agentId}_${mode}`, JSON.stringify(currentSessions));
      }
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditingSessionId(null);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });

    if (isToday) {
      return timeStr;
    } else if (isThisYear) {
      return `${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日 ${timeStr}`;
    } else {
      return `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日 ${timeStr}`;
    }
  };

  const toggleFileExpand = (fileId: string) => {
    setExpandedFiles(prev => ({
      ...prev,
      [fileId]: !prev[fileId]
    }));
  };

  const handleCopyMessage = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  if (!currentAgent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loading size="lg" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2 mt-4">正在加载智能体信息</h2>
          <p className="text-gray-600 mb-4">若长时间无响应，请点击重试</p>
          <button
            onClick={() => {
              if (agentId) {
                setAgentLoading(true);
                fetchAgent(agentId)
                  .then(agent => {
                    if (agent) setLocalAgent(agent);
                  })
                  .finally(() => setAgentLoading(false));
                fetchAgents();
              }
            }}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-transparent flex overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0'} transition-all duration-300 glass border-r border-white/20 flex flex-col overflow-hidden fixed md:relative h-full z-20 md:z-auto`}>
        <div className={`w-80 flex flex-col h-full transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <div className="p-4 border-b border-gray-200/50">
            <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              对话历史
              {mode === 'dev' && <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">开发环境</span>}
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>
          </div>
          <button
              onClick={() => { setPendingNew(true); setCurrentSession(null); clearChat(); }}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 text-sm md:text-base"
            >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">新建对话</span>
            <span className="sm:hidden">新建</span>
            </button>
          </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-6 md:py-8">
              <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin text-blue-500" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-6 md:py-8">
              <p className="text-gray-500 text-sm">暂无对话历史</p>
              <p className="text-gray-400 text-xs mt-1 hidden sm:block">点击上方按钮创建新对话</p>
            </div>
          ) : (
            <div className="space-y-1 md:space-y-2">
              <AnimatePresence mode="popLayout">
                {sessions.map((session) => (
                  <motion.div
                    key={session.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    className={`p-2 md:p-3 rounded-lg cursor-pointer transition-colors group ${
                      currentSession?.id === session.id
                        ? 'bg-blue-50/80 border border-blue-200/50 shadow-sm'
                        : 'hover:bg-gray-50/50'
                    }`}
                    onClick={() => handleSessionClick(session)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-2">
                        {editingSessionId === session.id ? (
                          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editTitleInput}
                              onChange={(e) => setEditTitleInput(e.target.value)}
                              onKeyDown={handleRenameKeyDown}
                              className="w-full text-sm px-1 py-0.5 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                              onBlur={() => handleRenameSubmit()}
                            />
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {session.title || '未命名对话'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(session.created_at).toLocaleDateString('zh-CN')}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingSessionId === session.id ? (
                          <button
                            onClick={handleRenameSubmit}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={(e) => handleStartRename(e, session)}
                              className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
                              title="重命名"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(session.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                              title="删除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirmation}
        onClose={() => setDeleteConfirmation(null)}
        onConfirm={confirmDelete}
        title="删除会话"
        message="确定要删除这个会话吗？删除后该会话的所有消息记录将无法恢复。"
        type="danger"
        confirmText="确认删除"
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="glass border-b border-white/20 px-4 py-3 md:px-6 md:py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 md:space-x-4">
              <button
                onClick={() => {
                  if (location.state?.from) {
                    navigate(location.state.from);
                  } else if (mode === 'dev') {
                    navigate('/agents/my');
                  } else {
                    navigate('/');
                  }
                }}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out flex items-center ${
                  !sidebarOpen ? 'w-9 opacity-100' : 'w-0 opacity-0'
                }`}
              >
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
                  disabled={sidebarOpen}
                >
                  <Menu className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center space-x-2 md:space-x-3">
                <img
                  src={currentAgent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAgent.name)}&background=random`}
                  alt={currentAgent.name}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover"
                />
                <div>
                  <h1 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
                    {currentAgent.name}
                    {user?.id === currentAgent.creator_id && (
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${
                        currentAgent.status === 'private' 
                          ? 'bg-gray-100 text-gray-700 border-gray-200' 
                          : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      }`}>
                        {currentAgent.status === 'private' ? '私有' : '我的'}
                      </span>
                    )}
                    <button
                      onClick={() => toggleFavorite(currentAgent)}
                      className="ml-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                      title={currentAgent.is_favorited ? "取消收藏" : "收藏智能体"}
                    >
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          currentAgent.is_favorited ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
                        }`}
                      />
                    </button>
                  </h1>
                  <div className="text-xs md:text-sm text-green-600 flex items-center space-x-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                    <span>在线</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-xs md:text-sm text-gray-500">
              {currentSession ? formatTime(currentSession.updated_at) : ''}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div 
          className="flex-1 overflow-y-auto px-4 py-3 md:px-6 md:py-4"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {messagesLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-blue-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Bot className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mb-3 md:mb-4" />
              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-1 md:mb-2">开始对话</h3>
              <p className="text-sm md:text-base text-gray-500 max-w-sm md:max-w-md">
                向{currentAgent.name}发送您的第一条消息，开始智能对话体验。
              </p>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 md:space-x-3 max-w-[80%] md:max-w-2xl ${
                    message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    {/* Avatar */}
                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {message.role === 'user' ? (
                        user?.avatar_url ? (
                          <img 
                            src={user.avatar_url} 
                            alt="User" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <User className="w-3 h-3 md:w-4 md:h-4 text-white" />
                          </div>
                        )
                      ) : (
                        <img
                          src={currentAgent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAgent.name)}&background=random`}
                          alt={currentAgent.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Message Content */}
                    <div className={`flex-1 ${
                      message.role === 'user' ? 'text-left' : 'text-left'
                    }`}>
                      <div className={`inline-block px-4 py-3 rounded-2xl shadow-sm ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-none'
                          : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'
                      }`}>
                        {/* Display Images if any */}
                        {message.images && message.images.length > 0 && (
                          <div className={`flex flex-wrap gap-2 mb-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {message.images.map((img, idx) => (
                              <img 
                                key={idx} 
                                src={img} 
                                alt="attachment" 
                                className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(img, '_blank')}
                              />
                            ))}
                          </div>
                        )}

                        {/* Display Files if any */}
                        {message.files && message.files.length > 0 && (
                          <div className="flex flex-col gap-2 mb-2">
                            {message.files.map((file, idx) => {
                               const fileId = `${message.id}-file-${idx}`;
                               const isExpanded = expandedFiles[fileId];
                               return (
                                 <div key={idx} className={`rounded-xl border overflow-hidden shadow-sm transition-all duration-200 ${
                                   message.role === 'user' 
                                     ? 'bg-blue-50/10 border-blue-200/30' 
                                     : 'bg-blue-50 border-blue-100'
                                 }`}>
                                    <div 
                                      className={`flex items-center justify-between px-4 py-3 cursor-pointer ${
                                        message.role === 'user'
                                          ? 'hover:bg-white/10'
                                          : 'hover:bg-blue-100/50'
                                      }`}
                                      onClick={() => toggleFileExpand(fileId)}
                                    >
                                      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                          message.role === 'user'
                                            ? 'bg-white/20'
                                            : 'bg-blue-100'
                                        }`}>
                                          <FileText className={`w-5 h-5 ${
                                            message.role === 'user' ? 'text-white' : 'text-blue-600'
                                          }`} />
                                        </div>
                                        <div className="flex flex-col overflow-hidden min-w-0">
                                          <span className={`text-sm font-semibold truncate ${
                                            message.role === 'user' ? 'text-white' : 'text-blue-900'
                                          }`}>{file.name}</span>
                                          <span className={`text-xs mt-0.5 ${
                                            message.role === 'user' ? 'text-blue-100/80' : 'text-blue-500'
                                          }`}>已解析</span>
                                        </div>
                                      </div>
                                      <button className={`p-1.5 rounded-full transition-colors ml-2 flex-shrink-0 ${
                                        message.role === 'user'
                                          ? 'text-blue-100 hover:bg-white/20'
                                          : 'text-blue-400 hover:bg-blue-100'
                                      }`}>
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                      </button>
                                    </div>
                                    
                                    <AnimatePresence>
                                      {isExpanded && (
                                        <motion.div 
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          className={`border-t ${
                                            message.role === 'user'
                                              ? 'border-white/10 bg-black/10'
                                              : 'border-blue-100 bg-white'
                                          }`}
                                        >
                                          <div className={`p-4 text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto text-left ${
                                            message.role === 'user' ? 'text-blue-50' : 'text-gray-600'
                                          }`}>
                                            {file.content}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                 </div>
                               );
                            })}
                          </div>
                        )}

                        {message.content && !message.content.includes('【附件：') && (
                          <div className={`relative group ${message.role === 'assistant' ? 'markdown-container' : ''}`}>
                            {message.role === 'assistant' ? (
                              <>
                                <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <button
                                    onClick={() => handleCopyMessage(message.content, message.id)}
                                    className="p-1.5 bg-white border border-gray-200 shadow-sm rounded-md hover:bg-gray-50 text-gray-500"
                                    title="复制消息"
                                  >
                                    {copiedMessageId === message.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                                <MarkdownRenderer content={message.content} />
                              </>
                            ) : (
                              <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5 px-1">
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {isStreaming && currentSession?.id === streamingSessionId && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2 md:space-x-3 max-w-[80%] md:max-w-2xl">
                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0">
                      <img
                        src={currentAgent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAgent.name)}&background=random`}
                        alt={currentAgent.name}
                        className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="inline-block px-4 py-3 rounded-2xl bg-white text-gray-800 rounded-bl-none border border-gray-100 shadow-sm">
                        {streamingContent ? (
                          <div className="markdown-container">
                            <MarkdownRenderer content={streamingContent} />
                            <span className="inline-block w-1.5 h-4 ml-1 bg-blue-500 animate-pulse align-middle"></span>
                          </div>
                        ) : (
                          <div className="flex space-x-1 py-1">
                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-4 py-4 md:px-6 md:py-6 w-full max-w-4xl mx-auto">
          <div className="relative">
            {/* Pixel Agents */}
            <div className="absolute -top-14 left-4 z-10 pointer-events-none">
              <PixelAgents />
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl border border-white/50 p-2 flex flex-col transition-all hover:shadow-2xl relative z-20">
              
              {/* Attachments Preview Area */}
              {(pendingImages.length > 0 || pendingFiles.length > 0) && (
                <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1 border-b border-gray-100 mb-1">
                  {/* Pending Images */}
                  {pendingImages.map((img, idx) => (
                    <div key={`img-${idx}`} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
                      <img src={img} className="w-full h-full object-cover" alt="upload preview" />
                      <button 
                        onClick={() => setPendingImages(p => p.filter((_, i) => i !== idx))}
                        className="absolute top-0.5 right-0.5 text-gray-500 hover:text-red-500 bg-white/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Pending Files */}
                  {pendingFiles.map((file, idx) => (
                    <div key={`file-${idx}`} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-xs h-14 min-w-[120px] relative group">
                      <div className="flex flex-col justify-center overflow-hidden">
                         <span className="font-medium truncate w-full" title={file.name}>{file.name}</span>
                         <span className="text-[10px] text-blue-400">已解析</span>
                      </div>
                      <button 
                        onClick={() => setPendingFiles(p => p.filter((_, i) => i !== idx))}
                        className="absolute -top-1.5 -right-1.5 text-gray-400 hover:text-red-500 bg-white rounded-full p-0.5 shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end space-x-2">
                {/* Hidden File Input */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf,.docx,.xlsx,.xls,.md,.txt,.jpg,.jpeg,.png,.webp" 
                  onChange={handleFileSelect}
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={`p-3 rounded-full transition-all duration-200 flex-shrink-0 mb-1 ml-1 ${
                    isUploading
                      ? 'bg-gray-100 text-gray-400 animate-pulse cursor-wait'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  title="上传附件 (支持文档和图片)"
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                </button>

                {currentAgent?.config?.rag_enabled && (
                  <button
                    onClick={() => setIsRAGEnabled(!isRAGEnabled)}
                    className={`p-3 rounded-full transition-all duration-200 flex-shrink-0 mb-1 ml-1 ${
                      isRAGEnabled 
                        ? 'bg-purple-100 text-purple-600 hover:bg-purple-200' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                    title={isRAGEnabled ? "关闭知识库检索" : "开启知识库检索"}
                  >
                    <Database className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                  className={`p-3 rounded-full transition-all duration-200 flex-shrink-0 mb-1 ml-1 ${
                    isWebSearchEnabled 
                      ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  title={isWebSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
                >
                  <Globe className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="和 Agent 一起开始你的工作..."
                    disabled={isStreaming && currentSession?.id === streamingSessionId}
                    className="w-full px-4 py-3 bg-transparent border-none focus:ring-0 resize-none text-gray-800 placeholder-gray-400 text-base min-h-[56px] max-h-[200px]"
                    rows={1}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={(!inputMessage.trim() && pendingImages.length === 0 && pendingFiles.length === 0) || (isStreaming && currentSession?.id === streamingSessionId)}
                  className="p-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex-shrink-0 mb-1 mr-1"
                >
                  {isStreaming && currentSession?.id === streamingSessionId ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
