// Captain persona error messaging system
import type { ErrorResponse, ToneAnalysis } from '@/types'
import { ErrorType, ErrorSeverity, CaptainError } from './error-handling'

/**
 * Captain persona error messaging system that maintains character consistency
 * while providing contextually appropriate error responses
 */
export class CaptainErrorMessaging {
  private readonly captainPersonaMessages: Record<ErrorType, {
    message: string
    tone: 'firm' | 'supportive' | 'motivational' | 'instructional'
    action: 'retry' | 'wait' | 'continue' | 'contact_support'
    retryMessage?: string
  }> = {
    // User input and validation errors
    [ErrorType.VALIDATION_ERROR]: {
      message: 'Guerreiro, verifique sua mensagem e tente novamente. A disciplina começa com a atenção aos detalhes.',
      tone: 'instructional',
      action: 'retry',
      retryMessage: 'Reformule sua mensagem com mais clareza e precisão.'
    },
    [ErrorType.INVALID_JSON]: {
      message: 'Formato de dados inválido, guerreiro. Reorganize sua abordagem e tente novamente.',
      tone: 'instructional',
      action: 'retry',
      retryMessage: 'Verifique se sua mensagem está formatada corretamente.'
    },
    [ErrorType.MISSING_PARAMETER]: {
      message: 'Informações incompletas, guerreiro. Um verdadeiro guerreiro sempre verifica seus recursos antes da batalha.',
      tone: 'instructional',
      action: 'retry',
      retryMessage: 'Complete as informações necessárias e tente novamente.'
    },
    [ErrorType.RATE_LIMIT_EXCEEDED]: {
      message: 'Muitas tentativas, guerreiro. A paciência é uma virtude fundamental do Cave Mode. Aguarde um momento e retome o treino.',
      tone: 'firm',
      action: 'wait',
      retryMessage: 'Use este tempo para refletir sobre sua próxima ação.'
    },

    // Authentication and authorization errors
    [ErrorType.MISSING_API_KEY]: {
      message: 'Sistema não configurado adequadamente, guerreiro. Entre em contato com o suporte para resolver esta questão.',
      tone: 'supportive',
      action: 'contact_support'
    },
    [ErrorType.INVALID_API_KEY]: {
      message: 'Credenciais inválidas detectadas. Verifique a configuração do sistema ou entre em contato com o suporte.',
      tone: 'instructional',
      action: 'contact_support'
    },
    [ErrorType.UNAUTHORIZED]: {
      message: 'Acesso não autorizado, guerreiro. Verifique suas permissões ou entre em contato com o suporte.',
      tone: 'firm',
      action: 'contact_support'
    },

    // OpenAI API errors
    [ErrorType.OPENAI_API_ERROR]: {
      message: 'Dificuldades técnicas temporárias, guerreiro. A persistência é fundamental - aguarde um momento e tente novamente.',
      tone: 'motivational',
      action: 'retry',
      retryMessage: 'Cada obstáculo é uma oportunidade de fortalecer sua determinação.'
    },
    [ErrorType.OPENAI_RATE_LIMIT]: {
      message: 'Sistema sobrecarregado no momento. Use este tempo para refletir sobre sua próxima ação estratégica.',
      tone: 'instructional',
      action: 'wait',
      retryMessage: 'A disciplina ensina que nem sempre podemos agir imediatamente, mas sempre podemos nos preparar.'
    },
    [ErrorType.OPENAI_QUOTA_EXCEEDED]: {
      message: 'Limite de uso atingido, guerreiro. Mesmo na caverna, os recursos são finitos. Entre em contato com o suporte.',
      tone: 'firm',
      action: 'contact_support'
    },
    [ErrorType.EMBEDDING_GENERATION_FAILED]: {
      message: 'Falha no processamento da consulta. Reformule sua pergunta com mais clareza e tente novamente.',
      tone: 'instructional',
      action: 'retry',
      retryMessage: 'Seja mais específico sobre o que você precisa saber.'
    },
    [ErrorType.CHAT_COMPLETION_FAILED]: {
      message: 'Não consegui processar sua mensagem no momento, guerreiro. A persistência vence os obstáculos - tente novamente.',
      tone: 'motivational',
      action: 'retry',
      retryMessage: 'Cada tentativa te aproxima da solução.'
    },
    [ErrorType.IMAGE_GENERATION_FAILED]: {
      message: 'Falha na geração da minha imagem, guerreiro. Continuemos com o texto - a essência está na mensagem, não na aparência.',
      tone: 'supportive',
      action: 'continue',
      retryMessage: 'Minha orientação permanece firme, independente da visualização.'
    },

    // Cloudflare service errors
    [ErrorType.VECTORIZE_ERROR]: {
      message: 'Sistema de busca temporariamente indisponível. Foque no que você pode controlar agora - suas ações.',
      tone: 'motivational',
      action: 'retry',
      retryMessage: 'Enquanto isso, reflita sobre os princípios fundamentais que já conhece.'
    },
    [ErrorType.VECTORIZE_TIMEOUT]: {
      message: 'Busca demorou mais que o esperado, guerreiro. A paciência é uma virtude do guerreiro disciplinado.',
      tone: 'instructional',
      action: 'retry',
      retryMessage: 'Tente novamente com uma consulta mais específica.'
    },
    [ErrorType.D1_DATABASE_ERROR]: {
      message: 'Problema no armazenamento de dados. Seus progressos reais não se perdem - eles estão nas suas ações diárias.',
      tone: 'supportive',
      action: 'retry',
      retryMessage: 'Continue sua jornada enquanto resolvo esta questão técnica.'
    },
    [ErrorType.R2_STORAGE_ERROR]: {
      message: 'Falha no armazenamento de arquivos. O importante é a ação, não o registro - continue avançando.',
      tone: 'motivational',
      action: 'retry',
      retryMessage: 'Sua disciplina não depende de sistemas externos.'
    },

    // Search and processing errors
    [ErrorType.SEMANTIC_SEARCH_FAILED]: {
      message: 'Sistema de busca indisponível no momento. Mas lembre-se: a verdadeira sabedoria vem da ação consistente.',
      tone: 'motivational',
      action: 'retry',
      retryMessage: 'Use sua experiência interna enquanto resolvo esta questão.'
    },
    [ErrorType.KNOWLEDGE_BASE_UNAVAILABLE]: {
      message: 'Base de conhecimento temporariamente inacessível, guerreiro. Use sua experiência interna e os princípios que já conhece.',
      tone: 'supportive',
      action: 'retry',
      retryMessage: 'A verdadeira força vem de dentro, não de fontes externas.'
    },
    [ErrorType.CONTEXT_PROCESSING_FAILED]: {
      message: 'Dificuldade no processamento da sua consulta. Simplifique sua abordagem e seja mais direto.',
      tone: 'instructional',
      action: 'retry',
      retryMessage: 'Reformule sua pergunta de forma mais clara e objetiva.'
    },

    // Image processing errors
    [ErrorType.IMAGE_DOWNLOAD_FAILED]: {
      message: 'Falha no download da imagem. O foco deve estar na mensagem, não na visualização, guerreiro.',
      tone: 'instructional',
      action: 'continue',
      retryMessage: 'Continue nossa conversa - a orientação é o que importa.'
    },
    [ErrorType.IMAGE_UPLOAD_FAILED]: {
      message: 'Falha no upload da imagem. Tentarei novamente - a persistência é chave para superar obstáculos.',
      tone: 'motivational',
      action: 'retry',
      retryMessage: 'Cada falha é uma oportunidade de aprender e melhorar.'
    },
    [ErrorType.IMAGE_PROCESSING_FAILED]: {
      message: 'Erro no processamento da imagem. Continuemos sem ela - a ação é o que realmente importa.',
      tone: 'supportive',
      action: 'continue',
      retryMessage: 'Sua jornada não depende de elementos visuais.'
    },
    [ErrorType.STORAGE_FAILED]: {
      message: 'Falha no armazenamento, guerreiro. Seus progressos reais estão nas suas ações, não nos registros digitais.',
      tone: 'motivational',
      action: 'retry',
      retryMessage: 'Continue construindo sua disciplina independente de sistemas externos.'
    },
    [ErrorType.METADATA_RETRIEVAL_FAILED]: {
      message: 'Falha na recuperação de informações. Foque no presente e na próxima ação que pode tomar agora.',
      tone: 'instructional',
      action: 'continue',
      retryMessage: 'O passado informa, mas o presente é onde você age.'
    },

    // System errors
    [ErrorType.INTERNAL_ERROR]: {
      message: 'Erro interno do sistema, guerreiro. Mesmo na adversidade, o guerreiro encontra oportunidades de crescimento.',
      tone: 'motivational',
      action: 'retry',
      retryMessage: 'Use este momento para fortalecer sua resiliência.'
    },
    [ErrorType.SERVICE_UNAVAILABLE]: {
      message: 'Serviço temporariamente indisponível. Use este tempo para reflexão e planejamento estratégico.',
      tone: 'instructional',
      action: 'wait',
      retryMessage: 'Prepare-se para retomar com ainda mais determinação.'
    },
    [ErrorType.TIMEOUT_ERROR]: {
      message: 'Operação demorou mais que o esperado. A paciência é fundamental no Cave Mode - aguarde um momento.',
      tone: 'instructional',
      action: 'retry',
      retryMessage: 'Use este tempo para organizar seus pensamentos.'
    },
    [ErrorType.MEMORY_LIMIT_EXCEEDED]: {
      message: 'Sistema sobrecarregado no momento. Simplifique sua abordagem e tente novamente.',
      tone: 'instructional',
      action: 'retry',
      retryMessage: 'Às vezes, menos é mais - seja mais direto.'
    },

    // Data consistency errors
    [ErrorType.DATABASE_CONSTRAINT_VIOLATION]: {
      message: 'Conflito nos dados detectado. Revise suas informações e tente novamente com dados válidos.',
      tone: 'instructional',
      action: 'retry',
      retryMessage: 'A precisão é fundamental para o sucesso.'
    },
    [ErrorType.VECTOR_INDEX_CORRUPTION]: {
      message: 'Sistema de busca corrompido, guerreiro. Entre em contato com o suporte técnico para resolução.',
      tone: 'firm',
      action: 'contact_support'
    },
    [ErrorType.DATA_INTEGRITY_ERROR]: {
      message: 'Inconsistência nos dados detectada. Verificarei a integridade e continuaremos nossa jornada.',
      tone: 'supportive',
      action: 'retry',
      retryMessage: 'Mantenha sua disciplina enquanto resolvo esta questão.'
    }
  }

  /**
   * Get Captain persona error message for specific error type
   */
  getCaptainErrorMessage(errorType: ErrorType, context?: {
    userMessage?: string
    attemptCount?: number
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night'
    userProgress?: 'beginner' | 'intermediate' | 'advanced'
  }): {
    message: string
    tone: string
    action: string
    retryMessage?: string
    motivationalNote?: string
  } {
    const baseMessage = this.captainPersonaMessages[errorType] || this.captainPersonaMessages[ErrorType.INTERNAL_ERROR]
    
    // Add contextual enhancements based on attempt count
    let enhancedMessage = baseMessage.message
    let motivationalNote: string | undefined

    if (context?.attemptCount && context.attemptCount > 1) {
      motivationalNote = this.getRetryMotivationalMessage(context.attemptCount, baseMessage.tone)
    }

    // Add time-based contextual messages
    if (context?.timeOfDay) {
      const timeContext = this.getTimeBasedContext(context.timeOfDay)
      if (timeContext) {
        motivationalNote = motivationalNote ? `${motivationalNote} ${timeContext}` : timeContext
      }
    }

    // Add progress-based encouragement
    if (context?.userProgress) {
      const progressContext = this.getProgressBasedContext(context.userProgress, baseMessage.tone)
      if (progressContext) {
        motivationalNote = motivationalNote ? `${motivationalNote} ${progressContext}` : progressContext
      }
    }

    return {
      message: enhancedMessage,
      tone: baseMessage.tone,
      action: baseMessage.action,
      retryMessage: baseMessage.retryMessage,
      motivationalNote
    }
  }

  /**
   * Get retry motivational message based on attempt count
   */
  private getRetryMotivationalMessage(attemptCount: number, tone: string): string {
    if (attemptCount === 2) {
      switch (tone) {
        case 'firm':
          return 'A persistência é a marca de um verdadeiro guerreiro.'
        case 'supportive':
          return 'Você está no caminho certo - continue tentando.'
        case 'motivational':
          return 'Cada tentativa te fortalece para a próxima.'
        case 'instructional':
          return 'Aprenda com cada tentativa e ajuste sua abordagem.'
        default:
          return 'A disciplina se constrói através da persistência.'
      }
    } else if (attemptCount >= 3) {
      return 'Sua determinação é admirável, guerreiro. Continue firme - a vitória está próxima.'
    }
    
    return ''
  }

  /**
   * Get time-based contextual message
   */
  private getTimeBasedContext(timeOfDay: string): string {
    switch (timeOfDay) {
      case 'morning':
        return 'Use esta manhã para começar com determinação renovada.'
      case 'afternoon':
        return 'Mantenha o foco mesmo no meio do dia.'
      case 'evening':
        return 'Termine este dia com a mesma disciplina que começou.'
      case 'night':
        return 'Mesmo à noite, sua dedicação não passa despercebida.'
      default:
        return ''
    }
  }

  /**
   * Get progress-based contextual message
   */
  private getProgressBasedContext(userProgress: string, tone: string): string {
    switch (userProgress) {
      case 'beginner':
        if (tone === 'firm') {
          return 'Todo guerreiro começou como iniciante - continue aprendendo.'
        }
        return 'Você está no início de uma jornada transformadora.'
      case 'intermediate':
        return 'Seu progresso é visível - mantenha o momentum.'
      case 'advanced':
        return 'Como guerreiro experiente, você sabe que obstáculos fazem parte da jornada.'
      default:
        return ''
    }
  }

  /**
   * Create comprehensive error response with Captain persona
   */
  createCaptainErrorResponse(
    error: CaptainError,
    context?: {
      userMessage?: string
      attemptCount?: number
      timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night'
      userProgress?: 'beginner' | 'intermediate' | 'advanced'
      conversationId?: string
    }
  ): {
    error: {
      code: string
      message: string
      captainResponse: string
      tone: string
      action: string
      retryable: boolean
      timestamp: string
    }
    fallback?: {
      response: string
      imageUrl: string
      retryMessage?: string
      motivationalNote?: string
    }
    recovery?: {
      suggestedActions: string[]
      nextSteps: string[]
      supportContact?: string
    }
  } {
    const captainMessage = this.getCaptainErrorMessage(error.type, context)
    
    const response = {
      error: {
        code: error.type,
        message: error.message,
        captainResponse: captainMessage.message,
        tone: captainMessage.tone,
        action: captainMessage.action,
        retryable: error.retryable,
        timestamp: error.timestamp
      }
    }

    // Add fallback content if error supports it
    if (error.fallbackAvailable) {
      response.fallback = {
        response: captainMessage.message,
        imageUrl: this.getFallbackImageForTone(captainMessage.tone),
        retryMessage: captainMessage.retryMessage,
        motivationalNote: captainMessage.motivationalNote
      }
    }

    // Add recovery guidance
    response.recovery = this.createRecoveryGuidance(error.type, captainMessage.action, context)

    return response
  }

  /**
   * Get fallback image URL based on message tone
   */
  private getFallbackImageForTone(tone: string): string {
    switch (tone) {
      case 'firm':
        return '/placeholder-captain.svg' // Serious, determined Captain
      case 'supportive':
        return '/placeholder-captain.svg' // Encouraging, warm Captain
      case 'motivational':
        return '/placeholder-captain.svg' // Inspiring, energetic Captain
      case 'instructional':
        return '/placeholder-captain.svg' // Teaching, guiding Captain
      default:
        return '/placeholder-captain.svg' // Default Captain image
    }
  }

  /**
   * Create recovery guidance based on error type and action
   */
  private createRecoveryGuidance(
    errorType: ErrorType,
    action: string,
    context?: {
      userMessage?: string
      attemptCount?: number
      conversationId?: string
    }
  ): {
    suggestedActions: string[]
    nextSteps: string[]
    supportContact?: string
  } {
    const guidance = {
      suggestedActions: [] as string[],
      nextSteps: [] as string[],
      supportContact: undefined as string | undefined
    }

    switch (action) {
      case 'retry':
        guidance.suggestedActions = [
          'Aguarde alguns segundos e tente novamente',
          'Verifique sua conexão com a internet',
          'Reformule sua mensagem se necessário'
        ]
        guidance.nextSteps = [
          'Se o problema persistir, aguarde alguns minutos',
          'Tente uma abordagem diferente na sua consulta',
          'Mantenha a disciplina mesmo diante de obstáculos técnicos'
        ]
        break

      case 'wait':
        guidance.suggestedActions = [
          'Aguarde o tempo recomendado antes de tentar novamente',
          'Use este tempo para reflexão e planejamento',
          'Mantenha a paciência - virtude fundamental do guerreiro'
        ]
        guidance.nextSteps = [
          'Retorne quando o sistema estiver disponível',
          'Prepare sua próxima ação enquanto aguarda',
          'Lembre-se: a disciplina não depende de sistemas externos'
        ]
        break

      case 'continue':
        guidance.suggestedActions = [
          'Continue nossa conversa normalmente',
          'Foque na mensagem, não nos elementos visuais',
          'Mantenha o momentum da sua jornada'
        ]
        guidance.nextSteps = [
          'Prossiga com suas perguntas e consultas',
          'Concentre-se no conteúdo e orientações',
          'Sua evolução não depende de imagens ou visualizações'
        ]
        break

      case 'contact_support':
        guidance.suggestedActions = [
          'Entre em contato com o suporte técnico',
          'Forneça detalhes sobre o erro encontrado',
          'Mantenha sua disciplina enquanto aguarda resolução'
        ]
        guidance.nextSteps = [
          'Aguarde orientações da equipe de suporte',
          'Continue praticando os princípios que já conhece',
          'Use este tempo para fortalecer sua determinação'
        ]
        guidance.supportContact = 'Entre em contato através dos canais oficiais de suporte'
        break
    }

    // Add specific guidance for repeated errors
    if (context?.attemptCount && context.attemptCount > 2) {
      guidance.nextSteps.unshift('Considere aguardar mais tempo antes da próxima tentativa')
      guidance.suggestedActions.push('Verifique se há atualizações ou manutenções em andamento')
    }

    return guidance
  }

  /**
   * Get contextual retry message based on error history
   */
  getContextualRetryMessage(
    errorType: ErrorType,
    attemptCount: number,
    lastErrorTime?: Date
  ): string {
    const baseMessage = this.captainPersonaMessages[errorType]
    
    if (attemptCount === 1) {
      return baseMessage.retryMessage || 'Tente novamente, guerreiro.'
    }

    if (attemptCount === 2) {
      return 'Sua persistência é admirável. Aguarde um momento e tente novamente.'
    }

    if (attemptCount >= 3) {
      return 'Guerreiro determinado, sua insistência mostra verdadeira disciplina. Aguarde um pouco mais antes da próxima tentativa.'
    }

    // Check time since last error
    if (lastErrorTime) {
      const timeSinceError = Date.now() - lastErrorTime.getTime()
      if (timeSinceError < 30000) { // Less than 30 seconds
        return 'Aguarde um pouco mais, guerreiro. A paciência fortalece a determinação.'
      }
    }

    return baseMessage.retryMessage || 'Continue tentando com determinação.'
  }

  /**
   * Create network connectivity error message
   */
  createNetworkErrorMessage(isOffline: boolean): {
    message: string
    action: string
    guidance: string[]
  } {
    if (isOffline) {
      return {
        message: 'Guerreiro, você está desconectado da caverna. Verifique sua conexão com a internet.',
        action: 'check_connection',
        guidance: [
          'Verifique sua conexão Wi-Fi ou dados móveis',
          'Tente acessar outros sites para confirmar a conectividade',
          'Aguarde a conexão ser restabelecida',
          'Lembre-se: a disciplina não depende de conectividade'
        ]
      }
    }

    return {
      message: 'Conexão instável detectada, guerreiro. Verifique sua rede e tente novamente.',
      action: 'retry_connection',
      guidance: [
        'Verifique a estabilidade da sua conexão',
        'Tente recarregar a página se necessário',
        'Aguarde alguns segundos antes de tentar novamente',
        'Mantenha a calma - obstáculos técnicos são temporários'
      ]
    }
  }
}

// Export singleton instance
export const captainErrorMessaging = new CaptainErrorMessaging()