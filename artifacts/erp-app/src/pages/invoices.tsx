import { useListInvoices } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, FileText, Loader2, Download, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";

function TypeBadge({ type }: { type: string }) {
  if (type === "purchase") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
        <ArrowDownLeft className="h-3 w-3" /> purchase
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
      <ArrowUpRight className="h-3 w-3" /> sale
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "verified":
    case "paid":
      return <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border border-green-200 text-green-700 dark:border-green-800 dark:text-green-400">verified</span>;
    case "flagged":
    case "overdue":
      return <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border border-red-200 text-red-600 dark:border-red-800 dark:text-red-400">flagged</span>;
    default:
      return <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border border-orange-200 text-orange-600 dark:border-orange-800 dark:text-orange-400">pending</span>;
  }
}

function exportCSV(invoices: any[]) {
  const headers = ["Vendor", "GSTIN", "Invoice #", "Amount", "GST", "Type", "Status", "Date"];
  const rows = invoices.map((i) => [
    i.customerName,
    i.buyerGstin || "–",
    i.invoiceNumber,
    i.totalAmount,
    i.gstAmount,
    i.type || "sale",
    i.status,
    formatDate(i.createdAt),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "invoices.csv";
  a.click();
}

export default function Invoices() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading } = useListInvoices({
    search: debouncedSearch,
    limit: 200,
  });

  const allInvoices = data?.invoices || [];

  const gstRate = (inv: any) => {
    const sub = Number(inv.subtotal || 0);
    const gst = Number(inv.gstAmount || 0);
    if (!sub || sub === 0) return "18%";
    return Math.round((gst / sub) * 100) + "%";
  };

  const filtered = allInvoices.filter((inv) => {
    if (typeFilter !== "all" && (inv as any).type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage all your purchase and sale invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Link href="/invoice-generator">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5">
              <Plus className="h-4 w-4" /> Add Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search invoices..."
            className="pl-9 rounded-xl border-gray-200 dark:border-gray-700"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="sale">Sale</option>
          <option value="purchase">Purchase</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">No invoices found</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            {search || typeFilter !== "all" ? "Try adjusting your filters" : "Create your first invoice to get started"}
          </p>
          {!search && typeFilter === "all" && (
            <Link href="/invoice-generator">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">Add Invoice</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500 py-3">Vendor</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">GSTIN</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Invoice #</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500 text-right">Amount</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">GST</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Type</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Status</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide text-gray-500">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((invoice) => (
                <TableRow key={invoice.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-900/40 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <TableCell className="font-medium text-sm text-gray-900 dark:text-white py-3">
                    <Link href={`/invoices/${invoice.id}`} className="hover:text-indigo-600 transition-colors">
                      {invoice.customerName || "–"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                    {(invoice as any).buyerGstin || "–"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700 dark:text-gray-300">{invoice.invoiceNumber}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(invoice.totalAmount)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{gstRate(invoice)}</TableCell>
                  <TableCell><TypeBadge type={(invoice as any).type || "sale"} /></TableCell>
                  <TableCell><StatusBadge status={invoice.status} /></TableCell>
                  <TableCell className="text-sm text-gray-500">{formatDate(invoice.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
