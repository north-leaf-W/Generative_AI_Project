import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Bot, Upload, Loader2, ImageIcon, ArrowLeft, Save, Send, CheckCircle, Tag, Sparkles } from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import { Agent } from '../../shared/types';
import { supabase } from '../lib/utils';
import { useAuthStore } from '../stores/auth';
import ConfirmationModal from '../components/ConfirmationModal';
import { apiRequest, API_ENDPOINTS } from '../config/api';

interface EditAgentFormData {
  name: string;
  description: string;
  system_prompt: string;
  avatar_url: string;
  tag: string;
}

const EditAgent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const readonly = location.state?.readonly;
  const from = location.state?.from;
  
  const { user } = useAuthStore();
  const { fetchAgent, updateAgent, isLoading, error } = useAgentsStore();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [fetching, setFetching] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<EditAgentFormData>({
    defaultValues: {
      name: '',
      description: '',
      system_prompt: '',
      avatar_url: '',
      tag: ''
    }
  });

  const currentAvatarUrl = watch('avatar_url');

  useEffect(() => {
    const loadAgent = async () => {
      if (!id) return;
      setFetching(true);
      try {
        const agent = await fetchAgent(id);
        if (agent) {
          // Check permission
          if (user && agent.creator_id !== user.id && !(user.role === 'admin' && readonly)) {
            navigate('/agents/my');
            return;
          }
          
          // 如果有草稿版本，优先使用草稿版本的数据
          const draft = (agent as any).draft_revision;
          
          // 如果是私有 agent，直接使用 agent 数据
          // 如果是 public agent，且有 draft，合并 draft 数据
          const displayAgent = (agent.status === 'public' && draft) 
             ? { ...agent, ...draft.changes } 
             : agent;
          
          setCurrentAgent(displayAgent);
          reset({
            name: displayAgent.name,
            description: displayAgent.description || '',
            system_prompt: displayAgent.system_prompt,
            avatar_url: displayAgent.avatar_url || '',
            tag: displayAgent.tags?.[0] || ''
          });
          
          if (draft) {
             setSubmitError('注意：当前显示的是未发布的草稿内容');
          }
        } else {
          setSubmitError('智能体不存在');
        }
      } catch (err) {
        setSubmitError('加载智能体失败');
      } finally {
        setFetching(false);
      }
    };

    loadAgent();
  }, [id, fetchAgent, reset, user, navigate]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }
      
      const file = event.target.files[0];

      // Check file size (1MB limit)
      if (file.size > 1024 * 1024) {
        setSubmitError('图片大小不能超过 1MB');
        return;
      }
      
      // 本地预览，暂不上传
      const objectUrl = URL.createObjectURL(file);
      setSelectedFile(file);
      setValue('avatar_url', objectUrl); // 临时显示用
      setSubmitError(null);

    } catch (error: any) {
      console.error('Error selecting avatar:', error);
      setSubmitError(error.message || '图片选择失败');
    }
  };

  const uploadFileToSupabase = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('agent-avatars')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('agent-avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const deleteFileFromSupabase = async (url: string) => {
    try {
      // 简单判断是否为当前项目的 Supabase Storage URL
      // 更加严谨的做法是对比 VITE_SUPABASE_URL，但这里只要包含 bucket 路径基本就够了
      if (!url || !url.includes('/storage/v1/object/public/agent-avatars/')) {
        return;
      }
      
      // 提取文件路径: .../agent-avatars/user_id/filename
      const path = url.split('/agent-avatars/')[1];
      if (!path) return;
      
      console.log('Deleting old avatar:', path);
      const { error } = await supabase.storage
        .from('agent-avatars')
        .remove([path]);
        
      if (error) {
        console.warn('Failed to delete old avatar:', error);
      }
    } catch (e) {
      console.warn('Exception while deleting old avatar:', e);
    }
  };

  const urlToFile = async (url: string, filename: string): Promise<File> => {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type });
    } catch (error) {
      console.error('urlToFile failed:', error);
      throw error;
    }
  };

  const handleRandomAvatar = async () => {
    const seed = Math.random().toString(36).substring(7);
    const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    
    setValue('avatar_url', url);
    
    try {
      // 尝试将随机头像转换为文件以便上传
      const file = await urlToFile(url, `random-avatar-${seed}.svg`);
      setSelectedFile(file);
    } catch (e) {
      console.warn('Failed to process random avatar:', e);
      setSubmitError('警告：随机头像转存失败，建议重试。');
    }
  };

  const handleAIGenerate = async () => {
    const description = watch('description');
    if (!description || description.trim() === '') {
      setSubmitError('请先填写简介描述，AI将根据描述生成头像');
      return;
    }
    
    setIsGenerating(true);
    setSubmitError(null);
    
    let finalPrompt = '';

    try {
      // 尝试调用后端优化 Prompt（将中文翻译为英文并优化）
      const response = await apiRequest<{ success: boolean, data: { prompt: string } }>(
        API_ENDPOINTS.ai.optimizePrompt,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description })
        }
      );

      if (response.success && response.data.prompt) {
        finalPrompt = response.data.prompt;
      }
    } catch (e) {
      console.warn('Prompt optimization failed, using fallback', e);
      // 降级策略：如果是中文，提示用户使用英文
      if (/[\u4e00-\u9fa5]/.test(description)) {
        setSubmitError('AI 翻译服务暂时不可用，请尝试使用英文描述');
        setIsGenerating(false);
        return;
      }
      finalPrompt = description;
    }

    // 如果优化失败且没有降级（理论上不会），使用原始描述
    if (!finalPrompt) {
        if (/[\u4e00-\u9fa5]/.test(description)) {
          setSubmitError('AI 翻译服务暂时不可用，请尝试使用英文描述');
          setIsGenerating(false);
          return;
        }
        finalPrompt = description;
    }

    const prompt = encodeURIComponent(finalPrompt);
    // 添加随机种子以确保每次点击都能生成新的
    const seed = Math.random().toString(36).substring(7);
    // 使用 nologo=true 和 no-text 避免文字干扰，同时增加 negative_prompt
    const aiAvatarUrl = `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&seed=${seed}&nologo=true&enhance=false`;
    
    // 预加载图片
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = aiAvatarUrl;
    img.onload = async () => {
      setValue('avatar_url', aiAvatarUrl);
      
      try {
        // 将 AI 生成的图片转换为 File 对象，以便在提交时上传到 Supabase
        const file = await urlToFile(aiAvatarUrl, `ai-avatar-${seed}.jpg`);
        setSelectedFile(file);
      } catch (e) {
        console.warn('Failed to convert AI image to file:', e);
        setSubmitError('警告：图片转存失败，可能会导致后续无法加载。建议重新生成或手动上传图片。');
      }
      
      setIsGenerating(false);
    };
    img.onerror = () => {
      setSubmitError('图片生成失败，请重试');
      setIsGenerating(false);
    };
  };

  const [actionType, setActionType] = useState<'save' | 'publish'>('save');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info' | 'success';
    confirmText?: string;
    showCancel?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
    confirmText: '确认',
    showCancel: true,
    onConfirm: () => {},
  });

  const doSubmit = async (data: EditAgentFormData) => {
    if (!id) return;
    setSubmitError(null);
    setSaveSuccess(false);

    let finalAvatarUrl = data.avatar_url;
    let fileToUpload = selectedFile;

    // 补救措施：如果是远程图片且没有 selectedFile，尝试再次转换
    if (!fileToUpload && finalAvatarUrl && (finalAvatarUrl.includes('pollinations.ai') || finalAvatarUrl.includes('dicebear.com'))) {
        try {
           const seed = Math.random().toString(36).substring(7);
           // 根据 URL 特征推断文件扩展名
           const ext = finalAvatarUrl.includes('dicebear') ? 'svg' : 'jpg';
           fileToUpload = await urlToFile(finalAvatarUrl, `avatar-${seed}.${ext}`);
        } catch (e) {
           console.error('Retry urlToFile failed:', e);
           setSubmitError('无法将远程图片保存到存储桶，请更换图片或重试');
           return;
        }
    }

    // 如果选择了新文件，先上传
    if (fileToUpload) {
      setUploading(true);
      try {
        finalAvatarUrl = await uploadFileToSupabase(fileToUpload);
        
        // 上传成功后，如果有旧头像且是 Supabase 的，删除旧头像
        // 注意：这里需要对比是否真的更改了头像
        if (currentAgent?.avatar_url && currentAgent.avatar_url !== finalAvatarUrl) {
           await deleteFileFromSupabase(currentAgent.avatar_url);
        }
      } catch (err: any) {
        console.error('Failed to upload avatar:', err);
        setSubmitError('头像上传失败，请重试');
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    
    const { tag, ...rest } = data;
    const updateData = {
      ...rest,
      avatar_url: finalAvatarUrl,
      tags: [tag]
    };
    
    const result = await updateAgent(id, updateData, actionType);
    
    if (result.success) {
      // 如果更新成功，且头像发生了变化，尝试删除旧的 Supabase 头像
      const oldAvatarUrl = currentAgent?.avatar_url;
      if (oldAvatarUrl && oldAvatarUrl !== finalAvatarUrl) {
        // 不等待删除完成，以免阻塞 UI
        deleteFileFromSupabase(oldAvatarUrl);
      }

      if (actionType === 'publish') {
         if (result.message) {
           setModalConfig({
             isOpen: true,
             title: '提交成功',
             message: result.message,
             type: 'success',
             confirmText: '知道了',
             showCancel: false,
             onConfirm: () => navigate('/agents/my'),
           });
         } else {
           navigate('/agents/my');
         }
      } else {
         // 保存成功，显示动画
         setSaveSuccess(true);
         setTimeout(() => setSaveSuccess(false), 2000);
      }
    } else {
      setSubmitError(result.message || '更新失败，请重试');
    }
  };

  const onSubmit = async (data: EditAgentFormData) => {
    if (actionType === 'publish' && user?.role === 'admin') {
      setModalConfig({
        isOpen: true,
        title: '确认发布',
        message: '您是管理员，发布更新将直接上线，无需审核。确定要继续吗？',
        type: 'info',
        confirmText: '确认发布',
        showCancel: true,
        onConfirm: () => doSubmit(data),
      });
    } else {
      doSubmit(data);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!currentAgent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">未找到智能体</h2>
          <button 
            onClick={() => navigate('/agents/my')}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            返回我的智能体
          </button>
        </div>
      </div>
    );
  }

  const isPublic = currentAgent.status === 'public';

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(from || '/agents/my')}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {from?.includes('admin') ? '返回管理后台' : '返回我的智能体'}
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bot className="w-6 h-6 text-blue-500" />
              编辑智能体
            </h1>
            <p className="mt-2 text-gray-600">
              {isPublic 
                ? '修改已发布的智能体需要经过管理员审核，审核通过前线上版本保持不变' 
                : '修改智能体信息和配置'}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
            {(error || submitError) && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                {error || submitError}
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                智能体名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="例如：翻译助手"
                {...register('name', { required: '请输入智能体名称' })}
                disabled={readonly}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                简介描述
              </label>
              <input
                id="description"
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="简要描述这个智能体的功能..."
                {...register('description')}
                disabled={readonly}
              />
            </div>

            {/* Avatar Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                智能体头像
              </label>
              <div className="flex items-start space-x-6">
                <div className="flex-shrink-0 relative group">
                   <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                     {currentAvatarUrl ? (
                       <img src={currentAvatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                     ) : (
                       <Bot className="w-10 h-10 text-gray-400" />
                     )}
                   </div>
                   {uploading && (
                     <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-xl">
                       <Loader2 className="w-6 h-6 text-white animate-spin" />
                     </div>
                   )}
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-3">
                    <label 
                      htmlFor="avatar-upload" 
                      className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition-colors ${uploading || readonly ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      上传图片
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleFileUpload}
                        disabled={uploading || readonly}
                      />
                    </label>
                    <span className="text-gray-400 text-sm">或</span>
                    <button
                      type="button"
                      onClick={handleRandomAvatar}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={readonly}
                    >
                      随机生成
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={handleAIGenerate}
                      className="flex items-center text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={readonly || isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI生成
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* URL Input */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <ImageIcon className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pl-10 sm:text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="或者直接输入图片 URL"
                      {...register('avatar_url')}
                      disabled={readonly}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    支持 JPG, PNG, GIF, SVG 格式，最大 1MB
                  </p>
                </div>
              </div>
            </div>

            {/* 标签分类 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                智能体分类 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {['效率工具', '文本创作', '学习教育', '代码助手', '生活方式', '游戏娱乐', '角色扮演'].map((tagOption) => (
                  <label
                    key={tagOption}
                    className={`
                      relative flex items-center justify-center px-4 py-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-all
                      ${watch('tag') === tagOption 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' 
                        : 'border-gray-200 text-gray-700'}
                      ${readonly ? 'pointer-events-none opacity-75' : ''}
                    `}
                  >
                    <input
                      type="radio"
                      value={tagOption}
                      className="sr-only"
                      {...register('tag', { required: '请选择智能体分类' })}
                      disabled={readonly}
                    />
                    <Tag className={`w-4 h-4 mr-2 ${watch('tag') === tagOption ? 'text-blue-500' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium">{tagOption}</span>
                  </label>
                ))}
              </div>
              {errors.tag && (
                <p className="mt-1 text-sm text-red-500">{errors.tag.message}</p>
              )}
            </div>

            {/* System Prompt */}
            <div>
              <label htmlFor="system_prompt" className="block text-sm font-medium text-gray-700 mb-1">
                系统提示词 (System Prompt) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <textarea
                  id="system_prompt"
                  rows={6}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm ${
                    errors.system_prompt ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="你是一个专业的翻译助手，请将用户输入的中文翻译成英文..."
                  {...register('system_prompt', { required: '请输入系统提示词' })}
                  disabled={readonly}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                这是定义智能体行为的核心指令，越具体效果越好
              </p>
              {errors.system_prompt && (
                <p className="mt-1 text-sm text-red-500">{errors.system_prompt.message}</p>
              )}
            </div>

            <div className="pt-6 flex items-center justify-end gap-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => navigate(from || '/agents/my')}
                className="px-6 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                {readonly ? '返回' : '取消'}
              </button>
              
              {!readonly && (
                <>
                  <button
                    type="submit"
                    disabled={isLoading}
                    onClick={() => setActionType('save')}
                    className={`flex items-center px-6 py-2 border rounded-lg font-medium transition-all duration-200 shadow-sm ${
                      saveSuccess 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isLoading && actionType === 'save' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : saveSuccess ? (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {saveSuccess ? '已保存' : '保存修改'}
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    onClick={() => setActionType('publish')}
                    className="flex items-center px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  >
                    {isLoading && actionType === 'publish' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {isPublic ? '提交审核' : '发布'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
      
      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText={modalConfig.confirmText}
        showCancel={modalConfig.showCancel}
      />
    </div>
  );
};

export default EditAgent;
