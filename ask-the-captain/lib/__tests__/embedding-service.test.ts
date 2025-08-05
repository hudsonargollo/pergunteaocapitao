// Unit tests for embedding generation service
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EmbeddingService, generateEmbeddingsForChunks } from '../embedding-service'
import { OpenAIClient } from '../openai'
import type { DocumentChunk, EmbeddingVector } from '@/types'

// Mock OpenAI client
vi.mock('../openai')

const mockOpenAIClient = vi.mocked(OpenAIClient)

describe('EmbeddingService', () => {
  let service: EmbeddingService
  let mockClient: any

  const sampleChunks: DocumentChunk[] = [
    {
      id: 'chunk_1',
      content: 'This is the first chunk about Modo Caverna methodology.',
      source: 'test-doc',
      metadata: { chunk_index: 0, token_count: 12 }
    },
    {
      id: 'chunk_2', 
      content: 'This is the second chunk with more detailed information.',
      source: 'test-doc',
      metadata: { chunk_index: 1, token_count: 11 }
    },
    {
      id: 'chunk_3',
      content: 'Final chunk containing conclusion and summary.',
      source: 'test-doc',
      metadata: { chunk_index: 2, token_count: 9 }
    }
  ]

  const mockEmbedding = new Array(1536).fill(0).map(() => Math.random())

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockClient = {
      generateEmbedding: vi.fn().mockResolvedValue(mockEmbedding),
      generateEmbeddings: vi.fn().mockResolvedValue([mockEmbedding, mockEmbedding, mockEmbedding])
    }
    
    mockOpenAIClient.mockImplementation(() => mockClient)
    
    service = new EmbeddingService('test-api-key', {
      batchSize: 2,
      maxRetries: 2,
      retryDelay: 100,
      rateLimit: {
        requestsPerMinute: 10,
        tokensPerMinute: 1000
      }
    })
  })

  describe('generateEmbeddings', () => {
    it('should generate embeddings for all chunks', async () => {
      const embeddings = await service.generateEmbeddings(sampleChunks)

      expect(embeddings).toHaveLength(3)
      expect(embeddings[0].id).toBe('chunk_1')
      expect(embeddings[0].values).toEqual(mockEmbedding)
      expect(embeddings[0].metadata.content).toBe(sampleChunks[0].content)
      expect(embeddings[0].metadata.source).toBe('test-doc')
    })

    it('should process chunks in batches', async () => {
      await service.generateEmbeddings(sampleChunks)

      // With batch size 2, should make 2 batch calls for 3 chunks
      expect(mockClient.generateEmbeddings).toHaveBeenCalledTimes(2)
      
      // First batch should have 2 chunks
      expect(mockClient.generateEmbeddings).toHaveBeenNthCalledWith(1, [
        sampleChunks[0].content,
        sampleChunks[1].content
      ])
      
      // Second batch should have 1 chunk
      expect(mockClient.generateEmbeddings).toHaveBeenNthCalledWith(2, [
        sampleChunks[2].content
      ])
    })

    it('should report progress during processing', async () => {
      const progressUpdates: any[] = []
      
      await service.generateEmbeddings(sampleChunks, (progress) => {
        progressUpdates.push({ ...progress })
      })

      expect(progressUpdates).toHaveLength(2) // Two batches
      expect(progressUpdates[0]).toMatchObject({
        processed: 2,
        total: 3,
        currentBatch: 1,
        totalBatches: 2
      })
      expect(progressUpdates[1]).toMatchObject({
        processed: 3,
        total: 3,
        currentBatch: 2,
        totalBatches: 2
      })
    })

    it('should handle batch failures with individual processing', async () => {
      // Mock batch failure, then individual success
      mockClient.generateEmbeddings
        .mockRejectedValue(new Error('Batch failed')) // All batch calls fail
      
      mockClient.generateEmbedding.mockResolvedValue(mockEmbedding)

      const embeddings = await service.generateEmbeddings(sampleChunks)

      expect(embeddings).toHaveLength(3)
      // Should fall back to individual processing for all chunks
      expect(mockClient.generateEmbedding).toHaveBeenCalledTimes(3) // All chunks processed individually
    })

    it('should retry failed requests', async () => {
      mockClient.generateEmbeddings
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce([mockEmbedding, mockEmbedding])

      const embeddings = await service.generateEmbeddings(sampleChunks.slice(0, 2))

      expect(embeddings).toHaveLength(2)
      expect(mockClient.generateEmbeddings).toHaveBeenCalledTimes(2) // Initial call + retry
    })
  })

  describe('generateSingleEmbedding', () => {
    it('should generate embedding for single chunk', async () => {
      const embedding = await service.generateSingleEmbedding(sampleChunks[0])

      expect(embedding).toBeDefined()
      expect(embedding!.id).toBe('chunk_1')
      expect(embedding!.values).toEqual(mockEmbedding)
      expect(embedding!.metadata.content).toBe(sampleChunks[0].content)
    })

    it('should return null on failure', async () => {
      mockClient.generateEmbedding.mockRejectedValue(new Error('API failure'))

      const embedding = await service.generateSingleEmbedding(sampleChunks[0])

      expect(embedding).toBeNull()
    })
  })

  describe('rate limiting', () => {
    it('should track rate limit usage', async () => {
      await service.generateEmbeddings(sampleChunks.slice(0, 1))

      const status = service.getRateLimitStatus()
      
      expect(status.requestsUsed).toBe(1)
      expect(status.tokensUsed).toBeGreaterThan(0)
      expect(status.requestsRemaining).toBe(9) // 10 - 1
    })

    it('should track rate limit status correctly', async () => {
      // Create service with very low rate limits
      const limitedService = new EmbeddingService('test-key', {
        rateLimit: {
          requestsPerMinute: 10,
          tokensPerMinute: 1000
        }
      })

      const initialStatus = limitedService.getRateLimitStatus()
      expect(initialStatus.requestsUsed).toBe(0)
      expect(initialStatus.tokensUsed).toBe(0)
      
      // Process one chunk
      await limitedService.generateEmbeddings(sampleChunks.slice(0, 1))
      
      const afterStatus = limitedService.getRateLimitStatus()
      expect(afterStatus.requestsUsed).toBe(1)
      expect(afterStatus.tokensUsed).toBeGreaterThan(0)
    })
  })

  describe('validation and statistics', () => {
    it('should validate embedding quality', () => {
      const validEmbedding: EmbeddingVector = {
        id: 'test',
        values: new Array(1536).fill(0.5),
        metadata: {
          content: 'Test content',
          source: 'test',
          chunk_index: 0,
          token_count: 10
        }
      }

      const invalidEmbedding: EmbeddingVector = {
        id: 'test',
        values: new Array(100).fill(0.5), // Wrong dimension
        metadata: {
          content: '',
          source: 'test',
          chunk_index: 0,
          token_count: 0
        }
      }

      expect(service.validateEmbedding(validEmbedding)).toBe(true)
      expect(service.validateEmbedding(invalidEmbedding)).toBe(false)
    })

    it('should calculate embedding statistics', async () => {
      const embeddings = await service.generateEmbeddings(sampleChunks)
      const stats = service.calculateStatistics(embeddings)

      expect(stats.totalEmbeddings).toBe(3)
      expect(stats.totalTokens).toBeGreaterThan(0)
      expect(stats.averageTokensPerChunk).toBeGreaterThan(0)
      expect(stats.sources['test-doc']).toBe(3)
      expect(stats.qualityScore).toBe(1) // All embeddings should be valid
    })
  })

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      mockClient.generateEmbeddings.mockRejectedValue(new Error('API Error'))
      mockClient.generateEmbedding.mockRejectedValue(new Error('API Error'))

      const progressUpdates: any[] = []
      const embeddings = await service.generateEmbeddings(sampleChunks, (progress) => {
        progressUpdates.push(progress)
      })

      expect(embeddings).toHaveLength(0) // No successful embeddings
      expect(progressUpdates[progressUpdates.length - 1].errors).toHaveLength(3) // All chunks failed
    })

    it('should handle partial failures', async () => {
      mockClient.generateEmbeddings
        .mockResolvedValueOnce([mockEmbedding, mockEmbedding]) // First batch succeeds
        .mockRejectedValue(new Error('Second batch fails')) // Second batch fails
      
      mockClient.generateEmbedding.mockRejectedValue(new Error('Individual processing fails'))

      const embeddings = await service.generateEmbeddings(sampleChunks)

      expect(embeddings).toHaveLength(2) // Only first batch succeeded
    })
  })

  describe('token estimation', () => {
    it('should estimate tokens reasonably', () => {
      const testChunk: DocumentChunk = {
        id: 'test',
        content: 'This is a test sentence with approximately twenty tokens.',
        source: 'test',
        metadata: { chunk_index: 0 }
      }

      // @ts-ignore - accessing private method for testing
      const tokenCount = service.estimateTokenCount(testChunk.content)
      
      expect(tokenCount).toBeGreaterThan(10)
      expect(tokenCount).toBeLessThan(25)
    })
  })
})

describe('Utility functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    const mockClient = {
      generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.5)),
      generateEmbeddings: vi.fn().mockResolvedValue([new Array(1536).fill(0.5)])
    }
    
    mockOpenAIClient.mockImplementation(() => mockClient)
  })

  it('should export generateEmbeddingsForChunks utility', async () => {
    const chunks = [
      {
        id: 'test',
        content: 'Test content',
        source: 'test',
        metadata: { chunk_index: 0 }
      }
    ]

    const embeddings = await generateEmbeddingsForChunks(chunks, 'test-key')

    expect(embeddings).toHaveLength(1)
    expect(embeddings[0].id).toBe('test')
  })
})