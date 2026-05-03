import { useListInvoices, useListTransactions } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, CheckCheck, AlertTriangle, AlertCircle, Info, ShieldCheck } from "lucide-react";
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

type Priority = "critical" | "high" | "medium" | "low";
type Category = "compliance" | "deadline" | "itc mismatch" | "missing gstin" | "general";

interface Alert {
  id: string;
  message: string;
  priority: Priority;
  category: Category;
  generatedAt: string;
  read: boolean;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  critical: { label: "critical", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-800", icon: AlertCircle },
  high: { label: "high", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-800", icon: AlertTriangle },
  medium: { label: "medium", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-800", icon: Info },
  low: { label: "low", color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-900/20", border: "border-gray-200 dark:border-gray-700", icon: Info },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function generateAlerts(invoices: any[], transactions: any[]): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();
  const ts = now.toISOString();

  const today = now.getDate();
  const daysToGstr1 = today <= 11 ? 11 - today : 11 + (30 - today + 1);
  const daysToGstr3b = today <= 20 ? 20 - today : 20 + (30 - today + 1);

  // GSTR-3B filing deadline
  if (daysToGstr3b <= 10) {
    alerts.push({
      id: "gstr3b-deadline",
      message: `GSTR-3B is due on the 20th of this month (${daysToGstr3b} days away). Verify your GST payable and ensure timely payment to avoid interest and penalties.`,
      priority: daysToGstr3b <= 3 ? "critical" : "high",
      category: "deadline",
      generatedAt: ts,
      read: false,
    });
  }

  // GSTR-1 filing deadline
  if (daysToGstr1 <= 7) {
    alerts.push({
      id: "gstr1-deadline",
      message: `GSTR-1 is due on the 11th of this month (${daysToGstr1} days away). Ensure all sales invoices are correctly recorded before filing.`,
      priority: daysToGstr1 <= 2 ? "critical" : "high",
      category: "deadline",
      generatedAt: ts,
      read: false,
    });
  }

  // Missing GSTIN in invoices
  const missingGstin = invoices.filter((i) => !i.buyerGstin && (i as any).type !== "purchase");
  if (missingGstin.length > 0) {
    alerts.push({
      id: "missing-gstin",
      message: `${missingGstin.length} sale invoice${missingGstin.length > 1 ? "s are" : " is"} missing buyer GSTIN. This may hinder Input Tax Credit claims for your customers and create compliance risks.`,
      priority: "medium",
      category: "missing gstin",
      generatedAt: ts,
      read: false,
    });
  }

  // Flagged invoices
  const flaggedInvoices = invoices.filter((i) => i.status === "flagged" || i.status === "overdue");
  if (flaggedInvoices.length > 0) {
    alerts.push({
      id: "flagged-invoices",
      message: `Review ${flaggedInvoices.length} flagged invoice${flaggedInvoices.length > 1 ? "s" : ""} for compliance risks. Inaccuracies could lead to further scrutiny from tax authorities.`,
      priority: "high",
      category: "compliance",
      generatedAt: ts,
      read: false,
    });
  }

  // Pending invoices (unpaid > 30 days)
  const pendingOld = invoices.filter((i) => {
    if (i.status !== "pending" && i.status !== "unpaid") return false;
    const created = new Date(i.createdAt);
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 30;
  });
  if (pendingOld.length > 0) {
    alerts.push({
      id: "overdue-invoices",
      message: `${pendingOld.length} invoice${pendingOld.length > 1 ? "s are" : " is"} pending payment for more than 30 days. Follow up with customers to maintain healthy cash flow.`,
      priority: "medium",
      category: "compliance",
      generatedAt: ts,
      read: false,
    });
  }

  // ITC mismatch check
  const outputGst = invoices.filter((i) => (i as any).type !== "purchase").reduce((s, i) => s + Number(i.gstAmount || 0), 0);
  const inputGst = invoices.filter((i) => (i as any).type === "purchase").reduce((s, i) => s + Number(i.gstAmount || 0), 0);
  if (outputGst > 0 && inputGst > 0 && inputGst / outputGst < 0.5) {
    alerts.push({
      id: "itc-mismatch",
      message: `Potential ITC mismatch: Input GST (${Math.round((inputGst / outputGst) * 100)}% of output) is lower than expected. Review purchase invoices to ensure all ITC is properly claimed.`,
      priority: "medium",
      category: "itc mismatch",
      generatedAt: ts,
      read: false,
    });
  }

  // High GST payable
  const netGstPayable = Math.max(0, outputGst - inputGst);
  if (netGstPayable > 50000) {
    alerts.push({
      id: "high-gst",
      message: `GST payable of ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(netGstPayable)} needs to be deposited by the due date. Ensure sufficient cash flow to avoid interest and penalties.`,
      priority: "high",
      category: "compliance",
      generatedAt: ts,
      read: false,
    });
  }

  // No transactions this month
  const thisMonthTxns = transactions.filter((t) => {
    const d = new Date(t.date || t.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  if (thisMonthTxns.length === 0 && transactions.length > 0) {
    alerts.push({
      id: "no-txns-this-month",
      message: "No transactions recorded this month. Ensure all income and expense entries are up to date for accurate P&L and GST reporting.",
      priority: "medium",
      category: "general",
      generatedAt: ts,
      read: false,
    });
  }

  // Always add general compliance reminder if no others
  if (alerts.length === 0) {
    alerts.push({
      id: "general-reminder",
      message: "All GST compliance checks passed. Keep your invoices updated and file returns on time. GSTR-1 is due on the 11th and GSTR-3B on the 20th of each month.",
      priority: "low",
      category: "general",
      generatedAt: ts,
      read: false,
    });
  }

  return alerts;
}

export default function ComplianceAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const { data: invData } = useListInvoices({ limit: 500 });
  const { data: txnData } = useListTransactions({ limit: 500 });

  const handleGenerate = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      const generatedAlerts = generateAlerts(invData?.invoices || [], txnData?.transactions || []);
      setAlerts(generatedAlerts);
      setGenerated(true);
      setGenerating(false);
      toast({ title: `${generatedAlerts.length} compliance alerts generated` });
    }, 1200);
  }, [invData, txnData, toast]);

  const handleMarkRead = (id: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
  };

  const handleMarkAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Compliance Alerts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {generated ? `${unreadCount} unread alert${unreadCount !== 1 ? "s" : ""}` : "AI-powered GST compliance analysis"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          )}
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Alerts
          </Button>
        </div>
      </div>

      {!generated && !generating ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center mb-5">
            <ShieldCheck className="h-8 w-8 text-indigo-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Run Compliance Check</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-6">
            Analyze your invoices, transactions, and GST data to identify compliance risks, missing GSTINs, filing deadlines, and ITC mismatches.
          </p>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2" onClick={handleGenerate}>
            <Sparkles className="h-4 w-4" /> Generate Compliance Alerts
          </Button>
        </div>
      ) : generating ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
          <p className="text-sm text-gray-500">Analyzing your business data...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const cfg = PRIORITY_CONFIG[alert.priority];
            const Icon = cfg.icon;
            return (
              <div
                key={alert.id}
                className={`rounded-2xl border p-4 transition-all ${alert.read ? "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950/50" : `${cfg.bg} ${cfg.border}`}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${alert.read ? "bg-gray-100 dark:bg-gray-800" : "bg-white/60 dark:bg-gray-900/60"}`}>
                    <Icon className={`h-4 w-4 ${alert.read ? "text-gray-400" : cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                          alert.priority === "critical" ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800" :
                          alert.priority === "high" ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800" :
                          "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                        }`}>{alert.priority}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                          {alert.category}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(alert.generatedAt)}</span>
                    </div>
                    <p className={`text-sm leading-relaxed ${alert.read ? "text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-200"}`}>
                      {alert.message}
                    </p>
                    {!alert.read && (
                      <button
                        className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={() => handleMarkRead(alert.id)}
                      >
                        ✓ Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
