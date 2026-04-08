'use client';

import { useEffect, useRef } from 'react';
import type { ProductMetricKey, ProductMetricRow } from '@/lib/report-generator/product-metrics';
import { aggregateByKey, scatterGmvVsUnits } from '@/lib/report-generator/product-metrics';
import pmStyles from './TiktokProductMetrics.module.css';

function formatIdr(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    n || 0
  );
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n || 0);
}

type ThemeVars = {
  paper: string;
  text: string;
  grid: string;
  colors: string[];
  fontFamily: string;
};

function readThemeFromEl(el: HTMLElement | null): ThemeVars {
  if (!el) {
    return {
      paper: 'rgb(240 242 240 / 0.94)',
      text: '#1e3a5a',
      grid: '#7ec1d9',
      colors: ['#246e7f', '#4a9eb4', '#b49d86', '#936d62', '#1e3a5a'],
      fontFamily: 'Instrument Sans, sans-serif',
    };
  }
  const s = getComputedStyle(el);
  const primary = s.getPropertyValue('--pm-primary').trim() || '#246e7f';
  const blue = s.getPropertyValue('--pm-blue').trim() || '#4a9eb4';
  const orange = s.getPropertyValue('--pm-orange').trim() || '#b49d86';
  const purple = s.getPropertyValue('--pm-purple').trim() || '#936d62';
  const success = s.getPropertyValue('--pm-success').trim() || '#246e7f';
  const surface = s.getPropertyValue('--pm-surface').trim() || 'rgb(240 242 240 / 0.94)';
  const text = s.getPropertyValue('--pm-text').trim() || '#1e3a5a';
  const divider = s.getPropertyValue('--pm-divider').trim() || '#7ec1d9';
  const body = s.getPropertyValue('--pm-font-body').trim() || 'Instrument Sans, sans-serif';
  return {
    paper: surface,
    text,
    grid: divider,
    colors: [primary, blue, orange, purple, success],
    fontFamily: body,
  };
}

const plotlyConfig = { displayModeBar: false, responsive: true } as const;

export function ProductMetricsCharts({
  filtered,
  metric,
  themeVersion,
  rootRef,
}: {
  filtered: ProductMetricRow[];
  metric: ProductMetricKey;
  themeVersion: number;
  rootRef: React.RefObject<HTMLElement | null>;
}) {
  const topRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const pcsRef = useRef<HTMLDivElement>(null);
  const scatterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let Plotly: typeof import('plotly.js-basic-dist').default | null = null;

    const render = async () => {
      if (!Plotly) {
        const mod = await import('plotly.js-basic-dist');
        Plotly = mod.default ?? mod;
      }
      if (cancelled || !Plotly) return;

      const el = rootRef.current;
      const t = readThemeFromEl(el);
      const metricLabel =
        metric === 'gmv' ? 'GMV' : metric === 'pesanan_sku' ? 'Pesanan SKU' : 'Produk terjual';
      const topProducts = aggregateByKey(filtered, 'product_name', metric).slice(0, 12).reverse();
      if (topRef.current) {
        await Plotly.react(
          topRef.current,
          [
            {
              type: 'bar',
              orientation: 'h',
              x: topProducts.map((d) => d.value),
              y: topProducts.map((d) => d.label),
              marker: { color: t.colors[0], line: { width: 0 } },
              hovertemplate: `%{y}<br>${metricLabel}: %{x:,}<extra></extra>`,
            },
          ],
          {
            paper_bgcolor: t.paper,
            plot_bgcolor: t.paper,
            margin: { l: 10, r: 10, t: 10, b: 40 },
            xaxis: { gridcolor: t.grid, zeroline: false, color: t.text },
            yaxis: { color: t.text, automargin: true },
            font: { color: t.text, family: t.fontFamily },
          },
          plotlyConfig
        );
      }

      const sizeData = aggregateByKey(filtered, 'size', metric).slice(0, 8);
      if (sizeRef.current) {
        await Plotly.react(
          sizeRef.current,
          [
            {
              type: 'pie',
              labels: sizeData.map((d) => d.label),
              values: sizeData.map((d) => d.value),
              hole: 0.56,
              marker: { colors: t.colors },
              textinfo: 'label+percent',
            },
          ],
          {
            paper_bgcolor: t.paper,
            plot_bgcolor: t.paper,
            margin: { l: 10, r: 10, t: 10, b: 10 },
            font: { color: t.text, family: t.fontFamily },
            showlegend: false,
          },
          plotlyConfig
        );
      }

      const pcsData = aggregateByKey(filtered, 'pcsLabel', metric);
      if (pcsRef.current) {
        await Plotly.react(
          pcsRef.current,
          [
            {
              type: 'bar',
              x: pcsData.map((d) => d.label),
              y: pcsData.map((d) => d.value),
              marker: { color: t.colors[2] },
              hovertemplate: `%{x}<br>${metricLabel}: %{y:,}<extra></extra>`,
            },
          ],
          {
            paper_bgcolor: t.paper,
            plot_bgcolor: t.paper,
            margin: { l: 40, r: 10, t: 10, b: 40 },
            xaxis: { color: t.text },
            yaxis: { gridcolor: t.grid, zeroline: false, color: t.text },
            font: { color: t.text, family: t.fontFamily },
          },
          plotlyConfig
        );
      }

      const dots = scatterGmvVsUnits(filtered, 25);
      if (scatterRef.current) {
        await Plotly.react(
          scatterRef.current,
          [
            {
              type: 'scatter',
              mode: 'markers',
              x: dots.map((d) => d.units),
              y: dots.map((d) => d.gmv),
              text: dots.map((d) => d.name),
              marker: {
                size: dots.map((d) => Math.max(10, Math.sqrt(Math.max(d.orders, 0)))),
                color: t.colors[3],
                opacity: 0.8,
              },
              hovertemplate: '%{text}<br>Produk terjual: %{x:,}<br>GMV: %{y:,}<extra></extra>',
            },
          ],
          {
            paper_bgcolor: t.paper,
            plot_bgcolor: t.paper,
            margin: { l: 60, r: 10, t: 10, b: 45 },
            xaxis: { title: 'Produk terjual', gridcolor: t.grid, color: t.text },
            yaxis: { title: 'GMV', gridcolor: t.grid, color: t.text },
            font: { color: t.text, family: t.fontFamily },
          },
          plotlyConfig
        );
      }

    };

    void render();

    return () => {
      cancelled = true;
    };
  }, [filtered, metric, themeVersion, rootRef]);

  useEffect(() => {
    const onResize = () => {
      void import('plotly.js-basic-dist').then((mod) => {
        const Plotly = mod.default ?? mod;
        [topRef, sizeRef, pcsRef, scatterRef].forEach((r) => {
          if (r.current) {
            try {
              Plotly.Plots.resize(r.current);
            } catch {
              /* ignore */
            }
          }
        });
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    return () => {
      void import('plotly.js-basic-dist').then((mod) => {
        const Plotly = mod.default ?? mod;
        [topRef, sizeRef, pcsRef, scatterRef].forEach((r) => {
          if (r.current) Plotly.purge(r.current);
        });
      });
    };
  }, []);

  return (
    <div className={pmStyles.pmCharts}>
      <article className={`${pmStyles.pmPanel} ${pmStyles.pmChartCard}`}>
        <div className={pmStyles.pmChartHead}>
          <div>
            <h4 className={pmStyles.pmChartTitle}>Top products</h4>
            <p className={pmStyles.pmMuted}>Aggregated by parsed product name.</p>
          </div>
        </div>
        <div ref={topRef} className={pmStyles.pmChartPlot} />
      </article>
      <article className={`${pmStyles.pmPanel} ${pmStyles.pmChartCard}`}>
        <div className={pmStyles.pmChartHead}>
          <div>
            <h4 className={pmStyles.pmChartTitle}>Size contribution</h4>
            <p className={pmStyles.pmMuted}>Metric share by parsed size.</p>
          </div>
        </div>
        <div ref={sizeRef} className={pmStyles.pmChartPlot} />
      </article>
      <article className={`${pmStyles.pmPanel} ${pmStyles.pmChartCard}`}>
        <div className={pmStyles.pmChartHead}>
          <div>
            <h4 className={pmStyles.pmChartTitle}>PCS distribution</h4>
            <p className={pmStyles.pmMuted}>Bundle formats (1 Pcs, 3 Pcs, …).</p>
          </div>
        </div>
        <div ref={pcsRef} className={pmStyles.pmChartPlot} />
      </article>
      <article className={`${pmStyles.pmPanel} ${pmStyles.pmChartCard}`}>
        <div className={pmStyles.pmChartHead}>
          <div>
            <h4 className={pmStyles.pmChartTitle}>GMV vs units</h4>
            <p className={pmStyles.pmMuted}>Bubble size ~ orders.</p>
          </div>
        </div>
        <div ref={scatterRef} className={pmStyles.pmChartPlot} />
      </article>
    </div>
  );
}
