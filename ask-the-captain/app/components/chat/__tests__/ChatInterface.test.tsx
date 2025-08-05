/**
 * Chat Interface Component Tests
 * 
 * Comprehensive tests for the main chat interface components including:
 * - Message rendering and interaction
 * - User input handling
 * - Loading states and error handling
 * - Accessibility features
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInterface } from '../ChatInterface'
import { ChatMessage } from '../ChatMessage'
import { MessageList } from '../MessageList'
import { WelcomeMessage } from '../WelcomeMessage'
import type { ChatMessage as ChatMessageType } from '@/types'

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />
}))

// Mock the hooks
const mockSendMessage = vi.fn()
const mockClearError = vi.fn()

const mockUseApiClient = {
  sendMessage: mockSendMessage,
  isLoading: false,
  error: null,
  clearError: mockClearError
}

const mockUseConversation = {
  messages: [],
  addMessage: vi.fn(),
  isWaitingForResponse: false,
  conversationId: 'test-conversation-123'
}

const mockUseCaptainImages = {
  currentImage: '/placeholder-captain.svg',
  isGenerating: false,
  updateImage: vi.fn()
}

vi.mock('@/app/hooks/useApiClient', () => ({
  useApiClient: () => mockUseApiClient
}))

vi.mock('@/app/hooks/useConversation', () => ({
  useConversation: () => mockUseConversation
}))

vi.mock('@/app/hooks/useCaptainImages', () => ({
  useCaptainImages: () => mockUseCaptainImages
}))

describe('ChatInterface', () => {
  const defaultProps = {
    messages: [],
    onSendMessage: vi.fn(),
    isLoading: false,
    captainImage: '/placeholder-captain.svg'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the chat interface with all main elements', () => {
      render(<ChatInterface {...defaultProps} />)

      // Check for main structural elements
      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument()
    })

    it('should display the captain image', () => {
      render(<ChatInterface {...defaultProps} />)

      const captainImage = screen.getByAltText(/capitão caverna/i)
      expect(captainImage).toBeInTheDocument()
      expect(captainImage).toHaveAttribute('src', '/placeholder-captain.svg')
    })

    it('should show welcome message when no messages exist', () => {
      render(<ChatInterface {...defaultProps} />)

      expect(screen.getByText(/bem-vindo/i)).toBeInTheDocument()
      expect(screen.getByText(/propósito.*foco.*progresso/i)).toBeInTheDocument()
    })

    it('should render messages when they exist', () => {
      const messages: ChatMessageType[] = [
        {
          id: '1',
          content: 'Como posso melhorar minha disciplina?',
          role: 'user',
          timestamp: new Date()
        },
        {
          id: '2',
          content: 'Guerreiro, você deve criar um protocolo de disciplina diário!',
          role: 'assistant',
          timestamp: new Date(),
          imageUrl: '/captain-response.png'
        }
      ]

      render(<ChatInterface {...defaultProps} messages={messages} />)

      expect(screen.getByText('Como posso melhorar minha disciplina?')).toBeInTheDocument()
      expect(screen.getByText(/guerreiro.*protocolo.*disciplina/i)).toBeInTheDocument()
    })
  })

  describe('User Interaction', () => {
    it('should handle message input and submission', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()

      render(<ChatInterface {...defaultProps} onSendMessage={onSendMessage} />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      await user.type(input, 'Como desenvolver mais foco?')
      await user.click(sendButton)

      expect(onSendMessage).toHaveBeenCalledWith('Como desenvolver mais foco?')
    })

    it('should handle Enter key submission', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()

      render(<ChatInterface {...defaultProps} onSendMessage={onSendMessage} />)

      const input = screen.getByRole('textbox')

      await user.type(input, 'Teste de mensagem')
      await user.keyboard('{Enter}')

      expect(onSendMessage).toHaveBeenCalledWith('Teste de mensagem')
    })

    it('should not submit empty messages', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()

      render(<ChatInterface {...defaultProps} onSendMessage={onSendMessage} />)

      const sendButton = screen.getByRole('button', { name: /enviar/i })

      await user.click(sendButton)

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('should clear input after successful submission', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()

      render(<ChatInterface {...defaultProps} onSendMessage={onSendMessage} />)

      const input = screen.getByRole('textbox') as HTMLInputElement

      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      expect(input.value).toBe('')
    })

    it('should disable input and button when loading', () => {
      render(<ChatInterface {...defaultProps} isLoading={true} />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      expect(input).toBeDisabled()
      expect(sendButton).toBeDisabled()
    })
  })

  describe('Loading States', () => {
    it('should show loading indicator when processing', () => {
      render(<ChatInterface {...defaultProps} isLoading={true} />)

      expect(screen.getByText(/processando/i)).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('should show typing indicator when waiting for response', () => {
      mockUseConversation.isWaitingForResponse = true

      render(<ChatInterface {...defaultProps} />)

      expect(screen.getByText(/capitão está pensando/i)).toBeInTheDocument()
    })

    it('should show image generation status', () => {
      mockUseCaptainImages.isGenerating = true

      render(<ChatInterface {...defaultProps} />)

      expect(screen.getByText(/gerando imagem/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error messages', () => {
      mockUseApiClient.error = {
        message: 'Falha na conexão com o servidor',
        code: 'CONNECTION_ERROR'
      }

      render(<ChatInterface {...defaultProps} />)

      expect(screen.getByText(/falha na conexão/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
    })

    it('should handle retry functionality', async () => {
      const user = userEvent.setup()
      mockUseApiClient.error = {
        message: 'Erro temporário',
        code: 'TEMPORARY_ERROR'
      }

      render(<ChatInterface {...defaultProps} />)

      const retryButton = screen.getByRole('button', { name: /tentar novamente/i })
      await user.click(retryButton)

      expect(mockClearError).toHaveBeenCalled()
    })

    it('should show fallback when captain image fails to load', () => {
      render(<ChatInterface {...defaultProps} captainImage="" />)

      const fallbackImage = screen.getByAltText(/capitão caverna/i)
      expect(fallbackImage).toHaveAttribute('src', '/placeholder-captain.svg')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ChatInterface {...defaultProps} />)

      expect(screen.getByLabelText(/digite sua pergunta/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/enviar mensagem/i)).toBeInTheDocument()
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', expect.stringContaining('chat'))
    })

    it('should have proper heading structure', () => {
      render(<ChatInterface {...defaultProps} />)

      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveTextContent(/capitão caverna/i)
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ChatInterface {...defaultProps} />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      // Tab navigation
      await user.tab()
      expect(input).toHaveFocus()

      await user.tab()
      expect(sendButton).toHaveFocus()
    })

    it('should announce loading states to screen readers', () => {
      render(<ChatInterface {...defaultProps} isLoading={true} />)

      const loadingStatus = screen.getByRole('status')
      expect(loadingStatus).toHaveAttribute('aria-live', 'polite')
      expect(loadingStatus).toHaveTextContent(/processando/i)
    })
  })

  describe('Message Validation', () => {
    it('should validate message length', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()

      render(<ChatInterface {...defaultProps} onSendMessage={onSendMessage} />)

      const input = screen.getByRole('textbox')
      const longMessage = 'a'.repeat(2001) // Exceeds typical limit

      await user.type(input, longMessage)
      await user.keyboard('{Enter}')

      expect(screen.getByText(/mensagem muito longa/i)).toBeInTheDocument()
      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('should trim whitespace from messages', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()

      render(<ChatInterface {...defaultProps} onSendMessage={onSendMessage} />)

      const input = screen.getByRole('textbox')

      await user.type(input, '   Mensagem com espaços   ')
      await user.keyboard('{Enter}')

      expect(onSendMessage).toHaveBeenCalledWith('Mensagem com espaços')
    })
  })
})

describe('ChatMessage Component', () => {
  const userMessage: ChatMessageType = {
    id: '1',
    content: 'Como posso melhorar minha disciplina?',
    role: 'user',
    timestamp: new Date('2024-01-01T12:00:00Z')
  }

  const assistantMessage: ChatMessageType = {
    id: '2',
    content: 'Guerreiro, você deve criar um protocolo de disciplina diário! Primeiro passo: defina horários fixos. Segundo: elimine distrações. Terceiro: execute sem exceções.',
    role: 'assistant',
    timestamp: new Date('2024-01-01T12:01:00Z'),
    imageUrl: '/captain-response.png'
  }

  it('should render user message correctly', () => {
    render(<ChatMessage message={userMessage} />)

    expect(screen.getByText('Como posso melhorar minha disciplina?')).toBeInTheDocument()
    expect(screen.getByText('12:00')).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveClass('user-message')
  })

  it('should render assistant message with image', () => {
    render(<ChatMessage message={assistantMessage} />)

    expect(screen.getByText(/guerreiro.*protocolo.*disciplina/i)).toBeInTheDocument()
    expect(screen.getByAltText(/capitão caverna/i)).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveClass('assistant-message')
  })

  it('should format timestamp correctly', () => {
    render(<ChatMessage message={userMessage} />)

    expect(screen.getByText('12:00')).toBeInTheDocument()
  })

  it('should handle long messages with proper wrapping', () => {
    const longMessage: ChatMessageType = {
      ...userMessage,
      content: 'Esta é uma mensagem muito longa que deve quebrar corretamente em múltiplas linhas para manter a legibilidade e não quebrar o layout da interface do chat.'
    }

    render(<ChatMessage message={longMessage} />)

    const messageElement = screen.getByRole('article')
    expect(messageElement).toHaveStyle('word-wrap: break-word')
  })
})

describe('MessageList Component', () => {
  const messages: ChatMessageType[] = [
    {
      id: '1',
      content: 'Primeira mensagem',
      role: 'user',
      timestamp: new Date('2024-01-01T12:00:00Z')
    },
    {
      id: '2',
      content: 'Resposta do Capitão',
      role: 'assistant',
      timestamp: new Date('2024-01-01T12:01:00Z')
    },
    {
      id: '3',
      content: 'Segunda pergunta',
      role: 'user',
      timestamp: new Date('2024-01-01T12:02:00Z')
    }
  ]

  it('should render all messages in correct order', () => {
    render(<MessageList messages={messages} />)

    const messageElements = screen.getAllByRole('article')
    expect(messageElements).toHaveLength(3)

    expect(messageElements[0]).toHaveTextContent('Primeira mensagem')
    expect(messageElements[1]).toHaveTextContent('Resposta do Capitão')
    expect(messageElements[2]).toHaveTextContent('Segunda pergunta')
  })

  it('should auto-scroll to latest message', () => {
    const scrollIntoViewMock = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock

    render(<MessageList messages={messages} />)

    expect(scrollIntoViewMock).toHaveBeenCalled()
  })

  it('should handle empty message list', () => {
    render(<MessageList messages={[]} />)

    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})

describe('WelcomeMessage Component', () => {
  it('should render welcome content', () => {
    render(<WelcomeMessage />)

    expect(screen.getByText(/bem-vindo/i)).toBeInTheDocument()
    expect(screen.getByText(/propósito.*foco.*progresso/i)).toBeInTheDocument()
    expect(screen.getByText(/pergunte sobre/i)).toBeInTheDocument()
  })

  it('should display suggested topics', () => {
    render(<WelcomeMessage />)

    expect(screen.getByText(/disciplina/i)).toBeInTheDocument()
    expect(screen.getByText(/foco/i)).toBeInTheDocument()
    expect(screen.getByText(/produtividade/i)).toBeInTheDocument()
  })

  it('should have proper semantic structure', () => {
    render(<WelcomeMessage />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
  })
})