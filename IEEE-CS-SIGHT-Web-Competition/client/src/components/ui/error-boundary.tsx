import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("UI ErrorBoundary caught: ", error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="container mx-auto p-6">
            <div className="glass-morphism rounded-xl p-6 text-center">
              <h2 className="text-xl font-poppins font-semibold mb-2">Something went wrong</h2>
              <p className="text-muted-foreground mb-4">An unexpected error occurred. You can try reloading the page.</p>
              <button className="btn-glass" onClick={this.handleReload}>Reload</button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
