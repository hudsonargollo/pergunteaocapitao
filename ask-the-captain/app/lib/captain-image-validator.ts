/**
 * Captain Image Consistency Validation System
 * Ensures all generated images maintain the authentic Capitão Caverna character design
 */

interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  recommendations: string[];
  fallbackImage?: string;
}

interface ValidationIssue {
  type: 'character' | 'brand' | 'quality' | 'context';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
}

interface CaptainCharacterTraits {
  species: 'anthropomorphic wolf';
  style: 'Pixar 3D animation';
  build: 'athletic, 6-head proportions';
  clothing: {
    hoodie: 'black with red triangle logo';
    pants: 'black sweatpants';
    shoes: 'asymmetric sneakers (left red, right black)';
  };
  environment: 'natural cave interior';
}

interface ResponseContext {
  content: string;
  tone: 'supportive' | 'challenging' | 'instructional' | 'motivational' | 'neutral';
  themes: string[];
  intensity: 'low' | 'medium' | 'high';
}

class CaptainImageValidator {
  private characterTraits: CaptainCharacterTraits;
  private fallbackImages: Record<string, string>;
  private validationCache: Map<string, ValidationResult>;
  private cacheExpiry: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.characterTraits = {
      species: 'anthropomorphic wolf',
      style: 'Pixar 3D animation',
      build: 'athletic, 6-head proportions',
      clothing: {
        hoodie: 'black with red triangle logo',
        pants: 'black sweatpants',
        shoes: 'asymmetric sneakers (left red, right black)'
      },
      environment: 'natural cave interior'
    };

    this.fallbackImages = {
      supportive: '/images/captain-supportive-fallback.png',
      challenging: '/images/captain-challenging-fallback.png',
      instructional: '/images/captain-instructional-fallback.png',
      motivational: '/images/captain-motivational-fallback.png',
      default: '/images/captain-default.png',
      error: '/images/captain-error-fallback.png'
    };

    this.validationCache = new Map();
    this.startCacheCleanup();
  }

  /**
   * Validate image consistency with Captain character specifications
   */
  async validateImage(imageUrl: string, context?: ResponseContext): Promise<ValidationResult> {
    // Check cache first
    const cacheKey = this.getCacheKey(imageUrl, context);
    const cached = this.validationCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    try {
      // Perform validation checks
      const result = await this.performValidation(imageUrl, context);
      
      // Cache the result
      this.validationCache.set(cacheKey, {
        ...result,
        timestamp: Date.now()
      } as ValidationResult & { timestamp: number });

      return result;
    } catch (error) {
      console.error('Image validation failed:', error);
      
      // Return fallback validation result
      return {
        isValid: false,
        score: 0,
        issues: [{
          type: 'quality',
          severity: 'high',
          description: 'Failed to validate image',
          suggestion: 'Use fallback image'
        }],
        recommendations: ['Use contextual fallback image'],
        fallbackImage: this.selectFallbackImage(context)
      };
    }
  }

  /**
   * Perform comprehensive image validation
   */
  private async performValidation(imageUrl: string, context?: ResponseContext): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 100;

    // 1. Basic image accessibility check
    const accessibilityCheck = await this.checkImageAccessibility(imageUrl);
    if (!accessibilityCheck.isValid) {
      issues.push({
        type: 'quality',
        severity: 'high',
        description: 'Image is not accessible or failed to load',
        suggestion: 'Use fallback image'
      });
      score -= 50;
    }

    // 2. Character consistency validation (simulated - in real implementation would use AI vision)
    const characterCheck = this.validateCharacterConsistency(imageUrl);
    if (!characterCheck.isValid) {
      issues.push(...characterCheck.issues);
      score -= characterCheck.penalty;
    }

    // 3. Brand element validation
    const brandCheck = this.validateBrandElements(imageUrl);
    if (!brandCheck.isValid) {
      issues.push(...brandCheck.issues);
      score -= brandCheck.penalty;
    }

    // 4. Contextual appropriateness
    if (context) {
      const contextCheck = this.validateContextualAppropriate(imageUrl, context);
      if (!contextCheck.isValid) {
        issues.push(...contextCheck.issues);
        score -= contextCheck.penalty;
      }
    }

    // 5. Image quality assessment
    const qualityCheck = await this.assessImageQuality(imageUrl);
    if (!qualityCheck.isValid) {
      issues.push(...qualityCheck.issues);
      score -= qualityCheck.penalty;
    }

    const finalScore = Math.max(0, Math.min(100, score));
    const isValid = finalScore >= 70 && !issues.some(issue => issue.severity === 'high');

    return {
      isValid,
      score: finalScore,
      issues,
      recommendations: this.generateRecommendations(issues, context),
      fallbackImage: !isValid ? this.selectFallbackImage(context) : undefined
    };
  }

  /**
   * Check if image is accessible and loads properly
   */
  private async checkImageAccessibility(imageUrl: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Create a promise that resolves when image loads or rejects on error
      const imageLoadPromise = new Promise<boolean>((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
          // Check minimum dimensions
          if (img.naturalWidth < 100 || img.naturalHeight < 100) {
            reject(new Error('Image dimensions too small'));
          } else {
            resolve(true);
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        // Set timeout for loading
        setTimeout(() => {
          reject(new Error('Image load timeout'));
        }, 10000);
        
        img.src = imageUrl;
      });

      await imageLoadPromise;
      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Validate character consistency (simulated - would use AI vision in production)
   */
  private validateCharacterConsistency(imageUrl: string): { isValid: boolean; issues: ValidationIssue[]; penalty: number } {
    const issues: ValidationIssue[] = [];
    let penalty = 0;

    // Simulated character validation based on URL patterns or metadata
    // In a real implementation, this would use computer vision AI
    
    // Check for common character inconsistencies based on filename/URL patterns
    const urlLower = imageUrl.toLowerCase();
    
    // Check for wrong species indicators
    if (urlLower.includes('human') || urlLower.includes('person') || urlLower.includes('man')) {
      issues.push({
        type: 'character',
        severity: 'high',
        description: 'Image appears to show human character instead of anthropomorphic wolf',
        suggestion: 'Regenerate with proper species specification'
      });
      penalty += 40;
    }

    // Check for wrong style indicators
    if (urlLower.includes('realistic') || urlLower.includes('photo')) {
      issues.push({
        type: 'character',
        severity: 'medium',
        description: 'Image style appears too realistic, should be Pixar 3D animation style',
        suggestion: 'Ensure 3D cartoon animation style in generation'
      });
      penalty += 20;
    }

    // Check for clothing inconsistencies
    if (urlLower.includes('shirt') || urlLower.includes('jacket') || urlLower.includes('suit')) {
      issues.push({
        type: 'brand',
        severity: 'medium',
        description: 'Character clothing may not match brand specifications',
        suggestion: 'Ensure black hoodie with red triangle logo'
      });
      penalty += 15;
    }

    return {
      isValid: issues.length === 0 || !issues.some(issue => issue.severity === 'high'),
      issues,
      penalty
    };
  }

  /**
   * Validate brand elements presence
   */
  private validateBrandElements(imageUrl: string): { isValid: boolean; issues: ValidationIssue[]; penalty: number } {
    const issues: ValidationIssue[] = [];
    let penalty = 0;

    // Simulated brand validation
    const urlLower = imageUrl.toLowerCase();

    // Check for brand color consistency
    if (urlLower.includes('blue') || urlLower.includes('green') || urlLower.includes('yellow')) {
      issues.push({
        type: 'brand',
        severity: 'medium',
        description: 'Image may contain off-brand colors',
        suggestion: 'Ensure cave-themed color palette (dark, red, amber)'
      });
      penalty += 10;
    }

    // Check for logo presence indicators
    if (urlLower.includes('no-logo') || urlLower.includes('plain')) {
      issues.push({
        type: 'brand',
        severity: 'low',
        description: 'Brand logo may not be visible',
        suggestion: 'Ensure red triangle logo is visible on hoodie'
      });
      penalty += 5;
    }

    return {
      isValid: penalty < 20,
      issues,
      penalty
    };
  }

  /**
   * Validate contextual appropriateness
   */
  private validateContextualAppropriate(imageUrl: string, context: ResponseContext): { isValid: boolean; issues: ValidationIssue[]; penalty: number } {
    const issues: ValidationIssue[] = [];
    let penalty = 0;

    const urlLower = imageUrl.toLowerCase();

    // Check pose/expression appropriateness
    switch (context.tone) {
      case 'supportive':
        if (urlLower.includes('angry') || urlLower.includes('stern') || urlLower.includes('frowning')) {
          issues.push({
            type: 'context',
            severity: 'medium',
            description: 'Image expression does not match supportive tone',
            suggestion: 'Use warm, encouraging expression'
          });
          penalty += 15;
        }
        break;

      case 'challenging':
        if (urlLower.includes('smiling') || urlLower.includes('happy') || urlLower.includes('relaxed')) {
          issues.push({
            type: 'context',
            severity: 'medium',
            description: 'Image expression too soft for challenging tone',
            suggestion: 'Use more intense, focused expression'
          });
          penalty += 15;
        }
        break;

      case 'instructional':
        if (urlLower.includes('casual') || urlLower.includes('relaxed')) {
          issues.push({
            type: 'context',
            severity: 'low',
            description: 'Image pose may be too casual for instructional content',
            suggestion: 'Use more formal, teaching-oriented pose'
          });
          penalty += 10;
        }
        break;

      case 'motivational':
        if (urlLower.includes('sad') || urlLower.includes('tired') || urlLower.includes('defeated')) {
          issues.push({
            type: 'context',
            severity: 'high',
            description: 'Image expression contradicts motivational message',
            suggestion: 'Use inspiring, energetic expression'
          });
          penalty += 25;
        }
        break;
    }

    return {
      isValid: penalty < 20,
      issues,
      penalty
    };
  }

  /**
   * Assess overall image quality
   */
  private async assessImageQuality(imageUrl: string): Promise<{ isValid: boolean; issues: ValidationIssue[]; penalty: number }> {
    const issues: ValidationIssue[] = [];
    let penalty = 0;

    try {
      // Basic quality checks that can be done client-side
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Check resolution
      if (img.naturalWidth < 512 || img.naturalHeight < 512) {
        issues.push({
          type: 'quality',
          severity: 'medium',
          description: 'Image resolution is below recommended minimum',
          suggestion: 'Generate higher resolution image (min 512x512)'
        });
        penalty += 15;
      }

      // Check aspect ratio (should be roughly square for profile images)
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      if (aspectRatio < 0.8 || aspectRatio > 1.2) {
        issues.push({
          type: 'quality',
          severity: 'low',
          description: 'Image aspect ratio is not optimal for display',
          suggestion: 'Use square or near-square aspect ratio'
        });
        penalty += 5;
      }

    } catch (error) {
      issues.push({
        type: 'quality',
        severity: 'high',
        description: 'Failed to assess image quality',
        suggestion: 'Use fallback image'
      });
      penalty += 30;
    }

    return {
      isValid: penalty < 25,
      issues,
      penalty
    };
  }

  /**
   * Generate recommendations based on validation issues
   */
  private generateRecommendations(issues: ValidationIssue[], context?: ResponseContext): string[] {
    const recommendations: string[] = [];

    // Group issues by type
    const issuesByType = issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, ValidationIssue[]>);

    // Generate type-specific recommendations
    if (issuesByType.character) {
      recommendations.push('Regenerate image with proper Capitão Caverna character specifications');
      recommendations.push('Ensure anthropomorphic wolf species with athletic build');
    }

    if (issuesByType.brand) {
      recommendations.push('Verify brand elements: black hoodie with red triangle logo');
      recommendations.push('Use cave-themed color palette (dark backgrounds, red/amber accents)');
    }

    if (issuesByType.context && context) {
      recommendations.push(`Adjust pose/expression to match ${context.tone} tone`);
      recommendations.push('Consider contextual variation in image generation prompt');
    }

    if (issuesByType.quality) {
      recommendations.push('Improve image quality and resolution');
      recommendations.push('Ensure proper aspect ratio for display');
    }

    // Add fallback recommendation if issues are severe
    const hasHighSeverityIssues = issues.some(issue => issue.severity === 'high');
    if (hasHighSeverityIssues) {
      recommendations.push('Consider using contextual fallback image');
    }

    return recommendations;
  }

  /**
   * Select appropriate fallback image based on context
   */
  selectFallbackImage(context?: ResponseContext): string {
    if (!context) {
      return this.fallbackImages.default;
    }

    // Select based on tone
    switch (context.tone) {
      case 'supportive':
        return this.fallbackImages.supportive;
      case 'challenging':
        return this.fallbackImages.challenging;
      case 'instructional':
        return this.fallbackImages.instructional;
      case 'motivational':
        return this.fallbackImages.motivational;
      default:
        return this.fallbackImages.default;
    }
  }

  /**
   * Get cache key for validation result
   */
  private getCacheKey(imageUrl: string, context?: ResponseContext): string {
    const contextKey = context ? `${context.tone}-${context.intensity}` : 'no-context';
    return `${imageUrl}-${contextKey}`;
  }

  /**
   * Check if cached result is still valid
   */
  private isCacheValid(result: ValidationResult & { timestamp?: number }): boolean {
    if (!result.timestamp) return false;
    return Date.now() - result.timestamp < this.cacheExpiry;
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, result] of this.validationCache.entries()) {
        if ('timestamp' in result && now - (result as any).timestamp > this.cacheExpiry) {
          this.validationCache.delete(key);
        }
      }
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    cacheSize: number;
    totalValidations: number;
    averageScore: number;
  } {
    const results = Array.from(this.validationCache.values());
    const totalValidations = results.length;
    const averageScore = totalValidations > 0 
      ? results.reduce((sum, result) => sum + result.score, 0) / totalValidations 
      : 0;

    return {
      cacheSize: this.validationCache.size,
      totalValidations,
      averageScore: Math.round(averageScore)
    };
  }
}

// Create singleton instance
export const captainImageValidator = new CaptainImageValidator();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    captainImageValidator.clearCache();
  });
}

/**
 * Hook for using image validation in React components
 */
export function useCaptainImageValidator() {
  return {
    validateImage: (imageUrl: string, context?: ResponseContext) => 
      captainImageValidator.validateImage(imageUrl, context),
    selectFallbackImage: (context?: ResponseContext) => 
      captainImageValidator.selectFallbackImage(context),
    getValidationStats: () => captainImageValidator.getValidationStats(),
    clearCache: () => captainImageValidator.clearCache()
  };
}

export type { ValidationResult, ValidationIssue, ResponseContext, CaptainCharacterTraits };