import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Search, Pencil, Trash2, X, Building2, Phone, Mail, MapPin } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

type Vendor = {
  id: number; name: string; legalName?: string; gstin?: string; contactPerson?: string;
  email?: string; phone?: string; address?: string; city?: string; state?: string;
  category?: string; paymentTerms?: string; isActive: boolean;
};
type Form = Omit<Vendor, "id" | "isActive"> & { isActive: boolean };
const emptyForm: Form = { name: "", legalName: "", gstin: "", contactPerson: "", email: "", phone: "", address: "", city: "", state: "", category: "", paymentTerms: "30", isActive: true };

export default function Vendors() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({ queryKey: ["vendors"], queryFn: () => apiFetch("/vendors") });
  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/vendors", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendors"] }); setShowForm(false); setForm(emptyForm); toast({ title: "Vendor added" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => apiFetch(`/vendors/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendors"] }); setEditing(null); setShowForm(false); toast({ title: "Vendor updated" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/vendors/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendors"] }); toast({ title: "Vendor removed" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const vendors: Vendor[] = data?.vendors ?? [];
  const filtered = vendors.filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.gstin?.toLowerCase().includes(search.toLowerCase()) || v.email?.toLowerCase().includes(search.toLowerCase()));

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(v: Vendor) { setEditing(v); setForm({ name: v.name, legalName: v.legalName ?? "", gstin: v.gstin ?? "", contactPerson: v.contactPerson ?? "", email: v.email ?? "", phone: v.phone ?? "", address: v.address ?? "", city: v.city ?? "", state: v.state ?? "", category: v.category ?? "", paymentTerms: v.paymentTerms ?? "30", isActive: v.isActive }); setShowForm(true); }
  function handleSubmit() {
    if (editing) updateMutation.mutate({ id: editing.id, body: form });
    else createMutation.mutate(form);
  }
  const f = (k: keyof Form, val: string | boolean) => setForm(prev => ({ ...prev, [k]: val }));

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Vendor Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage suppliers, contractors, and service providers</p>
        </div>
        <Button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-sm gap-1.5">
          <Plus className="h-4 w-4" /> Add Vendor
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input placeholder="Search vendors…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Badge variant="outline" className="text-xs">{vendors.length} vendors</Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardContent className="py-16 text-center">
            <Building2 className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No vendors yet. Add your suppliers and contractors.</p>
            <Button onClick={openAdd} className="mt-4 bg-indigo-600 text-white h-8 text-xs gap-1"><Plus className="h-3 w-3" />Add Vendor</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(v => (
            <Card key={v.id} className="border border-gray-100 dark:border-gray-800 hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-indigo-600">{v.name.charAt(0)}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(v)}>
                      <Pencil className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => { if (confirm(`Delete ${v.name}?`)) deleteMutation.mutate(v.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{v.name}</h3>
                {v.legalName && v.legalName !== v.name && <p className="text-xs text-gray-400 mt-0.5">{v.legalName}</p>}
                <div className="mt-3 space-y-1.5">
                  {v.gstin && <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="font-mono bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded text-[10px]">GSTIN: {v.gstin}</span></div>}
                  {v.phone && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Phone className="h-3 w-3" />{v.phone}</div>}
                  {v.email && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Mail className="h-3 w-3" />{v.email}</div>}
                  {v.city && <div className="flex items-center gap-1.5 text-xs text-gray-500"><MapPin className="h-3 w-3" />{v.city}{v.state ? `, ${v.state}` : ""}</div>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {v.category && <Badge variant="outline" className="text-[10px] capitalize">{v.category}</Badge>}
                  {v.paymentTerms && <span className="text-[10px] text-gray-400">Net {v.paymentTerms} days</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Slide-over */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end" onClick={() => setShowForm(false)}>
          <div className="w-[420px] h-full bg-white dark:bg-gray-950 shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">{editing ? "Edit Vendor" : "New Vendor"}</h2>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 p-5 space-y-3">
              {([["name", "Vendor Name *"], ["legalName", "Legal / Registered Name"], ["gstin", "GSTIN"], ["pan", "PAN"], ["contactPerson", "Contact Person"], ["email", "Email"], ["phone", "Phone"], ["address", "Address"], ["city", "City"], ["state", "State"]] as [keyof Form, string][]).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Input value={form[key] as string} onChange={e => f(key, e.target.value)} className="h-8 text-sm" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <select value={form.category as string} onChange={e => f("category", e.target.value)}
                    className="w-full h-8 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2">
                    {["", "supplier", "contractor", "service", "utility", "logistics", "other"].map(c => <option key={c} value={c}>{c || "Select…"}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Terms (days)</Label>
                  <Input value={form.paymentTerms as string} onChange={e => f("paymentTerms", e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSubmit}
                disabled={!form.name || createMutation.isPending || updateMutation.isPending}>
                {editing ? "Save Changes" : "Add Vendor"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
