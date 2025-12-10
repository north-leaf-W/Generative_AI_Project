import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Bot, Upload, Loader2, Globe, Lock, ImageIcon, X, Tag, Sparkles } from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import { CreateAgentRequest } from '../../shared/types';
import { supabase } from '../lib/utils';
import { useAuthStore } from '../stores/auth';
import ConfirmationModal from '../components/ConfirmationModal';
import { apiRequest, API_ENDPOINTS } from '../config/api';

const CreateAgent: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createAgent, isLoading, error } = useAgentsStore();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: () => {},
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CreateAgentRequest & { tag: string }>({
    defaultValues: {
      status: 'private',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + Math.random().toString(36).substring(7)
    }
  });

  const currentAvatarUrl = watch('avatar_url');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      if (!user) {
        setSubmitError('请先登录后再上传图片');
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
      setPreviewUrl(objectUrl);
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

  const onSubmit = async (data: CreateAgentRequest & { tag: string }) => {
    setSubmitError(null);
    setUploading(true);
    
    try {
      let finalAvatarUrl = data.avatar_url;

      // 如果选择了新文件，先上传
      if (selectedFile) {
        try {
          finalAvatarUrl = await uploadFileToSupabase(selectedFile);
        } catch (err: any) {
          console.error('Failed to upload avatar:', err);
          setSubmitError('头像上传失败，请重试');
          setUploading(false);
          return;
        }
      }

      const agentData = {
        ...data,
        avatar_url: finalAvatarUrl,
        tags: data.tag ? [data.tag] : []
      };
      
      // ... rest of the submit logic
      const isPublic = data.status === 'public';
      const isAdmin = user?.role === 'admin';

      if (isPublic && isAdmin) {
         setModalConfig({
           isOpen: true,
           title: '确认发布',
           message: '您是管理员，选择公开发布将直接上线，无需审核。确定要继续吗？',
           type: 'info',
           onConfirm: () => doCreate(agentData)
         });
      } else {
         await doCreate(agentData);
      }
    } catch (err: any) {
      setSubmitError(err.message || '创建智能体失败');
    } finally {
      setUploading(false);
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
    img.src = aiAvatarUrl;
    img.onload = () => {
      setValue('avatar_url', aiAvatarUrl);
      setPreviewUrl(aiAvatarUrl);
      setIsGenerating(false);
    };
    img.onerror = () => {
      setSubmitError('图片生成失败，请重试');
      setIsGenerating(false);
    };
  };

  const doCreate = async (data: CreateAgentRequest & { tag: string }) => {
    // 构造请求数据，将单选的 tag 转换为 tags 数组
    const requestData: CreateAgentRequest = {
      ...data,
      tags: [data.tag]
    };

    const newAgent = await createAgent(requestData);
    
    if (newAgent) {
      setModalConfig({
        isOpen: true,
        title: '创建成功',
        message: '智能体已成功创建！',
        type: 'success',
        onConfirm: () => {
          navigate('/agents/my');
        }
      });
    } else {
      setSubmitError('创建失败，请重试');
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bot className="w-6 h-6 text-blue-500" />
              创建新智能体
            </h1>
            <p className="mt-2 text-gray-600">
              配置您的专属 AI 助手，定义它的角色和能力
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
            {(error || submitError) && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                {error || submitError}
              </div>
            )}

            {/* 名称 */}
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
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* 描述 */}
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
              />
            </div>

            {/* 头像上传 */}
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
                      className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      上传图片
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                    <span className="text-gray-400 text-sm">或</span>
                    <button
                      type="button"
                      onClick={() => setValue('avatar_url', `https://api.dicebear.com/7.x/bottts/svg?seed=${Math.random().toString(36)}`)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      随机生成
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={handleAIGenerate}
                      className="flex items-center text-sm text-purple-600 hover:text-purple-700 font-medium"
                      disabled={isGenerating}
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
                  
                  {/* URL 输入框 (可选，如果用户想直接贴链接) */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <ImageIcon className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pl-10 sm:text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      placeholder="或者直接输入图片 URL"
                      {...register('avatar_url')}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    支持 JPG, PNG, GIF, SVG 格式，最大 2MB
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
                {['效率工具', '文本创作', '学习教育', '代码助手', '生活方式', '游戏娱乐', '角色扮演'].map((tag) => (
                  <label
                    key={tag}
                    className={`
                      relative flex items-center justify-center px-4 py-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-all
                      ${watch('tag') === tag 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' 
                        : 'border-gray-200 text-gray-700'}
                    `}
                  >
                    <input
                      type="radio"
                      value={tag}
                      className="sr-only"
                      {...register('tag', { required: '请选择智能体分类' })}
                    />
                    <Tag className={`w-4 h-4 mr-2 ${watch('tag') === tag ? 'text-blue-500' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium">{tag}</span>
                  </label>
                ))}
              </div>
              {errors.tag && (
                <p className="mt-1 text-sm text-red-500">{errors.tag.message}</p>
              )}
            </div>

            {/* 系统提示词 */}
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
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                这是定义智能体行为的核心指令，越具体效果越好
              </p>
              {errors.system_prompt && (
                <p className="mt-1 text-sm text-red-500">{errors.system_prompt.message}</p>
              )}
            </div>

            {/* 发布设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                发布设置
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="relative flex items-start p-4 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                  <div className="flex items-center h-5">
                    <input
                      type="radio"
                      value="private"
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      {...register('status')}
                    />
                  </div>
                  <div className="ml-3">
                    <span className="flex items-center text-sm font-medium text-gray-900">
                      <Lock className="w-4 h-4 mr-2 text-gray-500" />
                      私有 (Private)
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      仅您自己可见和使用
                    </p>
                  </div>
                </label>

                <label className="relative flex items-start p-4 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                  <div className="flex items-center h-5">
                    <input
                      type="radio"
                      value="public"
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      {...register('status')}
                    />
                  </div>
                  <div className="ml-3">
                    <span className="flex items-center text-sm font-medium text-gray-900">
                      <Globe className="w-4 h-4 mr-2 text-blue-500" />
                      申请发布 (Public)
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      提交审核，通过后所有人可见
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-end gap-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                返回
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center px-8 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  '立即创建'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
      />
    </div>
  );
};

export default CreateAgent;