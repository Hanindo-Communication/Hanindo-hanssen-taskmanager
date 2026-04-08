/** TikTok Ads "Product campaign data" XLSX export — one row per campaign, agregasi per Campaign name. */

export type TiktokAdsCampaignAggregate = {
  campaignName: string;
  cost: number;
  netCost: number;
  grossRevenue: number;
  skuOrders: number;
  /** Daily budget cap TikTok (MAX per nama kampanye saat merge baris). */
  currentBudget: number;
  roi: number | null;
  costPerOrder: number | null;
};

export type TiktokAdsReportSummary = {
  rowCount: number;
  campaignCount: number;
  totalCost: number;
  totalNetCost: number;
  totalGrossRevenue: number;
  totalSkuOrders: number;
  /** Jumlah MAX daily budget per kampanye (bukan spending). */
  sumOfDailyBudgetCaps: number;
  blendedRoi: number | null;
  blendedCostPerOrder: number | null;
  campaigns: TiktokAdsCampaignAggregate[];
};

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

function getField(row: Record<string, string>, ...candidates: string[]): string {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find((k) => normalizeHeader(k) === normalizeHeader(c));
    if (found !== undefined) return String(row[found] ?? '').trim();
  }
  return '';
}

function matrixToObjects(matrix: string[][]): Record<string, string>[] {
  if (matrix.length < 2) return [];
  const headerRow = matrix[0] ?? [];
  const keys = headerRow.map((h, i) => {
    const t = String(h ?? '').trim();
    return t || `__col_${i}`;
  });
  const out: Record<string, string>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const obj: Record<string, string> = {};
    let any = false;
    for (let c = 0; c < keys.length; c++) {
      const v = row[c];
      const s = v === undefined || v === null ? '' : String(v).trim();
      obj[keys[c]] = s;
      if (s) any = true;
    }
    if (any) out.push(obj);
  }
  return out;
}

function headersFromMatrix(matrix: string[][]): string[] {
  return (matrix[0] ?? []).map((h) => normalizeHeader(String(h ?? '')));
}

export function parseTiktokAdsProductCampaignMatrix(matrix: string[][]): {
  summary: TiktokAdsReportSummary | null;
  error?: string;
} {
  if (!matrix.length || !(matrix[0]?.length)) {
    return { summary: null, error: 'Lembar kosong.' };
  }

  const headers = headersFromMatrix(matrix);
  const needName = headers.some((h) => h === 'campaign name');
  const hasCost = headers.some((h) => h === 'cost');
  const hasNetCost = headers.some((h) => h === 'net cost');
  const hasGmv = headers.some((h) => h === 'gross revenue');

  if (!needName) {
    return {
      summary: null,
      error:
        'Format tidak dikenali. Pastikan ekspor TikTok berisi kolom Campaign name (Product campaign data).',
    };
  }
  if (!hasCost && !hasNetCost) {
    return {
      summary: null,
      error: 'Kolom Cost atau Net Cost tidak ditemukan.',
    };
  }
  if (!hasGmv) {
    return {
      summary: null,
      error: 'Kolom Gross revenue tidak ditemukan.',
    };
  }

  const objects = matrixToObjects(matrix);
  type Agg = {
    cost: number;
    netCost: number;
    grossRevenue: number;
    skuOrders: number;
    budgetMax: number;
  };
  const byName = new Map<string, Agg>();

  for (const row of objects) {
    const name = getField(row, 'Campaign name');
    if (!name) continue;

    const cost = parseNumber(getField(row, 'Cost'));
    const netCost = parseNumber(getField(row, 'Net Cost'));
    const grossRevenue = parseNumber(getField(row, 'Gross revenue'));
    const skuOrders = parseNumber(getField(row, 'SKU orders'));
    const currentBudget = parseNumber(getField(row, 'Current budget'));

    const prev = byName.get(name);
    if (!prev) {
      byName.set(name, {
        cost,
        netCost,
        grossRevenue,
        skuOrders,
        budgetMax: currentBudget,
      });
    } else {
      prev.cost += cost;
      prev.netCost += netCost;
      prev.grossRevenue += grossRevenue;
      prev.skuOrders += skuOrders;
      prev.budgetMax = Math.max(prev.budgetMax, currentBudget);
    }
  }

  if (byName.size === 0) {
    return {
      summary: null,
      error: 'Tidak ada baris kampanye dengan Campaign name yang terisi.',
    };
  }

  const campaigns: TiktokAdsCampaignAggregate[] = [];
  let totalCost = 0;
  let totalNetCost = 0;
  let totalGrossRevenue = 0;
  let totalSkuOrders = 0;
  let sumBudgetCaps = 0;

  for (const [campaignName, a] of byName) {
    totalCost += a.cost;
    totalNetCost += a.netCost;
    totalGrossRevenue += a.grossRevenue;
    totalSkuOrders += a.skuOrders;
    sumBudgetCaps += a.budgetMax;

    const roi = a.cost > 0 ? a.grossRevenue / a.cost : null;
    const costPerOrder = a.skuOrders > 0 ? a.cost / a.skuOrders : null;

    campaigns.push({
      campaignName,
      cost: a.cost,
      netCost: a.netCost,
      grossRevenue: a.grossRevenue,
      skuOrders: a.skuOrders,
      currentBudget: a.budgetMax,
      roi,
      costPerOrder,
    });
  }

  campaigns.sort((x, y) => y.cost - x.cost);

  const blendedRoi = totalCost > 0 ? totalGrossRevenue / totalCost : null;
  const blendedCostPerOrder = totalSkuOrders > 0 ? totalCost / totalSkuOrders : null;

  return {
    summary: {
      rowCount: objects.length,
      campaignCount: campaigns.length,
      totalCost,
      totalNetCost,
      totalGrossRevenue,
      totalSkuOrders,
      sumOfDailyBudgetCaps: sumBudgetCaps,
      blendedRoi,
      blendedCostPerOrder,
      campaigns,
    },
  };
}
