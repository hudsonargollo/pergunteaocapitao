/**
 * Frontend-Backend Integration Tests
 * 
 * Tests the complete integration between frontend components and backend APIs
 * including API client, conversation management, and real-time updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ApiClient } from '../api-client';
import { ConversationManager } from '../conversation-manager';
import { useApiClient } from '../../hooks/useApiClient';
import { useConversation } from '../../hooks/useConversation';
import type { ChatResponse, ChatMessage } from '@/types';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Frontend-Backend Integration', () => {
  let apiClient: ApiClient;
  let conversationManager: ConversationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient = new ApiClient({ enableLogging: false });
    conversationManager = new ConversationManager({
      persistToStorage: false,
      autoCleanup: false
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Client Integration', () => {
    it('should send chat message and handle response', async () => {
      const mockResponse: ChatResponse = {
        response: 'Guerreiro, esta é a resposta do Capitão!',
        imageUrl: 'https://example.com/captain-image.png',
        conversationId: 'conv_123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([
          ['X-Processing-Time', '1500'],
          ['X-Search-Results', '3']
        ])
      });

      const response = await apiClient.sendChatMessage('Olá, Capitão!');

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResponse);
      expect(response.metadata?.processingTime).toBe(1500);
      expect(response.metadata?.searchResults).toBe(3);
    });

    it('should handle API errors with fallback', async () => {
      const mockErrorResponse = {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor',
          timestamp: new Date().toISOString()
        },
        fallback: {
          response: 'Guerreiro, houve um problema técnico. Tente novamente.',
          imageUrl: '/placeholder-captain.svg'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => mockErrorResponse
      });

      const response = await apiClient.sendChatMessage('Teste de erro');

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('INTERNAL_ERROR');
      expect(response.error?.fallback?.response).toBe(mockErrorResponse.fallback.response);
    });

    it('should retry failed requests with exponential backoff', async () => {
      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: 'Sucesso após retry',
            imageUrl: '',
            conversationId: 'conv_retry'
          })
        });

      const startTime = Date.now();
      const response = await apiClient.sendChatMessage('Teste retry');
      const endTime = Date.now();

      expect(response.success).toBe(true);
      expect(response.data?.response).toBe('Sucesso após retry');
      // Should have taken some time due to retries
      expect(endTime - startTime).toBeGreaterThan(1000);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Conversation Management Integration', () => {
    it('should create conversation and manage messages', () => {
      const conversation = conversationManager.createConversation();
      
      expect(conversation.id).toBeDefined();
      expect(conversation.messages).toHaveLength(0);
      expect(conversation.isActive).toBe(true);

      // Add user message
      const userMessage = conversationManager.addUserMessage(
        conversation.id,
        'Olá, Capitão!'
      );

      expect(userMessage).toBeDefined();
      expect(userMessage?.role).toBe('user');
      expect(userMessage?.content).toBe('Olá, Capitão!');

      // Add assistant message with image
      const assistantMessage = conversationManager.addAssistantMessage(
        conversation.id,
        'Guerreiro, bem-vindo à caverna!',
        'https://example.com/captain.png'
      );

      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.role).toBe('assistant');
      expect(assistantMessage?.imageUrl).toBe('https://example.com/captain.png');

      // Check conversation state
      const updatedConversation = conversationManager.getConversation(conversation.id);
      expect(updatedConversation?.messages).toHaveLength(2);
    });

    it('should process chat response correctly', () => {
      const conversation = conversationManager.createConversation();
      const userMessage = 'Como posso melhorar meu foco?';
      const chatResponse: ChatResponse = {
        response: 'Guerreiro, o foco vem da disciplina diária.',
        imageUrl: 'https://example.com/focused-captain.png',
        conversationId: conversation.id
      };

      const result = conversationManager.processChatResponse(
        conversation.id,
        userMessage,
        chatResponse
      );

      expect(result.userMsg).toBeDefined();
      expect(result.assistantMsg).toBeDefined();
      expect(result.userMsg?.content).toBe(userMessage);
      expect(result.assistantMsg?.content).toBe(chatResponse.response);
      expect(result.assistantMsg?.imageUrl).toBe(chatResponse.imageUrl);

      const updatedConversation = conversationManager.getConversation(conversation.id);
      expect(updatedConversation?.messages).toHaveLength(2);
    });
  });

  describe('React Hooks Integration', () => {
    it('should integrate API client with React hooks', async () => {
      const { result } = renderHook(() => useApiClient());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.operation).toBeNull();

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Hook test response',
          imageUrl: '',
          conversationId: 'conv_hook'
        })
      });

      let apiResponse;
      await act(async () => {
        apiResponse = await result.current.sendMessage('Test message');
      });

      expect(apiResponse.success).toBe(true);
      expect(apiResponse.data?.response).toBe('Hook test response');
    });

    it('should integrate conversation management with React hooks', async () => {
      const { result } = renderHook(() => useConversation({
        manager: conversationManager,
        autoCreateConversation: true
      }));

      await waitFor(() => {
        expect(result.current.conversation).toBeDefined();
      });

      expect(result.current.messages).toHaveLength(0);
      expect(result.current.isActive).toBe(true);

      // Add a message
      act(() => {
        result.current.addUserMessage('Test message from hook');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Test message from hook');
      expect(result.current.messages[0].role).toBe('user');
    });
  });

  describe('End-to-End Chat Flow', () => {
    it('should complete full chat flow from user input to response', async () => {
      // Setup
      const { result: conversationHook } = renderHook(() => useConversation({
        manager: conversationManager,
        autoCreateConversation: true
      }));

      const { result: apiHook } = renderHook(() => useApiClient());

      await waitFor(() => {
        expect(conversationHook.current.conversation).toBeDefined();
      });

      // Mock API response
      const mockChatResponse: ChatResponse = {
        response: 'Guerreiro, você está no caminho certo! Continue focado.',
        imageUrl: 'https://example.com/motivational-captain.png',
        conversationId: conversationHook.current.conversation!.id
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockChatResponse,
        headers: new Map([['X-Processing-Time', '2000']])
      });

      // Simulate user sending message
      const userMessage = 'Estou lutando para manter o foco';
      
      // Add user message to conversation
      act(() => {
        conversationHook.current.addUserMessage(userMessage);
      });

      expect(conversationHook.current.messages).toHaveLength(1);
      expect(conversationHook.current.messages[0].role).toBe('user');

      // Send to API
      let apiResponse;
      await act(async () => {
        apiResponse = await apiHook.current.sendMessage(
          userMessage,
          conversationHook.current.conversation!.id
        );
      });

      expect(apiResponse.success).toBe(true);

      // Process response in conversation
      act(() => {
        conversationHook.current.processChatResponse(userMessage, mockChatResponse);
      });

      // Verify final state
      expect(conversationHook.current.messages).toHaveLength(2);
      expect(conversationHook.current.messages[1].role).toBe('assistant');
      expect(conversationHook.current.messages[1].content).toBe(mockChatResponse.response);
      expect(conversationHook.current.messages[1].imageUrl).toBe(mockChatResponse.imageUrl);
    });

    it('should handle errors gracefully in full flow', async () => {
      const { result: conversationHook } = renderHook(() => useConversation({
        manager: conversationManager,
        autoCreateConversation: true
      }));

      const { result: apiHook } = renderHook(() => useApiClient());

      await waitFor(() => {
        expect(conversationHook.current.conversation).toBeDefined();
      });

      // Mock API error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Erro interno',
            timestamp: new Date().toISOString()
          },
          fallback: {
            response: 'Guerreiro, houve um problema. Tente novamente.'
          }
        })
      });

      // Send message that will fail
      let apiResponse;
      await act(async () => {
        apiResponse = await apiHook.current.sendMessage(
          'Mensagem que vai falhar',
          conversationHook.current.conversation!.id
        );
      });

      expect(apiResponse.success).toBe(false);
      expect(apiResponse.error?.code).toBe('INTERNAL_ERROR');
      expect(apiResponse.error?.fallback?.response).toBeDefined();

      // Verify error handling doesn't break conversation state
      expect(conversationHook.current.conversation).toBeDefined();
      expect(conversationHook.current.conversation!.isActive).toBe(true);
    });
  });

  describe('Real-time Updates', () => {
    it('should handle loading states correctly', async () => {
      const { result } = renderHook(() => useApiClient());

      expect(result.current.isLoading).toBe(false);

      // Mock slow API response
      let resolvePromise: (value: any) => void;
      const slowPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(slowPromise);

      // Start API call
      const messagePromise = act(async () => {
        return result.current.sendMessage('Slow message');
      });

      // Should be loading now
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
        expect(result.current.operation).toBe('chat');
      });

      // Resolve the API call
      resolvePromise!({
        ok: true,
        json: async () => ({
          response: 'Slow response',
          imageUrl: '',
          conversationId: 'conv_slow'
        })
      });

      await messagePromise;

      // Should not be loading anymore
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.operation).toBeNull();
      });
    });
  });
});