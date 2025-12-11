import React from 'react';
import Lottie from 'lottie-react';
import loadingAnimation from '../assets/animations/loading-animation.json';

interface LoadingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
}

const Loading: React.FC<LoadingProps> = ({ className = '', size = 'md', text }) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-64 h-64',
    xl: 'w-96 h-96'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]}`}>
        <Lottie animationData={loadingAnimation} loop={true} />
      </div>
      {text && (
        <p className="mt-0 text-gray-500 text-sm font-medium animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
};

export default Loading;
