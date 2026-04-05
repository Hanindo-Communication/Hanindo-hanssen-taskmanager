import Papa from 'papaparse';

/** Normalized row from Meta Ads export (ad level). */
export type MetaAdRow = {
  campaignName: string;
  adSetName: string;
  adName: string;
  deliveryStatus: string;
  deliveryLevel: string;
  reach: number;
  impressions: number;
  frequency: number;
  resultType: string;
  results: number;
  costPerResult: number | null;
  amountSpentIdr: number;
  linkClicks: number;
  ctrLink: number | null;
  cpm: number | null;
  reportingStarts: string;
  reportingEnds: string;
};

/** Aggregated metrics per ad set (summed across all ad rows in that set). */
export type AdSetSummary = {
  adSetName: string;
  spend: number;
  results: number;
  /**
   * Selaras UI Meta: untuk dominant Reach = biaya per 1.000 orang jangkauan; selain itu = biaya per hasil.
   */
  costPerResult: number | null;
  /** Result type with the highest spend within this ad set (for subtitle under Results). */
  dominantResultType: string;
};

export type AdSetRankings = {
  /** CPR terendah (paling efisien) */
  bestCpr: AdSetSummary[];
  /** Volume hasil tertinggi */
  mostResults: AdSetSummary[];
  /** CPR tertinggi (paling mahal), min. spending untuk mengurangi noise */
  worstCpr: AdSetSummary[];
  /** Hasil terendah (dengan spending berarti) */
  fewestResults: AdSetSummary[];
};

export type SpendBucket = {
  label: string;
  spend: number;
};

export type ReportSummary = {
  periodLabel: string;
  reportingStarts: string;
  reportingEnds: string;
  rowCount: number;
  totalSpendIdr: number;
  totalImpressions: number;
  totalResultsSum: number;
  blendedCostPerResult: number | null;
  dominantResultType: string | null;
  overallCpm: number | null;
  maxReachSingleAd: number;
  adSetRankings: AdSetRankings;
  spendByObjective: SpendBucket[];
  /** Catatan singkat untuk di bawah infographic (reach / agregasi). */
  executiveFootnote: string;
};

const REQUIRED_HEADERS = [
  'campaign name',
  'ad set name',
  'ad name',
  'amount spent (idr)',
  'impressions',
];

const MIN_SPEND_IDR_NOISE = 5000;

/**
 * Selaras dengan kolom Meta "Cost per result" saat hasil = Reach: biaya per **1.000 orang**
 * jangkauan (bukan per satu orang). Tanpa faktor 1000, spend/results jadi ~Rp 1–2 dan keliru.
 */
function metaAlignedCostPerResultIdr(
  spend: number,
  results: number,
  dominantResultType: string
): number | null {
  if (results <= 0 || spend <= 0) return null;
  const perSingleResultUnit = spend / results;
  const t = dominantResultType.trim().toLowerCase();
  if (t === 'reach') {
    return perSingleResultUnit * 1000;
  }
  return perSingleResultUnit;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function parseNumber(raw: string | number | undefined | null): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const s = String(raw).trim().replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseNullableNumber(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = parseNumber(raw);
  return n === 0 && String(raw).trim() === '' ? null : n;
}

function getField(row: Record<string, string>, ...candidates: string[]): string {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find((k) => normalizeHeader(k) === normalizeHeader(c));
    if (found !== undefined) return String(row[found] ?? '').trim();
  }
  return '';
}

function rowToMetaAd(row: Record<string, string>): MetaAdRow {
  const amountSpentIdr = parseNumber(getField(row, 'Amount spent (IDR)'));
  const impressions = parseNumber(getField(row, 'Impressions'));
  const linkClicks = parseNumber(getField(row, 'Link clicks'));
  const spend = amountSpentIdr;
  const cpmRaw = parseNullableNumber(getField(row, 'CPM (cost per 1,000 impressions)'));
  return {
    campaignName: getField(row, 'Campaign name'),
    adSetName: getField(row, 'Ad set name'),
    adName: getField(row, 'Ad name'),
    deliveryStatus: getField(row, 'Delivery status'),
    deliveryLevel: getField(row, 'Delivery level'),
    reach: parseNumber(getField(row, 'Reach')),
    impressions,
    frequency: parseNumber(getField(row, 'Frequency')),
    resultType: getField(row, 'Result type'),
    results: parseNumber(getField(row, 'Results')),
    costPerResult: parseNullableNumber(getField(row, 'Cost per result')),
    amountSpentIdr: spend,
    linkClicks,
    ctrLink: parseNullableNumber(getField(row, 'CTR (link click-through rate)')),
    cpm: cpmRaw,
    reportingStarts: getField(row, 'Reporting starts'),
    reportingEnds: getField(row, 'Reporting ends'),
  };
}

export function parseMetaExport(csvText: string): { rows: MetaAdRow[]; error?: string } {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0 && !result.data?.length) {
    return { rows: [], error: result.errors[0]?.message ?? 'Gagal membaca CSV' };
  }

  const headers = result.meta.fields?.map((h) => normalizeHeader(h ?? '')) ?? [];
  const ok = REQUIRED_HEADERS.every((req) => headers.includes(req));
  if (!ok) {
    return {
      rows: [],
      error:
        'Format CSV tidak dikenali. Pastikan export Meta Ads berisi kolom Campaign name, Ad set name, Ad name, Amount spent (IDR), Impressions.',
    };
  }

  const rows: MetaAdRow[] = [];
  for (const r of result.data) {
    if (!r || Object.keys(r).length === 0) continue;
    const campaign = getField(r, 'Campaign name');
    if (!campaign && !getField(r, 'Ad name')) continue;
    rows.push(rowToMetaAd(r));
  }

  return { rows };
}

function formatIdr(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function dominantResultTypeBySpend(rows: MetaAdRow[]): string | null {
  const map = new Map<string, number>();
  for (const r of rows) {
    const t = r.resultType?.trim();
    if (!t) continue;
    map.set(t, (map.get(t) ?? 0) + r.amountSpentIdr);
  }
  let best: string | null = null;
  let bestSpend = 0;
  for (const [t, s] of map) {
    if (s > bestSpend) {
      bestSpend = s;
      best = t;
    }
  }
  return best;
}

function campaignBucket(campaignName: string): string {
  const upper = campaignName.toUpperCase();
  if (upper.includes('AWARENESS')) return 'Awareness';
  if (upper.includes('SALES')) return 'Sales';
  const first = campaignName.split('_')[0] ?? campaignName;
  return first.length > 24 ? `${first.slice(0, 24)}…` : first;
}

function aggregateAdSetSummaries(rows: MetaAdRow[]): AdSetSummary[] {
  const map = new Map<string, { spend: number; results: number; typeSpend: Map<string, number> }>();
  for (const r of rows) {
    const key = r.adSetName?.trim() || '(Tanpa nama)';
    let cur = map.get(key);
    if (!cur) {
      cur = { spend: 0, results: 0, typeSpend: new Map() };
      map.set(key, cur);
    }
    cur.spend += r.amountSpentIdr;
    cur.results += r.results;
    const rt = r.resultType?.trim();
    if (rt) {
      cur.typeSpend.set(rt, (cur.typeSpend.get(rt) ?? 0) + r.amountSpentIdr);
    }
  }

  const out: AdSetSummary[] = [];
  for (const [adSetName, v] of map) {
    let dominant = '';
    let maxS = 0;
    for (const [t, s] of v.typeSpend) {
      if (s > maxS) {
        maxS = s;
        dominant = t;
      }
    }
    const dt = dominant || '—';
    const costPerResult = metaAlignedCostPerResultIdr(v.spend, v.results, dt);
    out.push({
      adSetName,
      spend: v.spend,
      results: v.results,
      costPerResult,
      dominantResultType: dt,
    });
  }
  return out;
}

function rankBestCpr(list: AdSetSummary[]): AdSetSummary[] {
  const eligible = list.filter((a) => a.costPerResult !== null && a.results > 0);
  eligible.sort((a, b) => a.costPerResult! - b.costPerResult!);
  return eligible.slice(0, 3);
}

function rankMostResults(list: AdSetSummary[]): AdSetSummary[] {
  const eligible = list.filter((a) => a.results > 0);
  eligible.sort((a, b) => b.results - a.results);
  return eligible.slice(0, 3);
}

function rankWorstCpr(list: AdSetSummary[]): AdSetSummary[] {
  const eligible = list.filter(
    (a) => a.costPerResult !== null && a.results > 0 && a.spend >= MIN_SPEND_IDR_NOISE
  );
  eligible.sort((a, b) => b.costPerResult! - a.costPerResult!);
  return eligible.slice(0, 3);
}

function rankFewestResults(list: AdSetSummary[]): AdSetSummary[] {
  let eligible = list.filter((a) => a.spend >= MIN_SPEND_IDR_NOISE);
  eligible.sort((a, b) => {
    if (a.results !== b.results) return a.results - b.results;
    return b.spend - a.spend;
  });
  if (eligible.length === 0) {
    eligible = list.filter((a) => a.spend > 0);
    eligible.sort((a, b) => {
      if (a.results !== b.results) return a.results - b.results;
      return b.spend - a.spend;
    });
  }
  return eligible.slice(0, 3);
}

function spendByCampaignBucket(rows: MetaAdRow[]): SpendBucket[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const b = campaignBucket(r.campaignName);
    map.set(b, (map.get(b) ?? 0) + r.amountSpentIdr);
  }
  return Array.from(map.entries())
    .map(([label, spend]) => ({ label, spend }))
    .sort((a, b) => b.spend - a.spend);
}

export function summarizeMetaRows(rows: MetaAdRow[]): ReportSummary {
  const totalSpendIdr = rows.reduce((s, r) => s + r.amountSpentIdr, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const overallCpm =
    totalImpressions > 0 ? (totalSpendIdr / totalImpressions) * 1000 : null;
  const maxReachSingleAd = rows.reduce((m, r) => Math.max(m, r.reach), 0);

  let reportingStarts = '';
  let reportingEnds = '';
  for (const r of rows) {
    if (r.reportingStarts) reportingStarts = r.reportingStarts;
    if (r.reportingEnds) reportingEnds = r.reportingEnds;
    break;
  }
  const periodLabel =
    reportingStarts && reportingEnds
      ? `${reportingStarts} – ${reportingEnds}`
      : 'Periode dari file';

  const adSetList = aggregateAdSetSummaries(rows);
  const adSetRankings: AdSetRankings = {
    bestCpr: rankBestCpr(adSetList),
    mostResults: rankMostResults(adSetList),
    worstCpr: rankWorstCpr(adSetList),
    fewestResults: rankFewestResults(adSetList),
  };

  const spendByObjective = spendByCampaignBucket(rows);
  const totalResultsSum = rows.reduce((s, r) => s + r.results, 0);
  const dominantResultType = dominantResultTypeBySpend(rows);
  const blendedCostPerResult =
    totalResultsSum > 0
      ? metaAlignedCostPerResultIdr(totalSpendIdr, totalResultsSum, dominantResultType ?? '—')
      : null;

  const executiveFootnote = `Reach tidak dijumlahkan antar baris (anti double count). Reach tertinggi satu baris: ${formatIdr(maxReachSingleAd)}. Untuk tipe Reach, cost per result diselaraskan dengan Meta: biaya per 1.000 orang jangkauan (bukan per satu orang). Jika beberapa tipe hasil tercampur dalam satu ad set, angka bersifat perkiraan.`;

  return {
    periodLabel,
    reportingStarts,
    reportingEnds,
    rowCount: rows.length,
    totalSpendIdr,
    totalImpressions,
    totalResultsSum,
    blendedCostPerResult,
    dominantResultType,
    overallCpm,
    maxReachSingleAd,
    adSetRankings,
    spendByObjective,
    executiveFootnote,
  };
}

export function maxSpendForBars(buckets: SpendBucket[]): number {
  if (buckets.length === 0) return 1;
  return Math.max(...buckets.map((b) => b.spend), 1);
}
