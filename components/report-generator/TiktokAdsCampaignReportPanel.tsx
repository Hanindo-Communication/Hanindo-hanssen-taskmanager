'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import boardStyles from '@/components/board/board-client.module.css';
import {
  parseTiktokAdsProductCampaignMatrix,
  type TiktokAdsCampaignAggregate,
  type TiktokAdsReportSummary,
} from '@/lib/report-generator/tiktok-ads-campaign-xlsx';
import styles from './ReportGeneratorPanel.module.css';

function formatIdr(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatRoi(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function coerceMatrixFromXlsxSheet(rows: unknown[][]): string[][] {
  return (rows ?? []).map((row) =>
    (row ?? []).map((cell) => {
      if (cell === undefined || cell === null) return '';
      if (typeof cell === 'number') return String(cell);
      return String(cell).trim();
    })
  );
}

function normalizeSheetName(n: string): string {
  return n.trim().toLowerCase();
}

async function downloadElementAsPdf(el: HTMLElement, baseName: string): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    onclone(doc) {
      doc.querySelectorAll('[data-no-pdf]').forEach((node) => {
        (node as HTMLElement).style.display = 'none';
      });
    },
  });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const imgWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${baseName}.pdf`);
}

export function TiktokAdsCampaignReportPanel() {
  const reportRootRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TiktokAdsReportSummary | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const applyMatrix = useCallback((matrix: string[][], name: string | null) => {
    setError(null);
    const { summary: next, error: parseError } = parseTiktokAdsProductCampaignMatrix(matrix);
    if (parseError || !next) {
      setSummary(null);
      setError(parseError ?? 'Gagal memproses data.');
      setFileName(name);
      return;
    }
    setSummary(next);
    setFileName(name);
  }, []);

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.xlsx')) {
        setError('Gunakan file .xlsx (Product campaign data dari TikTok Ads).');
        setFileName(file.name);
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buf, { type: 'array' });
        const sheetName = wb.SheetNames.find((n) => normalizeSheetName(n) === 'data') ?? wb.SheetNames[0];
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
    },
    [applyMatrix]
  );

  const activeCampaigns = useMemo(() => {
    if (!summary) return [];
    return summary.campaigns.filter((c) => c.cost > 0);
  }, [summary]);

  const topRoi = useMemo(() => {
    const list = [...activeCampaigns].filter((c) => c.roi !== null && c.roi > 0);
    list.sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0));
    return list.slice(0, 3);
  }, [activeCampaigns]);

  const topGmv = useMemo(() => {
    const list = [...activeCampaigns];
    list.sort((a, b) => b.grossRevenue - a.grossRevenue);
    return list.slice(0, 3);
  }, [activeCampaigns]);

  const topSpend = useMemo(() => {
    const list = [...activeCampaigns];
    list.sort((a, b) => b.cost - a.cost);
    return list.slice(0, 3);
  }, [activeCampaigns]);

  const handleDownloadPdf = useCallback(async () => {
    const el = reportRootRef.current;
    if (!el) return;
    setPdfBusy(true);
    setError(null);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadElementAsPdf(el, `laporan-tiktok-ads-${stamp}`);
    } catch {
      setError('Gagal membuat PDF. Coba lagi.');
    } finally {
      setPdfBusy(false);
    }
  }, []);

  const tableRows = useMemo(() => {
    const list = [...activeCampaigns];
    list.sort((a, b) => b.cost - a.cost);
    return list;
  }, [activeCampaigns]);

  return (
    <div
      ref={reportRootRef}
      id={summary ? 'tiktok-ads-report-print' : undefined}
      className={summary ? styles.printRoot : undefined}
      data-report-ui="tiktok-ads-campaign-v2"
    >
      <section
        className={`${boardStyles.overviewHero} ${styles.reportHero} ${styles.reportHeroTiktok}`}
      >
        <div className={styles.heroTextCol}>
          <p className={boardStyles.heroEyebrow}>Report Generator</p>
          <h2 className={boardStyles.heroTitle}>Laporan TikTok Ads</h2>
          <p className={`${boardStyles.heroDescription} ${styles.heroDescriptionTight}`}>
            Unggah <strong>XLSX Product campaign data</strong> dari TikTok Ads. Ringkasan per{' '}
            <strong>nama kampanye</strong>: <strong>Cost (spending)</strong>,{' '}
            <strong>Current budget</strong> (cap harian), <strong>Gross revenue (GMV)</strong>, dan{' '}
            <strong>ROI</strong> campuran (GMV ÷ Cost).
          </p>
          <div className={`${styles.uploadRow} ${summary ? styles.noPrint : ''}`} data-no-pdf>
            <label className={styles.fileLabel}>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className={styles.fileInput}
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              Pilih file XLSX
            </label>
            {fileName ? <span className={styles.fileName}>{fileName}</span> : null}
            {summary ? (
              <button
                type="button"
                className={styles.printBtn}
                data-no-pdf
                disabled={pdfBusy}
                onClick={() => void handleDownloadPdf()}
              >
                {pdfBusy ? 'Menyusun PDF…' : 'Unduh PDF'}
              </button>
            ) : null}
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
        {summary ? (
          <div className={`${boardStyles.heroStatsGrid} ${styles.heroMetrics}`}>
            <div className={`${boardStyles.metricCard} ${styles.metricCardLift}`}>
              <p className={boardStyles.metricLabel}>Total Cost (spending)</p>
              <p className={boardStyles.metricValue}>Rp {formatIdr(summary.totalCost)}</p>
              <p className={styles.metricSub}>
                Σ Cost periode · {activeCampaigns.length} kampanye ber-spend · {summary.campaignCount}{' '}
                nama di file
              </p>
            </div>
            <div className={`${boardStyles.metricCard} ${styles.metricCardLift}`}>
              <p className={boardStyles.metricLabel}>Total GMV</p>
              <p className={boardStyles.metricValue}>Rp {formatIdr(summary.totalGrossRevenue)}</p>
              <p className={styles.metricSub}>Σ Gross revenue (kolom TikTok)</p>
            </div>
            <div className={`${boardStyles.metricCard} ${styles.metricCardLift}`}>
              <p className={boardStyles.metricLabel}>ROI campuran</p>
              <p className={boardStyles.metricValue}>{formatRoi(summary.blendedRoi)}</p>
              <p className={styles.metricSub}>Total GMV ÷ total Cost</p>
            </div>
          </div>
        ) : (
          <div className={`${boardStyles.heroStatsGrid} ${styles.heroMetrics}`}>
            <div className={`${boardStyles.metricCard} ${styles.placeholderCard}`}>
              <p className={boardStyles.metricLabel}>Total Cost</p>
              <p className={boardStyles.metricValue}>—</p>
            </div>
            <div className={`${boardStyles.metricCard} ${styles.placeholderCard}`}>
              <p className={boardStyles.metricLabel}>Total GMV</p>
              <p className={boardStyles.metricValue}>—</p>
            </div>
            <div className={`${boardStyles.metricCard} ${styles.placeholderCard}`}>
              <p className={boardStyles.metricLabel}>ROI campuran</p>
              <p className={boardStyles.metricValue}>—</p>
            </div>
          </div>
        )}
      </section>

      {summary ? (
        <div className={styles.reportBody}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Ringkasan</h3>
            <p className={styles.meta}>
              {summary.rowCount} baris sumber · {summary.campaignCount} nama kampanye ·{' '}
              {activeCampaigns.length} dengan Cost &gt; 0 · Cost per order{' '}
              {summary.blendedCostPerOrder !== null
                ? `Rp ${formatIdr(summary.blendedCostPerOrder)}`
                : '—'}{' '}
              · Σ daily budget cap Rp {formatIdr(summary.sumOfDailyBudgetCaps)}
            </p>
            <p className={styles.infographicFootnote} style={{ marginTop: 10 }}>
              Tabel dan Top 3 hanya memakai kampanye yang punya spending (Cost &gt; 0). Net Cost
              setelah insentif di tabel. Current budget = cap harian per kampanye; Σ daily budget
              cap menjumlahkan cap antarkampanye, bukan anggaran akun.
            </p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Top 3 — infografik</h3>
            <p className={styles.sectionHint}>
              Hanya kampanye dengan Cost &gt; 0. Panjang batang relatif terhadap #1 di masing-masing
              kartu.
            </p>
            <div className={styles.threeColRankGrid}>
              <TopThreeCard
                title="Top 3 ROI"
                hint="Gross revenue ÷ Cost"
                entries={topRoi}
                maxValue={topRoi[0]?.roi ?? 1}
                formatValue={(c) => formatRoi(c.roi)}
                barClass={styles.barFillRoi}
                pctForRow={(c, max) => (max > 0 && c.roi !== null ? (c.roi / max) * 100 : 0)}
              />
              <TopThreeCard
                title="Top 3 GMV"
                hint="Gross revenue"
                entries={topGmv}
                maxValue={topGmv[0]?.grossRevenue ?? 1}
                formatValue={(c) => `Rp ${formatIdr(c.grossRevenue)}`}
                barClass={styles.barFillGmv}
                pctForRow={(c, max) => (max > 0 ? (c.grossRevenue / max) * 100 : 0)}
              />
              <TopThreeCard
                title="Top 3 spending"
                hint="Cost"
                entries={topSpend}
                maxValue={topSpend[0]?.cost ?? 1}
                formatValue={(c) => `Rp ${formatIdr(c.cost)}`}
                barClass={styles.barFillSpend}
                pctForRow={(c, max) => (max > 0 ? (c.cost / max) * 100 : 0)}
              />
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Per kampanye</h3>
            <p className={styles.sectionHint}>
              Hanya Cost &gt; 0; urut Cost tertinggi. ROI per baris = Gross revenue ÷ Cost.
            </p>
            <CampaignTable rows={tableRows} />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function TopThreeCard({
  title,
  hint,
  entries,
  maxValue,
  formatValue,
  barClass,
  pctForRow,
}: {
  title: string;
  hint: string;
  entries: TiktokAdsCampaignAggregate[];
  maxValue: number;
  formatValue: (c: TiktokAdsCampaignAggregate) => string;
  barClass: string;
  pctForRow: (c: TiktokAdsCampaignAggregate, max: number) => number;
}) {
  if (entries.length === 0) {
    return (
      <div className={styles.rankInfographicCard}>
        <h4 className={styles.rankInfographicTitle}>{title}</h4>
        <p className={styles.rankInfographicHint}>{hint}</p>
        <p className={styles.empty}>Tidak ada data (perlu kampanye dengan Cost &gt; 0).</p>
      </div>
    );
  }

  const max = maxValue > 0 ? maxValue : 1;

  return (
    <div className={styles.rankInfographicCard}>
      <h4 className={styles.rankInfographicTitle}>{title}</h4>
      <p className={styles.rankInfographicHint}>{hint}</p>
      {entries.map((c, i) => {
        const pct = Math.min(100, Math.max(0, pctForRow(c, max)));
        return (
          <div key={c.campaignName} className={styles.barRankRow}>
            <div className={styles.barRankHeader}>
              <span className={styles.barRankBadge}>{i + 1}</span>
              <span className={styles.barCampaignName} title={c.campaignName}>
                {c.campaignName}
              </span>
              <span className={styles.barValueCompact}>{formatValue(c)}</span>
            </div>
            <div className={styles.barTrackTall}>
              <div className={barClass} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CampaignTable({ rows }: { rows: TiktokAdsCampaignAggregate[] }) {
  if (rows.length === 0) {
    return <p className={styles.empty}>Tidak ada kampanye dengan spending (Cost &gt; 0).</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Cost</th>
            <th>Net Cost</th>
            <th>Daily budget</th>
            <th>GMV</th>
            <th>ROI</th>
            <th>SKU orders</th>
            <th>Cost / order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.campaignName}>
              <td>
                <span className={styles.adName}>{c.campaignName}</span>
              </td>
              <td className={styles.numCell}>Rp {formatIdr(c.cost)}</td>
              <td className={styles.numCell}>Rp {formatIdr(c.netCost)}</td>
              <td className={styles.numCell}>Rp {formatIdr(c.currentBudget)}</td>
              <td className={styles.numCell}>Rp {formatIdr(c.grossRevenue)}</td>
              <td className={styles.numCell}>{formatRoi(c.roi)}</td>
              <td className={styles.numCell}>{formatIdr(c.skuOrders)}</td>
              <td className={styles.numCell}>
                {c.costPerOrder !== null ? `Rp ${formatIdr(c.costPerOrder)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
