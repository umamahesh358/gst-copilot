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
import {
  Plus, X, Mail, MessageSquare, CreditCard, Database, Users,
  Calculator, Slack, Table2, CheckCircle2, AlertCircle, RefreshCw,
  ToggleRight, ToggleLeft, Trash2, Zap, Globe, MessageCircle,
} from "lucide-react";

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

type Provider = { id: string; type: string; name: string; description: string; icon: string };
type Connection = {
  id: number; provider: string; providerType: string; displayName: string;
  status: string; isActive: boolean; healthStatus: string; lastTestedAt?: string;
  lastSyncAt?: string; lastError?: string; syncCount: number; errorCount: number;
};

const ICON_MAP: Record<string, React.ElementType> = {
  mail: Mail, "message-square": MessageSquare, "message-circle": MessageCircle,
  "credit-card": CreditCard, database: Database, users: Users,
  calculator: Calculator, slack: Slack, table: Table2, default: Globe,
};

const TYPE_COLORS: Record<string, string> = {
  email: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  sms: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  messaging: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  payment: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  storage: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  crm: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  accounting: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  export: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

export default function Integrations() {
  const [selected, setSelected] = useState<Provider | null>(null);
  const [formCreds, setFormCreds] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: providersData } = useQuery({ queryKey: ["integration-providers"], queryFn: () => apiFetch("/integrations/providers") });
  const { data: connectionsData, isLoading } = useQuery({ queryKey: ["integrations"], queryFn: () => apiFetch("/integrations") });

  const connectMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/integrations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["integrations"] }); setShowForm(false); setSelected(null); setFormCreds({}); toast({ title: "Integration connected" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const testMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/integrations/${id}/test`, { method: "POST" }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["integrations"] }); toast({ title: d.success ? "Connection healthy" : "Connection failed", variant: d.success ? "default" : "destructive" }); },
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => apiFetch(`/integrations/${id}/${active ? "disable" : "enable"}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/integrations/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["integrations"] }); toast({ title: "Integration removed" }); },
  });

  const providers: Provider[] = providersData?.providers ?? [];
  const connections: Connection[] = connectionsData?.connections ?? [];
  const connectedIds = new Set(connections.map(c => c.provider));

  const types = ["all", ...Array.from(new Set(providers.map(p => p.type)))];
  const filtered = typeFilter === "all" ? providers : providers.filter(p => p.type === typeFilter);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Integration Hub</h1>
        <p className="text-sm text-gray-500 mt-0.5">Connect BizOS to external services, tools, and channels</p>
      </div>

      {/* Active Connections */}
      {connections.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Active Connections ({connections.length})</p>
          <div className="grid grid-cols-2 gap-3">
            {connections.map(c => {
              const ProvIcon = ICON_MAP[providers.find(p => p.id === c.provider)?.icon ?? "default"] ?? Globe;
              return (
                <Card key={c.id} className={cn("border", c.isActive ? "border-gray-100 dark:border-gray-800" : "border-gray-100 dark:border-gray-800 opacity-60")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", c.isActive ? "bg-indigo-100 dark:bg-indigo-950" : "bg-gray-100 dark:bg-gray-800")}>
                          <ProvIcon className={cn("h-4 w-4", c.isActive ? "text-indigo-600" : "text-gray-400")} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">{c.displayName}</p>
                            <div className="flex items-center gap-1">
                              {c.healthStatus === "healthy" && c.isActive
                                ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                : c.healthStatus === "error"
                                ? <AlertCircle className="h-3 w-3 text-red-400" />
                                : <div className="h-2 w-2 rounded-full bg-gray-300" />}
                              <span className={cn("text-[10px] font-medium",
                                c.healthStatus === "healthy" && c.isActive ? "text-emerald-600" : c.healthStatus === "error" ? "text-red-500" : "text-gray-400")}>
                                {c.isActive ? c.healthStatus : "disabled"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className={cn("text-[10px] capitalize", TYPE_COLORS[c.providerType] ?? "")}>{c.providerType}</Badge>
                            {c.syncCount > 0 && <span className="text-[10px] text-gray-400">{c.syncCount} syncs</span>}
                          </div>
                          {c.lastError && <p className="text-[10px] text-red-400 mt-1 truncate max-w-[200px]">{c.lastError}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => testMutation.mutate(c.id)} disabled={testMutation.isPending}>
                          <RefreshCw className={cn("h-3.5 w-3.5", testMutation.isPending ? "animate-spin" : "")} />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleMutation.mutate({ id: c.id, active: c.isActive })}>
                          {c.isActive ? <ToggleRight className="h-4 w-4 text-indigo-600" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { if (confirm(`Remove ${c.displayName}?`)) deleteMutation.mutate(c.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Provider Catalog */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Available Integrations</p>
          <div className="flex gap-1.5 flex-wrap">
            {types.map(t => (
              <Button key={t} size="sm" variant={typeFilter === t ? "default" : "outline"}
                className={cn("text-xs h-6 capitalize px-2", typeFilter === t ? "bg-indigo-600 text-white" : "")}
                onClick={() => setTypeFilter(t)}>{t}</Button>
            ))}
          </div>
        </div>
        {isLoading
          ? <div className="grid grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          : (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map(p => {
                const Icon = ICON_MAP[p.icon] ?? Globe;
                const connected = connectedIds.has(p.id);
                return (
                  <button key={p.id} disabled={connected}
                    onClick={() => { setSelected(p); setFormCreds({}); setShowForm(true); }}
                    className={cn("text-left p-4 rounded-xl border transition-all",
                      connected ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 cursor-default"
                        : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 cursor-pointer")}>
                    <div className="flex items-start justify-between mb-2">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", connected ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-gray-100 dark:bg-gray-800")}>
                        <Icon className={cn("h-4 w-4", connected ? "text-emerald-600" : "text-gray-500")} />
                      </div>
                      {connected
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : <Plus className="h-4 w-4 text-gray-400 group-hover:text-indigo-600" />}
                    </div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-snug">{p.description}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge variant="outline" className={cn("text-[10px] capitalize", TYPE_COLORS[p.type] ?? "")}>{p.type}</Badge>
                      {connected && <span className="text-[10px] text-emerald-600 font-medium">Connected</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
      </div>

      {/* Connection Form */}
      {showForm && selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end" onClick={() => setShowForm(false)}>
          <div className="w-[420px] h-full bg-white dark:bg-gray-950 shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Connect {selected.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selected.description}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 p-5 space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <Zap className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">Credentials are stored securely and never exposed to the frontend after saving.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Display Name</Label>
                <Input value={formCreds.displayName ?? ""} onChange={e => setFormCreds(p => ({ ...p, displayName: e.target.value }))} placeholder={selected.name} className="h-8 text-sm" />
              </div>
              {selected.type === "email" && (
                <>
                  <div className="space-y-1.5"><Label className="text-xs">API Key / SMTP Password</Label><Input type="password" value={formCreds.apiKey ?? ""} onChange={e => setFormCreds(p => ({ ...p, apiKey: e.target.value }))} placeholder="Enter API key or password" className="h-8 text-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">From Email</Label><Input value={formCreds.fromEmail ?? ""} onChange={e => setFormCreds(p => ({ ...p, fromEmail: e.target.value }))} placeholder="noreply@yourdomain.com" className="h-8 text-sm" /></div>
                </>
              )}
              {(selected.type === "sms" || selected.type === "messaging") && (
                <>
                  <div className="space-y-1.5"><Label className="text-xs">Account SID / API Key</Label><Input type="password" value={formCreds.accountSid ?? ""} onChange={e => setFormCreds(p => ({ ...p, accountSid: e.target.value }))} placeholder="Enter account SID or API key" className="h-8 text-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Auth Token / Secret</Label><Input type="password" value={formCreds.authToken ?? ""} onChange={e => setFormCreds(p => ({ ...p, authToken: e.target.value }))} placeholder="Enter auth token" className="h-8 text-sm" /></div>
                </>
              )}
              {selected.type === "payment" && (
                <>
                  <div className="space-y-1.5"><Label className="text-xs">API Key</Label><Input type="password" value={formCreds.apiKey ?? ""} onChange={e => setFormCreds(p => ({ ...p, apiKey: e.target.value }))} placeholder="Enter API key" className="h-8 text-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Webhook Secret</Label><Input type="password" value={formCreds.webhookSecret ?? ""} onChange={e => setFormCreds(p => ({ ...p, webhookSecret: e.target.value }))} placeholder="Enter webhook secret" className="h-8 text-sm" /></div>
                </>
              )}
              {(selected.type === "storage" || selected.type === "crm" || selected.type === "accounting" || selected.type === "export") && (
                <>
                  <div className="space-y-1.5"><Label className="text-xs">API Key / Access Key</Label><Input type="password" value={formCreds.apiKey ?? ""} onChange={e => setFormCreds(p => ({ ...p, apiKey: e.target.value }))} placeholder="Enter API or access key" className="h-8 text-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Secret / Token</Label><Input type="password" value={formCreds.secret ?? ""} onChange={e => setFormCreds(p => ({ ...p, secret: e.target.value }))} placeholder="Enter secret or token" className="h-8 text-sm" /></div>
                </>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => connectMutation.mutate({ provider: selected.id, providerType: selected.type, displayName: formCreds.displayName || selected.name, credentials: formCreds })}
                disabled={connectMutation.isPending}>
                Connect
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
