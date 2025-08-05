/**
 * Integrated Chat Interface
 * 
 * Complete chat interface that integrates:
 * - API client for backend communication
 * - Conversation management for state
 * - Dynamic image updates
 * - Real-time message flow
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import MessageList from './MessageList';
import ErrorMessage from './ErrorMessage';
import CaptainImage from './CaptainImage';
import { useCaptainImages } from '@/app/hooks/useCaptainImages';
import { useApiClient } from '@/app/hooks/useApiClient';
import { useChatConversation } from '@/app/hooks/useConversation';
import type { ChatMessage, ChatResponse } from '@/types';
import type { ApiError } from '@/app/lib/api-client';

interface ChatError {
  message: string;
  type: 'network' | 'api' | 'validation' | 'unknown';
  retryable: boolean;
}

interface IntegratedChatInterfaceProps {
  conversationId?: string;
  onConversationChange?: (conversationId: string | null) => void;
  onMessageSent?: (message: ChatMessage) => void;
  onResponseReceived?: (response: ChatResponse) => void;
}

const IntegratedChatInterface: React.FC<IntegratedChatInterfaceProps> = ({
  conversationId,
  onConversationChange,
  onMessageSent,
  onResponseReceived
}) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<ChatError | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // API Client for backend communication
  const apiClient = useApiClient();

  // Conversation management
  const conversation = useChatConversation({
    conversationId,
    autoCreateConversation: true,
    onMessageAdded: (message) => {
      console.log('Message added to conversation:', message);
      if (message.role === 'user') {
        onMessageSent?.(message);
      }
    },
    onConversationChanged: (conv) => {
      console.log('Active conversation changed:', conv?.id);
      onConversationChange?.(conv?.id || null);
    }
  });

  // Captain images management
  const {
    currentImage: captainImage,
    isGenerating: isGeneratingImage,
    updateImage: updateCaptainImage,
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

  // Handle sending messages
  const handleSendMessage = useCallback(async () => {
    if (!validateInput(inputValue)) {
      setError({
        message: 'Guerreiro, sua mensagem precisa ter conteúdo válido (máximo 1000 caracteres)',
        type: 'validation',
        retryable: false
      });
      return;
    }

    const messageToSend = inputValue.trim();
    setLastUserMessage(messageToSend);
    setInputValue('');
    setError(null);

    // Add user message to conversation immediately
    const userMessage = conversation.addUserMessage(messageToSend);
    if (!userMessage) {
      setError({
        message: 'Erro ao adicionar mensagem à conversa',
        type: 'unknown',
        retryable: true
      });
      return;
    }

    try {
      // Send message to API
      const response = await apiClient.sendMessage(
        messageToSend, 
        conversation.conversation?.id
      );

      if (response.success && response.data) {
        // Add assistant response to conversation
        const assistantMessage = conversation.addAssistantMessage(
          response.data.response,
          response.data.imageUrl
        );

        // Update captain image if provided
        if (response.data.imageUrl) {
          await updateCaptainImage(response.data.imageUrl, true);
        }

        // Notify parent component
        onResponseReceived?.(response.data);

        console.log('Chat response processed successfully:', {
          conversationId: response.data.conversationId,
          hasImage: !!response.data.imageUrl,
          responseLength: response.data.response.length
        });

      } else if (response.error) {
        // Handle API error
        handleApiError(response.error);
        
        // Add error message to conversation
        conversation.addAssistantMessage(
          'Guerreiro, houve um problema na comunicação. Mas um verdadeiro guerreiro não desiste. Tente novamente - a caverna está esperando por você.',
          undefined
        );
      }

    } catch (err) {
      console.error('Unexpected error during message send:', err);
      
      setError({
        message: 'Erro inesperado na comunicação',
        type: 'unknown',
        retryable: true
      });

      // Add error message to conversation
      conversation.addAssistantMessage(
        'Guerreiro, algo inesperado aconteceu. Recarregue suas forças e tente novamente.',
        undefined
      );
    }
  }, [inputValue, conversation, apiClient, updateCaptainImage, onResponseReceived]);

  // Handle API errors
  const handleApiError = useCallback((apiError: ApiError) => {
    const chatError: ChatError = {
      message: apiError.message || 'Erro na comunicação com o Capitão',
      type: mapApiErrorType(apiError.code),
      retryable: apiError.retryable || false
    };

    setError(chatError);

    // Use fallback response if available
    if (apiError.fallback?.response) {
      conversation.addAssistantMessage(
        apiError.fallback.response,
        apiError.fallback.imageUrl
      );
    }
  }, [conversation]);

  // Retry last message
  const handleRetry = useCallback(() => {
    setError(null);
    apiClient.clearError();
    
    if (lastUserMessage) {
      setInputValue(lastUserMessage);
      // Focus input for immediate retry
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [lastUserMessage, apiClient]);

  // Handle keyboard input
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Input validation
  const validateInput = (input: string): boolean => {
    if (!input.trim()) return false;
    if (input.length > 1000) return false;
    return true;
  };

  // Map API error codes to chat error types
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

  // Convert ChatMessage to display format
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

  const isLoading = apiClient.isLoading || conversation.isWaitingForResponse;

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
            
            {/* Conversation Info */}
            {conversation.conversation && (
              <div className="mt-4 text-xs text-cave-secondary/70">
                <p>Conversa: {conversation.conversationTitle}</p>
                <p>Mensagens: {conversation.conversationStats.totalMessages}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 glass-border rounded-3xl overflow-hidden mb-6 card-elevated hover-cave-glow">
        <div className="glass-subtle h-full">
          <MessageList 
            messages={convertMessagesToDisplayFormat(conversation.messages)}
            isLoading={isLoading}
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
              disabled={isLoading}
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
                disabled={isLoading}
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
                  disabled={isLoading}
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
                disabled={!inputValue.trim() || isLoading}
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

      {/* Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-4 glass-subtle rounded-lg text-xs text-cave-secondary/70">
          <p>API Loading: {apiClient.isLoading ? 'Yes' : 'No'}</p>
          <p>Operation: {apiClient.operation || 'None'}</p>
          <p>Conversation ID: {conversation.conversation?.id || 'None'}</p>
          <p>Messages: {conversation.messages.length}</p>
          <p>Last Error: {apiClient.lastError?.code || 'None'}</p>
        </div>
      )}
    </div>
  );
};

export default IntegratedChatInterface;