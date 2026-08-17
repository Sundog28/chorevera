import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";

import {
  RefreshCw,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";


type ErrorBoundaryProps = {
  children: ReactNode;
};


type ErrorBoundaryState = {
  error: Error | null;
};


export default class ErrorBoundary
  extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
  > {
  state: ErrorBoundaryState = {
    error: null,
  };


  static getDerivedStateFromError(
    error: Error,
  ): ErrorBoundaryState {
    return {
      error,
    };
  }


  componentDidCatch(
    error: Error,
    errorInfo: ErrorInfo,
  ): void {
    console.error(
      "Chorevera render failure:",
      error,
      errorInfo,
    );
  }


  private handleRetry = (): void => {
    this.setState({
      error: null,
    });
  };


  private handleReload = (): void => {
    window.location.reload();
  };


  render() {
    const {
      error,
    } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <main className="app-error-boundary">
        <section className="app-error-card">
          <div className="app-error-icon">
            <TriangleAlert size={30} />
          </div>

          <span className="eyebrow">
            Chorevera recovered safely
          </span>

          <h1>
            Something went wrong
          </h1>

          <p>
            The application encountered an
            unexpected display error. Your
            account data was not deleted.
          </p>

          <div className="app-error-actions">
            <button
              className="primary-button"
              onClick={
                this.handleRetry
              }
              type="button"
            >
              <RotateCcw size={18} />
              Try again
            </button>

            <button
              className="secondary-button"
              onClick={
                this.handleReload
              }
              type="button"
            >
              <RefreshCw size={18} />
              Reload Chorevera
            </button>
          </div>

          {import.meta.env.DEV && (
            <details className="app-error-details">
              <summary>
                Development details
              </summary>

              <pre>
                {error.stack ??
                  error.message}
              </pre>
            </details>
          )}
        </section>
      </main>
    );
  }
}
