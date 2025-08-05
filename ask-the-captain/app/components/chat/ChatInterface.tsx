'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import MessageList from './MessageList';
import ErrorMessage from './ErrorMessage';
import CaptainImage from './CaptainImage';
import { useCaptainImages } from '@/app/hooks/useCaptainImages';
import { useChatApi } from '@/app/hooks/useApiClient';
import { useChatConversation } from '@/app/hooks/useConversation';
import type { ChatMessage } from '@/types';

interface ChatError {
  message: string;
  type: 'network' | 'api' | 'validation' | 'unknown';
  retryable: boolean;
}

const ChatInterface = () => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<ChatError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Use conversation management
  const conversation = useChatConversation({
    autoCreateConversation: true,
    onMessageAdded: (message) => {
      console.log('New message added:', message);
    },
    onConversationChanged: (conv) => {
      console.log('Conversation changed:', conv?.id);
    }
  });

  // Use API client for chat functionality
  const chatApi = useChatApi({
    onMessageSent: (response) => {
      if (response.success && response.data) {
        // Process the chat response and add to conversation
        conversation.processChatResponse(inputValue, response.data);
        
        // Update captain image if provided
        if (response.data.imageUrl) {
          updateCaptainImage(response.data.imageUrl, true);
        }
      }
    },
    onError: (apiError) => {
      setError({
        message: apiError.message || 'Erro na comunicação com o Capitão',
        type: mapApiErrorType(apiError.code),
        retryable: apiError.retryable || false
      });
    }
  });
  
  // Use Captain images hook for enhanced image management
  const {
    currentImage: captainImage,
    isGenerating: isGeneratingImage,
    updateImage: updateCaptainImage,
    preloadImage,
    clearError: clearImageError
  } = useCaptainImages({
    initialImage: '/placeholder-captain.svg',
    enableAutoPreload: true,
    preloadImages: [
      '/placeholder-captain.svg',
      '/placeholder-captain-response.svg'
    ]
  });

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async () => {
    if (!validateInput(inputValue)) {
      setError({
        message: 'Guerreiro, sua mensagem precisa ter conteúdo válido (máximo 1000 caracteres)',
        type: 'validation',
        retryable: false
      });
      return;
    }

    const messageToSend = inputValue.trim();
    setInputValue('');
    setError(null);

    try {
      // Send message via API client
      await chatApi.sendMessage(messageToSend, conversation.conversation?.id);
    } catch (err) {
      // Error handling is done in the chatApi onError callback
      console.error('Failed to send message:', err);
    }
  };

  const handleRetry = () => {
    setError(null);
    chatApi.clearError();
    
    // Retry with the last user message if available
    const lastUserMessage = conversation.lastUserMessage;
    if (lastUserMessage) {
      setInputValue(lastUserMessage.content);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const validateInput = (input: string): boolean => {
    if (!input.trim()) return false;
    if (input.length > 1000) return false;
    return true;
  };

  const mapApiErrorType = (errorCode: string): ChatError['type'] => {
    switch (errorCode) {
      case 'NETWORK_ERROR':
      case 'REQUEST_ABORTED':
        return 'network';
      case 'VALIDATION_ERROR':
        return 'validation';
      case 'INTERNAL_ERROR':
      case 'IMAGE_GENERATION_FAILED':
      case 'STORAGE_FAILED':
        return 'api';
      default:
        return 'unknown';
    }
  };

  // Convert ChatMessage to the format expected by MessageList
  const convertMessagesToDisplayFormat = (messages: ChatMessage[]) => {
    return messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      type: msg.role === 'user' ? 'user' as const : 'ai' as const,
      timestamp: msg.timestamp,
      imageUrl: msg.imageUrl,
      error: false
    }));
  };

  return (
    <div className="min-h-screen p-4 md:p-6 flex flex-col max-w-6xl mx-auto cave-lighting">
      {/* Header with Captain and Modo Caverna Branding */}
      <div className="glass-medium rounded-3xl p-8 mb-6 text-center card-elevated hover-cave-glow">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          {/* Captain Image Display */}
          <CaptainImage
            imageUrl={captainImage}
            isGenerating={isGeneratingImage}
            size="md"
            onImageLoad={() => {
              console.log('Captain image loaded successfully');
              clearImageError();
            }}
            onImageError={(error) => {
              console.error('Captain image error:', error);
              setError({
                message: 'Falha ao carregar imagem do Capitão',
                type: 'network',
                retryable: true
              });
            }}
            fallbackImage="/placeholder-captain.svg"
            alt="Capitão Caverna - Seu mentor no Modo Caverna"
          />
          
          {/* Title and Description */}
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-cave-accent mb-3 animate-ember-flicker">
              Capitão Caverna
            </h1>
            <p className="text-cave-secondary text-lg md:text-xl mb-3 font-medium">
              Seu mentor implacável no Modo Caverna
            </p>
            <div className="divider-cave mb-3"></div>
            <p className="text-cave-ember text-sm font-semibold tracking-wider">
              PROPÓSITO → FOCO → PROGRESSO
            </p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 glass-border rounded-3xl overflow-hidden mb-6 card-elevated hover-cave-glow">
        <div className="glass-subtle h-full">
          <MessageList 
            messages={convertMessagesToDisplayFormat(conversation.messages)}
            isLoading={chatApi.isLoading || conversation.isWaitingForResponse}
            loadingMessage="O Capitão está analisando..."
          />
          
          {/* Error Display */}
          {error && (
            <ErrorMessage error={error} onRetry={handleRetry} />
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="glass-border rounded-full card-elevated hover-cave-glow">
        <div className="glass-intense p-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="cave"
              size="icon"
              className="rounded-full w-12 h-12 hover-cave-lift focus-cave-strong"
              aria-label="Opções adicionais"
            >
              <Plus className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Pergunte ao Capitão Caverna..."
                className="input-cave border-0 bg-transparent text-cave-primary placeholder:text-cave-secondary/70 focus-visible:ring-0 text-lg h-12 px-6 font-medium focus-cave-strong"
                disabled={chatApi.isLoading || conversation.isWaitingForResponse}
                aria-label="Campo de mensagem para o Capitão Caverna"
                maxLength={1000}
              />
              {error && error.retryable && (
                <Button
                  onClick={handleRetry}
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-cave-ember hover:text-primary"
                  aria-label="Tentar novamente"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <Button
                variant="cave"
                size="icon"
                className="rounded-full w-12 h-12 hover-cave-lift focus-cave-strong"
                aria-label="Gravação de voz (em breve)"
                disabled
              >
                <Mic className="h-5 w-5" />
              </Button>
              
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || chatApi.isLoading || conversation.isWaitingForResponse}
                size="icon"
                variant="default"
                className="rounded-full w-12 h-12 hover:scale-110 disabled:opacity-50 disabled:scale-100 shadow-glow hover:shadow-glow-strong focus-cave-strong transition-all duration-300"
                aria-label="Enviar mensagem para o Capitão"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;