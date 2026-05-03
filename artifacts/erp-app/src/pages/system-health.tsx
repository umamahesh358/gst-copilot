import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Zap, Webhook, Upload, Download, Activity, Clock, ShieldCheck } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

type HealthData = {
  status: string;
  timestamp: string;
  metrics: {
    integrations: { total: number; active: number };
    webhooks24h: { total: number; failed: number };
    imports24h: number;
    auditEvents24h: number;
  };
  recentErrors: { id: number; action: string; entity: string; description: string; createdAt: string }[];
};

type ActivityEvent = { action: string; entity: string; count: number };

export default function SystemHealth() {
  const { data: healthData, isLoading: healthLoading } = useQuery<HealthData>({
    queryKey: ["system-health"],
    queryFn: () => apiFetch("/system/health"),
    refetchInterval: 30000,
  });
  const { data: activityData, isLoading: activityLoading } = useQuery<{ events: ActivityEvent[]; since: string }>({
    queryKey: ["system-activity"],
    queryFn: () => apiFetch("/system/activity-summary"),
  });
  const { data: deployData } = useQuery({
    queryKey: ["deployment-profile"],
    queryFn: () => apiFetch("/system/deployment"),
  });

  const metrics = healthData?.metrics;
  const events: ActivityEvent[] = activityData?.events ?? [];
  const isHealthy = healthData?.status === "healthy";

  const metricCards = [
    { label: "Integrations", value: metrics?.integrations.active ?? 0, sub: `${metrics?.integrations.total ?? 0} total`, icon: Zap, color: "text-indigo-600", bg: "bg-indigo-100 dark:bg-indigo-950" },
    { label: "Webhooks (24h)", value: metrics?.webhooks24h.total ?? 0, sub: `${metrics?.webhooks24h.failed ?? 0} failed`, icon: Webhook, color: (metrics?.webhooks24h.failed ?? 0) > 0 ? "text-red-500" : "text-emerald-600", bg: (metrics?.webhooks24h.failed ?? 0) > 0 ? "bg-red-100 dark:bg-red-950" : "bg-emerald-100 dark:bg-emerald-950" },
    { label: "Imports (24h)", value: metrics?.imports24h ?? 0, sub: "jobs completed", icon: Upload, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950" },
    { label: "Audit Events (24h)", value: metrics?.auditEvents24h ?? 0, sub: "actions logged", icon: ShieldCheck, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950" },
  ];

  const deployMode = deployData?.deployMode ?? "cloud";
  const deployProfiles = deployData?.profiles ?? [];
  const currentProfile = deployProfiles.find((p: { id: string }) => p.id === deployMode);

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">System Health</h1>
          {healthLoading ? <Skeleton className="h-5 w-16 rounded-full" /> : (
            <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", isHealthy ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300")}>
              {isHealthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {isHealthy ? "All Systems Operational" : "Issues Detected"}
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">Monitor integrations, webhooks, import jobs, and system events</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-3">
        {metricCards.map(card => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border border-gray-100 dark:border-gray-800">
              <CardContent className="p-4">
                {healthLoading ? <Skeleton className="h-12 w-full rounded-lg" /> : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{card.label}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{card.sub}</p>
                    </div>
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", card.bg)}>
                      <Icon className={cn("h-4 w-4", card.color)} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Deployment Mode */}
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Deployment Mode</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {(deployProfiles as { id: string; name: string; description: string; icon: string }[]).map(profile => (
              <div key={profile.id} className={cn("flex items-start gap-3 p-3 rounded-xl border transition-all",
                profile.id === deployMode ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30" : "border-gray-100 dark:border-gray-800")}>
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0",
                  profile.id === deployMode ? "bg-indigo-100 dark:bg-indigo-900" : "bg-gray-100 dark:bg-gray-800")}>
                  <Activity className={cn("h-3.5 w-3.5", profile.id === deployMode ? "text-indigo-600" : "text-gray-400")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-xs font-semibold", profile.id === deployMode ? "text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-300")}>{profile.name}</p>
                    {profile.id === deployMode && <Badge className="text-[10px] bg-indigo-600 text-white border-0 px-1.5">Active</Badge>}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{profile.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Actions (7 days)</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            {activityLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 rounded" />)}</div>
            ) : events.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No activity yet.</p>
            ) : (
              <div className="space-y-1.5">
                {events.slice(0, 8).map((ev, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{ev.action.replace(/_/g, " ")}</span>
                        <span className="text-xs font-bold text-gray-900 dark:text-white ml-2 flex-shrink-0">{ev.count}</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-1 rounded-full bg-indigo-500" style={{ width: `${Math.min((ev.count / (events[0]?.count ?? 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Errors */}
      {(healthData?.recentErrors?.length ?? 0) > 0 && (
        <Card className="border border-red-100 dark:border-red-900/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Recent Errors</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {healthData!.recentErrors.map(err => (
              <div key={err.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20">
                <AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-red-700 dark:text-red-300">{err.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] text-red-500 border-red-300">{err.entity}</Badge>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{new Date(err.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Last updated */}
      {healthData && (
        <p className="text-[10px] text-gray-400 text-right flex items-center justify-end gap-1">
          <Clock className="h-3 w-3" /> Last updated: {new Date(healthData.timestamp).toLocaleTimeString("en-IN")} · Auto-refreshes every 30s
        </p>
      )}
    </div>
  );
}
