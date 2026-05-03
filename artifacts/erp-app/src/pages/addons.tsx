import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Puzzle, Download, Trash2, CheckCircle2, Star, Loader2 } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const CATEGORY_COLORS: Record<string, string> = {
  compliance: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  communication: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  accounting: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  finance: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ai: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  marketing: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-300",
  payments: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  general: "bg-gray-100 text-gray-600 dark:bg-gray-800",
};

export default function Addons() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["addons"], queryFn: () => apiFetch("/addons") });

  const installMutation = useMutation({
    mutationFn: (slug: string) => apiFetch(`/addons/${slug}/install`, { method: "POST" }),
    onSuccess: (_, slug) => { qc.invalidateQueries({ queryKey: ["addons"] }); toast({ title: "Add-on installed", description: slug }); },
    onError: () => toast({ title: "Installation failed", variant: "destructive" }),
  });

  const uninstallMutation = useMutation({
    mutationFn: (slug: string) => apiFetch(`/addons/${slug}/uninstall`, { method: "POST" }),
    onSuccess: (_, slug) => { qc.invalidateQueries({ queryKey: ["addons"] }); toast({ title: "Add-on removed", description: slug }); },
  });

  const addons = (data?.addons ?? []) as Record<string, unknown>[];
  const installedCount = data?.installed ?? 0;

  const featured = addons.filter(a => a.isFeatured === 1);
  const rest = addons.filter(a => a.isFeatured !== 1);
  const categories = [...new Set(addons.map(a => a.category as string))];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-indigo-600" /> Add-ons & Extensions
            <Badge className="text-[9px] bg-indigo-600 text-white border-0">V5</Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Extend BizOS with powerful integrations and capabilities</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            {installedCount} installed
          </Badge>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}

      {!isLoading && featured.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Featured</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {featured.map(addon => <AddonCard key={addon.slug as string} addon={addon} onInstall={installMutation.mutate} onUninstall={uninstallMutation.mutate} isPending={installMutation.isPending || uninstallMutation.isPending} />)}
          </div>
        </div>
      )}

      {categories.filter(c => rest.some(a => a.category === c)).map(cat => {
        const catAddons = rest.filter(a => a.category === cat);
        return (
          <div key={cat}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 capitalize">{cat}</p>
            <div className="grid grid-cols-2 gap-3">
              {catAddons.map(addon => <AddonCard key={addon.slug as string} addon={addon} onInstall={installMutation.mutate} onUninstall={uninstallMutation.mutate} isPending={installMutation.isPending || uninstallMutation.isPending} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddonCard({ addon, onInstall, onUninstall, isPending }: {
  addon: Record<string, unknown>;
  onInstall: (slug: string) => void;
  onUninstall: (slug: string) => void;
  isPending: boolean;
}) {
  const catColor = (CATEGORY_COLORS[addon.category as string] ?? CATEGORY_COLORS.general);
  return (
    <Card className={cn("border transition-all hover:shadow-sm", addon.installed ? "border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/10" : "border-gray-100 dark:border-gray-800")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{addon.name as string}</p>
              {addon.isFeatured === 1 && <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-2">{addon.description as string}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("text-[10px] font-medium rounded px-1.5 py-0.5", catColor)}>{addon.category as string}</span>
              <span className="text-[10px] text-gray-400">v{addon.version as string}</span>
              {addon.author && <span className="text-[10px] text-gray-400">by {addon.author as string}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          {addon.installed ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Installed
            </div>
          ) : (
            <div className="text-[10px] text-gray-400">Requires Pro</div>
          )}
          {addon.installed ? (
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
              disabled={isPending} onClick={() => onUninstall(addon.slug as string)}>
              <Trash2 className="h-3 w-3 mr-1" /> Remove
            </Button>
          ) : (
            <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={isPending} onClick={() => onInstall(addon.slug as string)}>
              <Download className="h-3 w-3 mr-1" /> Install
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
