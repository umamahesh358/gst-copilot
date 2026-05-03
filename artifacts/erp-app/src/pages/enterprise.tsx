import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Building2, Shield, Activity, Monitor, Users, Database, AlertTriangle, CheckCircle2, Settings2, Loader2, Save } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function Enterprise() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "governance" | "security" | "metrics">("overview");

  const { data: overviewData, isLoading: ovLoading } = useQuery({ queryKey: ["enterprise-overview"], queryFn: () => apiFetch("/enterprise/overview") });
  const { data: settingsData, isLoading: sLoading } = useQuery({ queryKey: ["enterprise-settings"], queryFn: () => apiFetch("/enterprise/settings") });
  const { data: metricsData } = useQuery({ queryKey: ["enterprise-metrics"], queryFn: () => apiFetch("/enterprise/metrics") });
  const { data: securityData } = useQuery({ queryKey: ["enterprise-security"], queryFn: () => apiFetch("/enterprise/security-events") });
  const { data: accessData } = useQuery({ queryKey: ["enterprise-access"], queryFn: () => apiFetch("/enterprise/access-review") });

  const [govForm, setGovForm] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/enterprise/settings", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["enterprise-settings"] }); setDirty(false); toast({ title: "Governance settings saved" }); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const overview = overviewData?.overview as Record<string, unknown> | undefined;
  const settings = settingsData?.settings as Record<string, unknown> | undefined;
  const metrics = metricsData?.metrics as Record<string, unknown> | undefined;
  const securityEvents = (securityData?.events ?? []) as Record<string, unknown>[];
  const devices = (accessData?.devices ?? []) as Record<string, unknown>[];

  const formVal = (k: string) => (govForm[k] !== undefined ? govForm[k] : settings?.[k]) as string | number;
  const setGov = (k: string, v: string | number) => { setGovForm(p => ({ ...p, [k]: v })); setDirty(true); };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" /> Enterprise Admin
            <Badge className="text-[9px] bg-indigo-600 text-white border-0">V5</Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Governance, security, and organization controls</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(["overview", "governance", "security", "metrics"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-2 text-sm font-medium transition-colors capitalize",
            tab === t ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200")}>{t}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          {ovLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}
          {overview && (
            <>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Plan", value: (overview.user as Record<string, unknown>)?.plan as string, icon: Shield, color: "text-indigo-600" },
                  { label: "Total Devices", value: (overview.devices as Record<string, number>)?.total, icon: Monitor, color: "text-blue-600" },
                  { label: "Trusted Devices", value: (overview.devices as Record<string, number>)?.trusted, icon: CheckCircle2, color: "text-emerald-600" },
                  { label: "Recent Events", value: overview.recentActivity, icon: Activity, color: "text-amber-600" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <Card key={label} className="border border-gray-100 dark:border-gray-800">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Icon className={cn("h-5 w-5 flex-shrink-0", color)} />
                      <div>
                        <p className="text-base font-bold text-gray-900 dark:text-white capitalize">{String(value ?? "—")}</p>
                        <p className="text-xs text-gray-500">{label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border border-gray-100 dark:border-gray-800">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Monitor className="h-4 w-4 text-gray-400" /> Device Access Review</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0">
                  {devices.length === 0 ? <p className="text-xs text-gray-400">No devices registered</p> : (
                    <div className="space-y-2">
                      {devices.map(d => (
                        <div key={d.id as number} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{d.deviceName as string || "Unknown Device"}</p>
                            <p className="text-[10px] text-gray-400">Last seen: {d.lastSeen ? new Date(d.lastSeen as string).toLocaleDateString() : "Never"}</p>
                          </div>
                          <Badge className={cn("text-[10px] border-0", d.trusted ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-gray-100 text-gray-500")}>
                            {d.trusted ? "Trusted" : "Unverified"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "governance" && (
        <div className="space-y-4">
          {sLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
          {settings && (
            <>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "dataRetentionDays", label: "Data Retention (days)", type: "number" },
                  { key: "sessionTimeoutMinutes", label: "Session Timeout (minutes)", type: "number" },
                  { key: "maxDevices", label: "Max Devices per User", type: "number" },
                  { key: "apiRateLimitPerMinute", label: "API Rate Limit / Minute", type: "number" },
                  { key: "alertEmail", label: "Security Alert Email", type: "email" },
                ].map(({ key, label, type }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</label>
                    <Input type={type} value={String(formVal(key) ?? "")} onChange={e => setGov(key, type === "number" ? parseInt(e.target.value) : e.target.value)} className="h-8 text-sm" />
                  </div>
                ))}

                {[
                  { key: "auditLevel", label: "Audit Level", options: ["standard", "detailed", "verbose"] },
                  { key: "exportPolicy", label: "Export Policy", options: ["allowed", "restricted", "disabled"] },
                  { key: "complianceMode", label: "Compliance Mode", options: ["standard", "strict", "audit_only"] },
                  { key: "deletionPolicy", label: "Deletion Policy", options: ["soft_delete", "hard_delete", "archive"] },
                ].map(({ key, label, options }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</label>
                    <select value={String(formVal(key) ?? "")} onChange={e => setGov(key, e.target.value)}
                      className="w-full h-8 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {options.map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button className={cn("h-9 text-sm gap-1.5", dirty ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-gray-100 text-gray-400 dark:bg-gray-800 cursor-default")}
                  disabled={!dirty || updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ ...settings, ...govForm })}>
                  <Save className="h-4 w-4" /> {updateMutation.isPending ? "Saving…" : "Save Governance Settings"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "security" && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Failed & Security Events</p>
          {securityEvents.length === 0 ? (
            <Card className="border border-dashed border-gray-200 dark:border-gray-700">
              <CardContent className="flex flex-col items-center py-10 text-gray-400 text-xs">
                <Shield className="h-8 w-8 mb-2 opacity-30" />No security events recorded
              </CardContent>
            </Card>
          ) : (
            securityEvents.map(event => {
              const e = event as Record<string, unknown>;
              return (
                <div key={e.id as number} className="flex items-start gap-3 p-3 rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{e.description as string}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{e.action as string} · {e.entity as string} · {new Date(e.createdAt as string).toLocaleString()}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "metrics" && (
        <div className="space-y-4">
          {metrics && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Card className="border border-gray-100 dark:border-gray-800">
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500 uppercase tracking-wide">Top Actions</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {((metrics.topActions as [string, number][]) ?? []).map(([action, count]) => (
                      <div key={action} className="flex items-center justify-between">
                        <span className="text-xs text-gray-700 dark:text-gray-300 capitalize">{action}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (count / (metrics.totalAuditEvents as number)) * 100 * 5)}%` }} />
                          </div>
                          <span className="text-xs font-medium text-gray-500 w-6 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="border border-gray-100 dark:border-gray-800">
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500 uppercase tracking-wide">Top Entities</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {((metrics.topEntities as [string, number][]) ?? []).map(([entity, count]) => (
                      <div key={entity} className="flex items-center justify-between">
                        <span className="text-xs text-gray-700 dark:text-gray-300 capitalize">{entity.replace(/_/g, " ")}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (count / (metrics.totalAuditEvents as number)) * 100 * 5)}%` }} />
                          </div>
                          <span className="text-xs font-medium text-gray-500 w-6 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Card className="border border-gray-100 dark:border-gray-800"><CardContent className="p-4"><p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.totalAuditEvents as number}</p><p className="text-xs text-gray-500">Total Audit Events</p></CardContent></Card>
                <Card className="border border-gray-100 dark:border-gray-800"><CardContent className="p-4"><p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.totalDevices as number}</p><p className="text-xs text-gray-500">Total Devices</p></CardContent></Card>
                <Card className="border border-gray-100 dark:border-gray-800"><CardContent className="p-4"><p className="text-2xl font-bold text-emerald-600">{metrics.trustedDevices as number}</p><p className="text-xs text-gray-500">Trusted Devices</p></CardContent></Card>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
