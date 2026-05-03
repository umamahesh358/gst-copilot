import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Search, ShieldCheck, User, Database, AlertCircle, CheckCircle2 } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

type AuditLog = {
  id: number; action: string; entity: string; entityId?: string;
  description: string; status: string; ipAddress?: string; createdAt: string;
};

const ENTITY_COLORS: Record<string, string> = {
  invoice: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  product: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  expense: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  vendor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  payment: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  subscription: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  company: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  approval_request: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  success: CheckCircle2,
  failure: AlertCircle,
  error: AlertCircle,
};

function actionLabel(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const ENTITIES = ["", "invoice", "product", "customer", "expense", "vendor", "payment", "subscription", "company", "automation_rule", "approval_request"];

export default function AuditLog() {
  const [entityFilter, setEntityFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", entityFilter],
    queryFn: () => apiFetch(`/audit-logs?limit=100${entityFilter ? `&entity=${entityFilter}` : ""}`),
    refetchInterval: 30000,
  });

  const logs: AuditLog[] = data?.logs ?? [];
  const filtered = logs.filter(l =>
    !search || l.description.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase()) || l.entity.toLowerCase().includes(search.toLowerCase())
  );

  function groupByDate(items: AuditLog[]) {
    const groups: Record<string, AuditLog[]> = {};
    items.forEach(item => {
      const date = new Date(item.createdAt).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  }

  const groups = groupByDate(filtered);

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-0.5">Complete history of all actions taken in your account</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input placeholder="Search actions…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm w-52" />
        </div>
        <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
          className="h-8 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 capitalize">
          {ENTITIES.map(e => <option key={e} value={e}>{e || "All entities"}</option>)}
        </select>
        <Badge variant="outline" className="text-xs">{filtered.length} entries</Badge>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : Object.keys(groups).length === 0 ? (
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardContent className="py-16 text-center">
            <ShieldCheck className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No audit logs found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                <span className="text-xs font-semibold text-gray-400 px-2">{date}</span>
                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="space-y-1">
                {items.map(log => {
                  const StatusIcon = ACTION_ICONS[log.status] ?? CheckCircle2;
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
                      <StatusIcon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", log.status === "success" ? "text-emerald-500" : "text-red-400")} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{log.description}</span>
                          <Badge variant="outline" className={cn("text-[10px] capitalize", ENTITY_COLORS[log.entity] ?? "")}>
                            {log.entity}
                          </Badge>
                          {log.entityId && <span className="text-[10px] text-gray-400 font-mono">#{log.entityId}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-gray-400">
                            {new Date(log.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {log.ipAddress && <span className="text-[10px] text-gray-300 dark:text-gray-600">{log.ipAddress}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity capitalize whitespace-nowrap">
                        {actionLabel(log.action)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
