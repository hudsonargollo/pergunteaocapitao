'use client';

import React from 'react';
import { getChatMessageClasses, getCaveTextClasses } from '@/app/lib/utils';

interface ChatMessageProps {
  id: string;
  content: string;
  type: 'user' | 'ai';
  timestamp: Date;
  imageUrl?: string;
  error?: boolean;
  isLoading?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  id,
  content,
  type,
  timestamp,
  imageUrl,
  error = false,
  isLoading = false
}) => {
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageIcon = (): string => {
    if (type === 'user') return '⚔️';
    if (error) return '⚠️';
    return '🐺';
  };

  const getAvatarClasses = (): string => {
    const baseClasses = 'w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold border-2 transition-all duration-300';
    
    if (type === 'user') {
      return `${baseClasses} bg-gradient-to-br from-chat-user/40 to-chat-user/20 border-chat-user/50 text-primary-foreground group-hover:border-chat-user/70`;
    }
    
    if (error) {
      return `${baseClasses} bg-gradient-to-br from-destructive/40 to-destructive/20 border-destructive/60 text-destructive-foreground`;
    }
    
    return `${baseClasses} bg-gradient-to-br from-chat-ai/40 to-chat-ai/20 border-chat-ai/60 text-foreground group-hover:border-primary/50`;
  };

  const getMessageContainerClasses = (): string => {
    let classes = 'max-w-[85%] md:max-w-[75%] p-5 rounded-3xl card-elevated hover-cave-lift transition-all duration-300';
    
    if (type === 'user') {
      classes += ' chat-message-user';
    } else if (error) {
      classes += ' chat-message-ai border-destructive/50 bg-destructive/10';
    } else {
      classes += ' chat-message-ai';
    }
    
    if (isLoading) {
      classes += ' loading-cave';
    }
    
    return classes;
  };

  return (
    <div
      className={`flex ${type === 'user' ? 'justify-end' : 'justify-start'} group`}
      role="article"
      aria-label={`Mensagem de ${type === 'user' ? 'usuário' : 'Capitão Caverna'}`}
    >
      <div className={getMessageContainerClasses()}>
        <div className="flex items-start space-x-4">
          {/* Avatar */}
          <div 
            className={getAvatarClasses()}
            aria-label={`Avatar do ${type === 'user' ? 'usuário' : 'Capitão Caverna'}`}
          >
            {getMessageIcon()}
          </div>
          
          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <div 
              className={`leading-relaxed font-medium ${
                type === 'user' ? 'text-cave-primary' : 'text-cave-secondary'
              }`}
              role="text"
              aria-label="Conteúdo da mensagem"
            >
              {content}
            </div>
            
            {/* Message Footer */}
            <div className="flex items-center justify-between mt-4">
              <time 
                className="text-xs text-cave-secondary/70 font-medium"
                dateTime={timestamp.toISOString()}
                aria-label={`Enviado às ${formatTime(timestamp)}`}
              >
                {formatTime(timestamp)}
              </time>
              
              {/* AI Message Indicator */}
              {type === 'ai' && (
                <div 
                  className="flex items-center space-x-1 text-cave-ember text-xs font-semibold"
                  aria-label="Mensagem do Capitão Caverna"
                >
                  <span 
                    className="w-1 h-1 bg-cave-ember rounded-full animate-pulse"
                    aria-hidden="true"
                  ></span>
                  <span>Capitão</span>
                </div>
              )}
              
              {/* Error Indicator */}
              {error && (
                <div 
                  className="flex items-center space-x-1 text-destructive text-xs font-semibold"
                  aria-label="Mensagem com erro"
                >
                  <span 
                    className="w-1 h-1 bg-destructive rounded-full animate-pulse"
                    aria-hidden="true"
                  ></span>
                  <span>Erro</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;