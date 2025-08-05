// Search result processing for context optimization and fallback handling
import type { SearchResult } from '@/types'
import type { SearchContext } from './semantic-search'

export interface ProcessingOptions {
  contextWindowSize?: number
  relevanceThreshold?: number
  maxContextChunks?: number
  prioritizeRecent?: boolean
  includeSourceAttribution?: boolean
  fallbackEnabled?: boolean
}

export interface ProcessedContext {
  contextText: string
  usedResults: SearchResult[]
  totalTokens: number
  relevanceScore: number
  fallbackUsed: boolean
  processingMetrics: {
    originalResults: number
    filteredResults: number
    truncatedResults: number
    tokenUtilization: number
  }
}

export interface FallbackResponse {
  content: string
  tone: 'supportive' | 'challenging' | 'instructional' | 'motivational'
  source: string
}

export class SearchResultProcessor {
  private readonly defaultOptions: Required<ProcessingOptions> = {
    contextWindowSize: 4000, // Tokens for prompt construction
    relevanceThreshold: 0.7, // Minimum relevance for inclusion
    maxContextChunks: 5, // Maximum number of chunks to include
    prioritizeRecent: false, // Whether to prioritize recent content
    includeSourceAttribution: true, // Include source information
    fallbackEnabled: true // Enable fallback responses
  }

  private readonly fallbackResponses: FallbackResponse[] = [
    {
      content: 'Guerreiro, sua pergunta é importante, mas não encontrei informações específicas na base de conhecimento do Modo Caverna. Lembre-se: a transformação real vem da ação consistente. Foque no que você pode controlar agora - sua disciplina, seus hábitos, seu compromisso com o progresso.',
      tone: 'challenging',
      source: 'capitao_fallback_action'
    },
    {
      content: 'Desculpe, guerreiro, mas não tenho informações específicas sobre isso na metodologia Modo Caverna. Mas posso te dizer uma coisa: a resposta que você busca está na prática. Comece com pequenas ações diárias, mantenha a disciplina e os resultados virão.',
      tone: 'instructional',
      source: 'capitao_fallback_practice'
    },
    {
      content: 'Não encontrei essa informação específica no material do Modo Caverna, guerreiro. Mas lembre-se do princípio fundamental: Propósito > Foco > Progresso. Defina seu objetivo, elimine as distrações e tome ação. A caverna te ensina através da experiência.',
      tone: 'motivational',
      source: 'capitao_fallback_principles'
    },
    {
      content: 'Guerreiro, essa pergunta não está coberta diretamente no conteúdo que tenho acesso. Mas você sabe o que importa? Parar de procurar desculpas e começar a agir. A transformação acontece quando você sai da zona de conforto e entra na caverna da disciplina.',
      tone: 'challenging',
      source: 'capitao_fallback_discipline'
    }
  ]

  constructor(private options: ProcessingOptions = {}) {
    this.options = { ...this.defaultOptions, ...options }
  }

  /**
   * Process search results for optimal context construction
   */
  async processSearchResults(searchContext: SearchContext): Promise<ProcessedContext> {
    const options = this.options

    // Check if fallback is needed
    if (this.shouldUseFallback(searchContext)) {
      return this.createFallbackContext(searchContext)
    }

    // Filter results by relevance threshold
    const relevantResults = this.filterByRelevance(
      searchContext.results,
      options.relevanceThreshold!
    )

    // Prioritize and limit results
    const prioritizedResults = this.prioritizeResults(
      relevantResults,
      options.maxContextChunks!
    )

    // Optimize for context window
    const optimizedResults = this.optimizeForContextWindow(
      prioritizedResults,
      options.contextWindowSize!
    )

    // Construct context text
    const contextText = this.constructContextText(
      optimizedResults,
      options.includeSourceAttribution!
    )

    // Calculate metrics
    const metrics = this.calculateProcessingMetrics(
      searchContext.results,
      relevantResults,
      optimizedResults,
      contextText
    )

    return {
      contextText,
      usedResults: optimizedResults,
      totalTokens: this.estimateTokenCount(contextText),
      relevanceScore: this.calculateAverageRelevance(optimizedResults),
      fallbackUsed: false,
      processingMetrics: metrics
    }
  }

  /**
   * Determine if fallback response should be used
   */
  private shouldUseFallback(searchContext: SearchContext): boolean {
    if (!this.options.fallbackEnabled || searchContext.fallbackUsed) {
      return searchContext.fallbackUsed
    }

    // Use fallback if no results meet relevance threshold
    const relevantResults = searchContext.results.filter(
      result => result.score >= this.options.relevanceThreshold!
    )

    return relevantResults.length === 0
  }

  /**
   * Create fallback context when search results are insufficient
   */
  private createFallbackContext(searchContext: SearchContext): ProcessedContext {
    const fallbackResponse = this.selectFallbackResponse(searchContext.query)
    
    const fallbackResult: SearchResult = {
      content: fallbackResponse.content,
      score: 0.5,
      metadata: {
        source: fallbackResponse.source,
        section: 'fallback_response'
      }
    }

    const contextText = this.constructContextText([fallbackResult], false)

    return {
      contextText,
      usedResults: [fallbackResult],
      totalTokens: this.estimateTokenCount(contextText),
      relevanceScore: 0.5,
      fallbackUsed: true,
      processingMetrics: {
        originalResults: searchContext.results.length,
        filteredResults: 0,
        truncatedResults: 0,
        tokenUtilization: 0.1 // Low utilization for fallback
      }
    }
  }

  /**
   * Select appropriate fallback response based on query characteristics
   */
  private selectFallbackResponse(query: string): FallbackResponse {
    const queryLower = query.toLowerCase()

    // Analyze query to select appropriate tone
    if (queryLower.includes('como') || queryLower.includes('what') || queryLower.includes('how')) {
      return this.fallbackResponses.find(r => r.tone === 'instructional') || this.fallbackResponses[0]
    }

    if (queryLower.includes('motivação') || queryLower.includes('motivation') || queryLower.includes('inspiração')) {
      return this.fallbackResponses.find(r => r.tone === 'motivational') || this.fallbackResponses[0]
    }

    if (queryLower.includes('difícil') || queryLower.includes('problema') || queryLower.includes('hard') || queryLower.includes('difficult')) {
      return this.fallbackResponses.find(r => r.tone === 'challenging') || this.fallbackResponses[0]
    }

    // Default to challenging tone (Capitão Caverna's primary style)
    return this.fallbackResponses.find(r => r.tone === 'challenging') || this.fallbackResponses[0]
  }

  /**
   * Filter results by relevance threshold
   */
  private filterByRelevance(results: SearchResult[], threshold: number): SearchResult[] {
    return results.filter(result => result.score >= threshold)
  }

  /**
   * Prioritize results based on various factors
   */
  private prioritizeResults(results: SearchResult[], maxChunks: number): SearchResult[] {
    // Sort by final score (already calculated in semantic search)
    const sorted = [...results].sort((a, b) => b.score - a.score)

    // Apply additional prioritization if needed
    if (this.options.prioritizeRecent) {
      // This would require timestamp metadata - placeholder for future enhancement
      // For now, maintain score-based ordering
    }

    return sorted.slice(0, maxChunks)
  }

  /**
   * Optimize results for context window constraints
   */
  private optimizeForContextWindow(
    results: SearchResult[],
    maxTokens: number
  ): SearchResult[] {
    const optimized: SearchResult[] = []
    let totalTokens = 0

    // Reserve tokens for source attribution and formatting
    const reservedTokens = this.options.includeSourceAttribution ? 200 : 50
    const availableTokens = maxTokens - reservedTokens

    for (const result of results) {
      const resultTokens = this.estimateTokenCount(result.content)
      
      if (totalTokens + resultTokens <= availableTokens) {
        // Full result fits
        optimized.push(result)
        totalTokens += resultTokens
      } else {
        // Try to fit a truncated version
        const remainingTokens = availableTokens - totalTokens
        
        if (remainingTokens > 100) { // Minimum useful content
          const truncatedContent = this.truncateContent(result.content, remainingTokens)
          optimized.push({
            ...result,
            content: truncatedContent
          })
          totalTokens += this.estimateTokenCount(truncatedContent)
        }
        break
      }
    }

    return optimized
  }

  /**
   * Construct formatted context text from results
   */
  private constructContextText(results: SearchResult[], includeAttribution: boolean): string {
    if (results.length === 0) {
      return ''
    }

    const sections: string[] = []

    results.forEach((result, index) => {
      let section = result.content.trim()

      if (includeAttribution && result.metadata.source !== 'fallback_response') {
        const source = this.formatSourceAttribution(result.metadata.source, result.metadata.section)
        section = `${section}\n\n[Fonte: ${source}]`
      }

      sections.push(section)
    })

    return sections.join('\n\n---\n\n')
  }

  /**
   * Format source attribution for context
   */
  private formatSourceAttribution(source: string, section?: string): string {
    let formatted = source

    // Clean up source names for better readability
    if (source.includes('modocaverna-docs.md')) {
      formatted = 'Documentação Principal do Modo Caverna'
    } else if (source.includes('cave-focus')) {
      formatted = 'Cave Focus - Módulo de Foco'
    } else if (source.includes('pilares')) {
      formatted = 'Os Três Pilares Fundamentais'
    } else if (source.includes('manifesto')) {
      formatted = 'Manifesto Caverna'
    } else if (source.includes('protocolo')) {
      formatted = 'Protocolo de 40 Dias'
    }

    if (section && section !== 'fallback_response') {
      formatted += ` - ${section}`
    }

    return formatted
  }

  /**
   * Truncate content to fit token limit while preserving meaning
   */
  private truncateContent(content: string, maxTokens: number): string {
    const maxChars = maxTokens * 4 // Rough estimation

    if (content.length <= maxChars) {
      return content
    }

    // Try to truncate at sentence boundaries
    const sentences = content.split(/[.!?]+/)
    let truncated = ''

    for (const sentence of sentences) {
      const nextLength = truncated.length + sentence.length + 2 // +2 for punctuation
      
      if (nextLength > maxChars) {
        break
      }
      
      truncated += sentence.trim() + '. '
    }

    // If no complete sentences fit, truncate at word boundary
    if (truncated.length < maxChars * 0.3) {
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
   * Estimate token count for text
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for Portuguese/English
    return Math.ceil(text.length / 4)
  }

  /**
   * Calculate average relevance score of results
   */
  private calculateAverageRelevance(results: SearchResult[]): number {
    if (results.length === 0) return 0
    
    const totalScore = results.reduce((sum, result) => sum + result.score, 0)
    return totalScore / results.length
  }

  /**
   * Calculate processing metrics
   */
  private calculateProcessingMetrics(
    originalResults: SearchResult[],
    filteredResults: SearchResult[],
    optimizedResults: SearchResult[],
    contextText: string
  ): ProcessedContext['processingMetrics'] {
    const truncatedResults = optimizedResults.filter(result => 
      result.content.endsWith('...')
    ).length

    const contextTokens = this.estimateTokenCount(contextText)
    const tokenUtilization = contextTokens / this.options.contextWindowSize!

    return {
      originalResults: originalResults.length,
      filteredResults: filteredResults.length,
      truncatedResults,
      tokenUtilization: Math.min(tokenUtilization, 1.0)
    }
  }

  /**
   * Validate processing configuration
   */
  validateConfiguration(): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    if (this.options.contextWindowSize! < 500) {
      issues.push('contextWindowSize should be at least 500 tokens')
    }

    if (this.options.relevanceThreshold! < 0 || this.options.relevanceThreshold! > 1) {
      issues.push('relevanceThreshold must be between 0 and 1')
    }

    if (this.options.maxContextChunks! < 1 || this.options.maxContextChunks! > 20) {
      issues.push('maxContextChunks must be between 1 and 20')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    fallbackResponsesAvailable: number
    averageContextUtilization: number
    recommendedSettings: ProcessingOptions
  } {
    return {
      fallbackResponsesAvailable: this.fallbackResponses.length,
      averageContextUtilization: 0.75, // Target utilization
      recommendedSettings: {
        contextWindowSize: 4000,
        relevanceThreshold: 0.7,
        maxContextChunks: 5,
        prioritizeRecent: false,
        includeSourceAttribution: true,
        fallbackEnabled: true
      }
    }
  }
}

// Export utility functions
export async function processSearchResults(
  searchContext: SearchContext,
  options?: ProcessingOptions
): Promise<ProcessedContext> {
  const processor = new SearchResultProcessor(options)
  return processor.processSearchResults(searchContext)
}

export function createResultProcessor(options?: ProcessingOptions): SearchResultProcessor {
  const processor = new SearchResultProcessor(options)
  
  // Validate configuration
  const validation = processor.validateConfiguration()
  if (!validation.valid) {
    throw new Error(`Invalid processing configuration: ${validation.issues.join(', ')}`)
  }

  return processor
}

export async function optimizeContextForPrompt(
  results: SearchResult[],
  maxTokens: number = 4000,
  includeAttribution: boolean = true
): Promise<string> {
  const processor = new SearchResultProcessor({
    contextWindowSize: maxTokens,
    includeSourceAttribution: includeAttribution
  })

  // Create a mock search context for processing
  const mockContext: SearchContext = {
    query: '',
    embedding: [],
    results,
    totalResults: results.length,
    searchTime: 0,
    fallbackUsed: false
  }

  const processed = await processor.processSearchResults(mockContext)
  return processed.contextText
}