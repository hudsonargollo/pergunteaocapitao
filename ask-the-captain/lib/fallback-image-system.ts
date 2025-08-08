/**
 * Fallback Image System
 * 
 * Provides reliable fallback images when image generation fails,
 * maintaining character consistency and appropriate context.
 */

import type { 
  ResponseToneAnalysis, 
  ContextualVariation,
  CharacterConsistencyValidation,
  ImageGenerationContext 
} from '../types'

export interface FallbackImage {
  id: string
  name: string
  description: string
  tone: string
  context: string
  url: string
  localPath?: string
  isDefault: boolean
  quality: 'high' | 'medium' | 'low'
  lastValidated?: Date
}

export interface FallbackSelectionCriteria {
  primaryTone: string
  intensity: 'low' | 'medium' | 'high'
  themes: string[]
  fallbackReason: 'generation_failed' | 'validation_failed' | 'timeout' | 'rate_limited' | 'network_error'
  preferHighQuality: boolean
}

export interface FallbackImageValidation {
  imageExists: boolean
  characterConsistent: boolean
  contextAppropriate: boolean
  qualityAcceptable: boolean
  recommendedAlternatives: string[]
}

/**
 * Predefined fallback images for different contexts
 */
export const FALLBACK_IMAGE_CATALOG: FallbackImage[] = [
  // Supportive tone fallbacks
  {
    id: 'fallback-supportive-default',
    name: 'Supportive Captain - Default',
    description: 'Welcoming stance with open arms, encouraging expression',
    tone: 'supportive',
    context: 'general support and encouragement',
    url: '/images/fallbacks/captain-supportive-default.png',
    localPath: 'public/images/fallbacks/captain-supportive-default.png',
    isDefault: true,
    quality: 'high'
  },
  {
    id: 'fallback-supportive-listening',
    name: 'Supportive Captain - Listening',
    description: 'Attentive pose, nodding slightly, understanding expression',
    tone: 'supportive',
    context: 'listening and understanding user concerns',
    url: '/images/fallbacks/captain-supportive-listening.png',
    localPath: 'public/images/fallbacks/captain-supportive-listening.png',
    isDefault: false,
    quality: 'high'
  },

  // Challenging tone fallbacks
  {
    id: 'fallback-challenging-default',
    name: 'Challenging Captain - Default',
    description: 'Firm stance with crossed arms, determined expression',
    tone: 'challenging',
    context: 'pushing user to take action',
    url: '/images/fallbacks/captain-challenging-default.png',
    localPath: 'public/images/fallbacks/captain-challenging-default.png',
    isDefault: true,
    quality: 'high'
  },
  {
    id: 'fallback-challenging-intense',
    name: 'Challenging Captain - Intense',
    description: 'Forward-leaning pose, intense gaze, no-nonsense expression',
    tone: 'challenging',
    context: 'confronting excuses and procrastination',
    url: '/images/fallbacks/captain-challenging-intense.png',
    localPath: 'public/images/fallbacks/captain-challenging-intense.png',
    isDefault: false,
    quality: 'high'
  },

  // Instructional tone fallbacks
  {
    id: 'fallback-instructional-default',
    name: 'Instructional Captain - Default',
    description: 'Teaching pose with pointing gesture, focused expression',
    tone: 'instructional',
    context: 'explaining methods and techniques',
    url: '/images/fallbacks/captain-instructional-default.png',
    localPath: 'public/images/fallbacks/captain-instructional-default.png',
    isDefault: true,
    quality: 'high'
  },
  {
    id: 'fallback-instructional-demonstrating',
    name: 'Instructional Captain - Demonstrating',
    description: 'Step-by-step demonstration pose, clear explanatory expression',
    tone: 'instructional',
    context: 'demonstrating specific techniques',
    url: '/images/fallbacks/captain-instructional-demonstrating.png',
    localPath: 'public/images/fallbacks/captain-instructional-demonstrating.png',
    isDefault: false,
    quality: 'high'
  },

  // Motivational tone fallbacks
  {
    id: 'fallback-motivational-default',
    name: 'Motivational Captain - Default',
    description: 'Heroic stance with raised fist, inspiring expression',
    tone: 'motivational',
    context: 'inspiring and empowering user',
    url: '/images/fallbacks/captain-motivational-default.png',
    localPath: 'public/images/fallbacks/captain-motivational-default.png',
    isDefault: true,
    quality: 'high'
  },
  {
    id: 'fallback-motivational-victory',
    name: 'Motivational Captain - Victory',
    description: 'Triumphant pose, both arms raised, victorious expression',
    tone: 'motivational',
    context: 'celebrating achievements and victories',
    url: '/images/fallbacks/captain-motivational-victory.png',
    localPath: 'public/images/fallbacks/captain-motivational-victory.png',
    isDefault: false,
    quality: 'high'
  },

  // Neutral tone fallbacks
  {
    id: 'fallback-neutral-default',
    name: 'Neutral Captain - Default',
    description: 'Balanced stance, calm expression, attentive pose',
    tone: 'neutral',
    context: 'general conversation and interaction',
    url: '/images/fallbacks/captain-neutral-default.png',
    localPath: 'public/images/fallbacks/captain-neutral-default.png',
    isDefault: true,
    quality: 'high'
  },
  {
    id: 'fallback-neutral-thinking',
    name: 'Neutral Captain - Thinking',
    description: 'Contemplative pose, hand on chin, thoughtful expression',
    tone: 'neutral',
    context: 'processing information and considering options',
    url: '/images/fallbacks/captain-neutral-thinking.png',
    localPath: 'public/images/fallbacks/captain-neutral-thinking.png',
    isDefault: false,
    quality: 'high'
  },

  // Universal fallback (last resort)
  {
    id: 'fallback-universal-default',
    name: 'Universal Captain - Default',
    description: 'Standard Captain pose, works for any context',
    tone: 'universal',
    context: 'any situation when specific fallbacks fail',
    url: '/images/fallbacks/captain-universal-default.png',
    localPath: 'public/images/fallbacks/captain-universal-default.png',
    isDefault: true,
    quality: 'medium'
  }
]

/**
 * Fallback Image System Class
 */
export class FallbackImageSystem {
  private fallbackCatalog: FallbackImage[]
  private validationCache: Map<string, FallbackImageValidation>

  constructor() {
    this.fallbackCatalog = FALLBACK_IMAGE_CATALOG
    this.validationCache = new Map()
  }

  /**
   * Select appropriate fallback image based on context
   */
  selectFallbackImage(criteria: FallbackSelectionCriteria): FallbackImage {
    // First, try to find exact tone match
    let candidates = this.fallbackCatalog.filter(img => 
      img.tone === criteria.primaryTone || img.tone === 'universal'
    )

    // If no exact match, expand to related tones
    if (candidates.length === 0) {
      candidates = this.getRelatedToneFallbacks(criteria.primaryTone)
    }

    // Filter by quality preference
    if (criteria.preferHighQuality) {
      const highQualityCandidates = candidates.filter(img => img.quality === 'high')
      if (highQualityCandidates.length > 0) {
        candidates = highQualityCandidates
      }
    }

    // Select based on context and themes
    const contextualMatch = this.findContextualMatch(candidates, criteria)
    if (contextualMatch) {
      return contextualMatch
    }

    // Fall back to default for the tone
    const defaultForTone = candidates.find(img => img.isDefault && img.tone === criteria.primaryTone)
    if (defaultForTone) {
      return defaultForTone
    }

    // Ultimate fallback - universal default
    return this.fallbackCatalog.find(img => img.id === 'fallback-universal-default')!
  }

  /**
   * Get fallback image based on response analysis
   */
  getFallbackForResponse(
    toneAnalysis: ResponseToneAnalysis,
    fallbackReason: FallbackSelectionCriteria['fallbackReason']
  ): FallbackImage {
    const criteria: FallbackSelectionCriteria = {
      primaryTone: toneAnalysis.primaryTone,
      intensity: toneAnalysis.intensity,
      themes: toneAnalysis.themes,
      fallbackReason,
      preferHighQuality: true
    }

    return this.selectFallbackImage(criteria)
  }

  /**
   * Get fallback image for specific generation context
   */
  getFallbackForContext(
    imageContext: ImageGenerationContext,
    fallbackReason: FallbackSelectionCriteria['fallbackReason']
  ): FallbackImage {
    return this.getFallbackForResponse(imageContext.toneAnalysis, fallbackReason)
  }

  /**
   * Validate fallback image availability and quality
   */
  async validateFallbackImage(imageId: string): Promise<FallbackImageValidation> {
    // Check cache first
    if (this.validationCache.has(imageId)) {
      const cached = this.validationCache.get(imageId)!
      // Return cached result if less than 1 hour old
      if (cached && Date.now() - (cached as any).lastChecked < 3600000) {
        return cached
      }
    }

    const fallbackImage = this.fallbackCatalog.find(img => img.id === imageId)
    if (!fallbackImage) {
      return {
        imageExists: false,
        characterConsistent: false,
        contextAppropriate: false,
        qualityAcceptable: false,
        recommendedAlternatives: []
      }
    }

    // In a real implementation, this would check if the image file exists
    // and validate its content for character consistency
    const validation: FallbackImageValidation = {
      imageExists: true, // Assume exists for now
      characterConsistent: true, // Assume consistent for now
      contextAppropriate: true,
      qualityAcceptable: fallbackImage.quality !== 'low',
      recommendedAlternatives: this.getAlternativeFallbacks(fallbackImage.tone)
    }

    // Cache the validation result
    this.validationCache.set(imageId, { ...validation, lastChecked: Date.now() } as any)

    return validation
  }

  /**
   * Get error-specific fallback message
   */
  getFallbackMessage(
    fallbackReason: FallbackSelectionCriteria['fallbackReason'],
    tone: string
  ): string {
    const messages = {
      generation_failed: {
        supportive: "Guerreiro, minha imagem não carregou desta vez, mas minha orientação permanece firme. Continue nossa conversa.",
        challenging: "A imagem falhou, mas minha determinação não. Vamos focar no que realmente importa: sua ação.",
        instructional: "Mesmo sem a imagem atualizada, o ensinamento continua claro. Vamos prosseguir com o método.",
        motivational: "Minha aparência pode não ter se atualizado, mas meu espírito guerreiro permanece inabalável!",
        neutral: "A imagem não carregou, mas nossa conversa continua. Como posso te ajudar?"
      },
      validation_failed: {
        supportive: "Estou aqui com você, mesmo que minha imagem não esteja perfeita hoje.",
        challenging: "Não importa como eu apareço - o que importa é sua disciplina e foco.",
        instructional: "A lição permanece clara, independente da imagem. Vamos continuar.",
        motivational: "Meu espírito guerreiro transcende qualquer imagem! Vamos conquistar!",
        neutral: "Continuemos nossa conversa, a imagem é secundária."
      },
      timeout: {
        supportive: "A paciência é uma virtude, guerreiro. Mesmo com a imagem atrasada, estou aqui para te apoiar.",
        challenging: "Não use a demora da imagem como desculpa para perder o foco. Ação é o que importa.",
        instructional: "O tempo da imagem não afeta a clareza do ensinamento. Vamos prosseguir.",
        motivational: "Nem o tempo pode diminuir nossa determinação! Vamos em frente!",
        neutral: "A imagem está demorando, mas podemos continuar conversando."
      },
      rate_limited: {
        supportive: "Até mesmo o Capitão precisa de um momento para recarregar as energias. Aguarde um instante.",
        challenging: "Limites existem para serem respeitados. Use este momento para refletir sobre sua disciplina.",
        instructional: "Este é um bom momento para revisar o que já aprendemos enquanto aguardamos.",
        motivational: "Cada pausa é uma oportunidade de crescer mais forte! Aguarde, guerreiro!",
        neutral: "Preciso de um momento para gerar uma nova imagem. Aguarde, por favor."
      },
      network_error: {
        supportive: "A conexão com a caverna está instável, mas meu apoio a você permanece constante.",
        challenging: "Problemas de conexão não são desculpa para parar. Adapte-se e continue.",
        instructional: "Mesmo offline, os princípios que ensinei permanecem válidos. Aplique-os.",
        motivational: "Nem a tecnologia pode parar um guerreiro determinado! Vamos superar isso!",
        neutral: "Problemas de conexão detectados. Vamos tentar novamente em breve."
      }
    }

    const toneMessages = messages[fallbackReason]
    return toneMessages[tone as keyof typeof toneMessages] || toneMessages.neutral
  }

  /**
   * Generate fallback image using base character system
   */
  async generateEmergencyFallback(
    tone: string,
    context: string
  ): Promise<{ imageUrl: string; message: string }> {
    // This would generate a basic fallback image using the character system
    // For now, return the universal fallback
    const universalFallback = this.fallbackCatalog.find(img => img.id === 'fallback-universal-default')!
    
    return {
      imageUrl: universalFallback.url,
      message: this.getFallbackMessage('generation_failed', tone)
    }
  }

  /**
   * Get related tone fallbacks when exact match not found
   */
  private getRelatedToneFallbacks(tone: string): FallbackImage[] {
    const toneRelations = {
      supportive: ['neutral', 'instructional'],
      challenging: ['motivational', 'neutral'],
      instructional: ['supportive', 'neutral'],
      motivational: ['challenging', 'supportive'],
      neutral: ['supportive', 'instructional']
    }

    const relatedTones = toneRelations[tone as keyof typeof toneRelations] || ['neutral']
    return this.fallbackCatalog.filter(img => 
      relatedTones.includes(img.tone) || img.tone === 'universal'
    )
  }

  /**
   * Find contextual match based on themes and criteria
   */
  private findContextualMatch(
    candidates: FallbackImage[],
    criteria: FallbackSelectionCriteria
  ): FallbackImage | null {
    // Score candidates based on context relevance
    const scoredCandidates = candidates.map(candidate => {
      let score = 0
      
      // Exact tone match gets highest score
      if (candidate.tone === criteria.primaryTone) score += 10
      
      // Default images get preference for reliability
      if (candidate.isDefault) score += 5
      
      // High quality gets preference
      if (candidate.quality === 'high') score += 3
      
      // Context matching (simple keyword matching)
      const contextWords = candidate.context.toLowerCase().split(' ')
      criteria.themes.forEach(theme => {
        if (contextWords.some(word => word.includes(theme.toLowerCase()))) {
          score += 2
        }
      })
      
      return { candidate, score }
    })

    // Sort by score and return the best match
    scoredCandidates.sort((a, b) => b.score - a.score)
    return scoredCandidates.length > 0 ? scoredCandidates[0].candidate : null
  }

  /**
   * Get alternative fallback suggestions
   */
  private getAlternativeFallbacks(tone: string): string[] {
    return this.fallbackCatalog
      .filter(img => img.tone === tone && !img.isDefault)
      .map(img => img.id)
      .slice(0, 3) // Return up to 3 alternatives
  }

  /**
   * Add custom fallback image to catalog
   */
  addCustomFallback(fallbackImage: FallbackImage): void {
    // Validate the fallback image structure
    if (!fallbackImage.id || !fallbackImage.url || !fallbackImage.tone) {
      throw new Error('Invalid fallback image structure')
    }

    // Check for duplicate IDs
    if (this.fallbackCatalog.some(img => img.id === fallbackImage.id)) {
      throw new Error(`Fallback image with ID ${fallbackImage.id} already exists`)
    }

    this.fallbackCatalog.push(fallbackImage)
  }

  /**
   * Remove fallback image from catalog
   */
  removeFallback(imageId: string): boolean {
    const index = this.fallbackCatalog.findIndex(img => img.id === imageId)
    if (index !== -1) {
      this.fallbackCatalog.splice(index, 1)
      this.validationCache.delete(imageId)
      return true
    }
    return false
  }

  /**
   * Get all available fallback images
   */
  getAllFallbacks(): FallbackImage[] {
    return [...this.fallbackCatalog]
  }

  /**
   * Get fallbacks for specific tone
   */
  getFallbacksForTone(tone: string): FallbackImage[] {
    return this.fallbackCatalog.filter(img => img.tone === tone || img.tone === 'universal')
  }

  /**
   * Clear validation cache
   */
  clearValidationCache(): void {
    this.validationCache.clear()
  }
}

/**
 * Factory function to create fallback image system
 */
export function createFallbackImageSystem(): FallbackImageSystem {
  return new FallbackImageSystem()
}

/**
 * Utility function to get quick fallback for tone
 */
export function getQuickFallback(tone: string): FallbackImage {
  const system = createFallbackImageSystem()
  return system.selectFallbackImage({
    primaryTone: tone,
    intensity: 'medium',
    themes: [],
    fallbackReason: 'generation_failed',
    preferHighQuality: true
  })
}

/**
 * Utility function to get fallback message
 */
export function getFallbackMessage(
  reason: FallbackSelectionCriteria['fallbackReason'],
  tone: string
): string {
  const system = createFallbackImageSystem()
  return system.getFallbackMessage(reason, tone)
}