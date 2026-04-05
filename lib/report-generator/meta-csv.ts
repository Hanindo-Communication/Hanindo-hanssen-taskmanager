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

export type TopAdEntry = {
  adName: string;
  adSetName: string;
  campaignName: string;
  scoreLabel: string;
  scoreValue: number;
  spend: number;
  impressions: number;
  resultType: string;
};

export type TopAdSetEntry = {
  name: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  cpm: number | null;
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
  totalLinkClicks: number;
  overallCtr: number | null;
  overallCpm: number | null;
  maxReachSingleAd: number;
  topReachAds: TopAdEntry[];
  topMessagingAds: TopAdEntry[];
  topEngagementAds: TopAdEntry[];
  topAdSets: TopAdSetEntry[];
  spendByObjective: SpendBucket[];
  executiveBullets: string[];
};

const REQUIRED_HEADERS = [
  'campaign name',
  'ad set name',
  'ad name',
  'amount spent (idr)',
  'impressions',
];

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

function campaignBucket(campaignName: string): string {
  const upper = campaignName.toUpperCase();
  if (upper.includes('AWARENESS')) return 'Awareness';
  if (upper.includes('SALES')) return 'Sales';
  const first = campaignName.split('_')[0] ?? campaignName;
  return first.length > 24 ? `${first.slice(0, 24)}…` : first;
}

function pickTopReach(rows: MetaAdRow[]): TopAdEntry[] {
  const candidates = rows.filter(
    (r) =>
      r.resultType.toLowerCase() === 'reach' &&
      r.amountSpentIdr > 0 &&
      r.results > 0
  );
  const scored = candidates.map((r) => {
    const efficiency = r.results / r.amountSpentIdr;
    return {
      adName: r.adName,
      adSetName: r.adSetName,
      campaignName: r.campaignName,
      scoreLabel: 'Hasil / biaya (reach per Rp)',
      scoreValue: efficiency,
      spend: r.amountSpentIdr,
      impressions: r.impressions,
      resultType: r.resultType,
    };
  });
  scored.sort((a, b) => b.scoreValue - a.scoreValue);
  return scored.slice(0, 3);
}

function pickTopMessaging(rows: MetaAdRow[]): TopAdEntry[] {
  const rt = 'messaging conversations started';
  const candidates = rows.filter(
    (r) => r.resultType.toLowerCase() === rt && r.amountSpentIdr > 0 && r.results > 0
  );
  const scored = candidates.map((r) => {
    const efficiency = r.results / r.amountSpentIdr;
    return {
      adName: r.adName,
      adSetName: r.adSetName,
      campaignName: r.campaignName,
      scoreLabel: 'Percakapan / biaya',
      scoreValue: efficiency,
      spend: r.amountSpentIdr,
      impressions: r.impressions,
      resultType: r.resultType,
    };
  });
  scored.sort((a, b) => b.scoreValue - a.scoreValue);
  return scored.slice(0, 3);
}

const MIN_IMPRESSIONS_CTR = 800;
const MIN_SPEND_IDR = 5000;

function pickTopEngagement(rows: MetaAdRow[]): TopAdEntry[] {
  const candidates = rows.filter(
    (r) =>
      r.impressions >= MIN_IMPRESSIONS_CTR &&
      r.amountSpentIdr >= MIN_SPEND_IDR &&
      r.ctrLink !== null &&
      r.ctrLink > 0
  );
  const scored = candidates.map((r) => ({
    adName: r.adName,
    adSetName: r.adSetName,
    campaignName: r.campaignName,
    scoreLabel: 'CTR link',
    scoreValue: r.ctrLink!,
    spend: r.amountSpentIdr,
    impressions: r.impressions,
    resultType: r.resultType || '—',
  }));
  scored.sort((a, b) => b.scoreValue - a.scoreValue);
  return scored.slice(0, 3);
}

function aggregateAdSets(rows: MetaAdRow[]): TopAdSetEntry[] {
  const map = new Map<string, { spend: number; impressions: number; clicks: number }>();
  for (const r of rows) {
    const key = r.adSetName || '(Tanpa nama)';
    const cur = map.get(key) ?? { spend: 0, impressions: 0, clicks: 0 };
    cur.spend += r.amountSpentIdr;
    cur.impressions += r.impressions;
    cur.clicks += r.linkClicks;
    map.set(key, cur);
  }
  const list: TopAdSetEntry[] = Array.from(map.entries()).map(([name, v]) => ({
    name,
    spend: v.spend,
    impressions: v.impressions,
    linkClicks: v.clicks,
    cpm: v.impressions > 0 ? (v.spend / v.impressions) * 1000 : null,
  }));
  list.sort((a, b) => b.spend - a.spend);
  return list.slice(0, 3);
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
  const totalLinkClicks = rows.reduce((s, r) => s + r.linkClicks, 0);
  const overallCtr =
    totalImpressions > 0 ? totalLinkClicks / totalImpressions : null;
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

  const topReachAds = pickTopReach(rows);
  const topMessagingAds = pickTopMessaging(rows);
  const topEngagementAds = pickTopEngagement(rows);
  const topAdSets = aggregateAdSets(rows);
  const spendByObjective = spendByCampaignBucket(rows);

  const bullets: string[] = [
    `Total investasi iklan dalam periode: Rp ${formatIdr(totalSpendIdr)}.`,
    `Tayangan terkumpul ${formatIdr(totalImpressions)} dengan ${formatIdr(totalLinkClicks)} klik ke tautan${
      overallCtr !== null ? ` (CTR gabungan ${(overallCtr * 100).toFixed(2)}%)` : ''
    }.`,
    `Reach tidak dijumlahkan antar iklan (untuk menghindari double counting); reach tertinggi satu iklan: ${formatIdr(maxReachSingleAd)}.`,
  ];
  if (topReachAds[0]) {
    bullets.push(
      `Iklan reach paling efisien (hasil dibanding biaya): “${topReachAds[0].adName}”.`
    );
  }
  if (topAdSets[0]) {
    bullets.push(
      `Ad set dengan spend tertinggi: “${topAdSets[0].name}” (Rp ${formatIdr(topAdSets[0].spend)}).`
    );
  }

  return {
    periodLabel,
    reportingStarts,
    reportingEnds,
    rowCount: rows.length,
    totalSpendIdr,
    totalImpressions,
    totalLinkClicks,
    overallCtr,
    overallCpm,
    maxReachSingleAd,
    topReachAds,
    topMessagingAds,
    topEngagementAds,
    topAdSets,
    spendByObjective,
    executiveBullets: bullets,
  };
}

export function maxSpendForBars(buckets: SpendBucket[]): number {
  if (buckets.length === 0) return 1;
  return Math.max(...buckets.map((b) => b.spend), 1);
}
