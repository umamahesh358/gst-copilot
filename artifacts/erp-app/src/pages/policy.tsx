import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShieldCheck, Plus, Trash2, CheckCircle2, AlertTriangle, XCircle, Loader2, ToggleLeft, ToggleRight } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const MODULES = ["invoice", "expense", "approval", "vendor", "customer", "reconciliation", "accounting"];
const CONDITIONS = ["amount_threshold", "approval_required", "period_locked", "duplicate_check", "vendor_limit"];
const OPERATORS = [{ id: "gt", label: "Greater than" }, { id: "gte", label: "At least" }, { id: "lt", label: "Less than" }, { id: "eq", label: "Equals" }];
const ACTIONS = [{ id: "require_approval", label: "Require Approval" }, { id: "block", label: "Block Action" }, { id: "notify", label: "Send Notification" }, { id: "log", label: "Log Only" }];

const PRESET_RULES = [
  { name: "Invoice Approval Threshold", module: "invoice", conditionType: "amount_threshold", conditionOperator: "gt", conditionValue: 100000, action: "require_approval", description: "Invoices above ₹1L require approval" },
  { name: "Expense Limit Policy", module: "expense", conditionType: "amount_threshold", conditionOperator: "gt", conditionValue: 25000, action: "require_approval", description: "Expenses above ₹25K require manager approval" },
  { name: "Large Vendor Payment", module: "vendor", conditionType: "vendor_limit", conditionOperator: "gt", conditionValue: 500000, action: "require_approval", description: "Vendor payments above ₹5L need approval" },
];

export default function Policy() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", module: "invoice", conditionType: "amount_threshold", conditionOperator: "gt", conditionValue: "", action: "require_approval" });
  const [tab, setTab] = useState<"rules" | "violations">("rules");

  const { data: rulesData, isLoading: rulesLoading } = useQuery({ queryKey: ["policy-rules"], queryFn: () => apiFetch("/policy/rules") });
  const { data: violationsData, isLoading: vLoading } = useQuery({ queryKey: ["policy-violations"], queryFn: () => apiFetch("/policy/violations") });

  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/policy/rules", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["policy-rules"] }); setShowNew(false); toast({ title: "Policy rule created" }); },
    onError: () => toast({ title: "Failed to create rule", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; isActive: number }) => apiFetch(`/policy/rules/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy-rules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/policy/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy-rules"] }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/policy/violations/${id}/resolve`, { method: "POST", body: JSON.stringify({ note: "Resolved by admin" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy-violations"] }),
  });

  const presetMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/policy/rules", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["policy-rules"] }); toast({ title: "Preset rule added" }); },
  });

  const rules = (rulesData?.rules ?? []) as Record<string, unknown>[];
  const violations = (violationsData?.violations ?? []) as Record<string, unknown>[];

  const openViolations = violations.filter(v => v.status === "open").length;
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" /> Policy & Compliance Engine
            <Badge className="text-[9px] bg-indigo-600 text-white border-0">V5</Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Define business rules and track compliance violations</p>
        </div>
        <Button className="h-9 text-sm bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Rule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <div><p className="text-lg font-bold text-gray-900 dark:text-white">{rules.filter(r => r.isActive === 1).length}</p><p className="text-xs text-gray-500">Active Rules</p></div>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div><p className="text-lg font-bold text-gray-900 dark:text-white">{openViolations}</p><p className="text-xs text-gray-500">Open Violations</p></div>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div><p className="text-lg font-bold text-gray-900 dark:text-white">{violations.filter(v => v.status === "resolved").length}</p><p className="text-xs text-gray-500">Resolved</p></div>
          </CardContent>
        </Card>
      </div>

      {rules.length === 0 && !rulesLoading && (
        <Card className="border border-dashed border-gray-200 dark:border-gray-700">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Quick-start with preset rules</p>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_RULES.map(p => (
                <button key={p.name} onClick={() => presetMutation.mutate(p)}
                  className="text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{p.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{p.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showNew && (
        <Card className="border border-indigo-200 dark:border-indigo-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm">New Policy Rule</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-xs font-medium">Rule Name</label><Input value={form.name} onChange={e => f("name", e.target.value)} className="h-8 text-sm" placeholder="Invoice Approval Threshold" /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Module</label>
                <Select value={form.module} onValueChange={v => f("module", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="text-xs font-medium">Condition</label>
                <Select value={form.conditionType} onValueChange={v => f("conditionType", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="text-xs font-medium">Operator</label>
                <Select value={form.conditionOperator} onValueChange={v => f("conditionOperator", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{OPERATORS.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="text-xs font-medium">Threshold Value (₹)</label><Input type="number" value={form.conditionValue} onChange={e => f("conditionValue", e.target.value)} className="h-8 text-sm" placeholder="100000" /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Action</label>
                <Select value={form.action} onValueChange={v => f("action", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIONS.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="h-8 text-sm bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!form.name || createMutation.isPending}
                onClick={() => createMutation.mutate({ ...form, conditionValue: form.conditionValue ? parseFloat(form.conditionValue) : null })}>
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Save Rule
              </Button>
              <Button variant="outline" className="h-8 text-sm" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(["rules", "violations"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-2 text-sm font-medium transition-colors capitalize",
            tab === t ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200")}>
            {t} {t === "violations" && openViolations > 0 && <span className="ml-1 text-[10px] bg-red-500 text-white rounded-full px-1.5">{openViolations}</span>}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <div className="space-y-2">
          {rulesLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
          {rules.map(rule => {
            const r = rule as Record<string, unknown>;
            return (
              <Card key={r.id as number} className="border border-gray-100 dark:border-gray-800">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.name as string}</p>
                      <Badge className={cn("text-[9px] border-0", r.isActive === 1 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-gray-100 text-gray-500")}>{r.isActive === 1 ? "Active" : "Inactive"}</Badge>
                      <Badge className="text-[9px] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-0">{r.module as string}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{r.conditionType as string} {r.conditionOperator as string} {r.conditionValue !== null ? `₹${(r.conditionValue as number).toLocaleString()}` : ""} → {r.action as string}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateMutation.mutate({ id: r.id as number, isActive: r.isActive === 1 ? 0 : 1 })} className="text-gray-400 hover:text-indigo-600 transition-colors">
                      {r.isActive === 1 ? <ToggleRight className="h-5 w-5 text-indigo-600" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button onClick={() => deleteMutation.mutate(r.id as number)} className="text-gray-300 hover:text-red-500 transition-colors ml-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!rulesLoading && rules.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No policy rules yet</p>}
        </div>
      )}

      {tab === "violations" && (
        <div className="space-y-2">
          {vLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
          {violations.map(v => {
            const viol = v as Record<string, unknown>;
            return (
              <Card key={viol.id as number} className={cn("border", viol.status === "open" ? "border-red-200 dark:border-red-800" : "border-gray-100 dark:border-gray-800")}>
                <CardContent className="p-3 flex items-start gap-3">
                  <AlertTriangle className={cn("h-4 w-4 mt-0.5 flex-shrink-0", viol.status === "open" ? "text-red-500" : "text-gray-400")} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{viol.violationDetail as string}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400">{viol.module as string} · {viol.entityType as string}</span>
                      <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 rounded px-1">{viol.actionTaken as string}</span>
                    </div>
                  </div>
                  {viol.status === "open" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-shrink-0"
                      onClick={() => resolveMutation.mutate(viol.id as number)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                    </Button>
                  )}
                  {viol.status === "resolved" && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">Resolved</Badge>}
                </CardContent>
              </Card>
            );
          })}
          {!vLoading && violations.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No violations recorded</p>}
        </div>
      )}
    </div>
  );
}
