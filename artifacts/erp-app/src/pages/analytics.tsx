import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, IndianRupee, Package, ShoppingCart,
  BarChart3, PieChartIcon, AlertTriangle, Sparkles, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";

async function apiFetch(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const MONTHS = [
  { label: "3 months", value: 3 },
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
];

const PIE_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function StatCard({ label, value, sub, subUp, icon: Icon, accent }: {
  label: string; value: string; sub: string; subUp?: boolean;
  icon: React.ElementType; accent: string;
}) {
  return (
    <Card className="border border-gray-100 dark:border-gray-800">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", accent)}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className={cn("text-xs mt-1", subUp === undefined ? "text-gray-400" : subUp ? "text-emerald-600" : "text-red-500")}>
          {sub}
        </p>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="border border-gray-100 dark:border-gray-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [months, setMonths] = useState(6);

  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ["analytics-revenue", months],
    queryFn: () => apiFetch(`/analytics/revenue?months=${months}`),
  });

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: () => apiFetch("/analytics/summary"),
  });

  const { data: topProducts, isLoading: topLoading } = useQuery({
    queryKey: ["analytics-top-products"],
    queryFn: () => apiFetch("/analytics/top-products"),
  });

  const { data: lowStock } = useQuery({
    queryKey: ["analytics-low-stock"],
    queryFn: () => apiFetch("/analytics/low-stock"),
  });

  const { data: gstData } = useQuery({
    queryKey: ["analytics-gst", months],
    queryFn: () => apiFetch(`/analytics/gst-summary?months=${months}`),
  });

  const { data: expBreakdown } = useQuery({
    queryKey: ["analytics-expense-breakdown"],
    queryFn: () => apiFetch("/analytics/expense-breakdown"),
  });

  const s = summary?.data ?? summary;
  const revData: { month: string; revenue: number; expenses: number; profit: number }[] = revenue?.data ?? [];
  const products = topProducts?.data ?? [];
  const lowItems = lowStock?.data ?? [];
  const gst = gstData?.data ?? [];
  const expPie = expBreakdown?.data ?? [];

  const totalRevenue = revData.reduce((a, r) => a + r.revenue, 0);
  const totalExpenses = revData.reduce((a, r) => a + r.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Analytics & Business Intelligence</h1>
          <p className="text-sm text-gray-500 mt-0.5">Revenue trends, expense analysis, and GST insights</p>
        </div>
        <div className="flex gap-1.5">
          {MONTHS.map((m) => (
            <Button key={m.value} size="sm" variant={months === m.value ? "default" : "outline"}
              className={cn("text-xs h-7", months === m.value ? "bg-indigo-600 text-white border-indigo-600" : "")}
              onClick={() => setMonths(m.value)}>
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {sumLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Revenue (Period)" value={formatCurrency(totalRevenue)} icon={TrendingUp} accent="bg-indigo-600"
              sub={`${s?.revenueChange >= 0 ? "+" : ""}${s?.revenueChange ?? 0}% vs prev month`} subUp={(s?.revenueChange ?? 0) >= 0} />
            <StatCard label="Expenses (Period)" value={formatCurrency(totalExpenses)} icon={ShoppingCart} accent="bg-orange-500"
              sub="Total spend tracked" />
            <StatCard label="Net Profit" value={formatCurrency(totalProfit)} icon={IndianRupee} accent={totalProfit >= 0 ? "bg-emerald-600" : "bg-red-500"}
              sub={`${totalProfit >= 0 ? "Profitable" : "Loss"} this period`} subUp={totalProfit >= 0} />
            <StatCard label="Pending Invoices" value={`${s?.pendingInvoicesCount ?? 0}`} icon={BarChart3} accent="bg-amber-500"
              sub={formatCurrency(s?.pendingInvoicesAmount ?? 0) + " outstanding"} />
          </>
        )}
      </div>

      {/* Revenue + Profit Trend */}
      <ChartCard title="Revenue vs Expenses vs Profit" description="Month-over-month comparison">
        {revLoading ? <Skeleton className="h-64" /> : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" fill="url(#gRev)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f59e0b" fill="url(#gExp)" strokeWidth={2} />
              <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" fill="url(#gPro)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row: Top Products + Expense Pie */}
      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="Top Products by Revenue" description="Best-selling items">
          {topLoading ? <Skeleton className="h-56" /> : (
            products.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-gray-400">No sales data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={products.slice(0, 6)} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          )}
        </ChartCard>

        <ChartCard title="Expense Breakdown" description="Spending by category">
          {expPie.length === 0 ? (
            <div className="h-[230px] flex items-center justify-center text-sm text-gray-400">No expenses recorded yet</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={230}>
                <PieChart>
                  <Pie data={expPie} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                    {expPie.map((_: unknown, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {expPie.slice(0, 6).map((e: { category: string; total: number }, i: number) => (
                  <div key={e.category} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="capitalize text-gray-600 dark:text-gray-400">{e.category}</span>
                    </div>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{formatCurrency(e.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* GST Summary */}
      <ChartCard title="GST Collection by Month" description="Collected GST for filing reference">
        {gst.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-400">No invoice data for GST analysis</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gst} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gst" name="GST Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Low Stock Alert */}
      {lowItems.length > 0 && (
        <Card className="border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Low Stock Alert — {lowItems.length} item{lowItems.length > 1 ? "s" : ""} need restocking
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {lowItems.slice(0, 8).map((p: { id: number; name: string; stockQty: number; lowStockThreshold: number }) => (
                <div key={p.id} className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-amber-100 dark:border-amber-900">
                  <p className="text-xs font-medium text-gray-800 dark:text-white truncate">{p.name}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-400 border-amber-300">
                      {p.stockQty} left
                    </Badge>
                    <span className="text-[10px] text-gray-400">min: {p.lowStockThreshold}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
