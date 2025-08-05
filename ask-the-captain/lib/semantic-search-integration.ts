// Integration example showing how semantic search components work together
import { EmbeddingService } from './embedding-service'
import { VectorizeClient } from './vectorize'
import { SemanticSearchService } from './semantic-search'
import { SearchResultProcessor } from './search-result-processor'
import type { CloudflareEnv } from '@/types'

/**
 * Complete semantic search pipeline integration
 * This demonstrates how all components work together for the Ask the Captain platform
 */
export class SemanticSearchPipeline {
  private embeddingService: EmbeddingService
  private vectorizeClient: VectorizeClient
  private searchService: SemanticSearchService
  private resultProcessor: SearchResultProcessor

  constructor(env: CloudflareEnv) {
    // Initialize services
    this.embeddingService = new EmbeddingService(env.OPENAI_API_KEY)
    this.vectorizeClient = new VectorizeClient(env.VECTORIZE_INDEX)
    this.searchService = new SemanticSearchService(
      this.embeddingService,
      this.vectorizeClient,
      {
        topK: 10,
        minScore: 0.7,
        maxResults: 5,
        contextWindowSize: 4000,
        fallbackEnabled: true
      }
    )
    this.resultProcessor = new SearchResultProcessor({
      contextWindowSize: 4000,
      relevanceThreshold: 0.7,
      maxContextChunks: 5,
      includeSourceAttribution: true,
      fallbackEnabled: true
    })
  }

  /**
   * Complete search pipeline: query -> embedding -> search -> processing -> context
   */
  async searchAndProcess(query: string): Promise<{
    contextText: string
    searchMetrics: any
    processingMetrics: any
    fallbackUsed: boolean
  }> {
    try {
      // Step 1: Perform semantic search
      const searchContext = await this.searchService.search(query)

      // Step 2: Process results for optimal context
      const processedContext = await this.resultProcessor.processSearchResults(searchContext)

      // Step 3: Get metrics for monitoring
      const searchMetrics = this.searchService.getSearchMetrics(searchContext)

      return {
        contextText: processedContext.contextText,
        searchMetrics,
        processingMetrics: processedContext.processingMetrics,
        fallbackUsed: processedContext.fallbackUsed
      }

    } catch (error) {
      console.error('Search pipeline failed:', error)
      
      // Return fallback context
      const fallbackContext = await this.resultProcessor.processSearchResults({
        query,
        embedding: [],
        results: [],
        totalResults: 0,
        searchTime: 0,
        fallbackUsed: true
      })

      return {
        contextText: fallbackContext.contextText,
        searchMetrics: { averageScore: 0, scoreDistribution: { high: 0, medium: 0, low: 0 } },
        processingMetrics: fallbackContext.processingMetrics,
        fallbackUsed: true
      }
    }
  }

  /**
   * Health check for all components
   */
  async healthCheck(): Promise<{
    embedding: boolean
    vectorize: boolean
    search: boolean
    processor: boolean
    overall: boolean
  }> {
    const results = {
      embedding: false,
      vectorize: false,
      search: false,
      processor: false,
      overall: false
    }

    try {
      // Test embedding service
      const testChunk = {
        id: 'health_check',
        content: 'Test content for health check',
        source: 'health_check',
        metadata: {}
      }
      const embedding = await this.embeddingService.generateSingleEmbedding(testChunk)
      results.embedding = embedding !== null

      // Test vectorize connection
      const vectorizeTest = await this.vectorizeClient.testConnection()
      results.vectorize = vectorizeTest.success

      // Test search service configuration
      const searchValidation = this.searchService.validateConfiguration()
      results.search = searchValidation.valid

      // Test result processor configuration
      const processorValidation = this.resultProcessor.validateConfiguration()
      results.processor = processorValidation.valid

      results.overall = results.embedding && results.vectorize && results.search && results.processor

    } catch (error) {
      console.error('Health check failed:', error)
    }

    return results
  }

  /**
   * Get comprehensive system statistics
   */
  async getSystemStats(): Promise<{
    embedding: any
    vectorize: any
    search: any
    processor: any
  }> {
    return {
      embedding: this.embeddingService.getRateLimitStatus(),
      vectorize: await this.vectorizeClient.getStats(),
      search: {}, // Search service doesn't have persistent stats
      processor: this.resultProcessor.getProcessingStats()
    }
  }
}

/**
 * Factory function to create a configured search pipeline
 */
export function createSemanticSearchPipeline(env: CloudflareEnv): SemanticSearchPipeline {
  return new SemanticSearchPipeline(env)
}

/**
 * Utility function for quick search operations
 */
export async function quickSearch(
  query: string,
  env: CloudflareEnv
): Promise<string> {
  const pipeline = createSemanticSearchPipeline(env)
  const result = await pipeline.searchAndProcess(query)
  return result.contextText
}

/**
 * Example usage for API endpoints
 */
export async function searchForChatContext(
  userQuery: string,
  env: CloudflareEnv
): Promise<{
  context: string
  metadata: {
    fallbackUsed: boolean
    searchQuality: number
    processingTime: number
  }
}> {
  const startTime = Date.now()
  const pipeline = createSemanticSearchPipeline(env)
  
  const result = await pipeline.searchAndProcess(userQuery)
  const processingTime = Date.now() - startTime

  return {
    context: result.contextText,
    metadata: {
      fallbackUsed: result.fallbackUsed,
      searchQuality: result.searchMetrics.averageScore || 0,
      processingTime
    }
  }
}