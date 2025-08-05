/**
 * Chat State Manager Component
 * 
 * Manages real-time chat state, dynamic image updates, and conversation flow.
 * This component handles the coordination between API calls, conversation state,
 * and UI updates for a seamless chat experience.
 */

'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import { useApiClient } from '@/app/hooks/useApiClient';
import { useConversation } from '@/app/hooks/useConversation';
import { useCaptainImages } from '@/app/hooks/useCaptainImages';
import type { ChatMessage, ChatResponse } from '@/types';
import type { ApiResponse } from '@/app/lib/api-client';

export interface ChatStateManagerProps {
  conversationId?: string;
  onStateChange?: (state: ChatState) => void;
  onError?: (error: ChatError) => void;
  onImageUpdate?: (imageUrl: string) => void;
  autoImageUpdate?: boolean;
  enableRealTimeUpdates?: boolean;
}

export interface ChatState {
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  currentOperation?: string;
  messageCount: number;
  conversationId?: string;
  lastImageUrl?: string;
  isImageGenerating: boolean;
}

export interface ChatError {
  code: string;
  message: string;
  retryable: boolean;
  timestamp: Date;
}

export interface ChatStateManagerRef {
  sendMessage: (message: string) => Promise<boolean>;
  retryLastMessage: () => Promise<boolean>;
  clearError: () => void;
  getCurrentState: () => ChatState;
  refreshImage: () => Promise<void>;
}

const ChatStateManager: React.ForwardRefRenderFunction<
  ChatStateManagerRef,
  ChatStateManagerProps
> = ({
  conversationId,
  onStateChange,
  onError,
  onImageUpdate,
  autoImageUpdate = true,
  enableRealTimeUpdates = true
}, ref) => {
  
  // Hooks for managing different aspects of chat state
  const apiClient = useApiClient();
  const conversation = useConversation({
    conversationId,
    autoCreateConversation: true
  });
  const captainImages = useCaptainImages({
    initialImage: '/placeholder-captain.svg',
    enableAutoPreload: true
  });

  // Refs for tracking state
  const lastMessageRef = useRef<string>('');
  const stateRef = useRef<ChatState>({
    isLoading: false,
    hasError: false,
    messageCount: 0,
    isImageGenerating: false
  });

  // Update state and notify listeners
  const updateState = useCallback((updates: Partial<ChatState>) => {
    const newState = { ...stateRef.current, ...updates };
    stateRef.current = newState;
    onStateChange?.(newState);
  }, [onStateChange]);

  // Handle API responses
  const handleApiResponse = useCallback(async (
    userMessage: string,
    response: ApiResponse<ChatResponse>
  ) => {
    if (response.success && response.data) {
      // Process successful response
      const { response: aiResponse, imageUrl, conversationId: respConvId } = response.data;
      
      // Add messages to conversation
      conversation.processChatResponse(userMessage, response.data);
      
      // Update captain image if provided and auto-update is enabled
      if (imageUrl && autoImageUpdate) {
        try {
          await captainImages.updateImage(imageUrl, true);
          onImageUpdate?.(imageUrl);
          updateState({ lastImageUrl: imageUrl });
        } catch (imageError) {
          console.warn('Failed to update captain image:', imageError);
        }
      }

      // Update state
      updateState({
        isLoading: false,
        hasError: false,
        errorMessage: undefined,
        currentOperation: undefined,
        conversationId: respConvId,
        messageCount: conversation.messages.length
      });

      return true;
    } else if (response.error) {
      // Handle API error
      const chatError: ChatError = {
        code: response.error.code,
        message: response.error.message,
        retryable: response.error.retryable || false,
        timestamp: new Date()
      };

      onError?.(chatError);
      
      updateState({
        isLoading: false,
        hasError: true,
        errorMessage: chatError.message,
        currentOperation: undefined
      });

      // Add fallback message if available
      if (response.error.fallback?.response) {
        conversation.addAssistantMessage(
          response.error.fallback.response,
          response.error.fallback.imageUrl
        );
      }

      return false;
    }

    return false;
  }, [conversation, captainImages, autoImageUpdate, onImageUpdate, onError, updateState]);

  // Send message function
  const sendMessage = useCallback(async (message: string): Promise<boolean> => {
    if (!message.trim()) return false;

    lastMessageRef.current = message;
    
    updateState({
      isLoading: true,
      hasError: false,
      errorMessage: undefined,
      currentOperation: 'sending-message'
    });

    try {
      // Add user message immediately
      const userMessage = conversation.addUserMessage(message);
      if (!userMessage) {
        throw new Error('Failed to add user message to conversation');
      }

      // Send to API
      const response = await apiClient.sendMessage(
        message,
        conversation.conversation?.id
      );

      return await handleApiResponse(message, response);

    } catch (error) {
      const chatError: ChatError = {
        code: 'SEND_ERROR',
        message: error instanceof Error ? error.message : 'Failed to send message',
        retryable: true,
        timestamp: new Date()
      };

      onError?.(chatError);
      
      updateState({
        isLoading: false,
        hasError: true,
        errorMessage: chatError.message,
        currentOperation: undefined
      });

      return false;
    }
  }, [apiClient, conversation, handleApiResponse, onError, updateState]);

  // Retry last message
  const retryLastMessage = useCallback(async (): Promise<boolean> => {
    if (!lastMessageRef.current) return false;
    return await sendMessage(lastMessageRef.current);
  }, [sendMessage]);

  // Clear error state
  const clearError = useCallback(() => {
    apiClient.clearError();
    updateState({
      hasError: false,
      errorMessage: undefined
    });
  }, [apiClient, updateState]);

  // Get current state
  const getCurrentState = useCallback((): ChatState => {
    return { ...stateRef.current };
  }, []);

  // Refresh captain image
  const refreshImage = useCallback(async () => {
    updateState({ isImageGenerating: true });
    
    try {
      // Get the last assistant message for context
      const lastAssistantMessage = conversation.messages
        .filter(m => m.role === 'assistant')
        .pop();

      if (lastAssistantMessage) {
        // Generate new image based on last response
        const imageResponse = await apiClient.generateImage({
          responseContent: lastAssistantMessage.content,
          tone: 'motivational',
          themes: ['focus', 'strength']
        });

        if (imageResponse.success && imageResponse.data) {
          await captainImages.updateImage(imageResponse.data.imageUrl, true);
          onImageUpdate?.(imageResponse.data.imageUrl);
          updateState({ 
            lastImageUrl: imageResponse.data.imageUrl,
            isImageGenerating: false 
          });
        } else {
          throw new Error('Failed to generate new image');
        }
      }
    } catch (error) {
      console.error('Failed to refresh image:', error);
      updateState({ isImageGenerating: false });
    }
  }, [apiClient, conversation.messages, captainImages, onImageUpdate, updateState]);

  // Expose methods via ref
  React.useImperativeHandle(ref, () => ({
    sendMessage,
    retryLastMessage,
    clearError,
    getCurrentState,
    refreshImage
  }), [sendMessage, retryLastMessage, clearError, getCurrentState, refreshImage]);

  // Monitor API client state changes
  useEffect(() => {
    if (enableRealTimeUpdates) {
      updateState({
        isLoading: apiClient.isLoading,
        currentOperation: apiClient.operation || undefined
      });
    }
  }, [apiClient.isLoading, apiClient.operation, enableRealTimeUpdates, updateState]);

  // Monitor conversation changes
  useEffect(() => {
    if (enableRealTimeUpdates) {
      updateState({
        messageCount: conversation.messages.length,
        conversationId: conversation.conversation?.id
      });
    }
  }, [conversation.messages.length, conversation.conversation?.id, enableRealTimeUpdates, updateState]);

  // Monitor captain image state
  useEffect(() => {
    if (enableRealTimeUpdates) {
      updateState({
        isImageGenerating: captainImages.isGenerating,
        lastImageUrl: captainImages.currentImage
      });
    }
  }, [captainImages.isGenerating, captainImages.currentImage, enableRealTimeUpdates, updateState]);

  // This component doesn't render anything - it's purely for state management
  return null;
};

export default React.forwardRef(ChatStateManager);