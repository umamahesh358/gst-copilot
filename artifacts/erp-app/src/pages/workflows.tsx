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
import { Plus, Zap, X, Trash2, ToggleLeft, ToggleRight, Play, Clock, Bell, Package, Receipt, AlertTriangle } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

type Rule = {
  id: number; name: string; description?: string; triggerType: string; actionType: string;
  isActive: boolean; runCount: number; lastRunAt?: string; lastRunStatus?: string; createdAt: string;
};
type Form = { name: string; description: string; triggerType: string; actionType: string; isActive: boolean };
const emptyForm: Form = { name: "", description: "", triggerType: "low_stock", actionType: "notify", isActive: true };

const TRIGGERS = [
  { value: "low_stock", label: "Low Stock", icon: Package, description: "When product stock falls below threshold" },
  { value: "invoice_overdue", label: "Invoice Overdue", icon: Receipt, description: "When an invoice passes its due date" },
  { value: "payment_received", label: "Payment Received", icon: Bell, description: "When a payment is marked as received" },
  { value: "month_end", label: "Month End", icon: Clock, description: "At the end of each calendar month" },
  { value: "expense_high", label: "Large Expense", icon: AlertTriangle, description: "When expense exceeds a threshold" },
  { value: "scheduled_daily", label: "Daily Schedule", icon: Clock, description: "Runs every day at a set time" },
  { value: "scheduled_weekly", label: "Weekly Schedule", icon: Clock, description: "Runs every week" },
];

const ACTIONS = [
  { value: "notify", label: "In-app Notification", description: "Send a notification to the user" },
  { value: "create_reminder", label: "Create Reminder", description: "Add a task reminder" },
  { value: "generate_report", label: "Generate Report", description: "Auto-generate an analytics snapshot" },
  { value: "flag_invoice", label: "Flag Invoice", description: "Mark invoice as flagged for review" },
  { value: "auto_backup", label: "Trigger Backup", description: "Start a cloud backup automatically" },
];

export default function Workflows() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({ queryKey: ["automation-rules"], queryFn: () => apiFetch("/automation/rules") });
  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/automation/rules", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automation-rules"] }); setShowForm(false); setForm(emptyForm); toast({ title: "Automation rule created" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const toggleMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/automation/rules/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/automation/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automation-rules"] }); toast({ title: "Rule deleted" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const rules: Rule[] = data?.rules ?? [];
  const f = (k: keyof Form, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

  const triggerInfo = (type: string) => TRIGGERS.find(t => t.value === type);
  const actionInfo = (type: string) => ACTIONS.find(a => a.value === type);

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Automation Workflows</h1>
          <p className="text-sm text-gray-500 mt-0.5">Set up rules to automate repetitive tasks and alerts</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-sm gap-1.5">
          <Plus className="h-4 w-4" /> New Rule
        </Button>
      </div>

      {/* Preset suggestions */}
      {rules.length === 0 && !isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: "Low Stock Alert", trigger: "low_stock", action: "notify", desc: "Get notified when products run low" },
            { name: "Overdue Invoice Reminder", trigger: "invoice_overdue", action: "flag_invoice", desc: "Auto-flag overdue invoices" },
            { name: "Monthly Backup", trigger: "month_end", action: "auto_backup", desc: "Trigger cloud backup each month" },
          ].map(preset => (
            <button key={preset.name} onClick={() => { setForm({ name: preset.name, description: preset.desc, triggerType: preset.trigger, actionType: preset.action, isActive: true }); setShowForm(true); }}
              className="text-left p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{preset.name}</span>
              </div>
              <p className="text-xs text-gray-400">{preset.desc}</p>
              <p className="text-[10px] text-indigo-500 mt-2">Click to set up →</p>
            </button>
          ))}
        </div>
      )}

      {/* Rules list */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : rules.length === 0 ? null : (
        <div className="space-y-3">
          {rules.map(rule => {
            const trig = triggerInfo(rule.triggerType);
            const act = actionInfo(rule.actionType);
            const TrigIcon = trig?.icon ?? Zap;
            return (
              <Card key={rule.id} className={cn("border transition-all", rule.isActive ? "border-gray-100 dark:border-gray-800" : "border-gray-100 dark:border-gray-800 opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", rule.isActive ? "bg-indigo-100 dark:bg-indigo-950" : "bg-gray-100 dark:bg-gray-800")}>
                        <TrigIcon className={cn("h-4 w-4", rule.isActive ? "text-indigo-600" : "text-gray-400")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{rule.name}</p>
                          <Badge variant="outline" className={cn("text-[10px]", rule.isActive ? "text-emerald-600 border-emerald-300 dark:border-emerald-700" : "text-gray-400")}>
                            {rule.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        {rule.description && <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <div className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-900 rounded px-2 py-0.5">
                            <span className="text-gray-400">WHEN</span>
                            <span className="font-medium">{trig?.label ?? rule.triggerType}</span>
                          </div>
                          <span className="text-gray-300 dark:text-gray-600">→</span>
                          <div className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-900 rounded px-2 py-0.5">
                            <span className="text-gray-400">THEN</span>
                            <span className="font-medium">{act?.label ?? rule.actionType}</span>
                          </div>
                          {rule.runCount > 0 && (
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                              <Play className="h-3 w-3" /> Ran {rule.runCount}×
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleMutation.mutate(rule.id)}>
                        {rule.isActive
                          ? <ToggleRight className="h-5 w-5 text-indigo-600" />
                          : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => { if (confirm(`Delete "${rule.name}"?`)) deleteMutation.mutate(rule.id); }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form slide-over */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end" onClick={() => setShowForm(false)}>
          <div className="w-[400px] h-full bg-white dark:bg-gray-950 shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">New Automation Rule</h2>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Rule Name</Label>
                <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Low Stock Notification" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={form.description} onChange={e => f("description", e.target.value)} placeholder="Optional description" className="h-8 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Trigger — When this happens</Label>
                <div className="space-y-1.5">
                  {TRIGGERS.map(t => (
                    <button key={t.value} onClick={() => f("triggerType", t.value)}
                      className={cn("w-full text-left p-3 rounded-lg border text-sm transition-all", form.triggerType === t.value ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600")}>
                      <div className="flex items-center gap-2">
                        <t.icon className={cn("h-3.5 w-3.5", form.triggerType === t.value ? "text-indigo-600" : "text-gray-400")} />
                        <span className="font-medium text-gray-800 dark:text-gray-200">{t.label}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 ml-5">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Action — Do this</Label>
                <div className="space-y-1.5">
                  {ACTIONS.map(a => (
                    <button key={a.value} onClick={() => f("actionType", a.value)}
                      className={cn("w-full text-left p-3 rounded-lg border text-sm transition-all", form.actionType === a.value ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600")}>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{a.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}>
                Create Rule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
