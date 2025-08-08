'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThumbsUp, ThumbsDown, Edit3, Send, X } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { CaveButton } from '@/app/components/ui/cave-button'

interface TrainingFeedbackProps {
  messageId: string
  userMessage: string
  captainResponse: string
  onFeedbackSent?: (feedback: any) => void
  className?: string
}

export function TrainingFeedback({ 
  messageId, 
  userMessage, 
  captainResponse, 
  onFeedbackSent,
  className 
}: TrainingFeedbackProps) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackType, setFeedbackType] = useState<'good' | 'bad' | 'correction' | null>(null)
  const [correction, setCorrection] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleFeedback = async (type: 'good' | 'bad' | 'correction') => {
    if (type === 'good') {
      // Quick positive feedback
      await submitFeedback('good')
    } else {
      setFeedbackType(type)
      setShowFeedback(true)
    }
  }

  const submitFeedback = async (type: 'good' | 'bad' | 'correction') => {
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messageId,
          userMessage,
          captainResponse,
          feedback: type,
          correction: type === 'correction' ? correction : undefined,
          reason: reason || undefined
        })
      })

      if (response.ok) {
        setSubmitted(true)
        setShowFeedback(false)
        onFeedbackSent?.({ type, correction, reason })
        
        // Show success message
        window.dispatchEvent(new CustomEvent('show-feedback', {
          detail: { 
            type: 'success', 
            message: 'Feedback enviado! O Capitão aprenderá com isso.', 
            duration: 3000 
          }
        }))
      } else {
        throw new Error('Falha ao enviar feedback')
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      window.dispatchEvent(new CustomEvent('show-feedback', {
        detail: { 
          type: 'error', 
          message: 'Erro ao enviar feedback. Tente novamente.', 
          duration: 3000 
        }
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitCorrection = () => {
    if (!correction.trim()) return
    submitFeedback('correction')
  }

  if (submitted) {
    return (
      <div className={cn("flex items-center gap-2 text-cave-mist/70 text-sm", className)}>
        <ThumbsUp className="w-4 h-4 text-cave-green" />
        <span>Feedback enviado!</span>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Feedback Buttons */}
      <div className="flex items-center gap-2">
        <span className="text-cave-mist/70 text-sm">Esta resposta foi útil?</span>
        
        <CaveButton
          variant="ghost"
          size="sm"
          onClick={() => handleFeedback('good')}
          disabled={isSubmitting}
          className="p-1 h-8 w-8"
          aria-label="Resposta boa"
        >
          <ThumbsUp className="w-4 h-4" />
        </CaveButton>
        
        <CaveButton
          variant="ghost"
          size="sm"
          onClick={() => handleFeedback('bad')}
          disabled={isSubmitting}
          className="p-1 h-8 w-8"
          aria-label="Resposta ruim"
        >
          <ThumbsDown className="w-4 h-4" />
        </CaveButton>
        
        <CaveButton
          variant="ghost"
          size="sm"
          onClick={() => handleFeedback('correction')}
          disabled={isSubmitting}
          className="p-1 h-8 w-8"
          aria-label="Corrigir resposta"
        >
          <Edit3 className="w-4 h-4" />
        </CaveButton>
      </div>

      {/* Feedback Form */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="cave-glass rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-cave-white font-medium">
                {feedbackType === 'correction' ? 'Como o Capitão deveria responder?' : 'O que estava errado?'}
              </h4>
              <CaveButton
                variant="ghost"
                size="sm"
                onClick={() => setShowFeedback(false)}
                className="p-1 h-6 w-6"
              >
                <X className="w-4 h-4" />
              </CaveButton>
            </div>

            {feedbackType === 'correction' && (
              <div className="space-y-2">
                <label className="text-cave-mist text-sm">Resposta corrigida:</label>
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="Como o Capitão deveria ter respondido..."
                  className="w-full p-3 rounded-lg bg-cave-charcoal/20 border border-cave-stone/20 text-cave-white placeholder-cave-mist/50 focus:border-cave-red/50 focus:outline-none resize-none"
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-cave-mist text-sm">
                {feedbackType === 'correction' ? 'Por que esta resposta é melhor?' : 'Qual foi o problema?'}
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={feedbackType === 'correction' ? 'Mais direto, menos verboso...' : 'Muito longo, informação incorreta...'}
                className="w-full p-3 rounded-lg bg-cave-charcoal/20 border border-cave-stone/20 text-cave-white placeholder-cave-mist/50 focus:border-cave-red/50 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <CaveButton
                onClick={feedbackType === 'correction' ? handleSubmitCorrection : () => submitFeedback('bad')}
                disabled={isSubmitting || (feedbackType === 'correction' && !correction.trim())}
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Enviando...' : 'Enviar Feedback'}
              </CaveButton>
              
              <CaveButton
                variant="ghost"
                onClick={() => setShowFeedback(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </CaveButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}