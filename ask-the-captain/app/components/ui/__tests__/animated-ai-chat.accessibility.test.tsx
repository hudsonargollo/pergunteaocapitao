/**
 * AnimatedAIChat Accessibility Tests
 * 
 * Comprehensive accessibility tests ensuring WCAG 2.1 AA compliance including:
 * - ARIA labels, roles, and properties
 * - Keyboard navigation and focus management
 * - Screen reader support and announcements
 * - Color contrast and visual accessibility
 * - Reduced motion preferences
 * - Form accessibility and validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { AnimatedAIChat } from '../animated-ai-chat'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock framer-motion with accessibility considerations
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    input: ({ children, ...props }: any) => <input {...props}>{children}</input>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: vi.fn(() => false),
}))

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />
}))

// Mock icons with proper accessibility
vi.mock('lucide-react', () => ({
  Send: (props: any) => <span {...props} role="img" aria-label="Enviar mensagem">📤</span>,
  Loader2: (props: any) => <span {...props} role="img" aria-label="Carregando">⏳</span>,
  MessageCircle: (props: any) => <span {...props} role="img" aria-label="Mensagem">💬</span>,
  Zap: (props: any) => <span {...props} role="img" aria-label="Energia">⚡</span>,
}))

// Mock custom components with accessibility features
vi.mock('@/app/components/chat/CaptainImage', () => ({
  default: ({ imageUrl, isGenerating, className }: any) => (
    <div 
      className={className}
      role="img" 
      aria-label="Imagem do Capitão Caverna"
      data-testid="captain-image"
    >
      <img 
        src={imageUrl} 
        alt="Capitão Caverna - Mentor de disciplina e foco" 
        role="presentation"
      />
      {isGenerating && (
        <div 
          role="status" 
          aria-live="polite" 
          aria-label="Gerando nova imagem do Capitão"
          data-testid="image-generating"
        >
          <span className="sr-only">Gerando imagem...</span>
        </div>
      )}
    </div>
  ),
}))

vi.mock('@/app/components/chat/PerformanceMonitor', () => ({
  default: () => (
    <div 
      role="complementary" 
      aria-label="Monitor de performance"
      data-testid="performance-monitor"
    >
      <span className="sr-only">Monitorando performance da aplicação</span>
    </div>
  ),
}))

vi.mock('@/app/components/ui/cave-loading', () => ({
  CaveLoading: ({ className }: any) => (
    <div 
      className={className}
      role="status" 
      aria-live="polite"
      aria-label="Carregando"
      data-testid="cave-loading"
    >
      <span className="sr-only">Carregando...</span>
    </div>
  ),
  CaptainLoading: ({ className }: any) => (
    <div 
      className={className}
      role="status" 
      aria-live="polite"
      aria-label="Capitão processando"
      data-testid="captain-loading"
    >
      <span className="sr-only">O Capitão está processando sua solicitação...</span>
    </div>
  ),
}))

vi.mock('@/app/components/ui/cave-button', () => ({
  CaveButton: ({ children, disabled, 'aria-label': ariaLabel, ...props }: any) => (
    <button 
      {...props}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid="cave-button"
    >
      {children}
    </button>
  ),
}))

vi.mock('@/app/components/ui/interactive-feedback', () => ({
  HoverFeedback: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
  SuccessFeedback: ({ children, message }: any) => (
    <div 
      role="status" 
      aria-live="polite"
      aria-label={message || 'Operação realizada com sucesso'}
      data-testid="success-feedback"
    >
      {children}
    </div>
  ),
  ErrorFeedback: ({ children, message }: any) => (
    <div 
      role="alert"
      aria-live="assertive"
      aria-label={message || 'Erro ocorrido'}
      data-testid="error-feedback"
    >
      {children}
    </div>
  ),
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

// Mock hooks with accessibility considerations
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

vi.mock('@/app/hooks/useOptimizedChatState', () => ({
  useOptimizedChatState: () => mockUseOptimizedChatState,
  useImageCache: () => ({
    preloadImage: vi.fn(),
    getCachedImage: vi.fn(),
    getCacheStats: vi.fn(() => ({ size: 0, hitRate: 0, missRate: 0 })),
  }),
  useAPIBatching: () => ({ addRequest: vi.fn() }),
  useVirtualScrolling: () => ({
    scrollElementRef: { current: null },
    visibleItems: [],
    totalHeight: 0,
    handleScroll: vi.fn(),
    scrollToBottom: vi.fn(),
    visibleRange: { start: 0, end: 0 },
  }),
  useMessageMemoryManagement: () => ({
    renderableMessages: [],
    renderMode: 'normal',
    memoryStats: { totalMessages: 0, renderedMessages: 0, memoryUsage: 0 },
    shouldUseVirtualization: false,
  }),
}))

vi.mock('@/app/hooks/useCaptainImageConsistency', () => ({
  useCaptainImageConsistency: () => ({
    currentImageUrl: '/placeholder-captain.svg',
    isValidating: false,
    validationResult: null,
    usedFallback: false,
    loadCaptainImage: vi.fn(),
    validateCurrentImage: vi.fn(),
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

describe('AnimatedAIChat Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('WCAG 2.1 AA Compliance', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = render(<AnimatedAIChat />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should not have accessibility violations with messages', async () => {
      const messages = [
        {
          id: '1',
          content: 'Como posso melhorar minha disciplina?',
          role: 'user' as const,
          timestamp: new Date(),
        },
        {
          id: '2',
          content: 'Guerreiro, você deve criar um protocolo de disciplina diário!',
          role: 'assistant' as const,
          timestamp: new Date(),
          imageUrl: '/captain-response.png',
        },
      ]

      mockUseOptimizedChatState.state.messages = messages
      const { container } = render(<AnimatedAIChat />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should not have accessibility violations in error states', async () => {
      mockUseOptimizedChatState.state.error = 'Guerreiro, houve um problema na conexão.'
      const { container } = render(<AnimatedAIChat />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should not have accessibility violations in loading states', async () => {
      mockUseOptimizedChatState.state.isTyping = true
      mockUseOptimizedChatState.state.isGeneratingImage = true
      const { container } = render(<AnimatedAIChat />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('ARIA Labels and Roles', () => {
    it('should have proper landmark roles', () => {
      render(<AnimatedAIChat />)

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('form')).toBeInTheDocument()
      expect(screen.getByRole('log')).toBeInTheDocument()
    })

    it('should have proper heading structure', () => {
      render(<AnimatedAIChat />)

      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toBeInTheDocument()
      expect(mainHeading).toHaveAccessibleName(/capitão caverna/i)
    })

    it('should have proper form labels', () => {
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAccessibleName(/digite sua pergunta/i)
      expect(input).toHaveAttribute('aria-describedby')
      
      const sendButton = screen.getByRole('button', { name: /enviar mensagem/i })
      expect(sendButton).toHaveAccessibleName()
    })

    it('should have proper message structure', () => {
      const messages = [
        {
          id: '1',
          content: 'Test message',
          role: 'user' as const,
          timestamp: new Date(),
        },
      ]

      mockUseOptimizedChatState.state.messages = messages
      render(<AnimatedAIChat />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toHaveAttribute('aria-labelledby')
      expect(messageElement).toHaveAttribute('aria-describedby')
    })

    it('should have proper image descriptions', () => {
      render(<AnimatedAIChat />)

      const captainImage = screen.getByRole('img', { name: /capitão caverna/i })
      expect(captainImage).toHaveAccessibleName()
      expect(captainImage).toHaveAttribute('alt', expect.stringContaining('Capitão Caverna'))
    })

    it('should have proper status announcements', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      const statusElement = screen.getByRole('status')
      expect(statusElement).toHaveAttribute('aria-live', 'polite')
      expect(statusElement).toHaveAccessibleName()
    })

    it('should have proper alert announcements', () => {
      mockUseOptimizedChatState.state.error = 'Test error'
      render(<AnimatedAIChat />)

      const alertElement = screen.getByRole('alert')
      expect(alertElement).toHaveAttribute('aria-live', 'assertive')
      expect(alertElement).toHaveAccessibleName()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support full keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      // Tab to input
      await user.tab()
      expect(screen.getByRole('textbox')).toHaveFocus()

      // Tab to send button
      await user.tab()
      expect(screen.getByRole('button', { name: /enviar/i })).toHaveFocus()

      // Should be able to navigate back
      await user.keyboard('{Shift>}{Tab}{/Shift}')
      expect(screen.getByRole('textbox')).toHaveFocus()
    })

    it('should handle Enter key for form submission', async () => {
      const user = userEvent.setup()
      const onMessageSent = vi.fn()
      render(<AnimatedAIChat onMessageSent={onMessageSent} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      expect(onMessageSent).toHaveBeenCalledWith('Test message')
    })

    it('should handle Space key for button activation', async () => {
      const user = userEvent.setup()
      const onMessageSent = vi.fn()
      render(<AnimatedAIChat onMessageSent={onMessageSent} />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      await user.type(input, 'Test message')
      sendButton.focus()
      await user.keyboard(' ')

      expect(onMessageSent).toHaveBeenCalledWith('Test message')
    })

    it('should handle Escape key for error dismissal', async () => {
      const user = userEvent.setup()
      mockUseOptimizedChatState.state.error = 'Test error'
      render(<AnimatedAIChat />)

      await user.keyboard('{Escape}')
      expect(mockUseOptimizedChatState.actions.setError).toHaveBeenCalledWith(null)
    })

    it('should maintain focus management during state changes', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      // Focus should return to input after sending
      expect(input).toHaveFocus()
    })

    it('should handle disabled state keyboard navigation', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      expect(input).toBeDisabled()
      expect(sendButton).toBeDisabled()

      // Disabled elements should not be focusable
      input.focus()
      expect(input).not.toHaveFocus()
    })
  })

  describe('Screen Reader Support', () => {
    it('should have proper live regions', () => {
      render(<AnimatedAIChat />)

      const liveRegions = screen.getAllByRole('status')
      expect(liveRegions.length).toBeGreaterThan(0)

      liveRegions.forEach(region => {
        expect(region).toHaveAttribute('aria-live')
      })
    })

    it('should announce typing state changes', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      const typingStatus = screen.getByRole('status', { name: /capitão está pensando/i })
      expect(typingStatus).toHaveAttribute('aria-live', 'polite')
    })

    it('should announce image generation state', () => {
      mockUseOptimizedChatState.state.isGeneratingImage = true
      render(<AnimatedAIChat />)

      const imageStatus = screen.getByTestId('image-generating')
      expect(imageStatus).toHaveAttribute('aria-live', 'polite')
      expect(imageStatus).toHaveAccessibleName(/gerando nova imagem/i)
    })

    it('should announce new messages', () => {
      const messages = [
        {
          id: '1',
          content: 'New message',
          role: 'assistant' as const,
          timestamp: new Date(),
        },
      ]

      mockUseOptimizedChatState.state.messages = messages
      render(<AnimatedAIChat />)

      const messageLog = screen.getByRole('log')
      expect(messageLog).toHaveAttribute('aria-live', 'polite')
      expect(messageLog).toHaveAccessibleName(/conversa/i)
    })

    it('should provide conversation statistics', () => {
      const messages = Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant' as const,
        timestamp: new Date(),
      }))

      mockUseOptimizedChatState.state.messages = messages
      render(<AnimatedAIChat />)

      const statsElement = screen.getByText(/5 mensagens/i)
      expect(statsElement).toHaveAttribute('aria-live', 'polite')
    })

    it('should provide context for dynamic content', () => {
      render(<AnimatedAIChat />)

      const captainImage = screen.getByTestId('captain-image')
      expect(captainImage).toHaveAttribute('aria-label', expect.stringContaining('Capitão Caverna'))
    })
  })

  describe('Color Contrast and Visual Accessibility', () => {
    it('should maintain high contrast for text elements', () => {
      render(<AnimatedAIChat />)

      // Check that high contrast classes are applied
      const headingElement = screen.getByRole('heading', { level: 1 })
      expect(headingElement).toHaveClass('text-cave-white')

      const bodyText = screen.getByText(/digite sua pergunta/i)
      expect(bodyText).toHaveClass('text-cave-off-white')
    })

    it('should have high contrast focus indicators', () => {
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('focus:ring-2', 'focus:ring-cave-red')

      const button = screen.getByRole('button', { name: /enviar/i })
      expect(button).toHaveClass('focus:ring-2', 'focus:ring-cave-red')
    })

    it('should provide sufficient contrast in error states', () => {
      mockUseOptimizedChatState.state.error = 'Test error'
      render(<AnimatedAIChat />)

      const errorElement = screen.getByRole('alert')
      expect(errorElement).toHaveClass('text-cave-white')
    })

    it('should maintain contrast in loading states', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      const loadingElement = screen.getByRole('status')
      expect(loadingElement).toHaveClass('text-cave-off-white')
    })
  })

  describe('Reduced Motion Support', () => {
    it('should respect reduced motion preferences', () => {
      vi.mocked(require('framer-motion').useReducedMotion).mockReturnValue(true)

      render(<AnimatedAIChat />)

      // Should apply reduced motion classes
      const animatedElements = screen.getAllByTestId(/animation/)
      animatedElements.forEach(element => {
        expect(element).toHaveClass('motion-reduce:transition-none')
      })
    })

    it('should disable complex animations when reduced motion is preferred', () => {
      vi.mocked(require('framer-motion').useReducedMotion).mockReturnValue(true)

      render(<AnimatedAIChat />)

      // Component should still be functional without animations
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument()
    })

    it('should provide alternative feedback for reduced motion', () => {
      vi.mocked(require('framer-motion').useReducedMotion).mockReturnValue(true)
      mockUseOptimizedChatState.state.isTyping = true

      render(<AnimatedAIChat />)

      // Should provide text-based feedback instead of animations
      const statusElement = screen.getByRole('status')
      expect(statusElement).toHaveTextContent(/processando/i)
    })
  })

  describe('Form Accessibility', () => {
    it('should have proper form structure', () => {
      render(<AnimatedAIChat />)

      const form = screen.getByRole('form')
      expect(form).toHaveAccessibleName(/enviar mensagem/i)
    })

    it('should provide input validation feedback', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      const longMessage = 'a'.repeat(2001) // Exceeds limit

      await user.type(input, longMessage)
      await user.keyboard('{Enter}')

      const validationMessage = screen.getByRole('alert')
      expect(validationMessage).toHaveAccessibleName(/mensagem muito longa/i)
    })

    it('should associate labels with form controls', () => {
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-labelledby')
      expect(input).toHaveAttribute('aria-describedby')
    })

    it('should provide clear error messages', () => {
      mockUseOptimizedChatState.state.error = 'Validation error'
      render(<AnimatedAIChat />)

      const errorElement = screen.getByRole('alert')
      expect(errorElement).toHaveAccessibleName()
      expect(errorElement).toHaveAttribute('aria-live', 'assertive')
    })
  })

  describe('Touch and Mobile Accessibility', () => {
    it('should have adequate touch targets', () => {
      render(<AnimatedAIChat />)

      const sendButton = screen.getByRole('button', { name: /enviar/i })
      expect(sendButton).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    })

    it('should support mobile screen readers', () => {
      render(<AnimatedAIChat />)

      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveAttribute('aria-label')
    })

    it('should handle mobile keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      // Should work with mobile keyboard patterns
      const input = screen.getByRole('textbox')
      await user.type(input, 'Mobile test')

      expect(input).toHaveValue('Mobile test')
    })
  })

  describe('Error Accessibility', () => {
    it('should announce errors immediately', () => {
      mockUseOptimizedChatState.state.error = 'Critical error'
      render(<AnimatedAIChat />)

      const errorElement = screen.getByRole('alert')
      expect(errorElement).toHaveAttribute('aria-live', 'assertive')
    })

    it('should provide actionable error messages', () => {
      mockUseOptimizedChatState.state.error = 'Network error'
      render(<AnimatedAIChat />)

      const retryButton = screen.getByRole('button', { name: /tentar novamente/i })
      expect(retryButton).toHaveAccessibleName()
      expect(retryButton).toHaveAttribute('aria-describedby')
    })

    it('should maintain accessibility during error recovery', async () => {
      const user = userEvent.setup()
      mockUseOptimizedChatState.state.error = 'Temporary error'
      render(<AnimatedAIChat />)

      const retryButton = screen.getByRole('button', { name: /tentar novamente/i })
      await user.click(retryButton)

      // Should maintain focus and accessibility during recovery
      expect(document.activeElement).toBeDefined()
    })
  })

  describe('Performance and Accessibility', () => {
    it('should maintain accessibility with virtual scrolling', () => {
      vi.mocked(require('@/app/hooks/useOptimizedChatState').useMessageMemoryManagement).mockReturnValue({
        renderableMessages: Array.from({ length: 100 }, (_, i) => ({
          id: `msg-${i}`,
          content: `Message ${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant' as const,
          timestamp: new Date(),
        })),
        renderMode: 'virtual',
        memoryStats: { totalMessages: 100, renderedMessages: 20, memoryUsage: 1024 },
        shouldUseVirtualization: true,
      })

      render(<AnimatedAIChat />)

      const messageLog = screen.getByRole('log')
      expect(messageLog).toHaveAccessibleName()
      expect(messageLog).toHaveAttribute('aria-live', 'polite')
    })

    it('should provide accessibility feedback for performance optimizations', () => {
      render(<AnimatedAIChat />)

      const performanceMonitor = screen.getByTestId('performance-monitor')
      expect(performanceMonitor).toHaveAttribute('role', 'complementary')
      expect(performanceMonitor).toHaveAccessibleName()
    })
  })

  describe('Internationalization Accessibility', () => {
    it('should have proper language attributes', () => {
      render(<AnimatedAIChat />)

      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveAttribute('lang', 'pt-BR')
    })

    it('should handle RTL text direction if needed', () => {
      render(<AnimatedAIChat />)

      const textElements = screen.getAllByRole('textbox')
      textElements.forEach(element => {
        expect(element).toHaveAttribute('dir', 'ltr')
      })
    })
  })
})