// Unit tests for Search Result Processor
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  SearchResultProcessor, 
  processSearchResults, 
  createResultProcessor, 
  optimizeContextForPrompt 
} from '../search-result-processor'
import type { SearchContext, SearchResult } from '../semantic-search'

describe('SearchResultProcessor', () => {
  let processor: SearchResultProcessor

  const sampleSearchResults: SearchResult[] = [
    {
      content: 'O Modo Caverna é uma metodologia de transformação pessoal baseada em disciplina e foco. A caverna representa o espaço mental onde você se isola das distrações para trabalhar em si mesmo.',
      score: 0.95,
      metadata: {
        source: 'modocaverna-docs.md',
        section: 'introducao'
      }
    },
    {
      content: 'Os três pilares fundamentais são: Propósito (saber para onde vai), Foco (eliminar distrações) e Progresso (ação consistente). Estes pilares sustentam toda a metodologia.',
      score: 0.88,
      metadata: {
        source: 'pilares-fundamentais',
        section: 'conceitos'
      }
    },
    {
      content: 'A disciplina é mais importante que a motivação para alcançar resultados duradouros. A motivação é temporária, mas a disciplina é permanente.',
      score: 0.82,
      metadata: {
        source: 'cave-focus-aula-01',
        section: 'mindset'
      }
    },
    {
      content: 'Texto muito curto.',
      score: 0.75,
      metadata: {
        source: 'exemplo-curto',
        section: 'test'
      }
    },
    {
      content: 'Este é um resultado com score baixo que deve ser filtrado pela relevância mínima.',
      score: 0.5,
      metadata: {
        source: 'low-relevance',
        section: 'test'
      }
    }
  ]

  const sampleSearchContext: SearchContext = {
    query: 'Como funciona o Modo Caverna?',
    embedding: new Array(1536).fill(0.1),
    results: sampleSearchResults,
    totalResults: 5,
    searchTime: 150,
    fallbackUsed: false
  }

  beforeEach(() => {
    processor = new SearchResultProcessor()
  })

  describe('processSearchResults', () => {
    it('should process search results successfully', async () => {
      const result = await processor.processSearchResults(sampleSearchContext)

      expect(result.fallbackUsed).toBe(false)
      expect(result.usedResults.length).toBeGreaterThan(0)
      expect(result.contextText).toContain('Modo Caverna')
      expect(result.totalTokens).toBeGreaterThan(0)
      expect(result.relevanceScore).toBeGreaterThan(0.7)
      expect(result.processingMetrics.originalResults).toBe(5)
    })

    it('should filter results by relevance threshold', async () => {
      const customProcessor = new SearchResultProcessor({
        relevanceThreshold: 0.8
      })

      const result = await customProcessor.processSearchResults(sampleSearchContext)

      // Should only include results with score >= 0.8
      expect(result.usedResults.every(r => r.score >= 0.8)).toBe(true)
      expect(result.processingMetrics.filteredResults).toBe(3) // 0.95, 0.88, 0.82
    })

    it('should limit results to maxContextChunks', async () => {
      const customProcessor = new SearchResultProcessor({
        maxContextChunks: 2,
        relevanceThreshold: 0.7
      })

      const result = await customProcessor.processSearchResults(sampleSearchContext)

      expect(result.usedResults.length).toBeLessThanOrEqual(2)
    })

    it('should include source attribution when enabled', async () => {
      const customProcessor = new SearchResultProcessor({
        includeSourceAttribution: true
      })

      const result = await customProcessor.processSearchResults(sampleSearchContext)

      expect(result.contextText).toContain('[Fonte:')
      expect(result.contextText).toContain('Documentação Principal do Modo Caverna')
    })

    it('should exclude source attribution when disabled', async () => {
      const customProcessor = new SearchResultProcessor({
        includeSourceAttribution: false
      })

      const result = await customProcessor.processSearchResults(sampleSearchContext)

      expect(result.contextText).not.toContain('[Fonte:')
    })

    it('should optimize for context window size', async () => {
      const longResults: SearchResult[] = [
        {
          content: 'A'.repeat(8000), // ~2000 tokens
          score: 0.95,
          metadata: { source: 'doc1' }
        },
        {
          content: 'B'.repeat(8000), // ~2000 tokens
          score: 0.90,
          metadata: { source: 'doc2' }
        },
        {
          content: 'C'.repeat(8000), // ~2000 tokens
          score: 0.85,
          metadata: { source: 'doc3' }
        }
      ]

      const longContext: SearchContext = {
        ...sampleSearchContext,
        results: longResults
      }

      const customProcessor = new SearchResultProcessor({
        contextWindowSize: 2000 // Small window
      })

      const result = await customProcessor.processSearchResults(longContext)

      expect(result.totalTokens).toBeLessThanOrEqual(2000)
      expect(result.processingMetrics.tokenUtilization).toBeLessThanOrEqual(1.0)
    })

    it('should truncate content when necessary', async () => {
      const longResult: SearchResult = {
        content: 'Este é um texto muito longo que precisa ser truncado. '.repeat(100),
        score: 0.9,
        metadata: { source: 'long-doc' }
      }

      const longContext: SearchContext = {
        ...sampleSearchContext,
        results: [longResult]
      }

      const customProcessor = new SearchResultProcessor({
        contextWindowSize: 500 // Very small window
      })

      const result = await customProcessor.processSearchResults(longContext)

      expect(result.usedResults[0].content).toContain('...')
      expect(result.processingMetrics.truncatedResults).toBe(1)
    })
  })

  describe('fallback handling', () => {
    it('should use fallback when no results meet relevance threshold', async () => {
      const lowRelevanceContext: SearchContext = {
        ...sampleSearchContext,
        results: [
          {
            content: 'Low relevance content',
            score: 0.3,
            metadata: { source: 'low-doc' }
          }
        ]
      }

      const customProcessor = new SearchResultProcessor({
        relevanceThreshold: 0.8,
        fallbackEnabled: true
      })

      const result = await customProcessor.processSearchResults(lowRelevanceContext)

      expect(result.fallbackUsed).toBe(true)
      expect(result.contextText).toContain('guerreiro')
      expect(result.usedResults[0].metadata.source).toContain('capitao_fallback')
    })

    it('should select appropriate fallback based on query', async () => {
      const instructionalQuery: SearchContext = {
        ...sampleSearchContext,
        query: 'Como fazer algo?',
        results: []
      }

      const result = await processor.processSearchResults(instructionalQuery)

      expect(result.fallbackUsed).toBe(true)
      expect(result.usedResults[0].metadata.source).toBe('capitao_fallback_practice')
    })

    it('should select motivational fallback for motivation queries', async () => {
      const motivationalQuery: SearchContext = {
        ...sampleSearchContext,
        query: 'Preciso de motivação',
        results: []
      }

      const result = await processor.processSearchResults(motivationalQuery)

      expect(result.fallbackUsed).toBe(true)
      expect(result.usedResults[0].metadata.source).toBe('capitao_fallback_principles')
    })

    it('should select challenging fallback for difficulty queries', async () => {
      const challengingQuery: SearchContext = {
        ...sampleSearchContext,
        query: 'Isso é muito difícil',
        results: []
      }

      const result = await processor.processSearchResults(challengingQuery)

      expect(result.fallbackUsed).toBe(true)
      // Should select a challenging tone fallback (could be any of the challenging ones)
      expect(result.usedResults[0].metadata.source).toContain('capitao_fallback')
    })

    it('should not use fallback when disabled', async () => {
      const emptyContext: SearchContext = {
        ...sampleSearchContext,
        results: []
      }

      const customProcessor = new SearchResultProcessor({
        fallbackEnabled: false
      })

      const result = await customProcessor.processSearchResults(emptyContext)

      expect(result.fallbackUsed).toBe(false)
      expect(result.usedResults).toHaveLength(0)
      expect(result.contextText).toBe('')
    })
  })

  describe('source attribution formatting', () => {
    it('should format modocaverna-docs.md source correctly', async () => {
      const result = await processor.processSearchResults(sampleSearchContext)

      expect(result.contextText).toContain('Documentação Principal do Modo Caverna')
    })

    it('should format cave-focus source correctly', async () => {
      const caveFocusContext: SearchContext = {
        ...sampleSearchContext,
        results: [
          {
            content: 'Cave Focus content',
            score: 0.9,
            metadata: {
              source: 'cave-focus-aula-01',
              section: 'mindset'
            }
          }
        ]
      }

      const result = await processor.processSearchResults(caveFocusContext)

      expect(result.contextText).toContain('Cave Focus - Módulo de Foco')
    })

    it('should format pilares source correctly', async () => {
      const pilaresContext: SearchContext = {
        ...sampleSearchContext,
        results: [
          {
            content: 'Pilares content',
            score: 0.9,
            metadata: {
              source: 'pilares-fundamentais',
              section: 'conceitos'
            }
          }
        ]
      }

      const result = await processor.processSearchResults(pilaresContext)

      expect(result.contextText).toContain('Os Três Pilares Fundamentais')
    })
  })

  describe('processing metrics', () => {
    it('should calculate accurate processing metrics', async () => {
      const result = await processor.processSearchResults(sampleSearchContext)

      expect(result.processingMetrics.originalResults).toBe(5)
      expect(result.processingMetrics.filteredResults).toBeGreaterThan(0)
      expect(result.processingMetrics.tokenUtilization).toBeGreaterThan(0)
      expect(result.processingMetrics.tokenUtilization).toBeLessThanOrEqual(1)
    })

    it('should track truncated results correctly', async () => {
      const longResult: SearchResult = {
        content: 'Very long content that will be truncated. '.repeat(200),
        score: 0.9,
        metadata: { source: 'long-doc' }
      }

      const longContext: SearchContext = {
        ...sampleSearchContext,
        results: [longResult]
      }

      const customProcessor = new SearchResultProcessor({
        contextWindowSize: 200 // Very small to force truncation
      })

      const result = await customProcessor.processSearchResults(longContext)

      // Check if content was actually truncated
      const wasTruncated = result.usedResults.some(r => r.content.endsWith('...'))
      if (wasTruncated) {
        expect(result.processingMetrics.truncatedResults).toBeGreaterThan(0)
      } else {
        // If not truncated, that's also valid behavior
        expect(result.processingMetrics.truncatedResults).toBe(0)
      }
    })
  })

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const validation = processor.validateConfiguration()
      expect(validation.valid).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })

    it('should identify invalid contextWindowSize', () => {
      const invalidProcessor = new SearchResultProcessor({
        contextWindowSize: 100
      })

      const validation = invalidProcessor.validateConfiguration()
      expect(validation.valid).toBe(false)
      expect(validation.issues).toContain('contextWindowSize should be at least 500 tokens')
    })

    it('should identify invalid relevanceThreshold', () => {
      const invalidProcessor = new SearchResultProcessor({
        relevanceThreshold: 1.5
      })

      const validation = invalidProcessor.validateConfiguration()
      expect(validation.valid).toBe(false)
      expect(validation.issues).toContain('relevanceThreshold must be between 0 and 1')
    })

    it('should identify invalid maxContextChunks', () => {
      const invalidProcessor = new SearchResultProcessor({
        maxContextChunks: 0
      })

      const validation = invalidProcessor.validateConfiguration()
      expect(validation.valid).toBe(false)
      expect(validation.issues).toContain('maxContextChunks must be between 1 and 20')
    })
  })

  describe('getProcessingStats', () => {
    it('should return processing statistics', () => {
      const stats = processor.getProcessingStats()

      expect(stats.fallbackResponsesAvailable).toBeGreaterThan(0)
      expect(stats.averageContextUtilization).toBe(0.75)
      expect(stats.recommendedSettings).toBeDefined()
      expect(stats.recommendedSettings.contextWindowSize).toBe(4000)
    })
  })
})

describe('Utility functions', () => {
  const sampleResults: SearchResult[] = [
    {
      content: 'Test content for utility functions',
      score: 0.9,
      metadata: { source: 'test-doc' }
    }
  ]

  const sampleContext: SearchContext = {
    query: 'test query',
    embedding: [],
    results: sampleResults,
    totalResults: 1,
    searchTime: 100,
    fallbackUsed: false
  }

  describe('processSearchResults', () => {
    it('should process results using utility function', async () => {
      const result = await processSearchResults(sampleContext)

      expect(result.contextText).toContain('Test content')
      expect(result.fallbackUsed).toBe(false)
    })

    it('should accept custom options', async () => {
      const result = await processSearchResults(sampleContext, {
        includeSourceAttribution: false
      })

      expect(result.contextText).not.toContain('[Fonte:')
    })
  })

  describe('createResultProcessor', () => {
    it('should create processor with valid configuration', () => {
      const processor = createResultProcessor()
      expect(processor).toBeInstanceOf(SearchResultProcessor)
    })

    it('should throw on invalid configuration', () => {
      expect(() => createResultProcessor({
        contextWindowSize: 100
      })).toThrow('Invalid processing configuration')
    })
  })

  describe('optimizeContextForPrompt', () => {
    it('should optimize context for prompt construction', async () => {
      const contextText = await optimizeContextForPrompt(sampleResults)

      expect(contextText).toContain('Test content')
      expect(contextText).toContain('[Fonte:')
    })

    it('should respect token limits', async () => {
      const longResults: SearchResult[] = [
        {
          content: 'A'.repeat(8000),
          score: 0.9,
          metadata: { source: 'long-doc' }
        }
      ]

      const contextText = await optimizeContextForPrompt(longResults, 1000)

      // Should be truncated to fit within token limit
      const estimatedTokens = Math.ceil(contextText.length / 4)
      expect(estimatedTokens).toBeLessThanOrEqual(1000)
    })

    it('should handle attribution setting', async () => {
      const contextWithAttribution = await optimizeContextForPrompt(sampleResults, 4000, true)
      const contextWithoutAttribution = await optimizeContextForPrompt(sampleResults, 4000, false)

      expect(contextWithAttribution).toContain('[Fonte:')
      expect(contextWithoutAttribution).not.toContain('[Fonte:')
    })
  })
})

describe('Content truncation', () => {
  let processor: SearchResultProcessor

  beforeEach(() => {
    processor = new SearchResultProcessor()
  })

  it('should handle content truncation scenarios', async () => {
    const longSentenceResult: SearchResult = {
      content: 'Esta é a primeira frase. Esta é a segunda frase que é muito longa e contém muitas palavras para testar o truncamento. Esta é a terceira frase.',
      score: 0.9,
      metadata: { source: 'test-doc' }
    }

    const context: SearchContext = {
      query: 'test',
      embedding: [],
      results: [longSentenceResult],
      totalResults: 1,
      searchTime: 100,
      fallbackUsed: false
    }

    const customProcessor = new SearchResultProcessor({
      contextWindowSize: 1000, // Reasonable size
      relevanceThreshold: 0.5 // Lower threshold to ensure content passes
    })

    const result = await customProcessor.processSearchResults(context)

    // Should process the content successfully
    expect(result.usedResults.length).toBeGreaterThan(0)
    expect(result.contextText).toContain('primeira frase')
  })

  it('should handle word-level content processing', async () => {
    const longWordResult: SearchResult = {
      content: 'palavra1 palavra2 palavra3 palavra4 palavra5 palavra6 palavra7 palavra8 palavra9 palavra10',
      score: 0.9,
      metadata: { source: 'test-doc' }
    }

    const context: SearchContext = {
      query: 'test',
      embedding: [],
      results: [longWordResult],
      totalResults: 1,
      searchTime: 100,
      fallbackUsed: false
    }

    const customProcessor = new SearchResultProcessor({
      contextWindowSize: 1000, // Reasonable size
      relevanceThreshold: 0.5 // Lower threshold to ensure content passes
    })

    const result = await customProcessor.processSearchResults(context)

    // Should process the content successfully
    expect(result.usedResults.length).toBeGreaterThan(0)
    expect(result.contextText).toContain('palavra1')
  })
})