import Papa from 'papaparse';

/** One product row after parsing + dimension extraction. */
export type TiktokProductRow = {
  skuId: string;
  productId: string;
  produkRaw: string;
  status: string;
  gmvIdr: number;
  pesananSku: number;
  produkTerjual: number;
  name: string;
  size: string | null;
  pcs: number | null;
};

export type StatusBreakdown = {
  status: string;
  gmvIdr: number;
  pesananSku: number;
  produkTerjual: number;
  rowCount: number;
};

export type TiktokChartSlice = {
  label: string;
  gmvIdr: number;
};

export type TiktokReportSummary = {
  periodLabel: string | null;
  rowCount: number;
  uniqueSkuCount: number;
  totalGmvIdr: number;
  totalPesananSku: number;
  totalProdukTerjual: number;
  byStatus: StatusBreakdown[];
  topGmv: TiktokProductRow[];
  topUnits: TiktokProductRow[];
  gmvChartSlices: TiktokChartSlice[];
  statusGmvChartSlices: TiktokChartSlice[];
};

const PERIOD_LINE_RE = /(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/;
const TOP_CHART = 8;
const TOP_TABLE = 15;

function normalizeCell(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function normalizeHeaderKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\u00a0/g, ' ');
}

/** Map normalized header label to canonical field key. */
function headerToFieldKey(cell: string): string | null {
  const n = normalizeHeaderKey(cell);
  if (n === 'sku id' || /^sku\s*id$/.test(n)) return 'skuId';
  if (n === 'product id' || /^product\s*id$/.test(n)) return 'productId';
  if (n === 'produk' || n === 'product' || n === 'product name') return 'produk';
  if (n === 'status') return 'status';
  if (n === 'gmv' || n.includes('gross merchandise')) return 'gmv';
  if (n === 'pesanan sku' || (n.includes('pesanan') && n.includes('sku'))) return 'pesananSku';
  if (n === 'produk terjual' || n.includes('produk terjual') || n === 'units sold')
    return 'produkTerjual';
  return null;
}

export function parseProdukDimensions(produk: string): {
  name: string;
  size: string | null;
  pcs: number | null;
} {
  let rest = produk.trim();
  let pcs: number | null = null;

  const pcsMatch = rest.match(/^\(\s*(\d+)\s*pcs?\s*\)\s*/i);
  if (pcsMatch) {
    pcs = parseInt(pcsMatch[1], 10);
    rest = rest.slice(pcsMatch[0].length).trim();
  }

  let size: string | null = null;
  let name = rest;
  const colonIdx = rest.lastIndexOf(':');
  if (colonIdx >= 0 && colonIdx < rest.length - 1) {
    const candidate = rest.slice(colonIdx + 1).trim();
    if (candidate.length > 0 && candidate.length <= 14) {
      size = candidate;
      name = rest.slice(0, colonIdx).trim();
    }
  }

  return { name: name || rest, size, pcs };
}

export function parseGmvIdr(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  const cleaned = s
    .replace(/^rp\.?\s*/i, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseIntMetric(raw: string): number {
  const s = raw.replace(/\./g, '').replace(/,/g, '').trim();
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

export function matrixFromCsvText(text: string): string[][] {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: false,
  });
  return (result.data as string[][]).map((row) =>
    (row ?? []).map((c) => normalizeCell(c))
  );
}

/** Find header row index and optional period from leading rows. */
export function detectTiktokLayout(rows: string[][]): {
  periodLabel: string | null;
  headerRowIndex: number;
  columnMap: Record<string, number>;
} | null {
  let periodLabel: string | null = null;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c)) continue;
    const joined = row.join(' ');
    const pm = joined.match(PERIOD_LINE_RE);
    if (pm && !row.some((c) => headerToFieldKey(c))) {
      periodLabel = `${pm[1]} – ${pm[2]}`;
    }
  }

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const columnMap: Record<string, number> = {};
    for (let j = 0; j < row.length; j++) {
      const key = headerToFieldKey(row[j]);
      if (key) columnMap[key] = j;
    }

    const hasSku = columnMap.skuId !== undefined;
    const hasProduk = columnMap.produk !== undefined;
    const hasGmv = columnMap.gmv !== undefined;

    if ((hasSku && hasProduk) || (hasSku && hasGmv) || (hasProduk && hasGmv)) {
      const required = ['skuId', 'productId', 'produk', 'status', 'gmv', 'pesananSku', 'produkTerjual'];
      const missing = required.filter((k) => columnMap[k] === undefined);
      if (missing.length === 0) {
        return { periodLabel, headerRowIndex: i, columnMap };
      }
    }
  }

  return null;
}

function rowToProduct(row: string[], columnMap: Record<string, number>): TiktokProductRow | null {
  const g = (k: string) => normalizeCell(row[columnMap[k]] ?? '');
  const skuId = g('skuId');
  const produkRaw = g('produk');
  if (!skuId && !produkRaw) return null;

  const dims = parseProdukDimensions(produkRaw);
  return {
    skuId,
    productId: g('productId'),
    produkRaw,
    status: g('status') || '—',
    gmvIdr: parseGmvIdr(g('gmv')),
    pesananSku: parseIntMetric(g('pesananSku')),
    produkTerjual: parseIntMetric(g('produkTerjual')),
    name: dims.name,
    size: dims.size,
    pcs: dims.pcs,
  };
}

export function parseTiktokMatrix(rows: string[][]): { data: TiktokProductRow[]; error?: string; periodLabel: string | null } {
  const layout = detectTiktokLayout(rows);
  if (!layout) {
    return {
      data: [],
      error:
        'Format tidak dikenali. Pastikan file memiliki baris header: SKU ID, Product ID, Produk, Status, GMV, Pesanan SKU, Produk terjual.',
      periodLabel: null,
    };
  }

  const { headerRowIndex, columnMap, periodLabel } = layout;
  const data: TiktokProductRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c)) continue;
    const p = rowToProduct(row, columnMap);
    if (p) data.push(p);
  }

  if (data.length === 0) {
    return {
      data: [],
      error: 'Tidak ada baris data di bawah header.',
      periodLabel: periodLabel ?? null,
    };
  }

  return { data, periodLabel: periodLabel ?? null };
}

export function summarizeTiktokRows(
  rows: TiktokProductRow[],
  periodLabel: string | null
): TiktokReportSummary {
  const totalGmvIdr = rows.reduce((s, r) => s + r.gmvIdr, 0);
  const totalPesananSku = rows.reduce((s, r) => s + r.pesananSku, 0);
  const totalProdukTerjual = rows.reduce((s, r) => s + r.produkTerjual, 0);
  const uniqueSkuCount = new Set(rows.map((r) => r.skuId).filter(Boolean)).size;

  const statusMap = new Map<
    string,
    { gmvIdr: number; pesananSku: number; produkTerjual: number; rowCount: number }
  >();
  for (const r of rows) {
    const k = r.status || '—';
    const cur = statusMap.get(k) ?? { gmvIdr: 0, pesananSku: 0, produkTerjual: 0, rowCount: 0 };
    cur.gmvIdr += r.gmvIdr;
    cur.pesananSku += r.pesananSku;
    cur.produkTerjual += r.produkTerjual;
    cur.rowCount += 1;
    statusMap.set(k, cur);
  }

  const byStatus: StatusBreakdown[] = Array.from(statusMap.entries())
    .map(([status, v]) => ({
      status,
      gmvIdr: v.gmvIdr,
      pesananSku: v.pesananSku,
      produkTerjual: v.produkTerjual,
      rowCount: v.rowCount,
    }))
    .sort((a, b) => b.gmvIdr - a.gmvIdr);

  const topGmv = [...rows].sort((a, b) => b.gmvIdr - a.gmvIdr).slice(0, TOP_TABLE);
  const topUnits = [...rows].sort((a, b) => b.produkTerjual - a.produkTerjual).slice(0, TOP_TABLE);

  const sortedByGmv = [...rows].sort((a, b) => b.gmvIdr - a.gmvIdr);
  const topChart = sortedByGmv.slice(0, TOP_CHART);
  const restGmv = sortedByGmv.slice(TOP_CHART).reduce((s, r) => s + r.gmvIdr, 0);
  const gmvChartSlices: TiktokChartSlice[] = topChart.map((r) => ({
    label: truncateLabel(r.name || r.skuId, 28),
    gmvIdr: r.gmvIdr,
  }));
  if (restGmv > 0) {
    gmvChartSlices.push({ label: 'Lainnya', gmvIdr: restGmv });
  }

  const statusGmvChartSlices: TiktokChartSlice[] = byStatus.map((b) => ({
    label: b.status,
    gmvIdr: b.gmvIdr,
  }));

  return {
    periodLabel,
    rowCount: rows.length,
    uniqueSkuCount,
    totalGmvIdr,
    totalPesananSku,
    totalProdukTerjual,
    byStatus,
    topGmv,
    topUnits,
    gmvChartSlices,
    statusGmvChartSlices,
  };
}

function truncateLabel(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function parseTiktokCsvText(text: string): {
  summary: TiktokReportSummary | null;
  rows: TiktokProductRow[];
  error?: string;
} {
  const matrix = matrixFromCsvText(text);
  const parsed = parseTiktokMatrix(matrix);
  if (parsed.error) {
    return { summary: null, rows: [], error: parsed.error };
  }
  const summary = summarizeTiktokRows(parsed.data, parsed.periodLabel);
  return { summary, rows: parsed.data };
}

export function maxGmvForBars(slices: TiktokChartSlice[]): number {
  if (slices.length === 0) return 1;
  return Math.max(...slices.map((s) => s.gmvIdr), 1);
}
