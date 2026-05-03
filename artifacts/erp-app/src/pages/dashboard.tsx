import { useGetDashboardSummary, useGetRevenueChart, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight,
  CheckCircle2, ReceiptText, TrendingUp, Wallet, IndianRupee, Package
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: chartData, isLoading: isChartLoading } = useGetRevenueChart();
  const { data: activity, isLoading: isActivityLoading } = useGetRecentActivity({ limit: 5 });

  const kpiCards = [
    {
      label: "TOTAL SALES",
      value: summary?.totalRevenue || 0,
      isCurrency: true,
      sub: `${(summary?.revenueGrowth || 0) >= 0 ? "+" : ""}${(summary?.revenueGrowth || 0).toFixed(1)}% from last month`,
      subPositive: (summary?.revenueGrowth || 0) >= 0,
      bg: "bg-indigo-600",
      text: "text-white",
      subText: "text-indigo-200",
      icon: TrendingUp,
      iconBg: "bg-white/20",
    },
    {
      label: "TOTAL PURCHASES",
      value: summary?.totalExpenses || 0,
      isCurrency: true,
      sub: "Total expenses this period",
      subPositive: true,
      bg: "bg-white dark:bg-gray-900",
      text: "text-gray-900 dark:text-white",
      subText: "text-gray-500",
      border: "border border-gray-200 dark:border-gray-700",
      icon: Package,
      iconBg: "bg-gray-100 dark:bg-gray-800",
      iconColor: "text-gray-500",
    },
    {
      label: "GST PAYABLE",
      value: summary?.pendingPayments || 0,
      isCurrency: true,
      sub: `${summary?.unpaidInvoicesCount || 0} unpaid invoices`,
      subPositive: false,
      bg: "bg-amber-500",
      text: "text-white",
      subText: "text-amber-100",
      icon: IndianRupee,
      iconBg: "bg-white/20",
    },
    {
      label: "INPUT TAX CREDIT",
      value: (summary?.totalRevenue || 0) * 0.08,
      isCurrency: true,
      sub: "Estimated ITC available",
      subPositive: true,
      bg: "bg-teal-600",
      text: "text-white",
      subText: "text-teal-100",
      icon: CheckCircle2,
      iconBg: "bg-white/20",
    },
  ];

  const secondaryCards = [
    {
      label: "NET PROFIT",
      value: summary?.netProfit || 0,
      isCurrency: true,
      sub: "Profitable",
      bg: "bg-emerald-600",
      text: "text-white",
      subText: "text-emerald-100",
      icon: Wallet,
      iconBg: "bg-white/20",
    },
    {
      label: "6-MONTH REVENUE",
      value: chartData?.reduce((s, d) => s + (d.revenue || 0), 0) || 0,
      isCurrency: true,
      bg: "bg-white dark:bg-gray-900",
      border: "border border-gray-200 dark:border-gray-700",
      text: "text-gray-900 dark:text-white",
      subText: "text-gray-500",
      icon: TrendingUp,
      iconBg: "bg-indigo-50 dark:bg-indigo-950",
      iconColor: "text-indigo-600",
    },
    {
      label: "INVOICES THIS MONTH",
      value: summary?.totalInvoicesThisMonth || 0,
      isCurrency: false,
      bg: "bg-white dark:bg-gray-900",
      border: "border border-gray-200 dark:border-gray-700",
      text: "text-gray-900 dark:text-white",
      subText: "text-gray-500",
      icon: ReceiptText,
      iconBg: "bg-purple-50 dark:bg-purple-950",
      iconColor: "text-purple-600",
    },
    {
      label: "LOW STOCK ITEMS",
      value: summary?.lowStockCount || 0,
      isCurrency: false,
      sub: "Need reordering",
      bg: "bg-white dark:bg-gray-900",
      border: "border border-gray-200 dark:border-gray-700",
      text: summary?.lowStockCount ? "text-red-600" : "text-gray-900 dark:text-white",
      subText: "text-gray-500",
      icon: AlertTriangle,
      iconBg: "bg-red-50 dark:bg-red-950",
      iconColor: "text-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your business overview, projections & compliance at a glance</p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices/new">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">+ New Invoice</Button>
          </Link>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card, i) => (
          <div
            key={i}
            className={`rounded-2xl p-5 ${card.bg} ${card.border || ""} shadow-sm`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className={`text-[11px] font-semibold tracking-widest uppercase ${card.text} opacity-80`}>
                {card.label}
              </span>
              <div className={`h-8 w-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                <card.icon className={`h-4 w-4 ${card.iconColor || card.text}`} />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="h-8 w-28 bg-white/20" />
            ) : (
              <div className={`text-2xl font-bold ${card.text} mb-1`}>
                {card.isCurrency ? formatCurrency(card.value) : card.value.toString()}
              </div>
            )}
            {card.sub && (
              <p className={`text-xs ${card.subText}`}>{card.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {secondaryCards.map((card, i) => (
          <div
            key={i}
            className={`rounded-2xl p-5 ${card.bg} ${card.border || ""} shadow-sm`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className={`text-[11px] font-semibold tracking-widest uppercase text-gray-500 dark:text-gray-400`}>
                {card.label}
              </span>
              <div className={`h-8 w-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                <card.icon className={`h-4 w-4 ${card.iconColor || card.text}`} />
              </div>
            </div>
            {isSummaryLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className={`text-2xl font-bold ${card.text}`}>
                {card.isCurrency ? formatCurrency(card.value) : card.value.toString()}
              </div>
            )}
            {card.sub && (
              <p className={`text-xs ${card.subText} mt-1`}>{card.sub}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="col-span-4 lg:col-span-5 rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Revenue & Profit Trend</CardTitle>
            <CardDescription className="text-xs text-gray-500">Monthly revenue vs expenses over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {isChartLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : chartData && chartData.length > 0 ? (
              <div className="h-[280px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                      dx={-8}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, undefined]}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(val) => <span style={{ fontSize: 12, color: '#6b7280' }}>{val}</span>}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      dot={{ r: 4, fill: "#4f46e5", strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorExpenses)"
                      dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] w-full flex flex-col items-center justify-center gap-3 text-gray-400">
                <TrendingUp className="h-12 w-12 opacity-20" />
                <p className="text-sm">No revenue data yet</p>
                <Link href="/transactions">
                  <Button variant="outline" size="sm" className="text-xs">Add Transactions</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="col-span-4 lg:col-span-2 rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Recent Activity</CardTitle>
            <CardDescription className="text-xs text-gray-500">Latest actions in your account</CardDescription>
          </CardHeader>
          <CardContent>
            {isActivityLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-1.5 flex-shrink-0 ${
                      item.type.includes('invoice') ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600' :
                      item.type.includes('product') ? 'bg-amber-50 dark:bg-amber-950 text-amber-600' :
                      item.type.includes('transaction') ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}>
                      {item.type.includes('invoice') ? <ReceiptText className="h-3.5 w-3.5" /> :
                       item.type.includes('product') ? <Package className="h-3.5 w-3.5" /> :
                       item.type.includes('transaction') ? <Activity className="h-3.5 w-3.5" /> :
                       <CheckCircle2 className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400">{formatDate(item.createdAt)}</span>
                        {item.amount && (
                          <Badge variant="outline" className="font-mono text-[10px] h-4 px-1.5 border-gray-200 dark:border-gray-700">
                            {formatCurrency(item.amount)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No recent activity</p>
                <p className="text-xs mt-1">Create an invoice to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Bar Chart */}
      {chartData && chartData.length > 0 && (
        <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Monthly Revenue vs Expenses</CardTitle>
            <CardDescription className="text-xs text-gray-500">Side-by-side comparison for the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {isChartLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, undefined]}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(val) => <span style={{ fontSize: 12, color: '#6b7280' }}>{val}</span>}
                    />
                    <Bar dataKey="revenue" name="Revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
