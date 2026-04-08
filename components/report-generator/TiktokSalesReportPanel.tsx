'use client';

import { Instrument_Sans, Newsreader } from 'next/font/google';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ProductMetricsCharts } from '@/components/report-generator/ProductMetricsCharts';
import {
  demoProductMetricRows,
  filterProductMetricRows,
  ingestProductMetricsMatrix,
  sortByMetric,
  totalsForRows,
  type ProductMetricFilter,
  type ProductMetricKey,
  type ProductMetricRow,
} from '@/lib/report-generator/product-metrics';
import { matrixFromCsvText } from '@/lib/report-generator/tiktok-sales';
import pmStyles from './TiktokProductMetrics.module.css';
import styles from './ReportGeneratorPanel.module.css';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-pm-body',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-pm-display',
  display: 'swap',
});

function formatIdr(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatIdrCurrency(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    n || 0
  );
}

function coerceMatrixFromXlsxSheet(rows: unknown[][]): string[][] {
  return rows.map((row) =>
    (row ?? []).map((cell) => {
      if (cell === undefined || cell === null) return '';
      if (typeof cell === 'number') return String(cell);
      return String(cell).trim();
    })
  );
}

export function TiktokSalesReportPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [themeVersion, setThemeVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<ProductMetricRow[]>([]);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [parseMode, setParseMode] = useState<'tiktok-strict' | 'flexible' | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [metric, setMetric] = useState<ProductMetricKey>('gmv');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [pcsFilter, setPcsFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');

  const filterOpts: ProductMetricFilter = useMemo(
    () => ({
      status: statusFilter,
      size: sizeFilter,
      pcs: pcsFilter,
      query: searchInput,
    }),
    [statusFilter, sizeFilter, pcsFilter, searchInput]
  );

  const filteredSorted = useMemo(() => {
    const f = filterProductMetricRows(allRows, filterOpts);
    return sortByMetric(f, metric);
  }, [allRows, filterOpts, metric]);

  const totals = useMemo(() => totalsForRows(filteredSorted), [filteredSorted]);

  const statusOptions = useMemo(() => {
    const s = [...new Set(allRows.map((r) => r.status).filter(Boolean))].sort();
    return s;
  }, [allRows]);

  const sizeOptions = useMemo(() => {
    return [...new Set(allRows.map((r) => r.size).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [allRows]);

  const pcsOptions = useMemo(() => {
    return [...new Set(allRows.map((r) => r.pcsLabel).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [allRows]);

  const showSkuCols = useMemo(() => allRows.some((r) => Boolean(r.skuId?.trim())), [allRows]);
  const showProductIdCols = useMemo(() => allRows.some((r) => Boolean(r.productId?.trim())), [allRows]);

  const applyMatrix = useCallback((matrix: string[][], name: string | null) => {
    setError(null);
    const result = ingestProductMetricsMatrix(matrix);
    if (result.error || result.data.length === 0) {
      setAllRows([]);
      setPeriodLabel(null);
      setParseMode(null);
      setError(result.error ?? 'Tidak ada baris yang bisa dibaca.');
      setFileName(name);
      return;
    }
    setAllRows(result.data);
    setPeriodLabel(result.periodLabel);
    setParseMode(result.parseMode);
    setFileName(name);
    setStatusFilter('all');
    setSizeFilter('all');
    setPcsFilter('all');
    setSearchInput('');
  }, []);

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = typeof reader.result === 'string' ? reader.result : '';
          const matrix = matrixFromCsvText(text);
          applyMatrix(matrix, file.name);
        };
        reader.onerror = () => setError('Gagal membaca file.');
        reader.readAsText(file, 'UTF-8');
        return;
      }
      if (lower.endsWith('.xlsx')) {
        try {
          const buf = await file.arrayBuffer();
          const XLSX = await import('xlsx');
          const wb = XLSX.read(buf, { type: 'array' });
          const sheetName = wb.SheetNames[0];
          if (!sheetName) {
            setError('File Excel tidak berisi sheet.');
            setFileName(file.name);
            return;
          }
          const sheet = wb.Sheets[sheetName];
          const raw = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            raw: false,
          }) as unknown[][];
          const matrix = coerceMatrixFromXlsxSheet(raw);
          applyMatrix(matrix, file.name);
        } catch {
          setError('Gagal membaca file Excel.');
          setFileName(file.name);
        }
        return;
      }
      setError('Format file tidak didukung. Gunakan .csv atau .xlsx.');
      setFileName(file.name);
    },
    [applyMatrix]
  );

  const loadDemo = useCallback(() => {
    setError(null);
    const rows = demoProductMetricRows();
    setAllRows(rows);
    setPeriodLabel('Demo');
    setParseMode('flexible');
    setFileName('Demo dataset');
    setStatusFilter('all');
    setSizeFilter('all');
    setPcsFilter('all');
    setSearchInput('');
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
    setThemeVersion((v) => v + 1);
  }, []);

  const hasData = allRows.length > 0;
  const hasFiltered = filteredSorted.length > 0;

  return (
    <div
      ref={rootRef}
      id={hasData ? 'tiktok-report-print' : undefined}
      className={`${instrumentSans.variable} ${newsreader.variable} ${pmStyles.pmRoot} ${hasData ? styles.printRoot : ''}`}
      data-theme={theme}
      data-report-ui="tiktok-produk-metrics-v2"
    >
      <div className={pmStyles.pmRootInner}>
        <header className={pmStyles.pmTopbar}>
          <div className={pmStyles.pmBrand}>
            <div className={pmStyles.pmLogo} aria-hidden>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 17.5 10.2 7l3.2 5.1 2.3-3.6L20 17.5" />
                <path d="M4 17.5h16" />
              </svg>
            </div>
            <div>
              <h1 className={pmStyles.pmTitle}>Produk Metrics — TikTok Shop</h1>
              <p className={pmStyles.pmSubtitle}>
                Unggah <strong>CSV</strong> atau <strong>XLSX</strong> dari ekspor TikTok Shop (atau lembar mirip
                prototipe). Parse nama/ukuran/pcs, eksplor GMV, Pesanan SKU, dan Produk terjual dengan chart
                interaktif.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={`${pmStyles.pmThemeToggle} ${pmStyles.pmNoPrint}`}
            aria-label="Ganti tema"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </header>

        <main>
          <section className={pmStyles.pmHero}>
            <div className={`${pmStyles.pmPanel} ${pmStyles.pmUploadCard}`}>
              <div
                className={`${pmStyles.pmUploadZone} ${dragOver ? pmStyles.pmDragOver : ''}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  void onFile(f ?? null);
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--pm-text-lg)', fontWeight: 600 }}>Letakkan XLSX / CSV di sini</div>
                  <p className={pmStyles.pmSubtitle} style={{ marginTop: '0.5rem', maxWidth: '48ch' }}>
                    Mode ketat: header TikTok Shop penuh. Mode fleksibel: cukup Produk, GMV, Pesanan SKU, Produk
                    terjual (+ Status opsional).
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <label className={pmStyles.pmPrimaryBtn}>
                    <input
                      type="file"
                      accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className={pmStyles.pmHiddenInput}
                      onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                    />
                    Pilih file
                  </label>
                  <button type="button" className={pmStyles.pmSecondaryBtn} onClick={loadDemo}>
                    Load sample data
                  </button>
                  {hasData ? (
                    <button type="button" className={pmStyles.pmPrintBtn} onClick={handlePrint}>
                      Ekspor PDF (print)
                    </button>
                  ) : null}
                </div>
                <div className={pmStyles.pmMetaRow}>
                  <span className={pmStyles.pmFileMeta}>
                    {fileName
                      ? `${fileName} · ${formatIdr(allRows.length)} baris`
                      : 'Belum ada file.'}
                  </span>
                  {parseMode ? (
                    <span className={pmStyles.pmParseBadge}>
                      {parseMode === 'tiktok-strict' ? 'Parser: TikTok Shop' : 'Parser: fleksibel'}
                    </span>
                  ) : null}
                  {periodLabel ? <span className={pmStyles.pmParseBadge}>{periodLabel}</span> : null}
                </div>
              </div>
              {error ? <p className={styles.error} style={{ marginTop: 12 }}>{error}</p> : null}
            </div>

            <aside className={pmStyles.pmPanel}>
              <div className={pmStyles.pmHelperGrid}>
                <div className={pmStyles.pmHelperItem}>
                  <strong>Auto parsing</strong>
                  Teks Produk dipecah jadi nama, ukuran, dan pcs (regex seperti prototipe).
                </div>
                <div className={pmStyles.pmHelperItem}>
                  <strong>Metrik</strong>
                  String Rupiah dikonversi ke angka untuk agregasi dan chart.
                </div>
                <div className={pmStyles.pmHelperItem}>
                  <strong>Filter</strong>
                  Segmen per status, ukuran, pcs, dan pencarian nama.
                </div>
                <div className={pmStyles.pmHelperItem}>
                  <strong>Visual</strong>
                  Top produk, kontribusi ukuran, distribusi PCS, scatter GMV vs unit.
                </div>
                <div className={pmStyles.pmHelperItem}>
                  <strong>Dua mode file</strong>
                  Ekspor resmi TikTok (kolom lengkap) atau sheet produk sederhana.
                </div>
                <div className={pmStyles.pmHelperItem}>
                  <strong>SKU / Product ID</strong>
                  Ditampilkan di tabel bila kolom ada di file.
                </div>
              </div>
            </aside>
          </section>

          {hasData ? (
            <section className={`${pmStyles.pmPanel} ${pmStyles.pmControls} ${pmStyles.pmNoPrint}`}>
              <div className={pmStyles.pmField}>
                <label htmlFor="pm-metric">Metrik utama</label>
                <select
                  id="pm-metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as ProductMetricKey)}
                >
                  <option value="gmv">GMV</option>
                  <option value="pesanan_sku">Pesanan SKU</option>
                  <option value="produk_terjual">Produk terjual</option>
                </select>
              </div>
              <div className={pmStyles.pmField}>
                <label htmlFor="pm-status">Status</label>
                <select id="pm-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Semua</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className={pmStyles.pmField}>
                <label htmlFor="pm-size">Ukuran</label>
                <select id="pm-size" value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
                  <option value="all">Semua</option>
                  {sizeOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className={pmStyles.pmField}>
                <label htmlFor="pm-pcs">PCS</label>
                <select id="pm-pcs" value={pcsFilter} onChange={(e) => setPcsFilter(e.target.value)}>
                  <option value="all">Semua</option>
                  {pcsOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className={pmStyles.pmField} style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="pm-search">Cari produk</label>
                <input
                  id="pm-search"
                  type="text"
                  placeholder="Nama produk"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </section>
          ) : null}

          {hasData && hasFiltered ? (
            <section className={pmStyles.pmStats}>
              <article className={`${pmStyles.pmPanel} ${pmStyles.pmStatCard}`}>
                <div className={pmStyles.pmStatLabel}>Baris</div>
                <div className={pmStyles.pmStatValue}>{formatIdr(filteredSorted.length)}</div>
                <div className={pmStyles.pmStatNote}>Setelah filter.</div>
              </article>
              <article className={`${pmStyles.pmPanel} ${pmStyles.pmStatCard}`}>
                <div className={pmStyles.pmStatLabel}>Total GMV</div>
                <div className={pmStyles.pmStatValue}>{formatIdrCurrency(totals.gmv)}</div>
                <div className={pmStyles.pmStatNote}>Jumlah baris terfilter.</div>
              </article>
              <article className={`${pmStyles.pmPanel} ${pmStyles.pmStatCard}`}>
                <div className={pmStyles.pmStatLabel}>Pesanan SKU</div>
                <div className={pmStyles.pmStatValue}>{formatIdr(totals.pesanan_sku)}</div>
                <div className={pmStyles.pmStatNote}>Agregat terfilter.</div>
              </article>
              <article className={`${pmStyles.pmPanel} ${pmStyles.pmStatCard}`}>
                <div className={pmStyles.pmStatLabel}>Produk terjual</div>
                <div className={pmStyles.pmStatValue}>{formatIdr(totals.produk_terjual)}</div>
                <div className={pmStyles.pmStatNote}>Unit terfilter.</div>
              </article>
            </section>
          ) : null}

          {hasData && hasFiltered ? (
            <ProductMetricsCharts
              filtered={filteredSorted}
              metric={metric}
              themeVersion={themeVersion}
              rootRef={rootRef}
            />
          ) : null}

          {hasData && hasFiltered ? (
            <section className={`${pmStyles.pmPanel} ${pmStyles.pmTableCard}`}>
              <div className={pmStyles.pmChartHead}>
                <div>
                  <h4 className={pmStyles.pmChartTitle}>Tabel produk</h4>
                  <p className={pmStyles.pmMuted}>Diurutkan menurut metrik utama yang dipilih.</p>
                </div>
              </div>
              <div className={pmStyles.pmTableWrap}>
                <table className={pmStyles.pmTable}>
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Ukuran</th>
                      <th>PCS</th>
                      {showSkuCols ? <th>SKU ID</th> : null}
                      {showProductIdCols ? <th>Product ID</th> : null}
                      <th>Status</th>
                      <th className={pmStyles['num']}>GMV</th>
                      <th className={pmStyles['num']}>Pesanan SKU</th>
                      <th className={pmStyles['num']}>Produk terjual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSorted.slice(0, 200).map((r, i) => (
                      <tr key={`${r.skuId}-${i}-${r.produkRaw.slice(0, 24)}`}>
                        <td>{r.product_name}</td>
                        <td>{r.size}</td>
                        <td>{r.pcsLabel}</td>
                        {showSkuCols ? <td className={pmStyles['num']}>{r.skuId || '—'}</td> : null}
                        {showProductIdCols ? <td className={pmStyles['num']}>{r.productId || '—'}</td> : null}
                        <td>
                          <span className={pmStyles.pmStatus}>{r.status}</span>
                        </td>
                        <td className={pmStyles['num']}>{formatIdrCurrency(r.gmv)}</td>
                        <td className={pmStyles['num']}>{formatIdr(r.pesanan_sku)}</td>
                        <td className={pmStyles['num']}>{formatIdr(r.produk_terjual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {!hasData ? (
            <section className={pmStyles.pmEmpty}>Unggah workbook untuk mulai analitika produk.</section>
          ) : !hasFiltered ? (
            <section className={pmStyles.pmEmpty}>Tidak ada baris yang cocok dengan filter saat ini.</section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
