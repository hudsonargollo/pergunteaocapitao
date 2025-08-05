/**
 * Edge Optimization Utilities for Cloudflare Workers
 * Implements edge-optimized patterns, memory management, and performance monitoring
 */

// CloudflareEnv is now available globally from cloudflare-env.d.ts

export interface EdgeOptimizationOptions {
  memoryThreshold: number // MB
  requestTimeout: number // ms
  batchSize: number
  concurrencyLimit: number
  enableMetrics: boolean
}

export interface PerformanceMetrics {
  requestCount: number
  averageResponseTime: number
  memoryUsage: number
  errorRate: number
  cacheHitRate: number
  lastReset: number
}

export interface BatchProcessingOptions {
  batchSize: number
  maxConcurrency: number
  delayBetweenBatches: number
  failureThreshold: number
}

/**
 * Edge-optimized memory manager for V8 isolates
 */
export class EdgeMemoryManager {
  private memoryUsage = new Map<string, number>()
  private readonly maxMemoryMB: number
  private readonly cleanupThreshold: number

  constructor(maxMemoryMB: number = 128) {
    this.maxMemoryMB = maxMemoryMB
    this.cleanupThreshold = maxMemoryMB * 0.8 // 80% threshold
  }

  /**
   * Track memory usage for a specific operation
   */
  trackMemoryUsage(operationId: string, sizeBytes: number): void {
    const sizeMB = sizeBytes / (1024 * 1024)
    this.memoryUsage.set(operationId, sizeMB)
    
    // Trigger cleanup if threshold exceeded
    if (this.getTotalMemoryUsage() > this.cleanupThreshold) {
      this.performCleanup()
    }
  }

  /**
   * Release memory for completed operation
   */
  releaseMemory(operationId: string): void {
    this.memoryUsage.delete(operationId)
  }

  /**
   * Get current total memory usage
   */
  getTotalMemoryUsage(): number {
    return Array.from(this.memoryUsage.values()).reduce((sum, usage) => sum + usage, 0)
  }

  /**
   * Check if memory usage is within limits
   */
  isMemoryAvailable(requiredMB: number): boolean {
    return this.getTotalMemoryUsage() + requiredMB <= this.maxMemoryMB
  }

  /**
   * Perform memory cleanup
   */
  private performCleanup(): void {
    // Clear oldest entries first
    const entries = Array.from(this.memoryUsage.entries())
      .sort(([, a], [, b]) => b - a) // Sort by size, largest first
    
    const toRemove = Math.ceil(entries.length * 0.3) // Remove 30% of entries
    
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.memoryUsage.delete(entries[i][0])
    }

    console.log(`Memory cleanup: removed ${toRemove} entries, current usage: ${this.getTotalMemoryUsage()}MB`)
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): {
    totalUsage: number
    maxMemory: number
    utilizationPercent: number
    trackedOperations: number
  } {
    const totalUsage = this.getTotalMemoryUsage()
    
    return {
      totalUsage,
      maxMemory: this.maxMemoryMB,
      utilizationPercent: (totalUsage / this.maxMemoryMB) * 100,
      trackedOperations: this.memoryUsage.size
    }
  }
}

/**
 * Request batching manager for external API calls
 */
export class RequestBatchManager {
  private pendingRequests = new Map<string, Array<{
    resolve: (value: any) => void
    reject: (error: any) => void
    data: any
  }>>()
  
  private batchTimers = new Map<string, NodeJS.Timeout>()
  private readonly options: Required<BatchProcessingOptions>

  constructor(options: Partial<BatchProcessingOptions> = {}) {
    this.options = {
      batchSize: options.batchSize ?? 10,
      maxConcurrency: options.maxConcurrency ?? 3,
      delayBetweenBatches: options.delayBetweenBatches ?? 100,
      failureThreshold: options.failureThreshold ?? 0.3
    }
  }

  /**
   * Add request to batch
   */
  async batchRequest<T>(
    batchKey: string,
    requestData: any,
    processor: (batch: any[]) => Promise<T[]>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Initialize batch if not exists
      if (!this.pendingRequests.has(batchKey)) {
        this.pendingRequests.set(batchKey, [])
      }

      const batch = this.pendingRequests.get(batchKey)!
      batch.push({ resolve, reject, data: requestData })

      // Process batch if it reaches the size limit
      if (batch.length >= this.options.batchSize) {
        this.processBatch(batchKey, processor)
      } else {
        // Set timer to process batch after delay
        this.setBatchTimer(batchKey, processor)
      }
    })
  }

  /**
   * Process a batch of requests
   */
  private async processBatch<T>(
    batchKey: string,
    processor: (batch: any[]) => Promise<T[]>
  ): Promise<void> {
    const batch = this.pendingRequests.get(batchKey)
    if (!batch || batch.length === 0) return

    // Clear the batch and timer
    this.pendingRequests.delete(batchKey)
    const timer = this.batchTimers.get(batchKey)
    if (timer) {
      clearTimeout(timer)
      this.batchTimers.delete(batchKey)
    }

    try {
      const requestData = batch.map(item => item.data)
      const results = await processor(requestData)

      // Resolve individual promises
      batch.forEach((item, index) => {
        if (results && results[index] !== undefined) {
          item.resolve(results[index])
        } else {
          item.reject(new Error('Batch processing failed for this item'))
        }
      })

    } catch (error) {
      // Reject all promises in the batch
      batch.forEach(item => item.reject(error))
    }
  }

  /**
   * Set timer for batch processing
   */
  private setBatchTimer<T>(
    batchKey: string,
    processor: (batch: any[]) => Promise<T[]>
  ): void {
    // Clear existing timer
    const existingTimer = this.batchTimers.get(batchKey)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.processBatch(batchKey, processor)
    }, this.options.delayBetweenBatches)

    this.batchTimers.set(batchKey, timer)
  }

  /**
   * Get batch statistics
   */
  getBatchStats(): {
    pendingBatches: number
    totalPendingRequests: number
    averageBatchSize: number
  } {
    const batches = Array.from(this.pendingRequests.values())
    const totalRequests = batches.reduce((sum, batch) => sum + batch.length, 0)
    
    return {
      pendingBatches: batches.length,
      totalPendingRequests: totalRequests,
      averageBatchSize: batches.length > 0 ? totalRequests / batches.length : 0
    }
  }
}

/**
 * Performance monitoring for edge functions
 */
export class EdgePerformanceMonitor {
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    errorRate: 0,
    cacheHitRate: 0,
    lastReset: Date.now()
  }

  private responseTimes: number[] = []
  private errorCount = 0
  private cacheHits = 0
  private cacheMisses = 0

  /**
   * Record request start
   */
  startRequest(): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return requestId
  }

  /**
   * Record request completion
   */
  endRequest(requestId: string, startTime: number, error?: boolean): void {
    const responseTime = Date.now() - startTime
    
    this.metrics.requestCount++
    this.responseTimes.push(responseTime)
    
    if (error) {
      this.errorCount++
    }

    // Keep only last 100 response times for memory efficiency
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100)
    }

    this.updateMetrics()
  }

  /**
   * Record cache hit/miss
   */
  recordCacheEvent(hit: boolean): void {
    if (hit) {
      this.cacheHits++
    } else {
      this.cacheMisses++
    }
    this.updateMetrics()
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(memoryMB: number): void {
    this.metrics.memoryUsage = memoryMB
  }

  /**
   * Update calculated metrics
   */
  private updateMetrics(): void {
    // Calculate average response time
    if (this.responseTimes.length > 0) {
      this.metrics.averageResponseTime = 
        this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
    }

    // Calculate error rate
    this.metrics.errorRate = this.metrics.requestCount > 0 
      ? this.errorCount / this.metrics.requestCount 
      : 0

    // Calculate cache hit rate
    const totalCacheEvents = this.cacheHits + this.cacheMisses
    this.metrics.cacheHitRate = totalCacheEvents > 0 
      ? this.cacheHits / totalCacheEvents 
      : 0
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      errorRate: 0,
      cacheHitRate: 0,
      lastReset: Date.now()
    }
    
    this.responseTimes = []
    this.errorCount = 0
    this.cacheHits = 0
    this.cacheMisses = 0
  }

  /**
   * Check if performance is healthy
   */
  isPerformanceHealthy(): {
    healthy: boolean
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []

    // Check response time
    if (this.metrics.averageResponseTime > 5000) {
      issues.push('High average response time')
      recommendations.push('Consider optimizing slow operations or adding caching')
    }

    // Check error rate
    if (this.metrics.errorRate > 0.05) {
      issues.push('High error rate')
      recommendations.push('Review error handling and add more robust fallbacks')
    }

    // Check memory usage
    if (this.metrics.memoryUsage > 100) {
      issues.push('High memory usage')
      recommendations.push('Optimize memory usage or implement more aggressive cleanup')
    }

    // Check cache hit rate
    if (this.metrics.cacheHitRate < 0.5) {
      issues.push('Low cache hit rate')
      recommendations.push('Review caching strategy and cache key generation')
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations
    }
  }
}

/**
 * Edge-optimized utility functions
 */

/**
 * Create memory-efficient JSON parser
 */
export function parseJSONSafely<T>(
  jsonString: string,
  maxSizeMB: number = 1
): { success: boolean; data?: T; error?: string } {
  try {
    // Check size before parsing
    const sizeBytes = new Blob([jsonString]).size
    const sizeMB = sizeBytes / (1024 * 1024)
    
    if (sizeMB > maxSizeMB) {
      return {
        success: false,
        error: `JSON size (${sizeMB.toFixed(2)}MB) exceeds limit (${maxSizeMB}MB)`
      }
    }

    const data = JSON.parse(jsonString) as T
    return { success: true, data }

  } catch (error) {
    return {
      success: false,
      error: `JSON parsing failed: ${error}`
    }
  }
}

/**
 * Create memory-efficient string operations
 */
export function truncateString(
  str: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (str.length <= maxLength) return str
  
  const truncateLength = maxLength - suffix.length
  return str.substring(0, truncateLength) + suffix
}

/**
 * Efficient array chunking for batch processing
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * Create timeout wrapper for edge functions
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    })
  ])
}

/**
 * Memory-efficient object cloning
 */
export function cloneObject<T>(obj: T, maxDepth: number = 5): T {
  if (maxDepth <= 0 || obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }

  if (Array.isArray(obj)) {
    return obj.map(item => cloneObject(item, maxDepth - 1)) as unknown as T
  }

  const cloned = {} as T
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = cloneObject(obj[key], maxDepth - 1)
    }
  }

  return cloned
}

/**
 * Create singleton instances for edge optimization
 */
export const edgeMemoryManager = new EdgeMemoryManager(128) // 128MB limit
export const requestBatchManager = new RequestBatchManager({
  batchSize: 10,
  maxConcurrency: 3,
  delayBetweenBatches: 100
})
export const performanceMonitor = new EdgePerformanceMonitor()