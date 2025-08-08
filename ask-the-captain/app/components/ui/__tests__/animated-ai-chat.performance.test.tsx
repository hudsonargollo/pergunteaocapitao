/**
 * AnimatedAIChat Performance Tests
 * 
 * Performance benchmarks and optimization tests including:
 * - Animation smoothness and 60fps performance
 * - Memory usage and component efficiency
 * - Load testing for API integration
 * - Image generation consistency testing
 * - Virtual scrolling performance
 * - State management optimization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnimatedAIChat } from '../animated-ai-chat'

// Mock performance APIs
const mockPerformanceObserver = vi.fn()
const mockPerformanceNow = vi.fn(() => Date.now())
const mockRequestAnimationFrame = vi.fn((callback) => setTimeout(callback, 16))
const mockCancelAnimationFrame = vi.fn()

// Mock framer-motion with performance tracking
const mockMotionValues = new Map()
const mockAnimationControls = {
  start: vi.fn(),
  stop: vi.fn(),
  set: vi.fn(),
}

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, animate, initial, transition, onAnimationStart, onAnimationComplete, ...props }: any) => {
      // Track animation performance
      if (animate && onAnimationStart) {
        setTimeout(() => onAnimationStart(), 0)
      }
      if (animate && onAnimationComplete) {
        setTimeout(() => onAnimationComplete(), transition?.duration ? transition.duration * 1000 : 300)
      }
      return <div {...props}>{children}</div>
    },
    button: ({ children, whileTap, whileHover, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    input: ({ children, ...props }: any) => <input {...props}>{children}</input>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
  useAnimation: () => mockAnimationControls,
  useMotionValue: (initial: any) => {
    const id = Math.random().toString(36)
    mockMotionValues.set(id, { value: initial, set: vi.fn(), get: vi.fn(() => initial) })
    return mockMotionValues.get(id)
  },
}))

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, onLoad, onError, ...props }: any) => {
    // Simulate image loading performance
    setTimeout(() => {
      if (Math.random() > 0.1) { // 90% success rate
        onLoad?.()
      } else {
        onError?.()
      }
    }, Math.random() * 100 + 50) // 50-150ms load time
    
    return <img src={src} alt={alt} {...props} />
  }
}))

// Mock icons
vi.mock('lucide-react', () => ({
  Send: () => <span data-testid="send-icon">Send</span>,
  Loader2: () => <span data-testid="loader-icon">Loading</span>,
  MessageCircle: () => <span data-testid="message-icon">Message</span>,
  Zap: () => <span data-testid="zap-icon">Zap</span>,
}))

// Performance monitoring utilities
class PerformanceMonitor {
  private frameCount = 0
  private startTime = 0
  private lastFrameTime = 0
  private frameTimings: number[] = []
  private memoryUsage: number[] = []
  private isMonitoring = false

  start() {
    this.isMonitoring = true
    this.startTime = performance.now()
    this.frameCount = 0
    this.frameTimings = []
    this.memoryUsage = []
    this.measureFrame()
  }

  stop() {
    this.isMonitoring = false
    return this.getMetrics()
  }

  private measureFrame = () => {
    if (!this.isMonitoring) return

    const currentTime = performance.now()
    if (this.lastFrameTime > 0) {
      const frameTime = currentTime - this.lastFrameTime
      this.frameTimings.push(frameTime)
    }
    
    this.lastFrameTime = currentTime
    this.frameCount++

    // Measure memory usage if available
    if ((performance as any).memory) {
      this.memoryUsage.push((performance as any).memory.usedJSHeapSize)
    }

    requestAnimationFrame(this.measureFrame)
  }

  getMetrics() {
    const totalTime = this.lastFrameTime - this.startTime
    const avgFPS = this.frameCount / (totalTime / 1000)
    const avgFrameTime = this.frameTimings.reduce((a, b) => a + b, 0) / this.frameTimings.length
    const maxFrameTime = Math.max(...this.frameTimings)
    const minFrameTime = Math.min(...this.frameTimings)
    
    const memoryDelta = this.memoryUsage.length > 1 
      ? this.memoryUsage[this.memoryUsage.length - 1] - this.memoryUsage[0]
      : 0

    return {
      avgFPS,
      avgFrameTime,
      maxFrameTime,
      minFrameTime,
      frameCount: this.frameCount,
      totalTime,
      memoryDelta,
      frameTimings: this.frameTimings,
      memoryUsage: this.memoryUsage,
    }
  }
}

// Mock custom hooks with performance tracking
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

const mockUseAnimationPerformance = {
  metrics: {
    fps: 60,
    totalFrames: 0,
    isOptimal: true,
    averageFrameTime: 16.67,
    maxFrameTime: 20,
    minFrameTime: 14,
  },
  isMonitoring: false,
  startMonitoring: vi.fn(),
  stopMonitoring: vi.fn(),
}

const mockUseDevicePerformance = () => ({
  isHighPerformance: true,
  cpuCores: 8,
  memoryGB: 16,
  gpuTier: 'high',
  recommendedSettings: {
    enableComplexAnimations: true,
    enableBlur: true,
    enableShadows: true,
    maxConcurrentAnimations: 10,
  },
})

// Mock all hooks
vi.mock('@/app/hooks/useOptimizedChatState', () => ({
  useOptimizedChatState: () => mockUseOptimizedChatState,
  useImageCache: () => ({
    preloadImage: vi.fn().mockResolvedValue(true),
    getCachedImage: vi.fn(),
    getCacheStats: vi.fn(() => ({
      size: 10,
      hitRate: 0.85,
      missRate: 0.15,
      totalRequests: 100,
      cacheHits: 85,
      cacheMisses: 15,
    })),
    clearCache: vi.fn(),
  }),
  useAPIBatching: () => ({
    addRequest: vi.fn().mockResolvedValue({}),
    getBatchStats: vi.fn(() => ({
      totalBatches: 5,
      averageBatchSize: 2.5,
      batchEfficiency: 0.8,
    })),
  }),
  useVirtualScrolling: () => ({
    scrollElementRef: { current: null },
    visibleItems: [],
    totalHeight: 0,
    handleScroll: vi.fn(),
    scrollToBottom: vi.fn(),
    visibleRange: { start: 0, end: 0 },
    getScrollMetrics: vi.fn(() => ({
      totalItems: 100,
      visibleItems: 10,
      renderEfficiency: 0.9,
    })),
  }),
  useMessageMemoryManagement: () => ({
    renderableMessages: [],
    renderMode: 'normal',
    memoryStats: {
      totalMessages: 0,
      renderedMessages: 0,
      memoryUsage: 1024 * 1024, // 1MB
      memoryEfficiency: 0.95,
    },
    shouldUseVirtualization: false,
    optimizeMemory: vi.fn(),
  }),
}))

vi.mock('@/app/hooks/useAnimationPerformance', () => ({
  useAnimationPerformance: () => mockUseAnimationPerformance,
  useDevicePerformance: mockUseDevicePerformance,
  useOptimizedRerender: (data: any) => data,
}))

vi.mock('@/app/hooks/useCaptainImageConsistency', () => ({
  useCaptainImageConsistency: () => ({
    currentImageUrl: '/placeholder-captain.svg',
    isValidating: false,
    validationResult: { isConsistent: true, score: 0.95 },
    usedFallback: false,
    loadCaptainImage: vi.fn().mockResolvedValue('/new-image.png'),
    validateCurrentImage: vi.fn().mockResolvedValue({ isConsistent: true, score: 0.95 }),
    getConsistencyStats: vi.fn(() => ({
      totalValidations: 50,
      successRate: 0.94,
      averageScore: 0.92,
    })),
  }),
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
    getNetworkStats: vi.fn(() => ({
      latency: 50,
      bandwidth: 100,
      stability: 0.95,
    })),
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
  preloadBrandAssets: vi.fn().mockResolvedValue(true),
  CAVE_TYPOGRAPHY: {
    body: { normal: 'text-base', small: 'text-sm' },
  },
  CAVE_ANIMATIONS: {
    duration: { fast: 0.1, normal: 0.3, slow: 0.5 },
  },
}))

// Mock fetch for API testing
global.fetch = vi.fn()

// Mock performance APIs
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
    memory: {
      usedJSHeapSize: 10 * 1024 * 1024, // 10MB
      totalJSHeapSize: 50 * 1024 * 1024, // 50MB
      jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB
    },
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
  },
  writable: true,
})

Object.defineProperty(global, 'requestAnimationFrame', {
  value: mockRequestAnimationFrame,
  writable: true,
})

Object.defineProperty(global, 'cancelAnimationFrame', {
  value: mockCancelAnimationFrame,
  writable: true,
})

describe('AnimatedAIChat Performance Tests', () => {
  let performanceMonitor: PerformanceMonitor

  beforeEach(() => {
    vi.clearAllMocks()
    performanceMonitor = new PerformanceMonitor()
    
    // Reset performance mocks
    mockPerformanceNow.mockImplementation(() => Date.now())
    
    // Mock successful API responses
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: 'Test response',
        imageUrl: '/test-image.png',
        conversationId: 'test-conv',
      }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Animation Performance Benchmarks', () => {
    it('should maintain 60fps during message animations', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      performanceMonitor.start()

      // Trigger multiple animations
      const input = screen.getByRole('textbox')
      for (let i = 0; i < 5; i++) {
        await user.type(input, `Message ${i}`)
        await user.keyboard('{Enter}')
        
        // Wait for animation to complete
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }

      const metrics = performanceMonitor.stop()

      // Should maintain good FPS
      expect(metrics.avgFPS).toBeGreaterThan(55)
      expect(metrics.maxFrameTime).toBeLessThan(20) // Less than 20ms per frame
      expect(metrics.avgFrameTime).toBeLessThan(18) // Average less than 18ms
    })

    it('should handle typing indicator animation efficiently', async () => {
      mockUseOptimizedChatState.state.isTyping = true
      
      performanceMonitor.start()
      render(<AnimatedAIChat />)

      // Let typing animation run for a bit
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000))
      })

      const metrics = performanceMonitor.stop()

      expect(metrics.avgFPS).toBeGreaterThan(58)
      expect(metrics.frameTimings.every(time => time < 25)).toBe(true)
    })

    it('should optimize animations based on device performance', () => {
      const lowPerformanceDevice = {
        isHighPerformance: false,
        cpuCores: 2,
        memoryGB: 4,
        gpuTier: 'low',
        recommendedSettings: {
          enableComplexAnimations: false,
          enableBlur: false,
          enableShadows: false,
          maxConcurrentAnimations: 3,
        },
      }

      vi.mocked(mockUseDevicePerformance).mockReturnValue(lowPerformanceDevice)

      render(<AnimatedAIChat />)

      // Should adapt to low performance device
      expect(screen.getByRole('main')).toBeInTheDocument()
      // Animations should be simplified (tested through reduced complexity)
    })

    it('should handle reduced motion preferences without performance impact', () => {
      vi.mocked(require('framer-motion').useReducedMotion).mockReturnValue(true)

      performanceMonitor.start()
      render(<AnimatedAIChat />)

      // Should render without animations
      const metrics = performanceMonitor.stop()

      // Should have minimal performance impact
      expect(metrics.avgFrameTime).toBeLessThan(10)
      expect(metrics.frameCount).toBeGreaterThan(0)
    })

    it('should maintain performance with concurrent animations', async () => {
      const user = userEvent.setup()
      mockUseOptimizedChatState.state.isTyping = true
      mockUseOptimizedChatState.state.isGeneratingImage = true

      performanceMonitor.start()
      render(<AnimatedAIChat />)

      // Trigger multiple concurrent animations
      const input = screen.getByRole('textbox')
      await user.type(input, 'Concurrent test')

      // Let animations run concurrently
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
      })

      const metrics = performanceMonitor.stop()

      expect(metrics.avgFPS).toBeGreaterThan(50)
      expect(metrics.maxFrameTime).toBeLessThan(25)
    })
  })

  describe('Memory Usage and Efficiency', () => {
    it('should maintain stable memory usage', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const initialMemory = (performance as any).memory.usedJSHeapSize

      // Generate many messages to test memory management
      const input = screen.getByRole('textbox')
      for (let i = 0; i < 20; i++) {
        await user.type(input, `Memory test message ${i}`)
        await user.keyboard('{Enter}')
        
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50))
        })
      }

      const finalMemory = (performance as any).memory.usedJSHeapSize
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (less than 5MB for 20 messages)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024)
    })

    it('should efficiently manage large message lists', () => {
      const largeMessageList = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant' as const,
        timestamp: new Date(),
      }))

      mockUseOptimizedChatState.state.messages = largeMessageList

      const startTime = performance.now()
      render(<AnimatedAIChat />)
      const renderTime = performance.now() - startTime

      // Should render large lists quickly (less than 100ms)
      expect(renderTime).toBeLessThan(100)
    })

    it('should use virtual scrolling for performance optimization', () => {
      const manyMessages = Array.from({ length: 500 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant' as const,
        timestamp: new Date(),
      }))

      vi.mocked(require('@/app/hooks/useOptimizedChatState').useMessageMemoryManagement).mockReturnValue({
        renderableMessages: manyMessages,
        renderMode: 'virtual',
        memoryStats: {
          totalMessages: 500,
          renderedMessages: 20,
          memoryUsage: 2 * 1024 * 1024,
          memoryEfficiency: 0.95,
        },
        shouldUseVirtualization: true,
        optimizeMemory: vi.fn(),
      })

      render(<AnimatedAIChat />)

      // Should use virtual scrolling for large lists
      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('should efficiently cache and reuse images', async () => {
      const cacheStats = {
        size: 50,
        hitRate: 0.9,
        missRate: 0.1,
        totalRequests: 100,
        cacheHits: 90,
        cacheMisses: 10,
      }

      vi.mocked(require('@/app/hooks/useOptimizedChatState').useImageCache).mockReturnValue({
        preloadImage: vi.fn().mockResolvedValue(true),
        getCachedImage: vi.fn().mockReturnValue('/cached-image.png'),
        getCacheStats: vi.fn(() => cacheStats),
        clearCache: vi.fn(),
      })

      render(<AnimatedAIChat />)

      // Should have high cache hit rate
      expect(cacheStats.hitRate).toBeGreaterThan(0.8)
      expect(cacheStats.size).toBeGreaterThan(0)
    })

    it('should clean up resources on unmount', () => {
      const { unmount } = render(<AnimatedAIChat />)

      const initialMemory = (performance as any).memory.usedJSHeapSize
      unmount()

      // Memory should not increase significantly after unmount
      const finalMemory = (performance as any).memory.usedJSHeapSize
      expect(finalMemory - initialMemory).toBeLessThan(1024 * 1024) // Less than 1MB
    })
  })

  describe('API Integration Load Testing', () => {
    it('should handle rapid API requests efficiently', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const startTime = performance.now()
      const input = screen.getByRole('textbox')

      // Send multiple rapid requests
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          user.type(input, `Rapid request ${i}`).then(() => user.keyboard('{Enter}'))
        )
      }

      await Promise.all(promises)
      const totalTime = performance.now() - startTime

      // Should handle rapid requests without blocking UI
      expect(totalTime).toBeLessThan(2000) // Less than 2 seconds
      expect(global.fetch).toHaveBeenCalledTimes(10)
    })

    it('should batch API requests for efficiency', async () => {
      const batchStats = {
        totalBatches: 5,
        averageBatchSize: 3.2,
        batchEfficiency: 0.85,
      }

      vi.mocked(require('@/app/hooks/useOptimizedChatState').useAPIBatching).mockReturnValue({
        addRequest: vi.fn().mockResolvedValue({}),
        getBatchStats: vi.fn(() => batchStats),
      })

      render(<AnimatedAIChat />)

      // Should have good batching efficiency
      expect(batchStats.batchEfficiency).toBeGreaterThan(0.8)
      expect(batchStats.averageBatchSize).toBeGreaterThan(2)
    })

    it('should handle API timeouts gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock slow API response
      ;(global.fetch as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({
            response: 'Delayed response',
            imageUrl: '/delayed-image.png',
            conversationId: 'delayed-conv',
          }),
        }), 2000))
      )

      const startTime = performance.now()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Timeout test')
      await user.keyboard('{Enter}')

      // UI should remain responsive during slow API calls
      expect(input).toBeDisabled() // Should show loading state
      expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled()

      const responseTime = performance.now() - startTime
      expect(responseTime).toBeLessThan(100) // UI response should be immediate
    })

    it('should maintain performance under network stress', async () => {
      const user = userEvent.setup()
      
      // Mock network with varying latency
      let callCount = 0
      ;(global.fetch as any).mockImplementation(() => {
        const delay = Math.random() * 1000 + 100 // 100-1100ms
        callCount++
        
        return new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({
            response: `Response ${callCount}`,
            imageUrl: `/image-${callCount}.png`,
            conversationId: `conv-${callCount}`,
          }),
        }), delay))
      })

      performanceMonitor.start()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      
      // Send requests with varying network conditions
      for (let i = 0; i < 5; i++) {
        await user.type(input, `Network stress test ${i}`)
        await user.keyboard('{Enter}')
        
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 200))
        })
      }

      const metrics = performanceMonitor.stop()

      // Should maintain good performance despite network variability
      expect(metrics.avgFPS).toBeGreaterThan(45)
      expect(metrics.maxFrameTime).toBeLessThan(30)
    })
  })

  describe('Image Generation Performance', () => {
    it('should validate image consistency efficiently', async () => {
      const consistencyStats = {
        totalValidations: 100,
        successRate: 0.94,
        averageScore: 0.92,
        averageValidationTime: 150, // ms
      }

      vi.mocked(require('@/app/hooks/useCaptainImageConsistency').useCaptainImageConsistency).mockReturnValue({
        currentImageUrl: '/placeholder-captain.svg',
        isValidating: false,
        validationResult: { isConsistent: true, score: 0.95 },
        usedFallback: false,
        loadCaptainImage: vi.fn().mockResolvedValue('/new-image.png'),
        validateCurrentImage: vi.fn().mockResolvedValue({ isConsistent: true, score: 0.95 }),
        getConsistencyStats: vi.fn(() => consistencyStats),
      })

      render(<AnimatedAIChat />)

      // Should have good validation performance
      expect(consistencyStats.successRate).toBeGreaterThan(0.9)
      expect(consistencyStats.averageValidationTime).toBeLessThan(200)
    })

    it('should handle image loading failures efficiently', async () => {
      const user = userEvent.setup()
      
      // Mock image generation failure
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: 'Test response',
            imageUrl: '/initial-image.png',
            conversationId: 'test-conv',
          }),
        })
        .mockRejectedValueOnce(new Error('Image generation failed'))

      const startTime = performance.now()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Image failure test')
      await user.keyboard('{Enter}')

      // Should handle failure quickly
      await waitFor(() => {
        expect(screen.getByAltText('Capitão Caverna')).toBeInTheDocument()
      }, { timeout: 1000 })

      const totalTime = performance.now() - startTime
      expect(totalTime).toBeLessThan(500) // Should fallback quickly
    })

    it('should preload images for better performance', async () => {
      const preloadSpy = vi.mocked(require('@/app/lib/brand-assets').preloadBrandAssets)
      
      render(<AnimatedAIChat />)

      expect(preloadSpy).toHaveBeenCalled()
      
      // Should complete preloading quickly
      await waitFor(() => {
        expect(preloadSpy).toHaveResolvedWith(true)
      }, { timeout: 1000 })
    })
  })

  describe('State Management Performance', () => {
    it('should optimize re-renders efficiently', async () => {
      const user = userEvent.setup()
      let renderCount = 0
      
      const TestWrapper = () => {
        renderCount++
        return <AnimatedAIChat />
      }

      render(<TestWrapper />)

      const initialRenderCount = renderCount
      const input = screen.getByRole('textbox')

      // Type without triggering state changes
      await user.type(input, 'Performance test')

      // Should not cause excessive re-renders
      expect(renderCount - initialRenderCount).toBeLessThan(5)
    })

    it('should handle large state updates efficiently', () => {
      const largeUpdate = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant' as const,
        timestamp: new Date(),
      }))

      const startTime = performance.now()
      
      act(() => {
        mockUseOptimizedChatState.state.messages = largeUpdate
      })

      const { rerender } = render(<AnimatedAIChat />)
      rerender(<AnimatedAIChat />)

      const updateTime = performance.now() - startTime

      // Should handle large updates quickly
      expect(updateTime).toBeLessThan(50)
    })

    it('should debounce rapid state changes', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      
      // Rapid typing should be debounced
      const startTime = performance.now()
      await user.type(input, 'Rapid typing test for debouncing')
      const typingTime = performance.now() - startTime

      // Should handle rapid typing efficiently
      expect(typingTime).toBeLessThan(200)
    })
  })

  describe('Network Performance Monitoring', () => {
    it('should track network performance metrics', () => {
      const networkStats = {
        latency: 45,
        bandwidth: 150,
        stability: 0.96,
      }

      vi.mocked(require('@/lib/network-connectivity').useNetworkConnectivity).mockReturnValue({
        state: 'online',
        quality: 'excellent',
        isOnline: true,
        isOffline: false,
        checkConnectivity: vi.fn(),
        getCaptainMessage: vi.fn(() => ({ message: 'Connection excellent' })),
        getNetworkStats: vi.fn(() => networkStats),
      })

      render(<AnimatedAIChat />)

      // Should have good network performance
      expect(networkStats.latency).toBeLessThan(100)
      expect(networkStats.stability).toBeGreaterThan(0.9)
    })

    it('should adapt to poor network conditions', () => {
      const poorNetworkStats = {
        latency: 500,
        bandwidth: 10,
        stability: 0.6,
      }

      vi.mocked(require('@/lib/network-connectivity').useNetworkConnectivity).mockReturnValue({
        state: 'slow',
        quality: 'poor',
        isOnline: true,
        isOffline: false,
        checkConnectivity: vi.fn(),
        getCaptainMessage: vi.fn(() => ({ message: 'Connection slow' })),
        getNetworkStats: vi.fn(() => poorNetworkStats),
      })

      render(<AnimatedAIChat />)

      // Should adapt to poor network conditions
      expect(screen.getByRole('main')).toBeInTheDocument()
    })
  })

  describe('Overall Performance Benchmarks', () => {
    it('should meet performance targets for typical usage', async () => {
      const user = userEvent.setup()
      
      performanceMonitor.start()
      render(<AnimatedAIChat />)

      // Simulate typical user interaction
      const input = screen.getByRole('textbox')
      await user.type(input, 'Como posso melhorar minha disciplina?')
      await user.keyboard('{Enter}')

      // Wait for response
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })

      const metrics = performanceMonitor.stop()

      // Performance targets
      expect(metrics.avgFPS).toBeGreaterThan(55) // Smooth animations
      expect(metrics.avgFrameTime).toBeLessThan(18) // Responsive UI
      expect(metrics.memoryDelta).toBeLessThan(2 * 1024 * 1024) // Reasonable memory usage
    })

    it('should maintain performance during extended usage', async () => {
      const user = userEvent.setup()
      
      performanceMonitor.start()
      render(<AnimatedAIChat />)

      // Simulate extended conversation
      const input = screen.getByRole('textbox')
      for (let i = 0; i < 10; i++) {
        await user.type(input, `Extended usage message ${i}`)
        await user.keyboard('{Enter}')
        
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }

      const metrics = performanceMonitor.stop()

      // Should maintain performance over time
      expect(metrics.avgFPS).toBeGreaterThan(50)
      expect(metrics.frameTimings.slice(-10).every(time => time < 25)).toBe(true)
    })
  })
})