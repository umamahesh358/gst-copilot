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
import { Plus, X, Webhook, CheckCircle2, XCircle, Clock, RefreshCw, Trash2, Copy, AlertCircle, Zap } from "lucide-react";

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

type Endpoint = { id: number; name: string; url: string; events: string[]; isActive: boolean; deliveryCount: number; failureCount: number; lastStatus?: string; lastTriggeredAt?: string; description?: string };
type Delivery = { id: number; webhookEndpointId: number; eventType: string; status: string; responseCode?: number; attemptCount: number; deliveredAt?: string; errorMessage?: string; durationMs?: number; createdAt: string };

const ALL_EVENTS = [
  "invoice.created", "invoice.paid", "invoice.overdue",
  "payment.received", "expense.created",
  "stock.low", "vendor.created",
  "backup.completed", "approval.requested", "approval.approved",
  "document.uploaded", "automation.triggered",
  "*",
];

const STATUS_ICON: Record<string, React.ElementType> = { delivered: CheckCircle2, failed: XCircle, pending: Clock };
const STATUS_COLOR: Record<string, string> = { delivered: "text-emerald-600", failed: "text-red-500", pending: "text-amber-500" };

export default function Webhooks() {
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"endpoints" | "deliveries">("endpoints");
  const [form, setForm] = useState({ name: "", url: "", description: "", events: [] as string[] });
  const [selectedEndpoint, setSelectedEndpoint] = useState<number | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: endpointsData, isLoading } = useQuery({ queryKey: ["webhook-endpoints"], queryFn: () => apiFetch("/webhooks/endpoints") });
  const { data: deliveriesData } = useQuery({
    queryKey: ["webhook-deliveries", selectedEndpoint],
    queryFn: () => apiFetch(`/webhooks/deliveries${selectedEndpoint ? `?endpoint_id=${selectedEndpoint}` : ""}`)
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/webhooks/endpoints", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });
      setShowForm(false); setForm({ name: "", url: "", description: "", events: [] });
      toast({ title: "Webhook created" });
      if (d.endpoint?.secret) { navigator.clipboard?.writeText(d.endpoint.secret); toast({ title: "Secret copied to clipboard — save it now" }); }
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const testMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/webhooks/endpoints/${id}/test`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhook-deliveries", selectedEndpoint] }); toast({ title: "Test ping sent" }); },
  });
  const retryMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/webhooks/deliveries/${id}/retry`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhook-deliveries", selectedEndpoint] }); toast({ title: "Retried delivery" }); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/webhooks/endpoints/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhook-endpoints"] }); toast({ title: "Endpoint removed" }); },
  });

  const endpoints: Endpoint[] = endpointsData?.endpoints ?? [];
  const deliveries: Delivery[] = deliveriesData?.deliveries ?? [];

  const toggleEvent = (e: string) => setForm(p => ({ ...p, events: p.events.includes(e) ? p.events.filter(x => x !== e) : [...p.events, e] }));

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Webhooks & Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">Receive real-time event notifications in external systems</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-sm gap-1.5">
          <Plus className="h-4 w-4" /> New Endpoint
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {(["endpoints", "deliveries"] as const).map(t => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"}
            className={cn("text-xs h-7 capitalize", tab === t ? "bg-indigo-600 text-white" : "")}
            onClick={() => setTab(t)}>{t === "endpoints" ? `Endpoints (${endpoints.length})` : "Delivery Log"}</Button>
        ))}
        {tab === "deliveries" && (
          <select value={selectedEndpoint ?? ""} onChange={e => setSelectedEndpoint(e.target.value ? parseInt(e.target.value) : null)}
            className="ml-auto h-7 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2">
            <option value="">All endpoints</option>
            {endpoints.map(ep => <option key={ep.id} value={ep.id}>{ep.name}</option>)}
          </select>
        )}
      </div>

      {/* Endpoints */}
      {tab === "endpoints" && (
        isLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        : endpoints.length === 0 ? (
          <Card className="border border-gray-100 dark:border-gray-800">
            <CardContent className="py-16 text-center">
              <Webhook className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-4">No webhook endpoints yet. Create one to receive event notifications.</p>
              <Button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white h-8 text-xs gap-1"><Plus className="h-3 w-3" /> Add Endpoint</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {endpoints.map(ep => (
              <Card key={ep.id} className="border border-gray-100 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center flex-shrink-0">
                        <Webhook className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{ep.name}</p>
                          <Badge variant="outline" className={cn("text-[10px]", ep.isActive ? "text-emerald-600 border-emerald-300" : "text-gray-400")}>{ep.isActive ? "Active" : "Disabled"}</Badge>
                          {ep.lastStatus && <Badge variant="outline" className={cn("text-[10px]", STATUS_COLOR[ep.lastStatus] ?? "")}>{ep.lastStatus}</Badge>}
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{ep.url}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {((ep.events as string[]) ?? []).slice(0, 3).map(ev => (
                            <span key={ev} className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 rounded px-1.5 py-0.5">{ev}</span>
                          ))}
                          {(ep.events?.length ?? 0) > 3 && <span className="text-[10px] text-gray-400">+{ep.events.length - 3} more</span>}
                          <span className="text-[10px] text-gray-400 ml-auto">{ep.deliveryCount} deliveries · {ep.failureCount} failures</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2 gap-1" onClick={() => { setSelectedEndpoint(ep.id); setTab("deliveries"); }}>
                        <Clock className="h-3 w-3" /> Logs
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => testMutation.mutate(ep.id)}><Zap className="h-3.5 w-3.5 text-indigo-500" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { if (confirm(`Delete "${ep.name}"?`)) deleteMutation.mutate(ep.id); }}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Delivery log */}
      {tab === "deliveries" && (
        <div className="space-y-2">
          {deliveries.length === 0 ? (
            <Card className="border border-gray-100 dark:border-gray-800">
              <CardContent className="py-16 text-center">
                <Clock className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No deliveries yet.</p>
              </CardContent>
            </Card>
          ) : deliveries.map(d => {
            const Icon = STATUS_ICON[d.status] ?? AlertCircle;
            return (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 border border-gray-100 dark:border-gray-800 transition-colors">
                <Icon className={cn("h-4 w-4 flex-shrink-0", STATUS_COLOR[d.status] ?? "text-gray-400")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{d.eventType}</span>
                    {d.responseCode && <span className={cn("text-[10px] font-mono font-bold", d.responseCode < 300 ? "text-emerald-600" : "text-red-500")}>{d.responseCode}</span>}
                    {d.durationMs && <span className="text-[10px] text-gray-400">{d.durationMs}ms</span>}
                    <span className="text-[10px] text-gray-400 ml-auto">{new Date(d.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                  {d.errorMessage && <p className="text-[10px] text-red-400 mt-0.5">{d.errorMessage}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">Attempt {d.attemptCount}</p>
                </div>
                {d.status === "failed" && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => retryMutation.mutate(d.id)}>
                    <RefreshCw className="h-3 w-3" /> Retry
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end" onClick={() => setShowForm(false)}>
          <div className="w-[420px] h-full bg-white dark:bg-gray-950 shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">New Webhook Endpoint</h2>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 p-5 space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">A signing secret will be generated. Copy it immediately after creation — it will not be shown again.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="My Webhook" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Endpoint URL</Label>
                <Input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://yourapp.com/webhooks/bizos" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description (optional)</Label>
                <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What this endpoint is for" className="h-8 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Subscribe to Events</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_EVENTS.map(ev => (
                    <button key={ev} onClick={() => toggleEvent(ev)}
                      className={cn("text-left text-xs px-2 py-1.5 rounded-md border transition-all", form.events.includes(ev) ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400")}>
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.url || createMutation.isPending}>
                Create Endpoint
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
