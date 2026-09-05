import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import {
  ArrowLeftRight, CheckCircle2, XCircle, Clock, Upload, Plus, Loader2,
  AlertTriangle, FileText, ShieldCheck, ShieldAlert, ShieldX, TrendingDown,
} from "lucide-react";

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

/** Sample GSTR-2A data for demo (simulates government JSON download) */
const SAMPLE_GSTR2A = [
  { supplierGstin: "27AADCB2230M1ZT", supplierName: "TechSupply India Pvt Ltd", invoiceNumber: "INV-2026-001", gstAmount: 4500, taxableValue: 25000 },
  { supplierGstin: "29AADCR1234F1ZK", supplierName: "RawMaterials Corp", invoiceNumber: "RM-042026-12", gstAmount: 12600, taxableValue: 70000 },
  { supplierGstin: "07AAECG5678H1Z5", supplierName: "GlobalParts Trading", invoiceNumber: "GP-2026-089", gstAmount: 8100, taxableValue: 45000 },
  { supplierGstin: "33AABCL9012K1ZP", supplierName: "Logistics Hub Services", invoiceNumber: "LH-INV-456", gstAmount: 2700, taxableValue: 15000 },
  { supplierGstin: "27AADCB2230M1ZT", supplierName: "TechSupply India Pvt Ltd", invoiceNumber: "INV-2026-003", gstAmount: 9000, taxableValue: 50000 },
];

const TABS = [
  { key: "gstr2a", label: "GSTR-2A Reconciliation", icon: ShieldCheck },
  { key: "bank", label: "Bank Statement", icon: FileText },
] as const;

export default function Reconciliation() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"gstr2a" | "bank">("gstr2a");
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showGstr2a, setShowGstr2a] = useState(false);
  const [newName, setNewName] = useState("");
  const [bankName, setBankName] = useState("");
  const [gstr2aName, setGstr2aName] = useState("");
  const [gstr2aJsonText, setGstr2aJsonText] = useState("");

  const { data: jobsData, isLoading } = useQuery({ queryKey: ["recon-jobs"], queryFn: () => apiFetch("/reconciliation/jobs") });
  const { data: summaryData } = useQuery({ queryKey: ["recon-summary"], queryFn: () => apiFetch("/reconciliation/summary") });
  const { data: itcData } = useQuery({ queryKey: ["recon-itc-summary"], queryFn: () => apiFetch("/reconciliation/itc-summary") });
  const { data: jobDetail } = useQuery({ queryKey: ["recon-job", selectedJob], queryFn: () => apiFetch(`/reconciliation/jobs/${selectedJob}`), enabled: !!selectedJob });

  // Bank statement mutation
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

  // GSTR-2A mutation
  const gstr2aMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/reconciliation/gstr2a", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["recon-jobs"] });
      qc.invalidateQueries({ queryKey: ["recon-summary"] });
      qc.invalidateQueries({ queryKey: ["recon-itc-summary"] });
      setSelectedJob(data.job.id);
      setShowGstr2a(false); setGstr2aName(""); setGstr2aJsonText("");
      const r = data.reconciliation;
      toast({ title: "GSTR-2A Reconciled", description: `${r.matchedCount} matched, ${r.mismatchCount} mismatched, ${r.unmatchedCount} unmatched` });
    },
    onError: (err: Error) => toast({ title: "GSTR-2A processing failed", description: err.message, variant: "destructive" }),
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
  const itcSummary = itcData as Record<string, unknown> | undefined;
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
          <p className="text-sm text-gray-500 mt-0.5">Match GSTR-2A data & bank statements to your records</p>
        </div>
        <div className="flex gap-2">
          <Button className="h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowGstr2a(true)}>
            <ShieldCheck className="h-4 w-4 mr-1.5" /> Upload GSTR-2A
          </Button>
          <Button variant="outline" className="h-9 text-sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Bank Statement
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
                activeTab === t.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300")}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ GSTR-2A TAB ═══ */}
      {activeTab === "gstr2a" && (
        <>
          {/* ITC Summary Cards */}
          {itcSummary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Your Total ITC", value: formatCurrency(itcSummary.yourTotalITC as number || 0), icon: FileText, color: "text-gray-700 dark:text-gray-300", bg: "" },
                { label: "Eligible ITC", value: formatCurrency(itcSummary.eligibleITC as number || 0), icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" },
                { label: "Disputed ITC", value: formatCurrency(itcSummary.disputedITC as number || 0), icon: ShieldAlert, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" },
                { label: "Blocked ITC", value: formatCurrency(itcSummary.blockedITC as number || 0), icon: ShieldX, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" },
                { label: "ITC Gap", value: formatCurrency(itcSummary.itcGap as number || 0), icon: TrendingDown, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} className={cn("border", bg || "border-gray-100 dark:border-gray-800")}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={cn("h-4 w-4 flex-shrink-0", color)} />
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                    </div>
                    <p className={cn("text-lg font-bold", color)}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Source badge */}
          {itcSummary && (
            <div className="flex items-center gap-2">
              <Badge className={cn("text-[9px] border-0",
                itcSummary.source === "gstr2a_reconciliation"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-800")}>
                {itcSummary.source === "gstr2a_reconciliation" ? "✓ Reconciled" : "⚠ Estimated"}
              </Badge>
              <p className="text-[11px] text-gray-400">
                {itcSummary.source === "gstr2a_reconciliation"
                  ? `Based on GSTR-2A reconciliation job: ${itcSummary.jobName}`
                  : "Upload GSTR-2A data from the GST portal for verified ITC figures"}
              </p>
            </div>
          )}

          {/* GSTR-2A Jobs List */}
          <Card className="border border-gray-100 dark:border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">GSTR-2A Reconciliation History</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
              {jobs.filter(j => {
                const meta = j.metadata as Record<string, unknown> | null;
                return meta?.type === "gstr2a";
              }).length === 0 && !isLoading && (
                <div className="text-center py-8 text-sm text-gray-400">
                  <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No GSTR-2A reconciliation yet. Click "Upload GSTR-2A" to get started.
                </div>
              )}
              <div className="space-y-2">
                {jobs.filter(j => {
                  const meta = j.metadata as Record<string, unknown> | null;
                  return meta?.type === "gstr2a";
                }).map(job => (
                  <button key={job.id as number} onClick={() => setSelectedJob(job.id as number)}
                    className={cn("w-full text-left p-3 rounded-xl border transition-all",
                      selectedJob === job.id ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-gray-100 dark:border-gray-800 hover:border-gray-200")}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{job.name as string}</p>
                      <span className={cn("text-[9px] font-bold rounded px-1.5 py-0.5", getStatusColor(job.status as string))}>{job.status as string}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span className="text-emerald-600">{job.matchedRows as number} matched</span>
                      <span>·</span>
                      <span className="text-amber-600">{job.pendingRows as number} mismatched</span>
                      <span>·</span>
                      <span className="text-red-500">{job.unmatchedRows as number} unmatched</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* GSTR-2A Job Detail — Match Results Table */}
          {selectedJob && detail && (() => {
            const meta = detail.job.metadata as Record<string, unknown> | null;
            const matchResults = (meta?.matchResults || []) as Record<string, unknown>[];
            if (meta?.type !== "gstr2a" || matchResults.length === 0) return null;
            return (
              <Card className="border border-gray-100 dark:border-gray-800">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Match Results — {detail.job.name as string}</CardTitle>
                  <div className="flex gap-2 text-[10px] text-gray-400">
                    <span className="text-emerald-600">{matchResults.filter(m => m.status === "matched").length} matched</span>
                    <span className="text-amber-600">{matchResults.filter(m => m.status === "mismatch").length} mismatched</span>
                    <span className="text-red-500">{matchResults.filter(m => m.status === "unmatched").length} unmatched</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                        {["Status", "Supplier GSTIN", "Invoice #", "GSTR-2A GST", "Your GST", "Difference", "ITC Claimable", "Confidence", "Reason"].map(h => (
                          <TableHead key={h} className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 py-2.5">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchResults.map((m, i) => (
                        <TableRow key={i} className={cn(
                          "border-b border-gray-50 dark:border-gray-800/50 last:border-0",
                          m.status === "matched" ? "" : m.status === "mismatch" ? "bg-amber-50/30 dark:bg-amber-950/10" : "bg-red-50/30 dark:bg-red-950/10"
                        )}>
                          <TableCell className="py-2">
                            <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                              m.status === "matched" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : m.status === "mismatch" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            )}>
                              {m.status === "matched" ? "✓" : m.status === "mismatch" ? "≠" : "✗"} {m.status as string}
                            </span>
                          </TableCell>
                          <TableCell className="text-[11px] font-mono text-indigo-600">{m.supplierGstin as string}</TableCell>
                          <TableCell className="text-xs text-gray-600 dark:text-gray-400">{m.invoiceNumber as string || "–"}</TableCell>
                          <TableCell className="text-xs text-gray-700 dark:text-gray-300">{formatCurrency(m.gstr2aGst as number || 0)}</TableCell>
                          <TableCell className="text-xs text-gray-700 dark:text-gray-300">{m.yourGst != null ? formatCurrency(m.yourGst as number) : "–"}</TableCell>
                          <TableCell className={cn("text-xs font-medium", (m.amountDifference as number) > 0 ? "text-red-500" : (m.amountDifference as number) < 0 ? "text-amber-600" : "text-gray-400")}>
                            {m.amountDifference != null && m.amountDifference !== 0 ? `₹${(m.amountDifference as number).toFixed(2)}` : "–"}
                          </TableCell>
                          <TableCell className={cn("text-xs font-semibold", (m.itcClaimable as number) > 0 ? "text-emerald-600" : "text-red-400")}>
                            {formatCurrency(m.itcClaimable as number || 0)}
                          </TableCell>
                          <TableCell className="text-[10px] text-gray-400">{Math.round((m.confidence as number || 0) * 100)}%</TableCell>
                          <TableCell className="text-[10px] text-gray-500 max-w-[200px] truncate">{m.reason as string}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })()}
        </>
      )}

      {/* ═══ BANK STATEMENT TAB ═══ */}
      {activeTab === "bank" && (
        <>
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

          <div className="grid grid-cols-3 gap-4">
            {/* Jobs list */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Bank Reconciliation Jobs</p>
              {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
              {jobs.filter(j => {
                const meta = j.metadata as Record<string, unknown> | null;
                return !meta || meta.type !== "gstr2a";
              }).map(job => (
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
              {!isLoading && jobs.filter(j => { const m = j.metadata as Record<string, unknown> | null; return !m || m.type !== "gstr2a"; }).length === 0 && <p className="text-xs text-gray-400 text-center py-4">No jobs yet</p>}
            </div>

            {/* Job detail */}
            <div className="col-span-2">
              {!selectedJob && (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Select a job to review matches</div>
              )}
              {selectedJob && detail && (() => {
                const meta = detail.job.metadata as Record<string, unknown> | null;
                if (meta?.type === "gstr2a") return null; // GSTR-2A detail shown in GSTR-2A tab
                return (
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
                                {Boolean(m.matchReason) && <p className="text-[10px] text-indigo-500 mt-0.5">{m.matchReason as string}</p>}
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
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* ═══ GSTR-2A UPLOAD MODAL ═══ */}
      {showGstr2a && (
        <Card className="border border-emerald-200 dark:border-emerald-800 fixed inset-x-4 top-1/4 max-w-lg mx-auto z-50 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Upload GSTR-2A Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Reconciliation Name</label>
              <Input value={gstr2aName} onChange={e => setGstr2aName(e.target.value)} placeholder="GSTR-2A April 2026" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">GSTR-2A JSON Data</label>
              <textarea
                value={gstr2aJsonText}
                onChange={e => setGstr2aJsonText(e.target.value)}
                placeholder='Paste JSON from GST portal, or use sample data below...'
                className="w-full h-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex gap-2">
              <Button className="h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!gstr2aName.trim() || gstr2aMutation.isPending}
                onClick={() => {
                  let data;
                  try { data = gstr2aJsonText.trim() ? JSON.parse(gstr2aJsonText) : SAMPLE_GSTR2A; }
                  catch { data = SAMPLE_GSTR2A; }
                  gstr2aMutation.mutate({ name: gstr2aName, gstr2aData: data });
                }}>
                {gstr2aMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Reconcile
              </Button>
              <Button variant="outline" className="h-8 text-xs"
                onClick={() => setGstr2aJsonText(JSON.stringify(SAMPLE_GSTR2A, null, 2))}>
                Load Sample
              </Button>
              <Button variant="outline" className="h-8 text-sm" onClick={() => setShowGstr2a(false)}>Cancel</Button>
            </div>
            <p className="text-[10px] text-gray-400">
              Download GSTR-2A from <strong>gst.gov.in → Returns → GSTR-2A → Download JSON</strong>. Paste the JSON above.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ═══ BANK STATEMENT UPLOAD MODAL ═══ */}
      {showNew && (
        <Card className="border border-indigo-200 dark:border-indigo-800 fixed inset-x-4 top-1/4 max-w-lg mx-auto z-50 shadow-2xl">
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

      {/* Backdrop for modals */}
      {(showGstr2a || showNew) && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => { setShowGstr2a(false); setShowNew(false); }} />
      )}
    </div>
  );
}
