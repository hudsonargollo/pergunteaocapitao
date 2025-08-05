'use client';

import React from 'react';

interface LoadingMessageProps {
  message?: string;
}

const LoadingMessage: React.FC<LoadingMessageProps> = ({ 
  message = "O Capitão está analisando..." 
}) => {
  return (
    <div className="flex justify-start" role="status" aria-live="polite">
      <div className="chat-message-ai rounded-3xl p-5 card-elevated loading-cave">
        <div className="flex items-center space-x-4">
          {/* Loading Avatar */}
          <div 
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-chat-ai/40 to-chat-ai/20 border-2 border-chat-ai/60 flex items-center justify-center text-lg animate-pulse"
            aria-label="Capitão Caverna está pensando"
          >
            🐺
          </div>
          
          {/* Loading Content */}
          <div className="flex items-center space-x-3">
            {/* Animated Dots */}
            <div className="flex space-x-1" aria-hidden="true">
              <div 
                className="w-2 h-2 bg-cave-ember rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              ></div>
              <div 
                className="w-2 h-2 bg-cave-ember rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              ></div>
              <div 
                className="w-2 h-2 bg-cave-ember rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              ></div>
            </div>
            
            {/* Loading Text */}
            <span 
              className="text-cave-secondary text-sm font-medium"
              aria-label={message}
            >
              {message}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingMessage;