// Embedding generation service with rate limiting and batch processing
import { OpenAIClient } from './openai'
import { cacheManager } from './cache-manager'
import type { DocumentChunk, EmbeddingVector } from '@/types'

export interface EmbeddingOptions {
  batchSize?: number
  maxRetries?: number
  retryDelay?: number
  rateLimit?: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
}

export interface EmbeddingProgress {
  processed: number
  total: number
  currentBatch: number
  totalBatches: number
  errors: Array<{ chunk: string; error: string }>
}

export class EmbeddingService {
  private readonly defaultOptions: Required<EmbeddingOptions> = {
    batchSize: 100, // OpenAI allows up to 2048 inputs per request
    maxRetries: 3,
    retryDelay: 1000, // 1 second base delay
    rateLimit: {
      requestsPerMinute: 50, // Conservative rate limit
      tokensPerMinute: 150000 // OpenAI's typical limit
    }
  }

  private requestCount = 0
  private tokenCount = 0
  private lastResetTime = Date.now()
  private openaiClient: OpenAIClient

  constructor(
    apiKey: string,
    private options: EmbeddingOptions = {}
  ) {
    this.options = { ...this.defaultOptions, ...options }
    this.openaiClient = new OpenAIClient(apiKey)
  }

  /**
   * Generate embeddings for a batch of document chunks
   */
  async generateEmbeddings(
    chunks: DocumentChunk[],
    onProgress?: (progress: EmbeddingProgress) => void
  ): Promise<EmbeddingVector[]> {
    const embeddings: EmbeddingVector[] = []
    const errors: Array<{ chunk: string; error: string }> = []
    const totalBatches = Math.ceil(chunks.length / this.options.batchSize!)

    for (let i = 0; i < chunks.length; i += this.options.batchSize!) {
      const batch = chunks.slice(i, i + this.options.batchSize!)
      const batchNumber = Math.floor(i / this.options.batchSize!) + 1

      try {
        // Wait for rate limit if necessary
        await this.waitForRateLimit(batch)

        // Process batch with retries
        const batchEmbeddings = await this.processBatchWithRetries(batch)
        embeddings.push(...batchEmbeddings)

        // Report progress
        if (onProgress) {
          onProgress({
            processed: i + batch.length,
            total: chunks.length,
            currentBatch: batchNumber,
            totalBatches,
            errors: [...errors]
          })
        }

      } catch (error) {
        // Log batch error and continue with individual processing
        console.error(`Batch ${batchNumber} failed, processing individually:`, error)
        
        const individualResults = await this.processIndividualChunks(batch, errors)
        embeddings.push(...individualResults)

        if (onProgress) {
          onProgress({
            processed: i + batch.length,
            total: chunks.length,
            currentBatch: batchNumber,
            totalBatches,
            errors: [...errors]
          })
        }
      }
    }

    return embeddings
  }

  /**
   * Generate embedding for a single chunk with caching
   */
  async generateSingleEmbedding(chunk: DocumentChunk): Promise<EmbeddingVector | null> {
    try {
      // Check cache first
      const cachedEmbedding = cacheManager.embeddings.get(chunk.content)
      if (cachedEmbedding) {
        return this.createEmbeddingVector(chunk, cachedEmbedding)
      }

      await this.waitForRateLimit([chunk])
      
      const embedding = await this.openaiClient.generateEmbedding(chunk.content)
      
      // Cache the embedding
      cacheManager.embeddings.set(
        chunk.content,
        embedding,
        'text-embedding-3-small',
        this.estimateTokenCount(chunk.content)
      )
      
      return this.createEmbeddingVector(chunk, embedding)
    } catch (error) {
      console.error(`Failed to generate embedding for chunk ${chunk.id}:`, error)
      return null
    }
  }

  /**
   * Process a batch of chunks with retry logic
   */
  private async processBatchWithRetries(chunks: DocumentChunk[]): Promise<EmbeddingVector[]> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.options.maxRetries!; attempt++) {
      try {
        const texts = chunks.map(chunk => chunk.content)
        const embeddings = await this.openaiClient.generateEmbeddings(texts)

        // Update rate limiting counters
        this.updateRateLimitCounters(chunks)

        // Create embedding vectors
        return chunks.map((chunk, index) => 
          this.createEmbeddingVector(chunk, embeddings[index])
        )

      } catch (error) {
        lastError = error as Error
        
        if (attempt < this.options.maxRetries!) {
          const delay = this.calculateRetryDelay(attempt)
          console.warn(`Batch attempt ${attempt} failed, retrying in ${delay}ms:`, error)
          await this.sleep(delay)
        }
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }

  /**
   * Process chunks individually when batch processing fails
   */
  private async processIndividualChunks(
    chunks: DocumentChunk[],
    errors: Array<{ chunk: string; error: string }>
  ): Promise<EmbeddingVector[]> {
    const results: EmbeddingVector[] = []

    for (const chunk of chunks) {
      try {
        const result = await this.generateSingleEmbedding(chunk)
        if (result) {
          results.push(result)
        } else {
          errors.push({ chunk: chunk.id, error: 'Failed to generate embedding' })
        }
      } catch (error) {
        errors.push({ chunk: chunk.id, error: String(error) })
      }
    }

    return results
  }

  /**
   * Create an embedding vector from chunk and embedding data
   */
  private createEmbeddingVector(chunk: DocumentChunk, embedding: number[]): EmbeddingVector {
    return {
      id: chunk.id,
      values: embedding,
      metadata: {
        content: chunk.content,
        source: chunk.source,
        title: chunk.metadata.title,
        section: chunk.metadata.section,
        chunk_index: 0, // Default chunk index since DocumentChunk doesn't have this
        token_count: this.estimateTokenCount(chunk.content)
      }
    }
  }

  /**
   * Wait for rate limit constraints
   */
  private async waitForRateLimit(chunks: DocumentChunk[]): Promise<void> {
    const now = Date.now()
    const timeSinceReset = now - this.lastResetTime

    // Reset counters every minute
    if (timeSinceReset >= 60000) {
      this.requestCount = 0
      this.tokenCount = 0
      this.lastResetTime = now
      return
    }

    const estimatedTokens = chunks.reduce((sum, chunk) => 
      sum + this.estimateTokenCount(chunk.content), 0
    )

    // Check if we need to wait for rate limits
    const requestsRemaining = this.options.rateLimit!.requestsPerMinute - this.requestCount
    const tokensRemaining = this.options.rateLimit!.tokensPerMinute - this.tokenCount

    if (requestsRemaining <= 0 || tokensRemaining < estimatedTokens) {
      const waitTime = 60000 - timeSinceReset + 1000 // Wait until next minute + buffer
      console.log(`Rate limit reached, waiting ${waitTime}ms`)
      await this.sleep(waitTime)
      
      // Reset counters after waiting
      this.requestCount = 0
      this.tokenCount = 0
      this.lastResetTime = Date.now()
    }
  }

  /**
   * Update rate limiting counters after successful request
   */
  private updateRateLimitCounters(chunks: DocumentChunk[]): void {
    this.requestCount += 1
    this.tokenCount += chunks.reduce((sum, chunk) => 
      sum + this.estimateTokenCount(chunk.content), 0
    )
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.options.retryDelay!
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
    const jitter = Math.random() * 1000 // Add jitter to prevent thundering herd
    
    return Math.min(exponentialDelay + jitter, 30000) // Cap at 30 seconds
  }

  /**
   * Estimate token count for rate limiting
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for Portuguese/English
    return Math.ceil(text.length / 4)
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): {
    requestsUsed: number
    tokensUsed: number
    requestsRemaining: number
    tokensRemaining: number
    resetTime: Date
  } {
    const now = Date.now()
    const timeSinceReset = now - this.lastResetTime
    
    // If more than a minute has passed, counters should be reset
    if (timeSinceReset >= 60000) {
      return {
        requestsUsed: 0,
        tokensUsed: 0,
        requestsRemaining: this.options.rateLimit!.requestsPerMinute,
        tokensRemaining: this.options.rateLimit!.tokensPerMinute,
        resetTime: new Date(now)
      }
    }

    return {
      requestsUsed: this.requestCount,
      tokensUsed: this.tokenCount,
      requestsRemaining: Math.max(0, this.options.rateLimit!.requestsPerMinute - this.requestCount),
      tokensRemaining: Math.max(0, this.options.rateLimit!.tokensPerMinute - this.tokenCount),
      resetTime: new Date(this.lastResetTime + 60000)
    }
  }

  /**
   * Validate embedding quality
   */
  validateEmbedding(embedding: EmbeddingVector): boolean {
    return (
      embedding.values.length === 1536 && // OpenAI text-embedding-3-small dimension
      embedding.values.every(val => typeof val === 'number' && !isNaN(val)) &&
      embedding.metadata.content.length > 0 &&
      embedding.metadata.token_count > 0
    )
  }

  /**
   * Calculate embedding statistics
   */
  calculateStatistics(embeddings: EmbeddingVector[]): {
    totalEmbeddings: number
    totalTokens: number
    averageTokensPerChunk: number
    sources: Record<string, number>
    qualityScore: number
  } {
    const totalTokens = embeddings.reduce((sum, emb) => sum + emb.metadata.token_count, 0)
    const sources: Record<string, number> = {}
    
    embeddings.forEach(emb => {
      sources[emb.metadata.source] = (sources[emb.metadata.source] || 0) + 1
    })

    const validEmbeddings = embeddings.filter(emb => this.validateEmbedding(emb))
    const qualityScore = validEmbeddings.length / embeddings.length

    return {
      totalEmbeddings: embeddings.length,
      totalTokens,
      averageTokensPerChunk: totalTokens / embeddings.length,
      sources,
      qualityScore
    }
  }
}

// Export utility functions
export async function generateEmbeddingsForChunks(
  chunks: DocumentChunk[],
  apiKey: string,
  options?: EmbeddingOptions,
  onProgress?: (progress: EmbeddingProgress) => void
): Promise<EmbeddingVector[]> {
  const service = new EmbeddingService(apiKey, options)
  return service.generateEmbeddings(chunks, onProgress)
}

export async function generateSingleEmbedding(
  chunk: DocumentChunk,
  apiKey: string
): Promise<EmbeddingVector | null> {
  const service = new EmbeddingService(apiKey)
  return service.generateSingleEmbedding(chunk)
}