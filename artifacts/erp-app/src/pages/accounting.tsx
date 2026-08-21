import { useListTransactions, useListInvoices, useCreateTransaction, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, TrendingUp, TrendingDown, DollarSign, Receipt } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const txnSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Category required"),
  description: z.string().min(1, "Description required"),
  amount: z.coerce.number().min(0.01, "Amount > 0"),
  date: z.string().min(1, "Date required"),
});
type TxnForm = z.infer<typeof txnSchema>;

const CATEGORIES = {
  income: ["Invoice", "Sale", "Interest", "Refund", "Other Income"],
  expense: ["Purchase", "Salary", "Rent", "Utilities", "Travel", "Marketing", "Tax", "Other Expense"],
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Accounting() {
  const [tab, setTab] = useState<"ledger" | "pl" | "balance">("ledger");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTxn = useCreateTransaction();

  const { data: txnData, isLoading: txnLoading } = useListTransactions({ limit: 500 });
  const { data: invData, isLoading: invLoading } = useListInvoices({ limit: 500 });

  const isLoading = txnLoading || invLoading;

  const transactions = txnData?.transactions || [];
  const invoices = invData?.invoices || [];

  const totalRevenue = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  // D3 fix: Proper GST payable = output GST (sales) - input ITC (purchases with GSTIN)
  const saleInvoices = invoices.filter((i) => (i as any).type !== "purchase");
  const purchaseInvoices = invoices.filter((i) => (i as any).type === "purchase");
  const outputGst = saleInvoices.reduce((s, i) => s + Number(i.gstAmount || 0), 0);
  const inputItc = purchaseInvoices
    .filter((i) => (i as any).sellerGstin && (i as any).sellerGstin.trim().length === 15)
    .reduce((s, i) => s + Number(i.gstAmount || 0), 0);
  const totalGstPayable = Math.max(0, outputGst - inputItc);

  // Build ledger entries from transactions + invoices
  const ledgerEntries = (() => {
    const entries: Array<{
      date: string;
      particulars: string;
      reference: string;
      category: string;
      credit: number;
      debit: number;
    }> = [];

    invoices.forEach((inv) => {
      const isIncome = (inv as any).type !== "purchase";
      entries.push({
        date: inv.createdAt,
        particulars: inv.customerName || "Unknown",
        reference: inv.invoiceNumber,
        category: isIncome ? "Sales" : "Purchases",
        credit: isIncome ? Number(inv.totalAmount) : 0,
        debit: isIncome ? 0 : Number(inv.totalAmount),
      });
      // D2 fix: Removed duplicate entry that was inflating balances by 2x
    });

    transactions.forEach((txn) => {
      entries.push({
        date: txn.date || txn.createdAt,
        particulars: txn.description,
        reference: txn.referenceNumber || "–",
        category: txn.category || "–",
        credit: txn.type === "income" ? Number(txn.amount) : 0,
        debit: txn.type === "expense" ? Number(txn.amount) : 0,
      });
    });

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let balance = 0;
    return entries.map((e) => {
      balance += e.credit - e.debit;
      return { ...e, balance };
    });
  })();

  // P&L by month
  const currentYear = new Date().getFullYear();
  const plMonths = MONTHS.map((month, idx) => {
    const monthTxns = transactions.filter((t) => {
      const d = new Date(t.date || t.createdAt);
      return d.getFullYear() === currentYear && d.getMonth() === idx;
    });
    const revenue = monthTxns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expenses = monthTxns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { month, revenue, expenses, profit: revenue - expenses };
  });

  const form = useForm<TxnForm>({
    resolver: zodResolver(txnSchema),
    defaultValues: { type: "income", category: "", description: "", amount: 0, date: new Date().toISOString().split("T")[0] },
  });
  const txnType = form.watch("type");

  const onSubmit = (values: TxnForm) => {
    createTxn.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        toast({ title: "Transaction added" });
        form.reset({ type: "income", category: "", description: "", amount: 0, date: new Date().toISOString().split("T")[0] });
        setOpen(false);
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message }),
    });
  };

  const TABS = [
    { key: "ledger", label: "Ledger" },
    { key: "pl", label: "Profit & Loss" },
    { key: "balance", label: "Balance Sheet" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Accounting</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Ledger, Profit &amp; Loss, and Balance Sheet</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add Transaction
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "TOTAL REVENUE", value: formatCurrency(totalRevenue), icon: TrendingUp, color: "text-emerald-600" },
          { label: "TOTAL EXPENSES", value: formatCurrency(totalExpenses), icon: TrendingDown, color: "text-red-500" },
          { label: "NET PROFIT/LOSS", value: formatCurrency(Math.abs(netProfit)), icon: DollarSign, color: netProfit >= 0 ? "text-indigo-600" : "text-red-500" },
          { label: "NET GST PAYABLE", value: formatCurrency(totalGstPayable), icon: Receipt, color: "text-amber-600" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${kpi.color}`} />
                <p className="text-xs font-semibold tracking-widest uppercase text-gray-400">{kpi.label}</p>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{isLoading ? "..." : kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : tab === "ledger" ? (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950 shadow-sm">
          {ledgerEntries.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">No transactions yet. Add your first transaction.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 py-3">Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">Particulars</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reference</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-right text-emerald-600">Credit</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-right text-red-500">Debit</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((row, i) => (
                  <TableRow key={i} className="hover:bg-gray-50/60 dark:hover:bg-gray-900/40 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                    <TableCell className="text-sm text-indigo-600 dark:text-indigo-400 font-medium py-2.5">
                      {formatDate(row.date)}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-gray-900 dark:text-white">{row.particulars}</TableCell>
                    <TableCell className="text-xs font-mono text-gray-500">{row.reference}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {row.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-emerald-600">
                      {row.credit > 0 ? formatCurrency(row.credit) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-red-500">
                      {row.debit > 0 ? formatCurrency(row.debit) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-bold ${row.balance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {formatCurrency(Math.abs(row.balance))} {row.balance >= 0 ? "Cr" : "Dr"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ) : tab === "pl" ? (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 py-3">Month</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-right text-emerald-600">Revenue</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-right text-red-500">Expenses</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Net Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plMonths.map((row) => (
                <TableRow key={row.month} className={`hover:bg-gray-50/60 dark:hover:bg-gray-900/40 border-b border-gray-50 dark:border-gray-800/50 last:border-0 ${row.revenue === 0 && row.expenses === 0 ? "opacity-40" : ""}`}>
                  <TableCell className="text-sm font-medium text-gray-900 dark:text-white py-2.5">{row.month} {currentYear}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-emerald-600">{formatCurrency(row.revenue)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-red-500">{formatCurrency(row.expenses)}</TableCell>
                  <TableCell className={`text-right text-sm font-bold ${row.profit >= 0 ? "text-indigo-600" : "text-red-500"}`}>
                    {row.profit >= 0 ? "+" : ""}{formatCurrency(row.profit)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-gray-50 dark:bg-gray-900/50 font-semibold">
                <TableCell className="text-sm text-gray-900 dark:text-white py-3">Total {currentYear}</TableCell>
                <TableCell className="text-right text-sm font-bold text-emerald-600">{formatCurrency(totalRevenue)}</TableCell>
                <TableCell className="text-right text-sm font-bold text-red-500">{formatCurrency(totalExpenses)}</TableCell>
                <TableCell className={`text-right text-sm font-bold ${netProfit >= 0 ? "text-indigo-600" : "text-red-500"}`}>
                  {netProfit >= 0 ? "+" : ""}{formatCurrency(netProfit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Balance Sheet */
        <div className="grid md:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Assets</h3>
            </div>
            <Table>
              <TableBody>
                {[
                  { label: "Cash & Bank (Revenue)", value: totalRevenue },
                  { label: "Trade Receivables (Unpaid Invoices)", value: invoices.filter((i) => i.status !== "paid" && i.status !== "verified").reduce((s, i) => s + Number(i.totalAmount), 0) },
                  { label: "Input Tax Credit (ITC)", value: totalGstPayable * 0.8 },
                ].map((row) => (
                  <TableRow key={row.label} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                    <TableCell className="text-sm text-gray-700 dark:text-gray-300 py-3 pl-5">{row.label}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-gray-900 dark:text-white pr-5">{formatCurrency(row.value)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-emerald-50/60 dark:bg-emerald-950/20">
                  <TableCell className="text-sm font-bold text-emerald-700 dark:text-emerald-300 py-3 pl-5">Total Assets</TableCell>
                  <TableCell className="text-right text-sm font-bold text-emerald-700 dark:text-emerald-300 pr-5">
                    {formatCurrency(totalRevenue + invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + Number(i.totalAmount), 0) + totalGstPayable * 0.8)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {/* Liabilities & Equity */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Liabilities &amp; Equity</h3>
            </div>
            <Table>
              <TableBody>
                {[
                  { label: "Total Expenses (Liabilities)", value: totalExpenses },
                  { label: "GST Payable", value: totalGstPayable },
                  { label: "Retained Earnings (Net Profit)", value: netProfit },
                ].map((row) => (
                  <TableRow key={row.label} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                    <TableCell className="text-sm text-gray-700 dark:text-gray-300 py-3 pl-5">{row.label}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold pr-5 ${row.value < 0 ? "text-red-500" : "text-gray-900 dark:text-white"}`}>
                      {formatCurrency(Math.abs(row.value))}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-indigo-50/60 dark:bg-indigo-950/20">
                  <TableCell className="text-sm font-bold text-indigo-700 dark:text-indigo-300 py-3 pl-5">Total Liabilities &amp; Equity</TableCell>
                  <TableCell className="text-right text-sm font-bold text-indigo-700 dark:text-indigo-300 pr-5">
                    {formatCurrency(totalExpenses + totalGstPayable + Math.max(0, netProfit))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Add Transaction Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(CATEGORIES[txnType] || []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="Brief description" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (₹)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={createTxn.isPending}>
                  {createTxn.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
