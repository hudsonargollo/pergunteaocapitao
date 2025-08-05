'use client';

import React, { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import LoadingMessage from './LoadingMessage';
import WelcomeMessage from './WelcomeMessage';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'ai';
  timestamp: Date;
  imageUrl?: string;
  error?: boolean;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  loadingMessage?: string;
  onStartConversation?: () => void;
  onQuickStart?: (message: string) => void;
  captainImageUrl?: string;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  loadingMessage,
  onStartConversation,
  onQuickStart,
  captainImageUrl
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div 
      className="h-full overflow-y-auto p-6 space-y-6 min-h-[400px] scrollbar-thin scrollbar-track-glass scrollbar-thumb-glass-border"
      role="log"
      aria-live="polite"
      aria-label="Lista de mensagens da conversa"
    >
      {/* Welcome Message - shown when no messages */}
      {messages.length === 0 && !isLoading && (
        <WelcomeMessage 
          onStartConversation={onStartConversation}
          onQuickStart={onQuickStart}
          captainImageUrl={captainImageUrl}
        />
      )}
      
      {/* Message List */}
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          id={message.id}
          content={message.content}
          type={message.type}
          timestamp={message.timestamp}
          imageUrl={message.imageUrl}
          error={message.error}
        />
      ))}
      
      {/* Loading Message */}
      {isLoading && (
        <LoadingMessage message={loadingMessage} />
      )}
      
      {/* Scroll Anchor */}
      <div 
        ref={messagesEndRef} 
        aria-hidden="true"
        className="h-1"
      />
    </div>
  );
};

export default MessageList;