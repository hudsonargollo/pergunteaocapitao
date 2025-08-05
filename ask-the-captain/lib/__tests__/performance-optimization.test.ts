/**
 * Tests for Performance Optimization and Caching Systems
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  CacheManager, 
  ResponseCacheManager, 
  EmbeddingCacheManager, 
  ImageCacheManager 
} from '../cache-manager'
import { 
  EdgeMemoryManager, 
  RequestBatchManager, 
  EdgePerformanceMonitor 
} from '../edge-optimization'
import { 
  PerformanceMetricsCollector,
  createRequestMetric 
} from '../performance-monitoring'
import { CacheInvalidationManager } from '../cache-invalidation'
import type { SearchResult, ToneAnalysis } from '@/types'

describe('Cache Manager', () => {
  let cacheManager: CacheManager

  beforeEach(() => {
    cacheManager = new CacheManager({
      responses: { maxSize: 10, defaultTtl: 1000 },
      embeddings: { maxSize: 10, defaultTtl: 1000 },
      images: { maxSize: 10, defaultTtl: 1000 }
    })
  })

  describe('Response Cache', () => {
    it('should cache and retrieve responses', () => {
      const query = 'test query'
      const response = 'test response'
      const searchResults: SearchResult[] = [{
        content: 'test content',
        score: 0.9,
        metadata: { source: 'test' }
      }]
      const toneAnalysis: ToneAnalysis = {
        primary: 'supportive',
        intensity: 'medium',
        themes: ['test'],
        visualParameters: {
          pose: 'confident',
          expression: 'warm',
          environment: 'cave',
          lighting: 'soft'
        }
      }

      // Cache response
      cacheManager.responses.set(
        query,
        response,
        searchResults,
        toneAnalysis,
        'http://example.com/image.png'
      )

      // Retrieve response
      const cached = cacheManager.responses.get(query)
      expect(cached).toBeDefined()
      expect(cached?.response).toBe(response)
      expect(cached?.searchResults).toEqual(searchResults)
      expect(cached?.toneAnalysis).toEqual(toneAnalysis)
    })

    it('should handle cache expiration', async () => {
      const query = 'expiring query'
      const response = 'expiring response'
      const searchResults: SearchResult[] = []
      const toneAnalysis: ToneAnalysis = {
        primary: 'supportive',
        intensity: 'medium',
        themes: [],
        visualParameters: {
          pose: 'confident',
          expression: 'warm',
          environment: 'cave',
          lighting: 'soft'
        }
      }

      // Cache with short TTL
      cacheManager.responses.set(
        query,
        response,
        searchResults,
        toneAnalysis,
        undefined,
        undefined,
        10 // 10ms TTL
      )

      // Should be available immediately
      expect(cacheManager.responses.get(query)).toBeDefined()

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 20))

      // Should be expired
      expect(cacheManager.responses.get(query)).toBeNull()
    })
  })

  describe('Embedding Cache', () => {
    it('should cache and retrieve embeddings', () => {
      const content = 'test content'
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5]

      // Cache embedding
      cacheManager.embeddings.set(content, embedding)

      // Retrieve embedding
      const cached = cacheManager.embeddings.get(content)
      expect(cached).toEqual(embedding)
    })

    it('should handle different models', () => {
      const content = 'test content'
      const embedding1 = [0.1, 0.2, 0.3]
      const embedding2 = [0.4, 0.5, 0.6]

      // Cache with different models
      cacheManager.embeddings.set(content, embedding1, 'model-1')
      cacheManager.embeddings.set(content, embedding2, 'model-2')

      // Retrieve by model
      expect(cacheManager.embeddings.get(content, 'model-1')).toEqual(embedding1)
      expect(cacheManager.embeddings.get(content, 'model-2')).toEqual(embedding2)
    })
  })

  describe('Image Cache', () => {
    it('should cache and retrieve images', () => {
      const prompt = 'test prompt'
      const imageUrl = 'http://example.com/image.png'
      const r2ObjectKey = 'test-key'
      const promptParameters = { tone: 'supportive' }
      const generationTime = Date.now()

      // Cache image
      cacheManager.images.set(
        prompt,
        imageUrl,
        r2ObjectKey,
        promptParameters,
        generationTime
      )

      // Retrieve image
      const cached = cacheManager.images.get(prompt, promptParameters)
      expect(cached).toBeDefined()
      expect(cached?.imageUrl).toBe(imageUrl)
      expect(cached?.r2ObjectKey).toBe(r2ObjectKey)
      expect(cached?.promptParameters).toEqual(promptParameters)
    })
  })

  describe('Cache Statistics', () => {
    it('should provide comprehensive statistics', () => {
      // Add some test data
      cacheManager.responses.set('query1', 'response1', [], {} as ToneAnalysis)
      cacheManager.embeddings.set('content1', [0.1, 0.2])
      cacheManager.images.set('prompt1', 'url1', 'key1', {}, Date.now())

      const stats = cacheManager.getAllStats()

      expect(stats.responses.size).toBe(1)
      expect(stats.embeddings.size).toBe(1)
      expect(stats.images.size).toBe(1)
      expect(stats.overall.totalEntries).toBe(3)
    })
  })
})

describe('Edge Memory Manager', () => {
  let memoryManager: EdgeMemoryManager

  beforeEach(() => {
    memoryManager = new EdgeMemoryManager(10) // 10MB limit for testing
  })

  it('should track memory usage', () => {
    const operationId = 'test-operation'
    const sizeBytes = 1024 * 1024 // 1MB

    memoryManager.trackMemoryUsage(operationId, sizeBytes)

    expect(memoryManager.getTotalMemoryUsage()).toBe(1)
    expect(memoryManager.isMemoryAvailable(5)).toBe(true)
    expect(memoryManager.isMemoryAvailable(15)).toBe(false)
  })

  it('should release memory', () => {
    const operationId = 'test-operation'
    const sizeBytes = 1024 * 1024 // 1MB

    memoryManager.trackMemoryUsage(operationId, sizeBytes)
    expect(memoryManager.getTotalMemoryUsage()).toBe(1)

    memoryManager.releaseMemory(operationId)
    expect(memoryManager.getTotalMemoryUsage()).toBe(0)
  })

  it('should perform cleanup when threshold exceeded', () => {
    // Fill memory beyond threshold (80% of 10MB = 8MB)
    for (let i = 0; i < 10; i++) {
      memoryManager.trackMemoryUsage(`operation-${i}`, 1024 * 1024) // 1MB each
    }

    expect(memoryManager.getTotalMemoryUsage()).toBeLessThan(10)
  })

  it('should provide memory statistics', () => {
    memoryManager.trackMemoryUsage('test', 2 * 1024 * 1024) // 2MB

    const stats = memoryManager.getMemoryStats()
    expect(stats.totalUsage).toBe(2)
    expect(stats.maxMemory).toBe(10)
    expect(stats.utilizationPercent).toBe(20)
    expect(stats.trackedOperations).toBe(1)
  })
})

describe('Request Batch Manager', () => {
  let batchManager: RequestBatchManager

  beforeEach(() => {
    batchManager = new RequestBatchManager({
      batchSize: 3,
      maxConcurrency: 2,
      delayBetweenBatches: 10
    })
  })

  it('should batch requests', async () => {
    const processor = vi.fn().mockResolvedValue(['result1', 'result2', 'result3'])
    
    const promises = [
      batchManager.batchRequest('test-batch', 'data1', processor),
      batchManager.batchRequest('test-batch', 'data2', processor),
      batchManager.batchRequest('test-batch', 'data3', processor)
    ]

    const results = await Promise.all(promises)

    expect(results).toEqual(['result1', 'result2', 'result3'])
    expect(processor).toHaveBeenCalledTimes(1)
    expect(processor).toHaveBeenCalledWith(['data1', 'data2', 'data3'])
  })

  it('should handle batch processing errors', async () => {
    const processor = vi.fn().mockRejectedValue(new Error('Batch failed'))
    
    const promise = batchManager.batchRequest('test-batch', 'data1', processor)

    await expect(promise).rejects.toThrow('Batch failed')
  })

  it('should provide batch statistics', () => {
    // Add some pending requests (they won't be processed immediately due to delay)
    batchManager.batchRequest('batch1', 'data1', vi.fn())
    batchManager.batchRequest('batch1', 'data2', vi.fn())
    batchManager.batchRequest('batch2', 'data3', vi.fn())

    const stats = batchManager.getBatchStats()
    expect(stats.pendingBatches).toBe(2)
    expect(stats.totalPendingRequests).toBe(3)
    expect(stats.averageBatchSize).toBe(1.5)
  })
})

describe('Edge Performance Monitor', () => {
  let monitor: EdgePerformanceMonitor

  beforeEach(() => {
    monitor = new EdgePerformanceMonitor()
  })

  afterEach(() => {
    monitor.resetMetrics()
  })

  it('should track request performance', () => {
    const requestId = monitor.startRequest()
    const startTime = Date.now() - 100 // Simulate 100ms request

    monitor.endRequest(requestId, startTime)

    const metrics = monitor.getMetrics()
    expect(metrics.requestCount).toBe(1)
    expect(metrics.averageResponseTime).toBeGreaterThan(90)
    expect(metrics.averageResponseTime).toBeLessThan(110)
  })

  it('should track cache events', () => {
    monitor.recordCacheEvent(true)
    monitor.recordCacheEvent(false)
    monitor.recordCacheEvent(true)

    const metrics = monitor.getMetrics()
    expect(metrics.cacheHitRate).toBeCloseTo(0.67, 2)
  })

  it('should track error rates', () => {
    const requestId1 = monitor.startRequest()
    const requestId2 = monitor.startRequest()
    const startTime = Date.now() - 100

    monitor.endRequest(requestId1, startTime, false) // Success
    monitor.endRequest(requestId2, startTime, true)  // Error

    const metrics = monitor.getMetrics()
    expect(metrics.errorRate).toBe(0.5)
  })

  it('should assess performance health', () => {
    // Simulate good performance
    const requestId = monitor.startRequest()
    monitor.endRequest(requestId, Date.now() - 100) // 100ms response
    monitor.recordCacheEvent(true)
    monitor.recordMemoryUsage(50) // 50MB

    const health = monitor.isPerformanceHealthy()
    expect(health.healthy).toBe(true)
    expect(health.issues).toHaveLength(0)
  })

  it('should detect performance issues', () => {
    // Simulate poor performance
    const requestId = monitor.startRequest()
    monitor.endRequest(requestId, Date.now() - 6000, true) // 6s response with error
    monitor.recordCacheEvent(false)
    monitor.recordMemoryUsage(120) // 120MB

    const health = monitor.isPerformanceHealthy()
    expect(health.healthy).toBe(false)
    expect(health.issues.length).toBeGreaterThan(0)
    expect(health.recommendations.length).toBeGreaterThan(0)
  })
})

describe('Performance Metrics Collector', () => {
  let collector: PerformanceMetricsCollector

  beforeEach(() => {
    collector = new PerformanceMetricsCollector({} as any)
  })

  it('should record request metrics', () => {
    const metric = {
      requestId: 'test-request',
      endpoint: '/api/chat',
      method: 'POST',
      responseTime: 1000,
      statusCode: 200,
      memoryUsage: 50,
      cacheHit: true
    }

    collector.recordRequest(metric)

    const startTime = Date.now() - 60000 // 1 minute ago
    const stats = collector.getAggregatedMetrics(startTime)

    expect(stats.requests.total).toBe(1)
    expect(stats.requests.successful).toBe(1)
    expect(stats.cache.hitRate).toBe(1)
  })

  it('should aggregate metrics correctly', () => {
    const metrics = [
      {
        requestId: 'req1',
        endpoint: '/api/chat',
        method: 'POST',
        responseTime: 1000,
        statusCode: 200,
        memoryUsage: 50,
        cacheHit: true
      },
      {
        requestId: 'req2',
        endpoint: '/api/chat',
        method: 'POST',
        responseTime: 2000,
        statusCode: 500,
        memoryUsage: 75,
        cacheHit: false,
        errorType: 'timeout'
      }
    ]

    metrics.forEach(metric => collector.recordRequest(metric))

    const startTime = Date.now() - 60000
    const stats = collector.getAggregatedMetrics(startTime)

    expect(stats.requests.total).toBe(2)
    expect(stats.requests.successful).toBe(1)
    expect(stats.requests.failed).toBe(1)
    expect(stats.requests.averageResponseTime).toBe(1500)
    expect(stats.cache.hitRate).toBe(0.5)
    expect(stats.errors.errorRate).toBe(0.5)
    expect(stats.errors.errorsByType.timeout).toBe(1)
  })

  it('should export metrics in different formats', () => {
    const metric = {
      requestId: 'test-request',
      endpoint: '/api/chat',
      method: 'POST',
      responseTime: 1000,
      statusCode: 200,
      memoryUsage: 50,
      cacheHit: true
    }

    collector.recordRequest(metric)

    // Test JSON export
    const jsonExport = collector.exportMetrics('json')
    expect(() => JSON.parse(jsonExport)).not.toThrow()

    // Test CSV export
    const csvExport = collector.exportMetrics('csv')
    expect(csvExport).toContain('timestamp,requestId,endpoint')
    expect(csvExport).toContain('test-request')

    // Test Prometheus export
    const prometheusExport = collector.exportMetrics('prometheus')
    expect(prometheusExport).toContain('ask_captain_requests_total')
    expect(prometheusExport).toContain('ask_captain_response_time_seconds')
  })
})

describe('Cache Invalidation Manager', () => {
  let invalidationManager: CacheInvalidationManager

  beforeEach(() => {
    invalidationManager = new CacheInvalidationManager()
  })

  afterEach(() => {
    invalidationManager.destroy()
  })

  it('should add and remove invalidation rules', () => {
    const rule = {
      pattern: /^test:/,
      reason: 'test invalidation',
      priority: 'high' as const,
      action: 'delete' as const
    }

    invalidationManager.addInvalidationRule(rule)
    expect(invalidationManager.removeInvalidationRule(/^test:/)).toBe(true)
    expect(invalidationManager.removeInvalidationRule(/^nonexistent:/)).toBe(false)
  })

  it('should provide cache health metrics', () => {
    const health = invalidationManager.getCacheHealth()

    expect(health).toHaveProperty('hitRates')
    expect(health).toHaveProperty('memoryUsage')
    expect(health.hitRates).toHaveProperty('responses')
    expect(health.hitRates).toHaveProperty('embeddings')
    expect(health.hitRates).toHaveProperty('images')
    expect(health.hitRates).toHaveProperty('overall')
  })
})

describe('Utility Functions', () => {
  it('should create request metrics correctly', () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'user-agent': 'test-agent',
        'cf-ipcountry': 'US',
        'cf-colo': 'SFO'
      }
    })

    const response = new Response('{}', { status: 200 })
    const startTime = Date.now() - 1000
    const memoryUsage = 50
    const cacheHit = true

    const metric = createRequestMetric(
      request,
      response,
      startTime,
      memoryUsage,
      cacheHit
    )

    expect(metric.endpoint).toBe('/api/chat')
    expect(metric.method).toBe('POST')
    expect(metric.statusCode).toBe(200)
    expect(metric.memoryUsage).toBe(50)
    expect(metric.cacheHit).toBe(true)
    expect(metric.userAgent).toBe('test-agent')
    expect(metric.country).toBe('US')
    expect(metric.colo).toBe('SFO')
    expect(metric.responseTime).toBeGreaterThan(900)
  })
})