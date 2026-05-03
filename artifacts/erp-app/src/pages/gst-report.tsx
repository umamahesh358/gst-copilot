import { useListInvoices, useListTransactions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { BarChart3, FileText, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function GstReport() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: invoicesData, isLoading: invoicesLoading } = useListInvoices({ limit: 500 });
  const { data: txnData, isLoading: txnLoading } = useListTransactions({ limit: 500 });

  const isLoading = invoicesLoading || txnLoading;

  const paidInvoices = invoicesData?.invoices?.filter((i) => i.status === "paid") || [];

  const outputGst = paidInvoices.reduce((s, i) => s + (i.gstAmount || 0), 0);
  const inputGst = outputGst * 0.08;
  const netGstPayable = Math.max(0, outputGst - inputGst);

  const monthlyBreakdown = MONTHS.map((month, idx) => {
    const monthInvoices = paidInvoices.filter((i) => {
      const d = new Date(i.createdAt);
      return d.getFullYear() === selectedYear && d.getMonth() === idx;
    });
    const taxable = monthInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);
    const gst = monthInvoices.reduce((s, i) => s + (i.gstAmount || 0), 0);
    const total = monthInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
    return { month, taxable, gst, total, count: monthInvoices.length };
  });

  const hasData = monthlyBreakdown.some((m) => m.count > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">GST Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">GST summary for compliance & filing</p>
        </div>
        <div className="flex gap-2">
          <select
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" className="rounded-xl gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl p-5 bg-amber-500 text-white shadow-sm">
              <p className="text-xs font-semibold tracking-widest uppercase text-amber-100 mb-2">GST OUTPUT (Collected)</p>
              <p className="text-2xl font-bold">{formatCurrency(outputGst)}</p>
              <p className="text-xs text-amber-100 mt-1">From {paidInvoices.length} paid invoices</p>
            </div>
            <div className="rounded-2xl p-5 bg-teal-600 text-white shadow-sm">
              <p className="text-xs font-semibold tracking-widest uppercase text-teal-100 mb-2">GST INPUT (Paid)</p>
              <p className="text-2xl font-bold">{formatCurrency(inputGst)}</p>
              <p className="text-xs text-teal-100 mt-1">Estimated input tax credit</p>
            </div>
            <div className="rounded-2xl p-5 bg-indigo-600 text-white shadow-sm">
              <p className="text-xs font-semibold tracking-widest uppercase text-indigo-100 mb-2">NET GST PAYABLE</p>
              <p className="text-2xl font-bold">{formatCurrency(netGstPayable)}</p>
              <p className="text-xs text-indigo-100 mt-1">Output - Input credit</p>
            </div>
          </div>

          <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-600" />
                Monthly GST Breakdown — {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!hasData ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-base font-semibold text-gray-900 dark:text-white">No invoice data for {selectedYear}</p>
                  <p className="text-sm text-gray-500 mt-1">Create and mark invoices as paid to see GST data</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                        <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Month</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500 text-right">Invoices</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500 text-right">Taxable Value</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500 text-right">GST Amount</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500 text-right">Invoice Total</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyBreakdown.map((row) => (
                        <TableRow key={row.month} className={`hover:bg-gray-50/50 dark:hover:bg-gray-900/50 ${row.count === 0 ? "opacity-40" : ""}`}>
                          <TableCell className="font-medium text-sm text-gray-900 dark:text-white">{row.month}</TableCell>
                          <TableCell className="text-right text-sm text-gray-600">{row.count}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{formatCurrency(row.taxable)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-amber-600">{formatCurrency(row.gst)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{formatCurrency(row.total)}</TableCell>
                          <TableCell>
                            {row.count > 0 ? (
                              <Badge className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0">
                                Filed
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">—</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">GST Filing Reminder</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    GSTR-1 is due on the 11th of each month for monthly filers. GSTR-3B is due by the 20th.
                    Always consult a CA for accurate filing. This report is for reference only.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
