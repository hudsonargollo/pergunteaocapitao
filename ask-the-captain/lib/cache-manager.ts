/**
 * Comprehensive Caching Manager for Ask the Captain
 * Implements multi-layer caching for responses, embeddings, and images
 */

import type { SearchResult, EmbeddingVector, ToneAnalysis } from '@/types'

// Cache interfaces
export interface CacheEntry<T> {
  key: string
  value: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
  metadata?: Record<string, any>
}

export interface CacheOptions {
  maxSize: number
  defaultTtl: number
  cleanupInterval: number
  compressionEnabled: boolean
}

export interface CacheStats {
  size: number
  maxSize: number
  hitRate: number
  totalHits: number
  totalMisses: number
  oldestEntry: number
  newestEntry: number
}

// Response cache entry
export interface ResponseCacheEntry {
  query: string
  response: string
  searchResults: SearchResult[]
  toneAnalysis: ToneAnalysis
  imageUrl?: string
  conversationContext?: string
}

// Embedding cache entry
export interface EmbeddingCacheEntry {
  content: string
  embedding: number[]
  model: string
  tokenCount: number
}

// Image cache entry
export interface ImageCacheEntry {
  prompt: string
  imageUrl: string
  r2ObjectKey: string
  promptParameters: Record<string, any>
  generationTime: number
}

/**
 * Generic LRU Cache with TTL support
 */
class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private accessOrder = new Map<string, number>()
  private options: Required<CacheOptions>
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  }
  private cleanupTimer?: NodeJS.Timeout

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      maxSize: options.maxSize ?? 1000,
      defaultTtl: options.defaultTtl ?? 30 * 60 * 1000, // 30 minutes
      cleanupInterval: options.cleanupInterval ?? 5 * 60 * 1000, // 5 minutes
      compressionEnabled: options.compressionEnabled ?? false
    }

    this.startCleanup()
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key)
      this.stats.misses++
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = Date.now()
    this.accessOrder.set(key, entry.lastAccessed)
    this.stats.hits++

    return entry.value
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now()
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      ttl: ttl ?? this.options.defaultTtl,
      accessCount: 1,
      lastAccessed: now
    }

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key)
    }

    // Evict entries if cache is full
    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, entry)
    this.accessOrder.set(key, now)
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    this.accessOrder.delete(key)
    return deleted
  }

  /**
   * Check if entry exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    if (this.isExpired(entry)) {
      this.delete(key)
      return false
    }
    
    return true
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.stats = { hits: 0, misses: 0, evictions: 0 }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values())
    const timestamps = entries.map(e => e.timestamp)
    
    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
    }
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey = ''
    let oldestTime = Date.now()

    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.delete(oldestKey)
      this.stats.evictions++
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.options.cleanupInterval)
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => this.delete(key))
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
  }
}

/**
 * Response Cache Manager
 */
export class ResponseCacheManager {
  private cache: LRUCache<ResponseCacheEntry>

  constructor(options: Partial<CacheOptions> = {}) {
    this.cache = new LRUCache<ResponseCacheEntry>({
      maxSize: 500,
      defaultTtl: 15 * 60 * 1000, // 15 minutes for responses
      ...options
    })
  }

  /**
   * Generate cache key for query
   */
  private generateKey(query: string, context?: string): string {
    const normalizedQuery = query.toLowerCase().trim()
    const contextHash = context ? this.hashString(context) : ''
    return `response:${this.hashString(normalizedQuery)}:${contextHash}`
  }

  /**
   * Get cached response
   */
  get(query: string, context?: string): ResponseCacheEntry | null {
    const key = this.generateKey(query, context)
    return this.cache.get(key)
  }

  /**
   * Cache response
   */
  set(
    query: string,
    response: string,
    searchResults: SearchResult[],
    toneAnalysis: ToneAnalysis,
    imageUrl?: string,
    context?: string,
    ttl?: number
  ): void {
    const key = this.generateKey(query, context)
    const entry: ResponseCacheEntry = {
      query,
      response,
      searchResults,
      toneAnalysis,
      imageUrl,
      conversationContext: context
    }
    
    this.cache.set(key, entry, ttl)
  }

  /**
   * Check if response is cached
   */
  has(query: string, context?: string): boolean {
    const key = this.generateKey(query, context)
    return this.cache.has(key)
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats()
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }
}

/**
 * Embedding Cache Manager
 */
export class EmbeddingCacheManager {
  private cache: LRUCache<EmbeddingCacheEntry>

  constructor(options: Partial<CacheOptions> = {}) {
    this.cache = new LRUCache<EmbeddingCacheEntry>({
      maxSize: 2000,
      defaultTtl: 60 * 60 * 1000, // 1 hour for embeddings
      ...options
    })
  }

  /**
   * Generate cache key for content
   */
  private generateKey(content: string, model: string = 'text-embedding-3-small'): string {
    const contentHash = this.hashString(content.trim())
    return `embedding:${model}:${contentHash}`
  }

  /**
   * Get cached embedding
   */
  get(content: string, model?: string): number[] | null {
    const key = this.generateKey(content, model)
    const entry = this.cache.get(key)
    return entry ? entry.embedding : null
  }

  /**
   * Cache embedding
   */
  set(
    content: string,
    embedding: number[],
    model: string = 'text-embedding-3-small',
    tokenCount?: number,
    ttl?: number
  ): void {
    const key = this.generateKey(content, model)
    const entry: EmbeddingCacheEntry = {
      content,
      embedding,
      model,
      tokenCount: tokenCount ?? this.estimateTokenCount(content)
    }
    
    this.cache.set(key, entry, ttl)
  }

  /**
   * Check if embedding is cached
   */
  has(content: string, model?: string): boolean {
    const key = this.generateKey(content, model)
    return this.cache.has(key)
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats()
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Estimate token count
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * Simple string hash function
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
}

/**
 * Image Cache Manager
 */
export class ImageCacheManager {
  private cache: LRUCache<ImageCacheEntry>

  constructor(options: Partial<CacheOptions> = {}) {
    this.cache = new LRUCache<ImageCacheEntry>({
      maxSize: 200,
      defaultTtl: 2 * 60 * 60 * 1000, // 2 hours for images
      ...options
    })
  }

  /**
   * Generate cache key for image prompt
   */
  private generateKey(prompt: string, parameters?: Record<string, any>): string {
    const promptHash = this.hashString(prompt.trim())
    const paramsHash = parameters ? this.hashString(JSON.stringify(parameters)) : ''
    return `image:${promptHash}:${paramsHash}`
  }

  /**
   * Get cached image
   */
  get(prompt: string, parameters?: Record<string, any>): ImageCacheEntry | null {
    const key = this.generateKey(prompt, parameters)
    return this.cache.get(key)
  }

  /**
   * Cache image
   */
  set(
    prompt: string,
    imageUrl: string,
    r2ObjectKey: string,
    promptParameters: Record<string, any>,
    generationTime: number,
    ttl?: number
  ): void {
    const key = this.generateKey(prompt, promptParameters)
    const entry: ImageCacheEntry = {
      prompt,
      imageUrl,
      r2ObjectKey,
      promptParameters,
      generationTime
    }
    
    this.cache.set(key, entry, ttl)
  }

  /**
   * Check if image is cached
   */
  has(prompt: string, parameters?: Record<string, any>): boolean {
    const key = this.generateKey(prompt, parameters)
    return this.cache.has(key)
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats()
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Simple string hash function
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
}

/**
 * Unified Cache Manager
 */
export class CacheManager {
  public readonly responses: ResponseCacheManager
  public readonly embeddings: EmbeddingCacheManager
  public readonly images: ImageCacheManager

  constructor(options: {
    responses?: Partial<CacheOptions>
    embeddings?: Partial<CacheOptions>
    images?: Partial<CacheOptions>
  } = {}) {
    this.responses = new ResponseCacheManager(options.responses)
    this.embeddings = new EmbeddingCacheManager(options.embeddings)
    this.images = new ImageCacheManager(options.images)
  }

  /**
   * Get comprehensive cache statistics
   */
  getAllStats(): {
    responses: CacheStats
    embeddings: CacheStats
    images: CacheStats
    overall: {
      totalEntries: number
      averageHitRate: number
      memoryEstimate: number
    }
  } {
    const responseStats = this.responses.getStats()
    const embeddingStats = this.embeddings.getStats()
    const imageStats = this.images.getStats()

    const totalEntries = responseStats.size + embeddingStats.size + imageStats.size
    const averageHitRate = (responseStats.hitRate + embeddingStats.hitRate + imageStats.hitRate) / 3
    
    // Rough memory estimate (in MB)
    const memoryEstimate = (
      responseStats.size * 2 + // ~2KB per response
      embeddingStats.size * 6 + // ~6KB per embedding (1536 * 4 bytes)
      imageStats.size * 0.1     // ~100 bytes per image metadata
    ) / 1024

    return {
      responses: responseStats,
      embeddings: embeddingStats,
      images: imageStats,
      overall: {
        totalEntries,
        averageHitRate,
        memoryEstimate
      }
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.responses.clear()
    this.embeddings.clear()
    this.images.clear()
  }

  /**
   * Warm up cache with common queries
   */
  async warmUp(commonQueries: string[]): Promise<void> {
    // This would be implemented to pre-populate cache with common responses
    console.log(`Warming up cache with ${commonQueries.length} common queries`)
    // Implementation would depend on having access to the search and response services
  }
}

// Create singleton instance
export const cacheManager = new CacheManager({
  responses: {
    maxSize: 500,
    defaultTtl: 15 * 60 * 1000 // 15 minutes
  },
  embeddings: {
    maxSize: 2000,
    defaultTtl: 60 * 60 * 1000 // 1 hour
  },
  images: {
    maxSize: 200,
    defaultTtl: 2 * 60 * 60 * 1000 // 2 hours
  }
})