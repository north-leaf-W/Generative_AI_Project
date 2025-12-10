import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface PixelAgentsProps {
  className?: string;
}

const PixelAgents: React.FC<PixelAgentsProps> = ({ className = '' }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const agent1Ref = useRef<SVGSVGElement>(null);
  const agent2Ref = useRef<SVGSVGElement>(null);
  const agent3Ref = useRef<SVGSVGElement>(null);
  const [centers, setCenters] = useState<{ x: number; y: number }[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const updateCenters = () => {
      if (agent1Ref.current && agent2Ref.current && agent3Ref.current) {
        const r1 = agent1Ref.current.getBoundingClientRect();
        const r2 = agent2Ref.current.getBoundingClientRect();
        const r3 = agent3Ref.current.getBoundingClientRect();
        setCenters([
          { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 },
          { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 },
          { x: r3.left + r3.width / 2, y: r3.top + r3.height / 2 },
        ]);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', updateCenters);
    window.addEventListener('scroll', updateCenters, true); // Capture scroll events
    
    // Initial update
    updateCenters();
    // Update again after a short delay to ensure layout is stable
    setTimeout(updateCenters, 100);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', updateCenters);
      window.removeEventListener('scroll', updateCenters, true);
    };
  }, []);

  const calculateEyePos = (index: number, limit: number = 2.5) => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    
    const center = centers[index];
    if (center.x === 0 && center.y === 0) return { x: 0, y: 0 };

    const dx = mousePos.x - center.x;
    const dy = mousePos.y - center.y;
    
    const angle = Math.atan2(dy, dx);
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy) / 20, limit); // Increased sensitivity
    
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
    };
  };

  const offset1 = calculateEyePos(0);
  const offset2 = calculateEyePos(1);
  const offset3 = calculateEyePos(2);

  return (
    <div className={`flex items-end space-x-2 ${className}`} style={{ height: '60px' }}>
      {/* 左边小绿人 - 圆润版 */}
      <motion.svg 
        ref={agent1Ref}
        width="40" height="40" viewBox="0 0 40 40" 
        className="drop-shadow-lg"
        initial={{ y: 0 }}
        whileHover={{ y: -5 }}
      >
        {/* 身体 */}
        <path d="M5 35 L5 20 A 15 15 0 0 1 35 20 L 35 35 Z" fill="#a3e635" stroke="black" strokeWidth="2" strokeLinejoin="round" />

        {/* 眼睛左 */}
        <rect x="11" y="20" width="8" height="8" rx="3" fill="white" />
        <circle cx={15 + offset1.x} cy={24 + offset1.y} r="2.5" fill="black" />

        {/* 眼睛右 */}
        <rect x="21" y="20" width="8" height="8" rx="3" fill="white" />
        <circle cx={25 + offset1.x} cy={24 + offset1.y} r="2.5" fill="black" />
      </motion.svg>

      {/* 中间小紫人 - 圆润版 */}
      <motion.svg 
        ref={agent2Ref}
        width="50" height="50" viewBox="0 0 50 50" 
        className="drop-shadow-lg z-10 -ml-1"
        initial={{ y: 0 }}
        whileHover={{ y: -5 }}
      >
        {/* 身体 */}
        <path d="M5 45 L5 25 A 20 20 0 0 1 45 25 L 45 45 Z" fill="#c084fc" stroke="black" strokeWidth="2" strokeLinejoin="round" />

        {/* 眼睛左 */}
        <rect x="12" y="22" width="10" height="10" rx="4" fill="white" />
        <circle cx={17 + offset2.x} cy={27 + offset2.y} r="3" fill="black" />

        {/* 眼睛右 */}
        <rect x="28" y="22" width="10" height="10" rx="4" fill="white" />
        <circle cx={33 + offset2.x} cy={27 + offset2.y} r="3" fill="black" />
      </motion.svg>

      {/* 右边小蓝人 - 圆润版 */}
      <motion.svg 
        ref={agent3Ref}
        width="40" height="40" viewBox="0 0 40 40" 
        className="drop-shadow-lg -ml-1"
        initial={{ y: 0 }}
        whileHover={{ y: -5 }}
      >
        {/* 身体 */}
        <path d="M5 35 L5 20 A 15 15 0 0 1 35 20 L 35 35 Z" fill="#60a5fa" stroke="black" strokeWidth="2" strokeLinejoin="round" />

        {/* 眼睛左 */}
        <rect x="11" y="20" width="8" height="8" rx="3" fill="white" />
        <circle cx={15 + offset3.x} cy={24 + offset3.y} r="2.5" fill="black" />

        {/* 眼睛右 */}
        <rect x="21" y="20" width="8" height="8" rx="3" fill="white" />
        <circle cx={25 + offset3.x} cy={24 + offset3.y} r="2.5" fill="black" />
      </motion.svg>
    </div>
  );
};

export default PixelAgents;
