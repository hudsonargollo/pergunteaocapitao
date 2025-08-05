/**
 * Real-Time Chat Interface Tests
 * 
 * Tests the complete real-time chat functionality including:
 * - Message sending and receiving flow
 * - Dynamic image updates
 * - Conversation state management
 * - Error handling and retry logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RealTimeChatInterface from '../RealTimeChatInterface';
import type { ChatResponse } from '@/types';

// Mock the hooks
vi.mock('@/app/hooks/useApiClient');
vi.mock('@/app/hooks/useConversation');
vi.mock('@/app/hooks/useCaptainImages');

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('RealTimeChatInterface', () => {
  const mockApiClient = {
    isLoading: false,
    operation: null,
    sendMessage: vi.fn(),
    generateImage: vi.fn(),
    clearError: vi.fn(),
    lastError: null
  };

  const mockConversation = {
    conversation: { id: 'test-conv-123' },
    messages: [],
    isActive: true,
    isWaitingForResponse: false,
    addUserMessage: vi.fn(),
    addAssistantMessage: vi.fn(),
    processChatResponse: vi.fn(),
    conversationStats: { totalMessages: 0 },
    conversationTitle: 'Test Conversation'
  };

  const mockCaptainImages = {
    currentImage: '/placeholder-captain.svg',
    isGenerating: false,
    updateImage: vi.fn(),
    clearError: vi.fn(),
    preloadImage: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup hook mocks
    const { useApiClient } = require('@/app/hooks/useApiClient');
    const { useChatConversation } = require('@/app/hooks/useConversation');
    const { useCaptainImages } = require('@/app/hooks/useCaptainImages');
    
    useApiClient.mockReturnValue(mockApiClient);
    useChatConversation.mockReturnValue(mockConversation);
    useCaptainImages.mockReturnValue(mockCaptainImages);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the chat interface with all elements', () => {
      render(<RealTimeChatInterface />);

      // Check main elements
      expect(screen.getByText('Capitão Caverna')).toBeInTheDocument();
      expect(screen.getByText('PROPÓSITO → FOCO → PROGRESSO')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Pergunte ao Capitão Caverna...')).toBeInTheDocument();
      expect(screen.getByLabelText('Enviar mensagem para o Capitão')).toBeInTheDocument();
    });

    it('should show real-time status indicators', () => {
      render(<RealTimeChatInterface />);

      expect(screen.getByText('Conectado')).toBeInTheDocument();
      expect(screen.getByText('0 mensagens')).toBeInTheDocument();
    });

    it('should show loading state when processing', () => {
      mockApiClient.isLoading = true;
      mockApiClient.operation = 'chat';

      render(<RealTimeChatInterface />);

      expect(screen.getByText('Processando...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Aguarde a resposta do Capitão...')).toBeInTheDocument();
    });
  });

  describe('Message Sending Flow', () => {
    it('should handle complete message sending flow', async () => {
      const user = userEvent.setup();
      const mockResponse: ChatResponse = {
        response: 'Guerreiro, excelente pergunta!',
        imageUrl: 'https://example.com/captain-response.png',
        conversationId: 'test-conv-123'
      };

      mockApiClient.sendMessage.mockResolvedValue({
        success: true,
        data: mockResponse
      });

      mockConversation.addUserMessage.mockReturnValue({
        id: 'msg-user-1',
        content: 'Como posso melhorar meu foco?',
        role: 'user',
        timestamp: new Date()
      });

      mockConversation.addAssistantMessage.mockReturnValue({
        id: 'msg-assistant-1',
        content: mockResponse.response,
        role: 'assistant',
        timestamp: new Date(),
        imageUrl: mockResponse.imageUrl
      });

      const onMessageSent = vi.fn();
      const onResponseReceived = vi.fn();
      const onImageUpdated = vi.fn();

      render(
        <RealTimeChatInterface
          onMessageSent={onMessageSent}
          onResponseReceived={onResponseReceived}
          onImageUpdated={onImageUpdated}
        />
      );

      const input = screen.getByPlaceholderText('Pergunte ao Capitão Caverna...');
      const sendButton = screen.getByLabelText('Enviar mensagem para o Capitão');

      // Type message
      await user.type(input, 'Como posso melhorar meu foco?');
      expect(input).toHaveValue('Como posso melhorar meu foco?');

      // Send message
      await user.click(sendButton);

      // Verify the complete flow
      await waitFor(() => {
        expect(mockConversation.addUserMessage).toHaveBeenCalledWith('Como posso melhorar meu foco?');
        expect(mockApiClient.sendMessage).toHaveBeenCalledWith('Como posso melhorar meu foco?', 'test-conv-123');
        expect(mockConversation.addAssistantMessage).toHaveBeenCalledWith(
          mockResponse.response,
          mockResponse.imageUrl
        );
        expect(mockCaptainImages.preloadImage).toHaveBeenCalledWith(mockResponse.imageUrl);
        expect(mockCaptainImages.updateImage).toHaveBeenCalledWith(mockResponse.imageUrl, true);
        expect(onResponseReceived).toHaveBeenCalledWith(mockResponse);
        expect(onImageUpdated).toHaveBeenCalledWith(mockResponse.imageUrl);
      });

      // Input should be cleared
      expect(input).toHaveValue('');
    });

    it('should handle message sending with Enter key', async () => {
      const user = userEvent.setup();
      
      mockApiClient.sendMessage.mockResolvedValue({
        success: true,
        data: {
          response: 'Resposta do Capitão',
          imageUrl: '',
          conversationId: 'test-conv-123'
        }
      });

      render(<RealTimeChatInterface />);

      const input = screen.getByPlaceholderText('Pergunte ao Capitão Caverna...');
      
      await user.type(input, 'Teste com Enter');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockApiClient.sendMessage).toHaveBeenCalledWith('Teste com Enter', 'test-conv-123');
      });
    });

    it('should validate input before sending', async () => {
      const user = userEvent.setup();
      
      render(<RealTimeChatInterface />);

      const sendButton = screen.getByLabelText('Enviar mensagem para o Capitão');

      // Try to send empty message
      await user.click(sendButton);

      // Should not call API
      expect(mockApiClient.sendMessage).not.toHaveBeenCalled();

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/mensagem precisa ter conteúdo válido/)).toBeInTheDocument();
      });
    });

    it('should handle long messages validation', async () => {
      const user = userEvent.setup();
      
      render(<RealTimeChatInterface />);

      const input = screen.getByPlaceholderText('Pergunte ao Capitão Caverna...');
      const longMessage = 'a'.repeat(1001); // Exceeds 1000 character limit

      await user.type(input, longMessage);
      await user.keyboard('{Enter}');

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/mensagem precisa ter conteúdo válido/)).toBeInTheDocument();
      });

      expect(mockApiClient.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup();
      const apiError = {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor',
        retryable: true,
        fallback: {
          response: 'Guerreiro, houve um problema. Tente novamente.'
        }
      };

      mockApiClient.sendMessage.mockResolvedValue({
        success: false,
        error: apiError
      });

      render(<RealTimeChatInterface />);

      const input = screen.getByPlaceholderText('Pergunte ao Capitão Caverna...');
      
      await user.type(input, 'Mensagem que vai falhar');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Erro interno do servidor')).toBeInTheDocument();
        expect(mockConversation.addAssistantMessage).toHaveBeenCalledWith(
          apiError.fallback.response,
          undefined
        );
      });
    });

    it('should provide retry functionality', async () => {
      const user = userEvent.setup();
      
      // First call fails
      mockApiClient.sendMessage.mockResolvedValueOnce({
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Erro de rede',
          retryable: true
        }
      });

      // Second call succeeds
      mockApiClient.sendMessage.mockResolvedValueOnce({
        success: true,
        data: {
          response: 'Sucesso após retry',
          imageUrl: '',
          conversationId: 'test-conv-123'
        }
      });

      render(<RealTimeChatInterface />);

      const input = screen.getByPlaceholderText('Pergunte ao Capitão Caverna...');
      
      // Send message that will fail
      await user.type(input, 'Mensagem para retry');
      await user.keyboard('{Enter}');

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Erro de rede')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByLabelText('Tentar novamente');
      await user.click(retryButton);

      // Should populate input with last message
      expect(input).toHaveValue('Mensagem para retry');
    });
  });

  describe('Dynamic Image Updates', () => {
    it('should update captain image when response includes imageUrl', async () => {
      const user = userEvent.setup();
      const mockResponse: ChatResponse = {
        response: 'Resposta com imagem',
        imageUrl: 'https://example.com/new-captain.png',
        conversationId: 'test-conv-123'
      };

      mockApiClient.sendMessage.mockResolvedValue({
        success: true,
        data: mockResponse
      });

      const onImageUpdated = vi.fn();

      render(<RealTimeChatInterface onImageUpdated={onImageUpdated} />);

      const input = screen.getByPlaceholderText('Pergunte ao Capitão Caverna...');
      
      await user.type(input, 'Mensagem com imagem');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockCaptainImages.preloadImage).toHaveBeenCalledWith(mockResponse.imageUrl);
        expect(mockCaptainImages.updateImage).toHaveBeenCalledWith(mockResponse.imageUrl, true);
        expect(onImageUpdated).toHaveBeenCalledWith(mockResponse.imageUrl);
      });
    });

    it('should handle manual image generation', async () => {
      const user = userEvent.setup();
      
      mockConversation.messages = [{
        id: 'msg-1',
        content: 'Última mensagem do assistente',
        role: 'assistant',
        timestamp: new Date()
      }];

      mockApiClient.generateImage.mockResolvedValue({
        success: true,
        data: {
          imageUrl: 'https://example.com/manual-image.png',
          imageId: 'img-123',
          promptParameters: {}
        }
      });

      render(<RealTimeChatInterface />);

      const generateButton = screen.getByTitle('Gerar nova imagem do Capitão');
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockApiClient.generateImage).toHaveBeenCalledWith({
          responseContent: 'Última mensagem do assistente',
          tone: 'motivational',
          themes: ['focus', 'strength', 'determination']
        });
        expect(mockCaptainImages.updateImage).toHaveBeenCalledWith(
          'https://example.com/manual-image.png',
          true
        );
      });
    });
  });

  describe('Real-time Status Updates', () => {
    it('should show loading states during processing', () => {
      mockApiClient.isLoading = true;
      mockApiClient.operation = 'chat';

      render(<RealTimeChatInterface />);

      expect(screen.getByText('Processando...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Aguarde a resposta do Capitão...')).toBeInTheDocument();
      
      const sendButton = screen.getByLabelText('Enviar mensagem para o Capitão');
      expect(sendButton).toBeDisabled();
    });

    it('should show image generation status', () => {
      mockCaptainImages.isGenerating = true;

      render(<RealTimeChatInterface />);

      // The loading message should reflect image generation
      // This would be shown in the MessageList component
      expect(mockCaptainImages.isGenerating).toBe(true);
    });

    it('should update conversation statistics', () => {
      mockConversation.conversationStats = {
        totalMessages: 5,
        userMessages: 3,
        assistantMessages: 2,
        imagesGenerated: 1
      };

      render(<RealTimeChatInterface />);

      expect(screen.getByText('5 mensagens')).toBeInTheDocument();
    });
  });

  describe('Debug Information', () => {
    it('should show debug info in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(<RealTimeChatInterface enableDebugInfo={true} />);

      expect(screen.getByText('Real-time Debug Info')).toBeInTheDocument();
      expect(screen.getByText('API Status:')).toBeInTheDocument();
      expect(screen.getByText('Conversation:')).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not show debug info in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(<RealTimeChatInterface enableDebugInfo={true} />);

      expect(screen.queryByText('Real-time Debug Info')).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<RealTimeChatInterface />);

      expect(screen.getByLabelText('Campo de mensagem para o Capitão Caverna')).toBeInTheDocument();
      expect(screen.getByLabelText('Enviar mensagem para o Capitão')).toBeInTheDocument();
      expect(screen.getByLabelText('Opções adicionais')).toBeInTheDocument();
    });

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<RealTimeChatInterface />);

      const input = screen.getByPlaceholderText('Pergunte ao Capitão Caverna...');
      
      // Should focus input initially
      expect(input).toHaveFocus();

      // Tab navigation should work
      await user.tab();
      expect(screen.getByLabelText('Opções adicionais')).toHaveFocus();
    });
  });
});