import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface PixelAgentsProps {
  className?: string;
}

const PixelAgents: React.FC<PixelAgentsProps> = ({ className = '' }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const calculateEyePos = (baseX: number, baseY: number, limit: number = 2) => {
    // 这里简单处理，假设组件在屏幕相对固定的位置，或者我们通过 ref 获取实际位置
    // 为了简化，我们只计算鼠标相对于屏幕中心的偏移趋势，或者直接用简单的跟随逻辑
    // 更精确的做法是获取每个眼球的 getBoundingClientRect，但在 SVG 内部比较麻烦
    // 我们用一种近似算法：鼠标在屏幕的位置决定眼球的偏移
    
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight - 100; // 假设在底部
    
    const dx = mousePos.x - centerX;
    const dy = mousePos.y - centerY;
    
    const angle = Math.atan2(dy, dx);
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy) / 50, limit); // 距离缩放
    
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
    };
  };

  const eyeOffset = calculateEyePos(0, 0, 3); // 最大偏移 3px

  return (
    <div className={`flex items-end space-x-1 ${className}`} style={{ height: '60px' }}>
      {/* 左边小绿人 */}
      <motion.svg width="40" height="40" viewBox="0 0 40 40" className="drop-shadow-lg">
        <path d="M5 15 H35 V35 H5 Z" fill="#a3e635" shapeRendering="crispEdges" />
        {/* 顶部像素角 */}
        <rect x="10" y="10" width="20" height="5" fill="#a3e635" shapeRendering="crispEdges" />
        <rect x="15" y="5" width="10" height="5" fill="#a3e635" shapeRendering="crispEdges" />
        
        {/* 描边 (模拟) */}
        <path d="M5 15 V35 H35 V15 H30 V10 H25 V5 H15 V10 H10 V15 H5 Z" fill="none" stroke="black" strokeWidth="2" shapeRendering="crispEdges" />

        {/* 眼睛左 */}
        <rect x="10" y="20" width="8" height="8" fill="white" shapeRendering="crispEdges" />
        <rect x={12 + eyeOffset.x} y={22 + eyeOffset.y} width="4" height="4" fill="black" shapeRendering="crispEdges" />

        {/* 眼睛右 */}
        <rect x="22" y="20" width="8" height="8" fill="white" shapeRendering="crispEdges" />
        <rect x={24 + eyeOffset.x} y={22 + eyeOffset.y} width="4" height="4" fill="black" shapeRendering="crispEdges" />
      </motion.svg>

      {/* 中间小紫人 */}
      <motion.svg width="50" height="50" viewBox="0 0 50 50" className="drop-shadow-lg z-10 -ml-2">
        <path d="M5 15 H45 V45 H5 Z" fill="#c084fc" shapeRendering="crispEdges" />
        <rect x="10" y="10" width="30" height="5" fill="#c084fc" shapeRendering="crispEdges" />
        <rect x="15" y="5" width="20" height="5" fill="#c084fc" shapeRendering="crispEdges" />
        
        {/* 描边 */}
        <path d="M5 15 V45 H45 V15 H40 V10 H35 V5 H15 V10 H10 V15 H5 Z" fill="none" stroke="black" strokeWidth="2" shapeRendering="crispEdges" />

        {/* 眼睛左 */}
        <rect x="12" y="22" width="10" height="10" fill="white" shapeRendering="crispEdges" />
        <rect x={15 + eyeOffset.x} y={25 + eyeOffset.y} width="4" height="4" fill="black" shapeRendering="crispEdges" />

        {/* 眼睛右 */}
        <rect x="28" y="22" width="10" height="10" fill="white" shapeRendering="crispEdges" />
        <rect x={31 + eyeOffset.x} y={25 + eyeOffset.y} width="4" height="4" fill="black" shapeRendering="crispEdges" />
      </motion.svg>

      {/* 右边小蓝人 */}
      <motion.svg width="40" height="40" viewBox="0 0 40 40" className="drop-shadow-lg -ml-2">
        <path d="M5 15 H35 V35 H5 Z" fill="#60a5fa" shapeRendering="crispEdges" />
        <rect x="10" y="10" width="20" height="5" fill="#60a5fa" shapeRendering="crispEdges" />
        <rect x="15" y="5" width="10" height="5" fill="#60a5fa" shapeRendering="crispEdges" />
        
        {/* 描边 */}
        <path d="M5 15 V35 H35 V15 H30 V10 H25 V5 H15 V10 H10 V15 H5 Z" fill="none" stroke="black" strokeWidth="2" shapeRendering="crispEdges" />

        {/* 眼睛左 */}
        <rect x="10" y="20" width="8" height="8" fill="white" shapeRendering="crispEdges" />
        <rect x={12 + eyeOffset.x} y={22 + eyeOffset.y} width="4" height="4" fill="black" shapeRendering="crispEdges" />

        {/* 眼睛右 */}
        <rect x="22" y="20" width="8" height="8" fill="white" shapeRendering="crispEdges" />
        <rect x={24 + eyeOffset.x} y={22 + eyeOffset.y} width="4" height="4" fill="black" shapeRendering="crispEdges" />
      </motion.svg>
    </div>
  );
};

export default PixelAgents;
