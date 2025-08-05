import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { D1Client, D1Error, createD1Client, handleQueryResult } from '../d1'
import type { GeneratedImage, Conversation } from '@/types'

// Mock D1Database
const mockD1Database = {
  prepare: vi.fn(),
  batch: vi.fn(),
  dump: vi.fn(),
  exec: vi.fn(),
}

// Mock D1PreparedStatement
const createMockStatement = () => ({
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
  raw: vi.fn(),
})

describe('D1Client', () => {
  let client: D1Client
  let mockStatement: ReturnType<typeof createMockStatement>

  beforeEach(() => {
    vi.clearAllMocks()
    mockStatement = createMockStatement()
    // Default health check response
    mockStatement.first.mockResolvedValue({ test: 1 })
    mockD1Database.prepare.mockReturnValue(mockStatement)
    client = new D1Client(mockD1Database as any)
    // Disable health checks for testing
    client.disableHealthChecks()
  })

  describe('Connection Management', () => {
    it('should validate connection on initialization', async () => {
      mockStatement.first.mockResolvedValue({ test: 1 })
      
      // Create new client to trigger validation
      const newClient = new D1Client(mockD1Database as any)
      
      // Wait a bit for async validation
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(mockD1Database.prepare).toHaveBeenCalledWith('SELECT 1')
    })

    it('should handle connection validation failure', async () => {
      mockStatement.first.mockRejectedValue(new Error('Connection failed'))
      
      // Create new client
      const newClient = new D1Client(mockD1Database as any)
      
      // Try to perform an operation
      const result = await newClient.getGeneratedImage('test-id')
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('CONNECTION_ERROR')
    })
  })

  describe('Generated Images Operations', () => {
    const mockImage: Omit<GeneratedImage, 'created_at'> = {
      image_id: 'test-image-id',
      r2_object_key: 'images/test.png',
      prompt_parameters: '{"tone": "supportive"}',
      response_context: 'Test response',
      tone_analysis: '{"primary": "supportive"}'
    }

    describe('createGeneratedImage', () => {
      it('should create a generated image successfully', async () => {
        mockStatement.run.mockResolvedValue({ success: true, changes: 1 })
        mockStatement.first.mockResolvedValue({ test: 1 }) // For health check
        
        const result = await client.createGeneratedImage(mockImage)
        
        expect(result.success).toBe(true)
        expect(mockD1Database.prepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO GeneratedImages')
        )
        expect(mockStatement.bind).toHaveBeenCalledWith(
          mockImage.image_id,
          mockImage.r2_object_key,
          mockImage.prompt_parameters,
          mockImage.response_context,
          mockImage.tone_analysis
        )
      })

      it('should handle database insert failure', async () => {
        mockStatement.run.mockResolvedValue({ success: false, changes: 0 })
        mockStatement.first.mockResolvedValue({ test: 1 }) // For health check
        
        const result = await client.createGeneratedImage(mockImage)
        
        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('INSERT_ERROR')
      })

      it('should handle database connection error', async () => {
        mockStatement.run.mockRejectedValue(new Error('Database error'))
        mockStatement.first.mockResolvedValue({ test: 1 }) // For health check
        
        const result = await client.createGeneratedImage(mockImage)
        
        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('QUERY_ERROR')
      })
    })

    describe('getGeneratedImage', () => {
      it('should retrieve a generated image successfully', async () => {
        const mockResult: GeneratedImage = {
          ...mockImage,
          created_at: '2024-01-01T00:00:00Z'
        }
        
        mockStatement.first.mockResolvedValue(mockResult)
        
        const result = await client.getGeneratedImage('test-image-id')
        
        expect(result.success).toBe(true)
        expect(result.data).toEqual(mockResult)
        expect(mockStatement.bind).toHaveBeenCalledWith('test-image-id')
      })

      it('should return null for non-existent image', async () => {
        mockStatement.first.mockResolvedValue(null)
        
        const result = await client.getGeneratedImage('non-existent-id')
        
        expect(result.success).toBe(true)
        expect(result.data).toBe(null)
      })

      it('should validate image ID parameter', async () => {
        const result = await client.getGeneratedImage('')
        
        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('VALIDATION_ERROR')
      })
    })

    describe('getRecentGeneratedImages', () => {
      it('should retrieve recent images with default limit', async () => {
        const mockResults = [mockImage]
        mockStatement.first.mockResolvedValue({ test: 1 }) // Health check
        mockStatement.all.mockResolvedValue({ results: mockResults })
        
        const result = await client.getRecentGeneratedImages()
        
        expect(result.success).toBe(true)
        expect(result.data).toEqual(mockResults)
        expect(mockStatement.bind).toHaveBeenCalledWith(10)
      })

      it('should validate limit parameter', async () => {
        const result = await client.getRecentGeneratedImages(0)
        
        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('VALIDATION_ERROR')
      })

      it('should validate maximum limit', async () => {
        const result = await client.getRecentGeneratedImages(101)
        
        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('VALIDATION_ERROR')
      })
    })

    describe('deleteGeneratedImage', () => {
      it('should delete image successfully', async () => {
        mockStatement.first.mockResolvedValue({ test: 1 }) // Health check
        mockStatement.run.mockResolvedValue({ success: true, changes: 1 })
        
        const result = await client.deleteGeneratedImage('test-image-id')
        
        expect(result.success).toBe(true)
        expect(result.data).toBe(true)
      })

      it('should return false for non-existent image', async () => {
        mockStatement.first.mockResolvedValue({ test: 1 }) // Health check
        mockStatement.run.mockResolvedValue({ success: true, changes: 0 })
        
        const result = await client.deleteGeneratedImage('non-existent-id')
        
        expect(result.success).toBe(true)
        expect(result.data).toBe(false)
      })

      it('should validate image ID parameter', async () => {
        const result = await client.deleteGeneratedImage('')
        
        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('VALIDATION_ERROR')
      })
    })
  })

  describe('Conversation Operations', () => {
    const mockConversation: Omit<Conversation, 'created_at'> = {
      id: 'test-conversation-id',
      user_id: 'test-user-id',
      message: 'Test message',
      response: 'Test response',
      image_id: 'test-image-id',
      embedding_query: 'test query',
      search_results: '{"results": []}'
    }

    describe('createConversation', () => {
      it('should create a conversation successfully', async () => {
        mockStatement.first.mockResolvedValue({ test: 1 }) // Health check
        mockStatement.run.mockResolvedValue({ success: true, changes: 1 })
        
        const result = await client.createConversation(mockConversation)
        
        expect(result.success).toBe(true)
        expect(mockD1Database.prepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO Conversations')
        )
      })

      it('should handle nullable user_id', async () => {
        const conversationWithoutUser = { ...mockConversation, user_id: undefined }
        mockStatement.first.mockResolvedValue({ test: 1 }) // Health check
        mockStatement.run.mockResolvedValue({ success: true, changes: 1 })
        
        const result = await client.createConversation(conversationWithoutUser)
        
        expect(result.success).toBe(true)
        expect(mockStatement.bind).toHaveBeenCalledWith(
          conversationWithoutUser.id,
          null, // user_id should be null
          conversationWithoutUser.message,
          conversationWithoutUser.response,
          conversationWithoutUser.image_id,
          conversationWithoutUser.embedding_query,
          conversationWithoutUser.search_results
        )
      })
    })

    describe('getConversation', () => {
      it('should retrieve a conversation successfully', async () => {
        const mockResult: Conversation = {
          ...mockConversation,
          created_at: '2024-01-01T00:00:00Z'
        }
        
        mockStatement.first.mockResolvedValue(mockResult)
        
        const result = await client.getConversation('test-conversation-id')
        
        expect(result.success).toBe(true)
        expect(result.data).toEqual(mockResult)
      })

      it('should validate conversation ID parameter', async () => {
        const result = await client.getConversation('')
        
        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('VALIDATION_ERROR')
      })
    })

    describe('getRecentConversations', () => {
      it('should retrieve recent conversations', async () => {
        const mockResults = [mockConversation]
        mockStatement.first.mockResolvedValue({ test: 1 }) // Health check
        mockStatement.all.mockResolvedValue({ results: mockResults })
        
        const result = await client.getRecentConversations()
        
        expect(result.success).toBe(true)
        expect(result.data).toEqual(mockResults)
      })

      it('should filter by user ID when provided', async () => {
        const mockResults = [mockConversation]
        mockStatement.first.mockResolvedValue({ test: 1 }) // Health check
        mockStatement.all.mockResolvedValue({ results: mockResults })
        
        const result = await client.getRecentConversations(10, 'test-user-id')
        
        expect(result.success).toBe(true)
        expect(mockD1Database.prepare).toHaveBeenCalledWith(
          expect.stringContaining('WHERE user_id = ?')
        )
        expect(mockStatement.bind).toHaveBeenCalledWith('test-user-id', 10)
      })
    })
  })

  describe('Utility Operations', () => {
    describe('getStats', () => {
      it('should retrieve database statistics', async () => {
        // Mock the 4 separate queries for stats
        const totalImagesStatement = createMockStatement()
        const totalConversationsStatement = createMockStatement()
        const recentImagesStatement = createMockStatement()
        const recentConversationsStatement = createMockStatement()
        
        totalImagesStatement.first.mockResolvedValue({ count: 5 })
        totalConversationsStatement.first.mockResolvedValue({ count: 10 })
        recentImagesStatement.first.mockResolvedValue({ count: 2 })
        recentConversationsStatement.first.mockResolvedValue({ count: 3 })
        
        mockD1Database.prepare
          .mockReturnValueOnce(totalImagesStatement) // Total images
          .mockReturnValueOnce(totalConversationsStatement) // Total conversations
          .mockReturnValueOnce(recentImagesStatement) // Recent images
          .mockReturnValueOnce(recentConversationsStatement) // Recent conversations
        
        const result = await client.getStats()
        
        expect(result.success).toBe(true)
        expect(result.data).toEqual({
          totalImages: 5,
          totalConversations: 10,
          recentActivity: {
            imagesLast24h: 2,
            conversationsLast24h: 3
          }
        })
      })
    })

    describe('healthCheck', () => {
      it('should perform health check successfully', async () => {
        mockStatement.first.mockResolvedValue({ test: 1 })
        
        const result = await client.healthCheck()
        
        expect(result.success).toBe(true)
        expect(result.data?.status).toBe('healthy')
        expect(result.data?.timestamp).toBeDefined()
        expect(result.data?.latency).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Error Handling', () => {
    it('should create D1Error with proper properties', () => {
      const originalError = new Error('Original error')
      const d1Error = new D1Error('Test error', 'TEST_CODE', 'test_operation', originalError)
      
      expect(d1Error.message).toBe('Test error')
      expect(d1Error.code).toBe('TEST_CODE')
      expect(d1Error.operation).toBe('test_operation')
      expect(d1Error.originalError).toBe(originalError)
      expect(d1Error.name).toBe('D1Error')
    })
  })
})

describe('Factory Functions', () => {
  describe('createD1Client', () => {
    it('should create D1Client instance', () => {
      const client = createD1Client(mockD1Database as any)
      expect(client).toBeInstanceOf(D1Client)
    })
  })

  describe('handleQueryResult', () => {
    it('should return data for successful result', () => {
      const result = { success: true, data: 'test data' }
      const data = handleQueryResult(result, 'test_operation')
      expect(data).toBe('test data')
    })

    it('should throw error for failed result', () => {
      const error = new D1Error('Test error', 'TEST_CODE', 'test_operation')
      const result = { success: false, error }
      
      expect(() => handleQueryResult(result, 'test_operation')).toThrow(error)
    })

    it('should throw generic error when no specific error provided', () => {
      const result = { success: false }
      
      expect(() => handleQueryResult(result, 'test_operation')).toThrow(D1Error)
    })
  })
})