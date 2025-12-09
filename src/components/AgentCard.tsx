import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Agent } from '../../shared/types';
import { motion } from 'framer-motion';

interface AgentCardProps {
  agent: Agent;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Link
        to={`/chat/${agent.id}`}
        className="block h-full glass rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group relative border border-white/40"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="p-6 relative z-10">
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
              <div className="flex items-center space-x-1 text-sm text-green-600 mt-0.5">
                <Sparkles className="w-3 h-3" />
                <span className="font-medium">在线</span>
              </div>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-gray-600 text-sm mb-6 line-clamp-2 leading-relaxed min-h-[2.5rem]">
            {agent.description || '这是一个AI智能体，可以与您进行智能对话。'}
          </p>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100/50">
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