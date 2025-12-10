import React from 'react';
import { motion } from 'framer-motion';

const shapes = [
  'square',
  'circle',
  'triangle',
  'plus',
  'diamond'
] as const;

const colors = [
  'bg-blue-400',
  'bg-purple-400',
  'bg-indigo-400',
  'bg-pink-400',
  'bg-cyan-400'
];

interface ParticleProps {
  delay: number;
  duration: number;
  type: typeof shapes[number];
  color: string;
  initialX: number;
  initialY: number;
  scale: number;
}

const Particle: React.FC<ParticleProps> = ({ delay, duration, type, color, initialX, initialY, scale }) => {
  const renderShape = () => {
    switch (type) {
      case 'square':
        return <div className={`w-full h-full ${color} rounded-xl opacity-20`} />;
      case 'circle':
        return <div className={`w-full h-full ${color} rounded-full opacity-20`} />;
      case 'triangle':
        return (
          <div 
            className="w-0 h-0 border-l-[50px] border-r-[50px] border-b-[86.6px] border-l-transparent border-r-transparent border-b-purple-400 opacity-20"
            style={{ width: 0, height: 0 }} 
          />
        );
      case 'diamond':
        return <div className={`w-full h-full ${color} rotate-45 rounded-xl opacity-20`} />;
      case 'plus':
        return (
          <div className="relative w-full h-full opacity-20">
            <div className={`absolute top-1/2 left-0 w-full h-1/3 -mt-[16.6%] ${color} rounded-full`} />
            <div className={`absolute left-1/2 top-0 h-full w-1/3 -ml-[16.6%] ${color} rounded-full`} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="absolute"
      initial={{ opacity: 0 }}
      animate={{ 
        y: [0, -20, 0],
        rotate: [0, 180, 360],
        opacity: [0.1, 0.3, 0.1]
      }}
      transition={{ 
        duration: duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay: delay
      }}
      style={{
        left: `${initialX}%`,
        top: `${initialY}%`,
        width: `${scale * 60}px`,
        height: `${scale * 60}px`,
      }}
    >
      {renderShape()}
    </motion.div>
  );
};

export const AnimatedBackground: React.FC = () => {
  // 生成确定性的随机粒子，避免 hydration 不匹配
  // 在实际项目中，可以使用 useMemo 生成一次
  const particles = React.useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      type: shapes[i % shapes.length],
      color: colors[i % colors.length],
      initialX: Math.random() * 100,
      initialY: Math.random() * 100,
      scale: 0.3 + Math.random() * 0.8, // 0.3 - 1.1
      duration: 15 + Math.random() * 15, // 15s - 30s
      delay: Math.random() * 5
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden z-0">
      {/* 动态渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 animate-gradient-slow" />
      
      {/* 漂浮粒子 */}
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          {...particle}
        />
      ))}
      
      {/* 额外的装饰性光晕 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-200/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute top-[40%] right-[10%] w-[30%] h-[30%] bg-purple-200/20 rounded-full blur-3xl animate-pulse-slow delay-1000" />
        <div className="absolute -bottom-[10%] left-[20%] w-[40%] h-[40%] bg-pink-200/20 rounded-full blur-3xl animate-pulse-slow delay-2000" />
      </div>
    </div>
  );
};

