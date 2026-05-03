import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Upload, Download, FileText, CheckCircle2, XCircle, Clock, AlertCircle, ChevronRight, Table2 } from "lucide-react";

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

type ImportJob = { id: number; module: string; filename: string; status: string; totalRows: number; importedRows: number; failedRows: number; createdAt: string; completedAt?: string };
type ExportJob = { id: number; module: string; format: string; status: string; rowCount: number; createdAt: string; completedAt?: string };
type ModuleInfo = { id: string; fields: string[] };

const MODULES = ["customers", "products", "vendors", "invoices", "expenses", "transactions"];

const STATUS_BADGE: Record<string, { color: string; icon: React.ElementType }> = {
  completed: { color: "text-emerald-600 border-emerald-300 dark:border-emerald-700", icon: CheckCircle2 },
  failed: { color: "text-red-500 border-red-300 dark:border-red-700", icon: XCircle },
  pending: { color: "text-amber-500 border-amber-300 dark:border-amber-700", icon: Clock },
  preview: { color: "text-blue-500 border-blue-300 dark:border-blue-700", icon: AlertCircle },
  mapped: { color: "text-indigo-500 border-indigo-300 dark:border-indigo-700", icon: AlertCircle },
};

export default function ImportExport() {
  const [tab, setTab] = useState<"import" | "export">("import");
  const [step, setStep] = useState<"select" | "preview" | "map" | "confirm">("select");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("csv");
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<object[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [fields, setFields] = useState<string[]>([]);
  const [exportFilters, setExportFilters] = useState({ from: "", to: "" });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: importsData, isLoading: importsLoading } = useQuery({ queryKey: ["import-jobs"], queryFn: () => apiFetch("/import-export/imports") });
  const { data: exportsData, isLoading: exportsLoading } = useQuery({ queryKey: ["export-jobs"], queryFn: () => apiFetch("/import-export/exports") });
  const { data: modulesData } = useQuery({ queryKey: ["import-modules"], queryFn: () => apiFetch("/import-export/modules") });

  const uploadMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/import-export/import/upload", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (d) => {
      setCurrentJob(d.job);
      setPreview(d.preview ?? []);
      setTotalRows(d.totalRows ?? 0);
      setFields(d.fields ?? []);
      setStep("preview");
    },
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });
  const mapMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => apiFetch(`/import-export/import/${id}/map`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => setStep("confirm"),
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const confirmMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/import-export/import/${id}/confirm`, { method: "POST" }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["import-jobs"] });
      toast({ title: `Import completed — ${d.job.importedRows} rows imported` });
      setStep("select"); setCurrentJob(null); setSelectedModule(""); setMapping({});
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const exportMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/import-export/export", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["export-jobs"] });
      toast({ title: `Export ready — ${d.rowCount} rows` });
    },
    onError: () => toast({ title: "Export failed", variant: "destructive" }),
  });

  const importJobs: ImportJob[] = importsData?.jobs ?? [];
  const exportJobs: ExportJob[] = exportsData?.jobs ?? [];
  const moduleInfo: ModuleInfo[] = modulesData?.modules ?? [];

  const previewKeys = preview.length > 0 ? Object.keys(preview[0]) : [];

  function simulateUpload() {
    if (!selectedModule) { toast({ title: "Select a module first" }); return; }
    const sampleData = Array.from({ length: 12 }, (_, i) => ({
      name: `Sample Record ${i + 1}`,
      email: `record${i + 1}@example.com`,
      phone: `9${String(Math.floor(Math.random() * 900000000) + 100000000)}`,
      amount: String(Math.floor(Math.random() * 50000) + 1000),
    }));
    uploadMutation.mutate({ module: selectedModule, filename: `${selectedModule}_import.csv`, format: selectedFormat, rows: sampleData });
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Import / Export</h1>
        <p className="text-sm text-gray-500 mt-0.5">Bulk import data into BizOS or export records to CSV</p>
      </div>

      <div className="flex gap-1.5">
        {(["import", "export"] as const).map(t => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"}
            className={cn("text-xs h-7 capitalize", tab === t ? "bg-indigo-600 text-white" : "")}
            onClick={() => { setTab(t); setStep("select"); }}>
            {t === "import" ? <><Upload className="h-3 w-3 mr-1" /> Import</> : <><Download className="h-3 w-3 mr-1" /> Export</>}
          </Button>
        ))}
      </div>

      {/* IMPORT */}
      {tab === "import" && (
        <div className="space-y-5">
          {/* Stepper */}
          <div className="flex items-center gap-2">
            {(["select", "preview", "map", "confirm"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold",
                  step === s ? "bg-indigo-600 text-white" : (["preview", "map", "confirm"].indexOf(step) > i) ? "bg-emerald-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400")}>
                  {["preview", "map", "confirm"].indexOf(step) > i ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={cn("text-xs capitalize", step === s ? "text-indigo-600 font-semibold" : "text-gray-400")}>{s}</span>
                {i < 3 && <ChevronRight className="h-3 w-3 text-gray-300" />}
              </div>
            ))}
          </div>

          {/* Step: Select */}
          {step === "select" && (
            <Card className="border border-gray-100 dark:border-gray-800">
              <CardContent className="p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Select Module to Import</p>
                  <div className="grid grid-cols-3 gap-2">
                    {MODULES.map(m => (
                      <button key={m} onClick={() => setSelectedModule(m)}
                        className={cn("p-3 rounded-xl border text-sm capitalize transition-all text-left",
                          selectedModule === m ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-semibold" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300")}>
                        <Table2 className="h-4 w-4 mb-1.5" />{m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Format</p>
                  <div className="flex gap-2">
                    {["csv", "xlsx"].map(f => (
                      <button key={f} onClick={() => setSelectedFormat(f)}
                        className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium uppercase transition-all",
                          selectedFormat === f ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700" : "border-gray-200 dark:border-gray-700 text-gray-400")}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedModule && (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Expected columns for {selectedModule}:</p>
                    <p className="text-xs text-gray-500 font-mono">{(moduleInfo.find(m => m.id === selectedModule)?.fields ?? []).join(", ")}</p>
                  </div>
                )}
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-9" onClick={simulateUpload} disabled={!selectedModule || uploadMutation.isPending}>
                  <Upload className="h-4 w-4 mr-2" /> {uploadMutation.isPending ? "Uploading…" : "Upload & Preview"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <Card className="border border-gray-100 dark:border-gray-800">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Preview — {totalRows} rows detected</CardTitle></CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>{previewKeys.map(k => <th key={k} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                          {previewKeys.map(k => <td key={k} className="px-3 py-2 text-gray-700 dark:text-gray-300">{String((row as Record<string, unknown>)[k] ?? "")}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400">Showing first 5 of {totalRows} rows. All {totalRows} rows will be imported.</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-9" onClick={() => setStep("select")}>Back</Button>
                  <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setStep("map")}>Map Fields</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step: Map */}
          {step === "map" && (
            <Card className="border border-gray-100 dark:border-gray-800">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Map Fields</CardTitle></CardHeader>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs text-gray-500">Map your file's columns to BizOS fields. Unmapped fields will be skipped.</p>
                <div className="space-y-2">
                  {fields.map(f => (
                    <div key={f} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-32 capitalize">{f}</span>
                      <span className="text-gray-300 dark:text-gray-600 text-xs">←</span>
                      <select value={mapping[f] ?? ""} onChange={e => setMapping(p => ({ ...p, [f]: e.target.value }))}
                        className="flex-1 h-7 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2">
                        <option value="">— skip —</option>
                        {previewKeys.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" className="flex-1 h-9" onClick={() => setStep("preview")}>Back</Button>
                  <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => currentJob && mapMutation.mutate({ id: currentJob.id, body: { mapping, mergeStrategy: "skip" } })}
                    disabled={mapMutation.isPending}>
                    Confirm Mapping
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step: Confirm */}
          {step === "confirm" && currentJob && (
            <Card className="border border-gray-100 dark:border-gray-800">
              <CardContent className="p-5 space-y-4">
                <div className="text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                  <p className="font-semibold text-gray-900 dark:text-white">Ready to Import</p>
                  <p className="text-sm text-gray-500 mt-1">{totalRows} rows of <span className="capitalize font-medium">{currentJob.module}</span> data will be imported.</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300">Duplicate records will be skipped based on your merge strategy. This action cannot be undone.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-9" onClick={() => setStep("map")}>Back</Button>
                  <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => confirmMutation.mutate(currentJob.id)} disabled={confirmMutation.isPending}>
                    {confirmMutation.isPending ? "Importing…" : "Start Import"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import History */}
          {importJobs.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Import History</p>
              <div className="space-y-2">
                {importJobs.map(job => {
                  const s = STATUS_BADGE[job.status] ?? STATUS_BADGE.pending;
                  const Icon = s.icon;
                  return (
                    <div key={job.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 dark:border-gray-800">
                      <Icon className={cn("h-4 w-4 flex-shrink-0", s.color.split(" ")[0])} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{job.module}</span>
                          <Badge variant="outline" className={cn("text-[10px] capitalize", s.color)}>{job.status}</Badge>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{job.filename} · {job.totalRows} rows · {new Date(job.createdAt).toLocaleDateString("en-IN")}</p>
                      </div>
                      {job.status === "completed" && (
                        <span className="text-xs text-emerald-600 font-medium">{job.importedRows} imported</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXPORT */}
      {tab === "export" && (
        <div className="space-y-5">
          <Card className="border border-gray-100 dark:border-gray-800">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Export Data</p>
              <div className="grid grid-cols-3 gap-2">
                {MODULES.map(m => (
                  <button key={m} onClick={() => setSelectedModule(m)}
                    className={cn("p-3 rounded-xl border text-sm capitalize transition-all text-left",
                      selectedModule === m ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-semibold" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300")}>
                    <FileText className="h-4 w-4 mb-1.5" />{m}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">From Date</p>
                  <input type="date" value={exportFilters.from} onChange={e => setExportFilters(p => ({ ...p, from: e.target.value }))}
                    className="w-full h-8 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">To Date</p>
                  <input type="date" value={exportFilters.to} onChange={e => setExportFilters(p => ({ ...p, to: e.target.value }))}
                    className="w-full h-8 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2" />
                </div>
              </div>
              <div className="flex gap-2">
                {["csv", "xlsx", "json"].map(f => (
                  <button key={f} onClick={() => setSelectedFormat(f)}
                    className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium uppercase transition-all",
                      selectedFormat === f ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700" : "border-gray-200 dark:border-gray-700 text-gray-400")}>
                    {f}
                  </button>
                ))}
              </div>
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-9"
                onClick={() => exportMutation.mutate({ module: selectedModule, format: selectedFormat, filters: exportFilters })}
                disabled={!selectedModule || exportMutation.isPending}>
                <Download className="h-4 w-4 mr-2" /> {exportMutation.isPending ? "Exporting…" : "Export Now"}
              </Button>
            </CardContent>
          </Card>

          {exportJobs.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Export History</p>
              <div className="space-y-2">
                {exportJobs.map(job => (
                  <div key={job.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 dark:border-gray-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{job.module}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{job.format}</Badge>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{job.rowCount} rows · {new Date(job.createdAt).toLocaleDateString("en-IN")}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <Download className="h-3 w-3" /> Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
