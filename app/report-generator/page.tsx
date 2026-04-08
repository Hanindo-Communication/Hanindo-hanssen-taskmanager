import { AppShell } from '@/components/dashboard/app-shell';
import { ReportGeneratorPanel } from '@/components/report-generator/ReportGeneratorPanel';
import { TiktokAdsCampaignReportPanel } from '@/components/report-generator/TiktokAdsCampaignReportPanel';
import { TiktokSalesReportPanel } from '@/components/report-generator/TiktokSalesReportPanel';
import reportStyles from '@/components/report-generator/ReportGeneratorPanel.module.css';

/** Hindari HTML/ISR stale; bundle client harus rebuild agar UI terbaru ter-load. */
export const dynamic = 'force-dynamic';

export default function ReportGeneratorPage() {
  return (
    <AppShell activeSection="report-generator">
      <div className={reportStyles.reportStack}>
        <ReportGeneratorPanel />
        <TiktokAdsCampaignReportPanel />
        <TiktokSalesReportPanel />
      </div>
    </AppShell>
  );
}
