import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Pencil, Trash2, X, CheckCircle2, Clock, IndianRupee, ShoppingCart, Filter
} from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const CATEGORIES = ["general", "office", "travel", "utilities", "marketing", "salary", "rent", "equipment", "software", "maintenance", "other"];
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

type Expense = {
  id: number; expenseNumber: string; category: string; description?: string;
  vendorName?: string; totalAmount: string; status: string; expenseDate: string; createdAt: string;
};

type FormData = {
  category: string; description: string; vendorName: string; amount: string; gstRate: string;
  status: string; expenseDate: string; paymentMethod: string; referenceNumber: string; notes: string;
};

const emptyForm: FormData = {
  category: "general", description: "", vendorName: "", amount: "", gstRate: "0",
  status: "pending", expenseDate: new Date().toISOString().split("T")[0],
  paymentMethod: "bank_transfer", referenceNumber: "", notes: "",
};

export default function Expenses() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", statusFilter],
    queryFn: () => apiFetch(`/expenses${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/expenses", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); setShowForm(false); setForm(emptyForm); toast({ title: "Expense added" }); },
    onError: () => toast({ title: "Error", description: "Could not save expense", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => apiFetch(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); setEditing(null); setShowForm(false); setForm(emptyForm); toast({ title: "Expense updated" }); },
    onError: () => toast({ title: "Error", description: "Could not update expense", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast({ title: "Expense deleted" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const expenses: Expense[] = data?.expenses ?? [];
  const filtered = expenses.filter(e =>
    e.expenseNumber?.toLowerCase().includes(search.toLowerCase()) ||
    e.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase()) ||
    e.category?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPending = expenses.filter(e => e.status === "pending").reduce((a, e) => a + parseFloat(e.totalAmount), 0);
  const totalPaid = expenses.filter(e => e.status === "paid").reduce((a, e) => a + parseFloat(e.totalAmount), 0);
  const totalAll = expenses.reduce((a, e) => a + parseFloat(e.totalAmount), 0);

  const gstAmt = () => {
    const amt = parseFloat(form.amount || "0");
    const rate = parseFloat(form.gstRate || "0");
    return amt * rate / 100;
  };
  const totalAmt = () => parseFloat(form.amount || "0") + gstAmt();

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      category: e.category, description: e.description ?? "", vendorName: e.vendorName ?? "",
      amount: e.totalAmount, gstRate: "0", status: e.status,
      expenseDate: e.expenseDate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
      paymentMethod: "bank_transfer", referenceNumber: "", notes: "",
    });
    setShowForm(true);
  }

  function handleSubmit() {
    const body = {
      ...form,
      amount: parseFloat(form.amount || "0"),
      gstAmount: gstAmt(),
      totalAmount: totalAmt(),
      gstRate: parseFloat(form.gstRate || "0"),
    };
    if (editing) updateMutation.mutate({ id: editing.id, body });
    else createMutation.mutate(body);
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Expenses & Payables</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track business expenses, bills, and vendor payments</p>
        </div>
        <Button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-sm gap-1.5">
          <Plus className="h-4 w-4" /> Add Expense
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Expenses", value: totalAll, icon: IndianRupee, color: "bg-indigo-600" },
          { label: "Pending Payment", value: totalPending, icon: Clock, color: "bg-amber-500" },
          { label: "Paid", value: totalPaid, icon: CheckCircle2, color: "bg-emerald-600" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border border-gray-100 dark:border-gray-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", kpi.color)}>
                <kpi.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{kpi.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(kpi.value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input placeholder="Search expenses…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm" />
        </div>
        <div className="flex gap-1.5">
          {["all", "pending", "paid", "overdue"].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
              className={cn("text-xs h-7 capitalize", statusFilter === s ? "bg-indigo-600 text-white" : "")}
              onClick={() => setStatusFilter(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="border border-gray-100 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                {["Expense #", "Category", "Vendor / Description", "Date", "Amount", "Status", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50">
                    {Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <ShoppingCart className="h-8 w-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No expenses found. Add your first expense.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">{e.expenseNumber}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] capitalize">{e.category}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 dark:text-gray-200">{e.vendorName || "—"}</p>
                      {e.description && <p className="text-xs text-gray-400 truncate max-w-[180px]">{e.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{e.expenseDate?.split("T")[0]}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(parseFloat(e.totalAmount))}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[e.status] ?? STATUS_COLORS.pending)}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(e)}>
                          <Pencil className="h-3.5 w-3.5 text-gray-400" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => { if (confirm("Delete this expense?")) deleteMutation.mutate(e.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Form Slide-over */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end" onClick={() => setShowForm(false)}>
          <div className="w-[420px] h-full bg-white dark:bg-gray-950 shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">{editing ? "Edit Expense" : "New Expense"}</h2>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full h-8 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 capitalize">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full h-8 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2">
                    {["pending", "paid", "overdue", "cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vendor / Payee</Label>
                <Input value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} placeholder="e.g. Office Supplies Co." className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount (₹)</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">GST Rate (%)</Label>
                  <Input type="number" value={form.gstRate} onChange={e => setForm(f => ({ ...f, gstRate: e.target.value }))} placeholder="0" className="h-8 text-sm" />
                </div>
              </div>
              {parseFloat(form.amount) > 0 && (
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(parseFloat(form.amount || "0"))}</span></div>
                  <div className="flex justify-between text-gray-500"><span>GST ({form.gstRate}%)</span><span>{formatCurrency(gstAmt())}</span></div>
                  <div className="flex justify-between font-bold text-gray-800 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-1"><span>Total</span><span>{formatCurrency(totalAmt())}</span></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Expense Date</Label>
                  <Input type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Method</Label>
                  <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                    className="w-full h-8 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2">
                    {["bank_transfer", "cash", "upi", "cheque", "card", "other"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reference / Receipt #</Label>
                <Input value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="Optional" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes…" rows={2}
                  className="w-full text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Save Changes" : "Add Expense"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
