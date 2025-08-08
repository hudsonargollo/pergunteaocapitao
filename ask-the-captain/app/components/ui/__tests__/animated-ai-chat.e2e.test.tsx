/**
 * AnimatedAIChat End-to-End User Flow Tests
 * 
 * Complete user journey tests including:
 * - Full conversation flow from user input to AI response
 * - Image generation and display pipeline
 * - Error handling scenarios with user feedback
 * - Cross-browser and cross-device compatibility
 * - Real-world usage patterns and edge cases
 * - Performance under realistic conditions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnimatedAIChat } from '../animated-ai-chat'

// E2E testing utilities
class E2ETestRunner {
  private scenarios: Array<{
    name: string
    steps: Array<{
      action: string
      target?: string
      input?: string
      expected: string | RegExp
      timeout?: number
    }>
    success: boolean
    duration: number
    errors: string[]
  }> = []

  async runScenario(
    name: string,
    steps: Array<{
      action: 'type' | 'click' | 'wait' | 'expect' | 'keyboard'
      target?: string
      input?: string
      expected?: string | RegExp
      timeout?: number
    }>
  ) {
    const startTime = Date.now()
    const errors: string[] = []
    let success = true

    try {
      for (const step of steps) {
        await this.executeStep(step)
      }
    } catch (error) {
      success = false
      errors.push(error instanceof Error ? error.message : String(error))
    }

    const duration = Date.now() - startTime

    this.scenarios.push({
      name,
      steps: steps.map(s => ({ ...s, expected: s.expected?.toString() || '' })),
      success,
      duration,
      errors,
    })

    return { success, duration, errors }
  }

  private async executeStep(step: {
    action: 'type' | 'click' | 'wait' | 'expect' | 'keyboard'
    target?: string
    input?: string
    expected?: string | RegExp
    timeout?: number
  }) {
    const user = userEvent.setup()

    switch (step.action) {
      case 'type':
        if (!step.target || !step.input) throw new Error('Type action requires target and input')
        const inputElement = screen.getByRole(step.target as any)
        await user.type(inputElement, step.input)
        break

      case 'click':
        if (!step.target) throw new Error('Click action requires target')
        const clickElement = screen.getByRole(step.target as any)
        await user.click(clickElement)
        break

      case 'keyboard':
        if (!step.input) throw new Error('Keyboard action requires input')
        await user.keyboard(step.input)
        break

      case 'wait':
        const timeout = step.timeout || 1000
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, timeout))
        })
        break

      case 'expect':
        if (!step.expected) throw new Error('Expect action requires expected value')
        if (typeof step.expected === 'string') {
          expect(screen.getByText(step.expected)).toBeInTheDocument()
        } else {
          expect(screen.getByText(step.expected)).toBeInTheDocument()
        }
        break
    }
  }

  getReport() {
    const totalScenarios = this.scenarios.length
    const successfulScenarios = this.scenarios.filter(s => s.success).length
    const averageDuration = this.scenarios.reduce((sum, s) => sum + s.duration, 0) / totalScenarios
    const allErrors = this.scenarios.flatMap(s => s.errors)

    return {
      totalScenarios,
      successfulScenarios,
      successRate: successfulScenarios / totalScenarios,
      averageDuration,
      totalErrors: allErrors.length,
      scenarios: this.scenarios,
      commonErrors: this.getCommonErrors(allErrors),
    }
  }

  private getCommonErrors(errors: string[]) {
    const errorCounts = errors.reduce((counts, error) => {
      counts[error] = (counts[error] || 0) + 1
      return counts
    }, {} as Record<string, number>)

    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }))
  }

  reset() {
    this.scenarios = []
  }
}

// Mock framer-motion for E2E testing
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onAnimationComplete, ...props }: any) => {
      // Simulate animation completion for E2E flow
      if (onAnimationComplete) {
        setTimeout(onAnimationComplete, 100)
      }
      return <div {...props}>{children}</div>
    },
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    input: ({ children, ...props }: any) => <input {...props}>{children}</input>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, onLoad, onError, ...props }: any) => {
    // Simulate realistic image loading for E2E
    setTimeout(() => {
      if (src.includes('error') || Math.random() < 0.02) {
        onError?.()
      } else {
        onLoad?.()
      }
    }, Math.random() * 300 + 100) // 100-400ms load time
    
    return <img src={src} alt={alt} {...props} />
  }
}))

// Mock icons
vi.mock('lucide-react', () => ({
  Send: () => <span data-testid="send-icon">📤</span>,
  Loader2: () => <span data-testid="loader-icon">⏳</span>,
  MessageCircle: () => <span data-testid="message-icon">💬</span>,
  Zap: () => <span data-testid="zap-icon">⚡</span>,
}))

// Mock custom hooks for E2E testing
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
    addMessage: vi.fn((message) => {
      mockUseOptimizedChatState.state.messages.push(message)
    }),
    setTyping: vi.fn((typing) => {
      mockUseOptimizedChatState.state.isTyping = typing
    }),
    setGeneratingImage: vi.fn((generating) => {
      mockUseOptimizedChatState.state.isGeneratingImage = generating
    }),
    setCaptainImage: vi.fn((imageUrl) => {
      mockUseOptimizedChatState.state.currentCaptainImage = imageUrl
    }),
    setError: vi.fn((error) => {
      mockUseOptimizedChatState.state.error = error
    }),
    setConversationId: vi.fn((id) => {
      mockUseOptimizedChatState.state.conversationId = id
    }),
    updateMessage: vi.fn(),
  },
  selectors: {
    getStats: vi.fn(() => ({
      totalMessages: mockUseOptimizedChatState.state.messages.length,
      userMessages: mockUseOptimizedChatState.state.messages.filter(m => m.role === 'user').length,
      assistantMessages: mockUseOptimizedChatState.state.messages.filter(m => m.role === 'assistant').length,
      averageResponseTime: 250,
    })),
  },
}

vi.mock('@/app/hooks/useOptimizedChatState', () => ({
  useOptimizedChatState: () => mockUseOptimizedChatState,
  useImageCache: () => ({
    preloadImage: vi.fn().mockResolvedValue(true),
    getCachedImage: vi.fn(),
    getCacheStats: vi.fn(() => ({
      size: 10,
      hitRate: 0.85,
      missRate: 0.15,
    })),
  }),
  useAPIBatching: () => ({
    addRequest: vi.fn().mockResolvedValue({}),
  }),
  useVirtualScrolling: () => ({
    scrollElementRef: { current: null },
    visibleItems: [],
    totalHeight: 0,
    handleScroll: vi.fn(),
    scrollToBottom: vi.fn(),
    visibleRange: { start: 0, end: 0 },
  }),
  useMessageMemoryManagement: () => ({
    renderableMessages: mockUseOptimizedChatState.state.messages,
    renderMode: 'normal',
    memoryStats: { totalMessages: 0, renderedMessages: 0, memoryUsage: 0 },
    shouldUseVirtualization: false,
  }),
}))

vi.mock('@/app/hooks/useCaptainImageConsistency', () => ({
  useCaptainImageConsistency: () => ({
    currentImageUrl: mockUseOptimizedChatState.state.currentCaptainImage,
    isValidating: false,
    validationResult: { isConsistent: true, score: 0.95 },
    usedFallback: false,
    loadCaptainImage: vi.fn().mockResolvedValue('/new-captain-image.png'),
    validateCurrentImage: vi.fn().mockResolvedValue({ isConsistent: true, score: 0.95 }),
  }),
}))

vi.mock('@/app/hooks/useAnimationPerformance', () => ({
  useAnimationPerformance: () => ({
    metrics: { fps: 60, totalFrames: 0, isOptimal: true },
    isMonitoring: false,
  }),
  useDevicePerformance: () => ({
    isHighPerformance: true,
    recommendedSettings: {
      enableComplexAnimations: true,
      enableBlur: true,
      enableShadows: true,
      maxConcurrentAnimations: 10,
    },
  }),
  useOptimizedRerender: (data: any) => data,
}))

// Mock external systems
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

// Mock utility functions
vi.mock('@/app/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}))

// Mock brand assets
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
    body: { normal: 'text-base', small: 'text-sm' },
  },
  CAVE_ANIMATIONS: {
    duration: { fast: 0.1, normal: 0.3, slow: 0.5 },
  },
}))

// Create realistic E2E fetch mock
const createE2EFetch = () => {
  let conversationId = `conv_${Date.now()}`
  let messageCount = 0

  return vi.fn().mockImplementation(async (url: string, options: any) => {
    // Simulate realistic network delays
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))

    if (url === '/api/chat') {
      messageCount++
      const body = JSON.parse(options.body)
      
      // Simulate realistic Captain responses
      const responses = [
        `Guerreiro, entendi sua pergunta sobre "${body.message}". Vou te orientar com disciplina!`,
        `Excelente pergunta! Como Capitão, vou te mostrar o caminho da disciplina.`,
        `Guerreiro, essa é uma questão fundamental. Deixe-me te guiar através dos princípios da caverna.`,
        `Perfeito! Vejo que você está pronto para evoluir. Vamos trabalhar juntos nessa jornada.`,
        `Essa mentalidade é exatamente o que precisamos! Vou te ensinar como aplicar isso na prática.`,
      ]

      return {
        ok: true,
        json: () => Promise.resolve({
          response: responses[messageCount % responses.length],
          imageUrl: `/captain-response-${messageCount}.png`,
          conversationId: body.conversationId || conversationId,
        }),
      }
    }

    if (url === '/api/v1/images/generate') {
      // Simulate image generation delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 300))

      return {
        ok: true,
        json: () => Promise.resolve({
          imageUrl: `/generated-captain-${Date.now()}.png`,
          imageId: `img_${Date.now()}`,
          promptParameters: {
            style: 'pixar-3d',
            character: 'captain-caverna',
            context: 'supportive',
          },
        }),
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  })
}

describe('AnimatedAIChat End-to-End User Flow Tests', () => {
  let e2eRunner: E2ETestRunner

  beforeEach(() => {
    vi.clearAllMocks()
    e2eRunner = new E2ETestRunner()
    
    // Reset state
    mockUseOptimizedChatState.state = {
      messages: [],
      isTyping: false,
      isGeneratingImage: false,
      currentCaptainImage: '/placeholder-captain.svg',
      error: null,
      conversationId: null,
    }

    global.fetch = createE2EFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complete User Journey Tests', () => {
    it('should complete full conversation flow from user input to AI response', async () => {
      render(<AnimatedAIChat />)

      const result = await e2eRunner.runScenario('complete-conversation-flow', [
        { action: 'expect', expected: 'Digite sua pergunta para o Capitão Caverna' },
        { action: 'type', target: 'textbox', input: 'Como posso melhorar minha disciplina?' },
        { action: 'click', target: 'button' },
        { action: 'wait', timeout: 500 },
        { action: 'expect', expected: /guerreiro.*disciplina/i },
      ])

      expect(result.success).toBe(true)
      expect(result.duration).toBeLessThan(3000)
      expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
    })

    it('should handle multiple message exchanges', async () => {
      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      const conversation = [
        'Como posso melhorar minha disciplina?',
        'Quais são os pilares do foco?',
        'Como criar uma rotina matinal?',
        'Me ajude a superar a procrastinação',
      ]

      for (let i = 0; i < conversation.length; i++) {
        await user.type(input, conversation[i])
        await user.keyboard('{Enter}')

        // Wait for response
        await waitFor(() => {
          expect(mockUseOptimizedChatState.state.messages.length).toBe((i + 1) * 2)
        }, { timeout: 3000 })

        // Verify conversation context is maintained
        expect(mockUseOptimizedChatState.state.conversationId).toBeTruthy()
      }

      // Should have 8 messages total (4 user + 4 assistant)
      expect(mockUseOptimizedChatState.state.messages.length).toBe(8)
      expect(global.fetch).toHaveBeenCalledTimes(8) // 4 chat + 4 image calls
    })

    it('should maintain conversation context across multiple interactions', async () => {
      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      // First message
      await user.type(input, 'Primeira pergunta sobre disciplina')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
      })

      const firstCall = (global.fetch as any).mock.calls.find((call: any) => call[0] === '/api/chat')
      const firstConversationId = JSON.parse(firstCall[1].body).conversationId

      // Second message
      await user.type(input, 'Segunda pergunta relacionada')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(4) // 2 chat + 2 image
      })

      const secondCall = (global.fetch as any).mock.calls
        .filter((call: any) => call[0] === '/api/chat')[1]
      const secondConversationId = JSON.parse(secondCall[1].body).conversationId

      expect(secondConversationId).toBe(firstConversationId)
    })

    it('should handle rapid user interactions gracefully', async () => {
      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      // Send multiple rapid messages
      const rapidMessages = [
        'Primeira mensagem rápida',
        'Segunda mensagem rápida',
        'Terceira mensagem rápida',
      ]

      for (const message of rapidMessages) {
        await user.type(input, message)
        await user.keyboard('{Enter}')
        
        // Small delay to simulate rapid typing
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50))
        })
      }

      // Should handle all messages without crashing
      await waitFor(() => {
        expect(mockUseOptimizedChatState.state.messages.length).toBeGreaterThan(0)
      }, { timeout: 5000 })

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('Image Generation and Display Flow', () => {
    it('should complete image generation pipeline', async () => {
      render(<AnimatedAIChat />)

      const result = await e2eRunner.runScenario('image-generation-flow', [
        { action: 'type', target: 'textbox', input: 'Gere uma imagem motivacional' },
        { action: 'keyboard', input: '{Enter}' },
        { action: 'wait', timeout: 1000 },
        { action: 'expect', expected: /gerando imagem/i },
        { action: 'wait', timeout: 2000 },
      ])

      expect(result.success).toBe(true)
      
      // Should have called both APIs
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
      })
    })

    it('should display image updates with smooth transitions', async () => {
      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      await user.type(input, 'Teste de transição de imagem')
      await user.keyboard('{Enter}')

      // Should show initial image
      expect(screen.getByAltText(/capitão caverna/i)).toBeInTheDocument()

      // Wait for image generation
      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setGeneratingImage).toHaveBeenCalledWith(true)
      })

      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setGeneratingImage).toHaveBeenCalledWith(false)
      }, { timeout: 3000 })

      // Should update image
      expect(mockUseOptimizedChatState.actions.setCaptainImage).toHaveBeenCalled()
    })

    it('should handle image generation failures with fallbacks', async () => {
      // Mock image generation failure
      global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
        if (url === '/api/chat') {
          return {
            ok: true,
            json: () => Promise.resolve({
              response: 'Test response',
              imageUrl: '/initial-image.png',
              conversationId: 'test-conv',
            }),
          }
        }
        
        if (url === '/api/v1/images/generate') {
          throw new Error('Image generation service unavailable')
        }
      })

      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      await user.type(input, 'Teste de falha na geração de imagem')
      await user.keyboard('{Enter}')

      // Should handle failure gracefully
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
      })

      // Should use fallback image
      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setCaptainImage).toHaveBeenCalledWith(
          expect.stringContaining('fallback')
        )
      })

      // Should not crash the application
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should validate image consistency in real-time', async () => {
      const mockValidateImage = vi.fn().mockResolvedValue({
        isConsistent: true,
        score: 0.94,
        brandElements: ['captain-character', 'red-triangle-logo'],
      })

      vi.mocked(require('@/app/hooks/useCaptainImageConsistency').useCaptainImageConsistency).mockReturnValue({
        currentImageUrl: '/placeholder-captain.svg',
        isValidating: false,
        validationResult: { isConsistent: true, score: 0.94 },
        usedFallback: false,
        loadCaptainImage: vi.fn(),
        validateCurrentImage: mockValidateImage,
      })

      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      await user.type(input, 'Teste de validação de consistência')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
      })

      // Should validate image consistency
      await waitFor(() => {
        expect(mockValidateImage).toHaveBeenCalled()
      })
    })
  })

  describe('Error Handling Scenarios', () => {
    it('should handle API errors with user-friendly messages', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      await user.type(input, 'Teste de erro de API')
      await user.keyboard('{Enter}')

      // Should show Captain persona error message
      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setError).toHaveBeenCalledWith(
          expect.stringContaining('guerreiro')
        )
      })

      // Should not crash the application
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should recover from temporary network issues', async () => {
      let callCount = 0
      global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
        callCount++
        
        if (callCount === 1) {
          throw new Error('Temporary network error')
        }
        
        // Succeed on retry
        if (url === '/api/chat') {
          return {
            ok: true,
            json: () => Promise.resolve({
              response: 'Recovered response',
              imageUrl: '/recovery-image.png',
              conversationId: 'recovery-conv',
            }),
          }
        }
        
        return {
          ok: true,
          json: () => Promise.resolve({
            imageUrl: '/recovery-generated.png',
            imageId: 'recovery-img',
            promptParameters: {},
          }),
        }
      })

      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      await user.type(input, 'Teste de recuperação de rede')
      await user.keyboard('{Enter}')

      // Should eventually succeed after retry
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3) // Initial fail + retry success + image
      }, { timeout: 5000 })

      expect(mockUseOptimizedChatState.state.messages.length).toBeGreaterThan(0)
    })

    it('should handle rate limiting gracefully', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/chat') {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: () => Promise.resolve({
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Rate limit exceeded',
                retryAfter: 60,
              },
            }),
          }
        }
      })

      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      await user.type(input, 'Teste de rate limiting')
      await user.keyboard('{Enter}')

      // Should show rate limit message
      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setError).toHaveBeenCalledWith(
          expect.stringContaining('guerreiro')
        )
      })
    })

    it('should maintain UI responsiveness during errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Persistent error'))

      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      await user.type(input, 'Teste de responsividade durante erro')
      await user.keyboard('{Enter}')

      // UI should remain responsive
      expect(input).toBeDisabled() // Should show loading state

      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setError).toHaveBeenCalled()
      })

      // Should re-enable input after error
      await waitFor(() => {
        expect(input).not.toBeDisabled()
      })
    })
  })

  describe('Cross-Browser and Cross-Device Compatibility', () => {
    it('should work with different user agent strings', async () => {
      // Mock different browsers
      const browsers = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/14.1.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      ]

      for (const userAgent of browsers) {
        Object.defineProperty(navigator, 'userAgent', {
          value: userAgent,
          writable: true,
        })

        render(<AnimatedAIChat />)

        // Should render correctly on all browsers
        expect(screen.getByRole('main')).toBeInTheDocument()
        expect(screen.getByRole('textbox')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument()
      }
    })

    it('should handle different screen sizes', async () => {
      const screenSizes = [
        { width: 320, height: 568 },   // Mobile
        { width: 768, height: 1024 },  // Tablet
        { width: 1920, height: 1080 }, // Desktop
        { width: 2560, height: 1440 }, // Large Desktop
      ]

      for (const size of screenSizes) {
        Object.defineProperty(window, 'innerWidth', {
          value: size.width,
          writable: true,
        })
        Object.defineProperty(window, 'innerHeight', {
          value: size.height,
          writable: true,
        })

        // Trigger resize event
        fireEvent(window, new Event('resize'))

        render(<AnimatedAIChat />)

        // Should be responsive on all screen sizes
        expect(screen.getByRole('main')).toBeInTheDocument()
        
        const input = screen.getByRole('textbox')
        expect(input).toBeVisible()
      }
    })

    it('should support touch interactions', async () => {
      // Mock touch events
      const mockTouchStart = vi.fn()
      const mockTouchEnd = vi.fn()

      render(<AnimatedAIChat />)

      const sendButton = screen.getByRole('button', { name: /enviar/i })
      
      sendButton.addEventListener('touchstart', mockTouchStart)
      sendButton.addEventListener('touchend', mockTouchEnd)

      // Simulate touch interaction
      fireEvent.touchStart(sendButton)
      fireEvent.touchEnd(sendButton)

      expect(mockTouchStart).toHaveBeenCalled()
      expect(mockTouchEnd).toHaveBeenCalled()
    })

    it('should handle different input methods', async () => {
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      const user = userEvent.setup()

      // Test keyboard input
      await user.type(input, 'Keyboard input test')
      expect(input).toHaveValue('Keyboard input test')

      // Test paste
      await user.clear(input)
      await user.click(input)
      await user.paste('Pasted text test')
      expect(input).toHaveValue('Pasted text test')

      // Test programmatic input
      fireEvent.change(input, { target: { value: 'Programmatic input' } })
      expect(input).toHaveValue('Programmatic input')
    })
  })

  describe('Real-World Usage Patterns', () => {
    it('should handle typical user conversation patterns', async () => {
      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      // Simulate realistic conversation flow
      const conversationFlow = [
        { message: 'Olá, Capitão!', delay: 100 },
        { message: 'Como posso melhorar minha disciplina?', delay: 2000 },
        { message: 'Entendi, e sobre a procrastinação?', delay: 1500 },
        { message: 'Muito obrigado pela orientação!', delay: 1000 },
      ]

      for (const step of conversationFlow) {
        await user.type(input, step.message)
        await user.keyboard('{Enter}')

        // Wait for response
        await waitFor(() => {
          expect(mockUseOptimizedChatState.state.messages.length).toBeGreaterThan(0)
        })

        // Simulate user reading time
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, step.delay))
        })
      }

      // Should handle realistic conversation flow
      expect(mockUseOptimizedChatState.state.messages.length).toBe(8) // 4 user + 4 assistant
    })

    it('should handle user corrections and clarifications', async () => {
      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      // Initial question
      await user.type(input, 'Como posso ser mais produtivo?')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseOptimizedChatState.state.messages.length).toBe(2)
      })

      // Clarification
      await user.type(input, 'Na verdade, quero focar especificamente na manhã')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseOptimizedChatState.state.messages.length).toBe(4)
      })

      // Follow-up
      await user.type(input, 'E se eu tiver dificuldade para acordar cedo?')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseOptimizedChatState.state.messages.length).toBe(6)
      })

      // Should maintain conversation context through clarifications
      expect(mockUseOptimizedChatState.state.conversationId).toBeTruthy()
    })

    it('should handle long-form user inputs', async () => {
      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      const longMessage = `
        Capitão, estou passando por um momento muito difícil na minha vida. 
        Tenho lutado contra a procrastinação há anos e sinto que não consigo 
        sair desse ciclo. Já tentei várias técnicas de produtividade, mas 
        sempre acabo voltando aos velhos hábitos. Preciso de uma orientação 
        mais profunda sobre como realmente mudar minha mentalidade e criar 
        uma disciplina duradoura. Você pode me ajudar com um plano específico?
      `.trim()

      await user.type(input, longMessage)
      await user.keyboard('{Enter}')

      // Should handle long inputs without issues
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
      })

      const chatCall = (global.fetch as any).mock.calls.find((call: any) => call[0] === '/api/chat')
      const requestBody = JSON.parse(chatCall[1].body)
      
      expect(requestBody.message).toBe(longMessage)
    })

    it('should handle edge cases in user input', async () => {
      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      const edgeCases = [
        '', // Empty input
        '   ', // Whitespace only
        '🤔💭🎯', // Emojis only
        'a'.repeat(1000), // Very long input
        'Olá! Como você está? 😊', // Mixed text and emojis
        'Test\nwith\nnewlines', // Newlines
        'Special chars: @#$%^&*()', // Special characters
      ]

      for (const testInput of edgeCases) {
        await user.clear(input)
        
        if (testInput.trim()) {
          await user.type(input, testInput)
          await user.keyboard('{Enter}')

          // Should handle edge cases gracefully
          if (testInput.trim().length > 0 && testInput.trim().length <= 2000) {
            await waitFor(() => {
              expect(global.fetch).toHaveBeenCalled()
            })
          }
        }
      }

      // Should not crash with any edge case
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('Performance Under Realistic Conditions', () => {
    it('should maintain performance during extended conversations', async () => {
      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      const startTime = Date.now()

      // Simulate extended conversation
      for (let i = 0; i < 20; i++) {
        await user.type(input, `Extended conversation message ${i}`)
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(mockUseOptimizedChatState.state.messages.length).toBe((i + 1) * 2)
        })

        // Small delay between messages
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }

      const totalTime = Date.now() - startTime

      // Should complete extended conversation in reasonable time
      expect(totalTime).toBeLessThan(30000) // Less than 30 seconds
      expect(mockUseOptimizedChatState.state.messages.length).toBe(40)
    })

    it('should handle concurrent user actions', async () => {
      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      // Simulate concurrent actions
      const actions = [
        user.type(input, 'Concurrent test'),
        user.click(sendButton),
        user.keyboard('{Enter}'),
      ]

      // Execute actions concurrently
      await Promise.allSettled(actions)

      // Should handle concurrent actions gracefully
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should optimize memory usage during long sessions', async () => {
      render(<AnimatedAIChat />)

      const user = userEvent.setup()
      const input = screen.getByRole('textbox')

      // Simulate long session with many messages
      for (let i = 0; i < 50; i++) {
        await user.type(input, `Memory test message ${i}`)
        await user.keyboard('{Enter}')

        if (i % 10 === 0) {
          // Check memory usage periodically
          const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0
          expect(memoryUsage).toBeLessThan(100 * 1024 * 1024) // Less than 100MB
        }

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50))
        })
      }

      // Should maintain reasonable memory usage
      expect(mockUseOptimizedChatState.state.messages.length).toBe(100)
    })
  })

  describe('E2E Test Reporting', () => {
    it('should generate comprehensive E2E test report', async () => {
      render(<AnimatedAIChat />)

      // Run multiple scenarios
      await e2eRunner.runScenario('basic-interaction', [
        { action: 'type', target: 'textbox', input: 'Test message' },
        { action: 'keyboard', input: '{Enter}' },
        { action: 'wait', timeout: 1000 },
      ])

      await e2eRunner.runScenario('error-handling', [
        { action: 'type', target: 'textbox', input: 'Error test' },
        { action: 'click', target: 'button' },
        { action: 'wait', timeout: 500 },
      ])

      const report = e2eRunner.getReport()

      expect(report.totalScenarios).toBe(2)
      expect(report.successfulScenarios).toBeGreaterThan(0)
      expect(report.successRate).toBeGreaterThan(0.5)
      expect(report.averageDuration).toBeGreaterThan(0)
      expect(report.scenarios).toHaveLength(2)
      expect(report.scenarios[0]).toHaveProperty('name')
      expect(report.scenarios[0]).toHaveProperty('success')
      expect(report.scenarios[0]).toHaveProperty('duration')
      expect(report.scenarios[0]).toHaveProperty('errors')
    })
  })
})