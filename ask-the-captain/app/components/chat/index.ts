// Chat Components Export
export { default as ChatInterface } from './ChatInterface';
export { default as IntegratedChatInterface } from './IntegratedChatInterface';
export { default as RealTimeChatInterface } from './RealTimeChatInterface';
export { default as ChatStateManager } from './ChatStateManager';
export { default as ChatMessage } from './ChatMessage';
export { default as MessageList } from './MessageList';
export { default as LoadingMessage } from './LoadingMessage';
export { default as WelcomeMessage } from './WelcomeMessage';
export { default as ErrorMessage } from './ErrorMessage';
export { default as CaptainImage } from './CaptainImage';
export { default as CaptainImageLoader } from './CaptainImageLoader';

// Types
export interface Message {
  id: string;
  content: string;
  type: 'user' | 'ai';
  timestamp: Date;
  imageUrl?: string;
  error?: boolean;
}

export interface ChatError {
  message: string;
  type: 'network' | 'api' | 'validation' | 'unknown';
  retryable: boolean;
}