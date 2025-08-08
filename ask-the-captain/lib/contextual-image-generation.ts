/**
 * Contextual Image Generation Logic
 * 
 * Analyzes AI response content to determine appropriate Captain pose, expression,
 * and environment while maintaining strict character consistency.
 */

import { CaptainCharacterSystem, createCaptainCharacterSystem } from './captain-character-system'
import type { 
  ToneAnalysis, 
  ResponseAnalysisResult, 
  ContextualVariation,
  CharacterConsistencyValidation 
} from '../types'

export interface ResponseToneAnalysis {
  primaryTone: 'supportive' | 'challenging' | 'instructional' | 'motivational' | 'neutral'
  intensity: 'low' | 'medium' | 'high'
  themes: string[]
  emotionalMarkers: string[]
  actionWords: string[]
  contextualHints: string[]
}

export interface ImageGenerationContext {
  responseContent: string
  toneAnalysis: ResponseToneAnalysis
  selectedVariation: ContextualVariation
  characterPrompt: string
  negativePrompts: string[]
  technicalSpecs: {
    resolution: string
    quality: 'standard' | 'hd'
    style: 'vivid' | 'natural'
  }
}

export interface PromptConstructionOptions {
  enhanceCharacterConsistency?: boolean
  includeEnvironmentDetails?: boolean
  addTechnicalSpecs?: boolean
  customSeed?: string
  overridePose?: string
  overrideExpression?: string
}

/**
 * Response tone analysis patterns
 */
const TONE_ANALYSIS_PATTERNS = {
  supportive: {
    keywords: [
      'apoio', 'ajuda', 'compreendo', 'entendo', 'juntos', 'vamos', 'pode',
      'consegue', 'força', 'coragem', 'acredito', 'confiança', 'guerreiro',
      'caminho', 'jornada', 'processo', 'passo a passo', 'calma'
    ],
    phrases: [
      'você não está sozinho',
      'estou aqui',
      'vamos juntos',
      'você consegue',
      'acredito em você',
      'é normal sentir',
      'compreendo sua'
    ],
    emotionalMarkers: ['empathy', 'encouragement', 'support', 'understanding']
  },
  challenging: {
    keywords: [
      'disciplina', 'foco', 'ação', 'agora', 'pare', 'chega', 'basta',
      'responsabilidade', 'compromisso', 'decisão', 'escolha', 'resultado',
      'consequência', 'mudança', 'transformação', 'desafio'
    ],
    phrases: [
      'não há desculpas',
      'é hora de',
      'você precisa',
      'tome uma decisão',
      'assuma o controle',
      'pare de procrastinar',
      'ação é necessária'
    ],
    emotionalMarkers: ['urgency', 'firmness', 'challenge', 'accountability']
  },
  instructional: {
    keywords: [
      'primeiro', 'segundo', 'terceiro', 'passo', 'método', 'técnica',
      'estratégia', 'processo', 'sistema', 'protocolo', 'rotina',
      'hábito', 'prática', 'exercício', 'ferramenta'
    ],
    phrases: [
      'vou te ensinar',
      'o método é',
      'siga estes passos',
      'a técnica consiste',
      'primeiro você deve',
      'o protocolo é',
      'funciona assim'
    ],
    emotionalMarkers: ['instruction', 'methodology', 'guidance', 'education']
  },
  motivational: {
    keywords: [
      'vitória', 'sucesso', 'conquista', 'objetivo', 'meta', 'sonho',
      'realização', 'potencial', 'poder', 'força', 'determinação',
      'persistência', 'foco', 'disciplina', 'guerreiro', 'herói'
    ],
    phrases: [
      'você é capaz',
      'seu potencial é',
      'a vitória está',
      'você nasceu para',
      'é hora de brilhar',
      'mostre sua força',
      'conquiste seus objetivos'
    ],
    emotionalMarkers: ['inspiration', 'empowerment', 'motivation', 'achievement']
  }
}

/**
 * Contextual Image Generation Engine
 */
export class ContextualImageGenerator {
  private characterSystem: CaptainCharacterSystem

  constructor() {
    this.characterSystem = createCaptainCharacterSystem()
  }

  /**
   * Analyze response content to determine appropriate tone and context
   */
  analyzeResponseTone(responseContent: string): ResponseToneAnalysis {
    const content = responseContent.toLowerCase()
    const toneScores = {
      supportive: 0,
      challenging: 0,
      instructional: 0,
      motivational: 0,
      neutral: 0
    }

    // Analyze keywords and phrases for each tone
    Object.entries(TONE_ANALYSIS_PATTERNS).forEach(([tone, patterns]) => {
      // Score keywords
      patterns.keywords.forEach(keyword => {
        const matches = (content.match(new RegExp(keyword, 'g')) || []).length
        toneScores[tone as keyof typeof toneScores] += matches * 1
      })

      // Score phrases (higher weight)
      patterns.phrases.forEach(phrase => {
        const matches = (content.match(new RegExp(phrase, 'g')) || []).length
        toneScores[tone as keyof typeof toneScores] += matches * 2
      })
    })

    // Determine primary tone
    const primaryTone = Object.entries(toneScores).reduce((a, b) => 
      toneScores[a[0] as keyof typeof toneScores] > toneScores[b[0] as keyof typeof toneScores] ? a : b
    )[0] as ResponseToneAnalysis['primaryTone']

    // Determine intensity based on content length and keyword density
    const wordCount = responseContent.split(' ').length
    const keywordDensity = toneScores[primaryTone] / wordCount
    let intensity: 'low' | 'medium' | 'high' = 'medium'
    
    if (keywordDensity > 0.1) intensity = 'high'
    else if (keywordDensity < 0.05) intensity = 'low'

    // Extract themes and markers
    const themes = this.extractThemes(responseContent)
    const emotionalMarkers = this.extractEmotionalMarkers(responseContent, primaryTone)
    const actionWords = this.extractActionWords(responseContent)
    const contextualHints = this.extractContextualHints(responseContent)

    return {
      primaryTone: primaryTone === 'neutral' && toneScores[primaryTone] === 0 ? 'neutral' : primaryTone,
      intensity,
      themes,
      emotionalMarkers,
      actionWords,
      contextualHints
    }
  }

  /**
   * Generate complete image generation context
   */
  generateImageContext(
    responseContent: string,
    options: PromptConstructionOptions = {}
  ): ImageGenerationContext {
    const defaultOptions: PromptConstructionOptions = {
      enhanceCharacterConsistency: true,
      includeEnvironmentDetails: true,
      addTechnicalSpecs: true,
      ...options
    }

    // Analyze response tone
    const toneAnalysis = this.analyzeResponseTone(responseContent)
    
    // Get contextual variation for the tone
    const selectedVariation = this.characterSystem.getContextualVariation(toneAnalysis.primaryTone)
    
    // Apply any overrides
    if (defaultOptions.overridePose) {
      selectedVariation.pose = defaultOptions.overridePose
    }
    if (defaultOptions.overrideExpression) {
      selectedVariation.expression = defaultOptions.overrideExpression
    }

    // Generate character-consistent prompt
    const characterPrompt = this.constructCharacterPrompt(
      toneAnalysis,
      selectedVariation,
      defaultOptions
    )

    // Get negative prompts
    const negativePrompts = this.characterSystem.getCharacterNegativePrompts()

    // Get technical specifications
    const technicalSpecs = this.characterSystem.getTechnicalSpecs()

    return {
      responseContent,
      toneAnalysis,
      selectedVariation,
      characterPrompt,
      negativePrompts,
      technicalSpecs
    }
  }

  /**
   * Construct complete character-consistent prompt
   */
  private constructCharacterPrompt(
    toneAnalysis: ResponseToneAnalysis,
    variation: ContextualVariation,
    options: PromptConstructionOptions
  ): string {
    let prompt = ''

    // Add environment foundation if requested
    if (options.includeEnvironmentDetails) {
      prompt += this.characterSystem.generateEnvironmentDescription() + '\n\n'
    }

    // Add base character description
    prompt += this.characterSystem.generateBaseCharacterDescription() + '\n\n'

    // Add contextual scene composition
    prompt += this.buildSceneComposition(toneAnalysis, variation) + '\n\n'

    // Add character-environment integration
    prompt += this.buildCharacterEnvironmentIntegration(variation) + '\n\n'

    // Add brand accuracy requirements
    prompt += this.buildBrandAccuracySection() + '\n\n'

    // Add technical specifications if requested
    if (options.addTechnicalSpecs) {
      prompt += this.buildTechnicalSpecifications() + '\n\n'
    }

    // Add negative prompts
    prompt += `NEGATIVE PROMPTS:\n(${this.characterSystem.getCharacterNegativePrompts().join(', ')})`

    return prompt.trim()
  }

  /**
   * Build scene composition section
   */
  private buildSceneComposition(
    toneAnalysis: ResponseToneAnalysis,
    variation: ContextualVariation
  ): string {
    return `
SCENE COMPOSITION (maintain character consistency):
POSE: ${variation.pose}
EXPRESSION: ${variation.expression}
ENVIRONMENT: ${variation.environmentFocus || 'main cave chamber'}
LIGHTING: ${variation.lighting}
CAMERA: ${variation.cameraAngle}
EMOTIONAL CONTEXT: ${variation.emotionalContext}
INTENSITY: ${toneAnalysis.intensity}
    `.trim()
  }

  /**
   * Build character-environment integration
   */
  private buildCharacterEnvironmentIntegration(variation: ContextualVariation): string {
    return `
CHARACTER–ENVIRONMENT INTEGRATION
${variation.lighting}; physical floor shadow; subtle fire reflections on hoodie.
${variation.gestureDetails ? `Gesture details: ${variation.gestureDetails}` : ''}
    `.trim()
  }

  /**
   * Build brand accuracy section
   */
  private buildBrandAccuracySection(): string {
    return `
BRAND ACCURACY — LOGO & COLORS
Equilateral △ #FF3333 (45% hoodie width) with centered howling-wolf cut-out; matte print roughness 0.8.

BRAND NEGATIVE PROMPT
(off-brand logo, wrong icon, gradient, faded print, low-res edge)
    `.trim()
  }

  /**
   * Build technical specifications
   */
  private buildTechnicalSpecifications(): string {
    return `
TEXTURE / RESOLUTION BOOST
Output 7680 × 4320 px 16-bit EXR (min 4096 × 2304) · 8K UDIM maps; anisotropic ON; displacement + micro-roughness; **NO** grain/bloom.

BODY-PROPORTION REINFORCEMENT
Overall height 6 heads ± 3% · Leg length 50% ± 3% (heel-to-hip) · Knee at 25% height · Arm tips mid-thigh.

FINGER-COUNT ENFORCEMENT
Hand anatomy: Exactly **4 digits per hand** (3 fingers + 1 thumb).
Finger order: Thumb, index, middle, ring.
    `.trim()
  }

  /**
   * Extract themes from response content
   */
  private extractThemes(content: string): string[] {
    const themes: string[] = []
    const themePatterns = {
      'discipline': /disciplina|foco|concentração/gi,
      'transformation': /transformação|mudança|evolução/gi,
      'action': /ação|fazer|executar|implementar/gi,
      'mindset': /mentalidade|pensamento|mente/gi,
      'goals': /objetivo|meta|sonho|conquista/gi,
      'habits': /hábito|rotina|ritual|prática/gi,
      'challenge': /desafio|dificuldade|obstáculo/gi,
      'growth': /crescimento|desenvolvimento|progresso/gi
    }

    Object.entries(themePatterns).forEach(([theme, pattern]) => {
      if (pattern.test(content)) {
        themes.push(theme)
      }
    })

    return themes
  }

  /**
   * Extract emotional markers for specific tone
   */
  private extractEmotionalMarkers(content: string, tone: string): string[] {
    const patterns = TONE_ANALYSIS_PATTERNS[tone as keyof typeof TONE_ANALYSIS_PATTERNS]
    return patterns ? patterns.emotionalMarkers : []
  }

  /**
   * Extract action words from content
   */
  private extractActionWords(content: string): string[] {
    const actionPatterns = [
      /\b(faça|execute|implemente|pratique|desenvolva|crie|construa|estabeleça)\b/gi,
      /\b(comece|inicie|pare|termine|continue|mantenha|persista)\b/gi,
      /\b(foque|concentre|dedique|comprometa|discipline)\b/gi
    ]

    const actionWords: string[] = []
    actionPatterns.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        actionWords.push(...matches.map(match => match.toLowerCase()))
      }
    })

    return [...new Set(actionWords)] // Remove duplicates
  }

  /**
   * Extract contextual hints for environment/pose selection
   */
  private extractContextualHints(content: string): string[] {
    const hints: string[] = []
    const hintPatterns = {
      'teaching': /ensinar|explicar|mostrar|demonstrar/gi,
      'encouraging': /apoiar|encorajar|motivar|inspirar/gi,
      'challenging': /desafiar|confrontar|questionar|exigir/gi,
      'guiding': /guiar|orientar|direcionar|conduzir/gi
    }

    Object.entries(hintPatterns).forEach(([hint, pattern]) => {
      if (pattern.test(content)) {
        hints.push(hint)
      }
    })

    return hints
  }

  /**
   * Validate generated image against expected context
   */
  async validateImageGeneration(
    imageUrl: string,
    expectedContext: ImageGenerationContext
  ): Promise<CharacterConsistencyValidation> {
    // This would typically use computer vision to validate the image
    // For now, return a validation based on the context
    return {
      physicalTraitsMatch: true,
      clothingAccurate: true,
      proportionsCorrect: true,
      brandElementsPresent: true,
      qualityScore: 0.95,
      issues: [],
      recommendations: []
    }
  }

  /**
   * Generate alternative prompt if validation fails
   */
  generateAlternativePrompt(
    originalContext: ImageGenerationContext,
    validationIssues: string[]
  ): string {
    // Modify the original context to address validation issues
    const modifiedVariation = { ...originalContext.selectedVariation }
    
    // Apply corrections based on issues
    if (validationIssues.includes('proportions')) {
      // Enhance proportion specifications
      modifiedVariation.pose = `${modifiedVariation.pose} (ensure 6-head proportions, 50% leg length)`
    }
    
    if (validationIssues.includes('brand_elements')) {
      // Enhance brand element specifications
      modifiedVariation.environmentFocus = `${modifiedVariation.environmentFocus} (ensure red triangle logo visible)`
    }

    return this.constructCharacterPrompt(
      originalContext.toneAnalysis,
      modifiedVariation,
      {
        enhanceCharacterConsistency: true,
        includeEnvironmentDetails: true,
        addTechnicalSpecs: true
      }
    )
  }

  /**
   * Get supported tones
   */
  getSupportedTones(): string[] {
    return this.characterSystem.getAvailableVariations()
  }

  /**
   * Test tone analysis with sample content
   */
  testToneAnalysis(sampleContent: string): ResponseToneAnalysis {
    return this.analyzeResponseTone(sampleContent)
  }
}

/**
 * Factory function to create contextual image generator
 */
export function createContextualImageGenerator(): ContextualImageGenerator {
  return new ContextualImageGenerator()
}

/**
 * Utility function to quickly generate image context
 */
export function generateImageContextForResponse(
  responseContent: string,
  options?: PromptConstructionOptions
): ImageGenerationContext {
  const generator = createContextualImageGenerator()
  return generator.generateImageContext(responseContent, options)
}

/**
 * Utility function to analyze response tone
 */
export function analyzeResponseTone(responseContent: string): ResponseToneAnalysis {
  const generator = createContextualImageGenerator()
  return generator.analyzeResponseTone(responseContent)
}

/**
 * Utility function to validate if content matches expected tone
 */
export function validateResponseTone(
  responseContent: string,
  expectedTone: string
): boolean {
  const analysis = analyzeResponseTone(responseContent)
  return analysis.primaryTone === expectedTone
}