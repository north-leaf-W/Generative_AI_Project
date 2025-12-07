import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Agent } from '../../shared/types';

interface AgentCardProps {
  agent: Agent;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  return (
    <Link
      to={`/chat/${agent.id}`}
      className="block bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 group"
    >
      <div className="p-6">
        {/* 头像和名称 */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="relative">
            <img
              src={agent.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=random`}
              alt={agent.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-100"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=random`;
              }}
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {agent.name}
            </h3>
            <div className="flex items-center space-x-1 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>在线</span>
            </div>
          </div>
        </div>

        {/* 描述 */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {agent.description || '这是一个AI智能体，可以与您进行智能对话。'}
        </p>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <MessageCircle className="w-3 h-3" />
            <span>开始对话</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-blue-600 group-hover:translate-x-1 transition-transform">
              →
            </div>
          </div>
        </div>
      </div>

      {/* 渐变边框效果 */}
      <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-b-xl"></div>
    </Link>
  );
};

export default AgentCard;