/**
 * Tests for Image Generation Pipeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageGenerationPipeline, createImageGenerationPipeline, generateCaptainImage } from '../image-generation'
import type { CloudflareEnv } from '../../types'

// Mock dependencies
vi.mock('../openai', () => ({
  OpenAIClient: vi.fn().mockImplementation(() => ({
    generateImage: vi.fn().mockResolvedValue('https://example.com/generated-image.png')
  }))
}))

vi.mock('../r2', () => ({
  R2Client: vi.fn().mockImplementation(() => ({}))
}))

vi.mock('../d1', () => ({
  D1Client: vi.fn().mockImplementation(() => ({}))
}))

vi.mock('../character-reference', () => ({
  CharacterReferenceManager: vi.fn().mockImplementation(() => ({
    selectReferenceImages: vi.fn().mockReturnValue([
      {
        id: 'ref-front-neutral',
        name: 'Front View - Neutral',
        description: 'Front-facing view with neutral expression',
        angle: 'front',
        expression: 'neutral',
        pose: 'standing straight',
        filePath: 'test-reference.webp'
      }
    ]),
    generateCharacterDescription: vi.fn().mockReturnValue('Test character description'),
    generateCharacterSeed: vi.fn().mockReturnValue('test-seed-123')
  })),
  createCharacterReferenceManager: vi.fn().mockImplementation(() => ({
    selectReferenceImages: vi.fn().mockReturnValue([
      {
        id: 'ref-front-neutral',
        name: 'Front View - Neutral',
        description: 'Front-facing view with neutral expression',
        angle: 'front',
        expression: 'neutral',
        pose: 'standing straight',
        filePath: 'test-reference.webp'
      }
    ]),
    generateCharacterDescription: vi.fn().mockReturnValue('Test character description'),
    generateCharacterSeed: vi.fn().mockReturnValue('test-seed-123')
  }))
}))

vi.mock('../image-storage', () => ({
  ImageStorageService: vi.fn().mockImplementation(() => ({
    storeImage: vi.fn().mockResolvedValue({
      success: true,
      data: {
        imageId: 'test-image-id',
        publicUrl: 'https://r2.example.com/test-image-id.png',
        r2ObjectKey: 'images/generated/2024/01/test-image-id.png',
        metadata: {
          image_id: 'test-image-id',
          r2_object_key: 'images/generated/2024/01/test-image-id.png',
          prompt_parameters: '{}',
          created_at: '2024-01-01T00:00:00Z'
        }
      }
    })
  })),
  createImageStorageService: vi.fn().mockImplementation(() => ({
    storeImage: vi.fn().mockResolvedValue({
      success: true,
      data: {
        imageId: 'test-image-id',
        publicUrl: 'https://r2.example.com/test-image-id.png',
        r2ObjectKey: 'images/generated/2024/01/test-image-id.png',
        metadata: {
          image_id: 'test-image-id',
          r2_object_key: 'images/generated/2024/01/test-image-id.png',
          prompt_parameters: '{}',
          created_at: '2024-01-01T00:00:00Z'
        }
      }
    })
  }))
}))

// Mock fetch for image download
global.fetch = vi.fn().mockImplementation((url) => {
  return Promise.resolve({
    ok: true,
    statusText: 'OK',
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
  })
})

const mockEnv: CloudflareEnv = {
  OPENAI_API_KEY: 'test-api-key',
  DB: {} as any,
  VECTORIZE_INDEX: {} as any,
  R2_BUCKET: {} as any,
  ASSETS: {} as any
}

describe('Image Generation Pipeline', () => {
  let pipeline: ImageGenerationPipeline

  beforeEach(() => {
    pipeline = new ImageGenerationPipeline(mockEnv)
    vi.clearAllMocks()
    
    // Re-setup fetch mock after clearing
    global.fetch = vi.fn().mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        statusText: 'OK',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      })
    })
  })

  describe('generateContextualImage', () => {
    it('should generate image based on response analysis', async () => {
      const responseContent = 'Bem-vindo, guerreiro! Você consegue fazer isso.'
      
      const result = await pipeline.generateContextualImage(responseContent)
      
      expect(result.imageUrl).toBe('https://r2.example.com/test-image-id.png')
      expect(result.imageId).toBe('test-image-id')
      expect(result.promptParameters).toBeDefined()
      expect(result.promptParameters.pose).toBeDefined()
      expect(result.promptParameters.expression).toBeDefined()
      expect(result.promptParameters.environment).toBeDefined()
      expect(result.promptParameters.lighting).toBeDefined()
    })

    it('should handle different image generation options', async () => {
      const responseContent = 'Chega de desculpas! Ação agora!'
      const options = {
        size: '1792x1024' as const,
        quality: 'standard' as const,
        style: 'natural' as const
      }
      
      const result = await pipeline.generateContextualImage(responseContent, options)
      
      expect(result.imageUrl).toBeDefined()
      expect(result.imageId).toBeDefined()
    })

    it('should throw error when image generation fails', async () => {
      const mockOpenAI = (pipeline as any).openaiClient
      mockOpenAI.generateImage.mockRejectedValueOnce(new Error('DALL-E API error'))
      
      const responseContent = 'Test response'
      
      await expect(pipeline.generateContextualImage(responseContent))
        .rejects.toThrow('Failed to complete image generation pipeline')
    })

    it('should throw error when image download fails', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      })
      
      const responseContent = 'Test response'
      
      await expect(pipeline.generateContextualImage(responseContent))
        .rejects.toThrow('Failed to complete image generation pipeline')
    })
  })

  describe('generateImage', () => {
    it('should generate image with DALL-E 3', async () => {
      const prompt = 'Test prompt for Capitão Caverna'
      
      const result = await pipeline.generateImage(prompt)
      
      expect(result).toBe('https://example.com/generated-image.png')
    })

    it('should use custom options', async () => {
      const prompt = 'Test prompt'
      const options = {
        size: '1024x1792' as const,
        quality: 'hd' as const,
        style: 'vivid' as const
      }
      
      const mockOpenAI = (pipeline as any).openaiClient
      await pipeline.generateImage(prompt, options)
      
      expect(mockOpenAI.generateImage).toHaveBeenCalledWith(prompt, {
        model: 'dall-e-3',
        ...options
      })
    })

    it('should throw error when DALL-E returns no URL', async () => {
      const mockOpenAI = (pipeline as any).openaiClient
      mockOpenAI.generateImage.mockResolvedValueOnce('')
      
      const prompt = 'Test prompt'
      
      await expect(pipeline.generateImage(prompt))
        .rejects.toThrow('Failed to generate image with DALL-E 3')
    })
  })

  describe('generateWithCustomParameters', () => {
    it('should generate image with custom parameters', async () => {
      const basePrompt = 'Base prompt for Capitão Caverna'
      const customParameters = {
        pose: 'heroic stance',
        expression: 'determined gaze',
        environment: 'dramatic cave setting',
        lighting: 'intense shadows',
        cameraAngle: 'low angle shot'
      }
      
      const result = await pipeline.generateWithCustomParameters(basePrompt, customParameters)
      
      expect(result.imageUrl).toBeDefined()
      expect(result.imageId).toBeDefined()
      expect(result.promptParameters.pose).toBe('heroic stance')
      expect(result.promptParameters.expression).toBe('determined gaze')
    })

    it('should handle partial custom parameters', async () => {
      const basePrompt = 'Base prompt'
      const customParameters = {
        pose: 'confident stance'
      }
      
      const result = await pipeline.generateWithCustomParameters(basePrompt, customParameters)
      
      expect(result.promptParameters.pose).toBe('confident stance')
      expect(result.promptParameters.expression).toBe('focused')
      expect(result.promptParameters.environment).toBe('cave interior')
    })
  })

  describe('generateFallbackImage', () => {
    it('should generate fallback image', async () => {
      const result = await pipeline.generateFallbackImage()
      
      expect(result.imageUrl).toBeDefined()
      expect(result.imageId).toBeDefined()
      expect(result.promptParameters).toBeDefined()
    })

    it('should throw error when fallback generation fails', async () => {
      const mockOpenAI = (pipeline as any).openaiClient
      mockOpenAI.generateImage.mockRejectedValueOnce(new Error('Complete failure'))
      
      await expect(pipeline.generateFallbackImage())
        .rejects.toThrow('Failed to generate fallback image')
    })
  })

  describe('batchGenerateImages', () => {
    it('should generate multiple images', async () => {
      const responses = [
        'Bem-vindo, guerreiro!',
        'Chega de desculpas!',
        'Primeiro passo é disciplina.'
      ]
      
      const results = await pipeline.batchGenerateImages(responses)
      
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.imageUrl).toBeDefined()
        expect(result.imageId).toBeDefined()
      })
    })

    it('should handle partial failures in batch', async () => {
      const mockOpenAI = (pipeline as any).openaiClient
      mockOpenAI.generateImage
        .mockResolvedValueOnce('https://example.com/image1.png')
        .mockRejectedValueOnce(new Error('Generation failed'))
        .mockResolvedValueOnce('https://example.com/image3.png')
      
      const responses = ['Response 1', 'Response 2', 'Response 3']
      
      const results = await pipeline.batchGenerateImages(responses)
      
      expect(results).toHaveLength(2) // Only successful generations
    })
  })

  describe('validateRequest', () => {
    it('should validate valid request', () => {
      const request = {
        responseContent: 'Valid response content',
        tone: 'supportive',
        themes: ['guidance']
      }
      
      expect(pipeline.validateRequest(request)).toBe(true)
    })

    it('should reject empty response content', () => {
      const request = {
        responseContent: '',
        tone: 'supportive',
        themes: ['guidance']
      }
      
      expect(() => pipeline.validateRequest(request))
        .toThrow('Response content is required')
    })

    it('should reject response content that is too long', () => {
      const request = {
        responseContent: 'x'.repeat(5001),
        tone: 'supportive',
        themes: ['guidance']
      }
      
      expect(() => pipeline.validateRequest(request))
        .toThrow('Response content too long')
    })
  })

  describe('getGenerationStats', () => {
    it('should return generation statistics', async () => {
      const stats = await pipeline.getGenerationStats()
      
      expect(stats).toHaveProperty('totalGenerated')
      expect(stats).toHaveProperty('recentGenerations')
      expect(stats).toHaveProperty('averageGenerationTime')
      expect(stats).toHaveProperty('errorRate')
    })
  })

  describe('Character Consistency', () => {
    it('should generate image with character consistency enabled', async () => {
      const responseContent = 'Bem-vindo ao Modo Caverna, guerreiro!'
      
      const result = await pipeline.generateContextualImage(responseContent, {
        characterConsistency: {
          useReferenceImages: true,
          enhancedPrompting: true
        }
      })
      
      expect(result.imageUrl).toBeDefined()
      expect(result.imageId).toBeDefined()
      expect(result.promptParameters).toBeDefined()
    })

    it('should generate image with specific reference images', async () => {
      const responseContent = 'Chega de desculpas! É hora de agir.'
      
      const result = await pipeline.generateContextualImage(responseContent, {
        characterConsistency: {
          useReferenceImages: true,
          referenceImageIds: ['ref-front-neutral', 'ref-front-winking-thumbsup'],
          enhancedPrompting: true
        }
      })
      
      expect(result.imageUrl).toBeDefined()
      expect(result.imageId).toBeDefined()
    })

    it('should generate image with custom character seed', async () => {
      const responseContent = 'Disciplina é a chave do sucesso.'
      
      const result = await pipeline.generateContextualImage(responseContent, {
        characterConsistency: {
          useReferenceImages: true,
          enhancedPrompting: true,
          characterSeed: 'custom-test-seed-123'
        }
      })
      
      expect(result.imageUrl).toBeDefined()
      expect(result.imageId).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should create proper error objects', () => {
      const error = (pipeline as any).createImageGenerationError(
        'TEST_ERROR',
        'Test error message',
        'testOperation',
        new Error('Original error')
      )
      
      expect(error.code).toBe('TEST_ERROR')
      expect(error.message).toBe('Test error message')
      expect(error.operation).toBe('testOperation')
      expect(error.originalError).toBeInstanceOf(Error)
    })
  })
})

describe('Utility Functions', () => {
  describe('createImageGenerationPipeline', () => {
    it('should create pipeline instance', () => {
      const pipeline = createImageGenerationPipeline(mockEnv)
      
      expect(pipeline).toBeInstanceOf(ImageGenerationPipeline)
    })
  })

  describe('generateCaptainImage', () => {
    it('should generate image using utility function', async () => {
      const responseContent = 'Test response'
      
      const result = await generateCaptainImage(responseContent, mockEnv)
      
      expect(result.imageUrl).toBeDefined()
      expect(result.imageId).toBeDefined()
    })

    it('should pass options to pipeline', async () => {
      const responseContent = 'Test response'
      const options = {
        size: '1792x1024' as const,
        quality: 'standard' as const
      }
      
      const result = await generateCaptainImage(responseContent, mockEnv, options)
      
      expect(result.imageUrl).toBeDefined()
    })
  })


})

describe('Integration Tests', () => {
  let integrationPipeline: ImageGenerationPipeline

  beforeEach(() => {
    integrationPipeline = new ImageGenerationPipeline(mockEnv)
  })

  it('should complete full pipeline from response to stored image', async () => {
    const responseContent = 'Bem-vindo ao Modo Caverna, guerreiro! Vamos começar sua transformação.'
    
    const result = await integrationPipeline.generateContextualImage(responseContent)
    
    // Verify complete pipeline execution
    expect(result.imageUrl).toMatch(/^https:\/\//)
    expect(result.imageId).toMatch(/^test-/)
    expect(result.promptParameters).toMatchObject({
      pose: expect.any(String),
      expression: expect.any(String),
      environment: expect.any(String),
      lighting: expect.any(String),
      cameraAngle: expect.any(String),
      emotionalContext: expect.any(String)
    })
  })

  it('should handle different response tones appropriately', async () => {
    const responses = [
      'Bem-vindo, guerreiro!', // supportive
      'Chega de desculpas!', // challenging
      'Primeiro passo é disciplina.', // instructional
      'Vamos à luta!' // motivational
    ]
    
    const results = await integrationPipeline.batchGenerateImages(responses)
    
    expect(results).toHaveLength(4)
    results.forEach(result => {
      expect(result.imageUrl).toBeDefined()
      expect(result.promptParameters.emotionalContext).toMatch(/(supportive|challenging|instructional|motivational)/)
    })
  })
})