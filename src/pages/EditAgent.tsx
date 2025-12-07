import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Bot, Upload, Loader2, ImageIcon, ArrowLeft, Save, Send, CheckCircle } from 'lucide-react';
import { useAgentsStore } from '../stores/agents';
import { Agent } from '../../shared/types';
import { supabase } from '../lib/utils';
import { useAuthStore } from '../stores/auth';

interface EditAgentFormData {
  name: string;
  description: string;
  system_prompt: string;
  avatar_url: string;
}

const EditAgent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { fetchAgent, updateAgent, isLoading, error } = useAgentsStore();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [fetching, setFetching] = useState(true);

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<EditAgentFormData>({
    defaultValues: {
      name: '',
      description: '',
      system_prompt: '',
      avatar_url: ''
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
          if (user && agent.creator_id !== user.id) {
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
            avatar_url: displayAgent.avatar_url || ''
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      setUploading(true);
      setSubmitError(null);

      // Upload to 'agent-avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('agent-avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('agent-avatars')
        .getPublicUrl(filePath);

      if (data) {
        setValue('avatar_url', data.publicUrl);
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setSubmitError(error.message || '图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const [actionType, setActionType] = useState<'save' | 'publish'>('save');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const onSubmit = async (data: EditAgentFormData) => {
    if (!id) return;
    setSubmitError(null);
    setSaveSuccess(false);
    
    const result = await updateAgent(id, data, actionType);
    
    if (result.success) {
      if (actionType === 'publish') {
         if (result.message) {
           alert(result.message);
         }
         navigate('/agents/my');
      } else {
         // 保存成功，显示动画
         setSaveSuccess(true);
         setTimeout(() => setSaveSuccess(false), 2000);
      }
    } else {
      setSubmitError(result.message || '更新失败，请重试');
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
          onClick={() => navigate('/agents/my')}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回我的智能体
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
                  </div>
                  
                  {/* URL Input */}
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
                onClick={() => navigate('/agents/my')}
                className="px-6 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                取消
              </button>
              
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditAgent;
