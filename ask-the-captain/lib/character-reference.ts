/**
 * Character Reference System
 * 
 * Manages reference images and character consistency for Capitão Caverna
 * image generation using multiple techniques for optimal results.
 */

import type { CloudflareEnv } from '../types'

export interface ReferenceImage {
  id: string
  name: string
  description: string
  angle: 'front' | 'back' | 'left' | 'right' | 'three-quarter'
  expression: 'neutral' | 'smiling' | 'winking' | 'focused' | 'determined'
  pose: string
  filePath: string
  publicUrl?: string
}

export interface CharacterConsistencyOptions {
  useReferenceImages: boolean
  referenceImageIds?: string[]
  enhancedPrompting: boolean
  characterSeed?: string
}

/**
 * Reference images for Capitão Caverna character consistency
 */
export const CAPITAO_CAVERNA_REFERENCES: ReferenceImage[] = [
  {
    id: 'ref-front-neutral',
    name: 'Front View - Neutral',
    description: 'Front-facing view with neutral expression, standard pose',
    angle: 'front',
    expression: 'neutral',
    pose: 'standing straight, arms at sides',
    filePath: 'capitao-caverna-reference-images/reference1-capitao-caverna-front-20250422_0526_3D Cartoon Figure_remix_01jse9j3vrfkmasmwvaw81ps2f.webp'
  },
  {
    id: 'ref-right-neutral',
    name: 'Right Side View - Neutral',
    description: 'Right side profile view with neutral expression',
    angle: 'right',
    expression: 'neutral',
    pose: 'standing profile, showing character proportions',
    filePath: 'capitao-caverna-reference-images/reference2-capitao-caverna-rightside-20250729_0403_Cartoon Wolf Character_remix_01k1afs0z4e86rk4s6ane7fa4q.webp'
  },
  {
    id: 'ref-back-neutral',
    name: 'Back View - Neutral',
    description: 'Back view showing hoodie design and character silhouette',
    angle: 'back',
    expression: 'neutral',
    pose: 'standing with back to viewer, showing hoodie logo',
    filePath: 'capitao-caverna-reference-images/reference3-capitao-caverna-back-20250729_0331_Stylized Wolf Character_remix_01k1adz53ce20t8ej15dqaaax6.webp'
  },
  {
    id: 'ref-left-neutral',
    name: 'Left Side View - Neutral',
    description: 'Left side profile view with neutral expression',
    angle: 'left',
    expression: 'neutral',
    pose: 'standing profile, left side view',
    filePath: 'capitao-caverna-reference-images/reference4-capitao-caverna-leftside-20250729_0423_Cartoon Wolf Character_remix.webp'
  },
  {
    id: 'ref-front-smiling-phone',
    name: 'Front View - Smiling with Phone',
    description: 'Front view, smiling expression, holding smartphone',
    angle: 'front',
    expression: 'smiling',
    pose: 'holding smartphone, friendly gesture',
    filePath: 'capitao-caverna-reference-images/reference5-capitao-caverna-smiling-holding-smartphone-20250422_0549_3D-Character-Studio-Portrait_remix_01jseaxfmzf0r96grrp29y0hdn.webp'
  },
  {
    id: 'ref-front-winking-thumbsup',
    name: 'Front View - Winking Thumbs Up',
    description: 'Front view, winking and giving thumbs up, energetic pose',
    angle: 'front',
    expression: 'winking',
    pose: 'giving thumbs up, confident gesture',
    filePath: 'capitao-caverna-reference-images/reference6-capitao-caverna-winking-smiling-giving-thumbsup-20250422_0558_3D Wolf Character_remix_01jsebd7w4fertysatahzvgvx3.webp'
  }
]

/**
 * Character Reference Manager
 * Handles reference image selection and character consistency
 */
export class CharacterReferenceManager {
  private references: ReferenceImage[]
  private env: CloudflareEnv

  constructor(env: CloudflareEnv) {
    this.references = CAPITAO_CAVERNA_REFERENCES
    this.env = env
  }

  /**
   * Select best reference images based on desired angle and expression
   */
  selectReferenceImages(
    desiredAngle?: string,
    desiredExpression?: string,
    maxReferences: number = 2
  ): ReferenceImage[] {
    let candidates = [...this.references]

    // Filter by angle if specified
    if (desiredAngle) {
      const angleMatches = candidates.filter(ref => 
        ref.angle === desiredAngle || 
        (desiredAngle === 'three-quarter' && ['front', 'left', 'right'].includes(ref.angle))
      )
      if (angleMatches.length > 0) {
        candidates = angleMatches
      }
    }

    // Filter by expression if specified
    if (desiredExpression) {
      const expressionMatches = candidates.filter(ref => ref.expression === desiredExpression)
      if (expressionMatches.length > 0) {
        candidates = expressionMatches
      }
    }

    // Return top candidates, prioritizing front view and neutral expression as fallbacks
    return candidates
      .sort((a, b) => {
        // Prioritize front view
        if (a.angle === 'front' && b.angle !== 'front') return -1
        if (b.angle === 'front' && a.angle !== 'front') return 1
        
        // Prioritize neutral expression as stable base
        if (a.expression === 'neutral' && b.expression !== 'neutral') return -1
        if (b.expression === 'neutral' && a.expression !== 'neutral') return 1
        
        return 0
      })
      .slice(0, maxReferences)
  }

  /**
   * Generate enhanced character description based on reference analysis
   */
  generateCharacterDescription(references: ReferenceImage[]): string {
    const baseDescription = `
CAPITÃO CAVERNA - EXACT CHARACTER MATCH REQUIRED
Reference-based character consistency: Match the exact appearance from provided reference images.

CRITICAL CHARACTER FEATURES (must match references exactly):
• Species: Anthropomorphic wolf with grey fur coat, cream-colored muzzle and inner ears
• Build: Tall athletic figure, approximately 6 heads in height, lean V-shaped torso
• Eyes: Distinctive crimson/red eyes with thick dark eyebrows
• Hands: Exactly 4 digits per hand (3 fingers + 1 thumb), dark charcoal finger pads
• Stance: Digitigrade (walking on toes), long legs comprising 50% of total height
• Tail: Visible grey tail with warm beige tip

EXACT CLOTHING MATCH:
• Black fitted hoodie with red triangular wolf logo on chest (△ shape with howling wolf silhouette)
• Black sweatpants/joggers
• Asymmetric black and white sneakers
• Logo must be matte red (#FF3333) triangle, 45% of hoodie width

PROPORTIONS (critical for consistency):
• Overall height: 6 heads ± 3%
• Leg length: 50% of total height (heel to hip)
• Knee position: 25% of total height
• Arms reach to mid-thigh when relaxed
• Head size: maximum 1.2× torso width
    `.trim()

    // Add specific reference context
    const referenceContext = references.map(ref => 
      `Reference ${ref.id}: ${ref.description} - ${ref.pose}`
    ).join('\n')

    return `${baseDescription}\n\nREFERENCE CONTEXT:\n${referenceContext}`
  }

  /**
   * Upload reference images to R2 for DALL-E access (if needed)
   */
  async uploadReferenceImages(): Promise<Map<string, string>> {
    const uploadedUrls = new Map<string, string>()
    
    // This would upload reference images to R2 and return public URLs
    // Implementation depends on whether DALL-E needs public URLs for references
    
    for (const ref of this.references) {
      // For now, we'll use local file paths
      // In production, these would be uploaded to R2 and made publicly accessible
      uploadedUrls.set(ref.id, ref.filePath)
    }
    
    return uploadedUrls
  }

  /**
   * Generate character-consistent seed for reproducible results
   */
  generateCharacterSeed(baseContent: string): string {
    // Create a consistent seed based on character name and base content
    const characterBase = 'capitao-caverna-wolf-character'
    const contentHash = baseContent.slice(0, 50) // Use first 50 chars of content
    return `${characterBase}-${contentHash.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`
  }

  /**
   * Get reference image by ID
   */
  getReferenceById(id: string): ReferenceImage | undefined {
    return this.references.find(ref => ref.id === id)
  }

  /**
   * Get all available references
   */
  getAllReferences(): ReferenceImage[] {
    return [...this.references]
  }
}

/**
 * Factory function to create character reference manager
 */
export function createCharacterReferenceManager(env: CloudflareEnv): CharacterReferenceManager {
  return new CharacterReferenceManager(env)
}