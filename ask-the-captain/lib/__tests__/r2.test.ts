import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { R2Client, R2StorageError, createR2Client, handleR2Result } from '../r2'
import type { ImageStorageMetadata } from '@/types'

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234')
}))

// Mock R2Bucket
const mockR2Bucket = {
  put: vi.fn(),
  get: vi.fn(),
  head: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
}

describe('R2Client', () => {
  let client: R2Client
  const bucketName = 'test-bucket'
  const publicDomain = 'test-domain.com'

  beforeEach(() => {
    vi.clearAllMocks()
    client = new R2Client(mockR2Bucket as any, bucketName, publicDomain)
  })

  describe('ID and Key Generation', () => {
    it('should generate unique image ID', () => {
      const id1 = client.generateImageId()
      const id2 = client.generateImageId()
      
      expect(id1).toBe('test-uuid-1234')
      expect(id2).toBe('test-uuid-1234') // Mocked to return same value
    })

    it('should generate organized image key', () => {
      const imageId = 'test-image-123'
      const key = client.generateImageKey(imageId)
      
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      
      expect(key).toBe(`images/generated/${year}/${month}/${imageId}.png`)
    })

    it('should generate image key with custom extension', () => {
      const imageId = 'test-image-123'
      const key = client.generateImageKey(imageId, 'jpg')
      
      expect(key).toContain('.jpg')
    })

    it('should validate image ID for key generation', () => {
      expect(() => client.generateImageKey('')).toThrow(R2StorageError)
      expect(() => client.generateImageKey('   ')).toThrow(R2StorageError)
    })

    it('should generate fallback keys', () => {
      expect(client.generateFallbackKey('default')).toBe('images/fallbacks/default-captain.png')
      expect(client.generateFallbackKey('loading')).toBe('images/fallbacks/loading-captain.png')
      expect(client.generateFallbackKey('error')).toBe('images/fallbacks/error-captain.png')
    })
  })

  describe('Public URL Generation', () => {
    it('should generate public URL with custom domain', () => {
      const key = 'images/test.png'
      const url = client.getPublicUrl(key)
      
      expect(url).toBe(`https://${publicDomain}/${key}`)
    })

    it('should generate public URL with default R2 domain', () => {
      const clientWithoutDomain = new R2Client(mockR2Bucket as any, bucketName)
      const key = 'images/test.png'
      const url = clientWithoutDomain.getPublicUrl(key)
      
      expect(url).toBe(`https://${bucketName}.r2.dev/${key}`)
    })

    it('should validate key for public URL generation', () => {
      expect(() => client.getPublicUrl('')).toThrow(R2StorageError)
      expect(() => client.getPublicUrl('   ')).toThrow(R2StorageError)
    })
  })

  describe('Image Upload', () => {
    const mockImageBuffer = new ArrayBuffer(1024)
    const mockMetadata: ImageStorageMetadata = {
      imageId: 'test-image-123',
      promptParameters: { tone: 'supportive' },
      toneAnalysis: { primary: 'supportive' },
      responseContext: 'Test response'
    }

    it('should upload image successfully', async () => {
      const mockPutResult = { etag: 'test-etag' }
      mockR2Bucket.put.mockResolvedValue(mockPutResult)
      
      const result = await client.uploadImage(mockImageBuffer, mockMetadata)
      
      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        imageId: mockMetadata.imageId,
        size: 1024,
        etag: 'test-etag'
      })
      expect(result.data?.publicUrl).toContain(mockMetadata.imageId)
      
      expect(mockR2Bucket.put).toHaveBeenCalledWith(
        expect.stringContaining(mockMetadata.imageId),
        mockImageBuffer,
        expect.objectContaining({
          httpMetadata: {
            contentType: 'image/png',
            cacheControl: 'public, max-age=31536000'
          },
          customMetadata: expect.objectContaining({
            imageId: mockMetadata.imageId,
            promptParameters: JSON.stringify(mockMetadata.promptParameters),
            toneAnalysis: JSON.stringify(mockMetadata.toneAnalysis),
            responseContext: mockMetadata.responseContext
          })
        })
      )
    })

    it('should validate image buffer', async () => {
      const result = await client.uploadImage(new ArrayBuffer(0), mockMetadata)
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should validate metadata', async () => {
      const invalidMetadata = { ...mockMetadata, imageId: '' }
      const result = await client.uploadImage(mockImageBuffer, invalidMetadata)
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should handle upload failure', async () => {
      mockR2Bucket.put.mockResolvedValue(null)
      
      const result = await client.uploadImage(mockImageBuffer, mockMetadata)
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('UPLOAD_ERROR')
    })

    it('should handle R2 errors', async () => {
      mockR2Bucket.put.mockRejectedValue(new Error('R2 error'))
      
      const result = await client.uploadImage(mockImageBuffer, mockMetadata)
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('OPERATION_ERROR')
    })
  })

  describe('Image Retrieval', () => {
    it('should retrieve image successfully', async () => {
      const mockImageBuffer = new ArrayBuffer(1024)
      const mockObject = {
        arrayBuffer: vi.fn().mockResolvedValue(mockImageBuffer)
      }
      mockR2Bucket.get.mockResolvedValue(mockObject)
      
      const result = await client.getImage('test-key')
      
      expect(result.success).toBe(true)
      expect(result.data).toBe(mockImageBuffer)
      expect(mockR2Bucket.get).toHaveBeenCalledWith('test-key')
    })

    it('should return null for non-existent image', async () => {
      mockR2Bucket.get.mockResolvedValue(null)
      
      const result = await client.getImage('non-existent-key')
      
      expect(result.success).toBe(true)
      expect(result.data).toBe(null)
    })

    it('should validate key parameter', async () => {
      const result = await client.getImage('')
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should handle R2 errors', async () => {
      mockR2Bucket.get.mockRejectedValue(new Error('R2 error'))
      
      const result = await client.getImage('test-key')
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('OPERATION_ERROR')
    })
  })

  describe('Image Existence Check', () => {
    it('should check if image exists', async () => {
      const mockObject = { key: 'test-key' }
      mockR2Bucket.head.mockResolvedValue(mockObject)
      
      const result = await client.imageExists('test-key')
      
      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
    })

    it('should return false for non-existent image', async () => {
      mockR2Bucket.head.mockResolvedValue(null)
      
      const result = await client.imageExists('non-existent-key')
      
      expect(result.success).toBe(true)
      expect(result.data).toBe(false)
    })

    it('should validate key parameter', async () => {
      const result = await client.imageExists('')
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Image Deletion', () => {
    it('should delete image successfully', async () => {
      mockR2Bucket.delete.mockResolvedValue(undefined)
      mockR2Bucket.head.mockResolvedValue(null) // Verify deletion
      
      const result = await client.deleteImage('test-key')
      
      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
      expect(mockR2Bucket.delete).toHaveBeenCalledWith('test-key')
    })

    it('should validate key parameter', async () => {
      const result = await client.deleteImage('')
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should handle deletion errors', async () => {
      mockR2Bucket.delete.mockRejectedValue(new Error('Delete error'))
      
      const result = await client.deleteImage('test-key')
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('OPERATION_ERROR')
    })
  })

  describe('Image Listing', () => {
    it('should list images with default options', async () => {
      const mockListing = {
        objects: [
          { key: 'image1.png' },
          { key: 'image2.png' }
        ],
        truncated: false
      }
      mockR2Bucket.list.mockResolvedValue(mockListing)
      
      const result = await client.listImages()
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        keys: ['image1.png', 'image2.png'],
        truncated: false,
        cursor: undefined
      })
    })

    it('should list images with custom options', async () => {
      const mockListing = {
        objects: [{ key: 'images/generated/image1.png' }],
        truncated: true,
        cursor: 'next-cursor'
      }
      mockR2Bucket.list.mockResolvedValue(mockListing)
      
      const result = await client.listImages({
        prefix: 'images/generated/',
        limit: 50,
        cursor: 'start-cursor'
      })
      
      expect(result.success).toBe(true)
      expect(result.data?.truncated).toBe(true)
      expect(result.data?.cursor).toBe('next-cursor')
      
      expect(mockR2Bucket.list).toHaveBeenCalledWith({
        prefix: 'images/generated/',
        limit: 50,
        cursor: 'start-cursor'
      })
    })

    it('should validate limit parameter', async () => {
      const result = await client.listImages({ limit: 0 })
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should validate maximum limit', async () => {
      const result = await client.listImages({ limit: 1001 })
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Metadata Retrieval', () => {
    it('should retrieve image metadata', async () => {
      const mockObject = {
        customMetadata: {
          imageId: 'test-image-123',
          promptParameters: '{"tone": "supportive"}',
          toneAnalysis: '{"primary": "supportive"}',
          responseContext: 'Test response',
          uploadedAt: '2024-01-01T00:00:00Z',
          size: '1024'
        },
        size: 1024
      }
      mockR2Bucket.head.mockResolvedValue(mockObject)
      
      const result = await client.getImageMetadata('test-key')
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        imageId: 'test-image-123',
        promptParameters: { tone: 'supportive' },
        toneAnalysis: { primary: 'supportive' },
        responseContext: 'Test response',
        uploadedAt: '2024-01-01T00:00:00Z',
        size: 1024
      })
    })

    it('should return null for non-existent image', async () => {
      mockR2Bucket.head.mockResolvedValue(null)
      
      const result = await client.getImageMetadata('non-existent-key')
      
      expect(result.success).toBe(true)
      expect(result.data).toBe(null)
    })

    it('should handle missing custom metadata', async () => {
      const mockObject = { size: 1024 }
      mockR2Bucket.head.mockResolvedValue(mockObject)
      
      const result = await client.getImageMetadata('test-key')
      
      expect(result.success).toBe(true)
      expect(result.data?.imageId).toBe('')
      expect(result.data?.size).toBe(1024)
    })
  })

  describe('Storage Statistics', () => {
    it('should get storage statistics', async () => {
      const mockAllImages = {
        objects: [
          { key: 'images/generated/img1.png', size: 1024 },
          { key: 'images/fallbacks/default.png', size: 512 }
        ]
      }
      const mockGeneratedImages = {
        objects: [{ key: 'images/generated/img1.png', size: 1024 }]
      }
      const mockFallbackImages = {
        objects: [{ key: 'images/fallbacks/default.png', size: 512 }]
      }
      
      mockR2Bucket.list
        .mockResolvedValueOnce(mockAllImages)
        .mockResolvedValueOnce(mockGeneratedImages)
        .mockResolvedValueOnce(mockFallbackImages)
      
      const result = await client.getStorageStats()
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        totalImages: 2,
        totalSize: 1536,
        generatedImages: 1,
        fallbackImages: 1
      })
    })
  })

  describe('Cleanup Operations', () => {
    it('should cleanup old images', async () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
      const mockListing = {
        objects: [
          { key: 'images/generated/old1.png', uploaded: oldDate },
          { key: 'images/generated/new1.png', uploaded: new Date() }
        ]
      }
      mockR2Bucket.list.mockResolvedValue(mockListing)
      mockR2Bucket.delete.mockResolvedValue(undefined)
      
      const result = await client.cleanupOldImages(30)
      
      expect(result.success).toBe(true)
      expect(result.data?.deletedCount).toBe(1)
      expect(result.data?.deletedKeys).toContain('images/generated/old1.png')
      expect(mockR2Bucket.delete).toHaveBeenCalledWith('images/generated/old1.png')
    })

    it('should validate days parameter', async () => {
      const result = await client.cleanupOldImages(0)
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Health Check', () => {
    it('should perform successful health check', async () => {
      const mockListing = { objects: [] }
      mockR2Bucket.list.mockResolvedValue(mockListing)
      mockR2Bucket.put.mockResolvedValue({ etag: 'test' })
      mockR2Bucket.delete.mockResolvedValue(undefined)
      
      const result = await client.healthCheck()
      
      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('healthy')
      expect(result.data?.canRead).toBe(true)
      expect(result.data?.canWrite).toBe(true)
      expect(result.data?.latency).toBeGreaterThanOrEqual(0)
    })

    it('should handle health check failures', async () => {
      mockR2Bucket.list.mockRejectedValue(new Error('Health check failed'))
      
      const result = await client.healthCheck()
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('OPERATION_ERROR')
    })
  })

  describe('Error Handling', () => {
    it('should create R2StorageError with proper properties', () => {
      const originalError = new Error('Original error')
      const r2Error = new R2StorageError('Test error', 'TEST_CODE', 'test_operation', originalError)
      
      expect(r2Error.message).toBe('Test error')
      expect(r2Error.code).toBe('TEST_CODE')
      expect(r2Error.operation).toBe('test_operation')
      expect(r2Error.originalError).toBe(originalError)
      expect(r2Error.name).toBe('R2StorageError')
    })
  })
})

describe('Factory Functions', () => {
  describe('createR2Client', () => {
    it('should create R2Client instance', () => {
      const client = createR2Client(mockR2Bucket as any, 'test-bucket', 'test-domain.com')
      expect(client).toBeInstanceOf(R2Client)
    })
  })

  describe('handleR2Result', () => {
    it('should return data for successful result', () => {
      const result = { success: true, data: 'test data' }
      const data = handleR2Result(result, 'test_operation')
      expect(data).toBe('test data')
    })

    it('should throw error for failed result', () => {
      const error = new R2StorageError('Test error', 'TEST_CODE', 'test_operation')
      const result = { success: false, error }
      
      expect(() => handleR2Result(result, 'test_operation')).toThrow(error)
    })

    it('should throw generic error when no specific error provided', () => {
      const result = { success: false }
      
      expect(() => handleR2Result(result, 'test_operation')).toThrow(R2StorageError)
    })
  })
})