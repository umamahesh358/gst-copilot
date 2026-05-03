import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Bot, Play, Square, Trash2, CheckCircle2, Clock, AlertCircle, ChevronRight, Sparkles, Loader2 } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const GOAL_SUGGESTIONS = [
  "Reconcile recent payments with unpaid invoices",
  "Draft follow-up tasks for all overdue customers",
  "Categorize uncategorized expenses from last month",
  "Create a mobile summary for the business owner",
  "Suggest which bank entries can be auto-matched",
  "Draft invoice for top customer this month",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  planned: { label: "Planned", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Clock },
  running: { label: "Running", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: Loader2 },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", icon: Square },
  failed: { label: "Failed", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: AlertCircle },
};

export default function AiAgents() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [goal, setGoal] = useState("");
  const [title, setTitle] = useState("");
  const [selectedRun, setSelectedRun] = useState<number | null>(null);
  const [confirmStep, setConfirmStep] = useState<Record<string, unknown> | null>(null);

  const { data: runsData, isLoading } = useQuery({ queryKey: ["agent-runs"], queryFn: () => apiFetch("/agent-runs") });
  const { data: runDetail, isFetching: detailFetching } = useQuery({
    queryKey: ["agent-run", selectedRun],
    queryFn: () => apiFetch(`/agent-runs/${selectedRun}`),
    enabled: selectedRun !== null,
    refetchInterval: selectedRun ? 3000 : false,
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/agent-runs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["agent-runs"] });
      setSelectedRun(data.run.id);
      setGoal(""); setTitle("");
      toast({ title: "Agent run created", description: "Click Execute to run the next step." });
    },
    onError: () => toast({ title: "Failed to create agent run", variant: "destructive" }),
  });

  const executeMutation = useMutation({
    mutationFn: ({ id, confirmed }: { id: number; confirmed?: boolean }) =>
      apiFetch(`/agent-runs/${id}/execute`, { method: "POST", body: JSON.stringify({ confirmed }) }),
    onSuccess: (data) => {
      if (data.requiresConfirmation) { setConfirmStep(data.step); return; }
      setConfirmStep(null);
      qc.invalidateQueries({ queryKey: ["agent-runs"] });
      qc.invalidateQueries({ queryKey: ["agent-run", selectedRun] });
      if (data.progress?.done) toast({ title: "Agent run completed!" });
    },
    onError: () => toast({ title: "Execution failed", variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/agent-runs/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-runs"] }); qc.invalidateQueries({ queryKey: ["agent-run", selectedRun] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/agent-runs/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-runs"] }); setSelectedRun(null); },
  });

  const runs: Record<string, unknown>[] = runsData?.runs ?? [];
  const detail = runDetail as { run: Record<string, unknown>; steps: Record<string, unknown>[] } | undefined;

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0 -m-6 overflow-hidden">
      {/* Left panel */}
      <div className="w-80 border-r border-gray-100 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-950">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="h-5 w-5 text-indigo-600" />
            <h2 className="font-bold text-gray-900 dark:text-white">AI Agent Workspace</h2>
            <Badge className="ml-auto text-[9px] bg-indigo-600 text-white border-0">V5</Badge>
          </div>
          <Input placeholder="Run title…" value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm mb-2" />
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="Describe what you want the AI agent to do…"
            className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-1 flex-wrap mt-1 mb-2">
            {GOAL_SUGGESTIONS.slice(0, 3).map(s => (
              <button key={s} onClick={() => { setGoal(s); setTitle(s.slice(0, 30)); }}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded px-1.5 py-0.5 hover:bg-indigo-100 transition-colors">{s.slice(0, 28)}…</button>
            ))}
          </div>
          <Button className="w-full h-8 text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={!goal.trim() || !title.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate({ title, goal })}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Create Agent Run
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
          {runs.map((run) => {
            const cfg = STATUS_CONFIG[run.status as string] ?? STATUS_CONFIG.planned;
            const Icon = cfg.icon;
            return (
              <button key={run.id as number} onClick={() => setSelectedRun(run.id as number)}
                className={cn("w-full text-left p-3 rounded-xl border transition-all",
                  selectedRun === run.id ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700")}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate flex-1">{run.title as string}</p>
                  <span className={cn("text-[9px] font-bold rounded px-1.5 py-0.5 ml-2", cfg.color)}>{cfg.label}</span>
                </div>
                <p className="text-[10px] text-gray-400 truncate">{run.goal as string}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1">
                    <div className="bg-indigo-500 h-1 rounded-full transition-all"
                      style={{ width: `${run.totalSteps ? Math.round((run.completedSteps as number / (run.totalSteps as number)) * 100) : 0}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400">{run.completedSteps as number}/{run.totalSteps as number}</span>
                </div>
              </button>
            );
          })}
          {!isLoading && runs.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-xs">No agent runs yet. Create one above.</div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
        {!selectedRun ? (
          <div className="flex flex-1 items-center justify-center flex-col gap-3 text-gray-400">
            <Bot className="h-12 w-12 opacity-30" />
            <p className="text-sm">Select or create an agent run</p>
            <div className="grid grid-cols-2 gap-2 mt-4 max-w-md">
              {GOAL_SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setGoal(s); setTitle(s.slice(0, 35)); }}
                  className="text-left text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 hover:border-indigo-300 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {detailFetching && !detail && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>}
            {detail && (
              <>
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{detail.run.title as string}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{detail.run.goal as string}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(detail.run.status === "planned" || detail.run.status === "running") && (
                      <>
                        <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                          disabled={executeMutation.isPending}
                          onClick={() => executeMutation.mutate({ id: selectedRun })}>
                          {executeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                          Execute Next Step
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs"
                          onClick={() => cancelMutation.mutate(selectedRun)}>
                          <Square className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs"
                      onClick={() => deleteMutation.mutate(selectedRun)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {confirmStep && (
                  <div className="mx-4 mt-4 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Confirmation Required</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">{(confirmStep as Record<string, unknown>).description as string}</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => executeMutation.mutate({ id: selectedRun, confirmed: true })}>
                        Confirm & Execute
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => setConfirmStep(null)}>Dismiss</Button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {detail.steps.map((step, idx) => {
                    const s = step as Record<string, unknown>;
                    const isCompleted = s.status === "completed";
                    const isPending = s.status === "pending";
                    return (
                      <div key={s.id as number} className={cn("flex gap-3 p-3 rounded-xl border",
                        isCompleted ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20"
                          : isPending ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                            : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20")}>
                        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                          isCompleted ? "bg-emerald-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400")}>
                          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{s.description as string}</span>
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 rounded px-1">{s.stepType as string}</span>
                          </div>
                          {isCompleted && s.output && (
                            <p className="text-[11px] text-gray-500 mt-1">{(s.output as Record<string, unknown>).summary as string} · Confidence: {Math.round(((s.output as Record<string, unknown>).confidence as number) * 100)}%</p>
                          )}
                          {s.requiresConfirmation === 1 && isPending && (
                            <p className="text-[11px] text-amber-600 mt-1">⚠ Requires confirmation before execution</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {detail.run.result && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-emerald-50 dark:bg-emerald-950/20">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{detail.run.result as string}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
