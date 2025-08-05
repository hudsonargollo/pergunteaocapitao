// Unit tests for Vectorize client
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VectorizeClient, createVectorizeClient, ingestEmbeddings } from '../vectorize'
import type { EmbeddingVector } from '@/types'

// Mock Vectorize index
const mockVectorizeIndex = {
  upsert: vi.fn(),
  query: vi.fn(),
  deleteByIds: vi.fn(),
  describe: vi.fn()
}

describe('VectorizeClient', () => {
  let client: VectorizeClient

  const sampleEmbeddings: EmbeddingVector[] = [
    {
      id: 'test_1',
      values: new Array(1536).fill(0.1),
      metadata: {
        content: 'Test content 1',
        source: 'test-doc',
        chunk_index: 0,
        token_count: 10
      }
    },
    {
      id: 'test_2',
      values: new Array(1536).fill(0.2),
      metadata: {
        content: 'Test content 2',
        source: 'test-doc',
        chunk_index: 1,
        token_count: 12
      }
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    client = new VectorizeClient(mockVectorizeIndex as any)
  })

  describe('upsertVectors', () => {
    it('should upsert vectors successfully', async () => {
      mockVectorizeIndex.upsert.mockResolvedValue(undefined)

      await client.upsertVectors(sampleEmbeddings)

      expect(mockVectorizeIndex.upsert).toHaveBeenCalledWith([
        {
          id: 'test_1',
          values: sampleEmbeddings[0].values,
          metadata: sampleEmbeddings[0].metadata
        },
        {
          id: 'test_2',
          values: sampleEmbeddings[1].values,
          metadata: sampleEmbeddings[1].metadata
        }
      ])
    })

    it('should process vectors in batches', async () => {
      const manyEmbeddings = Array.from({ length: 2500 }, (_, i) => ({
        ...sampleEmbeddings[0],
        id: `test_${i}`
      }))

      mockVectorizeIndex.upsert.mockResolvedValue(undefined)

      await client.upsertVectors(manyEmbeddings)

      // Should make 3 calls (1000 + 1000 + 500)
      expect(mockVectorizeIndex.upsert).toHaveBeenCalledTimes(3)
    })

    it('should report progress during ingestion', async () => {
      mockVectorizeIndex.upsert.mockResolvedValue(undefined)
      const progressUpdates: any[] = []

      await client.upsertVectors(sampleEmbeddings, (progress) => {
        progressUpdates.push({ ...progress })
      })

      expect(progressUpdates).toHaveLength(1)
      expect(progressUpdates[0]).toMatchObject({
        processed: 2,
        total: 2,
        currentBatch: 1,
        totalBatches: 1
      })
    })

    it('should retry failed upserts', async () => {
      mockVectorizeIndex.upsert
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined)

      await client.upsertVectors(sampleEmbeddings)

      expect(mockVectorizeIndex.upsert).toHaveBeenCalledTimes(2)
    })

    it('should handle batch failures gracefully', async () => {
      mockVectorizeIndex.upsert.mockRejectedValue(new Error('Persistent failure'))
      const progressUpdates: any[] = []

      await client.upsertVectors(sampleEmbeddings, (progress) => {
        progressUpdates.push(progress)
      })

      const finalProgress = progressUpdates[progressUpdates.length - 1]
      expect(finalProgress.errors).toHaveLength(2) // Both vectors should have errors
    })
  })

  describe('search', () => {
    it('should search vectors successfully', async () => {
      const mockResults = {
        matches: [
          {
            id: 'test_1',
            score: 0.95,
            metadata: {
              content: 'Test content 1',
              source: 'test-doc',
              chunk_index: 0
            }
          },
          {
            id: 'test_2',
            score: 0.85,
            metadata: {
              content: 'Test content 2',
              source: 'test-doc',
              chunk_index: 1
            }
          }
        ]
      }

      mockVectorizeIndex.query.mockResolvedValue(mockResults)

      const queryVector = new Array(1536).fill(0.1)
      const results = await client.search(queryVector, { topK: 2 })

      expect(results).toHaveLength(2)
      expect(results[0]).toMatchObject({
        content: 'Test content 1',
        score: 0.95,
        metadata: {
          source: 'test-doc',
          chunk_index: 0
        }
      })

      expect(mockVectorizeIndex.query).toHaveBeenCalledWith(queryVector, {
        topK: 2,
        filter: undefined,
        returnValues: false,
        returnMetadata: true
      })
    })

    it('should filter results by minimum score', async () => {
      const mockResults = {
        matches: [
          {
            id: 'test_1',
            score: 0.95,
            metadata: { content: 'High score content', source: 'test' }
          },
          {
            id: 'test_2',
            score: 0.3,
            metadata: { content: 'Low score content', source: 'test' }
          }
        ]
      }

      mockVectorizeIndex.query.mockResolvedValue(mockResults)

      const queryVector = new Array(1536).fill(0.1)
      const results = await client.search(queryVector, { minScore: 0.5 })

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(0.95)
    })

    it('should handle search errors', async () => {
      mockVectorizeIndex.query.mockRejectedValue(new Error('Search failed'))

      const queryVector = new Array(1536).fill(0.1)

      await expect(client.search(queryVector)).rejects.toThrow('Search failed')
    })
  })

  describe('deleteVectors', () => {
    it('should delete vectors by IDs', async () => {
      mockVectorizeIndex.deleteByIds.mockResolvedValue(undefined)

      await client.deleteVectors(['test_1', 'test_2'])

      expect(mockVectorizeIndex.deleteByIds).toHaveBeenCalledWith(['test_1', 'test_2'])
    })

    it('should handle delete errors', async () => {
      mockVectorizeIndex.deleteByIds.mockRejectedValue(new Error('Delete failed'))

      await expect(client.deleteVectors(['test_1'])).rejects.toThrow('Delete failed')
    })
  })

  describe('getStats', () => {
    it('should return index statistics', async () => {
      const mockStats = {
        vectorsCount: 1000,
        dimensions: 1536
      }

      mockVectorizeIndex.describe.mockResolvedValue(mockStats)

      const stats = await client.getStats()

      expect(stats).toMatchObject({
        totalVectors: 1000,
        dimensions: 1536,
        sources: {},
        lastUpdated: expect.any(Date)
      })
    })

    it('should handle stats errors', async () => {
      mockVectorizeIndex.describe.mockRejectedValue(new Error('Stats failed'))

      await expect(client.getStats()).rejects.toThrow('Stats retrieval failed')
    })
  })

  describe('validateVectors', () => {
    it('should validate correct vectors', () => {
      const result = client.validateVectors(sampleEmbeddings)

      expect(result.valid).toHaveLength(2)
      expect(result.invalid).toHaveLength(0)
    })

    it('should identify invalid vectors', () => {
      const invalidEmbeddings: EmbeddingVector[] = [
        {
          id: '',
          values: new Array(100).fill(0.1), // Wrong dimension
          metadata: {
            content: '',
            source: 'test',
            chunk_index: 0,
            token_count: 0
          }
        },
        {
          id: 'test_2',
          values: new Array(1536).fill(NaN), // Invalid values
          metadata: {
            content: 'Valid content',
            source: 'test',
            chunk_index: 1,
            token_count: 10
          }
        }
      ]

      const result = client.validateVectors(invalidEmbeddings)

      expect(result.valid).toHaveLength(0)
      expect(result.invalid).toHaveLength(2)
      expect(result.invalid[0].reason).toContain('Invalid or missing ID')
      expect(result.invalid[0].reason).toContain('Expected 1536 dimensions')
      expect(result.invalid[1].reason).toContain('All values must be valid numbers')
    })
  })

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      mockVectorizeIndex.describe.mockResolvedValue({ vectorsCount: 100 })
      mockVectorizeIndex.query.mockResolvedValue({ matches: [] })

      const result = await client.testConnection()

      expect(result.success).toBe(true)
      expect(result.stats).toBeDefined()
    })

    it('should handle connection failures', async () => {
      mockVectorizeIndex.describe.mockRejectedValue(new Error('Connection failed'))

      const result = await client.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Connection failed')
    })
  })
})

describe('Utility functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createVectorizeClient', () => {
    it('should create client and test connection', async () => {
      mockVectorizeIndex.describe.mockResolvedValue({ vectorsCount: 100 })
      mockVectorizeIndex.query.mockResolvedValue({ matches: [] })

      const client = await createVectorizeClient(mockVectorizeIndex as any)

      expect(client).toBeInstanceOf(VectorizeClient)
      expect(mockVectorizeIndex.describe).toHaveBeenCalled()
    })

    it('should throw on connection failure', async () => {
      mockVectorizeIndex.describe.mockRejectedValue(new Error('Connection failed'))

      await expect(createVectorizeClient(mockVectorizeIndex as any))
        .rejects.toThrow('Failed to connect to Vectorize index')
    })
  })

  describe('ingestEmbeddings', () => {
    it('should ingest embeddings successfully', async () => {
      mockVectorizeIndex.describe.mockResolvedValue({ vectorsCount: 100 })
      mockVectorizeIndex.query.mockResolvedValue({ matches: [] })
      mockVectorizeIndex.upsert.mockResolvedValue(undefined)

      const sampleEmbeddings: EmbeddingVector[] = [
        {
          id: 'test_1',
          values: new Array(1536).fill(0.1),
          metadata: {
            content: 'Test content',
            source: 'test',
            chunk_index: 0,
            token_count: 10
          }
        }
      ]

      const result = await ingestEmbeddings(mockVectorizeIndex as any, sampleEmbeddings)

      expect(result.success).toBe(true)
      expect(result.processed).toBe(1)
      expect(result.errors).toBe(0)
    })

    it('should validate embeddings before ingestion', async () => {
      mockVectorizeIndex.describe.mockResolvedValue({ vectorsCount: 100 })
      mockVectorizeIndex.query.mockResolvedValue({ matches: [] })
      mockVectorizeIndex.upsert.mockResolvedValue(undefined)

      const invalidEmbeddings: EmbeddingVector[] = [
        {
          id: '',
          values: new Array(100).fill(0.1),
          metadata: {
            content: '',
            source: '',
            chunk_index: 0,
            token_count: 0
          }
        }
      ]

      const result = await ingestEmbeddings(
        mockVectorizeIndex as any,
        invalidEmbeddings,
        { validateBeforeInsert: true }
      )

      expect(result.success).toBe(false)
      expect(result.processed).toBe(0)
      expect(result.errors).toBe(1)
    })

    it('should handle ingestion failures', async () => {
      mockVectorizeIndex.describe.mockResolvedValue({ vectorsCount: 100 })
      mockVectorizeIndex.query.mockResolvedValue({ matches: [] })
      mockVectorizeIndex.upsert.mockRejectedValue(new Error('Ingestion failed'))

      const sampleEmbeddings: EmbeddingVector[] = [
        {
          id: 'test_1',
          values: new Array(1536).fill(0.1),
          metadata: {
            content: 'Test content',
            source: 'test',
            chunk_index: 0,
            token_count: 10
          }
        }
      ]

      const result = await ingestEmbeddings(mockVectorizeIndex as any, sampleEmbeddings)

      expect(result.success).toBe(false)
      expect(result.processed).toBe(0)
      expect(result.errors).toBe(1)
    })
  })
})