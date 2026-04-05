'use client';

import { useCallback, useState } from 'react';
import boardStyles from '@/components/board/board-client.module.css';
import {
  maxSpendForBars,
  parseMetaExport,
  summarizeMetaRows,
  type AdSetSummary,
  type ReportSummary,
} from '@/lib/report-generator/meta-csv';
import styles from './ReportGeneratorPanel.module.css';

function formatIdr(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** Subtitle under Results (Meta-style). */
function humanizeResultType(raw: string): string {
  const t = raw.trim();
  if (!t || t === '—') return 'Hasil';
  const lower = t.toLowerCase();
  if (lower === 'reach') return 'Reach';
  if (lower === 'messaging conversations started') return 'Percakapan pesan (WA / DM)';
  if (lower === 'link clicks' || lower.includes('link click')) return 'Klik tautan';
  return t;
}

function cprSubtitle(dominantResultType: string): string {
  const t = dominantResultType.trim().toLowerCase();
  if (t === 'reach') return 'Per 1.000 orang jangkauan (sama seperti Meta)';
  const h = humanizeResultType(dominantResultType);
  if (h === 'Hasil') return 'Per hasil (agregat ad set)';
  return `Per hasil · ${h}`;
}

export function ReportGeneratorPanel() {
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const processText = useCallback((text: string, name: string | null) => {
    setError(null);
    const parsed = parseMetaExport(text);
    if (parsed.error) {
      setSummary(null);
      setError(parsed.error);
      setFileName(name);
      return;
    }
    setSummary(summarizeMetaRows(parsed.rows));
    setFileName(name);
  }, []);

  const onFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        processText(text, file.name);
      };
      reader.onerror = () => setError('Gagal membaca file.');
      reader.readAsText(file, 'UTF-8');
    },
    [processText]
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const maxBar = summary ? maxSpendForBars(summary.spendByObjective) : 1;

  return (
    <div
      id={summary ? 'meta-report-print' : undefined}
      className={summary ? styles.printRoot : undefined}
      data-report-ui="adset-cpr-v2"
    >
      <section className={`${boardStyles.overviewHero} ${styles.reportHero}`}>
        <div className={styles.heroTextCol}>
          <p className={boardStyles.heroEyebrow}>Report Generator</p>
          <h2 className={boardStyles.heroTitle}>Laporan Meta Ads</h2>
          <p className={`${boardStyles.heroDescription} ${styles.heroDescriptionTight}`}>
            Unggah CSV dari Meta Ads Manager. Fokus: <strong>total spending</strong>,{' '}
            <strong>average cost per result</strong>, dan <strong>results</strong> (pesan WA, klik, reach,
            dll.) — dihitung per <strong>ad set</strong>, bukan per iklan.
          </p>
          <div className={`${styles.uploadRow} ${summary ? styles.noPrint : ''}`}>
            <label className={styles.fileLabel}>
              <input
                type="file"
                accept=".csv,text/csv"
                className={styles.fileInput}
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              Pilih file CSV
            </label>
            {fileName ? <span className={styles.fileName}>{fileName}</span> : null}
            {summary ? (
              <button type="button" className={styles.printBtn} onClick={handlePrint}>
                Ekspor PDF (print)
              </button>
            ) : null}
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
        {summary ? (
          <div className={`${boardStyles.heroStatsGrid} ${styles.heroMetrics}`}>
            <div className={`${boardStyles.metricCard} ${styles.metricCardLift}`}>
              <p className={boardStyles.metricLabel}>Total spending</p>
              <p className={boardStyles.metricValue}>Rp {formatIdr(summary.totalSpendIdr)}</p>
              <p className={styles.metricSub}>Total belanja iklan di periode (semua baris CSV)</p>
            </div>
            <div className={`${boardStyles.metricCard} ${styles.metricCardLift}`}>
              <p className={boardStyles.metricLabel}>Average cost per result</p>
              <p className={boardStyles.metricValue}>
                {summary.blendedCostPerResult !== null
                  ? `Rp ${formatIdr(summary.blendedCostPerResult)}`
                  : '—'}
              </p>
              <p className={styles.metricSub}>
                Rata akun; untuk Reach = biaya per 1.000 jangkauan (selaras Meta)
              </p>
            </div>
            <div className={`${boardStyles.metricCard} ${styles.metricCardLift}`}>
              <p className={boardStyles.metricLabel}>Results</p>
              <p className={boardStyles.metricValue}>{formatIdr(summary.totalResultsSum)}</p>
              <p className={styles.metricSub}>
                {summary.dominantResultType
                  ? `Mayoritas spending: ${humanizeResultType(summary.dominantResultType)}`
                  : 'Jumlah dari kolom Results'}
              </p>
            </div>
          </div>
        ) : (
          <div className={`${boardStyles.heroStatsGrid} ${styles.heroMetrics}`}>
            <div className={`${boardStyles.metricCard} ${styles.placeholderCard}`}>
              <p className={boardStyles.metricLabel}>Total spending</p>
              <p className={boardStyles.metricValue}>—</p>
            </div>
            <div className={`${boardStyles.metricCard} ${styles.placeholderCard}`}>
              <p className={boardStyles.metricLabel}>Average cost per result</p>
              <p className={boardStyles.metricValue}>—</p>
            </div>
            <div className={`${boardStyles.metricCard} ${styles.placeholderCard}`}>
              <p className={boardStyles.metricLabel}>Results</p>
              <p className={boardStyles.metricValue}>—</p>
            </div>
          </div>
        )}
      </section>

      {summary ? (
        <div className={styles.reportBody}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Periode</h3>
            <p className={styles.period}>{summary.periodLabel}</p>
            <p className={styles.meta}>
              {summary.rowCount} baris · Average CPR{' '}
              {summary.blendedCostPerResult !== null
                ? `Rp ${formatIdr(summary.blendedCostPerResult)}`
                : '—'}{' '}
              · CPM {summary.overallCpm !== null ? `Rp ${formatIdr(summary.overallCpm)}` : '—'}
            </p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Ringkasan eksekutif</h3>
            <div className={styles.infographic}>
              <div className={styles.infoTile}>
                <p className={styles.infoTileLabel}>Total spending</p>
                <p className={styles.infoTileValue}>Rp {formatIdr(summary.totalSpendIdr)}</p>
              </div>
              <div className={styles.infoTile}>
                <p className={styles.infoTileLabel}>Average cost per result</p>
                <p className={styles.infoTileValue}>
                  {summary.blendedCostPerResult !== null
                    ? `Rp ${formatIdr(summary.blendedCostPerResult)}`
                    : '—'}
                </p>
              </div>
              <div className={styles.infoTile}>
                <p className={styles.infoTileLabel}>Results</p>
                <p className={styles.infoTileValue}>{formatIdr(summary.totalResultsSum)}</p>
              </div>
              <div className={styles.infoTile}>
                <p className={styles.infoTileLabel}>Hasil utama (by spending)</p>
                <p className={`${styles.infoTileValue} ${styles.infoTileValueSmall}`}>
                  {summary.dominantResultType
                    ? humanizeResultType(summary.dominantResultType)
                    : '—'}
                </p>
              </div>
            </div>
            <p className={styles.infographicFootnote}>{summary.executiveFootnote}</p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Alokasi spending (Awareness vs Sales)</h3>
            <div className={styles.barChart}>
              {summary.spendByObjective.map((b) => (
                <div key={b.label} className={styles.barRow}>
                  <span className={styles.barLabel}>{b.label}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${Math.min(100, (b.spend / maxBar) * 100)}%` }}
                    />
                  </div>
                  <span className={styles.barValue}>Rp {formatIdr(b.spend)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.fourGrid}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Top 3 ad set — CPR terendah</h3>
              <p className={styles.sectionHint}>Paling efisien: cost per result terendah (min. ada hasil).</p>
              <AdSetTable
                entries={summary.adSetRankings.bestCpr}
                empty="Tidak ada ad set dengan hasil & CPR yang valid."
              />
            </section>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Top 3 ad set — Results tertinggi</h3>
              <p className={styles.sectionHint}>Volume hasil terbesar (agregat per ad set).</p>
              <AdSetTable
                entries={summary.adSetRankings.mostResults}
                empty="Tidak ada ad set dengan hasil positif."
              />
            </section>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Top 3 ad set — CPR tertinggi</h3>
              <p className={styles.sectionHint}>
                Paling mahal per hasil. Hanya ad set dengan spending ≥ Rp 5.000 (kurangi noise).
              </p>
              <AdSetTable
                entries={summary.adSetRankings.worstCpr}
                empty="Tidak ada ad set yang memenuhi ambang spending untuk ranking ini."
              />
            </section>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Top 3 ad set — Results terendah</h3>
              <p className={styles.sectionHint}>
                Hasil paling sedikit; prioritas ad set dengan spending bermakna (≥ Rp 5.000 jika ada).
              </p>
              <AdSetTable
                entries={summary.adSetRankings.fewestResults}
                empty="Tidak ada data ad set untuk ranking ini."
              />
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdSetTable({ entries, empty }: { entries: AdSetSummary[]; empty: string }) {
  if (entries.length === 0) {
    return <p className={styles.empty}>{empty}</p>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Ad set</th>
            <th>Results</th>
            <th>Cost per result</th>
            <th>Spending</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.adSetName}>
              <td>
                <span className={styles.adName}>{e.adSetName}</span>
              </td>
              <td>
                <span className={styles.resultCount}>{formatIdr(e.results)}</span>
                <span className={styles.resultTypeLabel}>{humanizeResultType(e.dominantResultType)}</span>
              </td>
              <td>
                <span className={styles.metaCellPrimary}>
                  {e.costPerResult !== null ? `Rp ${formatIdr(e.costPerResult)}` : '—'}
                </span>
                <span className={styles.metaCellSecondary}>{cprSubtitle(e.dominantResultType)}</span>
              </td>
              <td className={styles.numCell}>Rp {formatIdr(e.spend)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
