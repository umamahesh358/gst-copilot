import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Save, Monitor, Cloud, Server, Palette, Globe, Building2, Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useLocation } from "wouter";

const settingsSchema = z.object({
  businessName: z.string().min(1, "Business name required"),
  gstNumber: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  invoicePrefix: z.string().optional(),
  currency: z.string().min(1, "Currency required"),
  currencySymbol: z.string().min(1, "Symbol required"),
  taxLabel: z.string().min(1, "Tax label required"),
  theme: z.enum(["light", "dark", "system"]),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

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

type BrandingForm = {
  appName: string; tagline: string; primaryColor: string; accentColor: string;
  logoUrl: string; footerText: string; supportEmail: string;
  deployMode: string; whitelabelEnabled: boolean; customDomain: string;
};
const defaultBranding: BrandingForm = {
  appName: "BizOS", tagline: "AI-Powered ERP for Indian SMEs",
  primaryColor: "#4f46e5", accentColor: "#7c3aed",
  logoUrl: "", footerText: "", supportEmail: "",
  deployMode: "cloud", whitelabelEnabled: false, customDomain: "",
};

const DEPLOY_MODES = [
  { id: "local", label: "Local Desktop", description: "Runs on your machine. No cloud sync. Full offline support.", icon: Monitor },
  { id: "cloud", label: "Cloud Connected", description: "Sync data to cloud. Access from any browser. Auto backup.", icon: Cloud },
  { id: "enterprise", label: "Self-Hosted", description: "Deploy on your own server or private cloud. Full control.", icon: Server },
];

const PRESET_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isPro = user?.plan === "pro";

  const { data: settings, isLoading } = useGetSettings();
  const updateSettingsMutation = useUpdateSettings();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: "", gstNumber: "", address: "", phone: "", email: "",
      invoicePrefix: "INV-", currency: "INR", currencySymbol: "₹", taxLabel: "GST", theme: "dark",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        businessName: settings.businessName,
        gstNumber: settings.gstNumber || "",
        address: settings.address || "",
        phone: settings.phone || "",
        email: settings.email || "",
        invoicePrefix: settings.invoicePrefix || "INV-",
        currency: settings.currency || "INR",
        currencySymbol: settings.currencySymbol || "₹",
        taxLabel: settings.taxLabel || "GST",
        theme: settings.theme || "dark",
      });
    }
  }, [settings, form]);

  const onSubmit = (data: SettingsFormValues) => {
    updateSettingsMutation.mutate({ data }, {
      onSuccess: (updatedSettings) => {
        queryClient.setQueryData(getGetSettingsQueryKey(), updatedSettings);
        setTheme(updatedSettings.theme);
        toast({ title: "Settings updated successfully" });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Error", description: err.message });
      },
    });
  };

  // Branding state
  const [brandingForm, setBrandingForm] = useState<BrandingForm>(defaultBranding);
  const [isDirty, setIsDirty] = useState(false);

  const { data: brandingData, isLoading: brandingLoading } = useQuery({
    queryKey: ["branding"],
    queryFn: () => apiFetch("/system/branding"),
    enabled: isPro,
  });

  useEffect(() => {
    if (brandingData?.branding) {
      setBrandingForm({ ...defaultBranding, ...brandingData.branding });
      setIsDirty(false);
    }
  }, [brandingData]);

  const saveBrandingMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/system/branding", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branding"] });
      setIsDirty(false);
      toast({ title: "Branding settings saved" });
    },
    onError: () => toast({ title: "Error saving branding", variant: "destructive" }),
  });

  const bf = (k: keyof BrandingForm, v: string | boolean) => {
    setBrandingForm(p => ({ ...p, [k]: v }));
    setIsDirty(true);
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Tabs defaultValue="business">
        <TabsList className="mb-4">
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-1.5">
            Branding & Deployment
            {!isPro && <Lock className="h-3 w-3 text-gray-400" />}
            {isPro && <Crown className="h-3 w-3 text-amber-500" />}
          </TabsTrigger>
        </TabsList>

        {/* ── Business Tab ── */}
        <TabsContent value="business">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Business Details</CardTitle>
                  <CardDescription>These details appear on your invoices.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="businessName" render={({ field }) => (
                    <FormItem><FormLabel>Business Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="gstNumber" render={({ field }) => (
                    <FormItem><FormLabel>GST Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Business Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* ── Preferences Tab ── */}
        <TabsContent value="preferences">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preferences</CardTitle>
                  <CardDescription>App behavior and customization.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="invoicePrefix" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Prefix</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormDescription>Prepended to all auto-generated invoice numbers.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="theme" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Theme</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="taxLabel" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Label</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormDescription>E.g., GST, VAT, Tax.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency Code</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="currencySymbol" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency Symbol</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* ── Branding & Deployment Tab ── */}
        <TabsContent value="branding">
          {!isPro ? (
            <Card className="border-dashed border-2 border-gray-200 dark:border-gray-800">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="relative mb-5">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 flex items-center justify-center">
                    <Lock className="h-7 w-7 text-indigo-400" />
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-amber-400 flex items-center justify-center">
                    <Crown className="h-3 w-3 text-amber-900" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Pro Feature</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
                  Branding & Deployment lets you customize the app name, colors, logo, and deployment mode. Available on the Pro plan.
                </p>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setLocation("/billing")}>
                  <Crown className="mr-2 h-4 w-4" /> Upgrade to Pro
                </Button>
              </CardContent>
            </Card>
          ) : brandingLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-5">
              <div className="flex justify-end">
                <Button
                  className={cn("h-9 text-sm gap-1.5", isDirty ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-gray-100 text-gray-400 dark:bg-gray-800 cursor-default")}
                  onClick={() => isDirty && saveBrandingMutation.mutate(brandingForm)}
                  disabled={!isDirty || saveBrandingMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                  {saveBrandingMutation.isPending ? "Saving…" : "Save Branding"}
                </Button>
              </div>

              {/* App Identity */}
              <Card className="border border-gray-100 dark:border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" /> App Identity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">App Name</Label>
                    <Input value={brandingForm.appName} onChange={e => bf("appName", e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tagline</Label>
                    <Input value={brandingForm.tagline} onChange={e => bf("tagline", e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Support Email</Label>
                    <Input value={brandingForm.supportEmail} onChange={e => bf("supportEmail", e.target.value)} placeholder="support@yourdomain.com" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Footer Text</Label>
                    <Input value={brandingForm.footerText} onChange={e => bf("footerText", e.target.value)} placeholder="© 2026 Your Company" className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Logo URL</Label>
                    <Input value={brandingForm.logoUrl} onChange={e => bf("logoUrl", e.target.value)} placeholder="https://yourcdn.com/logo.png" className="h-8 text-sm" />
                  </div>
                </CardContent>
              </Card>

              {/* Theme Colors */}
              <Card className="border border-gray-100 dark:border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Palette className="h-4 w-4 text-gray-400" /> Theme Colors
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Primary Color</Label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={brandingForm.primaryColor} onChange={e => bf("primaryColor", e.target.value)}
                          className="h-8 w-12 rounded border border-gray-200 dark:border-gray-700 cursor-pointer p-0.5" />
                        <Input value={brandingForm.primaryColor} onChange={e => bf("primaryColor", e.target.value)} className="h-8 text-sm font-mono flex-1" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Accent Color</Label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={brandingForm.accentColor} onChange={e => bf("accentColor", e.target.value)}
                          className="h-8 w-12 rounded border border-gray-200 dark:border-gray-700 cursor-pointer p-0.5" />
                        <Input value={brandingForm.accentColor} onChange={e => bf("accentColor", e.target.value)} className="h-8 text-sm font-mono flex-1" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">Quick Presets</Label>
                    <div className="flex gap-2">
                      {PRESET_COLORS.map(color => (
                        <button key={color} onClick={() => bf("primaryColor", color)}
                          className={cn("h-7 w-7 rounded-lg border-2 transition-all",
                            brandingForm.primaryColor === color ? "border-gray-400 scale-110" : "border-transparent hover:scale-105")}
                          style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </div>
                  {/* Preview */}
                  <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preview</p>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandingForm.primaryColor }}>
                        <span className="text-white text-xs font-bold">{brandingForm.appName.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900 dark:text-white">{brandingForm.appName || "BizOS"}</p>
                        <p className="text-[10px] text-gray-400">{brandingForm.tagline || "Your tagline here"}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: brandingForm.primaryColor }}>Primary Button</button>
                      <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: brandingForm.accentColor }}>Accent Button</button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Deployment Mode */}
              <Card className="border border-gray-100 dark:border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4 text-gray-400" /> Deployment Mode
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  {DEPLOY_MODES.map(mode => {
                    const Icon = mode.icon;
                    const active = brandingForm.deployMode === mode.id;
                    return (
                      <button key={mode.id} onClick={() => bf("deployMode", mode.id)}
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
                  <button
                    onClick={() => bf("whitelabelEnabled", !brandingForm.whitelabelEnabled)}
                    className={cn("h-6 w-11 rounded-full transition-all flex-shrink-0", brandingForm.whitelabelEnabled ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700")}>
                    <div className={cn("h-5 w-5 rounded-full bg-white shadow transition-all mx-0.5", brandingForm.whitelabelEnabled ? "translate-x-5" : "translate-x-0")} />
                  </button>
                </CardContent>
              </Card>

              {brandingForm.whitelabelEnabled && (
                <Card className="border border-indigo-200 dark:border-indigo-800">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">White-label Configuration</p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Custom Domain</Label>
                      <Input value={brandingForm.customDomain} onChange={e => bf("customDomain", e.target.value)} placeholder="app.yourdomain.com" className="h-8 text-sm" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
