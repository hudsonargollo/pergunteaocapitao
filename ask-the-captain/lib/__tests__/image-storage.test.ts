import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { 
  ImageStorageService, 
  ImageStorageError, 
  createImageStorageService, 
  handleImageStorageResult 
} from '../image-storage'
import { R2StorageError } from '../r2'
import { D1Error } from '../d1'
import type { 
  StoreImageRequest, 
  ImageStorageMetadata, 
  ImageUploadResult, 
  GeneratedImage,
  ToneAnalysis 
} from '@/types'

// Don't mock the error classes, just the client instances

describe('ImageStorageService', () => {
  let service: ImageStorageService
  let mockR2Client: any
  let mockD1Client: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock clients
    mockR2Client = {
      generateImageId: vi.fn(),
      uploadImage: vi.fn(),
      getImage: vi.fn(),
      getPublicUrl: vi.fn(),
      deleteImage: vi.fn(),
      getStorageStats: vi.fn(),
      healthCheck: vi.fn(),
      cleanupOldImages: vi.fn(),
    } as any

    mockD1Client = {
      createGeneratedImage: vi.fn(),
      getGeneratedImage: vi.fn(),
      deleteGeneratedImage: vi.fn(),
      getRecentGeneratedImages: vi.fn(),
      getStats: vi.fn(),
      healthCheck: vi.fn(),
    } as any

    service = new ImageStorageService(mockR2Client, mockD1Client)
  })

  describe('Store Image', () => {
    const mockImageBuffer = new ArrayBuffer(1024)
    const mockToneAnalysis: ToneAnalysis = {
      primary: 'supportive',
      intensity: 'medium',
      themes: ['motivation', 'discipline'],
      visualParameters: {
        pose: 'confident',
        expression: 'determined',
        environment: 'cave',
        lighting: 'dramatic'
      }
    }
    
    const mockRequest: StoreImageRequest = {
      imageBuffer: mockImageBuffer,
      promptParameters: { tone: 'supportive', theme: 'motivation' },
      responseContext: 'Test response about discipline',
      toneAnalysis: mockToneAnalysis
    }

    it('should store image successfully', async () => {
      const imageId = 'test-image-123'
      const r2ObjectKey = 'images/generated/2024/01/test-image-123.png'
      const publicUrl = 'https://test-domain.com/images/generated/2024/01/test-image-123.png'

      // Mock R2 operations
      mockR2Client.generateImageId.mockReturnValue(imageId)
      mockR2Client.uploadImage.mockResolvedValue({
        success: true,
        data: {
          imageId,
          r2ObjectKey,
          publicUrl,
          size: 1024,
          etag: 'test-etag',
          uploadedAt: '2024-01-01T00:00:00Z'
        }
      })

      // Mock D1 operations
      mockD1Client.createGeneratedImage.mockResolvedValue({
        success: true,
        data: undefined
      })

      const result = await service.storeImage(mockRequest)

      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        imageId,
        publicUrl,
        r2ObjectKey,
        metadata: {
          image_id: imageId,
          r2_object_key: r2ObjectKey,
          prompt_parameters: JSON.stringify(mockRequest.promptParameters),
          response_context: mockRequest.responseContext,
          tone_analysis: JSON.stringify(mockRequest.toneAnalysis)
        }
      })

      // Verify R2 upload was called with correct metadata
      expect(mockR2Client.uploadImage).toHaveBeenCalledWith(
        mockImageBuffer,
        expect.objectContaining({
          imageId,
          promptParameters: mockRequest.promptParameters,
          toneAnalysis: mockRequest.toneAnalysis,
          responseContext: mockRequest.responseContext
        })
      )

      // Verify D1 storage was called
      expect(mockD1Client.createGeneratedImage).toHaveBeenCalledWith({
        image_id: imageId,
        r2_object_key: r2ObjectKey,
        prompt_parameters: JSON.stringify(mockRequest.promptParameters),
        response_context: mockRequest.responseContext,
        tone_analysis: JSON.stringify(mockRequest.toneAnalysis)
      })
    })

    it('should handle R2 upload failure', async () => {
      const imageId = 'test-image-123'
      mockR2Client.generateImageId.mockReturnValue(imageId)
      const mockError = new R2StorageError('Upload failed', 'UPLOAD_ERROR', 'uploadImage')
      mockR2Client.uploadImage.mockResolvedValue({
        success: false,
        error: mockError
      })

      const result = await service.storeImage(mockRequest)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('R2_UPLOAD_ERROR')
      expect(mockD1Client.createGeneratedImage).not.toHaveBeenCalled()
    })

    it('should handle D1 storage failure with R2 rollback', async () => {
      const imageId = 'test-image-123'
      const r2ObjectKey = 'images/generated/2024/01/test-image-123.png'

      // Mock successful R2 upload
      mockR2Client.generateImageId.mockReturnValue(imageId)
      mockR2Client.uploadImage.mockResolvedValue({
        success: true,
        data: {
          imageId,
          r2ObjectKey,
          publicUrl: 'https://test.com/image.png',
          size: 1024,
          etag: 'test-etag',
          uploadedAt: '2024-01-01T00:00:00Z'
        }
      })

      // Mock D1 failure
      const mockD1Error = new D1Error('Database error', 'INSERT_ERROR', 'createGeneratedImage')
      mockD1Client.createGeneratedImage.mockResolvedValue({
        success: false,
        error: mockD1Error
      })

      // Mock R2 rollback
      mockR2Client.deleteImage.mockResolvedValue({
        success: true,
        data: true
      })

      const result = await service.storeImage(mockRequest)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('D1_INSERT_ERROR')
      
      // Verify rollback was attempted
      expect(mockR2Client.deleteImage).toHaveBeenCalledWith(r2ObjectKey)
    })

    it('should handle rollback failure gracefully', async () => {
      const imageId = 'test-image-123'
      const r2ObjectKey = 'images/generated/2024/01/test-image-123.png'

      // Mock successful R2 upload
      mockR2Client.generateImageId.mockReturnValue(imageId)
      mockR2Client.uploadImage.mockResolvedValue({
        success: true,
        data: {
          imageId,
          r2ObjectKey,
          publicUrl: 'https://test.com/image.png',
          size: 1024,
          etag: 'test-etag',
          uploadedAt: '2024-01-01T00:00:00Z'
        }
      })

      // Mock D1 failure
      const mockD1Error2 = new D1Error('Database error', 'INSERT_ERROR', 'createGeneratedImage')
      mockD1Client.createGeneratedImage.mockResolvedValue({
        success: false,
        error: mockD1Error2
      })

      // Mock R2 rollback failure
      mockR2Client.deleteImage.mockRejectedValue(new Error('Rollback failed'))

      const result = await service.storeImage(mockRequest)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('D1_INSERT_ERROR')
    })
  })

  describe('Get Image', () => {
    const imageId = 'test-image-123'
    const mockMetadata: GeneratedImage = {
      image_id: imageId,
      r2_object_key: 'images/generated/2024/01/test-image-123.png',
      prompt_parameters: '{"tone": "supportive"}',
      response_context: 'Test response',
      tone_analysis: '{"primary": "supportive"}',
      created_at: '2024-01-01T00:00:00Z'
    }

    it('should retrieve image with metadata successfully', async () => {
      const mockImageBuffer = new ArrayBuffer(1024)
      const publicUrl = 'https://test-domain.com/images/generated/2024/01/test-image-123.png'

      // Mock D1 metadata retrieval
      mockD1Client.getGeneratedImage.mockResolvedValue({
        success: true,
        data: mockMetadata
      })

      // Mock R2 image retrieval
      mockR2Client.getImage.mockResolvedValue({
        success: true,
        data: mockImageBuffer
      })

      // Mock public URL generation
      mockR2Client.getPublicUrl.mockReturnValue(publicUrl)

      const result = await service.getImage(imageId)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        imageBuffer: mockImageBuffer,
        metadata: mockMetadata,
        publicUrl
      })

      expect(mockD1Client.getGeneratedImage).toHaveBeenCalledWith(imageId)
      expect(mockR2Client.getImage).toHaveBeenCalledWith(mockMetadata.r2_object_key)
      expect(mockR2Client.getPublicUrl).toHaveBeenCalledWith(mockMetadata.r2_object_key)
    })

    it('should return null for non-existent image', async () => {
      mockD1Client.getGeneratedImage.mockResolvedValue({
        success: true,
        data: null
      })

      const result = await service.getImage('non-existent-id')

      expect(result.success).toBe(true)
      expect(result.data).toBe(null)
      expect(mockR2Client.getImage).not.toHaveBeenCalled()
    })

    it('should validate image ID parameter', async () => {
      const result = await service.getImage('')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should handle D1 query failure', async () => {
      const mockD1QueryError = new D1Error('Query failed', 'QUERY_ERROR', 'getGeneratedImage')
      mockD1Client.getGeneratedImage.mockResolvedValue({
        success: false,
        error: mockD1QueryError
      })

      const result = await service.getImage(imageId)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('D1_QUERY_ERROR')
    })

    it('should handle R2 retrieval failure', async () => {
      mockD1Client.getGeneratedImage.mockResolvedValue({
        success: true,
        data: mockMetadata
      })

      const mockR2RetrievalError = new R2StorageError('Retrieval failed', 'RETRIEVAL_ERROR', 'getImage')
      mockR2Client.getImage.mockResolvedValue({
        success: false,
        error: mockR2RetrievalError
      })

      const result = await service.getImage(imageId)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('R2_RETRIEVAL_ERROR')
    })
  })

  describe('Get Image Metadata', () => {
    const imageId = 'test-image-123'
    const mockMetadata: GeneratedImage = {
      image_id: imageId,
      r2_object_key: 'images/generated/2024/01/test-image-123.png',
      prompt_parameters: '{"tone": "supportive"}',
      response_context: 'Test response',
      tone_analysis: '{"primary": "supportive"}',
      created_at: '2024-01-01T00:00:00Z'
    }

    it('should retrieve image metadata successfully', async () => {
      mockD1Client.getGeneratedImage.mockResolvedValue({
        success: true,
        data: mockMetadata
      })

      const result = await service.getImageMetadata(imageId)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockMetadata)
    })

    it('should return null for non-existent image', async () => {
      mockD1Client.getGeneratedImage.mockResolvedValue({
        success: true,
        data: null
      })

      const result = await service.getImageMetadata('non-existent-id')

      expect(result.success).toBe(true)
      expect(result.data).toBe(null)
    })

    it('should validate image ID parameter', async () => {
      const result = await service.getImageMetadata('')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Get Image URL', () => {
    const imageId = 'test-image-123'
    const mockMetadata: GeneratedImage = {
      image_id: imageId,
      r2_object_key: 'images/generated/2024/01/test-image-123.png',
      prompt_parameters: '{"tone": "supportive"}',
      response_context: 'Test response',
      tone_analysis: '{"primary": "supportive"}',
      created_at: '2024-01-01T00:00:00Z'
    }

    it('should get image URL successfully', async () => {
      const publicUrl = 'https://test-domain.com/images/generated/2024/01/test-image-123.png'

      mockD1Client.getGeneratedImage.mockResolvedValue({
        success: true,
        data: mockMetadata
      })

      mockR2Client.getPublicUrl.mockReturnValue(publicUrl)

      const result = await service.getImageUrl(imageId)

      expect(result.success).toBe(true)
      expect(result.data).toBe(publicUrl)
    })

    it('should return null for non-existent image', async () => {
      mockD1Client.getGeneratedImage.mockResolvedValue({
        success: true,
        data: null
      })

      const result = await service.getImageUrl('non-existent-id')

      expect(result.success).toBe(true)
      expect(result.data).toBe(null)
    })
  })

  describe('Delete Image', () => {
    const imageId = 'test-image-123'
    const mockMetadata: GeneratedImage = {
      image_id: imageId,
      r2_object_key: 'images/generated/2024/01/test-image-123.png',
      prompt_parameters: '{"tone": "supportive"}',
      response_context: 'Test response',
      tone_analysis: '{"primary": "supportive"}',
      created_at: '2024-01-01T00:00:00Z'
    }

    it('should delete image successfully', async () => {
      mockD1Client.getGeneratedImage.mockResolvedValue({
        success: true,
        data: mockMetadata
      })

      mockR2Client.deleteImage.mockResolvedValue({
        success: true,
        data: true
      })

      mockD1Client.deleteGeneratedImage.mockResolvedValue({
        success: true,
        data: true
      })

      const result = await service.deleteImage(imageId)

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)

      expect(mockR2Client.deleteImage).toHaveBeenCalledWith(mockMetadata.r2_object_key)
      expect(mockD1Client.deleteGeneratedImage).toHaveBeenCalledWith(imageId)
    })

    it('should return false for non-existent image', async () => {
      mockD1Client.getGeneratedImage.mockResolvedValue({
        success: true,
        data: null
      })

      const result = await service.deleteImage('non-existent-id')

      expect(result.success).toBe(true)
      expect(result.data).toBe(false)
    })

    it('should handle R2 deletion failure gracefully', async () => {
      mockD1Client.getGeneratedImage.mockResolvedValue({
        success: true,
        data: mockMetadata
      })

      mockR2Client.deleteImage.mockRejectedValue(new Error('R2 delete failed'))

      mockD1Client.deleteGeneratedImage.mockResolvedValue({
        success: true,
        data: true
      })

      const result = await service.deleteImage(imageId)

      expect(result.success).toBe(true)
      expect(result.data).toBe(true) // D1 deletion succeeded
    })
  })

  describe('List Recent Images', () => {
    it('should list recent images successfully', async () => {
      const mockImages: GeneratedImage[] = [
        {
          image_id: 'image-1',
          r2_object_key: 'images/generated/2024/01/image-1.png',
          prompt_parameters: '{"tone": "supportive"}',
          response_context: 'Test response 1',
          tone_analysis: '{"primary": "supportive"}',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          image_id: 'image-2',
          r2_object_key: 'images/generated/2024/01/image-2.png',
          prompt_parameters: '{"tone": "challenging"}',
          response_context: 'Test response 2',
          tone_analysis: '{"primary": "challenging"}',
          created_at: '2024-01-01T01:00:00Z'
        }
      ]

      mockD1Client.getRecentGeneratedImages.mockResolvedValue({
        success: true,
        data: mockImages
      })

      const result = await service.listRecentImages(10)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockImages)
      expect(mockD1Client.getRecentGeneratedImages).toHaveBeenCalledWith(10)
    })

    it('should validate limit parameter', async () => {
      const result = await service.listRecentImages(0)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Storage Statistics', () => {
    it('should get comprehensive storage statistics', async () => {
      const mockD1Stats = {
        totalImages: 100,
        totalConversations: 50,
        recentActivity: {
          imagesLast24h: 10,
          conversationsLast24h: 5
        }
      }

      const mockR2Stats = {
        totalImages: 100,
        totalSize: 1024000,
        generatedImages: 95,
        fallbackImages: 5
      }

      mockD1Client.getStats.mockResolvedValue({
        success: true,
        data: mockD1Stats
      })

      mockR2Client.getStorageStats.mockResolvedValue({
        success: true,
        data: mockR2Stats
      })

      const result = await service.getStorageStats()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        database: mockD1Stats,
        storage: mockR2Stats
      })
    })
  })

  describe('Health Check', () => {
    it('should perform comprehensive health check', async () => {
      const mockD1Health = {
        status: 'healthy' as const,
        timestamp: '2024-01-01T00:00:00Z',
        latency: 50
      }

      const mockR2Health = {
        status: 'healthy' as const,
        timestamp: '2024-01-01T00:00:00Z',
        latency: 100,
        canRead: true,
        canWrite: true
      }

      mockD1Client.healthCheck.mockResolvedValue({
        success: true,
        data: mockD1Health
      })

      mockR2Client.healthCheck.mockResolvedValue({
        success: true,
        data: mockR2Health
      })

      const result = await service.healthCheck()

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('healthy')
      expect(result.data?.components.database.status).toBe('healthy')
      expect(result.data?.components.storage.status).toBe('healthy')
    })

    it('should report degraded status when one component fails', async () => {
      mockD1Client.healthCheck.mockResolvedValue({
        success: true,
        data: {
          status: 'healthy' as const,
          timestamp: '2024-01-01T00:00:00Z',
          latency: 50
        }
      })

      mockR2Client.healthCheck.mockResolvedValue({
        success: false,
        error: new R2StorageError('Health check failed', 'HEALTH_ERROR', 'healthCheck')
      })

      const result = await service.healthCheck()

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('degraded')
    })

    it('should report unhealthy status when both components fail', async () => {
      mockD1Client.healthCheck.mockResolvedValue({
        success: false,
        error: new D1Error('Health check failed', 'HEALTH_ERROR', 'healthCheck')
      })

      mockR2Client.healthCheck.mockResolvedValue({
        success: false,
        error: new R2StorageError('Health check failed', 'HEALTH_ERROR', 'healthCheck')
      })

      const result = await service.healthCheck()

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('unhealthy')
    })
  })

  describe('Error Handling', () => {
    it('should create ImageStorageError with proper properties', () => {
      const originalError = new Error('Original error')
      const storageError = new ImageStorageError('Test error', 'TEST_CODE', 'test_operation', originalError)
      
      expect(storageError.message).toBe('Test error')
      expect(storageError.code).toBe('TEST_CODE')
      expect(storageError.operation).toBe('test_operation')
      expect(storageError.originalError).toBe(originalError)
      expect(storageError.name).toBe('ImageStorageError')
    })
  })
})

describe('Factory Functions', () => {
  describe('createImageStorageService', () => {
    it('should create ImageStorageService instance', () => {
      const mockR2Client = {} as R2Client
      const mockD1Client = {} as D1Client
      const service = createImageStorageService(mockR2Client, mockD1Client)
      expect(service).toBeInstanceOf(ImageStorageService)
    })
  })

  describe('handleImageStorageResult', () => {
    it('should return data for successful result', () => {
      const result = { success: true, data: 'test data' }
      const data = handleImageStorageResult(result, 'test_operation')
      expect(data).toBe('test data')
    })

    it('should throw error for failed result', () => {
      const error = new ImageStorageError('Test error', 'TEST_CODE', 'test_operation')
      const result = { success: false, error }
      
      expect(() => handleImageStorageResult(result, 'test_operation')).toThrow(error)
    })

    it('should throw generic error when no specific error provided', () => {
      const result = { success: false }
      
      expect(() => handleImageStorageResult(result, 'test_operation')).toThrow(ImageStorageError)
    })
  })
})