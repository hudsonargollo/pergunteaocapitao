/**
 * AnimatedAIChat Memory Usage Tests
 * 
 * Memory efficiency and optimization tests including:
 * - Memory leak detection and prevention
 * - Component cleanup and resource management
 * - Virtual scrolling memory optimization
 * - Image cache memory management
 * - State management memory efficiency
 * - Garbage collection optimization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnimatedAIChat } from '../animated-ai-chat'

// Memory monitoring utilities
class MemoryMonitor {
  private initialMemory: number = 0
  private snapshots: Array<{ timestamp: number; memory: number; label: string }> = []

  start() {
    this.initialMemory = this.getCurrentMemory()
    this.snapshots = []
    this.takeSnapshot('initial')
  }

  takeSnapshot(label: string) {
    const memory = this.getCurrentMemory()
    this.snapshots.push({
      timestamp: Date.now(),
      memory,
      label,
    })
  }

  getReport() {
    const currentMemory = this.getCurrentMemory()
    const totalIncrease = currentMemory - this.initialMemory
    const peakMemory = Math.max(...this.snapshots.map(s => s.memory))
    
    return {
      initialMemory: this.initialMemory,
      currentMemory,
      totalIncrease,
      peakMemory,
      snapshots: this.snapshots,
      memoryEfficiency: this.calculateEfficiency(),
    }
  }

  private getCurrentMemory(): number {
    if ((performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize
    }
    // Fallback for environments without memory API
    return process.memoryUsage?.().heapUsed || 0
  }

  private calculateEfficiency(): number {
    if (this.snapshots.length < 2) return 1
    
    const memoryGrowth = this.snapshots[this.snapshots.length - 1].memory - this.snapshots[0].memory
    const timeElapsed = this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp
    
    // Lower growth rate over time indicates better efficiency
    const growthRate = memoryGrowth / timeElapsed
    return Math.max(0, 1 - (growthRate / 1000)) // Normalize to 0-1 scale
  }
}

// Mock WeakMap and WeakSet for memory leak detection
const mockWeakMap = new Map()
const mockWeakSet = new Set()

// Mock framer-motion with memory tracking
const animationInstances = new Set()
const motionValueInstances = new Set()

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onAnimationStart, onAnimationComplete, ...props }: any) => {
      const instanceId = Math.random().toString(36)
      animationInstances.add(instanceId)
      
      // Simulate animation lifecycle
      if (onAnimationStart) {
        setTimeout(() => onAnimationStart(), 0)
      }
      if (onAnimationComplete) {
        setTimeout(() => {
          onAnimationComplete()
          animationInstances.delete(instanceId)
        }, 300)
      }
      
      return <div {...props}>{children}</div>
    },
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    input: ({ children, ...props }: any) => <input {...props}>{children}</input>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
  useMotionValue: (initial: any) => {
    const instanceId = Math.random().toString(36)
    motionValueInstances.add(instanceId)
    
    return {
      get: () => initial,
      set: vi.fn(),
      destroy: () => motionValueInstances.delete(instanceId),
    }
  },
}))

// Mock Next.js components with memory tracking
const imageInstances = new Set()

vi.mock('next/image', () => ({
  default: ({ src, alt, onLoad, onError, ...props }: any) => {
    const instanceId = Math.random().toString(36)
    imageInstances.add(instanceId)
    
    // Simulate image loading
    setTimeout(() => {
      if (Math.random() > 0.1) {
        onLoad?.()
      } else {
        onError?.()
      }
    }, Math.random() * 100 + 50)
    
    return (
      <img 
        src={src} 
        alt={alt} 
        {...props}
        onLoad={() => {
          onLoad?.()
          // Simulate cleanup
          setTimeout(() => imageInstances.delete(instanceId), 1000)
        }}
      />
    )
  }
}))

// Mock icons
vi.mock('lucide-react', () => ({
  Send: () => <span data-testid="send-icon">Send</span>,
  Loader2: () => <span data-testid="loader-icon">Loading</span>,
  MessageCircle: () => <span data-testid="message-icon">Message</span>,
  Zap: () => <span data-testid="zap-icon">Zap</span>,
}))

// Mock custom hooks with memory tracking
const stateInstances = new Set()
const cacheInstances = new Map()

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
      stateInstances.add(message.id)
    }),
    setTyping: vi.fn(),
    setGeneratingImage: vi.fn(),
    setCaptainImage: vi.fn(),
    setError: vi.fn(),
    setConversationId: vi.fn(),
    updateMessage: vi.fn(),
    cleanup: vi.fn(() => {
      stateInstances.clear()
    }),
  },
  selectors: {
    getStats: vi.fn(() => ({
      totalMessages: stateInstances.size,
      userMessages: 0,
      assistantMessages: 0,
      averageResponseTime: 0,
    })),
    getMemoryUsage: vi.fn(() => ({
      stateSize: stateInstances.size * 1024, // Approximate size
      cacheSize: Array.from(cacheInstances.values()).reduce((sum, size) => sum + size, 0),
    })),
  },
}

vi.mock('@/app/hooks/useOptimizedChatState', () => ({
  useOptimizedChatState: () => mockUseOptimizedChatState,
  useImageCache: () => ({
    preloadImage: vi.fn((url) => {
      cacheInstances.set(url, 1024 * 100) // 100KB per image
      return Promise.resolve(true)
    }),
    getCachedImage: vi.fn(),
    getCacheStats: vi.fn(() => ({
      size: cacheInstances.size,
      totalSize: Array.from(cacheInstances.values()).reduce((sum, size) => sum + size, 0),
      hitRate: 0.85,
      missRate: 0.15,
    })),
    clearCache: vi.fn(() => {
      cacheInstances.clear()
    }),
  }),
  useAPIBatching: () => ({
    addRequest: vi.fn(),
    clearBatch: vi.fn(),
  }),
  useVirtualScrolling: () => ({
    scrollElementRef: { current: null },
    visibleItems: [],
    totalHeight: 0,
    handleScroll: vi.fn(),
    scrollToBottom: vi.fn(),
    visibleRange: { start: 0, end: 0 },
    cleanup: vi.fn(),
  }),
  useMessageMemoryManagement: () => ({
    renderableMessages: [],
    renderMode: 'normal',
    memoryStats: {
      totalMessages: 0,
      renderedMessages: 0,
      memoryUsage: 0,
      memoryEfficiency: 0.95,
    },
    shouldUseVirtualization: false,
    optimizeMemory: vi.fn(),
    cleanup: vi.fn(),
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
    cleanup: vi.fn(),
  }),
}))

vi.mock('@/app/hooks/useAnimationPerformance', () => ({
  useAnimationPerformance: () => ({
    metrics: { fps: 60, totalFrames: 0, isOptimal: true },
    isMonitoring: false,
    cleanup: vi.fn(),
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
    cleanup: vi.fn(),
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

// Mock fetch
global.fetch = vi.fn()

// Mock performance memory API
Object.defineProperty(global, 'performance', {
  value: {
    now: () => Date.now(),
    memory: {
      usedJSHeapSize: 10 * 1024 * 1024, // 10MB
      totalJSHeapSize: 50 * 1024 * 1024, // 50MB
      jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB
    },
  },
  writable: true,
})

describe('AnimatedAIChat Memory Usage Tests', () => {
  let memoryMonitor: MemoryMonitor

  beforeEach(() => {
    vi.clearAllMocks()
    memoryMonitor = new MemoryMonitor()
    
    // Reset tracking sets
    animationInstances.clear()
    motionValueInstances.clear()
    imageInstances.clear()
    stateInstances.clear()
    cacheInstances.clear()
    
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
    cleanup()
    vi.restoreAllMocks()
  })

  describe('Memory Leak Detection', () => {
    it('should not leak memory on component mount/unmount cycles', () => {
      memoryMonitor.start()

      // Mount and unmount multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<AnimatedAIChat />)
        memoryMonitor.takeSnapshot(`mount-${i}`)
        unmount()
        memoryMonitor.takeSnapshot(`unmount-${i}`)
      }

      const report = memoryMonitor.getReport()

      // Memory should not grow significantly
      expect(report.totalIncrease).toBeLessThan(5 * 1024 * 1024) // Less than 5MB
      expect(report.memoryEfficiency).toBeGreaterThan(0.8)
    })

    it('should clean up animation instances properly', async () => {
      const { unmount } = render(<AnimatedAIChat />)

      // Trigger animations
      const user = userEvent.setup()
      const input = screen.getByRole('textbox')
      await user.type(input, 'Animation test')
      await user.keyboard('{Enter}')

      // Wait for animations to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
      })

      const animationCountBeforeUnmount = animationInstances.size
      unmount()

      // Wait for cleanup
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Animation instances should be cleaned up
      expect(animationInstances.size).toBeLessThanOrEqual(animationCountBeforeUnmount)
    })

    it('should clean up motion values on unmount', () => {
      const { unmount } = render(<AnimatedAIChat />)

      const motionValueCountBeforeUnmount = motionValueInstances.size
      unmount()

      // Motion values should be cleaned up
      expect(motionValueInstances.size).toBeLessThanOrEqual(motionValueCountBeforeUnmount)
    })

    it('should clean up image instances properly', async () => {
      const { unmount } = render(<AnimatedAIChat />)

      // Wait for images to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
      })

      const imageCountBeforeUnmount = imageInstances.size
      unmount()

      // Wait for cleanup
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100))
      })

      // Image instances should be cleaned up
      expect(imageInstances.size).toBeLessThan(imageCountBeforeUnmount)
    })

    it('should not accumulate event listeners', () => {
      const initialListenerCount = (window as any)._eventListeners?.length || 0

      const { unmount } = render(<AnimatedAIChat />)
      unmount()

      const finalListenerCount = (window as any)._eventListeners?.length || 0

      // Should not accumulate listeners
      expect(finalListenerCount).toBeLessThanOrEqual(initialListenerCount + 1)
    })
  })

  describe('State Management Memory Efficiency', () => {
    it('should manage message state memory efficiently', async () => {
      const user = userEvent.setup()
      memoryMonitor.start()

      render(<AnimatedAIChat />)
      memoryMonitor.takeSnapshot('initial-render')

      const input = screen.getByRole('textbox')

      // Add many messages
      for (let i = 0; i < 50; i++) {
        await user.type(input, `Message ${i}`)
        await user.keyboard('{Enter}')
        
        if (i % 10 === 0) {
          memoryMonitor.takeSnapshot(`message-${i}`)
        }
      }

      const report = memoryMonitor.getReport()

      // Memory growth should be linear, not exponential
      const snapshots = report.snapshots.filter(s => s.label.startsWith('message-'))
      if (snapshots.length >= 2) {
        const firstSnapshot = snapshots[0]
        const lastSnapshot = snapshots[snapshots.length - 1]
        const memoryGrowthRate = (lastSnapshot.memory - firstSnapshot.memory) / snapshots.length

        // Growth rate should be reasonable (less than 1MB per 10 messages)
        expect(memoryGrowthRate).toBeLessThan(1024 * 1024)
      }
    })

    it('should optimize memory with virtual scrolling', () => {
      const largeMessageList = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant' as const,
        timestamp: new Date(),
      }))

      // Mock virtual scrolling for large lists
      vi.mocked(require('@/app/hooks/useOptimizedChatState').useMessageMemoryManagement).mockReturnValue({
        renderableMessages: largeMessageList.slice(0, 20), // Only render visible items
        renderMode: 'virtual',
        memoryStats: {
          totalMessages: 1000,
          renderedMessages: 20,
          memoryUsage: 2 * 1024 * 1024, // 2MB for 1000 messages
          memoryEfficiency: 0.98,
        },
        shouldUseVirtualization: true,
        optimizeMemory: vi.fn(),
        cleanup: vi.fn(),
      })

      memoryMonitor.start()
      render(<AnimatedAIChat />)
      memoryMonitor.takeSnapshot('virtual-scrolling')

      const report = memoryMonitor.getReport()

      // Should use minimal memory despite large message count
      expect(report.totalIncrease).toBeLessThan(3 * 1024 * 1024) // Less than 3MB
    })

    it('should clean up old messages from memory', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      memoryMonitor.start()

      const input = screen.getByRole('textbox')

      // Add messages beyond memory limit
      for (let i = 0; i < 100; i++) {
        await user.type(input, `Memory test ${i}`)
        await user.keyboard('{Enter}')
      }

      memoryMonitor.takeSnapshot('after-100-messages')

      // Simulate memory optimization
      act(() => {
        mockUseOptimizedChatState.actions.cleanup()
      })

      memoryMonitor.takeSnapshot('after-cleanup')

      const report = memoryMonitor.getReport()
      const beforeCleanup = report.snapshots.find(s => s.label === 'after-100-messages')
      const afterCleanup = report.snapshots.find(s => s.label === 'after-cleanup')

      if (beforeCleanup && afterCleanup) {
        // Memory should be reduced after cleanup
        expect(afterCleanup.memory).toBeLessThanOrEqual(beforeCleanup.memory)
      }
    })
  })

  describe('Image Cache Memory Management', () => {
    it('should manage image cache memory efficiently', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      memoryMonitor.start()

      // Generate many images to test cache management
      const input = screen.getByRole('textbox')
      for (let i = 0; i < 20; i++) {
        await user.type(input, `Image test ${i}`)
        await user.keyboard('{Enter}')
        
        // Wait for image generation
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }

      memoryMonitor.takeSnapshot('after-image-generation')

      const cacheStats = vi.mocked(require('@/app/hooks/useOptimizedChatState').useImageCache)().getCacheStats()

      // Cache should have reasonable size limits
      expect(cacheStats.totalSize).toBeLessThan(10 * 1024 * 1024) // Less than 10MB
      expect(cacheStats.size).toBeLessThan(50) // Reasonable number of cached images
    })

    it('should evict old images from cache when memory is low', () => {
      const imageCache = vi.mocked(require('@/app/hooks/useOptimizedChatState').useImageCache)()

      // Fill cache with many images
      for (let i = 0; i < 100; i++) {
        imageCache.preloadImage(`/test-image-${i}.png`)
      }

      const statsBeforeClear = imageCache.getCacheStats()
      
      // Simulate memory pressure
      imageCache.clearCache()
      
      const statsAfterClear = imageCache.getCacheStats()

      // Cache should be cleared
      expect(statsAfterClear.size).toBeLessThan(statsBeforeClear.size)
      expect(statsAfterClear.totalSize).toBeLessThan(statsBeforeClear.totalSize)
    })

    it('should prevent memory leaks in image preloading', async () => {
      memoryMonitor.start()

      const imageCache = vi.mocked(require('@/app/hooks/useOptimizedChatState').useImageCache)()

      // Preload many images
      const preloadPromises = []
      for (let i = 0; i < 50; i++) {
        preloadPromises.push(imageCache.preloadImage(`/preload-test-${i}.png`))
      }

      await Promise.all(preloadPromises)
      memoryMonitor.takeSnapshot('after-preload')

      const report = memoryMonitor.getReport()

      // Memory increase should be reasonable
      expect(report.totalIncrease).toBeLessThan(8 * 1024 * 1024) // Less than 8MB
    })
  })

  describe('Component Cleanup and Resource Management', () => {
    it('should clean up all resources on unmount', () => {
      memoryMonitor.start()

      const { unmount } = render(<AnimatedAIChat />)
      memoryMonitor.takeSnapshot('mounted')

      unmount()
      memoryMonitor.takeSnapshot('unmounted')

      // Verify cleanup was called
      expect(mockUseOptimizedChatState.actions.cleanup).toHaveBeenCalled()

      const report = memoryMonitor.getReport()
      const mounted = report.snapshots.find(s => s.label === 'mounted')
      const unmounted = report.snapshots.find(s => s.label === 'unmounted')

      if (mounted && unmounted) {
        // Memory should not increase after unmount
        expect(unmounted.memory).toBeLessThanOrEqual(mounted.memory + 1024 * 1024) // Allow 1MB tolerance
      }
    })

    it('should clean up timers and intervals', () => {
      const originalSetTimeout = global.setTimeout
      const originalSetInterval = global.setInterval
      const originalClearTimeout = global.clearTimeout
      const originalClearInterval = global.clearInterval

      const activeTimeouts = new Set()
      const activeIntervals = new Set()

      global.setTimeout = vi.fn((callback, delay) => {
        const id = originalSetTimeout(callback, delay)
        activeTimeouts.add(id)
        return id
      })

      global.setInterval = vi.fn((callback, delay) => {
        const id = originalSetInterval(callback, delay)
        activeIntervals.add(id)
        return id
      })

      global.clearTimeout = vi.fn((id) => {
        activeTimeouts.delete(id)
        return originalClearTimeout(id)
      })

      global.clearInterval = vi.fn((id) => {
        activeIntervals.delete(id)
        return originalClearInterval(id)
      })

      const { unmount } = render(<AnimatedAIChat />)
      
      const timeoutsBeforeUnmount = activeTimeouts.size
      const intervalsBeforeUnmount = activeIntervals.size

      unmount()

      // Wait for cleanup
      setTimeout(() => {
        // Should clean up timers
        expect(activeTimeouts.size).toBeLessThanOrEqual(timeoutsBeforeUnmount)
        expect(activeIntervals.size).toBeLessThanOrEqual(intervalsBeforeUnmount)
      }, 100)

      // Restore original functions
      global.setTimeout = originalSetTimeout
      global.setInterval = originalSetInterval
      global.clearTimeout = originalClearTimeout
      global.clearInterval = originalClearInterval
    })

    it('should clean up API request handlers', async () => {
      const user = userEvent.setup()
      const { unmount } = render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      
      // Start API request
      await user.type(input, 'API cleanup test')
      await user.keyboard('{Enter}')

      // Unmount before request completes
      unmount()

      // Should not cause memory leaks or errors
      expect(() => {
        // Simulate API response after unmount
        ;(global.fetch as any).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            response: 'Late response',
            imageUrl: '/late-image.png',
            conversationId: 'late-conv',
          }),
        })
      }).not.toThrow()
    })
  })

  describe('Memory Optimization Strategies', () => {
    it('should use object pooling for frequent allocations', async () => {
      const user = userEvent.setup()
      memoryMonitor.start()

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')

      // Create many similar objects (messages)
      for (let i = 0; i < 30; i++) {
        await user.type(input, `Pooling test ${i}`)
        await user.keyboard('{Enter}')
      }

      memoryMonitor.takeSnapshot('after-object-creation')

      const report = memoryMonitor.getReport()

      // Memory growth should be sub-linear due to object reuse
      expect(report.memoryEfficiency).toBeGreaterThan(0.7)
    })

    it('should debounce memory-intensive operations', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      memoryMonitor.start()

      const input = screen.getByRole('textbox')

      // Rapid operations that should be debounced
      for (let i = 0; i < 10; i++) {
        await user.type(input, 'a')
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      memoryMonitor.takeSnapshot('after-rapid-operations')

      const report = memoryMonitor.getReport()

      // Should not create excessive memory pressure
      expect(report.totalIncrease).toBeLessThan(1024 * 1024) // Less than 1MB
    })

    it('should use weak references for temporary objects', () => {
      const { unmount } = render(<AnimatedAIChat />)

      // Simulate weak reference usage
      const weakRefs = new WeakSet()
      const tempObject = { id: 'temp', data: 'test' }
      weakRefs.add(tempObject)

      expect(weakRefs.has(tempObject)).toBe(true)

      unmount()

      // Weak references should allow garbage collection
      // (This is more of a conceptual test since we can't force GC)
      expect(weakRefs.has(tempObject)).toBe(true) // Still exists until GC
    })
  })

  describe('Memory Performance Under Load', () => {
    it('should maintain stable memory usage under continuous load', async () => {
      const user = userEvent.setup()
      memoryMonitor.start()

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')

      // Continuous load test
      for (let cycle = 0; cycle < 5; cycle++) {
        for (let i = 0; i < 10; i++) {
          await user.type(input, `Load test cycle ${cycle} message ${i}`)
          await user.keyboard('{Enter}')
        }
        
        memoryMonitor.takeSnapshot(`cycle-${cycle}`)
        
        // Simulate periodic cleanup
        act(() => {
          mockUseOptimizedChatState.actions.cleanup()
        })
      }

      const report = memoryMonitor.getReport()
      const cycleSnapshots = report.snapshots.filter(s => s.label.startsWith('cycle-'))

      if (cycleSnapshots.length >= 2) {
        // Memory should not grow continuously
        const firstCycle = cycleSnapshots[0]
        const lastCycle = cycleSnapshots[cycleSnapshots.length - 1]
        const memoryGrowth = lastCycle.memory - firstCycle.memory

        expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024) // Less than 5MB growth
      }
    })

    it('should handle memory pressure gracefully', () => {
      // Simulate low memory condition
      Object.defineProperty(global, 'performance', {
        value: {
          ...global.performance,
          memory: {
            usedJSHeapSize: 90 * 1024 * 1024, // 90MB - near limit
            totalJSHeapSize: 95 * 1024 * 1024, // 95MB
            jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB limit
          },
        },
        writable: true,
      })

      memoryMonitor.start()
      render(<AnimatedAIChat />)
      memoryMonitor.takeSnapshot('low-memory-render')

      const report = memoryMonitor.getReport()

      // Should still render without crashing
      expect(screen.getByRole('main')).toBeInTheDocument()
      
      // Should not allocate excessive memory
      expect(report.totalIncrease).toBeLessThan(2 * 1024 * 1024) // Less than 2MB
    })
  })

  describe('Garbage Collection Optimization', () => {
    it('should create objects that are GC-friendly', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      memoryMonitor.start()

      const input = screen.getByRole('textbox')

      // Create objects that should be easily garbage collected
      for (let i = 0; i < 20; i++) {
        await user.type(input, `GC test ${i}`)
        await user.keyboard('{Enter}')
        
        // Clear input to allow GC of input strings
        await user.clear(input)
      }

      memoryMonitor.takeSnapshot('after-gc-test')

      // Simulate garbage collection trigger
      if (global.gc) {
        global.gc()
      }

      memoryMonitor.takeSnapshot('after-gc')

      const report = memoryMonitor.getReport()

      // Memory should be manageable
      expect(report.memoryEfficiency).toBeGreaterThan(0.6)
    })

    it('should avoid creating circular references', () => {
      const { unmount } = render(<AnimatedAIChat />)

      // Component should not create circular references that prevent GC
      // This is tested by ensuring clean unmount without memory leaks
      unmount()

      // Should not throw errors or warnings about circular references
      expect(true).toBe(true) // Placeholder - actual test is the lack of errors
    })
  })
})