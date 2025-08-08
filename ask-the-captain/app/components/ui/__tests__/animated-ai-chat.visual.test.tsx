/**
 * AnimatedAIChat Visual Regression Tests
 * 
 * Visual regression and theme consistency tests including:
 * - Cave theme color palette verification
 * - Glass morphism effects consistency
 * - Animation state visual validation
 * - Responsive design breakpoints
 * - Brand asset integration verification
 * - Accessibility visual compliance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnimatedAIChat } from '../animated-ai-chat'

// Mock framer-motion for consistent visual testing
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, ...props }: any) => (
      <div className={className} style={style} {...props}>{children}</div>
    ),
    button: ({ children, className, style, ...props }: any) => (
      <button className={className} style={style} {...props}>{children}</button>
    ),
    input: ({ children, className, style, ...props }: any) => (
      <input className={className} style={style} {...props}>{children}</input>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, className, ...props }: any) => (
    <img src={src} alt={alt} className={className} {...props} />
  )
}))

// Mock icons with consistent styling
vi.mock('lucide-react', () => ({
  Send: ({ className }: any) => <span className={className} data-testid="send-icon">Send</span>,
  Loader2: ({ className }: any) => <span className={className} data-testid="loader-icon">Loading</span>,
  MessageCircle: ({ className }: any) => <span className={className} data-testid="message-icon">Message</span>,
  Zap: ({ className }: any) => <span className={className} data-testid="zap-icon">Zap</span>,
}))

// Mock custom components with visual consistency
vi.mock('@/app/components/chat/CaptainImage', () => ({
  default: ({ imageUrl, className, isGenerating }: any) => (
    <div className={`captain-image-container ${className || ''}`} data-testid="captain-image">
      <img 
        src={imageUrl} 
        alt="Capitão Caverna" 
        className="captain-image cave-glass rounded-full"
      />
      {isGenerating && (
        <div className="absolute inset-0 cave-glass-loading rounded-full" data-testid="image-loading">
          <span className="text-cave-ember">Generating...</span>
        </div>
      )}
    </div>
  ),
}))

vi.mock('@/app/components/ui/cave-button', () => ({
  CaveButton: ({ children, className, variant, size, ...props }: any) => (
    <button 
      className={`cave-button cave-button-${variant || 'default'} cave-button-${size || 'default'} ${className || ''}`}
      {...props}
      data-testid="cave-button"
    >
      {children}
    </button>
  ),
}))

vi.mock('@/app/components/ui/cave-loading', () => ({
  CaveLoading: ({ className }: any) => (
    <div className={`cave-loading ${className || ''}`} data-testid="cave-loading">
      <div className="cave-loading-spinner bg-cave-red"></div>
    </div>
  ),
  CaptainLoading: ({ className }: any) => (
    <div className={`captain-loading ${className || ''}`} data-testid="captain-loading">
      <div className="captain-loading-glow bg-gradient-to-r from-cave-red to-cave-ember"></div>
    </div>
  ),
}))

vi.mock('@/app/components/ui/interactive-feedback', () => ({
  HoverFeedback: ({ children, className, variant, ...props }: any) => (
    <div 
      className={`hover-feedback hover-feedback-${variant || 'default'} ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  ),
  SuccessFeedback: ({ children, className }: any) => (
    <div className={`success-feedback bg-cave-ember/20 ${className || ''}`}>
      {children}
    </div>
  ),
  ErrorFeedback: ({ children, className }: any) => (
    <div className={`error-feedback bg-cave-red/20 ${className || ''}`}>
      {children}
    </div>
  ),
}))

// Mock utility functions
vi.mock('@/app/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}))

// Mock brand assets with visual consistency
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
    heading: {
      h1: 'text-4xl font-bold text-cave-white',
      h2: 'text-3xl font-semibold text-cave-white',
      h3: 'text-2xl font-medium text-cave-white',
    },
    body: {
      large: 'text-lg text-cave-off-white',
      normal: 'text-base text-cave-off-white',
      small: 'text-sm text-cave-mist',
    },
  },
  CAVE_ANIMATIONS: {
    duration: {
      fast: 0.1,
      normal: 0.3,
      slow: 0.5,
    },
    easing: {
      smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
}))

// Mock all hooks to return consistent visual states
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

describe('AnimatedAIChat Visual Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Cave Theme Color Palette', () => {
    it('should apply cave-dark background colors consistently', () => {
      render(<AnimatedAIChat />)

      const mainContainer = screen.getByRole('main')
      expect(mainContainer).toHaveClass('bg-cave-dark')
      
      // Check for consistent dark theme application
      const chatContainer = screen.getByTestId('chat-container')
      expect(chatContainer).toHaveClass('cave-glass')
    })

    it('should use cave-red for primary action elements', () => {
      render(<AnimatedAIChat />)

      const sendButton = screen.getByRole('button', { name: /enviar/i })
      expect(sendButton).toHaveClass('cave-button')
      
      // Verify cave-red is applied to primary actions
      const caveButton = screen.getByTestId('cave-button')
      expect(caveButton).toHaveClass('cave-button-default')
    })

    it('should use cave-ember for loading and accent elements', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      const loadingElement = screen.getByTestId('captain-loading')
      expect(loadingElement).toHaveClass('captain-loading')
      expect(loadingElement.querySelector('.captain-loading-glow')).toHaveClass('from-cave-red', 'to-cave-ember')
    })

    it('should use high-contrast text colors', () => {
      const messages = [
        {
          id: '1',
          content: 'User message',
          role: 'user' as const,
          timestamp: new Date(),
        },
        {
          id: '2',
          content: 'Assistant message',
          role: 'assistant' as const,
          timestamp: new Date(),
        },
      ]

      mockUseOptimizedChatState.state.messages = messages
      render(<AnimatedAIChat />)

      // Check text contrast classes are applied
      const messageElements = screen.getAllByRole('article')
      expect(messageElements[0]).toHaveClass('text-cave-white')
      expect(messageElements[1]).toHaveClass('text-cave-off-white')
    })

    it('should maintain color consistency across all UI states', () => {
      // Test different states
      const states = [
        { isTyping: true, isGeneratingImage: false, error: null },
        { isTyping: false, isGeneratingImage: true, error: null },
        { isTyping: false, isGeneratingImage: false, error: 'Test error' },
      ]

      states.forEach((state, index) => {
        mockUseOptimizedChatState.state = { ...mockUseOptimizedChatState.state, ...state }
        const { unmount } = render(<AnimatedAIChat />)

        const mainContainer = screen.getByRole('main')
        expect(mainContainer).toHaveClass('bg-cave-dark')

        unmount()
      })
    })
  })

  describe('Glass Morphism Effects', () => {
    it('should apply cave-glass effect to main containers', () => {
      render(<AnimatedAIChat />)

      const chatContainer = screen.getByTestId('chat-container')
      expect(chatContainer).toHaveClass('cave-glass')
      
      // Verify glass morphism properties
      const style = window.getComputedStyle(chatContainer)
      expect(style.backdropFilter).toContain('blur')
    })

    it('should apply cave-glass-subtle to user messages', () => {
      const userMessage = {
        id: '1',
        content: 'User message',
        role: 'user' as const,
        timestamp: new Date(),
      }

      mockUseOptimizedChatState.state.messages = [userMessage]
      render(<AnimatedAIChat />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toHaveClass('cave-glass-subtle')
    })

    it('should maintain glass effect consistency across components', () => {
      render(<AnimatedAIChat />)

      const captainImage = screen.getByTestId('captain-image')
      expect(captainImage.querySelector('.captain-image')).toHaveClass('cave-glass')
      
      const inputContainer = screen.getByTestId('input-container')
      expect(inputContainer).toHaveClass('cave-glass')
    })

    it('should apply appropriate glow effects', () => {
      render(<AnimatedAIChat />)

      const focusableElements = screen.getAllByRole('button')
      focusableElements.forEach(element => {
        expect(element).toHaveClass('cave-glow-subtle')
      })
    })
  })

  describe('Animation State Visuals', () => {
    it('should show typing animation visuals', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      const typingIndicator = screen.getByTestId('typing-indicator')
      expect(typingIndicator).toHaveClass('typing-animation')
      
      const dots = screen.getAllByTestId('typing-dot')
      expect(dots).toHaveLength(3)
      dots.forEach(dot => {
        expect(dot).toHaveClass('bg-cave-ember')
      })
    })

    it('should show image generation animation', () => {
      mockUseOptimizedChatState.state.isGeneratingImage = true
      render(<AnimatedAIChat />)

      const imageLoading = screen.getByTestId('image-loading')
      expect(imageLoading).toHaveClass('cave-glass-loading')
      expect(imageLoading).toHaveTextContent('Generating...')
    })

    it('should apply ripple effect styling', () => {
      render(<AnimatedAIChat />)

      const rippleContainer = screen.getByTestId('ripple-container')
      expect(rippleContainer).toHaveClass('ripple-effect')
      
      // Verify ripple styling
      const ripple = rippleContainer.querySelector('.ripple')
      expect(ripple).toHaveClass('bg-cave-red/30')
    })

    it('should show loading states with cave theme', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      const caveLoading = screen.getByTestId('cave-loading')
      expect(caveLoading).toHaveClass('cave-loading')
      
      const spinner = caveLoading.querySelector('.cave-loading-spinner')
      expect(spinner).toHaveClass('bg-cave-red')
    })
  })

  describe('Responsive Design Breakpoints', () => {
    it('should apply mobile-first responsive classes', () => {
      render(<AnimatedAIChat />)

      const mainContainer = screen.getByRole('main')
      expect(mainContainer).toHaveClass('w-full', 'max-w-4xl', 'mx-auto')
      
      const chatContainer = screen.getByTestId('chat-container')
      expect(chatContainer).toHaveClass('flex-1', 'overflow-hidden')
    })

    it('should have responsive message layout', () => {
      const messages = [
        {
          id: '1',
          content: 'User message',
          role: 'user' as const,
          timestamp: new Date(),
        },
      ]

      mockUseOptimizedChatState.state.messages = messages
      render(<AnimatedAIChat />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toHaveClass('max-w-[80%]', 'sm:max-w-[70%]', 'lg:max-w-[60%]')
    })

    it('should have responsive input layout', () => {
      render(<AnimatedAIChat />)

      const inputContainer = screen.getByTestId('input-container')
      expect(inputContainer).toHaveClass('flex', 'gap-2', 'sm:gap-4')
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('flex-1', 'min-w-0')
    })

    it('should adapt captain image size responsively', () => {
      render(<AnimatedAIChat />)

      const captainImage = screen.getByTestId('captain-image')
      expect(captainImage).toHaveClass('w-16', 'h-16', 'sm:w-20', 'sm:h-20', 'lg:w-24', 'lg:h-24')
    })
  })

  describe('Brand Asset Integration', () => {
    it('should display captain image with proper styling', () => {
      render(<AnimatedAIChat />)

      const captainImage = screen.getByAltText('Capitão Caverna')
      expect(captainImage).toHaveClass('captain-image', 'cave-glass', 'rounded-full')
      expect(captainImage).toHaveAttribute('src', '/placeholder-captain.svg')
    })

    it('should apply brand typography consistently', () => {
      render(<AnimatedAIChat />)

      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveClass('text-4xl', 'font-bold', 'text-cave-white')
      
      const bodyText = screen.getByText(/digite sua pergunta/i)
      expect(bodyText).toHaveClass('text-base', 'text-cave-off-white')
    })

    it('should maintain brand consistency in error states', () => {
      mockUseOptimizedChatState.state.error = 'Test error message'
      render(<AnimatedAIChat />)

      const errorElement = screen.getByRole('alert')
      expect(errorElement).toHaveClass('error-feedback', 'bg-cave-red/20')
    })

    it('should use consistent iconography', () => {
      render(<AnimatedAIChat />)

      const sendIcon = screen.getByTestId('send-icon')
      expect(sendIcon).toHaveClass('w-4', 'h-4', 'text-cave-white')
      
      const messageIcon = screen.getByTestId('message-icon')
      expect(messageIcon).toHaveClass('w-4', 'h-4', 'text-cave-red')
    })
  })

  describe('Accessibility Visual Compliance', () => {
    it('should have high contrast focus indicators', () => {
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('focus:ring-2', 'focus:ring-cave-red', 'focus:ring-offset-2')
      
      const button = screen.getByRole('button', { name: /enviar/i })
      expect(button).toHaveClass('focus:ring-2', 'focus:ring-cave-red', 'focus:ring-offset-2')
    })

    it('should maintain sufficient color contrast ratios', () => {
      render(<AnimatedAIChat />)

      // Test high contrast text combinations
      const whiteOnDark = screen.getByText(/capitão caverna/i)
      expect(whiteOnDark).toHaveClass('text-cave-white')
      
      const offWhiteOnDark = screen.getByText(/digite sua pergunta/i)
      expect(offWhiteOnDark).toHaveClass('text-cave-off-white')
    })

    it('should provide visual feedback for interactive elements', () => {
      render(<AnimatedAIChat />)

      const hoverElements = screen.getAllByRole('button')
      hoverElements.forEach(element => {
        expect(element).toHaveClass('hover:bg-cave-red/80')
      })
    })

    it('should support reduced motion preferences', () => {
      vi.mocked(require('framer-motion').useReducedMotion).mockReturnValue(true)
      
      render(<AnimatedAIChat />)

      // Should apply reduced motion classes
      const animatedElements = screen.getAllByTestId(/animation/)
      animatedElements.forEach(element => {
        expect(element).toHaveClass('motion-reduce:transition-none')
      })
    })
  })

  describe('Loading State Visuals', () => {
    it('should show consistent loading animations', () => {
      mockUseOptimizedChatState.state.isTyping = true
      render(<AnimatedAIChat />)

      const loadingStates = screen.getAllByRole('status')
      loadingStates.forEach(loading => {
        expect(loading).toHaveClass('cave-loading')
      })
    })

    it('should maintain visual hierarchy during loading', () => {
      mockUseOptimizedChatState.state.isGeneratingImage = true
      render(<AnimatedAIChat />)

      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveClass('relative')
      
      const loadingOverlay = screen.getByTestId('loading-overlay')
      expect(loadingOverlay).toHaveClass('absolute', 'inset-0', 'cave-glass')
    })
  })

  describe('Message Visual Consistency', () => {
    it('should style user and assistant messages differently', () => {
      const messages = [
        {
          id: '1',
          content: 'User message',
          role: 'user' as const,
          timestamp: new Date(),
        },
        {
          id: '2',
          content: 'Assistant message',
          role: 'assistant' as const,
          timestamp: new Date(),
        },
      ]

      mockUseOptimizedChatState.state.messages = messages
      render(<AnimatedAIChat />)

      const messageElements = screen.getAllByRole('article')
      
      // User message styling
      expect(messageElements[0]).toHaveClass('justify-end')
      expect(messageElements[0].querySelector('.message-content')).toHaveClass('cave-glass-subtle')
      
      // Assistant message styling
      expect(messageElements[1]).toHaveClass('justify-start')
      expect(messageElements[1].querySelector('.message-content')).toHaveClass('cave-glass')
    })

    it('should maintain consistent message spacing', () => {
      const messages = Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant' as const,
        timestamp: new Date(),
      }))

      mockUseOptimizedChatState.state.messages = messages
      render(<AnimatedAIChat />)

      const messageList = screen.getByTestId('message-list')
      expect(messageList).toHaveClass('space-y-4')
      
      const messageElements = screen.getAllByRole('article')
      messageElements.forEach(element => {
        expect(element).toHaveClass('mb-4')
      })
    })
  })

  describe('Error State Visuals', () => {
    it('should display errors with consistent cave theme', () => {
      mockUseOptimizedChatState.state.error = 'Guerreiro, houve um problema na conexão.'
      render(<AnimatedAIChat />)

      const errorElement = screen.getByRole('alert')
      expect(errorElement).toHaveClass('error-feedback', 'bg-cave-red/20', 'border-cave-red/40')
      
      const errorText = screen.getByText(/problema na conexão/i)
      expect(errorText).toHaveClass('text-cave-white')
    })

    it('should show retry buttons with consistent styling', () => {
      mockUseOptimizedChatState.state.error = 'Network error'
      render(<AnimatedAIChat />)

      const retryButton = screen.getByRole('button', { name: /tentar novamente/i })
      expect(retryButton).toHaveClass('cave-button', 'cave-button-secondary')
    })
  })

  describe('Performance Visual Indicators', () => {
    it('should show performance monitor with cave theme', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      render(<AnimatedAIChat />)

      const performanceMonitor = screen.getByTestId('performance-monitor')
      expect(performanceMonitor).toHaveClass('cave-glass', 'text-cave-mist')

      process.env.NODE_ENV = originalEnv
    })

    it('should indicate virtual scrolling state visually', () => {
      vi.mocked(require('@/app/hooks/useOptimizedChatState').useMessageMemoryManagement).mockReturnValue({
        renderableMessages: [],
        renderMode: 'virtual',
        memoryStats: { totalMessages: 100, renderedMessages: 20, memoryUsage: 1024 },
        shouldUseVirtualization: true,
      })

      render(<AnimatedAIChat />)

      const virtualScrollIndicator = screen.getByTestId('virtual-scroll-indicator')
      expect(virtualScrollIndicator).toHaveClass('cave-glass', 'text-cave-ember')
    })
  })
})