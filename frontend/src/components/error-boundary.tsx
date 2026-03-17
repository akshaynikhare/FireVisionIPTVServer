'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught:', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isNetworkError =
        this.state.error?.message?.toLowerCase().includes('network') ||
        this.state.error?.message?.toLowerCase().includes('fetch');

      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4" role="alert">
          <p className="text-sm font-medium text-destructive">
            {isNetworkError ? 'Connection Error' : 'Something went wrong'}
          </p>
          <p className="text-xs text-muted-foreground max-w-md text-center">
            {isNetworkError
              ? 'Check your internet connection and try again.'
              : 'An unexpected error occurred. Try refreshing the page or contact support if the problem persists.'}
          </p>
          {process.env.NODE_ENV !== 'production' && this.state.error?.message && (
            <details className="text-xs text-muted-foreground max-w-md w-full">
              <summary className="cursor-pointer hover:text-foreground transition-colors">
                Error details
              </summary>
              <pre className="mt-2 p-3 bg-muted text-xs overflow-auto border border-border">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-medium uppercase tracking-[0.1em] border border-border hover:border-primary/40 transition-colors"
            >
              Refresh Page
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 text-xs font-medium uppercase tracking-[0.1em] border border-border hover:border-primary/40 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
