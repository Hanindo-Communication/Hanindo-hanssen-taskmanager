'use client';

import { useCallback, useState } from 'react';
import boardStyles from '@/components/board/board-client.module.css';
import {
  maxSpendForBars,
  parseMetaExport,
  summarizeMetaRows,
  type ReportSummary,
} from '@/lib/report-generator/meta-csv';
import styles from './ReportGeneratorPanel.module.css';

function formatIdr(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatPct(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(2)}%`;
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
    >
      <section className={boardStyles.overviewHero}>
        <div>
          <p className={boardStyles.heroEyebrow}>Report Generator</p>
          <h2 className={boardStyles.heroTitle}>Laporan Meta Ads</h2>
          <p className={boardStyles.heroDescription}>
            Unggah CSV dari Meta Ads Manager. Ringkasan otomatis: biaya, tayangan, performa terbaik, dan
            ekspor PDF lewat print.
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
          <div className={boardStyles.heroStatsGrid}>
            <div className={boardStyles.metricCard}>
              <p className={boardStyles.metricLabel}>Total spend</p>
              <p className={boardStyles.metricValue}>Rp {formatIdr(summary.totalSpendIdr)}</p>
            </div>
            <div className={boardStyles.metricCard}>
              <p className={boardStyles.metricLabel}>Impressions</p>
              <p className={boardStyles.metricValue}>{formatIdr(summary.totalImpressions)}</p>
            </div>
            <div className={boardStyles.metricCard}>
              <p className={boardStyles.metricLabel}>Link clicks</p>
              <p className={boardStyles.metricValue}>{formatIdr(summary.totalLinkClicks)}</p>
            </div>
          </div>
        ) : (
          <div className={boardStyles.heroStatsGrid}>
            <div className={`${boardStyles.metricCard} ${styles.placeholderCard}`}>
              <p className={boardStyles.metricLabel}>Menunggu file</p>
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
              {summary.rowCount} baris iklan · CPM gabungan{' '}
              {summary.overallCpm !== null ? `Rp ${formatIdr(summary.overallCpm)}` : '—'} · CTR link{' '}
              {formatPct(summary.overallCtr)}
            </p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Ringkasan eksekutif</h3>
            <ul className={styles.bullets}>
              {summary.executiveBullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Alokasi biaya (Awareness vs Sales)</h3>
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

          <div className={styles.twoCol}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Top 3 iklan — Reach (efisiensi hasil/biaya)</h3>
              <TopAdTable entries={summary.topReachAds} empty="Tidak ada baris Reach dengan data cukup." />
            </section>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Top 3 iklan — Percakapan pesan</h3>
              <TopAdTable
                entries={summary.topMessagingAds}
                empty="Tidak ada data percakapan pesan di file ini."
              />
            </section>
          </div>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Top 3 iklan — CTR link (min. tayangan &amp; biaya)</h3>
            <p className={styles.hint}>
              Hanya iklan dengan tayangan ≥ 800 dan spend ≥ Rp 5.000 untuk mengurangi noise.
            </p>
            <TopAdTable entries={summary.topEngagementAds} empty="Tidak ada baris yang memenuhi ambang CTR." />
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Top 3 ad set (by spend)</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ad set</th>
                  <th>Spend</th>
                  <th>Impr.</th>
                  <th>Klik</th>
                  <th>CPM</th>
                </tr>
              </thead>
              <tbody>
                {summary.topAdSets.map((a) => (
                  <tr key={a.name}>
                    <td>{a.name}</td>
                    <td>Rp {formatIdr(a.spend)}</td>
                    <td>{formatIdr(a.impressions)}</td>
                    <td>{formatIdr(a.linkClicks)}</td>
                    <td>{a.cpm !== null ? `Rp ${formatIdr(a.cpm)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function TopAdTable({
  entries,
  empty,
}: {
  entries: ReportSummary['topReachAds'];
  empty: string;
}) {
  if (entries.length === 0) {
    return <p className={styles.empty}>{empty}</p>;
  }
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Iklan</th>
          <th>Skor</th>
          <th>Spend</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={`${e.adName}-${e.adSetName}-${i}`}>
            <td>
              <span className={styles.adName}>{e.adName}</span>
              <span className={styles.adMeta}>{e.adSetName}</span>
            </td>
            <td>
              {e.scoreLabel === 'CTR link' ? (
                <span>{formatPct(e.scoreValue)}</span>
              ) : (
                <span>
                  {(e.scoreValue * 1_000_000).toFixed(2)}
                  <span className={styles.scoreHint}> hasil / juta Rp</span>
                </span>
              )}
            </td>
            <td>Rp {formatIdr(e.spend)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
