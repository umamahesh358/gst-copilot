import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, CheckCircle2, XCircle, Clock, Upload, Plus, Eye, Loader2, AlertTriangle } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const SAMPLE_ROWS = [
  { date: "2026-04-01", description: "NEFT INR Techsolutions Pvt Ltd", reference: "NEFT2604001", credit: 85000 },
  { date: "2026-04-03", description: "UPI Payment Rahul Sharma", reference: "UPI2604003", credit: 12500 },
  { date: "2026-04-05", description: "IMPS Transfer GlobalCorp", reference: "IMPS2604005", credit: 240000 },
  { date: "2026-04-07", description: "Vendor Payment Infra Supplies", reference: "CHQ2604007", debit: 35000 },
  { date: "2026-04-10", description: "GST Refund Govt", reference: "GST2604010", credit: 18000 },
];

export default function Reconciliation() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [bankName, setBankName] = useState("");

  const { data: jobsData, isLoading } = useQuery({ queryKey: ["recon-jobs"], queryFn: () => apiFetch("/reconciliation/jobs") });
  const { data: summaryData } = useQuery({ queryKey: ["recon-summary"], queryFn: () => apiFetch("/reconciliation/summary") });
  const { data: jobDetail } = useQuery({ queryKey: ["recon-job", selectedJob], queryFn: () => apiFetch(`/reconciliation/jobs/${selectedJob}`), enabled: !!selectedJob });

  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/reconciliation/jobs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["recon-jobs"] });
      qc.invalidateQueries({ queryKey: ["recon-summary"] });
      setSelectedJob(data.job.id);
      setShowNew(false); setNewName(""); setBankName("");
      toast({ title: "Statement processed", description: `${data.autoMatched} entries auto-matched` });
    },
    onError: () => toast({ title: "Failed to process statement", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ matchId, note }: { matchId: number; note?: string }) =>
      apiFetch(`/reconciliation/matches/${matchId}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recon-job", selectedJob] }); toast({ title: "Match approved" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: (matchId: number) => apiFetch(`/reconciliation/matches/${matchId}/reject`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recon-job", selectedJob] }); toast({ title: "Match rejected" }); },
  });

  const jobs = (jobsData?.jobs ?? []) as Record<string, unknown>[];
  const summary = summaryData?.summary as Record<string, unknown> | undefined;
  const detail = jobDetail as { job: Record<string, unknown>; rows: Record<string, unknown>[]; matches: Record<string, unknown>[] } | undefined;

  const getStatusColor = (s: string) => {
    if (s === "completed") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    if (s === "review") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    return "bg-gray-100 text-gray-500 dark:bg-gray-800";
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-indigo-600" /> Reconciliation Engine
            <Badge className="text-[9px] bg-indigo-600 text-white border-0">V5</Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Match bank statements to invoices and transactions</p>
        </div>
        <Button className="h-9 text-sm bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Import Statement
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Jobs", value: summary.total, icon: ArrowLeftRight, color: "text-indigo-600" },
            { label: "In Review", value: summary.inReview, icon: Clock, color: "text-amber-600" },
            { label: "Matched Entries", value: summary.totalMatched, icon: CheckCircle2, color: "text-emerald-600" },
            { label: "Unmatched", value: summary.totalUnmatched, icon: AlertTriangle, color: "text-red-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border border-gray-100 dark:border-gray-800">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={cn("h-5 w-5 flex-shrink-0", color)} />
                <div><p className="text-lg font-bold text-gray-900 dark:text-white">{value as number}</p><p className="text-xs text-gray-500">{label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showNew && (
        <Card className="border border-indigo-200 dark:border-indigo-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Import Bank Statement</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-xs font-medium">Statement Name</label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="April 2026 Statement" className="h-8 text-sm" /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Bank Name</label><Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="HDFC Bank" className="h-8 text-sm" /></div>
            </div>
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center">
              <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-500 mb-2">Using sample statement data for demo</p>
              <p className="text-[10px] text-gray-400">{SAMPLE_ROWS.length} transactions from {bankName || "Bank"}</p>
            </div>
            <div className="flex gap-2">
              <Button className="h-8 text-sm bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!newName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: newName, bankName, rows: SAMPLE_ROWS })}>
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Process & Match
              </Button>
              <Button variant="outline" className="h-8 text-sm" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Jobs list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Reconciliation Jobs</p>
          {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
          {jobs.map(job => (
            <button key={job.id as number} onClick={() => setSelectedJob(job.id as number)}
              className={cn("w-full text-left p-3 rounded-xl border transition-all",
                selectedJob === job.id ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-gray-100 dark:border-gray-800 hover:border-gray-200")}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{job.name as string}</p>
                <span className={cn("text-[9px] font-bold rounded px-1.5 py-0.5", getStatusColor(job.status as string))}>{job.status as string}</span>
              </div>
              <p className="text-[10px] text-gray-400">{job.bankName as string || "Unknown Bank"}</p>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                <span className="text-emerald-600">{job.matchedRows as number} matched</span>
                <span>·</span>
                <span className="text-amber-600">{job.pendingRows as number} pending</span>
              </div>
            </button>
          ))}
          {!isLoading && jobs.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No jobs yet</p>}
        </div>

        {/* Job detail */}
        <div className="col-span-2">
          {!selectedJob && (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Select a job to review matches</div>
          )}
          {selectedJob && detail && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{detail.job.name as string}</p>
                <div className="flex gap-2 text-xs text-gray-500">
                  <span>{detail.rows.length} rows</span>
                  <span>·</span>
                  <span>{detail.matches.length} matches</span>
                </div>
              </div>

              {detail.matches.length === 0 && (
                <Card className="border border-dashed border-gray-200 dark:border-gray-700">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-gray-400 text-xs">
                    <ArrowLeftRight className="h-8 w-8 mb-2 opacity-30" />
                    No auto-matches found. Review unmatched rows below.
                  </CardContent>
                </Card>
              )}

              {detail.matches.map(match => {
                const m = match as Record<string, unknown>;
                const row = detail.rows.find(r => (r as Record<string, unknown>).id === m.bankRowId) as Record<string, unknown> | undefined;
                return (
                  <Card key={m.id as number} className={cn("border", m.status === "approved" ? "border-emerald-200 dark:border-emerald-800" : m.status === "rejected" ? "border-red-200 dark:border-red-800" : "border-amber-200 dark:border-amber-800")}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-[10px] font-bold rounded px-1.5 py-0.5",
                              m.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : m.status === "rejected" ? "bg-red-100 text-red-600"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300")}>{m.status as string}</span>
                            <span className="text-[10px] text-gray-400">{m.matchType as string} · {Math.round((m.confidenceScore as number) * 100)}% confidence</span>
                          </div>
                          {row && <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{row.description as string}</p>}
                          <p className="text-[11px] text-gray-500 mt-0.5">{m.matchedEntityType as string} #{m.matchedEntityId as string}</p>
                          {m.matchReason && <p className="text-[10px] text-indigo-500 mt-0.5">{m.matchReason as string}</p>}
                        </div>
                        {row && (
                          <div className="text-right flex-shrink-0">
                            <p className={cn("text-sm font-bold", (row.credit as number) ? "text-emerald-600" : "text-red-600")}>
                              {(row.credit as number) ? `+₹${(row.credit as number).toLocaleString()}` : `-₹${(row.debit as number)?.toLocaleString()}`}
                            </p>
                          </div>
                        )}
                      </div>
                      {m.status === "pending" && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => approveMutation.mutate({ matchId: m.id as number })}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => rejectMutation.mutate(m.id as number)}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Unmatched Bank Rows</p>
                {detail.rows.filter(r => (r as Record<string, unknown>).status === "unmatched").map(row => {
                  const r = row as Record<string, unknown>;
                  return (
                    <div key={r.id as number} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{r.description as string}</p>
                        <p className="text-[10px] text-gray-400">{r.reference as string}</p>
                      </div>
                      <span className={cn("text-xs font-semibold flex-shrink-0", (r.credit as number) ? "text-emerald-600" : "text-red-500")}>
                        {(r.credit as number) ? `+₹${(r.credit as number).toLocaleString()}` : `-₹${(r.debit as number)?.toLocaleString()}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
