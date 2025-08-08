/**
 * Captain Character System
 * 
 * Comprehensive system for maintaining consistent Capitão Caverna character
 * specifications across all image generation contexts.
 */

export interface PhysicalTraits {
  species: string
  style: string
  build: string
  height: string
  proportions: {
    headToBodyRatio: string
    legLength: string
    kneePosition: string
    armReach: string
    torsoShape: string
  }
  stance: string
  furColors: {
    primary: string
    muzzle: string
    innerEars: string
    tailTip: string
    handFur: string
    fingerPads: string
  }
  eyes: {
    color: string
    shape: string
    eyebrows: string
  }
  hands: {
    digitCount: string
    fingerOrder: string
    restrictions: string[]
  }
}

export interface ClothingSpecification {
  hoodie: {
    color: string
    fit: string
    logo: {
      shape: string
      color: string
      size: string
      design: string
      finish: string
    }
    drawstrings: string
  }
  pants: {
    type: string
    color: string
    fit: string
  }
  shoes: {
    type: string
    asymmetry: string
    colors: string
  }
}

export interface EnvironmentSpecification {
  setting: string
  architecture: {
    walls: string
    ceiling: string
    floor: string
    scale: string
  }
  lighting: {
    key: string
    practical: string
    rim: string
    volumetrics: string
  }
  atmosphere: {
    humidity: string
    temperature: string
    acoustics: string
    naturalElements: string[]
  }
  technicalSpecs: {
    resolution: string
    rendering: string
    continuity: string[]
  }
}

export interface ContextualVariation {
  pose: string
  expression: string
  lighting: string
  cameraAngle: string
  emotionalContext: string
  gestureDetails?: string
  environmentFocus?: string
}

export interface CharacterConsistencyValidation {
  physicalTraitsMatch: boolean
  clothingAccurate: boolean
  proportionsCorrect: boolean
  brandElementsPresent: boolean
  qualityScore: number
  issues: string[]
  recommendations: string[]
}

/**
 * Base character specifications for Capitão Caverna
 */
export const BASE_PHYSICAL_TRAITS: PhysicalTraits = {
  species: 'anthropomorphic wolf',
  style: 'Pixar-style 3D animation',
  build: 'tall athletic hero, lean V-shaped torso, narrow waist',
  height: 'approximately 6 heads in height',
  proportions: {
    headToBodyRatio: 'head ≤ 1.2× torso width',
    legLength: '50% of total height (heel to hip)',
    kneePosition: '25% of total height',
    armReach: 'arms reach to mid-thigh when relaxed',
    torsoShape: 'V-shaped torso, narrow waist, athletic build'
  },
  stance: 'digitigrade (walking on toes)',
  furColors: {
    primary: 'grey top-coat',
    muzzle: 'cream-colored muzzle',
    innerEars: 'cream-colored inner ears',
    tailTip: 'warm beige tail tip',
    handFur: 'cream-beige #C8A879 (identical to muzzle)',
    fingerPads: 'dark-charcoal #2C2C2C (matte, no specular)'
  },
  eyes: {
    color: 'distinctive crimson/red eyes',
    shape: 'alert, focused',
    eyebrows: 'thick dark eyebrows'
  },
  hands: {
    digitCount: 'exactly 4 digits per hand (3 fingers + 1 thumb)',
    fingerOrder: 'thumb, index, middle, ring',
    restrictions: [
      'no five fingers',
      'no human hands',
      'no extra digits',
      'no fused fingers',
      'no missing thumb',
      'no full-glove look',
      'no dark mitten effect'
    ]
  }
}

export const BASE_CLOTHING_SPECIFICATION: ClothingSpecification = {
  hoodie: {
    color: 'black fitted hoodie',
    fit: 'fitted, athletic cut',
    logo: {
      shape: 'equilateral triangle',
      color: '#FF3333 (Cave Red)',
      size: '45% of hoodie width',
      design: 'centered howling-wolf cut-out silhouette',
      finish: 'matte print roughness 0.8'
    },
    drawstrings: 'black drawstrings'
  },
  pants: {
    type: 'sweatpants/joggers',
    color: 'black',
    fit: 'athletic, comfortable'
  },
  shoes: {
    type: 'sneakers',
    asymmetry: 'asymmetric design',
    colors: 'left shoe red, right shoe black and white'
  }
}

export const BASE_ENVIRONMENT_SPECIFICATION: EnvironmentSpecification = {
  setting: 'natural cave interior with geological majesty',
  architecture: {
    walls: 'granite/limestone with layered veining, subtle mica sparkle',
    ceiling: 'vaulted arches, stalactite formations, skylight fissures',
    floor: 'silky-eroded channels, pebble insets, centuries of foot smoothing',
    scale: 'cathedral-scale, sized to elevate—not dwarf—Capitão Caverna'
  },
  lighting: {
    key: 'filtered daylight shafts (6500K → 3200K via rock bounce)',
    practical: 'wall braziers & torches (#FFA500 / #FFD700) every 8m for warm fill',
    rim: 'soft red accent (H 10°, S 80%, V 90%)',
    volumetrics: '8% humidity haze, god-rays, dust motes 8-25 µm'
  },
  atmosphere: {
    humidity: '8% humidity haze',
    temperature: 'ambient stone 16°C',
    acoustics: 'echo 0.25s',
    naturalElements: [
      'underground stream (IOR 1.33)',
      'quartz clusters',
      'stratified rock bands',
      'mist fall-off 1.5m'
    ]
  },
  technicalSpecs: {
    resolution: 'minimum 4096 × 2304 px, target 7680 × 4320 px',
    rendering: 'volumetric path-tracing ≥ 256 spp, adaptive, denoise OFF',
    continuity: [
      'unified HDRI',
      'seed-locked volumetrics',
      'waterflow L→R',
      'dust ± 5%'
    ]
  }
}

/**
 * Contextual variations for different response tones
 */
export const CONTEXTUAL_VARIATIONS: Record<string, ContextualVariation> = {
  supportive: {
    pose: 'open arms, welcoming stance, slightly leaning forward',
    expression: 'warm smile, encouraging eyes, raised eyebrows',
    lighting: 'soft, golden cave glow, warm torch fill',
    cameraAngle: 'medium shot, eye level, slightly low angle for approachability',
    emotionalContext: 'encouraging, supportive, welcoming',
    gestureDetails: 'open palms, relaxed shoulders',
    environmentFocus: 'warm torch lighting, inviting cave entrance'
  },
  challenging: {
    pose: 'crossed arms, firm stance, chest expanded',
    expression: 'intense gaze, determined, slight frown, focused',
    lighting: 'dramatic shadows, focused beam, high contrast',
    cameraAngle: 'medium shot, slightly low angle for authority',
    emotionalContext: 'firm, challenging, no-nonsense',
    gestureDetails: 'crossed arms, planted feet, strong posture',
    environmentFocus: 'dramatic cave shadows, stark lighting contrasts'
  },
  instructional: {
    pose: 'pointing gesture, teaching stance, one hand raised',
    expression: 'focused, explanatory, attentive, slight nod',
    lighting: 'clear, even illumination, balanced lighting',
    cameraAngle: 'medium shot, eye level, centered composition',
    emotionalContext: 'educational, clear, methodical',
    gestureDetails: 'pointing finger, open teaching gesture',
    environmentFocus: 'well-lit cave chamber, clear visibility'
  },
  motivational: {
    pose: 'heroic stance, fist raised, dynamic posture',
    expression: 'inspiring, confident, energetic smile, bright eyes',
    lighting: 'heroic backlighting, inspiring glow, rim lighting',
    cameraAngle: 'medium shot, low angle for heroic effect',
    emotionalContext: 'inspiring, energetic, empowering',
    gestureDetails: 'raised fist, dynamic pose, forward lean',
    environmentFocus: 'dramatic cave opening, inspiring light shafts'
  },
  neutral: {
    pose: 'standing straight, arms at sides, balanced stance',
    expression: 'calm, focused, attentive, neutral mouth',
    lighting: 'balanced cave lighting, natural torch glow',
    cameraAngle: 'medium shot, eye level, centered',
    emotionalContext: 'calm, balanced, attentive',
    gestureDetails: 'relaxed arms, natural stance',
    environmentFocus: 'main cave chamber, balanced lighting'
  }
}

/**
 * Captain Character System Class
 */
export class CaptainCharacterSystem {
  private physicalTraits: PhysicalTraits
  private clothingSpec: ClothingSpecification
  private environmentSpec: EnvironmentSpecification
  private contextualVariations: Record<string, ContextualVariation>

  constructor() {
    this.physicalTraits = BASE_PHYSICAL_TRAITS
    this.clothingSpec = BASE_CLOTHING_SPECIFICATION
    this.environmentSpec = BASE_ENVIRONMENT_SPECIFICATION
    this.contextualVariations = CONTEXTUAL_VARIATIONS
  }

  /**
   * Generate base character description for consistent prompting
   */
  generateBaseCharacterDescription(): string {
    return `
CAPITÃO CAVERNA — CHARACTER FOUNDATION (EXACT MATCH REQUIRED)
${this.physicalTraits.style} ${this.physicalTraits.species} (${this.physicalTraits.furColors.primary}, ${this.physicalTraits.furColors.muzzle}, ${this.physicalTraits.furColors.tailTip}).
${this.physicalTraits.build}, ${this.physicalTraits.height}; long legs = ${this.physicalTraits.proportions.legLength}; ${this.physicalTraits.proportions.torsoShape}; ${this.physicalTraits.stance}.
${this.physicalTraits.eyes.color}, ${this.physicalTraits.eyes.eyebrows}; ${this.physicalTraits.hands.digitCount}.

EXACT CLOTHING MATCH:
• ${this.clothingSpec.hoodie.color} + ${this.clothingSpec.hoodie.logo.shape} ${this.clothingSpec.hoodie.logo.design} (${this.clothingSpec.hoodie.logo.color})
• ${this.clothingSpec.pants.color} ${this.clothingSpec.pants.type}
• ${this.clothingSpec.shoes.type} (${this.clothingSpec.shoes.asymmetry}: ${this.clothingSpec.shoes.colors})

PROPORTIONS (critical for consistency):
• Overall height: ${this.physicalTraits.height} ± 3%
• Leg length: ${this.physicalTraits.proportions.legLength} ± 3%
• Knee position: ${this.physicalTraits.proportions.kneePosition}
• Arms reach: ${this.physicalTraits.proportions.armReach}
• Head size: ${this.physicalTraits.proportions.headToBodyRatio}

HAND SPECIFICATIONS:
• Hand anatomy: ${this.physicalTraits.hands.digitCount}
• Finger order: ${this.physicalTraits.hands.fingerOrder}
• Hand fur: ${this.physicalTraits.furColors.handFur}
• Finger pads: ${this.physicalTraits.furColors.fingerPads}
    `.trim()
  }

  /**
   * Generate environment description for consistent cave setting
   */
  generateEnvironmentDescription(): string {
    return `
STANDARD CAVE ENVIRONMENT FOUNDATION
Ultra-high-resolution, physically-based render of a ${this.environmentSpec.setting}.
${this.environmentSpec.architecture.scale} ${this.environmentSpec.architecture.walls.split(',')[0]} architecture displays ${this.environmentSpec.architecture.walls.split(',').slice(1).join(',')}.

STRUCTURAL SPECIFICATIONS
• Walls: ${this.environmentSpec.architecture.walls}
• Ceiling: ${this.environmentSpec.architecture.ceiling}
• Floor: ${this.environmentSpec.architecture.floor}

LIGHTING ARCHITECTURE
• Key: ${this.environmentSpec.lighting.key}
• Practical: ${this.environmentSpec.lighting.practical}
• Rim: ${this.environmentSpec.lighting.rim}
• Volumetrics: ${this.environmentSpec.lighting.volumetrics}

NATURAL ELEMENTS & ATMOSPHERIC DETAILS
${this.environmentSpec.atmosphere.naturalElements.join(', ')} · Mist fall-off 1.5m, echo ${this.environmentSpec.atmosphere.acoustics}, ambient stone ${this.environmentSpec.atmosphere.temperature}.

TECHNICAL RENDERING
Resolution ≥ ${this.environmentSpec.technicalSpecs.resolution.split(',')[0]} · ${this.environmentSpec.technicalSpecs.rendering}.

CONTINUITY STANDARDS
${this.environmentSpec.technicalSpecs.continuity.join(', ')}.
    `.trim()
  }

  /**
   * Get contextual variation for specific response tone
   */
  getContextualVariation(tone: string): ContextualVariation {
    return this.contextualVariations[tone] || this.contextualVariations.neutral
  }

  /**
   * Generate complete character-consistent prompt
   */
  generateCharacterConsistentPrompt(
    tone: string,
    customPose?: string,
    customExpression?: string,
    customEnvironment?: string
  ): string {
    const baseCharacter = this.generateBaseCharacterDescription()
    const baseEnvironment = this.generateEnvironmentDescription()
    const contextualVar = this.getContextualVariation(tone)

    const pose = customPose || contextualVar.pose
    const expression = customExpression || contextualVar.expression
    const lighting = contextualVar.lighting
    const cameraAngle = contextualVar.cameraAngle
    const environmentFocus = customEnvironment || contextualVar.environmentFocus

    return `
${baseEnvironment}

${baseCharacter}

CHARACTER–ENVIRONMENT INTEGRATION
${lighting}; physical floor shadow; subtle fire reflections on hoodie.

SCENE COMPOSITION:
POSE: ${pose}
EXPRESSION: ${expression}
ENVIRONMENT: ${environmentFocus || 'main cave chamber'}
LIGHTING: ${lighting}
CAMERA: ${cameraAngle}

BRAND ACCURACY — LOGO & COLORS
${this.clothingSpec.hoodie.logo.shape} ${this.clothingSpec.hoodie.logo.color} (${this.clothingSpec.hoodie.logo.size}) with ${this.clothingSpec.hoodie.logo.design}; ${this.clothingSpec.hoodie.logo.finish}.

NEGATIVE PROMPTS:
(cute, kawaii, plush, funko, chibi, mascot suit, fursuit, man in costume, wolf mask, toddler-proportions, five fingers, mirrored feet, human hands, wrong proportions, off-brand logo, gradient logo, faded print, different character, wrong eye color, different species, subtitles, text overlays)
    `.trim()
  }

  /**
   * Validate character consistency in generated image
   */
  validateCharacterConsistency(
    imageUrl: string,
    expectedTone: string
  ): Promise<CharacterConsistencyValidation> {
    // This would typically use computer vision to validate the image
    // For now, return a mock validation structure
    return Promise.resolve({
      physicalTraitsMatch: true,
      clothingAccurate: true,
      proportionsCorrect: true,
      brandElementsPresent: true,
      qualityScore: 0.95,
      issues: [],
      recommendations: []
    })
  }

  /**
   * Get negative prompts for character consistency
   */
  getCharacterNegativePrompts(): string[] {
    return [
      // Physical trait negatives
      'cute', 'kawaii', 'plush', 'funko', 'chibi', 'mascot suit', 'fursuit',
      'man in costume', 'wolf mask', 'toddler-proportions',
      
      // Hand/finger negatives
      'five fingers', 'human hand', 'six fingers', 'extra digits', 
      'fused fingers', 'missing thumb', 'dark gloves', 'black paws',
      'soot-covered hand', 'full mitten', 'human skin tone',
      
      // Proportion negatives
      'short legs', 'stubby', 'chubby stance', 'teddy build', 'bobble-head',
      'wrong proportions', 'mirrored feet',
      
      // Brand negatives
      'off-brand logo', 'wrong icon', 'gradient logo', 'faded print', 
      'low-res edge', 'different character', 'wrong eye color', 'different species',
      
      // Technical negatives
      'subtitles', 'text overlays', 'grain', 'bloom', 'low resolution'
    ]
  }

  /**
   * Get all available contextual variations
   */
  getAvailableVariations(): string[] {
    return Object.keys(this.contextualVariations)
  }

  /**
   * Update contextual variation
   */
  updateContextualVariation(tone: string, variation: Partial<ContextualVariation>): void {
    if (this.contextualVariations[tone]) {
      this.contextualVariations[tone] = {
        ...this.contextualVariations[tone],
        ...variation
      }
    }
  }

  /**
   * Generate character seed for reproducible results
   */
  generateCharacterSeed(content: string, tone: string): string {
    const characterBase = 'capitao-caverna-wolf-character'
    const tonePrefix = tone.substring(0, 3)
    const contentHash = content.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    return `${characterBase}-${tonePrefix}-${contentHash}`
  }

  /**
   * Get technical specifications for image generation
   */
  getTechnicalSpecs(): {
    resolution: string
    quality: 'standard' | 'hd'
    style: 'vivid' | 'natural'
  } {
    return {
      resolution: '1024x1024', // DALL-E 3 standard
      quality: 'hd',
      style: 'vivid'
    }
  }
}

/**
 * Factory function to create Captain Character System instance
 */
export function createCaptainCharacterSystem(): CaptainCharacterSystem {
  return new CaptainCharacterSystem()
}

/**
 * Utility function to get character-consistent prompt for specific tone
 */
export function getCharacterConsistentPrompt(
  tone: string,
  customizations?: {
    pose?: string
    expression?: string
    environment?: string
  }
): string {
  const characterSystem = createCaptainCharacterSystem()
  return characterSystem.generateCharacterConsistentPrompt(
    tone,
    customizations?.pose,
    customizations?.expression,
    customizations?.environment
  )
}

/**
 * Utility function to validate if a tone is supported
 */
export function isSupportedTone(tone: string): boolean {
  return tone in CONTEXTUAL_VARIATIONS
}

/**
 * Get fallback tone if provided tone is not supported
 */
export function getFallbackTone(tone: string): string {
  return isSupportedTone(tone) ? tone : 'neutral'
}