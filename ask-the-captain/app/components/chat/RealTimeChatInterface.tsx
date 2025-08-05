/**
 * Real-Time Chat Interface
 * 
 * Complete implementation of real-time chat functionality that demonstrates:
 * - Real-time message sending and receiving
 * - Dynamic image updates with API responses
 * - Conversation state management
 * - Error handling and retry logic
 * - Loading states and user feedback
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, Plus, RefreshCw, Image, MessageCircle } from 'lucide-react';
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
import type { SessionContextType } from './SessionManager';

interface ChatError {
  message: string;
  type: 'network' | 'api' | 'validation' | 'unknown';
  retryable: boolean;
}

interface RealTimeChatInterfaceProps {
  conversationId?: string;
  onConversationChange?: (conversationId: string | null) => void;
  onMessageSent?: (message: ChatMessage) => void;
  onResponseReceived?: (response: ChatResponse) => void;
  onImageUpdated?: (imageUrl: string) => void;
  enableDebugInfo?: boolean;
  sessionContext?: SessionContextType;
}

const RealTimeChatInterface: React.FC<RealTimeChatInterfaceProps> = ({
  conversationId,
  onConversationChange,
  onMessageSent,
  onResponseReceived,
  onImageUpdated,
  enableDebugInfo = false,
  sessionContext
}) => {
  // State management
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<ChatError | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string>('');
  const [isProcessingMessage, setIsProcessingMessage] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // API Client for backend communication
  const apiClient = useApiClient();

  // Conversation management with real-time updates
  const conversation = useChatConversation({
    conversationId,
    autoCreateConversation: true,
    onMessageAdded: (message) => {
      console.log('Real-time: Message added to conversation:', message);
      if (message.role === 'user') {
        onMessageSent?.(message);
      }
    },
    onConversationChanged: (conv) => {
      console.log('Real-time: Active conversation changed:', conv?.id);
      onConversationChange?.(conv?.id || null);
    }
  });

  // Captain images management with dynamic updates
  const {
    currentImage: captainImage,
    isGenerating: isGeneratingImage,
    updateImage: updateCaptainImage,
    clearError: clearImageError,
    preloadImage
  } = useCaptainImages({
    initialImage: sessionContext?.captainImage || '/placeholder-captain.svg',
    enableAutoPreload: true,
    preloadImages: [
      '/placeholder-captain.svg',
      '/placeholder-captain-response.svg'
    ]
  });

  // Use session captain image if available
  const effectiveCaptainImage = sessionContext?.captainImage || captainImage;

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Real-time message sending with complete flow
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
    setIsProcessingMessage(true);

    // Update session activity
    if (sessionContext) {
      sessionContext.updateLastActivity();
    }

    console.log('Real-time: Starting message send process:', messageToSend);

    try {
      // Step 1: Add user message to conversation immediately for real-time feel
      const userMessage = conversation.addUserMessage(messageToSend);
      if (!userMessage) {
        throw new Error('Failed to add user message to conversation');
      }

      console.log('Real-time: User message added to conversation:', userMessage.id);

      // Step 2: Send message to API
      console.log('Real-time: Sending message to API...');
      const response = await apiClient.sendMessage(
        messageToSend, 
        conversation.conversation?.id
      );

      if (response.success && response.data) {
        console.log('Real-time: API response received:', {
          conversationId: response.data.conversationId,
          hasImage: !!response.data.imageUrl,
          responseLength: response.data.response.length
        });

        // Step 3: Add assistant response to conversation
        const assistantMessage = conversation.addAssistantMessage(
          response.data.response,
          response.data.imageUrl
        );

        console.log('Real-time: Assistant message added to conversation:', assistantMessage?.id);

        // Step 4: Update captain image dynamically if provided
        if (response.data.imageUrl) {
          console.log('Real-time: Updating captain image:', response.data.imageUrl);
          
          // Preload the image first for smooth transition
          await preloadImage(response.data.imageUrl);
          
          // Update through session context if available, otherwise use direct update
          if (sessionContext) {
            await sessionContext.updateCaptainImage(response.data.imageUrl);
          } else {
            await updateCaptainImage(response.data.imageUrl, true);
          }
          
          onImageUpdated?.(response.data.imageUrl);
          console.log('Real-time: Captain image updated successfully');
        }

        // Step 5: Notify parent component
        onResponseReceived?.(response.data);

        console.log('Real-time: Message flow completed successfully');

      } else if (response.error) {
        console.error('Real-time: API error received:', response.error);
        handleApiError(response.error);
        
        // Add error message to conversation for user feedback
        conversation.addAssistantMessage(
          response.error.fallback?.response || 
          'Guerreiro, houve um problema na comunicação. Mas um verdadeiro guerreiro não desiste. Tente novamente - a caverna está esperando por você.',
          response.error.fallback?.imageUrl
        );
      }

    } catch (err) {
      console.error('Real-time: Unexpected error during message send:', err);
      
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
    } finally {
      setIsProcessingMessage(false);
    }
  }, [
    inputValue, 
    conversation, 
    apiClient, 
    updateCaptainImage, 
    preloadImage,
    onResponseReceived, 
    onImageUpdated
  ]);

  // Handle API errors with detailed feedback
  const handleApiError = useCallback((apiError: ApiError) => {
    const chatError: ChatError = {
      message: apiError.message || 'Erro na comunicação com o Capitão',
      type: mapApiErrorType(apiError.code),
      retryable: apiError.retryable || false
    };

    setError(chatError);
    console.error('Real-time: Chat error set:', chatError);
  }, []);

  // Retry last message with full flow
  const handleRetry = useCallback(async () => {
    console.log('Real-time: Retrying last message:', lastUserMessage);
    
    setError(null);
    apiClient.clearError();
    
    if (lastUserMessage) {
      setInputValue(lastUserMessage);
      // Focus input for immediate retry
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
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

  // Generate new captain image manually
  const handleGenerateNewImage = useCallback(async () => {
    console.log('Real-time: Manually generating new captain image');
    
    try {
      // Get the last assistant message for context
      const lastAssistantMessage = conversation.messages
        .filter(m => m.role === 'assistant')
        .pop();

      if (lastAssistantMessage) {
        const imageResponse = await apiClient.generateImage({
          responseContent: lastAssistantMessage.content,
          tone: 'motivational',
          themes: ['focus', 'strength', 'determination']
        });

        if (imageResponse.success && imageResponse.data) {
          await updateCaptainImage(imageResponse.data.imageUrl, true);
          onImageUpdated?.(imageResponse.data.imageUrl);
          console.log('Real-time: New captain image generated successfully');
        }
      }
    } catch (error) {
      console.error('Real-time: Failed to generate new image:', error);
    }
  }, [conversation.messages, apiClient, updateCaptainImage, onImageUpdated]);

  // Handle welcome screen conversation start
  const handleStartConversation = useCallback(() => {
    console.log('Real-time: Starting conversation from welcome screen');
    
    // Use session manager if available, otherwise fallback to conversation manager
    if (sessionContext) {
      sessionContext.startConversation();
      sessionContext.updateLastActivity();
    } else if (!conversation.conversation) {
      conversation.createConversation();
    }
    
    // Focus the input field
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [conversation, sessionContext]);

  // Handle quick start from welcome screen
  const handleQuickStart = useCallback(async (message: string) => {
    console.log('Real-time: Quick start with message:', message);
    
    // Set the input value
    setInputValue(message);
    
    // Create conversation if it doesn't exist
    if (sessionContext) {
      sessionContext.startConversation();
      sessionContext.updateLastActivity();
    } else if (!conversation.conversation) {
      conversation.createConversation();
    }
    
    // Wait a moment then send the message
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  }, [conversation, sessionContext, handleSendMessage]);

  const isLoading = apiClient.isLoading || conversation.isWaitingForResponse || isProcessingMessage;

  return (
    <div className="min-h-screen p-4 md:p-6 flex flex-col max-w-6xl mx-auto cave-lighting">
      {/* Header with Captain and Real-time Status */}
      <div className="glass-medium rounded-3xl p-8 mb-6 text-center card-elevated hover-cave-glow">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          {/* Captain Image Display with Real-time Updates */}
          <div className="relative">
            <CaptainImage
              imageUrl={effectiveCaptainImage}
              isGenerating={isGeneratingImage}
              size="md"
              onImageLoad={() => {
                console.log('Real-time: Captain image loaded successfully');
                clearImageError();
              }}
              onImageError={(error) => {
                console.error('Real-time: Captain image error:', error);
                setError({
                  message: 'Falha ao carregar imagem do Capitão',
                  type: 'network',
                  retryable: true
                });
              }}
              fallbackImage="/placeholder-captain.svg"
              alt="Capitão Caverna - Seu mentor no Modo Caverna"
            />
            
            {/* Manual image generation button */}
            <Button
              onClick={handleGenerateNewImage}
              variant="cave"
              size="sm"
              className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0"
              disabled={isGeneratingImage}
              title="Gerar nova imagem do Capitão"
            >
              <Image className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Title and Real-time Status */}
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
            
            {/* Real-time Status Indicators */}
            <div className="mt-4 flex items-center justify-center md:justify-start gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className="text-cave-secondary/70">
                  {isLoading ? 'Processando...' : 'Conectado'}
                </span>
              </div>
              
              {conversation.conversation && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-3 h-3 text-cave-secondary/70" />
                  <span className="text-cave-secondary/70">
                    {conversation.conversationStats.totalMessages} mensagens
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages with Real-time Updates */}
      <div className="flex-1 glass-border rounded-3xl overflow-hidden mb-6 card-elevated hover-cave-glow">
        <div className="glass-subtle h-full">
          <MessageList 
            messages={convertMessagesToDisplayFormat(conversation.messages)}
            isLoading={isLoading}
            loadingMessage={
              isProcessingMessage ? "O Capitão está analisando sua mensagem..." :
              isGeneratingImage ? "Gerando nova imagem do Capitão..." :
              "O Capitão está respondendo..."
            }
            onStartConversation={handleStartConversation}
            onQuickStart={handleQuickStart}
            captainImageUrl={effectiveCaptainImage}
          />
          
          {/* Error Display */}
          {error && (
            <ErrorMessage error={error} onRetry={handleRetry} />
          )}
        </div>
      </div>

      {/* Input Area with Real-time Feedback */}
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
                placeholder={
                  isLoading ? "Aguarde a resposta do Capitão..." : 
                  "Pergunte ao Capitão Caverna..."
                }
                className="input-cave border-0 bg-transparent text-cave-primary placeholder:text-cave-secondary/70 focus-visible:ring-0 text-lg h-12 px-6 font-medium focus-cave-strong"
                disabled={isLoading}
                aria-label="Campo de mensagem para o Capitão Caverna"
                maxLength={1000}
              />
              
              {/* Character count */}
              <div className="absolute right-16 top-1/2 transform -translate-y-1/2 text-xs text-cave-secondary/50">
                {inputValue.length}/1000
              </div>
              
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
                className={`rounded-full w-12 h-12 hover:scale-110 disabled:opacity-50 disabled:scale-100 shadow-glow hover:shadow-glow-strong focus-cave-strong transition-all duration-300 ${
                  isLoading ? 'animate-pulse' : ''
                }`}
                aria-label="Enviar mensagem para o Capitão"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Information (development only) */}
      {enableDebugInfo && process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-4 glass-subtle rounded-lg text-xs text-cave-secondary/70 space-y-2">
          <h3 className="font-semibold text-cave-accent">Real-time Debug Info</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p><strong>API Status:</strong></p>
              <p>Loading: {apiClient.isLoading ? 'Yes' : 'No'}</p>
              <p>Operation: {apiClient.operation || 'None'}</p>
              <p>Last Error: {apiClient.lastError?.code || 'None'}</p>
            </div>
            <div>
              <p><strong>Conversation:</strong></p>
              <p>ID: {conversation.conversation?.id || 'None'}</p>
              <p>Messages: {conversation.messages.length}</p>
              <p>Active: {conversation.isActive ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p><strong>Images:</strong></p>
              <p>Current: {effectiveCaptainImage}</p>
              <p>Generating: {isGeneratingImage ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p><strong>State:</strong></p>
              <p>Processing: {isProcessingMessage ? 'Yes' : 'No'}</p>
              <p>Input Length: {inputValue.length}</p>
              <p>Has Error: {error ? 'Yes' : 'No'}</p>
            </div>
            {sessionContext?.session && (
              <div>
                <p><strong>Session:</strong></p>
                <p>ID: {sessionContext.session.id.split('_')[1]}</p>
                <p>Active: {sessionContext.session.isActive ? 'Yes' : 'No'}</p>
                <p>Messages: {sessionContext.session.messageCount}</p>
                <p>Initializing: {sessionContext.isInitializing ? 'Yes' : 'No'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeChatInterface;