import { AppShell } from '@/components/dashboard/app-shell';
import { ReportGeneratorPanel } from '@/components/report-generator/ReportGeneratorPanel';

export default function ReportGeneratorPage() {
  return (
    <AppShell activeSection="report-generator">
      <ReportGeneratorPanel />
    </AppShell>
  );
}
