// Semantic search service for Ask the Captain
import { EmbeddingService } from './embedding-service'
import { VectorizeClient } from './vectorize'
import { cacheManager } from './cache-manager'
import type { SearchResult, DocumentChunk } from '@/types'

export interface SemanticSearchOptions {
  topK?: number
  minScore?: number
  maxResults?: number
  diversityThreshold?: number
  contextWindowSize?: number
  fallbackEnabled?: boolean
}

export interface SearchContext {
  query: string
  embedding: number[]
  results: SearchResult[]
  totalResults: number
  searchTime: number
  fallbackUsed: boolean
}

export interface RankingWeights {
  semanticSimilarity: number
  sourceRelevance: number
  contentLength: number
  recency: number
}

export class SemanticSearchService {
  private readonly defaultOptions: Required<SemanticSearchOptions> = {
    topK: 10,
    minScore: 0.7, // High threshold for quality results
    maxResults: 5, // Limit for context window optimization
    diversityThreshold: 0.95, // Prevent near-duplicate results
    contextWindowSize: 4000, // Token limit for prompt construction
    fallbackEnabled: true
  }

  private readonly defaultRankingWeights: RankingWeights = {
    semanticSimilarity: 0.7,
    sourceRelevance: 0.2,
    contentLength: 0.05,
    recency: 0.05
  }

  private options: Required<SemanticSearchOptions>
  private rankingWeights: RankingWeights

  constructor(
    private embeddingService: EmbeddingService,
    private vectorizeClient: VectorizeClient,
    options: SemanticSearchOptions = {},
    rankingWeights: Partial<RankingWeights> = {}
  ) {
    this.options = { ...this.defaultOptions, ...options }
    this.rankingWeights = { ...this.defaultRankingWeights, ...rankingWeights }
  }

  /**
   * Perform semantic search with query embedding generation
   */
  async search(query: string, options?: SemanticSearchOptions): Promise<SearchContext> {
    const searchOptions: Required<SemanticSearchOptions> = { ...this.options, ...options }
    const startTime = Date.now()

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query)
      
      // Perform vector search
      const rawResults = await this.vectorizeClient.search(queryEmbedding, {
        topK: searchOptions.topK,
        minScore: 0.0, // We'll filter later for more control
        includeMetadata: true
      })

      // Process and rank results
      const processedResults = await this.processSearchResults(
        rawResults,
        query,
        queryEmbedding,
        searchOptions
      )

      const searchTime = Date.now() - startTime

      return {
        query,
        embedding: queryEmbedding,
        results: processedResults,
        totalResults: rawResults.length,
        searchTime,
        fallbackUsed: false
      }

    } catch (error) {
      console.error('Semantic search failed:', error)
      
      if (searchOptions.fallbackEnabled) {
        return this.handleSearchFallback(query, startTime)
      }
      
      throw new Error(`Semantic search failed: ${error}`)
    }
  }

  /**
   * Generate embedding for search query with caching
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      // Check cache first
      const cachedEmbedding = cacheManager.embeddings.get(query)
      if (cachedEmbedding) {
        return cachedEmbedding
      }

      // Create a temporary document chunk for the query
      const queryChunk: DocumentChunk = {
        id: `query_${Date.now()}`,
        content: query,
        source: 'user_query',
        metadata: {}
      }

      const embeddingVector = await this.embeddingService.generateSingleEmbedding(queryChunk)
      
      if (!embeddingVector) {
        throw new Error('Failed to generate query embedding')
      }

      // Cache the embedding for future use
      cacheManager.embeddings.set(
        query,
        embeddingVector.values,
        'text-embedding-3-small',
        this.estimateTokenCount(query)
      )

      return embeddingVector.values

    } catch (error) {
      console.error('Query embedding generation failed:', error)
      throw new Error(`Query embedding failed: ${error}`)
    }
  }

  /**
   * Process and rank search results
   */
  private async processSearchResults(
    rawResults: SearchResult[],
    query: string,
    queryEmbedding: number[],
    options: Required<SemanticSearchOptions>
  ): Promise<SearchResult[]> {
    // Filter by minimum score
    let filteredResults = rawResults.filter(result => result.score >= options.minScore)

    // Remove near-duplicate results
    filteredResults = this.removeDuplicates(filteredResults, options.diversityThreshold)

    // Apply advanced ranking
    const rankedResults = this.rankResults(filteredResults, query, queryEmbedding)

    // Optimize for context window
    const optimizedResults = this.optimizeForContextWindow(rankedResults, options)

    // Limit final results
    return optimizedResults.slice(0, options.maxResults)
  }

  /**
   * Advanced result ranking with multiple factors
   */
  private rankResults(
    results: SearchResult[],
    query: string,
    queryEmbedding: number[]
  ): SearchResult[] {
    return results
      .map(result => ({
        ...result,
        finalScore: this.calculateFinalScore(result, query, queryEmbedding)
      }))
      .sort((a, b) => b.finalScore - a.finalScore)
  }

  /**
   * Calculate final ranking score using multiple factors
   */
  private calculateFinalScore(
    result: SearchResult,
    query: string,
    queryEmbedding: number[]
  ): number {
    const weights = this.rankingWeights

    // Semantic similarity (primary factor)
    const semanticScore = result.score * weights.semanticSimilarity

    // Source relevance (prioritize core methodology documents)
    const sourceScore = this.calculateSourceRelevance(result.metadata.source) * weights.sourceRelevance

    // Content length (prefer substantial content)
    const lengthScore = this.calculateLengthScore(result.content) * weights.contentLength

    // Keyword matching bonus
    const keywordScore = this.calculateKeywordMatch(result.content, query) * 0.1

    return semanticScore + sourceScore + lengthScore + keywordScore
  }

  /**
   * Calculate source relevance score
   */
  private calculateSourceRelevance(source: string): number {
    const sourceWeights: Record<string, number> = {
      'modocaverna-docs.md': 1.0,
      'cave-focus': 0.9,
      'modo-caverna': 0.8,
      'manifesto': 0.9,
      'pilares': 0.8,
      'protocolo': 0.7,
      'default': 0.5
    }

    const normalizedSource = source.toLowerCase()
    
    for (const [key, weight] of Object.entries(sourceWeights)) {
      if (normalizedSource.includes(key)) {
        return weight
      }
    }

    return sourceWeights.default
  }

  /**
   * Calculate content length score (prefer substantial content)
   */
  private calculateLengthScore(content: string): number {
    const length = content.length
    
    if (length < 100) return 0.3 // Too short
    if (length < 300) return 0.6 // Short but acceptable
    if (length < 800) return 1.0 // Optimal length
    if (length < 1500) return 0.8 // Long but good
    return 0.6 // Very long, might be too much
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordMatch(content: string, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2)
    const contentLower = content.toLowerCase()
    
    if (queryWords.length === 0) return 0

    const matches = queryWords.filter(word => contentLower.includes(word))
    return matches.length / queryWords.length
  }

  /**
   * Remove near-duplicate results based on content similarity
   */
  private removeDuplicates(
    results: SearchResult[],
    threshold: number
  ): SearchResult[] {
    const filtered: SearchResult[] = []
    
    for (const result of results) {
      const isDuplicate = filtered.some(existing => 
        this.calculateContentSimilarity(result.content, existing.content) > threshold
      )
      
      if (!isDuplicate) {
        filtered.push(result)
      }
    }

    return filtered
  }

  /**
   * Calculate content similarity using simple text overlap
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/))
    const words2 = new Set(content2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size // Jaccard similarity
  }

  /**
   * Optimize results for context window constraints
   */
  private optimizeForContextWindow(
    results: SearchResult[],
    options: Required<SemanticSearchOptions>
  ): SearchResult[] {
    const optimized: SearchResult[] = []
    let totalTokens = 0

    for (const result of results) {
      const estimatedTokens = this.estimateTokenCount(result.content)
      
      if (totalTokens + estimatedTokens <= options.contextWindowSize) {
        optimized.push(result)
        totalTokens += estimatedTokens
      } else {
        // Try to fit a truncated version
        const availableTokens = options.contextWindowSize - totalTokens
        if (availableTokens > 100) { // Minimum useful content
          const truncatedContent = this.truncateContent(result.content, availableTokens)
          optimized.push({
            ...result,
            content: truncatedContent
          })
        }
        break
      }
    }

    return optimized
  }

  /**
   * Estimate token count for content
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for Portuguese/English
    return Math.ceil(text.length / 4)
  }

  /**
   * Truncate content to fit token limit while preserving meaning
   */
  private truncateContent(content: string, maxTokens: number): string {
    const maxChars = maxTokens * 4
    
    if (content.length <= maxChars) {
      return content
    }

    // Try to truncate at sentence boundaries
    const sentences = content.split(/[.!?]+/)
    let truncated = ''
    
    for (const sentence of sentences) {
      if ((truncated + sentence).length > maxChars) {
        break
      }
      truncated += sentence + '. '
    }

    // If no complete sentences fit, truncate at word boundary
    if (truncated.length < maxChars * 0.5) {
      const words = content.split(/\s+/)
      truncated = ''
      
      for (const word of words) {
        if ((truncated + word).length > maxChars) {
          break
        }
        truncated += word + ' '
      }
    }

    return truncated.trim() + '...'
  }

  /**
   * Handle search fallback when primary search fails
   */
  private async handleSearchFallback(query: string, startTime: number): Promise<SearchContext> {
    console.warn('Using fallback search response')
    
    const fallbackResults: SearchResult[] = [{
      content: 'Desculpe, guerreiro. O sistema de busca está temporariamente indisponível. Mas lembre-se: a verdadeira transformação vem de dentro. Foque no que você pode controlar agora mesmo - suas ações, sua disciplina, seu compromisso com o progresso.',
      score: 0.5,
      metadata: {
        source: 'fallback_response',
        section: 'system_fallback'
      }
    }]

    return {
      query,
      embedding: [],
      results: fallbackResults,
      totalResults: 1,
      searchTime: Date.now() - startTime,
      fallbackUsed: true
    }
  }

  /**
   * Get search quality metrics
   */
  getSearchMetrics(context: SearchContext): {
    averageScore: number
    scoreDistribution: { high: number; medium: number; low: number }
    sourceDistribution: Record<string, number>
    contentCoverage: number
  } {
    const scores = context.results.map(r => r.score)
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length || 0

    const scoreDistribution = {
      high: scores.filter(s => s >= 0.8).length,
      medium: scores.filter(s => s >= 0.6 && s < 0.8).length,
      low: scores.filter(s => s < 0.6).length
    }

    const sourceDistribution: Record<string, number> = {}
    context.results.forEach(result => {
      const source = result.metadata.source
      sourceDistribution[source] = (sourceDistribution[source] || 0) + 1
    })

    const totalTokens = context.results.reduce((sum, result) => 
      sum + this.estimateTokenCount(result.content), 0
    )
    const contentCoverage = Math.min(totalTokens / this.options.contextWindowSize!, 1.0)

    return {
      averageScore,
      scoreDistribution,
      sourceDistribution,
      contentCoverage
    }
  }

  /**
   * Validate search configuration
   */
  validateConfiguration(): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    if (this.options.minScore! < 0 || this.options.minScore! > 1) {
      issues.push('minScore must be between 0 and 1')
    }

    if (this.options.topK! < 1 || this.options.topK! > 100) {
      issues.push('topK must be between 1 and 100')
    }

    if (this.options.maxResults! > this.options.topK!) {
      issues.push('maxResults cannot exceed topK')
    }

    if (this.options.contextWindowSize! < 500) {
      issues.push('contextWindowSize should be at least 500 tokens')
    }

    const weightSum = Object.values(this.rankingWeights).reduce((sum, weight) => sum + weight, 0)
    if (Math.abs(weightSum - 1.0) > 0.1) {
      issues.push('Ranking weights should sum to approximately 1.0')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }
}

// Export utility functions
export async function createSemanticSearchService(
  embeddingService: EmbeddingService,
  vectorizeClient: VectorizeClient,
  options?: SemanticSearchOptions,
  rankingWeights?: RankingWeights
): Promise<SemanticSearchService> {
  const service = new SemanticSearchService(embeddingService, vectorizeClient, options, rankingWeights)
  
  // Validate configuration
  const validation = service.validateConfiguration()
  if (!validation.valid) {
    throw new Error(`Invalid search configuration: ${validation.issues.join(', ')}`)
  }

  return service
}

export async function performSemanticSearch(
  query: string,
  embeddingService: EmbeddingService,
  vectorizeClient: VectorizeClient,
  options?: SemanticSearchOptions
): Promise<SearchContext> {
  const service = new SemanticSearchService(embeddingService, vectorizeClient, options)
  return service.search(query, options)
}