import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Smartphone, Receipt, Package, Bell, CheckSquare, ClipboardList, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function MobileSummary() {
  const { data, isLoading } = useQuery({ queryKey: ["mobile-summary"], queryFn: () => apiFetch("/mobile/summary") });
  const { data: invoicesData } = useQuery({ queryKey: ["mobile-invoices"], queryFn: () => apiFetch("/mobile/invoices?status=unpaid") });
  const { data: stockData } = useQuery({ queryKey: ["mobile-stock"], queryFn: () => apiFetch("/mobile/stock-alerts") });
  const { data: approvalsData } = useQuery({ queryKey: ["mobile-approvals"], queryFn: () => apiFetch("/mobile/approvals") });
  const { data: tasksData } = useQuery({ queryKey: ["mobile-tasks"], queryFn: () => apiFetch("/mobile/tasks") });

  const summary = data?.summary as Record<string, unknown> | undefined;
  const stats = summary?.stats as Record<string, number> | undefined;
  const recentInvoices = (summary?.recentInvoices ?? []) as Record<string, unknown>[];
  const unpaidInvoices = (invoicesData?.invoices ?? []) as Record<string, unknown>[];
  const stockAlerts = (stockData?.alerts ?? []) as Record<string, unknown>[];
  const pendingApprovals = (approvalsData?.approvals ?? []) as Record<string, unknown>[];
  const openTasks = (tasksData?.tasks ?? []) as Record<string, unknown>[];

  const statusColors: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    unpaid: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    overdue: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
    draft: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-indigo-600" /> Mobile Companion View
            <Badge className="text-[9px] bg-indigo-600 text-white border-0">V5</Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Condensed business overview optimized for quick access</p>
        </div>
        <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5">
          Mobile API ready at <code className="font-mono text-indigo-600">/api/mobile/*</code>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Revenue (Recent)", value: `₹${(stats.totalRevenue ?? 0).toLocaleString()}`, icon: TrendingUp, color: "text-emerald-600" },
            { label: "Unpaid Invoices", value: stats.unpaidInvoices, icon: Receipt, color: "text-amber-600" },
            { label: "Low Stock Items", value: stats.lowStockItems, icon: Package, color: "text-red-500" },
            { label: "Pending Approvals", value: stats.pendingApprovals, icon: ClipboardList, color: "text-indigo-600" },
            { label: "Open Tasks", value: stats.openTasks, icon: CheckSquare, color: "text-blue-600" },
            { label: "Unread Notifications", value: summary?.unreadNotifications, icon: Bell, color: "text-purple-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border border-gray-100 dark:border-gray-800">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={cn("h-5 w-5 flex-shrink-0", color)} />
                <div><p className="text-base font-bold text-gray-900 dark:text-white">{value ?? 0}</p><p className="text-xs text-gray-500">{label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Recent Invoices */}
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4 text-gray-400" /> Recent Invoices</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-2">
            {recentInvoices.length === 0 ? <p className="text-xs text-gray-400">No invoices</p> : recentInvoices.map(inv => (
              <div key={inv.id as number} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{inv.customerName as string}</p>
                  <p className="text-[10px] text-gray-400">{inv.invoiceNumber as string}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">₹{(inv.total as number)?.toLocaleString()}</span>
                  <span className={cn("text-[10px] rounded px-1.5 py-0.5", statusColors[inv.status as string] ?? statusColors.draft)}>{inv.status as string}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4 text-gray-400" /> Pending Approvals</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-2">
            {pendingApprovals.length === 0 ? <p className="text-xs text-gray-400">No pending approvals</p> : pendingApprovals.map(a => (
              <div key={a.id as number} className="flex items-start gap-2">
                <div className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ClipboardList className="h-2.5 w-2.5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{a.title as string}</p>
                  <p className="text-[10px] text-gray-400">{a.entityType as string} · {a.priority as string}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Low Stock Alerts</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-2">
            {stockAlerts.length === 0 ? <p className="text-xs text-gray-400">All stock levels healthy</p> : stockAlerts.map(s => (
              <div key={s.id as number} className="flex items-center justify-between">
                <p className="text-xs text-gray-800 dark:text-gray-200 truncate flex-1">{s.name as string}</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-semibold text-red-600">{s.stock as number}</span>
                  <span className="text-[10px] text-gray-400">/ {s.minStock as number} min</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Open Tasks */}
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckSquare className="h-4 w-4 text-gray-400" /> Open Tasks</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-2">
            {openTasks.length === 0 ? <p className="text-xs text-gray-400">No open tasks</p> : openTasks.map(t => (
              <div key={t.id as number} className="flex items-start gap-2">
                <div className={cn("h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0",
                  t.priority === "urgent" ? "bg-red-500" : t.priority === "high" ? "bg-amber-500" : "bg-gray-300")} />
                <div>
                  <p className="text-xs text-gray-800 dark:text-gray-200">{t.title as string}</p>
                  {t.dueDate && <p className="text-[10px] text-gray-400">{new Date(t.dueDate as string).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Smartphone className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Mobile API Endpoints Ready</p>
            <p className="text-xs text-indigo-700/70 dark:text-indigo-400 mt-0.5 leading-relaxed">
              All mobile companion endpoints are live at <code className="font-mono">/api/mobile/*</code>. These condensed, read-optimized endpoints are designed for native mobile apps and PWA clients. Data includes summary stats, recent invoices, approvals, tasks, notifications, and stock alerts.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["/mobile/summary", "/mobile/invoices", "/mobile/approvals", "/mobile/tasks", "/mobile/notifications", "/mobile/stock-alerts"].map(ep => (
                <code key={ep} className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded px-1.5 py-0.5">{ep}</code>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
