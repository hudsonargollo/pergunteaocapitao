// Cloudflare Vectorize operations for semantic search
import type { EmbeddingVector, SearchResult } from '@/types'

export interface VectorizeOptions {
  batchSize?: number
  maxRetries?: number
  retryDelay?: number
}

export interface IngestionProgress {
  processed: number
  total: number
  currentBatch: number
  totalBatches: number
  errors: Array<{ vectorId: string; error: string }>
  startTime: Date
  estimatedTimeRemaining?: number
}

export interface VectorizeStats {
  totalVectors: number
  dimensions: number
  sources: Record<string, number>
  lastUpdated: Date
}

export class VectorizeClient {
  private readonly defaultOptions: Required<VectorizeOptions> = {
    batchSize: 1000, // Vectorize batch limit
    maxRetries: 3,
    retryDelay: 1000
  }

  constructor(
    private index: VectorizeIndex,
    private options: VectorizeOptions = {}
  ) {
    this.options = { ...this.defaultOptions, ...options }
  }

  /**
   * Upsert vectors with batch processing and progress tracking
   */
  async upsertVectors(
    vectors: EmbeddingVector[],
    onProgress?: (progress: IngestionProgress) => void
  ): Promise<void> {
    const errors: Array<{ vectorId: string; error: string }> = []
    const totalBatches = Math.ceil(vectors.length / this.options.batchSize!)
    const startTime = new Date()

    for (let i = 0; i < vectors.length; i += this.options.batchSize!) {
      const batch = vectors.slice(i, i + this.options.batchSize!)
      const batchNumber = Math.floor(i / this.options.batchSize!) + 1

      try {
        await this.upsertBatchWithRetries(batch)

        // Report progress
        if (onProgress) {
          const processed = i + batch.length
          const progress = processed / vectors.length
          const elapsed = Date.now() - startTime.getTime()
          const estimatedTotal = elapsed / progress
          const estimatedTimeRemaining = estimatedTotal - elapsed

          onProgress({
            processed,
            total: vectors.length,
            currentBatch: batchNumber,
            totalBatches,
            errors: [...errors],
            startTime,
            estimatedTimeRemaining: Math.max(0, estimatedTimeRemaining)
          })
        }

      } catch (error) {
        // Log batch error and add individual errors
        console.error(`Batch ${batchNumber} failed:`, error)
        batch.forEach(vector => {
          errors.push({ vectorId: vector.id, error: String(error) })
        })

        if (onProgress) {
          onProgress({
            processed: i + batch.length,
            total: vectors.length,
            currentBatch: batchNumber,
            totalBatches,
            errors: [...errors],
            startTime
          })
        }
      }
    }

    if (errors.length > 0) {
      console.warn(`Ingestion completed with ${errors.length} errors`)
    }
  }

  /**
   * Upsert a single batch with retry logic
   */
  private async upsertBatchWithRetries(vectors: EmbeddingVector[]): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.options.maxRetries!; attempt++) {
      try {
        const vectorizeVectors = vectors.map(vector => ({
          id: vector.id,
          values: vector.values,
          metadata: vector.metadata
        }))

        await this.index.upsert(vectorizeVectors)
        return // Success

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
   * Search vectors with enhanced options
   */
  async search(
    queryVector: number[],
    options: {
      topK?: number
      filter?: Record<string, any>
      includeMetadata?: boolean
      minScore?: number
    } = {}
  ): Promise<SearchResult[]> {
    const {
      topK = 5,
      filter,
      includeMetadata = true,
      minScore = 0.0
    } = options

    try {
      const results = await this.index.query(queryVector, {
        topK,
        filter,
        returnValues: false,
        returnMetadata: includeMetadata
      })

      return results.matches
        .filter(match => match.score >= minScore)
        .map(match => ({
          content: match.metadata?.content as string || '',
          score: match.score,
          metadata: {
            source: match.metadata?.source as string || '',
            section: match.metadata?.section as string,
            title: match.metadata?.title as string,
            chunk_index: match.metadata?.chunk_index as number
          }
        }))

    } catch (error) {
      console.error('Vectorize search failed:', error)
      throw new Error(`Search failed: ${error}`)
    }
  }

  /**
   * Delete vectors by IDs
   */
  async deleteVectors(ids: string[]): Promise<void> {
    try {
      await this.index.deleteByIds(ids)
    } catch (error) {
      console.error('Failed to delete vectors:', error)
      throw new Error(`Delete failed: ${error}`)
    }
  }

  /**
   * Delete single vector
   */
  async deleteVector(id: string): Promise<void> {
    await this.deleteVectors([id])
  }

  /**
   * Clear all vectors from index (use with caution)
   */
  async clearIndex(): Promise<void> {
    try {
      // Note: This is a destructive operation
      // Vectorize doesn't have a direct "clear all" method
      // This would need to be implemented by querying and deleting in batches
      console.warn('Clear index operation not implemented - requires manual deletion')
      throw new Error('Clear index not implemented - use deleteVectors with specific IDs')
    } catch (error) {
      throw new Error(`Clear index failed: ${error}`)
    }
  }

  /**
   * Get index statistics and metadata
   */
  async getStats(): Promise<VectorizeStats> {
    try {
      const description = await this.index.describe()
      
      // Note: Vectorize describe() returns basic info
      // We'll need to track additional stats ourselves
      return {
        totalVectors: description.vectorsCount || 0,
        dimensions: 1536, // OpenAI embedding dimensions
        sources: {}, // Would need to be tracked separately
        lastUpdated: new Date()
      }
    } catch (error) {
      console.error('Failed to get index stats:', error)
      throw new Error(`Stats retrieval failed: ${error}`)
    }
  }

  /**
   * Validate vectors before insertion
   */
  validateVectors(vectors: EmbeddingVector[]): { valid: EmbeddingVector[]; invalid: Array<{ vector: EmbeddingVector; reason: string }> } {
    const valid: EmbeddingVector[] = []
    const invalid: Array<{ vector: EmbeddingVector; reason: string }> = []

    vectors.forEach(vector => {
      const issues: string[] = []

      // Check ID
      if (!vector.id || typeof vector.id !== 'string') {
        issues.push('Invalid or missing ID')
      }

      // Check values array
      if (!Array.isArray(vector.values)) {
        issues.push('Values must be an array')
      } else if (vector.values.length !== 1536) {
        issues.push(`Expected 1536 dimensions, got ${vector.values.length}`)
      } else if (!vector.values.every(val => typeof val === 'number' && !isNaN(val))) {
        issues.push('All values must be valid numbers')
      }

      // Check metadata
      if (!vector.metadata || typeof vector.metadata !== 'object') {
        issues.push('Metadata must be an object')
      } else {
        if (!vector.metadata.content || typeof vector.metadata.content !== 'string') {
          issues.push('Metadata must include content string')
        }
        if (!vector.metadata.source || typeof vector.metadata.source !== 'string') {
          issues.push('Metadata must include source string')
        }
      }

      if (issues.length === 0) {
        valid.push(vector)
      } else {
        invalid.push({ vector, reason: issues.join('; ') })
      }
    })

    return { valid, invalid }
  }

  /**
   * Test index connectivity and basic operations
   */
  async testConnection(): Promise<{ success: boolean; error?: string; stats?: any }> {
    try {
      const stats = await this.getStats()
      
      // Try a simple query to test search functionality
      const testVector = new Array(1536).fill(0.1)
      await this.search(testVector, { topK: 1 })

      return { success: true, stats }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.options.retryDelay!
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
    const jitter = Math.random() * 1000
    
    return Math.min(exponentialDelay + jitter, 30000) // Cap at 30 seconds
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export utility functions
export async function createVectorizeClient(
  index: VectorizeIndex,
  options?: VectorizeOptions
): Promise<VectorizeClient> {
  const client = new VectorizeClient(index, options)
  
  // Test connection on creation
  const connectionTest = await client.testConnection()
  if (!connectionTest.success) {
    throw new Error(`Failed to connect to Vectorize index: ${connectionTest.error}`)
  }

  return client
}

export async function ingestEmbeddings(
  index: VectorizeIndex,
  vectors: EmbeddingVector[],
  options?: VectorizeOptions & {
    validateBeforeInsert?: boolean
    onProgress?: (progress: IngestionProgress) => void
  }
): Promise<{ success: boolean; processed: number; errors: number }> {
  const client = new VectorizeClient(index, options)
  
  let processedVectors = vectors
  
  // Validate vectors if requested
  if (options?.validateBeforeInsert !== false) {
    const validation = client.validateVectors(vectors)
    
    if (validation.invalid.length > 0) {
      console.warn(`Found ${validation.invalid.length} invalid vectors:`)
      validation.invalid.forEach(({ vector, reason }) => {
        console.warn(`- ${vector.id}: ${reason}`)
      })
    }
    
    processedVectors = validation.valid
  }

  if (processedVectors.length === 0) {
    return { success: false, processed: 0, errors: vectors.length }
  }

  try {
    let errorCount = 0
    
    await client.upsertVectors(processedVectors, (progress) => {
      errorCount = progress.errors.length
      options?.onProgress?.(progress)
    })

    const success = errorCount === 0
    return {
      success,
      processed: processedVectors.length - errorCount,
      errors: errorCount
    }
  } catch (error) {
    console.error('Ingestion failed:', error)
    return {
      success: false,
      processed: 0,
      errors: vectors.length
    }
  }
}