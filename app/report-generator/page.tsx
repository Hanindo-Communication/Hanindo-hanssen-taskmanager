import { AppShell } from '@/components/dashboard/app-shell';
import { ReportGeneratorPanel } from '@/components/report-generator/ReportGeneratorPanel';

/** Hindari HTML/ISR stale; bundle client harus rebuild agar UI terbaru ter-load. */
export const dynamic = 'force-dynamic';

export default function ReportGeneratorPage() {
  return (
    <AppShell activeSection="report-generator">
      <ReportGeneratorPanel />
    </AppShell>
  );
}
