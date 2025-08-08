// Enhanced semantic search service with hybrid search and source weighting
import { EmbeddingService } from './embedding-service'
import { VectorizeClient } from './vectorize'
import { cacheManager } from './cache-manager'
import type { SearchResult, DocumentChunk } from '@/types'

export interface EnhancedSearchOptions {
  topK?: number
  minScore?: number
  maxResults?: number
  diversityThreshold?: number
  contextWindowSize?: number
  fallbackEnabled?: boolean
  hybridSearch?: boolean
  keywordWeight?: number
  sourceWeighting?: boolean
  freshnessFactor?: number
  includeWhatsAppInsights?: boolean
}

export interface EnhancedSearchContext {
  query: string
  embedding: number[]
  results: EnhancedSearchResult[]
  totalResults: number
  searchTime: number
  fallbackUsed: boolean
  hybridSearchUsed: boolean
  sourceBreakdown: Record<string, number>
  qualityMetrics: SearchQualityMetrics
}

export interface EnhancedSearchResult extends SearchResult {
  finalScore: number
  sourceType: 'original' | 'enhanced' | 'whatsapp'
  qualityScore: number
  keywordMatches: string[]
  contextRelevance: number
}

export interface SearchQualityMetrics {
  averageScore: number
  averageQuality: number
  sourceDistribution: Record<string, number>
  contentCoverage: number
  diversityScore: number
}

export interface SourceWeights {
  // Original sources
  'modocaverna-docs.md': number
  'aulas-modocaverna-cavefocus': number
  
  // Enhanced knowledge documents
  'enhanced_documents': number
  'ebook_documents': number
  'checklist_documents': number
  'guide_documents': number
  
  // WhatsApp support insights
  'whatsapp_support_analysis': number
  
  // Default fallback
  'default': number
}

export class EnhancedSemanticSearchService {
  private readonly defaultOptions: Required<EnhancedSearchOptions> = {
    topK: 15, // Increased for better diversity
    minScore: 0.65, // Slightly lower for enhanced content
    maxResults: 6, // More results for richer context
    diversityThreshold: 0.92, // Allow more similar content
    contextWindowSize: 5000, // Larger context window
    fallbackEnabled: true,
    hybridSearch: true, // Enable hybrid search by default
    keywordWeight: 0.3, // Weight for keyword matching
    sourceWeighting: true, // Enable source-based weighting
    freshnessFactor: 0.1, // Weight for content freshness
    includeWhatsAppInsights: true // Include WhatsApp insights
  }

  private readonly sourceWeights: SourceWeights = {
    // Core methodology documents (highest priority)
    'modocaverna-docs.md': 1.0,
    'aulas-modocaverna-cavefocus': 0.95,
    
    // Enhanced knowledge documents (high priority)
    'enhanced_documents': 0.9,
    'ebook_documents': 0.85,
    'guide_documents': 0.8,
    'checklist_documents': 0.75,
    
    // WhatsApp support insights (medium-high priority for practical questions)
    'whatsapp_support_analysis': 0.7,
    
    // Default fallback
    'default': 0.5
  }

  private options: Required<EnhancedSearchOptions>

  constructor(
    private embeddingService: EmbeddingService,
    private vectorizeClient: VectorizeClient,
    options: EnhancedSearchOptions = {}
  ) {
    this.options = { ...this.defaultOptions, ...options }
  }

  /**
   * Perform enhanced semantic search with hybrid capabilities
   */
  async search(query: string, options?: EnhancedSearchOptions): Promise<EnhancedSearchContext> {
    const searchOptions: Required<EnhancedSearchOptions> = { ...this.options, ...options }
    const startTime = Date.now()

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query)
      
      // Perform vector search with higher topK for better selection
      const rawResults = await this.vectorizeClient.search(queryEmbedding, {
        topK: searchOptions.topK * 2, // Get more results for better filtering
        minScore: 0.0, // We'll filter later
        includeMetadata: true
      })

      // Enhance results with additional metadata and scoring
      const enhancedResults = await this.enhanceSearchResults(
        rawResults,
        query,
        queryEmbedding,
        searchOptions
      )

      // Apply hybrid search if enabled
      const finalResults = searchOptions.hybridSearch
        ? await this.applyHybridSearch(enhancedResults, query, searchOptions)
        : enhancedResults

      // Process and rank final results
      const processedResults = await this.processEnhancedResults(
        finalResults,
        query,
        queryEmbedding,
        searchOptions
      )

      const searchTime = Date.now() - startTime
      const qualityMetrics = this.calculateQualityMetrics(processedResults)
      const sourceBreakdown = this.calculateSourceBreakdown(processedResults)

      return {
        query,
        embedding: queryEmbedding,
        results: processedResults,
        totalResults: rawResults.length,
        searchTime,
        fallbackUsed: false,
        hybridSearchUsed: searchOptions.hybridSearch,
        sourceBreakdown,
        qualityMetrics
      }

    } catch (error) {
      console.error('Enhanced semantic search failed:', error)
      
      if (searchOptions.fallbackEnabled) {
        return this.handleEnhancedSearchFallback(query, startTime)
      }
      
      throw new Error(`Enhanced semantic search failed: ${error}`)
    }
  }

  /**
   * Generate embedding for search query with enhanced caching
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      // Check cache first
      const cachedEmbedding = cacheManager.embeddings.get(query)
      if (cachedEmbedding) {
        return cachedEmbedding
      }

      // Enhance query for better semantic matching
      const enhancedQuery = this.enhanceQuery(query)

      // Create a temporary document chunk for the enhanced query
      const queryChunk: DocumentChunk = {
        id: `enhanced_query_${Date.now()}`,
        content: enhancedQuery,
        source: 'user_query',
        metadata: { enhanced: true }
      }

      const embeddingVector = await this.embeddingService.generateSingleEmbedding(queryChunk)
      
      if (!embeddingVector) {
        throw new Error('Failed to generate query embedding')
      }

      // Cache the embedding
      cacheManager.embeddings.set(
        query,
        embeddingVector.values,
        'text-embedding-3-small',
        this.estimateTokenCount(enhancedQuery)
      )

      return embeddingVector.values

    } catch (error) {
      console.error('Enhanced query embedding generation failed:', error)
      throw new Error(`Enhanced query embedding failed: ${error}`)
    }
  }

  /**
   * Enhance query with context and synonyms for better matching
   */
  private enhanceQuery(query: string): string {
    let enhancedQuery = query

    // Add Modo Caverna context terms
    const contextTerms = {
      'disciplina': ['foco', 'autocontrole', 'consistência'],
      'foco': ['concentração', 'atenção', 'direcionamento'],
      'procrastinação': ['adiamento', 'postergação', 'evitação'],
      'hábito': ['rotina', 'ritual', 'comportamento'],
      'meta': ['objetivo', 'propósito', 'alvo'],
      'motivação': ['inspiração', 'energia', 'impulso'],
      'transformação': ['mudança', 'evolução', 'crescimento']
    }

    const lowerQuery = query.toLowerCase()
    Object.entries(contextTerms).forEach(([key, synonyms]) => {
      if (lowerQuery.includes(key)) {
        enhancedQuery += ` ${synonyms.join(' ')}`
      }
    })

    return enhancedQuery
  }

  /**
   * Enhance search results with additional metadata and scoring
   */
  private async enhanceSearchResults(
    rawResults: SearchResult[],
    query: string,
    queryEmbedding: number[],
    options: Required<EnhancedSearchOptions>
  ): Promise<EnhancedSearchResult[]> {
    return rawResults.map(result => {
      const sourceType = this.determineSourceType(result.metadata.source)
      const qualityScore = this.calculateContentQuality(result.content, result.metadata)
      const keywordMatches = this.extractKeywordMatches(result.content, query)
      const contextRelevance = this.calculateContextRelevance(result.content, query)

      return {
        ...result,
        finalScore: 0, // Will be calculated later
        sourceType,
        qualityScore,
        keywordMatches,
        contextRelevance
      }
    })
  }

  /**
   * Apply hybrid search combining semantic and keyword matching
   */
  private async applyHybridSearch(
    results: EnhancedSearchResult[],
    query: string,
    options: Required<EnhancedSearchOptions>
  ): Promise<EnhancedSearchResult[]> {
    const queryWords = this.extractQueryWords(query)
    
    return results.map(result => {
      const semanticScore = result.score
      const keywordScore = this.calculateKeywordScore(result.content, queryWords)
      
      // Combine semantic and keyword scores
      const hybridScore = (
        semanticScore * (1 - options.keywordWeight) +
        keywordScore * options.keywordWeight
      )

      return {
        ...result,
        score: hybridScore
      }
    })
  }

  /**
   * Process and rank enhanced results
   */
  private async processEnhancedResults(
    results: EnhancedSearchResult[],
    query: string,
    queryEmbedding: number[],
    options: Required<EnhancedSearchOptions>
  ): Promise<EnhancedSearchResult[]> {
    // Filter by minimum score
    let filteredResults = results.filter(result => result.score >= options.minScore)

    // Apply source weighting if enabled
    if (options.sourceWeighting) {
      filteredResults = this.applySourceWeighting(filteredResults)
    }

    // Remove near-duplicate results
    filteredResults = this.removeDuplicates(filteredResults, options.diversityThreshold)

    // Calculate final scores
    const rankedResults = this.calculateFinalScores(filteredResults, query, queryEmbedding, options)

    // Sort by final score
    rankedResults.sort((a, b) => b.finalScore - a.finalScore)

    // Optimize for context window
    const optimizedResults = this.optimizeForContextWindow(rankedResults, options)

    // Ensure diversity in source types
    const diversifiedResults = this.ensureSourceDiversity(optimizedResults, options)

    // Limit final results
    return diversifiedResults.slice(0, options.maxResults)
  }

  /**
   * Determine source type from metadata
   */
  private determineSourceType(source: string): 'original' | 'enhanced' | 'whatsapp' {
    if (source.includes('whatsapp')) return 'whatsapp'
    if (source.includes('modocaverna-docs') || source.includes('aulas-modocaverna')) return 'original'
    return 'enhanced'
  }

  /**
   * Calculate content quality score
   */
  private calculateContentQuality(content: string, metadata: any): number {
    let score = 0.5 // Base score

    // Length appropriateness
    const length = content.length
    if (length > 100 && length < 2000) score += 0.2
    if (length > 200 && length < 1000) score += 0.1 // Optimal range

    // Structure indicators
    if (content.includes('\n\n')) score += 0.1 // Paragraphs
    if (content.match(/\*\*.*\*\*/)) score += 0.1 // Bold text
    if (content.includes('•') || content.includes('-')) score += 0.1 // Lists

    // Modo Caverna specific terms
    const modoTerms = ['disciplina', 'foco', 'guerreiro', 'caverna', 'protocolo', 'ritual', 'transformação']
    const modoCount = modoTerms.filter(term => content.toLowerCase().includes(term)).length
    score += Math.min(modoCount * 0.05, 0.2)

    // WhatsApp specific quality
    if (metadata.whatsappData) {
      if (metadata.whatsappData.resolutionSuccess) score += 0.15
      if (metadata.whatsappData.responseTime < 60) score += 0.1 // Quick response
    }

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Extract keyword matches from content
   */
  private extractKeywordMatches(content: string, query: string): string[] {
    const queryWords = this.extractQueryWords(query)
    const contentLower = content.toLowerCase()
    
    return queryWords.filter(word => contentLower.includes(word.toLowerCase()))
  }

  /**
   * Calculate context relevance score
   */
  private calculateContextRelevance(content: string, query: string): number {
    const queryWords = this.extractQueryWords(query)
    const contentWords = content.toLowerCase().split(/\s+/)
    
    // Calculate word proximity and frequency
    let relevanceScore = 0
    queryWords.forEach(queryWord => {
      const positions = contentWords
        .map((word, index) => word.includes(queryWord.toLowerCase()) ? index : -1)
        .filter(pos => pos !== -1)
      
      if (positions.length > 0) {
        // Frequency bonus
        relevanceScore += positions.length * 0.1
        
        // Proximity bonus (words appearing close together)
        if (positions.length > 1) {
          const avgDistance = positions.reduce((sum, pos, i, arr) => {
            if (i === 0) return sum
            return sum + (pos - arr[i - 1])
          }, 0) / (positions.length - 1)
          
          if (avgDistance < 10) relevanceScore += 0.2 // Close proximity
        }
      }
    })

    return Math.min(relevanceScore, 1.0)
  }

  /**
   * Extract meaningful words from query
   */
  private extractQueryWords(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['que', 'para', 'com', 'uma', 'você', 'seu', 'sua', 'como', 'onde', 'quando'].includes(word))
  }

  /**
   * Calculate keyword score for hybrid search
   */
  private calculateKeywordScore(content: string, queryWords: string[]): number {
    if (queryWords.length === 0) return 0

    const contentLower = content.toLowerCase()
    const matches = queryWords.filter(word => contentLower.includes(word.toLowerCase()))
    
    return matches.length / queryWords.length
  }

  /**
   * Apply source weighting to results
   */
  private applySourceWeighting(results: EnhancedSearchResult[]): EnhancedSearchResult[] {
    return results.map(result => {
      const sourceWeight = this.getSourceWeight(result.metadata.source)
      
      return {
        ...result,
        score: result.score * sourceWeight
      }
    })
  }

  /**
   * Get source weight for a given source
   */
  private getSourceWeight(source: string): number {
    const lowerSource = source.toLowerCase()
    
    // Check for specific source patterns
    if (lowerSource.includes('modocaverna-docs')) return this.sourceWeights['modocaverna-docs.md']
    if (lowerSource.includes('aulas-modocaverna')) return this.sourceWeights['aulas-modocaverna-cavefocus']
    if (lowerSource.includes('whatsapp')) return this.sourceWeights['whatsapp_support_analysis']
    if (lowerSource.includes('ebook')) return this.sourceWeights['ebook_documents']
    if (lowerSource.includes('checklist')) return this.sourceWeights['checklist_documents']
    if (lowerSource.includes('guia') || lowerSource.includes('guide')) return this.sourceWeights['guide_documents']
    
    return this.sourceWeights['enhanced_documents']
  }

  /**
   * Calculate final scores combining all factors
   */
  private calculateFinalScores(
    results: EnhancedSearchResult[],
    query: string,
    queryEmbedding: number[],
    options: Required<EnhancedSearchOptions>
  ): EnhancedSearchResult[] {
    return results.map(result => {
      const semanticScore = result.score * 0.6
      const qualityScore = result.qualityScore * 0.2
      const contextScore = result.contextRelevance * 0.15
      const keywordScore = (result.keywordMatches.length / this.extractQueryWords(query).length) * 0.05

      const finalScore = semanticScore + qualityScore + contextScore + keywordScore

      return {
        ...result,
        finalScore
      }
    })
  }

  /**
   * Remove near-duplicate results
   */
  private removeDuplicates(
    results: EnhancedSearchResult[],
    threshold: number
  ): EnhancedSearchResult[] {
    const filtered: EnhancedSearchResult[] = []
    
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
   * Calculate content similarity
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/))
    const words2 = new Set(content2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size
  }

  /**
   * Optimize results for context window
   */
  private optimizeForContextWindow(
    results: EnhancedSearchResult[],
    options: Required<EnhancedSearchOptions>
  ): EnhancedSearchResult[] {
    const optimized: EnhancedSearchResult[] = []
    let totalTokens = 0

    for (const result of results) {
      const estimatedTokens = this.estimateTokenCount(result.content)
      
      if (totalTokens + estimatedTokens <= options.contextWindowSize) {
        optimized.push(result)
        totalTokens += estimatedTokens
      } else {
        break
      }
    }

    return optimized
  }

  /**
   * Ensure diversity in source types
   */
  private ensureSourceDiversity(
    results: EnhancedSearchResult[],
    options: Required<EnhancedSearchOptions>
  ): EnhancedSearchResult[] {
    const diversified: EnhancedSearchResult[] = []
    const sourceTypeCounts = { original: 0, enhanced: 0, whatsapp: 0 }
    const maxPerType = Math.ceil(options.maxResults / 3)

    // First pass: ensure at least one of each type if available
    const byType = {
      original: results.filter(r => r.sourceType === 'original'),
      enhanced: results.filter(r => r.sourceType === 'enhanced'),
      whatsapp: results.filter(r => r.sourceType === 'whatsapp')
    }

    // Add best result from each type
    Object.entries(byType).forEach(([type, typeResults]) => {
      if (typeResults.length > 0 && diversified.length < options.maxResults) {
        diversified.push(typeResults[0])
        sourceTypeCounts[type as keyof typeof sourceTypeCounts]++
      }
    })

    // Second pass: fill remaining slots with best results
    for (const result of results) {
      if (diversified.includes(result)) continue
      if (diversified.length >= options.maxResults) break
      
      const typeCount = sourceTypeCounts[result.sourceType]
      if (typeCount < maxPerType) {
        diversified.push(result)
        sourceTypeCounts[result.sourceType]++
      }
    }

    return diversified
  }

  /**
   * Calculate quality metrics for search results
   */
  private calculateQualityMetrics(results: EnhancedSearchResult[]): SearchQualityMetrics {
    if (results.length === 0) {
      return {
        averageScore: 0,
        averageQuality: 0,
        sourceDistribution: {},
        contentCoverage: 0,
        diversityScore: 0
      }
    }

    const averageScore = results.reduce((sum, r) => sum + r.finalScore, 0) / results.length
    const averageQuality = results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length

    const sourceDistribution: Record<string, number> = {}
    results.forEach(result => {
      const source = result.metadata.source
      sourceDistribution[source] = (sourceDistribution[source] || 0) + 1
    })

    const totalTokens = results.reduce((sum, result) => 
      sum + this.estimateTokenCount(result.content), 0
    )
    const contentCoverage = Math.min(totalTokens / this.options.contextWindowSize, 1.0)

    // Calculate diversity score based on source type distribution
    const sourceTypes = results.map(r => r.sourceType)
    const uniqueTypes = new Set(sourceTypes).size
    const diversityScore = uniqueTypes / 3 // Max 3 source types

    return {
      averageScore,
      averageQuality,
      sourceDistribution,
      contentCoverage,
      diversityScore
    }
  }

  /**
   * Calculate source breakdown
   */
  private calculateSourceBreakdown(results: EnhancedSearchResult[]): Record<string, number> {
    const breakdown: Record<string, number> = {}
    
    results.forEach(result => {
      const sourceType = result.sourceType
      breakdown[sourceType] = (breakdown[sourceType] || 0) + 1
    })

    return breakdown
  }

  /**
   * Handle enhanced search fallback
   */
  private async handleEnhancedSearchFallback(query: string, startTime: number): Promise<EnhancedSearchContext> {
    console.warn('Using enhanced fallback search response')
    
    const fallbackResults: EnhancedSearchResult[] = [{
      content: 'Guerreiro, o sistema de busca está temporariamente indisponível, mas isso não deve parar sua jornada. Lembre-se dos pilares fundamentais: Disciplina, Foco e Ação. Use este momento para refletir sobre seus objetivos e dar o próximo passo, mesmo sem todas as respostas.',
      score: 0.5,
      finalScore: 0.5,
      sourceType: 'original',
      qualityScore: 0.8,
      keywordMatches: [],
      contextRelevance: 0.5,
      metadata: {
        source: 'enhanced_fallback_response',
        section: 'system_fallback'
      }
    }]

    return {
      query,
      embedding: [],
      results: fallbackResults,
      totalResults: 1,
      searchTime: Date.now() - startTime,
      fallbackUsed: true,
      hybridSearchUsed: false,
      sourceBreakdown: { original: 1 },
      qualityMetrics: {
        averageScore: 0.5,
        averageQuality: 0.8,
        sourceDistribution: { enhanced_fallback_response: 1 },
        contentCoverage: 0.1,
        diversityScore: 0.33
      }
    }
  }

  /**
   * Estimate token count
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4)
  }
}

// Export utility functions
export async function createEnhancedSemanticSearchService(
  embeddingService: EmbeddingService,
  vectorizeClient: VectorizeClient,
  options?: EnhancedSearchOptions
): Promise<EnhancedSemanticSearchService> {
  return new EnhancedSemanticSearchService(embeddingService, vectorizeClient, options)
}

export async function performEnhancedSemanticSearch(
  query: string,
  embeddingService: EmbeddingService,
  vectorizeClient: VectorizeClient,
  options?: EnhancedSearchOptions
): Promise<EnhancedSearchContext> {
  const service = new EnhancedSemanticSearchService(embeddingService, vectorizeClient, options)
  return service.search(query, options)
}