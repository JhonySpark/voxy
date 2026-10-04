import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../../../core/services/logger.service';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    logger.error('React Component Crash (GlobalErrorBoundary)', error, {
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.hash = '#/app';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#0f1117',
            color: '#f3f4f6',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              backgroundColor: '#161922',
              border: '1px solid #282d3d',
              borderRadius: '16px',
              padding: '2.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto',
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                marginBottom: '0.75rem',
                color: '#ffffff',
              }}
            >
              Ops! Algo inesperado aconteceu.
            </h1>

            <p
              style={{
                fontSize: '0.95rem',
                color: '#9ca3af',
                lineHeight: 1.5,
                marginBottom: '2rem',
              }}
            >
              O Voxy encontrou um erro inesperado nesta tela. O incidente foi registrado automaticamente para correção.
            </p>

            {this.state.error && (
              <details
                style={{
                  marginBottom: '2rem',
                  textAlign: 'left',
                  backgroundColor: '#0b0c10',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #232736',
                  fontSize: '0.8rem',
                  color: '#f87171',
                  overflow: 'auto',
                  maxHeight: '160px',
                }}
              >
                <summary style={{ cursor: 'pointer', color: '#9ca3af', fontWeight: 500 }}>
                  Ver detalhes técnicos do erro
                </summary>
                <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#4f46e5')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#6366f1')}
              >
                <RefreshCw size={18} />
                Recarregar Aplicativo
              </button>

              <button
                onClick={this.handleGoHome}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#232736',
                  color: '#e5e7eb',
                  border: '1px solid #374151',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2d3345')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#232736')}
              >
                <Home size={18} />
                Ir para o Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
