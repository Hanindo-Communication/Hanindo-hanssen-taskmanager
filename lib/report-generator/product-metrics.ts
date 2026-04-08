import { parseGmvIdr, parseTiktokMatrix, type TiktokProductRow } from '@/lib/report-generator/tiktok-sales';

/** Unified row for Produk Metrics UI (strict TikTok + flexible XLSX). */
export type ProductMetricRow = {
  skuId: string;
  productId: string;
  produkRaw: string;
  product_name: string;
  size: string;
  pcsLabel: string;
  status: string;
  gmv: number;
  pesanan_sku: number;
  produk_terjual: number;
};

export type ProductMetricKey = 'gmv' | 'pesanan_sku' | 'produk_terjual';

export type ProductMetricsIngestResult = {
  data: ProductMetricRow[];
  periodLabel: string | null;
  parseMode: 'tiktok-strict' | 'flexible';
  error?: string;
};

const PERIOD_LINE_RE = /(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/;

function normalize(s: string): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeader(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(s: string): string {
  return normalize(s)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Produk parsing aligned with friend’s HTML prototype. */
export function parseProdukLikeHtml(raw: string): { name: string; size: string; pcs: string } {
  const original = normalize(raw);
  let pcs = 'Unknown';
  let size = 'Unknown';
  let name = original;

  const pcsMatch = original.match(/\(?\s*(\d+)\s*Pcs\s*\)?/i);
  if (pcsMatch) {
    pcs = `${pcsMatch[1]} Pcs`;
    name = name.replace(pcsMatch[0], '').trim();
  }

  const sizeMatch = name.match(/[:\-]\s*([A-Za-z0-9]{1,5})\s*$/);
  if (sizeMatch) {
    size = sizeMatch[1].toUpperCase();
    name = name.replace(sizeMatch[0], '').trim();
  } else {
    const fallbackSize = name.match(/\b(XXXL|XXL|XL|L|M|S)\b\s*$/i);
    if (fallbackSize) {
      size = fallbackSize[1].toUpperCase();
      name = name.replace(new RegExp(`${fallbackSize[1]}\\s*$`, 'i'), '').trim();
    }
  }

  name = name.replace(/^[-–:]+|[-–:]+$/g, '').trim();
  return { name: titleCase(name), size, pcs };
}

function parseCurrency(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return parseGmvIdr(String(v ?? ''));
}

function parseNumberLoose(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const cleaned = String(v ?? '')
    .replace(/[^\d.-]/g, '')
    .replace(/\./g, '')
    .trim();
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}

function getCell(row: Record<string, unknown>, ...aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const al = normalizeHeader(a);
    const hit = keys.find((k) => normalizeHeader(k) === al);
    if (hit !== undefined) return row[hit];
  }
  return undefined;
}

function mapFlexibleRow(row: Record<string, unknown>): ProductMetricRow | null {
  const produkRaw = normalize(
    String(
      getCell(row, 'Produk', 'produk', 'Product Name', 'Nama Produk', 'product name') ?? ''
    )
  );
  const parsed = parseProdukLikeHtml(produkRaw);
  const gmv = parseCurrency(getCell(row, 'GMV', 'gmv'));
  const pesanan_sku = parseNumberLoose(getCell(row, 'Pesanan SKU', 'pesanan sku', 'Pesanan'));
  const produk_terjual = parseNumberLoose(
    getCell(row, 'Produk terjual', 'produk terjual', 'Terjual', 'Units sold')
  );

  if (!parsed.name && !produkRaw) return null;
  if (!parsed.name && (!gmv && !pesanan_sku && !produk_terjual)) return null;

  const status = normalize(
    String(getCell(row, 'Status', 'status') ?? 'Unknown')
  );

  return {
    skuId: normalize(String(getCell(row, 'SKU ID', 'Sku Id', 'sku id') ?? '')),
    productId: normalize(String(getCell(row, 'Product ID', 'product id') ?? '')),
    produkRaw: produkRaw || parsed.name,
    product_name: parsed.name || titleCase(produkRaw),
    size: parsed.size,
    pcsLabel: parsed.pcs,
    status: status || 'Unknown',
    gmv,
    pesanan_sku,
    produk_terjual,
  };
}

function detectHeaderRow(matrix: string[][]): number {
  const aliases: string[][] = [
    ['produk', 'nama produk', 'product name'],
    ['status'],
    ['gmv'],
    ['pesanan sku', 'pesanan'],
    ['produk terjual', 'terjual'],
  ];
  let bestIndex = -1;
  let bestScore = -1;
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const row = (matrix[i] || []).map((c) => normalizeHeader(String(c ?? '')));
    let score = 0;
    for (const group of aliases) {
      if (row.some((cell) => group.includes(cell))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestScore >= 3 ? bestIndex : 0;
}

function matrixToObjects(matrix: string[][]): Record<string, unknown>[] {
  const headerRowIndex = detectHeaderRow(matrix);
  const headers = (matrix[headerRowIndex] || []).map((h, idx) => normalize(String(h || `column_${idx + 1}`)));
  const rows: Record<string, unknown>[] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const row = matrix[i] || [];
    if (!row.some((cell) => normalize(String(cell)) !== '')) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] ?? '';
    });
    rows.push(obj);
  }
  return rows;
}

function extractPeriodLabel(matrix: string[][]): string | null {
  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    const row = matrix[i];
    if (!row || row.every((c) => !String(c ?? '').trim())) continue;
    const joined = row.join(' ');
    const pm = joined.match(PERIOD_LINE_RE);
    if (pm) return `${pm[1]} – ${pm[2]}`;
  }
  return null;
}

function parseFlexibleMatrix(rows: string[][]): ProductMetricRow[] {
  const objects = matrixToObjects(rows);
  const out: ProductMetricRow[] = [];
  for (const o of objects) {
    const r = mapFlexibleRow(o);
    if (r) out.push(r);
  }
  return out;
}

export function tiktokRowToMetricRow(r: TiktokProductRow): ProductMetricRow {
  const parsed = parseProdukLikeHtml(r.produkRaw);
  return {
    skuId: r.skuId,
    productId: r.productId,
    produkRaw: r.produkRaw,
    product_name: parsed.name || titleCase(r.name),
    size: parsed.size,
    pcsLabel: parsed.pcs,
    status: r.status || 'Unknown',
    gmv: r.gmvIdr,
    pesanan_sku: r.pesananSku,
    produk_terjual: r.produkTerjual,
  };
}

/** Try strict TikTok layout first; fallback to flexible product sheet (HTML prototype). */
export function ingestProductMetricsMatrix(matrix: string[][]): ProductMetricsIngestResult {
  const periodFlexible = extractPeriodLabel(matrix);

  const strict = parseTiktokMatrix(matrix);
  if (!strict.error && strict.data.length > 0) {
    return {
      data: strict.data.map(tiktokRowToMetricRow),
      periodLabel: strict.periodLabel ?? periodFlexible,
      parseMode: 'tiktok-strict',
    };
  }

  const flexible = parseFlexibleMatrix(matrix);
  if (flexible.length === 0) {
    return {
      data: [],
      periodLabel: periodFlexible,
      parseMode: 'flexible',
      error:
        strict.error ??
        'Format tidak dikenali. Unggah file dengan kolom Produk, GMV, Pesanan SKU, Produk terjual (dan opsional Status).',
    };
  }

  return {
    data: flexible,
    periodLabel: periodFlexible,
    parseMode: 'flexible',
  };
}

export function aggregateByKey(
  rows: ProductMetricRow[],
  key: keyof Pick<ProductMetricRow, 'product_name' | 'size' | 'pcsLabel'>,
  metric: ProductMetricKey
): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const label = String(r[key] || 'Unknown');
    map.set(label, (map.get(label) || 0) + (Number(r[metric]) || 0));
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export type ProductMetricFilter = {
  status: string;
  size: string;
  pcs: string;
  query: string;
};

export function filterProductMetricRows(rows: ProductMetricRow[], f: ProductMetricFilter): ProductMetricRow[] {
  const q = normalize(f.query).toLowerCase();
  return rows.filter((r) => {
    if (f.status !== 'all' && r.status !== f.status) return false;
    if (f.size !== 'all' && r.size !== f.size) return false;
    if (f.pcs !== 'all' && r.pcsLabel !== f.pcs) return false;
    if (q && !r.product_name.toLowerCase().includes(q) && !r.produkRaw.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function sortByMetric(rows: ProductMetricRow[], metric: ProductMetricKey): ProductMetricRow[] {
  return [...rows].sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
}

export function uniqueStatuses(rows: ProductMetricRow[]): string[] {
  return [...new Set(rows.map((r) => r.status).filter(Boolean))].sort();
}

export function uniqueSizes(rows: ProductMetricRow[]): string[] {
  return [...new Set(rows.map((r) => r.size).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

export function uniquePcsLabels(rows: ProductMetricRow[]): string[] {
  return [...new Set(rows.map((r) => r.pcsLabel).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

export function totalsForRows(rows: ProductMetricRow[]): {
  gmv: number;
  pesanan_sku: number;
  produk_terjual: number;
} {
  return rows.reduce(
    (acc, r) => ({
      gmv: acc.gmv + r.gmv,
      pesanan_sku: acc.pesanan_sku + r.pesanan_sku,
      produk_terjual: acc.produk_terjual + r.produk_terjual,
    }),
    { gmv: 0, pesanan_sku: 0, produk_terjual: 0 }
  );
}

/** Demo dataset from HTML prototype (raw row shape). */
export const DEMO_PRODUCT_METRICS_ROWS: Record<string, unknown>[] = [
  {
    Produk:
      '( 3 Pcs ) KASOGI PRO SPORT CELANA DALAM PRIA Murah Keren By Kasogi Underwear: XL',
    Status: 'Active',
    GMV: 'Rp717.451.623',
    'Pesanan SKU': 19005,
    'Produk terjual': 21241,
  },
  {
    Produk:
      '( 3 Pcs ) KASOGI PRO SPORT CELANA DALAM PRIA Murah Keren By Kasogi Underwear: L',
    Status: 'Active',
    GMV: 'Rp681.325.412',
    'Pesanan SKU': 18120,
    'Produk terjual': 20590,
  },
  {
    Produk: '( 1 Pcs ) KASOGI PRO SPORT CELANA DALAM PRIA Murah Keren By Kasogi Underwear: M',
    Status: 'Active',
    GMV: 'Rp156.224.100',
    'Pesanan SKU': 8021,
    'Produk terjual': 8440,
  },
  {
    Produk: '( 6 Pcs ) KASOGI PRO SPORT CELANA DALAM PRIA Murah Keren By Kasogi Underwear: XL',
    Status: 'Active',
    GMV: 'Rp244.880.300',
    'Pesanan SKU': 4210,
    'Produk terjual': 4542,
  },
  {
    Produk: '( 3 Pcs ) KASOGI AIR CELANA DALAM PRIA Premium Adem: L',
    Status: 'Active',
    GMV: 'Rp201.102.450',
    'Pesanan SKU': 5322,
    'Produk terjual': 5895,
  },
  {
    Produk: '( 3 Pcs ) KASOGI AIR CELANA DALAM PRIA Premium Adem: XL',
    Status: 'Active',
    GMV: 'Rp82.480.000',
    'Pesanan SKU': 2011,
    'Produk terjual': 2195,
  },
  {
    Produk: '( 1 Pcs ) KASOGI AIR CELANA DALAM PRIA Premium Adem: M',
    Status: 'Active',
    GMV: 'Rp45.900.120',
    'Pesanan SKU': 1788,
    'Produk terjual': 1860,
  },
  {
    Produk: '( 6 Pcs ) KASOGI BASIC BRIEF CELANA DALAM PRIA: XXL',
    Status: 'Active',
    GMV: 'Rp120.336.000',
    'Pesanan SKU': 1331,
    'Produk terjual': 1450,
  },
  {
    Produk: '( 3 Pcs ) KASOGI BASIC BRIEF CELANA DALAM PRIA: XXL',
    Status: 'Active',
    GMV: 'Rp98.400.540',
    'Pesanan SKU': 2400,
    'Produk terjual': 2602,
  },
  {
    Produk: '( 1 Pcs ) KASOGI BASIC BRIEF CELANA DALAM PRIA: XL',
    Status: 'Draft',
    GMV: 'Rp5.100.000',
    'Pesanan SKU': 120,
    'Produk terjual': 126,
  },
];

export function demoProductMetricRows(): ProductMetricRow[] {
  const out: ProductMetricRow[] = [];
  for (const o of DEMO_PRODUCT_METRICS_ROWS) {
    const r = mapFlexibleRow(o);
    if (r) out.push(r);
  }
  return out;
}

/** Scatter points: GMV vs produk_terjual per product_name (prototype logic). */
export function scatterGmvVsUnits(
  filtered: ProductMetricRow[],
  maxNames = 25
): { name: string; gmv: number; units: number; orders: number }[] {
  const byName = aggregateByKey(filtered, 'product_name', 'gmv');
  return byName.slice(0, maxNames).map((d) => {
    const rowSet = filtered.filter((r) => r.product_name === d.label);
    return {
      name: d.label,
      gmv: rowSet.reduce((s, r) => s + r.gmv, 0),
      units: rowSet.reduce((s, r) => s + r.produk_terjual, 0),
      orders: rowSet.reduce((s, r) => s + r.pesanan_sku, 0),
    };
  });
}
