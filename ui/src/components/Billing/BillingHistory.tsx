import { FileText } from 'lucide-react';

export function BillingHistory() {
  return (
    <div>
      <h3 className="text-xl font-semibold flex items-center gap-2 text-foreground">
        <FileText />
        Billing history
      </h3>
      <div className="flex flex-col items-center justify-center text-foreground-muted mt-8">
        <FileText width={32} />
        <p className="mt-2">No invoices yet</p>
      </div>
    </div>
  );
}
