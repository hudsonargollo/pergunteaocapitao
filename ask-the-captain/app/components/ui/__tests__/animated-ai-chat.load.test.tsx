/**
 * AnimatedAIChat Load Testing
 * 
 * Load testing for API integration under various conditions including:
 * - High concurrent request handling
 * - Network latency and timeout scenarios
 * - Rate limiting and throttling behavior
 * - Error recovery under load
 * - Performance degradation testing
 * - Stress testing with extreme conditions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnimatedAIChat } from '../animated-ai-chat'

// Load testing utilities
class LoadTestRunner {
  private results: Array<{
    testName: string
    startTime: number
    endTime: number
    success: boolean
    error?: string
    metrics: {
      responseTime: number
      throughput: number
      errorRate: number
      concurrency: number
    }
  }> = []

  async runConcurrentTest(
    testName: string,
    testFunction: () => Promise<void>,
    concurrency: number,
    iterations: number
  ) {
    const startTime = Date.now()
    const promises: Promise<{ success: boolean; error?: string; responseTime: number }>[] = []

    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < concurrency; j++) {
        promises.push(this.wrapTestFunction(testFunction))
      }
    }

    const results = await Promise.allSettled(promises)
    const endTime = Date.now()

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful
    const totalTime = endTime - startTime
    const avgResponseTime = results
      .filter(r => r.status === 'fulfilled')
      .reduce((sum, r) => sum + (r as any).value.responseTime, 0) / results.length

    this.results.push({
      testName,
      startTime,
      endTime,
      success: failed === 0,
      metrics: {
        responseTime: avgResponseTime,
        throughput: (successful / totalTime) * 1000, // requests per second
        errorRate: failed / results.length,
        concurrency,
      },
    })

    return {
      successful,
      failed,
      totalTime,
      avgResponseTime,
      throughput: (successful / totalTime) * 1000,
      errorRate: failed / results.length,
    }
  }

  private async wrapTestFunction(testFunction: () => Promise<void>): Promise<{
    success: boolean
    error?: string
    responseTime: number
  }> {
    const startTime = Date.now()
    try {
      await testFunction()
      return {
        success: true,
        responseTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      }
    }
  }

  getResults() {
    return this.results
  }

  generateReport() {
    return {
      totalTests: this.results.length,
      successfulTests: this.results.filter(r => r.success).length,
      averageResponseTime: this.results.reduce((sum, r) => sum + r.metrics.responseTime, 0) / this.results.length,
      averageThroughput: this.results.reduce((sum, r) => sum + r.metrics.throughput, 0) / this.results.length,
      averageErrorRate: this.results.reduce((sum, r) => sum + r.metrics.errorRate, 0) / this.results.length,
      results: this.results,
    }
  }
}

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
  default: ({ src, alt, onLoad, onError, ...props }: any) => {
    // Simulate variable image loading times
    setTimeout(() => {
      if (Math.random() > 0.05) { // 95% success rate
        onLoad?.()
      } else {
        onError?.()
      }
    }, Math.random() * 200 + 50) // 50-250ms load time
    
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

// Create configurable fetch mock for load testing
const createLoadTestFetch = (config: {
  chatLatency?: { min: number; max: number }
  imageLatency?: { min: number; max: number }
  errorRate?: number
  rateLimitThreshold?: number
  timeoutRate?: number
}) => {
  let requestCount = 0
  const {
    chatLatency = { min: 100, max: 500 },
    imageLatency = { min: 200, max: 800 },
    errorRate = 0.05,
    rateLimitThreshold = 100,
    timeoutRate = 0.02,
  } = config

  return vi.fn().mockImplementation(async (url: string, options: any) => {
    requestCount++

    // Simulate rate limiting
    if (requestCount > rateLimitThreshold) {
      if (Math.random() < 0.3) { // 30% chance of rate limit after threshold
        throw new Error('Rate limit exceeded')
      }
    }

    // Simulate timeouts
    if (Math.random() < timeoutRate) {
      throw new Error('Request timeout')
    }

    // Simulate general errors
    if (Math.random() < errorRate) {
      throw new Error('Network error')
    }

    const isChat = url === '/api/chat'
    const latency = isChat ? chatLatency : imageLatency
    const delay = Math.random() * (latency.max - latency.min) + latency.min

    await new Promise(resolve => setTimeout(resolve, delay))

    if (isChat) {
      const body = JSON.parse(options.body)
      return {
        ok: true,
        json: () => Promise.resolve({
          response: `Response to: ${body.message}`,
          imageUrl: `/response-image-${requestCount}.png`,
          conversationId: body.conversationId || `conv_${requestCount}`,
        }),
      }
    } else {
      return {
        ok: true,
        json: () => Promise.resolve({
          imageUrl: `/generated-image-${requestCount}.png`,
          imageId: `img_${requestCount}`,
          promptParameters: {},
        }),
      }
    }
  })
}

describe('AnimatedAIChat Load Testing', () => {
  let loadTestRunner: LoadTestRunner

  beforeEach(() => {
    vi.clearAllMocks()
    loadTestRunner = new LoadTestRunner()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent chat requests', async () => {
      global.fetch = createLoadTestFetch({
        chatLatency: { min: 100, max: 300 },
        errorRate: 0.02,
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'Concurrent test message')
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalled()
        }, { timeout: 2000 })
      }

      const results = await loadTestRunner.runConcurrentTest(
        'concurrent-chat-requests',
        testFunction,
        5, // 5 concurrent requests
        3  // 3 iterations
      )

      expect(results.successful).toBeGreaterThan(10) // At least 10 successful requests
      expect(results.errorRate).toBeLessThan(0.1) // Less than 10% error rate
      expect(results.avgResponseTime).toBeLessThan(1000) // Less than 1 second average
      expect(results.throughput).toBeGreaterThan(5) // At least 5 requests per second
    })

    it('should handle high-frequency user interactions', async () => {
      global.fetch = createLoadTestFetch({
        chatLatency: { min: 50, max: 150 },
        errorRate: 0.01,
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        
        // Rapid fire messages
        for (let i = 0; i < 5; i++) {
          await user.type(input, `Rapid message ${i}`)
          await user.keyboard('{Enter}')
          
          // Small delay between messages
          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 20))
          })
        }
      }

      const results = await loadTestRunner.runConcurrentTest(
        'high-frequency-interactions',
        testFunction,
        3, // 3 concurrent users
        2  // 2 iterations each
      )

      expect(results.successful).toBeGreaterThan(4) // Most tests should succeed
      expect(results.errorRate).toBeLessThan(0.15) // Allow higher error rate for rapid requests
      expect(results.avgResponseTime).toBeLessThan(2000) // Should complete within 2 seconds
    })

    it('should maintain performance under sustained load', async () => {
      global.fetch = createLoadTestFetch({
        chatLatency: { min: 200, max: 400 },
        imageLatency: { min: 300, max: 600 },
        errorRate: 0.03,
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'Sustained load test')
        await user.keyboard('{Enter}')

        // Wait for both chat and image requests
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledTimes(2)
        }, { timeout: 3000 })
      }

      const results = await loadTestRunner.runConcurrentTest(
        'sustained-load',
        testFunction,
        8, // 8 concurrent requests
        5  // 5 iterations
      )

      expect(results.successful).toBeGreaterThan(30) // Most requests should succeed
      expect(results.errorRate).toBeLessThan(0.2) // Allow some errors under high load
      expect(results.throughput).toBeGreaterThan(3) // Maintain reasonable throughput
    })
  })

  describe('Network Latency and Timeout Scenarios', () => {
    it('should handle high latency gracefully', async () => {
      global.fetch = createLoadTestFetch({
        chatLatency: { min: 2000, max: 4000 }, // Very high latency
        errorRate: 0.05,
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'High latency test')
        await user.keyboard('{Enter}')

        // Should show loading state immediately
        expect(screen.getByRole('textbox')).toBeDisabled()
        
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalled()
        }, { timeout: 6000 })
      }

      const results = await loadTestRunner.runConcurrentTest(
        'high-latency',
        testFunction,
        2, // Lower concurrency for high latency
        3  // 3 iterations
      )

      expect(results.successful).toBeGreaterThan(4) // Should handle high latency
      expect(results.avgResponseTime).toBeGreaterThan(2000) // Should reflect high latency
    })

    it('should recover from timeout errors', async () => {
      global.fetch = createLoadTestFetch({
        chatLatency: { min: 100, max: 300 },
        timeoutRate: 0.3, // 30% timeout rate
        errorRate: 0.05,
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'Timeout recovery test')
        await user.keyboard('{Enter}')

        // Should handle timeouts gracefully
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 1000))
        })
      }

      const results = await loadTestRunner.runConcurrentTest(
        'timeout-recovery',
        testFunction,
        4, // 4 concurrent requests
        3  // 3 iterations
      )

      // Should handle some timeouts but not crash
      expect(results.errorRate).toBeLessThan(0.5) // Some errors expected
      expect(results.successful).toBeGreaterThan(5) // Some should succeed
    })

    it('should adapt to variable network conditions', async () => {
      // Simulate changing network conditions
      let currentLatency = { min: 100, max: 300 }
      let currentErrorRate = 0.02

      global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
        // Simulate network degradation over time
        if (Math.random() < 0.1) {
          currentLatency = { min: 500, max: 1000 }
          currentErrorRate = 0.1
        }

        if (Math.random() < currentErrorRate) {
          throw new Error('Network degraded')
        }

        const delay = Math.random() * (currentLatency.max - currentLatency.min) + currentLatency.min
        await new Promise(resolve => setTimeout(resolve, delay))

        const isChat = url === '/api/chat'
        if (isChat) {
          const body = JSON.parse(options.body)
          return {
            ok: true,
            json: () => Promise.resolve({
              response: `Adaptive response to: ${body.message}`,
              imageUrl: '/adaptive-image.png',
              conversationId: body.conversationId || 'adaptive_conv',
            }),
          }
        } else {
          return {
            ok: true,
            json: () => Promise.resolve({
              imageUrl: '/adaptive-generated.png',
              imageId: 'adaptive_img',
              promptParameters: {},
            }),
          }
        }
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'Variable network test')
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalled()
        }, { timeout: 3000 })
      }

      const results = await loadTestRunner.runConcurrentTest(
        'variable-network',
        testFunction,
        3, // 3 concurrent requests
        4  // 4 iterations
      )

      expect(results.successful).toBeGreaterThan(8) // Should adapt to conditions
      expect(results.errorRate).toBeLessThan(0.3) // Some errors expected due to degradation
    })
  })

  describe('Rate Limiting and Throttling', () => {
    it('should handle rate limiting gracefully', async () => {
      global.fetch = createLoadTestFetch({
        chatLatency: { min: 100, max: 200 },
        rateLimitThreshold: 10, // Low threshold for testing
        errorRate: 0.02,
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'Rate limit test')
        await user.keyboard('{Enter}')

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 500))
        })
      }

      const results = await loadTestRunner.runConcurrentTest(
        'rate-limiting',
        testFunction,
        6, // 6 concurrent requests
        3  // 3 iterations (18 total requests)
      )

      // Should hit rate limits but handle them gracefully
      expect(results.errorRate).toBeGreaterThan(0.1) // Some rate limit errors expected
      expect(results.successful).toBeGreaterThan(10) // Some should still succeed
    })

    it('should implement client-side throttling', async () => {
      global.fetch = createLoadTestFetch({
        chatLatency: { min: 50, max: 100 },
        errorRate: 0.01,
      })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      const startTime = Date.now()

      // Send multiple rapid requests
      for (let i = 0; i < 5; i++) {
        await user.type(input, `Throttle test ${i}`)
        await user.keyboard('{Enter}')
        
        // No delay - test throttling
      }

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Should throttle requests (not all should fire immediately)
      expect(totalTime).toBeGreaterThan(200) // Should take some time due to throttling
      expect(global.fetch).toHaveBeenCalledTimes(1) // Should throttle to 1 request
    })

    it('should queue requests during rate limits', async () => {
      let requestQueue: Array<() => void> = []
      let isRateLimited = false

      global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
        if (isRateLimited) {
          // Queue the request
          return new Promise((resolve) => {
            requestQueue.push(() => {
              resolve({
                ok: true,
                json: () => Promise.resolve({
                  response: 'Queued response',
                  imageUrl: '/queued-image.png',
                  conversationId: 'queued_conv',
                }),
              })
            })
          })
        }

        // Simulate rate limiting after 3 requests
        if ((global.fetch as any).mock.calls.length > 3) {
          isRateLimited = true
          setTimeout(() => {
            isRateLimited = false
            // Process queued requests
            requestQueue.forEach(resolve => resolve())
            requestQueue = []
          }, 1000)
        }

        await new Promise(resolve => setTimeout(resolve, 100))

        return {
          ok: true,
          json: () => Promise.resolve({
            response: 'Normal response',
            imageUrl: '/normal-image.png',
            conversationId: 'normal_conv',
          }),
        }
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'Queue test')
        await user.keyboard('{Enter}')

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 1500))
        })
      }

      const results = await loadTestRunner.runConcurrentTest(
        'request-queuing',
        testFunction,
        5, // 5 concurrent requests
        2  // 2 iterations
      )

      expect(results.successful).toBeGreaterThan(7) // Most should eventually succeed
      expect(results.avgResponseTime).toBeGreaterThan(500) // Should take longer due to queuing
    })
  })

  describe('Error Recovery Under Load', () => {
    it('should recover from cascading failures', async () => {
      let failureCount = 0
      const maxFailures = 5

      global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
        // Simulate cascading failures
        if (failureCount < maxFailures) {
          failureCount++
          throw new Error(`Cascading failure ${failureCount}`)
        }

        // Start recovering
        await new Promise(resolve => setTimeout(resolve, 200))

        return {
          ok: true,
          json: () => Promise.resolve({
            response: 'Recovery response',
            imageUrl: '/recovery-image.png',
            conversationId: 'recovery_conv',
          }),
        }
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'Cascading failure test')
        await user.keyboard('{Enter}')

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 1000))
        })
      }

      const results = await loadTestRunner.runConcurrentTest(
        'cascading-failures',
        testFunction,
        3, // 3 concurrent requests
        3  // 3 iterations
      )

      // Should eventually recover
      expect(results.successful).toBeGreaterThan(3) // Some should succeed after recovery
      expect(results.errorRate).toBeLessThan(0.8) // Not all should fail
    })

    it('should maintain stability during partial outages', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
        const isChat = url === '/api/chat'
        
        if (isChat) {
          // Chat API is stable
          await new Promise(resolve => setTimeout(resolve, 150))
          const body = JSON.parse(options.body)
          return {
            ok: true,
            json: () => Promise.resolve({
              response: `Stable response to: ${body.message}`,
              imageUrl: '/stable-image.png',
              conversationId: body.conversationId || 'stable_conv',
            }),
          }
        } else {
          // Image API has outage
          throw new Error('Image service unavailable')
        }
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'Partial outage test')
        await user.keyboard('{Enter}')

        // Should get chat response but image generation should fail
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
        }, { timeout: 1000 })
      }

      const results = await loadTestRunner.runConcurrentTest(
        'partial-outage',
        testFunction,
        4, // 4 concurrent requests
        3  // 3 iterations
      )

      // Chat should work, image generation should fail gracefully
      expect(results.successful).toBeGreaterThan(8) // Chat requests should succeed
      expect(results.avgResponseTime).toBeLessThan(1000) // Should be reasonably fast
    })

    it('should implement circuit breaker pattern', async () => {
      let consecutiveFailures = 0
      let circuitOpen = false

      global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
        if (circuitOpen) {
          throw new Error('Circuit breaker open')
        }

        // Simulate failures
        if (Math.random() < 0.7) { // 70% failure rate
          consecutiveFailures++
          if (consecutiveFailures >= 3) {
            circuitOpen = true
            // Reset circuit after delay
            setTimeout(() => {
              circuitOpen = false
              consecutiveFailures = 0
            }, 2000)
          }
          throw new Error('Service failure')
        }

        consecutiveFailures = 0
        await new Promise(resolve => setTimeout(resolve, 100))

        return {
          ok: true,
          json: () => Promise.resolve({
            response: 'Circuit breaker success',
            imageUrl: '/circuit-success.png',
            conversationId: 'circuit_conv',
          }),
        }
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'Circuit breaker test')
        await user.keyboard('{Enter}')

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 500))
        })
      }

      const results = await loadTestRunner.runConcurrentTest(
        'circuit-breaker',
        testFunction,
        3, // 3 concurrent requests
        4  // 4 iterations
      )

      // Circuit breaker should prevent cascading failures
      expect(results.errorRate).toBeGreaterThan(0.5) // High error rate expected
      expect(results.avgResponseTime).toBeLessThan(1000) // Should fail fast when circuit is open
    })
  })

  describe('Performance Degradation Testing', () => {
    it('should maintain usability under extreme load', async () => {
      global.fetch = createLoadTestFetch({
        chatLatency: { min: 1000, max: 3000 }, // Very slow responses
        imageLatency: { min: 2000, max: 5000 },
        errorRate: 0.2, // High error rate
        rateLimitThreshold: 5, // Low rate limit
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        // UI should remain responsive even under extreme load
        const input = screen.getByRole('textbox')
        expect(input).toBeInTheDocument()

        await user.type(input, 'Extreme load test')
        
        // Should be able to interact with UI immediately
        expect(input).toHaveValue('Extreme load test')
        
        await user.keyboard('{Enter}')
        
        // Should show loading state
        expect(input).toBeDisabled()
      }

      const results = await loadTestRunner.runConcurrentTest(
        'extreme-load',
        testFunction,
        10, // 10 concurrent requests
        2   // 2 iterations
      )

      // UI should remain functional even if API calls fail
      expect(results.successful).toBeGreaterThan(15) // UI interactions should succeed
    })

    it('should degrade gracefully with limited resources', async () => {
      // Simulate resource constraints
      const originalSetTimeout = global.setTimeout
      let timeoutCount = 0

      global.setTimeout = vi.fn((callback, delay) => {
        timeoutCount++
        if (timeoutCount > 50) {
          // Simulate resource exhaustion
          throw new Error('Too many timers')
        }
        return originalSetTimeout(callback, delay)
      })

      global.fetch = createLoadTestFetch({
        chatLatency: { min: 100, max: 300 },
        errorRate: 0.05,
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'Resource constraint test')
        await user.keyboard('{Enter}')

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 200))
        })
      }

      try {
        const results = await loadTestRunner.runConcurrentTest(
          'resource-constraints',
          testFunction,
          8, // 8 concurrent requests
          3  // 3 iterations
        )

        // Should handle resource constraints gracefully
        expect(results.successful).toBeGreaterThan(10)
      } finally {
        global.setTimeout = originalSetTimeout
      }
    })
  })

  describe('Load Test Reporting', () => {
    it('should generate comprehensive load test report', async () => {
      // Run a comprehensive load test
      global.fetch = createLoadTestFetch({
        chatLatency: { min: 100, max: 400 },
        imageLatency: { min: 200, max: 600 },
        errorRate: 0.05,
        rateLimitThreshold: 50,
      })

      const testFunction = async () => {
        const user = userEvent.setup()
        render(<AnimatedAIChat />)

        const input = screen.getByRole('textbox')
        await user.type(input, 'Comprehensive load test')
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalled()
        }, { timeout: 2000 })
      }

      await loadTestRunner.runConcurrentTest(
        'comprehensive-load',
        testFunction,
        5, // 5 concurrent requests
        4  // 4 iterations
      )

      const report = loadTestRunner.generateReport()

      expect(report.totalTests).toBe(1)
      expect(report.averageResponseTime).toBeGreaterThan(0)
      expect(report.averageThroughput).toBeGreaterThan(0)
      expect(report.averageErrorRate).toBeLessThan(0.3)
      expect(report.results).toHaveLength(1)
      expect(report.results[0].metrics).toHaveProperty('responseTime')
      expect(report.results[0].metrics).toHaveProperty('throughput')
      expect(report.results[0].metrics).toHaveProperty('errorRate')
      expect(report.results[0].metrics).toHaveProperty('concurrency')
    })
  })
})