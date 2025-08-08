// WhatsApp support conversation analysis processor
import csv from 'csv-parser'
import { createReadStream } from 'fs'
import type { DocumentChunk } from '@/types'

// CSV row structure based on the actual data
interface WhatsAppCSVRow {
  id: string
  pergunta: string
  resposta: string
  categoria: string
  categoria_id: string
  produto: string
  contato: string
  timestamp_pergunta: string
  timestamp_resposta: string
  arquivo_origem: string
  contexto: string
}

// Processed WhatsApp insight
export interface WhatsAppInsight {
  id: string
  question: string
  response: string
  category: string
  categoryId: string
  product: string
  contact: string
  questionTimestamp: Date
  responseTimestamp: Date
  sourceFile: string
  context: string
  sentiment: 'positive' | 'neutral' | 'negative'
  resolutionSuccess: boolean
  supportTopic: string
  responseQuality: number
}

// Enhanced document chunk with WhatsApp metadata
export interface WhatsAppDocumentChunk extends DocumentChunk {
  metadata: DocumentChunk['metadata'] & {
    documentType: 'whatsapp'
    processingDate: Date
    qualityScore: number
    whatsappData: {
      conversationId: string
      supportTopic: string
      userQuestion: string
      effectiveResponse: string
      sentiment: string
      resolutionSuccess: boolean
      category: string
      product: string
      responseTime: number // minutes between question and response
    }
  }
}

export class WhatsAppAnalysisProcessor {
  
  /**
   * Process WhatsApp CSV file and extract conversation insights
   */
  async processWhatsAppCSV(filePath: string): Promise<WhatsAppInsight[]> {
    return new Promise((resolve, reject) => {
      const insights: WhatsAppInsight[] = []
      
      createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: WhatsAppCSVRow) => {
          try {
            const insight = this.parseCSVRow(row)
            if (this.isValidInsight(insight)) {
              insights.push(insight)
            }
          } catch (error) {
            console.warn(`Warning: Failed to parse row ${row.id}: ${error}`)
          }
        })
        .on('end', () => {
          console.log(`✅ Processed ${insights.length} WhatsApp conversation insights`)
          resolve(insights)
        })
        .on('error', (error) => {
          console.error(`❌ Error reading WhatsApp CSV: ${error}`)
          reject(error)
        })
    })
  }

  /**
   * Convert WhatsApp insights to document chunks
   */
  convertInsightsToChunks(insights: WhatsAppInsight[]): WhatsAppDocumentChunk[] {
    return insights.map((insight, index) => {
      const content = this.createChunkContent(insight)
      const qualityScore = this.calculateResponseQuality(insight)
      
      return {
        id: `whatsapp_${insight.id}`,
        content,
        source: 'whatsapp_support_analysis',
        metadata: {
          title: `Suporte: ${insight.supportTopic}`,
          section: `conversation_${insight.id}`,
          documentType: 'whatsapp',
          processingDate: new Date(),
          qualityScore,
          whatsappData: {
            conversationId: insight.id,
            supportTopic: insight.supportTopic,
            userQuestion: insight.question,
            effectiveResponse: insight.response,
            sentiment: insight.sentiment,
            resolutionSuccess: insight.resolutionSuccess,
            category: insight.category,
            product: insight.product,
            responseTime: this.calculateResponseTime(insight.questionTimestamp, insight.responseTimestamp)
          }
        }
      }
    })
  }

  /**
   * Extract support topics and categorize conversations
   */
  extractSupportTopics(insights: WhatsAppInsight[]): Record<string, WhatsAppInsight[]> {
    const topics: Record<string, WhatsAppInsight[]> = {}
    
    insights.forEach(insight => {
      const topic = insight.supportTopic
      if (!topics[topic]) {
        topics[topic] = []
      }
      topics[topic].push(insight)
    })
    
    return topics
  }

  /**
   * Identify most effective responses by category
   */
  identifyEffectiveResponses(insights: WhatsAppInsight[]): Record<string, WhatsAppInsight[]> {
    const effectiveByCategory: Record<string, WhatsAppInsight[]> = {}
    
    // Group by category
    const byCategory = insights.reduce((acc, insight) => {
      if (!acc[insight.category]) {
        acc[insight.category] = []
      }
      acc[insight.category].push(insight)
      return acc
    }, {} as Record<string, WhatsAppInsight[]>)
    
    // Find most effective responses in each category
    Object.entries(byCategory).forEach(([category, categoryInsights]) => {
      const effective = categoryInsights
        .filter(insight => insight.resolutionSuccess && insight.responseQuality > 0.7)
        .sort((a, b) => b.responseQuality - a.responseQuality)
        .slice(0, 5) // Top 5 most effective responses per category
      
      if (effective.length > 0) {
        effectiveByCategory[category] = effective
      }
    })
    
    return effectiveByCategory
  }

  /**
   * Perform sentiment analysis on conversations
   */
  analyzeSentiment(insights: WhatsAppInsight[]): Record<string, number> {
    const sentimentCounts = insights.reduce((acc, insight) => {
      acc[insight.sentiment] = (acc[insight.sentiment] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const total = insights.length
    return {
      positive: Math.round((sentimentCounts.positive || 0) / total * 100),
      neutral: Math.round((sentimentCounts.neutral || 0) / total * 100),
      negative: Math.round((sentimentCounts.negative || 0) / total * 100)
    }
  }

  /**
   * Parse CSV row into WhatsApp insight
   */
  private parseCSVRow(row: WhatsAppCSVRow): WhatsAppInsight {
    const questionTimestamp = this.parseTimestamp(row.timestamp_pergunta)
    const responseTimestamp = this.parseTimestamp(row.timestamp_resposta)
    
    return {
      id: row.id,
      question: row.pergunta.trim(),
      response: row.resposta.trim(),
      category: row.categoria,
      categoryId: row.categoria_id,
      product: row.produto,
      contact: row.contato,
      questionTimestamp,
      responseTimestamp,
      sourceFile: row.arquivo_origem,
      context: row.contexto,
      sentiment: this.detectSentiment(row.pergunta, row.resposta),
      resolutionSuccess: this.assessResolutionSuccess(row.resposta),
      supportTopic: this.extractSupportTopic(row.categoria, row.pergunta),
      responseQuality: this.calculateResponseQuality({
        question: row.pergunta,
        response: row.resposta,
        category: row.categoria
      } as any)
    }
  }

  /**
   * Parse timestamp string to Date
   */
  private parseTimestamp(timestampStr: string): Date {
    // Format: "2025/03/11 11:05:03"
    const [datePart, timePart] = timestampStr.split(' ')
    const [year, month, day] = datePart.split('/').map(Number)
    const [hour, minute, second] = timePart.split(':').map(Number)
    
    return new Date(year, month - 1, day, hour, minute, second)
  }

  /**
   * Detect sentiment from question and response
   */
  private detectSentiment(question: string, response: string): 'positive' | 'neutral' | 'negative' {
    const lowerQuestion = question.toLowerCase()
    const lowerResponse = response.toLowerCase()
    
    // Negative indicators in question
    const negativeWords = ['cancelar', 'estorno', 'reembolso', 'problema', 'não funciona', 'erro', 'reclamação']
    const hasNegativeWords = negativeWords.some(word => lowerQuestion.includes(word))
    
    // Positive indicators in response
    const positiveWords = ['obrigado', 'perfeito', 'entendi', 'vamos resolver', 'ajudar', '✅']
    const hasPositiveResponse = positiveWords.some(word => lowerResponse.includes(word))
    
    if (hasNegativeWords && !hasPositiveResponse) return 'negative'
    if (hasPositiveResponse) return 'positive'
    return 'neutral'
  }

  /**
   * Assess if the response successfully resolved the issue
   */
  private assessResolutionSuccess(response: string): boolean {
    const lowerResponse = response.toLowerCase()
    
    // Success indicators
    const successIndicators = [
      'resolvido', 'solucionado', 'link abaixo', 'acesse', 'clique',
      'verificar', 'confirmar', 'entendi perfeitamente', '✅'
    ]
    
    // Failure indicators
    const failureIndicators = [
      'não posso', 'impossível', 'não temos', 'infelizmente'
    ]
    
    const hasSuccessIndicators = successIndicators.some(indicator => 
      lowerResponse.includes(indicator)
    )
    const hasFailureIndicators = failureIndicators.some(indicator => 
      lowerResponse.includes(indicator)
    )
    
    return hasSuccessIndicators && !hasFailureIndicators
  }

  /**
   * Extract support topic from category and question
   */
  private extractSupportTopic(category: string, question: string): string {
    const lowerQuestion = question.toLowerCase()
    
    // Map categories to topics
    const categoryTopicMap: Record<string, string> = {
      'Problemas de Login e Acesso': 'acesso-login',
      'Cancelamentos e Reembolsos': 'cancelamento-reembolso',
      'Problemas com Conteúdo': 'conteudo-qualidade',
      'Problemas de Pagamento': 'pagamento-cobranca',
      'Questões Gerais': 'suporte-geral'
    }
    
    // Check for specific topics in question
    if (lowerQuestion.includes('acesso') || lowerQuestion.includes('login')) {
      return 'acesso-login'
    }
    if (lowerQuestion.includes('cancelar') || lowerQuestion.includes('estorno')) {
      return 'cancelamento-reembolso'
    }
    if (lowerQuestion.includes('pagamento') || lowerQuestion.includes('cobrança')) {
      return 'pagamento-cobranca'
    }
    if (lowerQuestion.includes('conteúdo') || lowerQuestion.includes('material')) {
      return 'conteudo-qualidade'
    }
    
    return categoryTopicMap[category] || 'suporte-geral'
  }

  /**
   * Calculate response quality score
   */
  private calculateResponseQuality(insight: { question: string; response: string; category: string }): number {
    let score = 0.5 // Base score
    
    const response = insight.response.toLowerCase()
    const question = insight.question.toLowerCase()
    
    // Length appropriateness
    if (insight.response.length > 20 && insight.response.length < 500) {
      score += 0.2
    }
    
    // Helpfulness indicators
    const helpfulWords = ['link', 'acesse', 'clique', 'verificar', 'entendi', 'vamos', 'ajudar']
    const helpfulCount = helpfulWords.filter(word => response.includes(word)).length
    score += Math.min(helpfulCount * 0.1, 0.3)
    
    // Professional tone
    if (response.includes('✅') || response.includes('perfeitamente')) {
      score += 0.1
    }
    
    // Specific solutions
    if (response.includes('http') || response.includes('clique no link')) {
      score += 0.2
    }
    
    // Question relevance
    if (question.includes('acesso') && response.includes('acesso')) {
      score += 0.1
    }
    if (question.includes('cancelar') && response.includes('reembolso')) {
      score += 0.1
    }
    
    return Math.max(0, Math.min(1, score))
  }

  /**
   * Calculate response time in minutes
   */
  private calculateResponseTime(questionTime: Date, responseTime: Date): number {
    const diffMs = responseTime.getTime() - questionTime.getTime()
    return Math.round(diffMs / (1000 * 60)) // Convert to minutes
  }

  /**
   * Create chunk content from insight
   */
  private createChunkContent(insight: WhatsAppInsight): string {
    return `**Categoria:** ${insight.category}
**Produto:** ${insight.product}
**Tópico de Suporte:** ${insight.supportTopic}

**Pergunta do Cliente:**
${insight.question}

**Resposta Efetiva:**
${insight.response}

**Contexto:**
- Sentimento: ${insight.sentiment}
- Resolução bem-sucedida: ${insight.resolutionSuccess ? 'Sim' : 'Não'}
- Qualidade da resposta: ${Math.round(insight.responseQuality * 100)}%
- Tempo de resposta: ${this.calculateResponseTime(insight.questionTimestamp, insight.responseTimestamp)} minutos

**Insights para o Capitão:**
Esta conversa demonstra ${insight.resolutionSuccess ? 'uma abordagem efetiva' : 'uma oportunidade de melhoria'} para lidar com questões de ${insight.supportTopic}. ${insight.responseQuality > 0.7 ? 'A resposta foi clara e direcionada.' : 'A resposta poderia ser mais específica e útil.'}`
  }

  /**
   * Validate if insight is worth including
   */
  private isValidInsight(insight: WhatsAppInsight): boolean {
    return (
      insight.question.length > 10 &&
      insight.response.length > 10 &&
      insight.question !== insight.response &&
      !insight.question.toLowerCase().includes('teste') &&
      !insight.response.toLowerCase().includes('teste')
    )
  }
}

// Export utility functions
export async function processWhatsAppAnalysis(filePath: string): Promise<WhatsAppDocumentChunk[]> {
  const processor = new WhatsAppAnalysisProcessor()
  
  try {
    const insights = await processor.processWhatsAppCSV(filePath)
    const chunks = processor.convertInsightsToChunks(insights)
    
    console.log(`📊 WhatsApp Analysis Summary:`)
    console.log(`   - Total conversations: ${insights.length}`)
    console.log(`   - Document chunks created: ${chunks.length}`)
    
    // Print category breakdown
    const categories = insights.reduce((acc, insight) => {
      acc[insight.category] = (acc[insight.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log(`   - Categories:`)
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`     • ${category}: ${count} conversations`)
    })
    
    // Print sentiment analysis
    const sentimentAnalysis = processor.analyzeSentiment(insights)
    console.log(`   - Sentiment distribution:`)
    Object.entries(sentimentAnalysis).forEach(([sentiment, percentage]) => {
      console.log(`     • ${sentiment}: ${percentage}%`)
    })
    
    return chunks
    
  } catch (error) {
    console.error(`❌ Failed to process WhatsApp analysis: ${error}`)
    return []
  }
}

