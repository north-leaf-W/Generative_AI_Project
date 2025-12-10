import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Star } from 'lucide-react';
import { Agent } from '../../shared/types';
import { motion } from 'framer-motion';
import { useAgentsStore } from '../stores/agents';

interface AgentCardProps {
  agent: Agent;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const { toggleFavorite } = useAgentsStore();

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(agent);
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "tween", duration: 0.2 }}
    >
      <Link
        to={`/chat/${agent.id}`}
        className="block h-full bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 group relative border border-gray-100 flex flex-col"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="p-6 relative z-10 flex-1 flex flex-col">
          {/* 头像和名称 */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-sm opacity-20 group-hover:opacity-40 transition-opacity" />
              <img
                src={agent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=random`}
                alt={agent.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md relative z-10"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=random`;
                }}
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white z-20 shadow-sm flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                {agent.name}
              </h3>
              {/* Tags replacing Online status */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {agent.tags && agent.tags.length > 0 ? (
                  agent.tags.slice(0, 2).map((tag, index) => (
                    <span key={index} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-md border border-blue-100 font-medium">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-[10px] rounded-md border border-gray-100 font-medium">
                    通用
                  </span>
                )}
              </div>
            </div>
            {/* 收藏按钮 */}
            <button
              onClick={handleFavorite}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Star
                className={`w-5 h-5 transition-colors ${
                  agent.is_favorited ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
                }`}
              />
            </button>
          </div>

          {/* 描述 */}
          <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed min-h-[2.5rem]">
            {agent.description || '这是一个AI智能体，可以与您进行智能对话。'}
          </p>
          
          {/* 操作按钮 - 底部对齐 */}
          <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100/50">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-gray-500 bg-gray-50/50 px-2 py-1 rounded-full">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>开始对话</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
              <div className="text-gray-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5">
                →
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default AgentCard;
