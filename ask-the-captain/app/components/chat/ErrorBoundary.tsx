'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { CaptainImage } from './CaptainImage'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI with Captain persona messaging
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for monitoring
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // Report to error tracking service if available
    if (typeof window !== 'undefined' && (window as any).reportError) {
      (window as any).reportError(error, {
        context: 'ErrorBoundary',
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      })
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  private getCaptainErrorMessage(error?: Error): string {
    if (!error) {
      return 'Guerreiro, encontrei um obstáculo técnico inesperado. Mas lembre-se: no Cave Mode, não deixamos que falhas nos definam. Vamos tentar novamente.'
    }

    const errorMessage = error.message.toLowerCase()

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'Problemas de conexão, guerreiro. A disciplina inclui saber quando persistir e quando aguardar. Verifique sua conexão e tente novamente.'
    }

    if (errorMessage.includes('timeout')) {
      return 'A operação demorou mais que o esperado. A paciência é uma virtude do Cave Mode. Tente novamente com determinação.'
    }

    if (errorMessage.includes('memory') || errorMessage.includes('quota')) {
      return 'Sistema sobrecarregado, guerreiro. Mesmo na caverna, sabemos quando dar um passo atrás para avançar melhor. Recarregue a página.'
    }

    return 'Obstáculo técnico encontrado, guerreiro. Cada falha é uma oportunidade de demonstrar nossa resiliência. Use este momento para refletir e tente novamente.'
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      const errorMessage = this.getCaptainErrorMessage(this.state.error)

      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            {/* Captain Image */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <CaptainImage
                  imageUrl="/placeholder-captain.svg"
                  isGenerating={false}
                  onImageLoad={() => {}}
                  fallbackImage="/placeholder-captain.svg"
                />
              </div>
            </div>

            {/* Error Message */}
            <div className="glass-container p-8 text-center">
              <h1 className="text-2xl font-bold text-white mb-6">
                Sistema Temporariamente Indisponível
              </h1>
              
              <p className="text-gray-300 text-lg leading-relaxed mb-8">
                {errorMessage}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={this.handleRetry}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  Tentar Novamente
                </button>
                
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  Recarregar Página
                </button>
              </div>

              {/* Technical Details (Development Mode) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-8 text-left">
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-300 mb-4">
                    Detalhes Técnicos (Desenvolvimento)
                  </summary>
                  <div className="bg-gray-800 p-4 rounded-lg text-sm font-mono text-gray-300 overflow-auto">
                    <div className="mb-4">
                      <strong>Erro:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div className="mb-4">
                        <strong>Stack Trace:</strong>
                        <pre className="whitespace-pre-wrap mt-2">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    {this.state.errorInfo && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="whitespace-pre-wrap mt-2">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>

            {/* Cave Mode Philosophy */}
            <div className="mt-8 text-center">
              <p className="text-gray-400 text-sm italic">
                "No Cave Mode, transformamos obstáculos em oportunidades de crescimento."
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook-based error boundary for functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const handleError = React.useCallback((error: Error) => {
    console.error('Error caught by useErrorHandler:', error)
    setError(error)

    // Report to error tracking service if available
    if (typeof window !== 'undefined' && (window as any).reportError) {
      (window as any).reportError(error, {
        context: 'useErrorHandler',
        hookBased: true
      })
    }
  }, [])

  // Throw error to be caught by nearest error boundary
  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return { handleError, resetError, error }
}

/**
 * Higher-order component that wraps components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

/**
 * Error boundary specifically for chat components
 */
export function ChatErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-6">
            <CaptainImage
              imageUrl="/placeholder-captain.svg"
              isGenerating={false}
              onImageLoad={() => {}}
              fallbackImage="/placeholder-captain.svg"
            />
          </div>
          <div className="glass-container p-6 max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Chat Temporariamente Indisponível
            </h3>
            <p className="text-gray-300 mb-6">
              Guerreiro, o sistema de chat encontrou um obstáculo. Recarregue a página para continuar sua jornada de transformação.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              Recarregar Chat
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

export default ErrorBoundary