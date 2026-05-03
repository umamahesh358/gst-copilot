import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CheckSquare, Plus, CheckCircle2, Clock, AlertTriangle, Trash2, Calendar, Loader2 } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-100 text-gray-500 dark:bg-gray-800" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" },
  high: { label: "High", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300" },
};

export default function Tasks() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("open");
  const [form, setForm] = useState({ title: "", description: "", priority: "normal", dueDate: "", module: "" });

  const { data: tasksData, isLoading } = useQuery({ queryKey: ["tasks", filter], queryFn: () => apiFetch(`/tasks?status=${filter}`) });
  const { data: statsData } = useQuery({ queryKey: ["tasks-stats"], queryFn: () => apiFetch("/tasks/stats/summary") });
  const { data: dueSoonData } = useQuery({ queryKey: ["tasks-due-soon"], queryFn: () => apiFetch("/tasks/due-soon") });

  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/tasks", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["tasks-stats"] }); setShowNew(false); setForm({ title: "", description: "", priority: "normal", dueDate: "", module: "" }); toast({ title: "Task created" }); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/tasks/${id}/complete`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["tasks-stats"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["tasks-stats"] }); },
  });

  const tasks = (tasksData?.tasks ?? []) as Record<string, unknown>[];
  const stats = statsData?.summary as Record<string, number> | undefined;
  const dueSoon = (dueSoonData?.tasks ?? []) as Record<string, unknown>[];
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const isOverdue = (t: Record<string, unknown>) => t.dueDate && new Date(t.dueDate as string) < new Date() && t.status !== "completed";

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-indigo-600" /> Tasks & Reminders
            <Badge className="text-[9px] bg-indigo-600 text-white border-0">V5</Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track follow-ups, deadlines, and business tasks</p>
        </div>
        <Button className="h-9 text-sm bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Task
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Open", value: stats.open, icon: CheckSquare, color: "text-indigo-600" },
            { label: "Overdue", value: stats.overdue, icon: AlertTriangle, color: "text-red-500" },
            { label: "High Priority", value: stats.high, icon: Clock, color: "text-amber-600" },
            { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-emerald-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border border-gray-100 dark:border-gray-800">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={cn("h-5 w-5 flex-shrink-0", color)} />
                <div><p className="text-lg font-bold text-gray-900 dark:text-white">{value ?? 0}</p><p className="text-xs text-gray-500">{label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dueSoon.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Due within 7 days
          </p>
          <div className="flex gap-2 flex-wrap">
            {dueSoon.slice(0, 4).map(t => (
              <div key={t.id as number} className="text-xs bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
                <span className="font-medium text-gray-800 dark:text-gray-200">{t.title as string}</span>
                <span className="text-gray-400 ml-1.5">{new Date(t.dueDate as string).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showNew && (
        <Card className="border border-indigo-200 dark:border-indigo-800">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">New Task</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><label className="text-xs font-medium">Title</label><Input value={form.title} onChange={e => f("title", e.target.value)} className="h-8 text-sm" placeholder="Follow up with customer…" /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Priority</label>
                <Select value={form.priority} onValueChange={v => f("priority", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="text-xs font-medium">Due Date</label><Input type="date" value={form.dueDate} onChange={e => f("dueDate", e.target.value)} className="h-8 text-sm" /></div>
              <div className="col-span-2 space-y-1"><label className="text-xs font-medium">Description (optional)</label><Input value={form.description} onChange={e => f("description", e.target.value)} className="h-8 text-sm" placeholder="Additional details…" /></div>
            </div>
            <div className="flex gap-2">
              <Button className="h-8 text-sm bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!form.title.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ ...form, dueDate: form.dueDate || undefined })}>
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Create Task
              </Button>
              <Button variant="outline" className="h-8 text-sm" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {["open", "completed"].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={cn("px-4 py-2 text-sm font-medium transition-colors capitalize",
            filter === s ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200")}>{s}</button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
        {tasks.map(task => {
          const t = task as Record<string, unknown>;
          const pCfg = PRIORITY_CONFIG[t.priority as string] ?? PRIORITY_CONFIG.normal;
          const overdue = isOverdue(t);
          return (
            <div key={t.id as number} className={cn("flex items-center gap-3 p-3 rounded-xl border bg-white dark:bg-gray-900 transition-all",
              overdue ? "border-red-200 dark:border-red-800" : "border-gray-100 dark:border-gray-800 hover:border-gray-200")}>
              <button onClick={() => t.status !== "completed" && completeMutation.mutate(t.id as number)}
                className={cn("h-5 w-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                  t.status === "completed" ? "border-emerald-500 bg-emerald-500" : "border-gray-300 dark:border-gray-600 hover:border-indigo-500")}>
                {t.status === "completed" && <CheckCircle2 className="h-3 w-3 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium text-gray-900 dark:text-white", t.status === "completed" && "line-through text-gray-400")}>{t.title as string}</p>
                {t.description && <p className="text-xs text-gray-400 truncate">{t.description as string}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("text-[10px] font-medium rounded px-1.5 py-0.5", pCfg.color)}>{pCfg.label}</span>
                  {t.dueDate && <span className={cn("text-[10px] flex items-center gap-0.5", overdue ? "text-red-500" : "text-gray-400")}>
                    <Calendar className="h-2.5 w-2.5" />{new Date(t.dueDate as string).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{overdue && " — Overdue"}</span>}
                  {t.source === "ai" && <span className="text-[10px] text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 rounded px-1">AI</span>}
                </div>
              </div>
              <button onClick={() => deleteMutation.mutate(t.id as number)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        {!isLoading && tasks.length === 0 && <p className="text-xs text-gray-400 text-center py-6">No {filter} tasks</p>}
      </div>
    </div>
  );
}
