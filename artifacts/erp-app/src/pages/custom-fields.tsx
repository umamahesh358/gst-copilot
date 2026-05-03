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
import { Plus, X, Settings2, Trash2, ToggleRight, ToggleLeft, GripVertical } from "lucide-react";

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

type CustomField = { id: number; module: string; name: string; label: string; fieldType: string; isRequired: boolean; isActive: boolean; displayOrder: number; showInList: boolean; options?: string[]; placeholder?: string; defaultValue?: string };

const MODULES = ["customer", "product", "vendor", "invoice", "expense", "transaction"];
const FIELD_TYPES = [
  { value: "text", label: "Text" }, { value: "number", label: "Number" },
  { value: "date", label: "Date" }, { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Dropdown" }, { value: "multiselect", label: "Multi-select" },
  { value: "textarea", label: "Long Text" }, { value: "url", label: "URL" },
  { value: "email", label: "Email" }, { value: "phone", label: "Phone" },
];

const MODULE_COLORS: Record<string, string> = {
  customer: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  product: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  vendor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  invoice: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  expense: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  transaction: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

type FormState = { module: string; name: string; label: string; fieldType: string; isRequired: boolean; placeholder: string; defaultValue: string; showInList: boolean; optionsText: string };
const emptyForm: FormState = { module: "customer", name: "", label: "", fieldType: "text", isRequired: false, placeholder: "", defaultValue: "", showInList: false, optionsText: "" };

export default function CustomFields() {
  const [moduleFilter, setModuleFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["custom-fields", moduleFilter],
    queryFn: () => apiFetch(`/custom-fields${moduleFilter !== "all" ? `?module=${moduleFilter}` : ""}`),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/custom-fields", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-fields"] }); setShowForm(false); setForm(emptyForm); toast({ title: "Custom field created" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => apiFetch(`/custom-fields/${id}`, { method: "PUT", body: JSON.stringify({ isActive: !isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-fields"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/custom-fields/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-fields"] }); toast({ title: "Field deleted" }); },
  });

  const fields: CustomField[] = data?.fields ?? [];
  const f = (k: keyof FormState, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  function handleCreate() {
    const options = form.optionsText ? form.optionsText.split("\n").map(s => s.trim()).filter(Boolean) : undefined;
    createMutation.mutate({ ...form, options, name: form.name || form.label.toLowerCase().replace(/\s+/g, "_") });
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Custom Fields</h1>
          <p className="text-sm text-gray-500 mt-0.5">Add custom data fields to any module in BizOS</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-sm gap-1.5">
          <Plus className="h-4 w-4" /> Add Field
        </Button>
      </div>

      {/* Module filter */}
      <div className="flex gap-1.5 flex-wrap">
        {["all", ...MODULES].map(m => (
          <Button key={m} size="sm" variant={moduleFilter === m ? "default" : "outline"}
            className={cn("text-xs h-7 capitalize", moduleFilter === m ? "bg-indigo-600 text-white" : "")}
            onClick={() => setModuleFilter(m)}>{m}</Button>
        ))}
      </div>

      {/* Fields list */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : fields.length === 0 ? (
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardContent className="py-16 text-center">
            <Settings2 className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">No custom fields yet. Add fields to extend any module.</p>
            <Button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white h-8 text-xs gap-1"><Plus className="h-3 w-3" /> Add Field</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {fields.map(field => (
            <div key={field.id} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border transition-all", field.isActive ? "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950" : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 opacity-60")}>
              <GripVertical className="h-4 w-4 text-gray-300 dark:text-gray-700 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{field.label}</span>
                  <Badge variant="outline" className={cn("text-[10px] capitalize", MODULE_COLORS[field.module] ?? "")}>{field.module}</Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{field.fieldType}</Badge>
                  {field.isRequired && <Badge className="text-[10px] bg-red-100 text-red-600 border-0 dark:bg-red-900/30 dark:text-red-400">Required</Badge>}
                  {field.showInList && <Badge className="text-[10px] bg-blue-100 text-blue-600 border-0 dark:bg-blue-900/30 dark:text-blue-400">In List</Badge>}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{field.name}{field.placeholder ? ` · "${field.placeholder}"` : ""}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleMutation.mutate({ id: field.id, isActive: field.isActive })}>
                  {field.isActive ? <ToggleRight className="h-5 w-5 text-indigo-600" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { if (confirm(`Delete "${field.label}"?`)) deleteMutation.mutate(field.id); }}>
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end" onClick={() => setShowForm(false)}>
          <div className="w-[420px] h-full bg-white dark:bg-gray-950 shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">New Custom Field</h2>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Module</Label>
                <select value={form.module} onChange={e => f("module", e.target.value)} className="w-full h-8 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 capitalize">
                  {MODULES.map(m => <option key={m} value={m} className="capitalize">{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Field Label *</Label>
                <Input value={form.label} onChange={e => f("label", e.target.value)} placeholder="e.g. PAN Number" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Field Key (auto-generated if blank)</Label>
                <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. pan_number" className="h-8 text-sm font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Field Type</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {FIELD_TYPES.map(t => (
                    <button key={t.value} onClick={() => f("fieldType", t.value)}
                      className={cn("text-xs px-2 py-1.5 rounded-lg border transition-all text-left", form.fieldType === t.value ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400")}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {(form.fieldType === "select" || form.fieldType === "multiselect") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Options (one per line)</Label>
                  <textarea value={form.optionsText} onChange={e => f("optionsText", e.target.value)} rows={4}
                    placeholder={"Option 1\nOption 2\nOption 3"}
                    className="w-full text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 resize-none" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Placeholder</Label>
                <Input value={form.placeholder} onChange={e => f("placeholder", e.target.value)} placeholder="Hint text shown in input" className="h-8 text-sm" />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => f("isRequired", !form.isRequired)} className={cn("h-5 w-9 rounded-full transition-all", form.isRequired ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700")}>
                  <div className={cn("h-4 w-4 rounded-full bg-white shadow transition-all mx-0.5", form.isRequired ? "translate-x-4" : "translate-x-0")} />
                </button>
                <span className="text-xs text-gray-600 dark:text-gray-400">Required field</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => f("showInList", !form.showInList)} className={cn("h-5 w-9 rounded-full transition-all", form.showInList ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700")}>
                  <div className={cn("h-4 w-4 rounded-full bg-white shadow transition-all mx-0.5", form.showInList ? "translate-x-4" : "translate-x-0")} />
                </button>
                <span className="text-xs text-gray-600 dark:text-gray-400">Show in list view</span>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleCreate} disabled={!form.label || createMutation.isPending}>
                Create Field
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
