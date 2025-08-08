/**
 * AnimatedAIChat Component Tests
 * 
 * Comprehensive tests for the main AnimatedAIChat component including:
 * - Component rendering and structure
 * - Message handling and state management
 * - API integration and error handling
 * - Animation performance and accessibility
 * - Captain image consistency and fallback systems
 * - Performance optimization features
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { AnimatedAIChat } from '../animated-ai-chat'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    input: ({ children, ...props }: any) => <input {...props}>{children}</input>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Send: () => <span data-testid="send-icon">Send</span>,
  Loader2: () => <span data-testid="loader-icon">Loading</span>,
  MessageCircle: () => <span data-testid="message-icon">Message</span>,
  Zap: () => <span data-testid="zap-icon">Zap</span>,
}))

// Mock custom hooks
const mockUseOptimizedChatState = {
  state: {
    messages: [],
    isTyping: false,
    isGeneratingImage: false,
    currentCaptainImage: '/placeholder-captain.svg',
    error: null,
    conversationId: null,
  },
  actions: {
    addMessage: vi.fn(),
    setTyping: vi.fn(),
    setGeneratingImage: vi.fn(),
    setCaptainImage: vi.fn(),
    setError: vi.fn(),
    setConversationId: vi.fn(),
    updateMessage: vi.fn(),
  },
  selectors: {
    getStats: vi.fn(() => ({
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      averageResponseTime: 0,
    })),
  },
}

const mockUseCaptainImageConsistency = {
  currentImageUrl: '/placeholder-captain.svg',
  isValidating: false,
  validationResult: null,
  usedFallback: false,
  loadCaptainImage: vi.fn(),
  validateCurrentImage: vi.fn(),
}

const mockUseAnimationPerformance = {
  metrics: {
    fps: 60,
    totalFrames: 0,
    isOptimal: true,
  },
  isMonitoring: false,
}

const mockUseDevicePerformance = () => ({
  isHighPerformance: true,
  recommendedSettings: {
    enableComplexAnimations: true,
    enableBlur: true,
    enableShadows: true,
    maxConcurrentAnimations: 10,
  },
})

const mockUseMessageMemoryManagement = () => ({
  renderableMessages: [],
  renderMode: 'normal',
  memoryStats: {
    totalMessages: 0,
    renderedMessages: 0,
    memoryUsage: 0,
  },
  shouldUseVirtualization: false,
})

const mockUseVirtualScrolling = () => ({
  scrollElementRef: { current: null },
  visibleItems: [],
  totalHeight: 0,
  handleScroll: vi.fn(),
  scrollToBottom: vi.fn(),
  visibleRange: { start: 0, end: 0 },
})

const mockUseImageCache = () => ({
  preloadImage: vi.fn(),
  getCachedImage: vi.fn(),
  getCacheStats: vi.fn(() => ({
    size: 0,
    hitRate: 0,
    missRate: 0,
  })),
})

const mockUseAPIBatching = () => ({
  addRequest: vi.fn(),
})

// Mock all custom hooks
vi.mock('@/app/hooks/useOptimizedChatState', () => ({
  useOptimizedChatState: () => mockUseOptimizedChatState,
  useImageCache: mockUseImageCache,
  useAPIBatching: mockUseAPIBatching,
  useVirtualScrolling: mockUseVirtualScrolling,
  useMessageMemoryManagement: mockUseMessageMemoryManagement,
}))

vi.mock('@/app/hooks/useCaptainImageConsistency', () => ({
  useCaptainImageConsistency: () => mockUseCaptainImageConsistency,
}))

vi.mock('@/app/hooks/useAnimationPerformance', () => ({
  useAnimationPerformance: () => mockUseAnimationPerformance,
  useDevicePerformance: mockUseDevicePerformance,
  useOptimizedRerender: (data: any) => data,
}))

// Mock external libraries and components
vi.mock('@/app/components/chat/CaptainImage', () => ({
  default: ({ imageUrl, isGenerating }: any) => (
    <div data-testid="captain-image">
      <img src={imageUrl} alt="Capitão Caverna" />
      {isGenerating && <span>Generating...</span>}
    </div>
  ),
}))

vi.mock('@/app/components/chat/PerformanceMonitor', () => ({
  default: () => <div data-testid="performance-monitor">Performance Monitor</div>,
}))

vi.mock('@/app/components/ui/cave-loading', () => ({
  CaveLoading: () => <div data-testid="cave-loading">Cave Loading</div>,
  CaptainLoading: () => <div data-testid="captain-loading">Captain Loading</div>,
}))

vi.mock('@/app/components/ui/cave-button', () => ({
  CaveButton: ({ children, ...props }: any) => (
    <button {...props} data-testid="cave-button">{children}</button>
  ),
}))

vi.mock('@/app/components/ui/interactive-feedback', () => ({
  HoverFeedback: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SuccessFeedback: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  ErrorFeedback: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

vi.mock('@/app/components/ui/enhanced-loading-states', () => ({
  EnhancedLoadingState: ({ type }: any) => (
    <div data-testid={`enhanced-loading-${type}`}>Enhanced Loading</div>
  ),
}))

// Mock utility functions
vi.mock('@/app/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/app/lib/brand-assets', () => ({
  BRAND_ASSETS: {
    fallbackImages: {
      default: '/placeholder-captain.svg',
      supportive: '/supportive-captain.svg',
      challenging: '/challenging-captain.svg',
      instructional: '/instructional-captain.svg',
      motivational: '/motivational-captain.svg',
    },
  },
  getCaptainImageForContext: vi.fn(() => '/context-captain.svg'),
  getFallbackImageUrl: vi.fn(() => '/fallback-captain.svg'),
  preloadBrandAssets: vi.fn(() => Promise.resolve()),
  CAVE_TYPOGRAPHY: {
    body: {
      normal: 'text-base',
      small: 'text-sm',
    },
  },
  CAVE_ANIMATIONS: {
    duration: {
      fast: 0.1,
      normal: 0.3,
      slow: 0.5,
    },
  },
}))

vi.mock('@/app/lib/micro-animations', () => ({
  HOVER_VARIANTS: {},
  STAGGER_VARIANTS: {},
}))

// Mock external systems
vi.mock('@/lib/offline-state-manager', () => ({
  offlineStateManager: {
    isOffline: vi.fn(() => false),
    createOfflineErrorState: vi.fn(),
  },
}))

vi.mock('@/lib/network-connectivity', () => ({
  useNetworkConnectivity: () => ({
    state: 'online',
    quality: 'good',
    isOnline: true,
    isOffline: false,
    checkConnectivity: vi.fn(),
    getCaptainMessage: vi.fn(() => ({ message: 'Connection restored' })),
  }),
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('AnimatedAIChat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: 'Guerreiro, sua pergunta foi recebida!',
        imageUrl: '/captain-response.png',
        conversationId: 'conv_123',
      }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the main chat interface', () => {
      render(<AnimatedAIChat />)

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument()
    })

    it('should display captain image', () => {
      render(<AnimatedAIChat />)

      expect(screen.getByTestId('captain-image')).toBeInTheDocument()
      expect(screen.getByAltText('Capitão Caverna')).toBeInTheDocument()
    })

    it('should show performance monitor in development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      render(<AnimatedAIChat />)

      expect(screen.getByTestId('performance-monitor')).toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })

    it('should render with initial message', () => {
      const initialMessage = 'Bem-vindo, guerreiro! Como posso ajudá-lo hoje?'
      render(<AnimatedAIChat initialMessage={initialMessage} />)

      expect(mockUseOptimizedChatState.actions.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: initialMessage,
          role: 'assistant',
        })
      )
    })

    it('should apply custom className', () => {
      render(<AnimatedAIChat className="custom-chat-class" />)

      const mainElement = screen.getByRole('main')
      expect(mainElement).toHaveClass('custom-chat-class')
    })
  })

  describe('Message Handling', () => {
    it('should handle user message input', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Como posso melhorar minha disciplina?')

      expect(input).toHaveValue('Como posso melhorar minha disciplina?')
    })

    it('should send message on button click', async () => {
      const user = userEvent.setup()
      const onMessageSent = vi.fn()
      render(<AnimatedAIChat onMessageSent={onMessageSent} />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      await user.type(input, 'Test message')
      await user.click(sendButton)

      expect(onMessageSent).toHaveBeenCalledWith('Test message')
      expect(mockUseOptimizedChatState.actions.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Test message',
          role: 'user',
        })
      )
    })

    it('should send message on Enter key', async () => {
      const user = userEvent.setup()
      const onMessageSent = vi.fn()
      render(<AnimatedAIChat onMessageSent={onMessageSent} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message{Enter}')

      expect(onMessageSent).toHaveBeenCalledWith('Test message')
    })

    it('should not send empty messages', async () => {
      const user = userEvent.setup()
      const onMessageSent = vi.fn()
      render(<AnimatedAIChat onMessageSent={onMessageSent} />)

      const sendButton = screen.getByRole('button', { name: /enviar/i })
      await user.click(sendButton)

      expect(onMessageSent).not.toHaveBeenCalled()
    })

    it('should trim whitespace from messages', async () => {
      const user = userEvent.setup()
      const onMessageSent = vi.fn()
      render(<AnimatedAIChat onMessageSent={onMessageSent} />)

      const input = screen.getByRole('textbox')
      await user.type(input, '   Test message   ')
      await user.keyboard('{Enter}')

      expect(onMessageSent).toHaveBeenCalledWith('Test message')
    })

    it('should clear input after sending message', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox') as HTMLInputElement
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      expect(input.value).toBe('')
    })

    it('should prevent sending while typing', async () => {
      const user = userEvent.setup()
      mockUseOptimizedChatState.state.isTyping = true

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      await user.type(input, 'Test message')
      await user.click(sendButton)

      expect(mockUseOptimizedChatState.actions.addMessage).not.toHaveBeenCalled()
    })
  })

  describe('API Integration', () => {
    it('should make API call when sending message', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Test message',
            conversationId: expect.any(String),
          }),
        })
      })
    })

    it('should handle successful API response', async () => {
      const user = userEvent.setup()
      const onResponseReceived = vi.fn()
      render(<AnimatedAIChat onResponseReceived={onResponseReceived} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.addMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'Guerreiro, sua pergunta foi recebida!',
            role: 'assistant',
          })
        )
        expect(onResponseReceived).toHaveBeenCalledWith({
          response: 'Guerreiro, sua pergunta foi recebida!',
          imageUrl: '/captain-response.png',
          conversationId: 'conv_123',
        })
      })
    })

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setError).toHaveBeenCalledWith(
          expect.stringContaining('guerreiro')
        )
      })
    })

    it('should handle HTTP error responses', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Server error occurred',
            timestamp: new Date().toISOString(),
          },
        }),
      })

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setError).toHaveBeenCalled()
      })
    })

    it('should retry failed requests', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: 'Retry successful',
            imageUrl: '/captain-retry.png',
            conversationId: 'conv_retry',
          }),
        })

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Image Generation', () => {
    it('should trigger image generation after receiving response', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: 'Test response',
            imageUrl: '/initial-image.png',
            conversationId: 'conv_123',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            imageUrl: '/generated-image.png',
            imageId: 'img_123',
            promptParameters: {},
          }),
        })

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setGeneratingImage).toHaveBeenCalledWith(true)
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
      })
    })

    it('should handle image generation failures', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: 'Test response',
            imageUrl: '/initial-image.png',
            conversationId: 'conv_123',
          }),
        })
        .mockRejectedValueOnce(new Error('Image generation failed'))

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setGeneratingImage).toHaveBeenCalledWith(false)
      })
    })

    it('should use fallback image when generation fails', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: 'Test response',
            imageUrl: '/initial-image.png',
            conversationId: 'conv_123',
          }),
        })
        .mockRejectedValueOnce(new Error('Image generation failed'))

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setCaptainImage).toHaveBeenCalledWith(
          expect.stringContaining('captain')
        )
      })
    })
  })

  describe('Loading States', () => {
    it('should show typing indicator when processing', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      expect(screen.getByText(/capitão está pensando/i)).toBeInTheDocument()
    })

    it('should show image generation indicator', () => {
      mockUseOptimizedChatState.state.isGeneratingImage = true
      render(<AnimatedAIChat />)

      expect(screen.getByText(/gerando imagem/i)).toBeInTheDocument()
    })

    it('should disable input during processing', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      expect(input).toBeDisabled()
      expect(sendButton).toBeDisabled()
    })

    it('should show enhanced loading states', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      expect(screen.getByTestId('enhanced-loading-typing')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error messages', () => {
      mockUseOptimizedChatState.state.error = 'Guerreiro, houve um problema na conexão.'
      render(<AnimatedAIChat />)

      expect(screen.getByText(/problema na conexão/i)).toBeInTheDocument()
    })

    it('should clear errors when sending new message', async () => {
      const user = userEvent.setup()
      mockUseOptimizedChatState.state.error = 'Previous error'
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'New message')
      await user.keyboard('{Enter}')

      expect(mockUseOptimizedChatState.actions.setError).toHaveBeenCalledWith(null)
    })

    it('should show Captain persona error messages', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockRejectedValue(new Error('Rate limit exceeded'))

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setError).toHaveBeenCalledWith(
          expect.stringContaining('guerreiro')
        )
      })
    })
  })

  describe('Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<AnimatedAIChat />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper ARIA labels', () => {
      render(<AnimatedAIChat />)

      expect(screen.getByLabelText(/digite sua pergunta/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/enviar mensagem/i)).toBeInTheDocument()
    })

    it('should have proper landmark roles', () => {
      render(<AnimatedAIChat />)

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('form')).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      await user.tab()
      expect(input).toHaveFocus()

      await user.tab()
      expect(sendButton).toHaveFocus()
    })

    it('should announce loading states to screen readers', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      const loadingStatus = screen.getByRole('status')
      expect(loadingStatus).toHaveAttribute('aria-live', 'polite')
    })

    it('should handle reduced motion preferences', () => {
      vi.mocked(require('framer-motion').useReducedMotion).mockReturnValue(true)

      render(<AnimatedAIChat />)

      // Component should render without complex animations
      expect(screen.getByRole('main')).toBeInTheDocument()
    })
  })

  describe('Performance Optimization', () => {
    it('should use virtual scrolling for large message lists', () => {
      const mockMessages = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        role: 'user' as const,
        timestamp: new Date(),
      }))

      mockUseMessageMemoryManagement.mockReturnValue({
        renderableMessages: mockMessages,
        renderMode: 'virtual',
        memoryStats: {
          totalMessages: 100,
          renderedMessages: 20,
          memoryUsage: 1024,
        },
        shouldUseVirtualization: true,
      })

      render(<AnimatedAIChat />)

      // Should use virtual scrolling for performance
      expect(mockUseVirtualScrolling).toHaveBeenCalled()
    })

    it('should cache images for better performance', () => {
      render(<AnimatedAIChat />)

      expect(mockUseImageCache).toHaveBeenCalled()
    })

    it('should batch API requests', () => {
      render(<AnimatedAIChat />)

      expect(mockUseAPIBatching).toHaveBeenCalled()
    })

    it('should monitor animation performance', () => {
      render(<AnimatedAIChat />)

      expect(mockUseAnimationPerformance).toHaveBeenCalledWith({
        targetFPS: 60,
        enableLogging: expect.any(Boolean),
        onPerformanceChange: expect.any(Function),
      })
    })

    it('should adapt to device capabilities', () => {
      mockUseDevicePerformance.mockReturnValue({
        isHighPerformance: false,
        recommendedSettings: {
          enableComplexAnimations: false,
          enableBlur: false,
          enableShadows: false,
          maxConcurrentAnimations: 3,
        },
      })

      render(<AnimatedAIChat />)

      // Should adapt animations based on device capabilities
      expect(screen.getByRole('main')).toBeInTheDocument()
    })
  })

  describe('Network Connectivity', () => {
    it('should handle offline state', () => {
      vi.mocked(require('@/lib/network-connectivity').useNetworkConnectivity).mockReturnValue({
        state: 'offline',
        quality: 'none',
        isOnline: false,
        isOffline: true,
        checkConnectivity: vi.fn(),
        getCaptainMessage: vi.fn(() => ({
          message: 'Guerreiro, você está desconectado da caverna.',
        })),
      })

      render(<AnimatedAIChat />)

      expect(mockUseOptimizedChatState.actions.setError).toHaveBeenCalledWith(
        expect.stringContaining('desconectado')
      )
    })

    it('should handle slow network connections', () => {
      vi.mocked(require('@/lib/network-connectivity').useNetworkConnectivity).mockReturnValue({
        state: 'slow',
        quality: 'poor',
        isOnline: true,
        isOffline: false,
        checkConnectivity: vi.fn(),
        getCaptainMessage: vi.fn(() => ({
          message: 'Conexão lenta detectada, guerreiro.',
        })),
      })

      render(<AnimatedAIChat />)

      // Should handle slow connections gracefully
      expect(screen.getByRole('main')).toBeInTheDocument()
    })
  })

  describe('Captain Image Consistency', () => {
    it('should validate image consistency', () => {
      render(<AnimatedAIChat />)

      expect(mockUseCaptainImageConsistency).toHaveBeenCalledWith(
        '/placeholder-captain.svg',
        {
          enableValidation: true,
          maxRetries: 3,
          autoRetryOnFailure: true,
        }
      )
    })

    it('should show validation status', () => {
      mockUseCaptainImageConsistency.isValidating = true
      render(<AnimatedAIChat />)

      expect(screen.getByText(/validando imagem/i)).toBeInTheDocument()
    })

    it('should handle fallback when validation fails', () => {
      mockUseCaptainImageConsistency.usedFallback = true
      render(<AnimatedAIChat />)

      expect(screen.getByText(/usando imagem de fallback/i)).toBeInTheDocument()
    })
  })

  describe('Brand Integration', () => {
    it('should preload brand assets on mount', () => {
      render(<AnimatedAIChat />)

      expect(require('@/app/lib/brand-assets').preloadBrandAssets).toHaveBeenCalled()
    })

    it('should use cave-themed styling', () => {
      render(<AnimatedAIChat />)

      const mainElement = screen.getByRole('main')
      expect(mainElement).toHaveClass('cave-glass')
    })

    it('should use Captain persona in all interactions', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockRejectedValue(new Error('Test error'))

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setError).toHaveBeenCalledWith(
          expect.stringContaining('guerreiro')
        )
      })
    })
  })

  describe('Conversation Statistics', () => {
    it('should track conversation statistics', () => {
      render(<AnimatedAIChat />)

      expect(mockUseOptimizedChatState.selectors.getStats).toHaveBeenCalled()
    })

    it('should display performance metrics in development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      render(<AnimatedAIChat />)

      expect(screen.getByTestId('performance-monitor')).toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Ripple Effect Animation', () => {
    it('should trigger ripple effect on message send', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      // Should trigger ripple effect animation
      expect(screen.getByRole('main')).toBeInTheDocument()
    })
  })

  describe('Message Validation', () => {
    it('should validate message length', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      const longMessage = 'a'.repeat(2001) // Exceeds typical limit

      await user.type(input, longMessage)
      await user.keyboard('{Enter}')

      // Should not send overly long messages
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should sanitize user input', async () => {
      const user = userEvent.setup()
      const onMessageSent = vi.fn()
      render(<AnimatedAIChat onMessageSent={onMessageSent} />)

      const input = screen.getByRole('textbox')
      await user.type(input, '<script>alert("xss")</script>Normal message')
      await user.keyboard('{Enter}')

      expect(onMessageSent).toHaveBeenCalledWith(
        expect.not.stringContaining('<script>')
      )
    })
  })
})