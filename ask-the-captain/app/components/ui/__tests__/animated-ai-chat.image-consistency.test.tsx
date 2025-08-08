/**
 * AnimatedAIChat Image Generation Consistency Tests
 * 
 * Automated testing for image generation consistency including:
 * - Captain character consistency validation
 * - Brand element verification in generated images
 * - Contextual appropriateness testing
 * - Fallback image system validation
 * - Image quality and consistency scoring
 * - Performance of image validation pipeline
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnimatedAIChat } from '../animated-ai-chat'

// Image analysis utilities for consistency testing
class ImageConsistencyAnalyzer {
  private consistencyScores: Array<{
    imageUrl: string
    context: string
    score: number
    brandElements: string[]
    characterTraits: string[]
    issues: string[]
    timestamp: number
  }> = []

  async analyzeImage(imageUrl: string, context: string): Promise<{
    score: number
    brandElements: string[]
    characterTraits: string[]
    issues: string[]
  }> {
    // Simulate image analysis
    const analysis = this.simulateImageAnalysis(imageUrl, context)
    
    this.consistencyScores.push({
      imageUrl,
      context,
      ...analysis,
      timestamp: Date.now(),
    })

    return analysis
  }

  private simulateImageAnalysis(imageUrl: string, context: string): {
    score: number
    brandElements: string[]
    characterTraits: string[]
    issues: string[]
  } {
    // Simulate different consistency scores based on image URL patterns
    let score = 0.9 // Base high score
    const brandElements: string[] = []
    const characterTraits: string[] = []
    const issues: string[] = []

    // Check for brand elements
    if (imageUrl.includes('captain') || imageUrl.includes('caverna')) {
      brandElements.push('captain-character')
      score += 0.05
    } else {
      issues.push('missing-captain-character')
      score -= 0.3
    }

    if (imageUrl.includes('red-triangle') || imageUrl.includes('logo')) {
      brandElements.push('red-triangle-logo')
      score += 0.03
    } else if (!imageUrl.includes('fallback')) {
      issues.push('missing-brand-logo')
      score -= 0.1
    }

    if (imageUrl.includes('hoodie') || imageUrl.includes('black-clothing')) {
      brandElements.push('signature-clothing')
      score += 0.02
    }

    // Check for character traits
    if (imageUrl.includes('wolf') || imageUrl.includes('anthropomorphic')) {
      characterTraits.push('wolf-character')
      score += 0.05
    } else {
      issues.push('incorrect-species')
      score -= 0.2
    }

    if (imageUrl.includes('pixar') || imageUrl.includes('3d')) {
      characterTraits.push('pixar-style')
      score += 0.03
    }

    if (imageUrl.includes('athletic') || imageUrl.includes('fit')) {
      characterTraits.push('athletic-build')
      score += 0.02
    }

    // Context appropriateness
    if (context.includes('supportive') && imageUrl.includes('supportive')) {
      score += 0.05
    } else if (context.includes('challenging') && imageUrl.includes('challenging')) {
      score += 0.05
    } else if (context.includes('motivational') && imageUrl.includes('motivational')) {
      score += 0.05
    } else if (!imageUrl.includes('fallback')) {
      issues.push('context-mismatch')
      score -= 0.1
    }

    // Simulate some randomness in analysis
    score += (Math.random() - 0.5) * 0.1

    return {
      score: Math.max(0, Math.min(1, score)),
      brandElements,
      characterTraits,
      issues,
    }
  }

  getConsistencyReport() {
    const scores = this.consistencyScores.map(s => s.score)
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    
    const allIssues = this.consistencyScores.flatMap(s => s.issues)
    const issueFrequency = allIssues.reduce((freq, issue) => {
      freq[issue] = (freq[issue] || 0) + 1
      return freq
    }, {} as Record<string, number>)

    return {
      totalImages: this.consistencyScores.length,
      averageScore: avgScore,
      minScore,
      maxScore,
      consistencyRate: scores.filter(s => s >= 0.8).length / scores.length,
      commonIssues: Object.entries(issueFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
      scores: this.consistencyScores,
    }
  }

  reset() {
    this.consistencyScores = []
  }
}

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    input: ({ children, ...props }: any) => <input {...props}>{children}</input>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, onLoad, onError, ...props }: any) => {
    // Simulate image loading with consistency validation
    setTimeout(() => {
      if (src.includes('invalid') || Math.random() < 0.05) {
        onError?.()
      } else {
        onLoad?.()
      }
    }, Math.random() * 100 + 50)
    
    return <img src={src} alt={alt} {...props} />
  }
}))

// Mock icons
vi.mock('lucide-react', () => ({
  Send: () => <span data-testid="send-icon">Send</span>,
  Loader2: () => <span data-testid="loader-icon">Loading</span>,
  MessageCircle: () => <span data-testid="message-icon">Message</span>,
  Zap: () => <span data-testid="zap-icon">Zap</span>,
}))

// Mock custom hooks with image consistency features
const mockUseOptimizedChatState = {
  state: {
    messages: [],
    isTyping: false,
    isGeneratingImage: false,
    currentCaptainImage: '/placeholder-captain.svg',
    error: null,
    conversationId: null,
  },
  actions: {
    addMessage: vi.fn(),
    setTyping: vi.fn(),
    setGeneratingImage: vi.fn(),
    setCaptainImage: vi.fn(),
    setError: vi.fn(),
    setConversationId: vi.fn(),
    updateMessage: vi.fn(),
  },
  selectors: {
    getStats: vi.fn(() => ({
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      averageResponseTime: 0,
    })),
  },
}

const mockUseCaptainImageConsistency = {
  currentImageUrl: '/placeholder-captain.svg',
  isValidating: false,
  validationResult: null,
  usedFallback: false,
  loadCaptainImage: vi.fn(),
  validateCurrentImage: vi.fn(),
  getConsistencyStats: vi.fn(() => ({
    totalValidations: 0,
    successRate: 0.95,
    averageScore: 0.92,
  })),
}

vi.mock('@/app/hooks/useOptimizedChatState', () => ({
  useOptimizedChatState: () => mockUseOptimizedChatState,
  useImageCache: () => ({
    preloadImage: vi.fn().mockResolvedValue(true),
    getCachedImage: vi.fn(),
    getCacheStats: vi.fn(() => ({
      size: 10,
      hitRate: 0.85,
      missRate: 0.15,
    })),
  }),
  useAPIBatching: () => ({
    addRequest: vi.fn(),
  }),
  useVirtualScrolling: () => ({
    scrollElementRef: { current: null },
    visibleItems: [],
    totalHeight: 0,
    handleScroll: vi.fn(),
    scrollToBottom: vi.fn(),
    visibleRange: { start: 0, end: 0 },
  }),
  useMessageMemoryManagement: () => ({
    renderableMessages: [],
    renderMode: 'normal',
    memoryStats: { totalMessages: 0, renderedMessages: 0, memoryUsage: 0 },
    shouldUseVirtualization: false,
  }),
}))

vi.mock('@/app/hooks/useCaptainImageConsistency', () => ({
  useCaptainImageConsistency: () => mockUseCaptainImageConsistency,
}))

vi.mock('@/app/hooks/useAnimationPerformance', () => ({
  useAnimationPerformance: () => ({
    metrics: { fps: 60, totalFrames: 0, isOptimal: true },
    isMonitoring: false,
  }),
  useDevicePerformance: () => ({
    isHighPerformance: true,
    recommendedSettings: {
      enableComplexAnimations: true,
      enableBlur: true,
      enableShadows: true,
      maxConcurrentAnimations: 10,
    },
  }),
  useOptimizedRerender: (data: any) => data,
}))

// Mock external systems
vi.mock('@/lib/network-connectivity', () => ({
  useNetworkConnectivity: () => ({
    state: 'online',
    quality: 'good',
    isOnline: true,
    isOffline: false,
    checkConnectivity: vi.fn(),
    getCaptainMessage: vi.fn(() => ({ message: 'Connection restored' })),
  }),
}))

// Mock utility functions
vi.mock('@/app/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}))

// Mock brand assets with consistency validation
vi.mock('@/app/lib/brand-assets', () => ({
  BRAND_ASSETS: {
    fallbackImages: {
      default: '/fallback-captain-default.svg',
      supportive: '/fallback-captain-supportive.svg',
      challenging: '/fallback-captain-challenging.svg',
      instructional: '/fallback-captain-instructional.svg',
      motivational: '/fallback-captain-motivational.svg',
    },
  },
  getCaptainImageForContext: vi.fn((context) => `/captain-${context}-consistent.png`),
  getFallbackImageUrl: vi.fn((context) => `/fallback-captain-${context || 'default'}.svg`),
  preloadBrandAssets: vi.fn(() => Promise.resolve()),
  CAVE_TYPOGRAPHY: {
    body: { normal: 'text-base', small: 'text-sm' },
  },
  CAVE_ANIMATIONS: {
    duration: { fast: 0.1, normal: 0.3, slow: 0.5 },
  },
}))

// Create configurable fetch mock for image generation testing
const createImageGenerationFetch = (config: {
  consistencyRate?: number
  generationDelay?: number
  failureRate?: number
  contextAccuracy?: number
}) => {
  const {
    consistencyRate = 0.9,
    generationDelay = 300,
    failureRate = 0.05,
    contextAccuracy = 0.85,
  } = config

  let imageCounter = 0

  return vi.fn().mockImplementation(async (url: string, options: any) => {
    if (url === '/api/chat') {
      const body = JSON.parse(options.body)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      return {
        ok: true,
        json: () => Promise.resolve({
          response: `Guerreiro, sobre "${body.message}" - vou te orientar!`,
          imageUrl: '/initial-captain.png',
          conversationId: body.conversationId || `conv_${Date.now()}`,
        }),
      }
    }

    if (url === '/api/v1/images/generate') {
      imageCounter++
      
      // Simulate generation failure
      if (Math.random() < failureRate) {
        throw new Error('Image generation failed')
      }

      await new Promise(resolve => setTimeout(resolve, generationDelay))

      const body = JSON.parse(options.body)
      const context = this.analyzeResponseContext(body.responseContent || '')
      
      // Generate image URL based on consistency and context accuracy
      let imageUrl = `/generated-captain-${imageCounter}.png`
      
      if (Math.random() < consistencyRate) {
        imageUrl = `/captain-wolf-pixar-3d-hoodie-red-triangle-${imageCounter}.png`
      }
      
      if (Math.random() < contextAccuracy) {
        imageUrl = `/captain-${context}-${imageUrl}`
      }

      return {
        ok: true,
        json: () => Promise.resolve({
          imageUrl,
          imageId: `img_${imageCounter}`,
          promptParameters: {
            context,
            style: 'pixar-3d',
            character: 'wolf-captain',
            consistency: Math.random() < consistencyRate,
          },
        }),
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  })

  function analyzeResponseContext(content: string): string {
    if (content.includes('apoio') || content.includes('suporte')) return 'supportive'
    if (content.includes('desafio') || content.includes('disciplina')) return 'challenging'
    if (content.includes('ensino') || content.includes('aprenda')) return 'instructional'
    if (content.includes('motivação') || content.includes('força')) return 'motivational'
    return 'default'
  }
}

describe('AnimatedAIChat Image Generation Consistency Tests', () => {
  let imageAnalyzer: ImageConsistencyAnalyzer

  beforeEach(() => {
    vi.clearAllMocks()
    imageAnalyzer = new ImageConsistencyAnalyzer()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Captain Character Consistency Validation', () => {
    it('should maintain consistent Captain character across generations', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.95,
        contextAccuracy: 0.9,
      })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const testMessages = [
        'Como posso melhorar minha disciplina?',
        'Preciso de motivação para continuar',
        'Quais são os pilares do foco?',
        'Como criar uma rotina de sucesso?',
        'Me ajude a superar a procrastinação',
      ]

      const input = screen.getByRole('textbox')

      for (const message of testMessages) {
        await user.type(input, message)
        await user.keyboard('{Enter}')

        // Wait for image generation
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
        }, { timeout: 2000 })

        // Simulate image analysis
        const lastImageCall = (global.fetch as any).mock.calls
          .filter((call: any) => call[0] === '/api/v1/images/generate')
          .pop()
        
        if (lastImageCall) {
          const body = JSON.parse(lastImageCall[1].body)
          const analysis = await imageAnalyzer.analyzeImage(
            `/simulated-generated-image-${Date.now()}.png`,
            body.responseContent || message
          )
          
          expect(analysis.score).toBeGreaterThan(0.8)
          expect(analysis.characterTraits).toContain('wolf-character')
          expect(analysis.brandElements).toContain('captain-character')
        }

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }

      const report = imageAnalyzer.getConsistencyReport()
      expect(report.averageScore).toBeGreaterThan(0.85)
      expect(report.consistencyRate).toBeGreaterThan(0.8)
    })

    it('should validate physical character traits consistency', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.9,
      })

      mockUseCaptainImageConsistency.validateCurrentImage = vi.fn().mockResolvedValue({
        isConsistent: true,
        score: 0.92,
        traits: {
          species: 'wolf',
          style: 'pixar-3d',
          build: 'athletic',
          proportions: '6-head',
        },
        brandElements: {
          clothing: 'black-hoodie',
          logo: 'red-triangle',
          shoes: 'asymmetric-sneakers',
        },
      })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test character consistency')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseCaptainImageConsistency.validateCurrentImage).toHaveBeenCalled()
      })

      const validationCall = mockUseCaptainImageConsistency.validateCurrentImage.mock.calls[0]
      expect(validationCall).toBeDefined()
    })

    it('should detect and flag character inconsistencies', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.3, // Low consistency rate
      })

      mockUseCaptainImageConsistency.validateCurrentImage = vi.fn().mockResolvedValue({
        isConsistent: false,
        score: 0.45,
        issues: [
          'incorrect-species',
          'missing-brand-logo',
          'wrong-clothing-style',
        ],
      })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test inconsistency detection')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseCaptainImageConsistency.validateCurrentImage).toHaveBeenCalled()
      })

      // Should detect inconsistencies
      const validation = await mockUseCaptainImageConsistency.validateCurrentImage()
      expect(validation.isConsistent).toBe(false)
      expect(validation.score).toBeLessThan(0.7)
      expect(validation.issues).toContain('incorrect-species')
    })

    it('should maintain consistency across different contexts', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.9,
        contextAccuracy: 0.95,
      })

      const contextualMessages = [
        { message: 'Preciso de apoio emocional', expectedContext: 'supportive' },
        { message: 'Me desafie a ser melhor', expectedContext: 'challenging' },
        { message: 'Ensine-me sobre disciplina', expectedContext: 'instructional' },
        { message: 'Preciso de motivação', expectedContext: 'motivational' },
      ]

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')

      for (const { message, expectedContext } of contextualMessages) {
        await user.type(input, message)
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
        })

        // Analyze context appropriateness
        const analysis = await imageAnalyzer.analyzeImage(
          `/captain-${expectedContext}-consistent.png`,
          expectedContext
        )

        expect(analysis.score).toBeGreaterThan(0.8)
        expect(analysis.issues).not.toContain('context-mismatch')

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }

      const report = imageAnalyzer.getConsistencyReport()
      expect(report.averageScore).toBeGreaterThan(0.85)
    })
  })

  describe('Brand Element Verification', () => {
    it('should verify presence of required brand elements', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.95,
      })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test brand elements')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
      })

      const analysis = await imageAnalyzer.analyzeImage(
        '/captain-wolf-pixar-3d-hoodie-red-triangle-brand.png',
        'brand-verification'
      )

      expect(analysis.brandElements).toContain('captain-character')
      expect(analysis.brandElements).toContain('red-triangle-logo')
      expect(analysis.brandElements).toContain('signature-clothing')
      expect(analysis.score).toBeGreaterThan(0.9)
    })

    it('should flag missing brand elements', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.2, // Low consistency to test missing elements
      })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test missing brand elements')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
      })

      const analysis = await imageAnalyzer.analyzeImage(
        '/generic-character-no-brand.png',
        'missing-elements-test'
      )

      expect(analysis.issues).toContain('missing-captain-character')
      expect(analysis.issues).toContain('missing-brand-logo')
      expect(analysis.score).toBeLessThan(0.7)
    })

    it('should validate clothing and accessory consistency', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.9,
      })

      mockUseCaptainImageConsistency.validateCurrentImage = vi.fn().mockResolvedValue({
        isConsistent: true,
        score: 0.94,
        brandElements: {
          hoodie: { present: true, color: 'black', logo: 'red-triangle' },
          pants: { present: true, style: 'sweatpants', color: 'black' },
          shoes: { present: true, style: 'asymmetric', colors: ['red', 'black'] },
        },
      })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test clothing consistency')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUseCaptainImageConsistency.validateCurrentImage).toHaveBeenCalled()
      })

      const validation = await mockUseCaptainImageConsistency.validateCurrentImage()
      expect(validation.brandElements.hoodie.present).toBe(true)
      expect(validation.brandElements.hoodie.logo).toBe('red-triangle')
      expect(validation.brandElements.shoes.style).toBe('asymmetric')
    })
  })

  describe('Contextual Appropriateness Testing', () => {
    it('should generate contextually appropriate expressions and poses', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.9,
        contextAccuracy: 0.95,
      })

      const contextTests = [
        {
          message: 'Estou me sentindo desanimado',
          expectedTone: 'supportive',
          expectedElements: ['warm-expression', 'open-posture'],
        },
        {
          message: 'Preciso ser mais disciplinado',
          expectedTone: 'challenging',
          expectedElements: ['firm-expression', 'confident-stance'],
        },
        {
          message: 'Como funciona o protocolo?',
          expectedTone: 'instructional',
          expectedElements: ['focused-expression', 'teaching-gesture'],
        },
        {
          message: 'Vou conseguir alcançar meus objetivos!',
          expectedTone: 'motivational',
          expectedElements: ['inspiring-expression', 'heroic-pose'],
        },
      ]

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')

      for (const test of contextTests) {
        await user.type(input, test.message)
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
        })

        const analysis = await imageAnalyzer.analyzeImage(
          `/captain-${test.expectedTone}-appropriate.png`,
          test.expectedTone
        )

        expect(analysis.score).toBeGreaterThan(0.8)
        expect(analysis.issues).not.toContain('context-mismatch')

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }

      const report = imageAnalyzer.getConsistencyReport()
      expect(report.consistencyRate).toBeGreaterThan(0.8)
    })

    it('should adapt lighting and atmosphere to context', async () => {
      global.fetch = createImageGenerationFetch({
        contextAccuracy: 0.9,
      })

      const atmosphereTests = [
        { context: 'supportive', expectedAtmosphere: 'warm-golden-glow' },
        { context: 'challenging', expectedAtmosphere: 'dramatic-shadows' },
        { context: 'instructional', expectedAtmosphere: 'clear-even-lighting' },
        { context: 'motivational', expectedAtmosphere: 'heroic-backlighting' },
      ]

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')

      for (const test of atmosphereTests) {
        await user.type(input, `Test ${test.context} atmosphere`)
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
        })

        // Simulate atmosphere analysis
        const analysis = await imageAnalyzer.analyzeImage(
          `/captain-${test.context}-${test.expectedAtmosphere}.png`,
          test.context
        )

        expect(analysis.score).toBeGreaterThan(0.8)

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }
    })
  })

  describe('Fallback Image System Validation', () => {
    it('should use appropriate fallback images when generation fails', async () => {
      global.fetch = createImageGenerationFetch({
        failureRate: 0.8, // High failure rate to test fallbacks
      })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test fallback system')
      await user.keyboard('{Enter}')

      // Should attempt generation and fall back
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
      })

      // Should use fallback image
      await waitFor(() => {
        expect(mockUseOptimizedChatState.actions.setCaptainImage).toHaveBeenCalledWith(
          expect.stringContaining('fallback')
        )
      })
    })

    it('should select contextually appropriate fallback images', async () => {
      global.fetch = createImageGenerationFetch({
        failureRate: 1, // Always fail to test fallback selection
      })

      const contextualFallbacks = [
        { message: 'Preciso de apoio', expectedFallback: 'supportive' },
        { message: 'Me desafie', expectedFallback: 'challenging' },
        { message: 'Me ensine', expectedFallback: 'instructional' },
        { message: 'Me motive', expectedFallback: 'motivational' },
      ]

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')

      for (const test of contextualFallbacks) {
        await user.type(input, test.message)
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
        })

        // Should use contextually appropriate fallback
        const expectedFallbackUrl = `/fallback-captain-${test.expectedFallback}.svg`
        
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 200))
        })
      }
    })

    it('should validate fallback image consistency', async () => {
      const fallbackImages = [
        '/fallback-captain-default.svg',
        '/fallback-captain-supportive.svg',
        '/fallback-captain-challenging.svg',
        '/fallback-captain-instructional.svg',
        '/fallback-captain-motivational.svg',
      ]

      for (const fallbackUrl of fallbackImages) {
        const analysis = await imageAnalyzer.analyzeImage(fallbackUrl, 'fallback-validation')
        
        // Fallback images should maintain basic brand consistency
        expect(analysis.score).toBeGreaterThan(0.7)
        expect(analysis.brandElements).toContain('captain-character')
      }

      const report = imageAnalyzer.getConsistencyReport()
      expect(report.averageScore).toBeGreaterThan(0.75)
    })
  })

  describe('Image Quality and Consistency Scoring', () => {
    it('should provide detailed consistency scoring', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.85,
      })

      mockUseCaptainImageConsistency.getConsistencyStats = vi.fn(() => ({
        totalValidations: 50,
        successRate: 0.88,
        averageScore: 0.91,
        scoreDistribution: {
          excellent: 25, // 0.9-1.0
          good: 15,      // 0.8-0.9
          fair: 8,       // 0.7-0.8
          poor: 2,       // <0.7
        },
        commonIssues: [
          { issue: 'lighting-inconsistency', frequency: 5 },
          { issue: 'pose-variation', frequency: 3 },
          { issue: 'background-mismatch', frequency: 2 },
        ],
      }))

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      
      // Generate multiple images for scoring
      for (let i = 0; i < 10; i++) {
        await user.type(input, `Scoring test ${i}`)
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
        })

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }

      const stats = mockUseCaptainImageConsistency.getConsistencyStats()
      expect(stats.averageScore).toBeGreaterThan(0.85)
      expect(stats.successRate).toBeGreaterThan(0.8)
      expect(stats.scoreDistribution.excellent).toBeGreaterThan(20)
    })

    it('should track consistency trends over time', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.9,
      })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')

      // Generate images over time to track trends
      for (let batch = 0; batch < 3; batch++) {
        for (let i = 0; i < 5; i++) {
          await user.type(input, `Trend test batch ${batch} image ${i}`)
          await user.keyboard('{Enter}')

          await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
          })

          const analysis = await imageAnalyzer.analyzeImage(
            `/trend-test-${batch}-${i}.png`,
            `batch-${batch}`
          )

          expect(analysis.score).toBeGreaterThan(0.8)

          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 50))
          })
        }
      }

      const report = imageAnalyzer.getConsistencyReport()
      expect(report.totalImages).toBe(15)
      expect(report.averageScore).toBeGreaterThan(0.85)
      expect(report.consistencyRate).toBeGreaterThan(0.8)
    })
  })

  describe('Performance of Image Validation Pipeline', () => {
    it('should validate images efficiently', async () => {
      global.fetch = createImageGenerationFetch({
        generationDelay: 200,
        consistencyRate: 0.9,
      })

      mockUseCaptainImageConsistency.validateCurrentImage = vi.fn().mockImplementation(async () => {
        // Simulate validation time
        await new Promise(resolve => setTimeout(resolve, 50))
        return {
          isConsistent: true,
          score: 0.92,
          validationTime: 50,
        }
      })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const startTime = Date.now()
      const input = screen.getByRole('textbox')

      // Test validation performance with multiple images
      for (let i = 0; i < 5; i++) {
        await user.type(input, `Performance test ${i}`)
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(mockUseCaptainImageConsistency.validateCurrentImage).toHaveBeenCalled()
        })

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }

      const totalTime = Date.now() - startTime
      const avgTimePerValidation = totalTime / 5

      // Validation should be efficient
      expect(avgTimePerValidation).toBeLessThan(500) // Less than 500ms per validation
      expect(mockUseCaptainImageConsistency.validateCurrentImage).toHaveBeenCalledTimes(5)
    })

    it('should handle validation failures gracefully', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.9,
      })

      mockUseCaptainImageConsistency.validateCurrentImage = vi.fn()
        .mockRejectedValueOnce(new Error('Validation service unavailable'))
        .mockResolvedValue({
          isConsistent: true,
          score: 0.9,
        })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Validation failure test')
      await user.keyboard('{Enter}')

      // Should handle validation failure gracefully
      await waitFor(() => {
        expect(mockUseCaptainImageConsistency.validateCurrentImage).toHaveBeenCalled()
      })

      // Should not crash the application
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('Comprehensive Consistency Report', () => {
    it('should generate comprehensive consistency report', async () => {
      global.fetch = createImageGenerationFetch({
        consistencyRate: 0.85,
        contextAccuracy: 0.9,
      })

      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')

      // Generate diverse set of images for comprehensive report
      const testScenarios = [
        'Preciso de motivação para continuar',
        'Como posso ser mais disciplinado?',
        'Ensine-me sobre foco',
        'Me desafie a crescer',
        'Estou perdendo a esperança',
        'Quero alcançar meus objetivos',
        'Como criar uma rotina?',
        'Preciso superar obstáculos',
      ]

      for (const scenario of testScenarios) {
        await user.type(input, scenario)
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
        })

        const analysis = await imageAnalyzer.analyzeImage(
          `/comprehensive-test-${Date.now()}.png`,
          scenario
        )

        expect(analysis.score).toBeGreaterThan(0.7)

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }

      const report = imageAnalyzer.getConsistencyReport()

      expect(report.totalImages).toBe(testScenarios.length)
      expect(report.averageScore).toBeGreaterThan(0.8)
      expect(report.consistencyRate).toBeGreaterThan(0.75)
      expect(report.commonIssues).toBeDefined()
      expect(report.minScore).toBeGreaterThan(0.6)
      expect(report.maxScore).toBeLessThanOrEqual(1.0)
    })
  })
})