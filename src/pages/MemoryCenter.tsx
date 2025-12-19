import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { Trash2, Plus, Brain, Calendar, Search, Edit2, X, Check, ChevronDown, AlertCircle, Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';

interface Memory {
  id: string;
  content: string;
  category: string;
  source: string;
  created_at: string;
}

const CATEGORIES = [
  { value: 'general', label: '通用' },
  { value: 'preference', label: '偏好' },
  { value: 'fact', label: '事实' },
  { value: 'work', label: '工作' },
];

const MemoryCenter: React.FC = () => {
  const { user } = useAuthStore();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('general');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('general');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [isConsolidatingView, setIsConsolidatingView] = useState(false);
  const [consolidationData, setConsolidationData] = useState<{
    original: Memory[];
    generated: { content: string; category: string }[];
  } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchMemories = async () => {
    // Check if we have cached memories
    const cachedMemories = localStorage.getItem('cachedMemories');
    if (cachedMemories) {
        try {
            setMemories(JSON.parse(cachedMemories));
            setIsLoading(false); // Skip loading state if cache exists
        } catch (e) {
            console.error('Failed to parse cached memories', e);
        }
    } else {
        setIsLoading(true);
    }

    setError(null);
    try {
      const res = await fetch('/api/memories', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setMemories(data.data);
        // Update cache
        localStorage.setItem('cachedMemories', JSON.stringify(data.data));
      } else {
        // 如果是表不存在的错误，给用户友好的提示
        if (data.error && data.error.includes('relation "memories" does not exist')) {
            setError('数据库尚未初始化。请联系管理员运行迁移脚本 (20251219_add_memories_table.sql)。');
        } else {
            setError('加载记忆失败：' + (data.error || '未知错误'));
        }
      }
    } catch (e) {
      console.error('Fetch memories failed', e);
      setError('网络连接失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryContent.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ 
          content: newMemoryContent,
          category: newMemoryCategory 
        })
      });
      const data = await res.json();
      if (data.success) {
        setMemories(prev => {
            const newMemories = [data.data, ...prev];
            localStorage.setItem('cachedMemories', JSON.stringify(newMemories));
            return newMemories;
        });
        setNewMemoryContent('');
        setIsAdding(false);
      } else {
         if (data.error && data.error.includes('relation "memories" does not exist')) {
            setError('保存失败：数据库表未创建。请联系管理员。');
         } else {
            setError('保存失败：' + (data.error || '未知错误'));
         }
      }
    } catch (e) {
      console.error('Add memory failed', e);
      setError('保存请求失败，请检查网络');
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await fetch(`/api/memories/${deleteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setMemories(prev => {
          const newMemories = prev.filter(m => m.id !== deleteId);
          localStorage.setItem('cachedMemories', JSON.stringify(newMemories));
          return newMemories;
      });
    } catch (e) {
      console.error('Delete memory failed', e);
    } finally {
        setDeleteId(null);
    }
  };

  const startEdit = (memory: Memory) => {
    setEditingId(memory.id);
    setEditContent(memory.content);
    setEditCategory(memory.category);
  };

  const saveEdit = async (id: string) => {
    try {
        await fetch(`/api/memories/${id}`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify({ 
                content: editContent,
                category: editCategory
            })
        });
        setMemories(prev => {
            const newMemories = prev.map(m => m.id === id ? { ...m, content: editContent, category: editCategory } : m);
            localStorage.setItem('cachedMemories', JSON.stringify(newMemories));
            return newMemories;
        });
        setEditingId(null);
    } catch (e) {
        console.error('Update memory failed', e);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveEdit(id);
    }
  };

  const handleConsolidateClick = () => {
    if (memories.length < 2) {
        alert('记忆条数过少，无需整理');
        return;
    }
    setShowConfirmModal(true);
  };

  const startConsolidation = async () => {
    setShowConfirmModal(false);
    setIsConsolidatingView(true);
    setIsConsolidating(true);
    setConsolidationData(null);
    setError(null);

    try {
        const res = await fetch('/api/memories/consolidate', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            if (data.data.preview) {
                setConsolidationData(data.data);
            } else {
                // 如果没有需要整理的，直接提示并退出
                setError('没有发现需要整理的记忆');
                setTimeout(() => setIsConsolidatingView(false), 2000);
            }
        } else {
            setError('整理失败：' + (data.error || '未知错误'));
        }
    } catch (e) {
        console.error('Consolidate failed', e);
        setError('请求失败，请检查网络');
    } finally {
        setIsConsolidating(false);
    }
  };

  const applyConsolidation = async () => {
      if (!consolidationData) return;
      setIsSaving(true);
      try {
          const deleteIds = consolidationData.original.map(m => m.id);
          const newMemories = consolidationData.generated;

          await fetch('/api/memories/consolidate/execute', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}` 
              },
              body: JSON.stringify({ deleteIds, newMemories })
          });

          // Refresh
          localStorage.removeItem('cachedMemories');
          await fetchMemories();
          setIsConsolidatingView(false);
      } catch (e) {
          console.error('Apply consolidation failed', e);
          setError('应用更改失败，请重试');
      } finally {
          setIsSaving(false);
      }
  };

  const updateGeneratedMemory = (index: number, content: string) => {
      if (!consolidationData) return;
      const newGenerated = [...consolidationData.generated];
      newGenerated[index].content = content;
      setConsolidationData({ ...consolidationData, generated: newGenerated });
  };

  const filteredMemories = memories.filter(m => 
    m.content.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 bg-gray-50 h-full overflow-y-auto p-8 relative">
      <AnimatePresence>
        {isConsolidatingView && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-white/95 backdrop-blur-xl z-50 flex flex-col p-8 overflow-y-auto"
                style={{ overflowY: 'overlay' } as any}
            >
                <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Sparkles className="w-6 h-6 text-indigo-600" />
                            记忆智能整理
                        </h2>
                        {!isConsolidating && (
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsConsolidatingView(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    取消
                                </button>
                                <button 
                                    onClick={applyConsolidation}
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200"
                                >
                                    {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                                    确认应用
                                </button>
                            </div>
                        )}
                    </div>

                    {isConsolidating ? (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="relative w-24 h-24 mb-8">
                                <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                                <Sparkles className="absolute inset-0 m-auto w-10 h-10 text-indigo-600 animate-pulse" />
                            </div>
                            <h3 className="text-xl font-medium text-gray-900 mb-2">正在分析您的记忆库...</h3>
                            <p className="text-gray-500">AI 正在寻找重复项、合并碎片并优化表达</p>
                        </div>
                    ) : consolidationData ? (
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 min-h-0">
                            {/* Original */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-gray-500 font-medium px-2">
                                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                    整理前 (将被删除)
                                </div>
                                <div className="flex-1 bg-red-50/50 rounded-2xl p-6 border border-red-100 overflow-y-auto space-y-4">
                                    {consolidationData.original.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                            <p>没有需要删除的旧记忆</p>
                                        </div>
                                    ) : (
                                        consolidationData.original.map(m => (
                                            <div key={m.id} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm opacity-80">
                                                <div className="text-sm text-red-400 mb-1 flex items-center gap-2">
                                                    <Trash2 className="w-3 h-3" />
                                                    {CATEGORIES.find(c => c.value === m.category)?.label || m.category}
                                                </div>
                                                <p className="text-gray-600 line-through decoration-red-200">{m.content}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className="hidden md:flex flex-col justify-center items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                                <div className="w-12 h-12 bg-white rounded-full shadow-lg border border-indigo-100 flex items-center justify-center">
                                    <ArrowRight className="w-6 h-6 text-indigo-600" />
                                </div>
                            </div>

                            {/* Generated */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-indigo-600 font-medium px-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                    整理后 (建议新增)
                                </div>
                                <div className="flex-1 bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100 overflow-y-auto space-y-4">
                                    {consolidationData.generated.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                            <p>没有生成新的记忆，仅删除了冗余项。</p>
                                        </div>
                                    ) : (
                                        consolidationData.generated.map((m, idx) => (
                                            <div key={idx} className="bg-white p-4 rounded-xl border border-indigo-200 shadow-md ring-1 ring-indigo-500/10">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                        {CATEGORIES.find(c => c.value === m.category)?.label || m.category}
                                                    </div>
                                                    <Edit2 className="w-3 h-3 text-indigo-300" />
                                                </div>
                                                <textarea
                                                    value={m.content}
                                                    onChange={(e) => updateGeneratedMemory(idx, e.target.value)}
                                                    className="w-full bg-transparent border-none p-0 text-gray-800 font-medium resize-none focus:ring-0 leading-relaxed"
                                                    rows={3}
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-red-500 py-12">{error}</div>
                    )}
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="w-8 h-8 text-indigo-600" />
              记忆中心
            </h1>
            <p className="text-gray-500 mt-1">管理 AI 记住的关于你的信息</p>
          </div>
          <div className="flex gap-3">
             <button
                onClick={handleConsolidateClick}
                disabled={isConsolidating || isLoading || memories.length === 0}
                className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
             >
                <Sparkles className="w-4 h-4" />
                一键整理
             </button>
             <button
                onClick={() => setIsAdding(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm shadow-indigo-200"
             >
                <Plus className="w-4 h-4" />
                添加记忆
             </button>
          </div>
        </div>

        {/* Search & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <Brain className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                    <div className="text-2xl font-bold text-gray-900">{memories.length}</div>
                    <div className="text-sm text-gray-500">总记忆条数</div>
                </div>
            </div>
            
            <div className="md:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all duration-200">
                <Search className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" />
                <input 
                    type="text" 
                    placeholder="搜索记忆内容..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 border-none focus:ring-0 text-gray-700 ml-2 placeholder-gray-400 bg-transparent outline-none"
                />
            </div>
        </div>

        {/* Add Memory Form */}
        {isAdding && (
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-8 animate-in slide-in-from-top-4 duration-200 ring-1 ring-black/5">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center justify-between">
                <span>添加新记忆</span>
                {error && <span className="text-red-500 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4"/>{error}</span>}
            </h3>
            <form onSubmit={handleAddMemory}>
              <div className="mb-4">
                <textarea
                  value={newMemoryContent}
                  onChange={(e) => setNewMemoryContent(e.target.value)}
                  placeholder="例如：我喜欢吃川菜，不要太辣..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none h-24 bg-gray-50 focus:bg-white"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">分类：</span>
                    <div className="relative">
                        <select 
                            value={newMemoryCategory}
                            onChange={(e) => setNewMemoryCategory(e.target.value)}
                            className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white cursor-pointer hover:border-gray-300 transition-colors"
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAdding(false); setError(null); }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!newMemoryContent.trim() || isSaving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                    保存
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Memory List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">加载记忆中...</p>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 border-dashed">
            <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无相关记忆</h3>
            <p className="text-gray-500">开始对话或手动添加记忆，让 AI 更懂你</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMemories.map(memory => (
              <div key={memory.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        memory.source === 'chat' || memory.source === 'multi-agent' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-green-100 text-green-700'
                      }`}>
                        {memory.source === 'chat' || memory.source === 'multi-agent' ? '自动提取' : '手动添加'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        {CATEGORIES.find(c => c.value === memory.category)?.label || memory.category}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(memory.created_at).toLocaleString()}
                      </span>
                    </div>
                    
                    {editingId === memory.id ? (
                        <div className="mt-2">
                             <div className="flex gap-2 mb-2">
                                <div className="relative inline-block">
                                    <select 
                                        value={editCategory}
                                        onChange={(e) => setEditCategory(e.target.value)}
                                        className="appearance-none pl-3 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white cursor-pointer hover:border-gray-300 transition-colors"
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                             </div>
                             <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={(e) => handleEditKeyDown(e, memory.id)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                                rows={3}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><X className="w-4 h-4"/></button>
                                <button onClick={() => saveEdit(memory.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-700 leading-relaxed">{memory.content}</p>
                    )}
                  </div>
                  
                  {!editingId && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                        <button 
                            onClick={() => startEdit(memory)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="编辑"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleDeleteClick(memory.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Delete Confirm Modal */}
      <ConfirmationModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="删除记忆"
        message="确定要删除这条记忆吗？此操作无法撤销。"
        type="danger"
        confirmText="删除"
      />

      {/* Consolidate Confirm Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={startConsolidation}
        title="整理所有记忆"
        message="AI 将自动合并重复项并删除冗余信息。整理完成后，您将有机会预览并确认更改。"
        type="info"
        confirmText="开始整理"
      />
    </div>
  );
};

export default MemoryCenter;
