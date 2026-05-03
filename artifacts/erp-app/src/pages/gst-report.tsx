import { useListInvoices, useListTransactions } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, BarChart3, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
} from "recharts";

const GST_RATES = [5, 12, 18, 28];
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444"];

const FY_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

function getFYMonthIndex(date: Date) {
  const m = date.getMonth(); // 0=Jan
  return m >= 3 ? m - 3 : m + 9; // Apr=0, Mar=11
}

function currentFY() {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${(y + 1).toString().slice(2)}`;
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "gstr1", label: "GSTR-1 (Sales)" },
  { key: "gstr2", label: "GSTR-2 (Purchases)" },
  { key: "gstr3b", label: "GSTR-3B Summary" },
];

export default function GstReport() {
  const [tab, setTab] = useState<"overview" | "gstr1" | "gstr2" | "gstr3b">("overview");
  const [fy, setFy] = useState(currentFY());
  const fyYear = parseInt(fy.split("-")[0]);

  const { data: invoicesData, isLoading: invLoading } = useListInvoices({ limit: 500 });
  const { data: txnData, isLoading: txnLoading } = useListTransactions({ limit: 500 });

  const isLoading = invLoading || txnLoading;

  const allInvoices = invoicesData?.invoices || [];

  const fyInvoices = allInvoices.filter((inv) => {
    const d = new Date(inv.createdAt);
    const m = d.getMonth();
    const y = d.getFullYear();
    return (y === fyYear && m >= 3) || (y === fyYear + 1 && m < 3);
  });

  const saleInvoices = fyInvoices.filter((i) => (i as any).type !== "purchase");
  const purchaseInvoices = fyInvoices.filter((i) => (i as any).type === "purchase");
  const purchaseTxns = (txnData?.transactions || []).filter((t) => t.type === "expense");

  const taxableSales = saleInvoices.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const taxablePurchases = purchaseInvoices.reduce((s, i) => s + Number(i.subtotal || 0), 0) +
    purchaseTxns.reduce((s, t) => s + Number(t.amount), 0) * 0.847; // approx ex-tax
  const outputGst = saleInvoices.reduce((s, i) => s + Number(i.gstAmount || 0), 0);
  const inputTaxCredit = purchaseInvoices.reduce((s, i) => s + Number(i.gstAmount || 0), 0) * 0.5;
  const netGstPayable = Math.max(0, outputGst - inputTaxCredit);
  const excessItc = Math.max(0, inputTaxCredit - outputGst);

  // Monthly GST trend
  const monthlyGst = FY_MONTHS.map((month, idx) => {
    const monthInvs = fyInvoices.filter((i) => {
      const d = new Date(i.createdAt);
      return getFYMonthIndex(d) === idx;
    });
    const output = monthInvs.filter((i) => (i as any).type !== "purchase").reduce((s, i) => s + Number(i.gstAmount || 0), 0);
    const input = monthInvs.filter((i) => (i as any).type === "purchase").reduce((s, i) => s + Number(i.gstAmount || 0), 0) * 0.5;
    return { month, "Output GST": Math.round(output), "Input GST (ITC)": Math.round(input) };
  });

  // Rate breakdown
  const rateBreakdown = GST_RATES.map((rate) => {
    const invs = saleInvoices.filter((i) => {
      const sub = Number(i.subtotal || 0);
      const gst = Number(i.gstAmount || 0);
      if (!sub) return false;
      const r = Math.round((gst / sub) * 100);
      return r === rate;
    });
    const taxable = invs.reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const gstAmt = invs.reduce((s, i) => s + Number(i.gstAmount || 0), 0);
    return { rate: `${rate}%`, taxable, gstAmt, cgst: gstAmt / 2, sgst: gstAmt / 2, count: invs.length };
  }).filter((r) => r.count > 0);

  if (rateBreakdown.length === 0) {
    rateBreakdown.push({ rate: "18%", taxable: taxableSales, gstAmt: outputGst, cgst: outputGst / 2, sgst: outputGst / 2, count: saleInvoices.length });
  }

  // GSTR-1 entries
  const gstr1Entries = saleInvoices.map((inv) => ({
    date: new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    vendor: inv.customerName,
    gstin: (inv as any).buyerGstin || "–",
    invoiceNo: inv.invoiceNumber,
    taxable: Number(inv.subtotal || 0),
    gstRate: (() => {
      const s = Number(inv.subtotal || 0);
      const g = Number(inv.gstAmount || 0);
      return s ? Math.round((g / s) * 100) + "%" : "18%";
    })(),
    cgst: Number(inv.gstAmount || 0) / 2,
    sgst: Number(inv.gstAmount || 0) / 2,
    total: Number(inv.totalAmount || 0),
  }));

  // GSTR-2 entries
  const gstr2Entries = purchaseInvoices.map((inv) => ({
    date: new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    vendor: inv.customerName,
    gstin: (inv as any).buyerGstin || "–",
    invoiceNo: inv.invoiceNumber,
    taxable: Number(inv.subtotal || 0),
    gstRate: "18%",
    cgst: Number(inv.gstAmount || 0) / 2,
    sgst: Number(inv.gstAmount || 0) / 2,
    itc: Number(inv.gstAmount || 0) * 0.5,
  }));

  const fyOptions = [currentFY(), `${fyYear - 1}-${fyYear.toString().slice(2)}`];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-600" /> GST Report
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Complete GST analysis, GSTR-1 &amp; GSTR-2 registers</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            value={fy}
            onChange={(e) => setFy(e.target.value)}
          >
            {fyOptions.map((f) => <option key={f} value={f}>FY {f}</option>)}
          </select>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
            <Sparkles className="h-4 w-4 text-indigo-600" /> AI Insights
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "Taxable Sales", value: formatCurrency(taxableSales), color: "text-gray-900 dark:text-white" },
              { label: "Taxable Purchases", value: formatCurrency(taxablePurchases), color: "text-gray-900 dark:text-white" },
              { label: "Output GST", value: formatCurrency(outputGst), color: "text-amber-600" },
              { label: "Input Tax Credit", value: formatCurrency(inputTaxCredit), color: "text-emerald-600" },
              { label: "Net GST Payable", value: formatCurrency(netGstPayable), color: "text-red-500" },
              { label: "Excess ITC", value: formatCurrency(excessItc), color: "text-indigo-600" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-800">
            <div className="flex gap-0">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key as any)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === "overview" && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Monthly Trend */}
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Monthly GST Trend (FY {fy})</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={monthlyGst} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="Output GST" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Input GST (ITC)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Rate Breakdown Pie */}
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">GST Rate Breakup (by Taxable Value)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={rateBreakdown} dataKey="taxable" nameKey="rate" cx="50%" cy="50%" outerRadius={80} label={({ rate, percent }) => `${rate} (${(percent * 100).toFixed(0)}%)`}>
                      {rateBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Tax Rate Summary */}
              <div className="md:col-span-2 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tax Rate Wise Summary</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                      {["GST Rate", "Taxable Value", "GST Amount", "CGST", "SGST"].map((h) => (
                        <TableHead key={h} className="text-xs font-semibold uppercase tracking-wide text-gray-500 py-3">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateBreakdown.map((row) => (
                      <TableRow key={row.rate} className="hover:bg-gray-50/60 dark:hover:bg-gray-900/40 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                        <TableCell className="text-sm font-semibold text-gray-900 dark:text-white py-3">{row.rate}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300">{formatCurrency(row.taxable)}</TableCell>
                        <TableCell className="text-sm font-medium text-amber-600">{formatCurrency(row.gstAmt)}</TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(row.cgst)}</TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(row.sgst)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 dark:bg-gray-900/50 font-semibold">
                      <TableCell className="text-sm font-bold text-gray-900 dark:text-white py-3">Total</TableCell>
                      <TableCell className="text-sm font-bold">{formatCurrency(rateBreakdown.reduce((s, r) => s + r.taxable, 0))}</TableCell>
                      <TableCell className="text-sm font-bold text-amber-600">{formatCurrency(rateBreakdown.reduce((s, r) => s + r.gstAmt, 0))}</TableCell>
                      <TableCell className="text-sm font-bold">{formatCurrency(rateBreakdown.reduce((s, r) => s + r.cgst, 0))}</TableCell>
                      <TableCell className="text-sm font-bold">{formatCurrency(rateBreakdown.reduce((s, r) => s + r.sgst, 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {tab === "gstr1" && (
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">GSTR-1 — Outward Supplies (Sales)</h3>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Export</Button>
              </div>
              {gstr1Entries.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-500">No sale invoices for FY {fy}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                      {["Date", "Recipient", "GSTIN", "Invoice #", "Taxable Value", "GST Rate", "CGST", "SGST", "Invoice Total"].map((h) => (
                        <TableHead key={h} className="text-xs font-semibold uppercase tracking-wide text-gray-500 py-3">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gstr1Entries.map((row, i) => (
                      <TableRow key={i} className="hover:bg-gray-50/60 dark:hover:bg-gray-900/40 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                        <TableCell className="text-xs text-gray-500 py-2.5">{row.date}</TableCell>
                        <TableCell className="text-sm font-medium text-gray-900 dark:text-white">{row.vendor}</TableCell>
                        <TableCell className="text-xs font-mono text-indigo-600">{row.gstin}</TableCell>
                        <TableCell className="text-xs text-gray-600 dark:text-gray-400">{row.invoiceNo}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300">{formatCurrency(row.taxable)}</TableCell>
                        <TableCell className="text-sm text-gray-500">{row.gstRate}</TableCell>
                        <TableCell className="text-sm text-amber-600">{formatCurrency(row.cgst)}</TableCell>
                        <TableCell className="text-sm text-amber-600">{formatCurrency(row.sgst)}</TableCell>
                        <TableCell className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {tab === "gstr2" && (
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">GSTR-2 — Inward Supplies (Purchases)</h3>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Export</Button>
              </div>
              {gstr2Entries.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-500">No purchase invoices for FY {fy}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                      {["Date", "Supplier", "GSTIN", "Invoice #", "Taxable Value", "GST Rate", "CGST", "SGST", "ITC Available"].map((h) => (
                        <TableHead key={h} className="text-xs font-semibold uppercase tracking-wide text-gray-500 py-3">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gstr2Entries.map((row, i) => (
                      <TableRow key={i} className="hover:bg-gray-50/60 dark:hover:bg-gray-900/40 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                        <TableCell className="text-xs text-gray-500 py-2.5">{row.date}</TableCell>
                        <TableCell className="text-sm font-medium text-gray-900 dark:text-white">{row.vendor}</TableCell>
                        <TableCell className="text-xs font-mono text-indigo-600">{row.gstin}</TableCell>
                        <TableCell className="text-xs text-gray-600 dark:text-gray-400">{row.invoiceNo}</TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300">{formatCurrency(row.taxable)}</TableCell>
                        <TableCell className="text-sm text-gray-500">{row.gstRate}</TableCell>
                        <TableCell className="text-sm text-amber-600">{formatCurrency(row.cgst)}</TableCell>
                        <TableCell className="text-sm text-amber-600">{formatCurrency(row.sgst)}</TableCell>
                        <TableCell className="text-sm font-semibold text-emerald-600">{formatCurrency(row.itc)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {tab === "gstr3b" && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">3.1 — Outward Supplies</h3>
                </div>
                <Table>
                  <TableBody>
                    {[
                      { label: "(a) Taxable Outward Supplies", value: taxableSales },
                      { label: "(b) Output GST (IGST/CGST/SGST)", value: outputGst },
                      { label: "(c) Zero-rated Supplies", value: 0 },
                      { label: "(d) Nil-rated Supplies", value: 0 },
                    ].map((row) => (
                      <TableRow key={row.label} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300 py-3 pl-5">{row.label}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-gray-900 dark:text-white pr-5">{formatCurrency(row.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">4 — Eligible ITC</h3>
                </div>
                <Table>
                  <TableBody>
                    {[
                      { label: "(a) ITC Available (Purchases)", value: inputTaxCredit },
                      { label: "(b) ITC Reversed", value: 0 },
                      { label: "(c) Net ITC Available", value: inputTaxCredit },
                    ].map((row) => (
                      <TableRow key={row.label} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300 py-3 pl-5">{row.label}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-emerald-600 pr-5">{formatCurrency(row.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:col-span-2 rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-indigo-100 dark:border-indigo-900">
                  <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">6.1 — Payment of Tax</h3>
                </div>
                <Table>
                  <TableBody>
                    {[
                      { label: "Output Tax Payable (CGST + SGST)", value: outputGst, color: "text-red-500" },
                      { label: "Less: Input Tax Credit", value: inputTaxCredit, color: "text-emerald-600" },
                      { label: "NET TAX PAYABLE", value: netGstPayable, color: "text-indigo-600 font-bold text-lg" },
                    ].map((row) => (
                      <TableRow key={row.label} className="border-b border-indigo-100/50 dark:border-indigo-900/50 last:border-0">
                        <TableCell className={`text-sm text-gray-700 dark:text-gray-300 py-4 pl-5 ${row.label === "NET TAX PAYABLE" ? "font-bold text-indigo-800 dark:text-indigo-200" : ""}`}>{row.label}</TableCell>
                        <TableCell className={`text-right text-sm pr-5 ${row.color}`}>{formatCurrency(row.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:col-span-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">GST Filing Deadlines</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  GSTR-1 is due on the <strong>11th of each month</strong> for monthly filers. GSTR-3B is due by the <strong>20th</strong>. Always consult a CA for accurate filing. This report is for reference only.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
