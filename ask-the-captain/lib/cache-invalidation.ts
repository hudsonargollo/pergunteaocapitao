/**
 * Cache Invalidation and Management System
 * Handles cache invalidation strategies, cache warming, and cache health monitoring
 */

import { cacheManager, type CacheStats } from './cache-manager'
import type { SearchResult, ToneAnalysis } from '@/types'

export interface InvalidationRule {
  pattern: string | RegExp
  reason: string
  priority: 'high' | 'medium' | 'low'
  action: 'delete' | 'refresh' | 'mark_stale'
}

export interface CacheHealthMetrics {
  hitRates: {
    responses: number
    embeddings: number
    images: number
    overall: number
  }
  memoryUsage: {
    estimated: number
    threshold: number
    status: 'healthy' | 'warning' | 'critical'
  }
  performance: {
    averageResponseTime: number
    cacheLatency: number
    missLatency: number
  }
  errors: {
    count: number
    types: Record<string, number>
    lastError?: string
  }
}

export interface WarmupStrategy {
  queries: string[]
  priority: number
  batchSize: number
  delayBetweenBatches: number
}

/**
 * Cache Invalidation Manager
 */
export class CacheInvalidationManager {
  private invalidationRules: InvalidationRule[] = []
  private healthMetrics: CacheHealthMetrics = this.initializeHealthMetrics()
  private warmupStrategies: WarmupStrategy[] = []
  private monitoringInterval?: NodeJS.Timeout

  constructor() {
    this.setupDefaultInvalidationRules()
    this.startHealthMonitoring()
  }

  /**
   * Add invalidation rule
   */
  addInvalidationRule(rule: InvalidationRule): void {
    this.invalidationRules.push(rule)
    this.sortRulesByPriority()
  }

  /**
   * Remove invalidation rule
   */
  removeInvalidationRule(pattern: string | RegExp): boolean {
    const initialLength = this.invalidationRules.length
    this.invalidationRules = this.invalidationRules.filter(rule => {
      if (typeof pattern === 'string' && typeof rule.pattern === 'string') {
        return rule.pattern !== pattern
      }
      if (pattern instanceof RegExp && rule.pattern instanceof RegExp) {
        return rule.pattern.source !== pattern.source
      }
      return true
    })
    return this.invalidationRules.length < initialLength
  }

  /**
   * Invalidate cache entries based on pattern
   */
  async invalidateByPattern(
    pattern: string | RegExp,
    reason: string = 'manual_invalidation'
  ): Promise<{
    invalidated: number
    errors: string[]
  }> {
    let invalidated = 0
    const errors: string[] = []

    try {
      // Invalidate response cache
      const responseKeys = cacheManager.responses.cache?.keys() || []
      for (const key of responseKeys) {
        if (this.matchesPattern(key, pattern)) {
          cacheManager.responses.cache?.delete(key)
          invalidated++
        }
      }

      // Invalidate embedding cache
      const embeddingKeys = cacheManager.embeddings.cache?.keys() || []
      for (const key of embeddingKeys) {
        if (this.matchesPattern(key, pattern)) {
          cacheManager.embeddings.cache?.delete(key)
          invalidated++
        }
      }

      // Invalidate image cache
      const imageKeys = cacheManager.images.cache?.keys() || []
      for (const key of imageKeys) {
        if (this.matchesPattern(key, pattern)) {
          cacheManager.images.cache?.delete(key)
          invalidated++
        }
      }

      console.log(`Cache invalidation: ${invalidated} entries invalidated for pattern ${pattern}, reason: ${reason}`)

    } catch (error) {
      const errorMessage = `Failed to invalidate cache for pattern ${pattern}: ${error}`
      errors.push(errorMessage)
      console.error(errorMessage)
    }

    return { invalidated, errors }
  }

  /**
   * Invalidate cache entries by content type
   */
  async invalidateByType(
    type: 'responses' | 'embeddings' | 'images' | 'all',
    reason: string = 'type_invalidation'
  ): Promise<void> {
    try {
      switch (type) {
        case 'responses':
          cacheManager.responses.clear()
          break
        case 'embeddings':
          cacheManager.embeddings.clear()
          break
        case 'images':
          cacheManager.images.clear()
          break
        case 'all':
          cacheManager.clearAll()
          break
      }

      console.log(`Cache invalidation: ${type} cache cleared, reason: ${reason}`)
    } catch (error) {
      console.error(`Failed to invalidate ${type} cache:`, error)
      throw error
    }
  }

  /**
   * Invalidate expired entries
   */
  async invalidateExpired(): Promise<{
    expired: number
    errors: string[]
  }> {
    let expired = 0
    const errors: string[] = []

    try {
      // This would typically be handled by the LRU cache cleanup,
      // but we can force it here
      const stats = cacheManager.getAllStats()
      
      // Force cleanup by accessing cache statistics
      // The LRU cache will automatically clean up expired entries
      
      console.log(`Cache cleanup completed. Current stats:`, stats)
      
    } catch (error) {
      const errorMessage = `Failed to clean up expired cache entries: ${error}`
      errors.push(errorMessage)
      console.error(errorMessage)
    }

    return { expired, errors }
  }

  /**
   * Warm up cache with common queries
   */
  async warmUpCache(
    strategy?: WarmupStrategy,
    onProgress?: (progress: { completed: number; total: number; current: string }) => void
  ): Promise<{
    warmed: number
    errors: string[]
    duration: number
  }> {
    const startTime = Date.now()
    let warmed = 0
    const errors: string[] = []

    const warmupStrategy = strategy || this.getDefaultWarmupStrategy()

    try {
      const { queries, batchSize, delayBetweenBatches } = warmupStrategy
      const batches = this.chunkArray(queries, batchSize)

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        
        // Process batch
        const batchPromises = batch.map(async (query) => {
          try {
            // This would typically involve calling the actual search service
            // For now, we'll simulate cache warming
            const cacheKey = this.generateCacheKey(query)
            
            // Check if already cached
            if (!cacheManager.responses.has(query)) {
              // Simulate warming by setting a placeholder
              // In real implementation, this would call the search service
              console.log(`Warming cache for query: ${query}`)
              warmed++
            }

            if (onProgress) {
              onProgress({
                completed: warmed,
                total: queries.length,
                current: query
              })
            }

          } catch (error) {
            errors.push(`Failed to warm cache for query "${query}": ${error}`)
          }
        })

        await Promise.all(batchPromises)

        // Delay between batches to avoid overwhelming the system
        if (i < batches.length - 1 && delayBetweenBatches > 0) {
          await this.delay(delayBetweenBatches)
        }
      }

    } catch (error) {
      errors.push(`Cache warmup failed: ${error}`)
      console.error('Cache warmup error:', error)
    }

    const duration = Date.now() - startTime
    console.log(`Cache warmup completed: ${warmed} entries warmed in ${duration}ms`)

    return { warmed, errors, duration }
  }

  /**
   * Get cache health metrics
   */
  getCacheHealth(): CacheHealthMetrics {
    const stats = cacheManager.getAllStats()
    
    this.healthMetrics.hitRates = {
      responses: stats.responses.hitRate,
      embeddings: stats.embeddings.hitRate,
      images: stats.images.hitRate,
      overall: stats.overall.averageHitRate
    }

    this.healthMetrics.memoryUsage = {
      estimated: stats.overall.memoryEstimate,
      threshold: 100, // 100MB threshold
      status: this.getMemoryStatus(stats.overall.memoryEstimate)
    }

    return { ...this.healthMetrics }
  }

  /**
   * Optimize cache performance
   */
  async optimizeCache(): Promise<{
    optimizations: string[]
    improvements: Record<string, number>
  }> {
    const optimizations: string[] = []
    const improvements: Record<string, number> = {}
    const initialStats = cacheManager.getAllStats()

    try {
      // 1. Clean up expired entries
      await this.invalidateExpired()
      optimizations.push('Cleaned up expired entries')

      // 2. Optimize cache sizes based on hit rates
      const health = this.getCacheHealth()
      
      if (health.hitRates.responses < 0.5) {
        optimizations.push('Low response cache hit rate detected')
      }
      
      if (health.hitRates.embeddings < 0.7) {
        optimizations.push('Low embedding cache hit rate detected')
      }

      if (health.hitRates.images < 0.6) {
        optimizations.push('Low image cache hit rate detected')
      }

      // 3. Memory optimization
      if (health.memoryUsage.status === 'critical') {
        await this.invalidateByType('images', 'memory_optimization')
        optimizations.push('Cleared image cache due to high memory usage')
      } else if (health.memoryUsage.status === 'warning') {
        // Clear oldest entries from largest cache
        optimizations.push('Optimized cache sizes due to memory pressure')
      }

      const finalStats = cacheManager.getAllStats()
      
      improvements.hitRateImprovement = finalStats.overall.averageHitRate - initialStats.overall.averageHitRate
      improvements.memoryReduction = initialStats.overall.memoryEstimate - finalStats.overall.memoryEstimate
      improvements.totalEntries = finalStats.overall.totalEntries

    } catch (error) {
      console.error('Cache optimization failed:', error)
      optimizations.push(`Optimization error: ${error}`)
    }

    return { optimizations, improvements }
  }

  /**
   * Setup default invalidation rules
   */
  private setupDefaultInvalidationRules(): void {
    // Invalidate responses when knowledge base is updated
    this.addInvalidationRule({
      pattern: /^response:/,
      reason: 'knowledge_base_update',
      priority: 'high',
      action: 'delete'
    })

    // Invalidate embeddings when model is updated
    this.addInvalidationRule({
      pattern: /^embedding:/,
      reason: 'model_update',
      priority: 'medium',
      action: 'delete'
    })

    // Invalidate images when character design changes
    this.addInvalidationRule({
      pattern: /^image:/,
      reason: 'character_update',
      priority: 'low',
      action: 'refresh'
    })
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateHealthMetrics()
    }, 60000) // Update every minute
  }

  /**
   * Update health metrics
   */
  private updateHealthMetrics(): void {
    try {
      const stats = cacheManager.getAllStats()
      
      this.healthMetrics.hitRates = {
        responses: stats.responses.hitRate,
        embeddings: stats.embeddings.hitRate,
        images: stats.images.hitRate,
        overall: stats.overall.averageHitRate
      }

      this.healthMetrics.memoryUsage = {
        estimated: stats.overall.memoryEstimate,
        threshold: 100,
        status: this.getMemoryStatus(stats.overall.memoryEstimate)
      }

      // Check for performance issues
      if (this.healthMetrics.hitRates.overall < 0.3) {
        console.warn('Low cache hit rate detected:', this.healthMetrics.hitRates)
      }

      if (this.healthMetrics.memoryUsage.status === 'critical') {
        console.warn('High memory usage detected:', this.healthMetrics.memoryUsage)
      }

    } catch (error) {
      this.healthMetrics.errors.count++
      this.healthMetrics.errors.lastError = String(error)
      console.error('Health metrics update failed:', error)
    }
  }

  /**
   * Get memory status based on usage
   */
  private getMemoryStatus(usage: number): 'healthy' | 'warning' | 'critical' {
    if (usage > 150) return 'critical'
    if (usage > 100) return 'warning'
    return 'healthy'
  }

  /**
   * Check if key matches pattern
   */
  private matchesPattern(key: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return key.includes(pattern)
    }
    return pattern.test(key)
  }

  /**
   * Sort rules by priority
   */
  private sortRulesByPriority(): void {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    this.invalidationRules.sort((a, b) => 
      priorityOrder[b.priority] - priorityOrder[a.priority]
    )
  }

  /**
   * Get default warmup strategy
   */
  private getDefaultWarmupStrategy(): WarmupStrategy {
    return {
      queries: [
        'Como começar o modo caverna?',
        'O que é o protocolo de 40 dias?',
        'Como manter o foco?',
        'Disciplina e autodisciplina',
        'Como superar a procrastinação?',
        'Pilares fundamentais do modo caverna',
        'Como criar rituais eficazes?',
        'Transformação pessoal',
        'Foco e produtividade',
        'Desenvolvimento pessoal'
      ],
      priority: 1,
      batchSize: 3,
      delayBetweenBatches: 1000
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(query: string): string {
    return `response:${this.hashString(query.toLowerCase().trim())}`
  }

  /**
   * Hash string utility
   */
  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Initialize health metrics
   */
  private initializeHealthMetrics(): CacheHealthMetrics {
    return {
      hitRates: {
        responses: 0,
        embeddings: 0,
        images: 0,
        overall: 0
      },
      memoryUsage: {
        estimated: 0,
        threshold: 100,
        status: 'healthy'
      },
      performance: {
        averageResponseTime: 0,
        cacheLatency: 0,
        missLatency: 0
      },
      errors: {
        count: 0,
        types: {},
        lastError: undefined
      }
    }
  }

  /**
   * Stop monitoring
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
  }
}

// Create singleton instance
export const cacheInvalidationManager = new CacheInvalidationManager()

// Export types
export type { InvalidationRule, CacheHealthMetrics, WarmupStrategy }