"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type ArchiveErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  resetLabel?: string;
};

type ArchiveErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string | null;
};

export default class ArchiveErrorBoundary extends Component<
  ArchiveErrorBoundaryProps,
  ArchiveErrorBoundaryState
> {
  state: ArchiveErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): ArchiveErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "An unexpected archive error occurred.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ARCHIVE_ERROR_BOUNDARY]", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.props.fallbackTitle || "The archive failed to open this page";
    const message =
      this.props.fallbackMessage ||
      "Please reload or return to your legend. Missing or older book data should not block the rest of the experience.";

    return (
      <main className="archive-shell flex min-h-screen items-center justify-center px-5 py-10">
        <section className="glass-panel max-w-lg rounded-[2rem] p-8 text-center">
          <h1 className="font-title text-2xl text-[#f7ebce] sm:text-3xl">{title}</h1>
          <p className="mt-4 text-sm leading-7 text-[#9baabd]">{message}</p>
          {this.state.errorMessage ? (
            <p className="mt-3 text-xs text-[#7a8798]">{this.state.errorMessage}</p>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="gold-button rounded-2xl px-6 py-3 text-xs font-bold uppercase tracking-[0.22em]"
            >
              Reload
            </button>
            {this.props.onReset ? (
              <button
                type="button"
                onClick={this.handleReset}
                className="rounded-2xl border border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#c9d3df]"
              >
                {this.props.resetLabel || "Return"}
              </button>
            ) : null}
          </div>
        </section>
      </main>
    );
  }
}
