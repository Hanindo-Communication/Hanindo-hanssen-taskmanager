declare module 'plotly.js-basic-dist' {
  // Minimal surface for imperative Plotly usage (bar, pie, scatter).
  const Plotly: {
    react: (
      el: HTMLElement,
      data: unknown[],
      layout: Record<string, unknown>,
      config?: Record<string, unknown>
    ) => Promise<unknown>;
    purge: (el: HTMLElement) => void;
    Plots: { resize: (el: HTMLElement) => void };
  };
  export default Plotly;
}
