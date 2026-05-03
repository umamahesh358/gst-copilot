import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Save, Monitor, Cloud, Server, Palette, Globe, Building2 } from "lucide-react";

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

type BrandingForm = { appName: string; tagline: string; primaryColor: string; accentColor: string; logoUrl: string; footerText: string; supportEmail: string; deployMode: string; whitelabelEnabled: boolean; customDomain: string };
const defaultForm: BrandingForm = { appName: "BizOS", tagline: "AI-Powered ERP for Indian SMEs", primaryColor: "#4f46e5", accentColor: "#7c3aed", logoUrl: "", footerText: "", supportEmail: "", deployMode: "cloud", whitelabelEnabled: false, customDomain: "" };

const DEPLOY_MODES = [
  { id: "local", label: "Local Desktop", description: "Runs on your machine. No cloud sync. Full offline support.", icon: Monitor },
  { id: "cloud", label: "Cloud Connected", description: "Sync data to cloud. Access from any browser. Auto backup.", icon: Cloud },
  { id: "enterprise", label: "Self-Hosted", description: "Deploy on your own server or private cloud. Full control.", icon: Server },
];

const PRESET_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function Branding() {
  const [form, setForm] = useState<BrandingForm>(defaultForm);
  const [isDirty, setIsDirty] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({ queryKey: ["branding"], queryFn: () => apiFetch("/system/branding") });

  useEffect(() => {
    if (data?.branding) {
      setForm({ ...defaultForm, ...data.branding });
      setIsDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/system/branding", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branding"] }); setIsDirty(false); toast({ title: "Branding settings saved" }); },
    onError: () => toast({ title: "Error saving settings", variant: "destructive" }),
  });

  const f = (k: keyof BrandingForm, v: string | boolean) => { setForm(p => ({ ...p, [k]: v })); setIsDirty(true); };

  if (isLoading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Branding & Deployment</h1>
          <p className="text-sm text-gray-500 mt-0.5">Customize app appearance and configure deployment mode</p>
        </div>
        <Button className={cn("h-9 text-sm gap-1.5", isDirty ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-gray-100 text-gray-400 dark:bg-gray-800 cursor-default")}
          onClick={() => isDirty && saveMutation.mutate(form)} disabled={!isDirty || saveMutation.isPending}>
          <Save className="h-4 w-4" /> {saveMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      {/* App Identity */}
      <Card className="border border-gray-100 dark:border-gray-800">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-gray-400" /> App Identity</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">App Name</Label>
            <Input value={form.appName} onChange={e => f("appName", e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tagline</Label>
            <Input value={form.tagline} onChange={e => f("tagline", e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Support Email</Label>
            <Input value={form.supportEmail} onChange={e => f("supportEmail", e.target.value)} placeholder="support@yourdomain.com" className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Footer Text</Label>
            <Input value={form.footerText} onChange={e => f("footerText", e.target.value)} placeholder="© 2026 Your Company" className="h-8 text-sm" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Logo URL</Label>
            <Input value={form.logoUrl} onChange={e => f("logoUrl", e.target.value)} placeholder="https://yourcdn.com/logo.png" className="h-8 text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Theme Colors */}
      <Card className="border border-gray-100 dark:border-gray-800">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4 text-gray-400" /> Theme Colors</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Primary Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.primaryColor} onChange={e => f("primaryColor", e.target.value)} className="h-8 w-12 rounded border border-gray-200 dark:border-gray-700 cursor-pointer p-0.5" />
                <Input value={form.primaryColor} onChange={e => f("primaryColor", e.target.value)} className="h-8 text-sm font-mono flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Accent Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.accentColor} onChange={e => f("accentColor", e.target.value)} className="h-8 w-12 rounded border border-gray-200 dark:border-gray-700 cursor-pointer p-0.5" />
                <Input value={form.accentColor} onChange={e => f("accentColor", e.target.value)} className="h-8 text-sm font-mono flex-1" />
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs mb-2 block">Quick Presets</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map(color => (
                <button key={color} onClick={() => f("primaryColor", color)}
                  className={cn("h-7 w-7 rounded-lg border-2 transition-all", form.primaryColor === color ? "border-gray-400 scale-110" : "border-transparent hover:scale-105")}
                  style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
          {/* Preview */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preview</p>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: form.primaryColor }}>
                <span className="text-white text-xs font-bold">{form.appName.charAt(0)}</span>
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900 dark:text-white">{form.appName || "BizOS"}</p>
                <p className="text-[10px] text-gray-400">{form.tagline || "Your tagline here"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: form.primaryColor }}>Primary Button</button>
              <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: form.accentColor }}>Accent Button</button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deployment Mode */}
      <Card className="border border-gray-100 dark:border-gray-800">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-gray-400" /> Deployment Mode</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {DEPLOY_MODES.map(mode => {
            const Icon = mode.icon;
            const active = form.deployMode === mode.id;
            return (
              <button key={mode.id} onClick={() => f("deployMode", mode.id)}
                className={cn("w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                  active ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600")}>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", active ? "bg-indigo-100 dark:bg-indigo-900" : "bg-gray-100 dark:bg-gray-800")}>
                  <Icon className={cn("h-4 w-4", active ? "text-indigo-600" : "text-gray-400")} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm font-semibold", active ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-200")}>{mode.label}</p>
                    {active && <Badge className="text-[10px] bg-indigo-600 text-white border-0 px-1.5">Active</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{mode.description}</p>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* White-label */}
      <Card className="border border-gray-100 dark:border-gray-800">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">White-label Mode</p>
            <p className="text-xs text-gray-400 mt-0.5">Hide BizOS branding and use your own app name and colors throughout</p>
          </div>
          <button onClick={() => f("whitelabelEnabled", !form.whitelabelEnabled)}
            className={cn("h-6 w-11 rounded-full transition-all flex-shrink-0", form.whitelabelEnabled ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700")}>
            <div className={cn("h-5 w-5 rounded-full bg-white shadow transition-all mx-0.5", form.whitelabelEnabled ? "translate-x-5" : "translate-x-0")} />
          </button>
        </CardContent>
      </Card>

      {form.whitelabelEnabled && (
        <Card className="border border-indigo-200 dark:border-indigo-800">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">White-label Configuration</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Custom Domain</Label>
              <Input value={form.customDomain} onChange={e => f("customDomain", e.target.value)} placeholder="app.yourdomain.com" className="h-8 text-sm" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
