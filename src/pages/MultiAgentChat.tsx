import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Layers, Loader2, MessageSquare, Plus, Trash2, Edit2, X, Check, PanelLeftClose, PanelLeft, FileText, Globe, Paperclip, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuthStore } from '../stores/auth';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  agentName?: string;
  agentAvatar?: string;
  files?: { name: string; content: string }[];
  images?: string[];
  created_at?: string;
}

interface Session {
  id: string;
  title: string;
  updated_at: string;
}

const MultiAgentChat: React.FC = () => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // File Upload & Web Search State
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ name: string; content: string }[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

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

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setUserScrolledUp(!isAtBottom);
    }
  };

  const scrollToBottom = (force = false) => {
    if (force || !userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // 当消息数量增加时（新消息），强制滚动到底部
    // 当消息内容更新时（流式输出），只有在用户没有向上滚动时才滚动
    const isNewMessage = true; // 简化处理，实际上应该比较长度，但这里依赖 userScrolledUp 也可以
    scrollToBottom(false);
  }, [messages]);

  // Save session ID
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('lastMultiAgentSessionId', currentSessionId);
    }
  }, [currentSessionId]);

  // Load Sessions
  const fetchSessions = async (isBackground = false) => {
    if (!isBackground) {
        setSessionsLoading(true);
    }
    try {
      const res = await fetch('/api/multi-agent/sessions', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setSessions(data.data);
        // Restore session if exists
        const lastSessionId = localStorage.getItem('lastMultiAgentSessionId');
        if (lastSessionId && data.data.find((s: Session) => s.id === lastSessionId)) {
          setCurrentSessionId(lastSessionId);
        }
      }
    } catch (e) {
      console.error('Fetch sessions failed', e);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Load Messages for Session
  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      return;
    }
    
    // 如果正在发送消息（isLoading为true），且是新会话（messages长度不为0，说明本地刚添加了用户消息），
    // 则跳过从数据库加载，避免覆盖本地状态
    if (isLoading && messages.length > 0) {
        return;
    }

    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/multi-agent/sessions/${currentSessionId}/messages`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            const formatted: Message[] = data.data.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                agentName: m.metadata?.agentName,
                agentAvatar: m.metadata?.agentAvatar,
                images: m.images,
                files: m.files
            }));
            console.log('[MultiAgentChat] Loaded messages. Count:', formatted.length);
            formatted.forEach(m => {
                if (m.files && m.files.length > 0) {
                    console.log(`Message ${m.id} has ${m.files.length} files`);
                }
            });
            setMessages(formatted);
        }
      } catch (e) {
          console.error('Load messages failed', e);
      }
    };
    loadMessages();
  }, [currentSessionId]);

  const createNewSession = () => {
      setCurrentSessionId(null);
      setMessages([]);
      setPendingImages([]);
      setPendingFiles([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    const isImage = file.type.startsWith('image/');

    if (isImage) {
      if (file.size > 5 * 1024 * 1024) { 
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
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/chat/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
        });
        
        const data = await response.json();

        if (data.success && data.data.text) {
            setPendingFiles(prev => [...prev, { name: file.name, content: data.data.text }]);
          }
        } catch (error) {
        console.error('Upload error:', error);
        alert('文件解析失败，请稍后重试');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const confirmDeleteSession = async () => {
      if (!deleteConfirmation) return;
      const id = deleteConfirmation;
      try {
          await fetch(`/api/multi-agent/sessions/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          setSessions(prev => prev.filter(s => s.id !== id));
          if (currentSessionId === id) {
              setCurrentSessionId(null);
              setMessages([]);
          }
      } catch (e) {
          console.error('Delete failed', e);
      } finally {
          setDeleteConfirmation(null);
      }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleteConfirmation(id);
  };

  const startEditSession = (e: React.MouseEvent, session: Session) => {
      e.stopPropagation();
      setEditingSessionId(session.id);
      setEditTitleInput(session.title);
  };

  const saveSessionTitle = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!editingSessionId) return;
      try {
          await fetch(`/api/multi-agent/sessions/${editingSessionId}`, {
              method: 'PATCH',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}` 
              },
              body: JSON.stringify({ title: editTitleInput })
          });
          setSessions(prev => prev.map(s => s.id === editingSessionId ? { ...s, title: editTitleInput } : s));
          setEditingSessionId(null);
      } catch (e) {
          console.error('Update title failed', e);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && pendingImages.length === 0 && pendingFiles.length === 0) || isLoading) return;

    // 构造显示用的消息
    let displayContent = inputMessage;
    if (!displayContent && (pendingImages.length > 0 || pendingFiles.length > 0)) {
        displayContent = pendingImages.length > 0 ? '发送了图片' : '发送了文件';
    }

    const currentImages = [...pendingImages];
    const currentFiles = [...pendingFiles];

    const userMsg: Message = { 
        role: 'user', 
        content: displayContent,
        images: currentImages,
        files: currentFiles
    };
    setMessages(prev => [...prev, userMsg]);
    setUserScrolledUp(false);
    
    // 保存并清空待发送状态
    const currentInput = inputMessage;
    
    setInputMessage('');
    setPendingImages([]);
    setPendingFiles([]);
    setIsLoading(true);

    let activeSessionId = currentSessionId;
    
    // 如果没有当前会话，先创建一个
    if (!activeSessionId) {
        try {
            const createRes = await fetch('/api/multi-agent/sessions', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` 
                },
                body: JSON.stringify({ title: currentInput.slice(0, 20) || '新对话' })
            });
            const createData = await createRes.json();
            if (createData.success) {
                activeSessionId = createData.data.id;
                setCurrentSessionId(activeSessionId);
                setSessions(prev => [createData.data, ...prev]);
            }
        } catch (e) {
            console.error('Create session failed', e);
        }
    }

    try {
      const response = await fetch('/api/multi-agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          messages: [...messages, { ...userMsg, content: currentInput }], // Send actual content
          sessionId: activeSessionId,
          webSearch: isWebSearchEnabled,
          images: currentImages,
          files: currentFiles
        })
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMsg: Message = { role: 'assistant', content: '' };
      
      setMessages(prev => [...prev, assistantMsg]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'meta' && data.agentName) {
                assistantMsg.agentName = data.agentName;
                assistantMsg.agentAvatar = data.agentAvatar;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { ...assistantMsg };
                  return newMessages;
                });
              } else if (data.token) {
                assistantMsg.content += data.token;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { ...assistantMsg };
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Error parsing SSE data', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，遇到了一些错误，请稍后再试。' }]);
    } finally {
      setIsLoading(false);
      // 如果是第一条消息，延迟刷新会话列表以获取自动生成的标题
       if (messages.length === 0) {
           // 尝试多次刷新以确保获取到标题
           setTimeout(() => fetchSessions(), 2000);
           setTimeout(() => fetchSessions(), 5000);
           setTimeout(() => fetchSessions(), 10000);
       }
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div 
        className={`${sidebarOpen ? 'w-[280px]' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden`}
      >
        <div className={`w-[280px] min-w-[280px] flex flex-col h-full transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-700">历史会话</h2>
                <button 
                  onClick={createNewSession}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                  title="新建会话"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {sessionsLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="animate-spin w-5 h-5 text-gray-400"/></div>
                ) : sessions.length === 0 ? (
                    <div className="text-center text-gray-400 py-8 text-sm">暂无历史会话</div>
                ) : (
                    sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => setCurrentSessionId(session.id)}
                            className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                                currentSessionId === session.id 
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                                    : 'hover:bg-gray-50 text-gray-700'
                            }`}
                        >
                            <MessageSquare className={`w-4 h-4 flex-shrink-0 ${currentSessionId === session.id ? 'text-indigo-500' : 'text-gray-400'}`} />
                            
                            {editingSessionId === session.id ? (
                                <div className="flex-1 flex items-center gap-1">
                                    <input 
                                        type="text" 
                                        value={editTitleInput}
                                        onChange={(e) => setEditTitleInput(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full text-sm border rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500"
                                        autoFocus
                                    />
                                    <button onClick={saveSessionTitle} className="p-1 hover:bg-green-100 text-green-600 rounded"><Check className="w-3 h-3"/></button>
                                    <button onClick={(e) => {e.stopPropagation(); setEditingSessionId(null);}} className="p-1 hover:bg-red-100 text-red-600 rounded"><X className="w-3 h-3"/></button>
                                </div>
                            ) : (
                                <span className="flex-1 text-sm truncate">{session.title}</span>
                            )}

                            {!editingSessionId && (
                                <div className="hidden group-hover:flex items-center gap-1">
                                    <button onClick={(e) => startEditSession(e, session)} className="p-1.5 hover:bg-gray-200 rounded text-gray-500"><Edit2 className="w-3 h-3" /></button>
                                    <button onClick={(e) => deleteSession(e, session.id)} className="p-1.5 hover:bg-red-100 rounded text-red-500"><Trash2 className="w-3 h-3" /></button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 transition-all duration-300 relative">
        <ConfirmationModal
          isOpen={!!deleteConfirmation}
          onClose={() => setDeleteConfirmation(null)}
          onConfirm={confirmDeleteSession}
          title="删除会话"
          message="确定要删除这个会话吗？删除后将无法恢复。"
          type="danger"
          confirmText="删除"
        />
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors mr-2"
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">综合对话平台</h1>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                多智能体协作中
              </p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div 
          className="flex-1 overflow-y-auto p-6 scroll-smooth"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                <Layers className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">欢迎使用综合对话平台</h3>
              <p className="max-w-md text-center text-gray-500">
                我会自动分析您的需求，并调度最合适的智能体为您服务。
              </p>
            </div>
          ) : (
            <div className="w-[85%] max-w-[1600px] mx-auto space-y-6 px-4">
              {messages.map((msg, index) => {
                // Hide empty assistant messages until content starts streaming
                if (msg.role === 'assistant' && !msg.content) return null;

                return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' ? (user?.avatar_url ? '' : 'bg-blue-500') : (msg.agentAvatar ? '' : 'bg-indigo-600')
                  } overflow-hidden`}>
                    {msg.role === 'user' ? (
                      user?.avatar_url ? (
                        <img src={user.avatar_url} alt="User" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-white" />
                      )
                    ) : (
                      msg.agentAvatar ? (
                        <img src={msg.agentAvatar} alt={msg.agentName} className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="w-5 h-5 text-white" />
                      )
                    )}
                  </div>
                  
                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} ${msg.role === 'assistant' ? 'w-full max-w-[calc(100%-3rem)]' : 'max-w-[80%]'}`}>
                    {msg.role === 'assistant' && msg.agentName && (
                      <div className="text-xs text-gray-500 mb-1 ml-1">
                        {msg.agentName === 'DEFAULT' ? '默认模型' : msg.agentName}
                      </div>
                    )}
                    <div className={`px-4 py-3 rounded-2xl shadow-sm overflow-hidden ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white text-gray-900 border border-gray-100 rounded-tl-none w-full'
                    }`}>
                      {/* Display Images if any */}
                      {msg.images && msg.images.length > 0 && (
                        <div className={`flex flex-wrap gap-2 mb-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {msg.images.map((img, idx) => (
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
                      {msg.files && msg.files.length > 0 && (
                        <div className="flex flex-col gap-2 mb-2">
                          {msg.files.map((file, idx) => {
                             const fileId = `${msg.id || index}-file-${idx}`;
                             const isExpanded = expandedFiles[fileId];
                             return (
                               <div key={idx} className={`rounded-xl border overflow-hidden shadow-sm transition-all duration-200 ${
                                 msg.role === 'user' 
                                   ? 'bg-blue-50/10 border-blue-200/30' 
                                   : 'bg-blue-50 border-blue-100'
                               }`}>
                                  <div 
                                    className={`flex items-center justify-between px-4 py-3 cursor-pointer ${
                                      msg.role === 'user'
                                        ? 'hover:bg-white/10'
                                        : 'hover:bg-blue-100/50'
                                    }`}
                                    onClick={() => toggleFileExpand(fileId)}
                                  >
                                    <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                        msg.role === 'user'
                                          ? 'bg-white/20'
                                          : 'bg-blue-100'
                                      }`}>
                                        <FileText className={`w-5 h-5 ${
                                          msg.role === 'user' ? 'text-white' : 'text-blue-600'
                                        }`} />
                                      </div>
                                      <div className="flex flex-col overflow-hidden min-w-0">
                                        <span className={`text-sm font-semibold truncate ${
                                          msg.role === 'user' ? 'text-white' : 'text-blue-900'
                                        }`}>{file.name}</span>
                                        <span className={`text-xs mt-0.5 ${
                                          msg.role === 'user' ? 'text-blue-100/80' : 'text-blue-500'
                                        }`}>已解析</span>
                                      </div>
                                    </div>
                                    <button className={`p-1.5 rounded-full transition-colors ml-2 flex-shrink-0 ${
                                      msg.role === 'user'
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
                                          msg.role === 'user'
                                            ? 'border-white/10 bg-black/10'
                                            : 'border-blue-100 bg-white'
                                        }`}
                                      >
                                        <div className={`p-4 text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto text-left ${
                                          msg.role === 'user' ? 'text-blue-50' : 'text-gray-600'
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

                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="relative group/msg">
                             <div className="absolute -top-2 -right-2 opacity-0 group-hover/msg:opacity-100 transition-opacity z-20">
                                 <button
                                     onClick={() => handleCopyMessage(msg.content, msg.id || `msg-${index}`)}
                                     className="p-1.5 bg-white border border-gray-200 shadow-sm rounded-md hover:bg-gray-50 text-gray-500"
                                     title="复制消息"
                                 >
                                     {copiedMessageId === (msg.id || `msg-${index}`) ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                 </button>
                             </div>
                             <MarkdownRenderer content={msg.content} />
                         </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )})}
              {isLoading && (!messages.length || messages[messages.length - 1].role === 'user' || (messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content)) && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                  <div className="flex items-center text-gray-500 text-sm bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm">
                    正在分析需求并调度智能体...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-gray-100">
          <div className="max-w-3xl mx-auto">
             {/* Pending Files Area */}
            {(pendingImages.length > 0 || pendingFiles.length > 0) && (
              <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                {pendingImages.map((img, i) => (
                  <div key={i} className="relative w-16 h-16 flex-shrink-0">
                     <img src={img} className="w-full h-full object-cover rounded-lg border border-gray-200" alt="uploaded" />
                     <button onClick={() => removePendingImage(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"><X className="w-3 h-3"/></button>
                  </div>
                ))}
                {pendingFiles.map((file, i) => (
                  <div key={i} className="relative w-32 h-16 flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg p-2 flex flex-col justify-center group">
                     <div className="flex items-center gap-1 mb-1 overflow-hidden"><FileText className="w-4 h-4 text-gray-500 flex-shrink-0"/> <span className="text-xs truncate text-gray-700">{file.name}</span></div>
                     <button onClick={() => removePendingFile(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"><X className="w-3 h-3"/></button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative">
              <div className="relative flex items-end gap-2 bg-white border border-gray-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-sm">
                 {/* Toolbar Buttons */}
                 <div className="flex items-center gap-1 pb-1 pl-1">
                     <button
                       type="button"
                       onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                       className={`p-2 rounded-lg transition-colors ${isWebSearchEnabled ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-200'}`}
                       title={isWebSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
                     >
                        <Globe className="w-5 h-5" />
                     </button>
                     
                     <button
                       type="button"
                       onClick={() => fileInputRef.current?.click()}
                       className="p-2 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"
                       title="上传文件/图片"
                     >
                        <Paperclip className="w-5 h-5" />
                     </button>
                     <input 
                       type="file" 
                       ref={fileInputRef} 
                       className="hidden" 
                       onChange={handleFileSelect}
                     />
                 </div>

                 <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="输入您的问题，我会自动匹配最合适的助手..."
                    className="flex-1 bg-transparent border-none focus:ring-0 py-3 min-w-0 text-gray-900 placeholder-gray-400"
                    disabled={false}
                 />
                 
                 <button
                    type="submit"
                    disabled={(!inputMessage.trim() && pendingImages.length === 0 && pendingFiles.length === 0) || isLoading}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm mb-1"
                 >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                 </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiAgentChat;
