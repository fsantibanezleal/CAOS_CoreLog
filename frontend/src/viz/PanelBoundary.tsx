import { Component, type ReactNode } from 'react';

// Per-panel error boundary: a crash inside one core-analysis view renders a small inline message INSTEAD of
// unmounting the whole App to a blank page. The tab bar stays usable so the user can switch away. Mirrors the
// RotorVitals PanelBoundary (the reference app).
export class PanelBoundary extends Component<{ children: ReactNode; lang?: 'en' | 'es' }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const es = this.props.lang === 'es';
      return (
        <div style={{ padding: '1rem', color: 'var(--color-fg-faint)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
          <strong>{es ? 'Esta vista no aplica a esta fuente' : 'This view does not apply to this source'}</strong>
          <p style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}>
            {es
              ? 'No se pudo computar esta vista sobre el dato actual (p. ej. un testigo sin el formato que la herramienta requiere). Elige otra pestaña o fuente.'
              : 'This view could not be computed on the current datum (e.g. a core lacking the format the tool needs). Pick another tab or source.'}
          </p>
          <p style={{ opacity: 0.6, fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
