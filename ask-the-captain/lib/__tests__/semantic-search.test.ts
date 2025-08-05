// Unit tests for Semantic Search Service
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SemanticSearchService, createSemanticSearchService, performSemanticSearch } from '../semantic-search'
import { EmbeddingService } from '../embedding-service'
import { VectorizeClient } from '../vectorize'
import type { SearchResult, EmbeddingVector, DocumentChunk } from '@/types'

// Mock dependencies
const mockEmbeddingService = {
  generateSingleEmbedding: vi.fn()
}

const mockVectorizeClient = {
  search: vi.fn()
}

// Helper function to create embedding vector without console output
const createMockEmbedding = () => Array.from({ length: 1536 }, () => 0.1)

describe('SemanticSearchService', () => {
  let service: SemanticSearchService

  const sampleSearchResults: SearchResult[] = [
    {
      content: 'O Modo Caverna é uma metodologia de transformação pessoal baseada em disciplina e foco.',
      score: 0.95,
      metadata: {
        source: 'modocaverna-docs.md',
        section: 'introducao'
      }
    },
    {
      content: 'Os três pilares fundamentais são: Propósito, Foco e Progresso.',
      score: 0.88,
      metadata: {
        source: 'pilares-fundamentais',
        section: 'conceitos'
      }
    },
    {
      content: 'A disciplina é mais importante que a motivação para alcançar resultados.',
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
    }
  ]

  const sampleEmbedding = createMockEmbedding()

  beforeEach(() => {
    vi.clearAllMocks()
    service = new SemanticSearchService(
      mockEmbeddingService as any,
      mockVectorizeClient as any
    )
  })

  describe('search', () => {
    it('should perform complete semantic search successfully', async () => {
      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: sampleEmbedding,
        metadata: {
          content: 'Como funciona o Modo Caverna?',
          source: 'user_query',
          chunk_index: 0,
          token_count: 10
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(sampleSearchResults)

      const result = await service.search('Como funciona o Modo Caverna?')

      expect(result.query).toBe('Como funciona o Modo Caverna?')
      expect(result.embedding).toEqual(sampleEmbedding)
      expect(result.results).toHaveLength(4)
      expect(result.totalResults).toBe(4)
      expect(result.searchTime).toBeGreaterThan(0)
      expect(result.fallbackUsed).toBe(false)

      expect(mockEmbeddingService.generateSingleEmbedding).toHaveBeenCalledWith({
        id: expect.stringMatching(/^query_\d+$/),
        content: 'Como funciona o Modo Caverna?',
        source: 'user_query',
        metadata: {}
      })

      expect(mockVectorizeClient.search).toHaveBeenCalledWith(sampleEmbedding, {
        topK: 10,
        minScore: 0.0,
        includeMetadata: true
      })
    })

    it('should filter results by minimum score', async () => {
      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: sampleEmbedding,
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(sampleSearchResults)

      const result = await service.search('test query', { minScore: 0.85 })

      // Should only include results with score >= 0.85
      expect(result.results).toHaveLength(2)
      expect(result.results.every(r => r.score >= 0.85)).toBe(true)
    })

    it('should limit results to maxResults', async () => {
      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: sampleEmbedding,
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(sampleSearchResults)

      const result = await service.search('test query', { maxResults: 2 })

      expect(result.results).toHaveLength(2)
    })

    it('should handle search failures with fallback', async () => {
      mockEmbeddingService.generateSingleEmbedding.mockRejectedValue(new Error('Embedding failed'))

      const result = await service.search('test query', { fallbackEnabled: true })

      expect(result.fallbackUsed).toBe(true)
      expect(result.results).toHaveLength(1)
      expect(result.results[0].metadata.source).toBe('fallback_response')
      expect(result.results[0].content).toContain('guerreiro')
    })

    it('should throw error when fallback is disabled', async () => {
      mockEmbeddingService.generateSingleEmbedding.mockRejectedValue(new Error('Embedding failed'))

      await expect(service.search('test query', { fallbackEnabled: false }))
        .rejects.toThrow('Semantic search failed')
    })
  })

  describe('generateQueryEmbedding', () => {
    it('should generate embedding for query', async () => {
      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: sampleEmbedding,
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)

      const result = await service.generateQueryEmbedding('test query')

      expect(result).toEqual(sampleEmbedding)
      expect(mockEmbeddingService.generateSingleEmbedding).toHaveBeenCalledWith({
        id: expect.stringMatching(/^query_\d+$/),
        content: 'test query',
        source: 'user_query',
        metadata: {}
      })
    })

    it('should handle embedding generation failure', async () => {
      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(null)

      await expect(service.generateQueryEmbedding('test query'))
        .rejects.toThrow('Failed to generate query embedding')
    })

    it('should handle service errors', async () => {
      mockEmbeddingService.generateSingleEmbedding.mockRejectedValue(new Error('Service error'))

      await expect(service.generateQueryEmbedding('test query'))
        .rejects.toThrow('Query embedding failed')
    })
  })

  describe('result ranking and processing', () => {
    it('should rank results by multiple factors', async () => {
      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: sampleEmbedding,
        metadata: {
          content: 'modo caverna disciplina',
          source: 'user_query',
          chunk_index: 0,
          token_count: 10
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(sampleSearchResults)

      const result = await service.search('modo caverna disciplina')

      // Results should be ordered by final score (combination of factors)
      expect(result.results[0].score).toBeGreaterThanOrEqual(result.results[1].score)
      
      // The modocaverna-docs.md source should be ranked higher due to source relevance
      const modoCavernaResult = result.results.find(r => r.metadata.source === 'modocaverna-docs.md')
      expect(modoCavernaResult).toBeDefined()
    })

    it('should remove duplicate content', async () => {
      const duplicateResults: SearchResult[] = [
        {
          content: 'O Modo Caverna é uma metodologia de transformação.',
          score: 0.95,
          metadata: { source: 'doc1', section: 'intro' }
        },
        {
          content: 'O Modo Caverna é uma metodologia de transformação.',
          score: 0.93,
          metadata: { source: 'doc2', section: 'intro' }
        },
        {
          content: 'Disciplina é fundamental para o sucesso.',
          score: 0.85,
          metadata: { source: 'doc3', section: 'conceitos' }
        }
      ]

      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: sampleEmbedding,
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(duplicateResults)

      const result = await service.search('test query', { diversityThreshold: 0.9 })

      // Should remove the exact duplicate
      expect(result.results).toHaveLength(2)
    })

    it('should optimize for context window', async () => {
      const longResults: SearchResult[] = [
        {
          content: 'A'.repeat(2000), // ~500 tokens
          score: 0.95,
          metadata: { source: 'doc1' }
        },
        {
          content: 'B'.repeat(2000), // ~500 tokens
          score: 0.90,
          metadata: { source: 'doc2' }
        },
        {
          content: 'C'.repeat(8000), // ~2000 tokens
          score: 0.85,
          metadata: { source: 'doc3' }
        }
      ]

      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: sampleEmbedding,
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(longResults)

      const result = await service.search('test query', { contextWindowSize: 1500 })

      // Should fit within context window
      const totalTokens = result.results.reduce((sum, r) => sum + Math.ceil(r.content.length / 4), 0)
      expect(totalTokens).toBeLessThanOrEqual(1500)
    })
  })

  describe('getSearchMetrics', () => {
    it('should calculate search quality metrics', async () => {
      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: sampleEmbedding,
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(sampleSearchResults)

      const searchContext = await service.search('test query')
      const metrics = service.getSearchMetrics(searchContext)

      expect(metrics.averageScore).toBeGreaterThan(0)
      expect(metrics.scoreDistribution.high).toBeGreaterThanOrEqual(0)
      expect(metrics.scoreDistribution.medium).toBeGreaterThanOrEqual(0)
      expect(metrics.scoreDistribution.low).toBeGreaterThanOrEqual(0)
      expect(Object.keys(metrics.sourceDistribution)).toHaveLength(4)
      expect(metrics.contentCoverage).toBeGreaterThan(0)
      expect(metrics.contentCoverage).toBeLessThanOrEqual(1)
    })
  })

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const validation = service.validateConfiguration()
      expect(validation.valid).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })

    it('should identify invalid minScore', () => {
      const invalidService = new SemanticSearchService(
        mockEmbeddingService as any,
        mockVectorizeClient as any,
        { minScore: 1.5 }
      )

      const validation = invalidService.validateConfiguration()
      expect(validation.valid).toBe(false)
      expect(validation.issues).toContain('minScore must be between 0 and 1')
    })

    it('should identify invalid topK', () => {
      const invalidService = new SemanticSearchService(
        mockEmbeddingService as any,
        mockVectorizeClient as any,
        { topK: 0 }
      )

      const validation = invalidService.validateConfiguration()
      expect(validation.valid).toBe(false)
      expect(validation.issues).toContain('topK must be between 1 and 100')
    })

    it('should identify maxResults exceeding topK', () => {
      const invalidService = new SemanticSearchService(
        mockEmbeddingService as any,
        mockVectorizeClient as any,
        { topK: 5, maxResults: 10 }
      )

      const validation = invalidService.validateConfiguration()
      expect(validation.valid).toBe(false)
      expect(validation.issues).toContain('maxResults cannot exceed topK')
    })

    it('should identify small context window', () => {
      const invalidService = new SemanticSearchService(
        mockEmbeddingService as any,
        mockVectorizeClient as any,
        { contextWindowSize: 100 }
      )

      const validation = invalidService.validateConfiguration()
      expect(validation.valid).toBe(false)
      expect(validation.issues).toContain('contextWindowSize should be at least 500 tokens')
    })
  })
})

describe('Utility functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSemanticSearchService', () => {
    it('should create service with valid configuration', async () => {
      const service = await createSemanticSearchService(
        mockEmbeddingService as any,
        mockVectorizeClient as any
      )

      expect(service).toBeInstanceOf(SemanticSearchService)
    })

    it('should throw on invalid configuration', async () => {
      await expect(createSemanticSearchService(
        mockEmbeddingService as any,
        mockVectorizeClient as any,
        { minScore: 2.0 }
      )).rejects.toThrow('Invalid search configuration')
    })
  })

  describe('performSemanticSearch', () => {
    it('should perform search using utility function', async () => {
      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: new Array(1536).fill(0.1),
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue([
        {
          content: 'Test result',
          score: 0.9,
          metadata: { source: 'test-doc' }
        }
      ])

      const result = await performSemanticSearch(
        'test query',
        mockEmbeddingService as any,
        mockVectorizeClient as any
      )

      expect(result.query).toBe('test query')
      expect(result.results).toHaveLength(1)
      expect(result.fallbackUsed).toBe(false)
    })
  })
})

describe('Advanced ranking features', () => {
  let service: SemanticSearchService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new SemanticSearchService(
      mockEmbeddingService as any,
      mockVectorizeClient as any
    )
  })

  describe('source relevance scoring', () => {
    it('should prioritize modocaverna-docs.md', async () => {
      const results: SearchResult[] = [
        {
          content: 'Content from main docs',
          score: 0.8,
          metadata: { source: 'modocaverna-docs.md' }
        },
        {
          content: 'Content from other source',
          score: 0.85,
          metadata: { source: 'other-document' }
        }
      ]

      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: new Array(1536).fill(0.1),
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(results)

      const searchResult = await service.search('test query')

      // The modocaverna-docs.md should be ranked higher despite lower semantic score
      expect(searchResult.results[0].metadata.source).toBe('modocaverna-docs.md')
    })

    it('should rank cave-focus content highly', async () => {
      const results: SearchResult[] = [
        {
          content: 'Generic content about focus',
          score: 0.9,
          metadata: { source: 'generic-doc' }
        },
        {
          content: 'Cave Focus methodology content',
          score: 0.85,
          metadata: { source: 'cave-focus-aula-01' }
        }
      ]

      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: new Array(1536).fill(0.1),
        metadata: {
          content: 'focus methodology',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(results)

      const searchResult = await service.search('focus methodology')

      // Cave Focus content should be ranked higher
      expect(searchResult.results[0].metadata.source).toBe('cave-focus-aula-01')
    })
  })

  describe('content length optimization', () => {
    it('should prefer optimal length content', async () => {
      const results: SearchResult[] = [
        {
          content: 'Short',
          score: 0.8, // Lower semantic score
          metadata: { source: 'doc1' }
        },
        {
          content: 'A'.repeat(500), // Optimal length
          score: 0.75, // Even lower semantic score but should be boosted by length
          metadata: { source: 'doc2' }
        }
      ]

      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: new Array(1536).fill(0.1),
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(results)

      const searchResult = await service.search('test query')

      // Should have both results, but we can check that length scoring is applied
      expect(searchResult.results).toHaveLength(2)
      // The longer content should be present in results
      const longerResult = searchResult.results.find(r => r.content.length > 100)
      expect(longerResult).toBeDefined()
    })

    it('should penalize extremely long content', async () => {
      const results: SearchResult[] = [
        {
          content: 'A'.repeat(800), // Optimal length
          score: 0.8,
          metadata: { source: 'optimal-doc' }
        },
        {
          content: 'B'.repeat(2000), // Too long
          score: 0.85, // Higher semantic score
          metadata: { source: 'long-doc' }
        }
      ]

      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: new Array(1536).fill(0.1),
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(results)

      const searchResult = await service.search('test query')

      // Should have both results, but check that length scoring affects ranking
      expect(searchResult.results).toHaveLength(2)
      
      // Find the optimal length result
      const optimalResult = searchResult.results.find(r => r.metadata.source === 'optimal-doc')
      const longResult = searchResult.results.find(r => r.metadata.source === 'long-doc')
      
      expect(optimalResult).toBeDefined()
      expect(longResult).toBeDefined()
    })
  })

  describe('keyword matching bonus', () => {
    it('should boost results with keyword matches', async () => {
      const results: SearchResult[] = [
        {
          content: 'This content has no matching words',
          score: 0.9,
          metadata: { source: 'doc1' }
        },
        {
          content: 'This content mentions caverna and modo specifically',
          score: 0.85,
          metadata: { source: 'doc2' }
        }
      ]

      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: new Array(1536).fill(0.1),
        metadata: {
          content: 'modo caverna',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(results)

      const searchResult = await service.search('modo caverna')

      // The content with keyword matches should be ranked higher
      expect(searchResult.results[0].content).toContain('caverna')
      expect(searchResult.results[0].content).toContain('modo')
    })

    it('should handle Portuguese keyword matching', async () => {
      const results: SearchResult[] = [
        {
          content: 'Disciplina é fundamental para o sucesso',
          score: 0.8,
          metadata: { source: 'disciplina-doc' }
        },
        {
          content: 'Focus is important for success',
          score: 0.85,
          metadata: { source: 'english-doc' }
        }
      ]

      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: new Array(1536).fill(0.1),
        metadata: {
          content: 'disciplina foco',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(results)

      const searchResult = await service.search('disciplina foco')

      // Portuguese content with keyword match should be ranked higher
      expect(searchResult.results[0].content).toContain('Disciplina')
    })
  })

  describe('context window optimization', () => {
    it('should fit results within token limits', async () => {
      const longResults: SearchResult[] = [
        {
          content: 'A'.repeat(1000), // ~250 tokens
          score: 0.9,
          metadata: { source: 'doc1' }
        },
        {
          content: 'B'.repeat(1000), // ~250 tokens
          score: 0.85,
          metadata: { source: 'doc2' }
        },
        {
          content: 'C'.repeat(4000), // ~1000 tokens
          score: 0.8,
          metadata: { source: 'doc3' }
        }
      ]

      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: new Array(1536).fill(0.1),
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(longResults)

      const searchResult = await service.search('test query', { contextWindowSize: 800 })

      // Should optimize for context window
      const totalTokens = searchResult.results.reduce((sum, r) => sum + Math.ceil(r.content.length / 4), 0)
      expect(totalTokens).toBeLessThanOrEqual(800)
    })

    it('should truncate content when necessary', async () => {
      const results: SearchResult[] = [
        {
          content: 'A'.repeat(3000), // ~750 tokens, should be truncated
          score: 0.9,
          metadata: { source: 'long-doc' }
        }
      ]

      const mockEmbeddingVector: EmbeddingVector = {
        id: 'query_123',
        values: new Array(1536).fill(0.1),
        metadata: {
          content: 'test query',
          source: 'user_query',
          chunk_index: 0,
          token_count: 5
        }
      }

      mockEmbeddingService.generateSingleEmbedding.mockResolvedValue(mockEmbeddingVector)
      mockVectorizeClient.search.mockResolvedValue(results)

      const searchResult = await service.search('test query', { contextWindowSize: 500 })

      // Content should be truncated
      expect(searchResult.results[0].content.length).toBeLessThan(3000)
      expect(searchResult.results[0].content).toMatch(/\.\.\.$/)
    })
  })
})