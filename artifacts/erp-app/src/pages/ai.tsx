import { useGetAiHistory, useSendAiPrompt, useGetAiUsage, getGetAiHistoryQueryKey, getGetAiUsageQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2, Send, Sparkles, AlertCircle, User, CheckCircle2,
  Webhook, Workflow, BellRing, FileText, Zap, Plus, X,
  Trash2, ToggleLeft, ToggleRight, Play, Clock, Bell,
  Package, Receipt, AlertTriangle, Mail, MessageSquare,
  CreditCard, Database, Users, Calculator, Slack, Table2,
  Globe, MessageCircle, RefreshCw, XCircle, Copy, CheckSquare,
  BarChart3, ShieldCheck, Plug,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Link, useSearch } from "wouter";
import { cn } from "@/lib/utils";

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

// ─── Types ────────────────────────────────────────────────────────────────────
type Rule = { id: number; name: string; description?: string; triggerType: string; actionType: string; isActive: boolean; runCount: number; createdAt: string };
type RuleForm = { name: string; description: string; triggerType: string; actionType: string; isActive: boolean };
type Provider = { id: string; type: string; name: string; description: string; icon: string };
type Connection = { id: number; provider: string; providerType: string; displayName: string; status: string; isActive: boolean; healthStatus: string; syncCount: number; errorCount: number; lastError?: string };
type Endpoint = { id: number; name: string; url: string; events: string[]; isActive: boolean; deliveryCount: number; failureCount: number; lastStatus?: string };
type Delivery = { id: number; eventType: string; status: string; responseCode?: number; attemptCount: number; errorMessage?: string; durationMs?: number; createdAt: string };

// ─── Constants ────────────────────────────────────────────────────────────────
const TRIGGERS = [
  { value: "low_stock", label: "Low Stock", icon: Package, description: "When product stock falls below threshold" },
  { value: "invoice_overdue", label: "Invoice Overdue", icon: Receipt, description: "When an invoice passes its due date" },
  { value: "payment_received", label: "Payment Received", icon: Bell, description: "When a payment is marked as received" },
  { value: "month_end", label: "Month End", icon: Clock, description: "At the end of each calendar month" },
  { value: "expense_high", label: "Large Expense", icon: AlertTriangle, description: "When expense exceeds a threshold" },
  { value: "scheduled_daily", label: "Daily Schedule", icon: Clock, description: "Runs every day at a set time" },
];
const ACTIONS = [
  { value: "notify", label: "In-app Notification", description: "Send a notification to the user" },
  { value: "create_reminder", label: "Create Reminder", description: "Add a task reminder" },
  { value: "generate_report", label: "Generate Report", description: "Auto-generate an analytics snapshot" },
  { value: "flag_invoice", label: "Flag Invoice", description: "Mark invoice as flagged for review" },
  { value: "auto_backup", label: "Trigger Backup", description: "Start a cloud backup automatically" },
];
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
const ALL_EVENTS = [
  "invoice.created", "invoice.paid", "invoice.overdue",
  "payment.received", "expense.created", "stock.low",
  "vendor.created", "backup.completed", "approval.requested",
  "document.uploaded", "automation.triggered", "*",
];

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: "chat", label: "Chat", icon: Sparkles },
  { id: "automations", label: "Automations", icon: Workflow },
  { id: "integrations", label: "Integrations", icon: CheckSquare },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
] as const;
type TabId = typeof TABS[number]["id"];

// ─── Chat Panel ───────────────────────────────────────────────────────────────
function ChatPanel() {
  const [prompt, setPrompt] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { data: history, isLoading: isHistoryLoading } = useGetAiHistory({ limit: 50 });
  const { data: usage } = useGetAiUsage();
  const sendPromptMutation = useSendAiPrompt();
  const isLimitReached = usage?.remaining === 0;

  const quickCategories = [
    {
      label: "Business Insights",
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950",
      icon: BarChart3,
      prompts: [
        "Give me a full business summary for this month",
        "Which invoices are unpaid and how much is owed?",
        "Analyze my profit and loss — where can I save?",
        "How is my revenue trending compared to last month?",
      ],
    },
    {
      label: "Actions & Tasks",
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950",
      icon: FileText,
      prompts: [
        "Create invoice for Rajan Mehta, 18% GST, amount ₹25,000",
        "What actions should I take this week?",
        "Which products are running low on stock?",
        "List all overdue invoices and their amounts",
      ],
    },
    {
      label: "Automations",
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950",
      icon: Workflow,
      prompts: [
        "Notify me when any product stock goes below 10 units",
        "Auto-flag invoices that are overdue by more than 7 days",
        "Trigger a backup automatically at month end",
        "Create a reminder when a large expense is added",
      ],
    },
    {
      label: "Webhooks & Connect",
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950",
      icon: Webhook,
      prompts: [
        "Send invoice paid events to my webhook URL",
        "Notify my system when stock goes low",
        "Connect WhatsApp for payment notifications",
        "Set up a webhook for every new expense created",
      ],
    },
  ];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, sendPromptMutation.isPending]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    sendPromptMutation.mutate({ data: { prompt: text } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetAiHistoryQueryKey() });
        qc.invalidateQueries({ queryKey: getGetAiUsageQueryKey() });
        setPrompt("");
      }
    });
  };

  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="flex flex-col h-full gap-3">
      {usage && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">Ask anything, create things, set automations — all from here</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${usage.remaining <= 3 ? "border-red-300 text-red-600" : "border-indigo-200 text-indigo-600"}`}>
              {usage.plan === "pro" ? "Pro · Unlimited" : `${usage.remaining} / ${usage.limit} prompts left`}
            </Badge>
            {usage.plan !== "pro" && (
              <Link href="/billing">
                <Button size="sm" variant="outline" className="text-xs h-7 border-indigo-200 text-indigo-600">Upgrade</Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Category tabs + prompts */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
          {quickCategories.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <button key={cat.label} onClick={() => setActiveCategory(i)}
                className={cn("flex items-center gap-2 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-all border-b-2 -mb-px",
                  activeCategory === i
                    ? `border-indigo-500 ${cat.color} bg-gray-50 dark:bg-gray-800`
                    : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300")}>
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-0">
          {quickCategories[activeCategory].prompts.map((p, i) => (
            <button key={i} onClick={() => handleSend(p)} disabled={sendPromptMutation.isPending || isLimitReached}
              className="text-left px-4 py-3 text-xs text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all border-r border-b border-gray-50 dark:border-gray-800 last:border-r-0 disabled:opacity-50 leading-relaxed">
              <span className="text-indigo-400 mr-1.5">›</span>{p}
            </button>
          ))}
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm" style={{ minHeight: 0 }}>
        <CardContent className="flex-1 overflow-y-auto p-0" ref={scrollRef}>
          {isHistoryLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : !history || history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="bg-indigo-50 dark:bg-indigo-950 p-4 rounded-2xl mb-4 shadow-inner">
                <Sparkles className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Ready to help</h3>
              <p className="text-sm text-gray-400 max-w-sm">
                Click a suggestion above, or type your own command below.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 p-5">
              {history?.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-3">
                  <div className="flex justify-end items-start gap-2.5">
                    <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%] text-sm leading-relaxed shadow-sm">{msg.prompt}</div>
                    <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>
                  <div className="flex justify-start items-start gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-tl-sm px-5 py-4 max-w-[85%] shadow-sm">
                      <MarkdownRenderer content={msg.response} />
                      {msg.response.toLowerCase().includes("confirm") && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />Ready for your approval
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {sendPromptMutation.isPending && (
                <div className="flex justify-start items-start gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2.5 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          {isLimitReached ? (
            <Alert className="w-full border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm">Prompt Limit Reached</AlertTitle>
              <AlertDescription className="flex items-center justify-between mt-1">
                <span className="text-xs text-amber-600 dark:text-amber-500">You've used all your free AI prompts. Upgrade for unlimited access.</span>
                <Link href="/billing"><Button size="sm" className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7">Upgrade to Pro</Button></Link>
              </AlertDescription>
            </Alert>
          ) : (
            <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); handleSend(prompt); }}>
              <Input
                placeholder="Tell me what to do — create, alert, automate, or analyse..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={sendPromptMutation.isPending}
                className="flex-1 rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus-visible:ring-indigo-500 text-sm"
              />
              <Button type="submit" disabled={!prompt.trim() || sendPromptMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4">
                {sendPromptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

// ─── Automations Panel ────────────────────────────────────────────────────────
function AutomationsPanel() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RuleForm>({ name: "", description: "", triggerType: "low_stock", actionType: "notify", isActive: true });
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["automation-rules"], queryFn: () => apiFetch("/automation/rules") });
  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/automation/rules", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automation-rules"] }); setShowForm(false); setForm({ name: "", description: "", triggerType: "low_stock", actionType: "notify", isActive: true }); toast({ title: "Automation rule created" }); },
    onError: () => toast({ title: "Error creating rule", variant: "destructive" }),
  });
  const toggleMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/automation/rules/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/automation/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automation-rules"] }); toast({ title: "Rule deleted" }); },
  });

  const rules: Rule[] = data?.rules ?? [];
  const f = (k: keyof RuleForm, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Automation Rules</h2>
          <p className="text-sm text-gray-500 mt-0.5">Set up triggers and actions to automate your workflow</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-sm gap-1.5">
          <Plus className="h-4 w-4" /> New Rule
        </Button>
      </div>

      {rules.length === 0 && !isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: "Low Stock Alert", trigger: "low_stock", action: "notify", desc: "Get notified when products run low" },
            { name: "Overdue Invoice Reminder", trigger: "invoice_overdue", action: "flag_invoice", desc: "Auto-flag overdue invoices" },
            { name: "Monthly Backup", trigger: "month_end", action: "auto_backup", desc: "Trigger cloud backup each month" },
          ].map(preset => (
            <button key={preset.name} onClick={() => { setForm({ name: preset.name, description: preset.desc, triggerType: preset.trigger, actionType: preset.action, isActive: true }); setShowForm(true); }}
              className="text-left p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{preset.name}</span>
              </div>
              <p className="text-xs text-gray-400">{preset.desc}</p>
              <p className="text-[10px] text-indigo-500 mt-2">Click to set up →</p>
            </button>
          ))}
        </div>
      )}

      {isLoading
        ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        : (
          <div className="space-y-3">
            {rules.map(rule => {
              const trig = TRIGGERS.find(t => t.value === rule.triggerType);
              const act = ACTIONS.find(a => a.value === rule.actionType);
              const TrigIcon = trig?.icon ?? Zap;
              return (
                <Card key={rule.id} className={cn("border", rule.isActive ? "border-gray-100 dark:border-gray-800" : "opacity-60 border-gray-100 dark:border-gray-800")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", rule.isActive ? "bg-indigo-100 dark:bg-indigo-950" : "bg-gray-100 dark:bg-gray-800")}>
                          <TrigIcon className={cn("h-4 w-4", rule.isActive ? "text-indigo-600" : "text-gray-400")} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">{rule.name}</p>
                            <Badge variant="outline" className={cn("text-[10px]", rule.isActive ? "text-emerald-600 border-emerald-300" : "text-gray-400")}>
                              {rule.isActive ? "Active" : "Disabled"}
                            </Badge>
                          </div>
                          {rule.description && <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <div className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-900 rounded px-2 py-0.5">
                              <span className="text-gray-400">WHEN</span>
                              <span className="font-medium">{trig?.label ?? rule.triggerType}</span>
                            </div>
                            <span className="text-gray-300 dark:text-gray-600">→</span>
                            <div className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-900 rounded px-2 py-0.5">
                              <span className="text-gray-400">THEN</span>
                              <span className="font-medium">{act?.label ?? rule.actionType}</span>
                            </div>
                            {rule.runCount > 0 && <span className="text-[11px] text-gray-400 flex items-center gap-1"><Play className="h-3 w-3" /> Ran {rule.runCount}×</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleMutation.mutate(rule.id)}>
                          {rule.isActive ? <ToggleRight className="h-5 w-5 text-indigo-600" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => { if (confirm(`Delete "${rule.name}"?`)) deleteMutation.mutate(rule.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end" onClick={() => setShowForm(false)}>
          <div className="w-[400px] h-full bg-white dark:bg-gray-950 shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">New Automation Rule</h2>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Rule Name</Label>
                <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Low Stock Notification" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={form.description} onChange={e => f("description", e.target.value)} placeholder="Optional description" className="h-8 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Trigger — When this happens</Label>
                <div className="space-y-1.5">
                  {TRIGGERS.map(t => (
                    <button key={t.value} onClick={() => f("triggerType", t.value)}
                      className={cn("w-full text-left p-3 rounded-lg border text-sm transition-all", form.triggerType === t.value ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300")}>
                      <div className="flex items-center gap-2">
                        <t.icon className={cn("h-3.5 w-3.5", form.triggerType === t.value ? "text-indigo-600" : "text-gray-400")} />
                        <span className="font-medium text-gray-800 dark:text-gray-200">{t.label}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 ml-5">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Action — Do this</Label>
                <div className="space-y-1.5">
                  {ACTIONS.map(a => (
                    <button key={a.value} onClick={() => f("actionType", a.value)}
                      className={cn("w-full text-left p-3 rounded-lg border text-sm transition-all", form.actionType === a.value ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300")}>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{a.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}>
                Create Rule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Integrations Panel ───────────────────────────────────────────────────────
function IntegrationsPanel() {
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
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Integrations</h2>
        <p className="text-sm text-gray-500 mt-0.5">Connect BizOS to external services, tools, and channels</p>
      </div>

      {connections.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Active Connections ({connections.length})</p>
          <div className="grid grid-cols-2 gap-3">
            {connections.map(c => {
              const ProvIcon = ICON_MAP[providers.find(p => p.id === c.provider)?.icon ?? "default"] ?? Globe;
              return (
                <Card key={c.id} className={cn("border", c.isActive ? "border-gray-100 dark:border-gray-800" : "opacity-60 border-gray-100 dark:border-gray-800")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", c.isActive ? "bg-indigo-100 dark:bg-indigo-950" : "bg-gray-100 dark:bg-gray-800")}>
                          <ProvIcon className={cn("h-4 w-4", c.isActive ? "text-indigo-600" : "text-gray-400")} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">{c.displayName}</p>
                            {c.healthStatus === "healthy" && c.isActive
                              ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              : <AlertCircle className="h-3 w-3 text-red-400" />}
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] capitalize mt-0.5", TYPE_COLORS[c.providerType] ?? "")}>{c.providerType}</Badge>
                          {c.lastError && <p className="text-[10px] text-red-400 mt-1 truncate max-w-[160px]">{c.lastError}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => testMutation.mutate(c.id)}><RefreshCw className="h-3.5 w-3.5" /></Button>
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

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Available</p>
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
                        : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/20")}>
                    <div className="flex items-start justify-between mb-2">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", connected ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-gray-100 dark:bg-gray-800")}>
                        <Icon className={cn("h-4 w-4", connected ? "text-emerald-600" : "text-gray-500")} />
                      </div>
                      {connected ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Plus className="h-4 w-4 text-gray-400" />}
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
                <p className="text-xs text-amber-700 dark:text-amber-300">Credentials are stored securely and never exposed to the frontend after saving.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Display Name</Label>
                <Input value={formCreds.displayName ?? ""} onChange={e => setFormCreds(p => ({ ...p, displayName: e.target.value }))} placeholder={selected.name} className="h-8 text-sm" />
              </div>
              {(selected.type === "email") && (
                <>
                  <div className="space-y-1.5"><Label className="text-xs">API Key / SMTP Password</Label><Input type="password" value={formCreds.apiKey ?? ""} onChange={e => setFormCreds(p => ({ ...p, apiKey: e.target.value }))} placeholder="Enter API key" className="h-8 text-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">From Email</Label><Input value={formCreds.fromEmail ?? ""} onChange={e => setFormCreds(p => ({ ...p, fromEmail: e.target.value }))} placeholder="noreply@yourdomain.com" className="h-8 text-sm" /></div>
                </>
              )}
              {(selected.type === "sms" || selected.type === "messaging") && (
                <>
                  <div className="space-y-1.5"><Label className="text-xs">Account SID / API Key</Label><Input type="password" value={formCreds.accountSid ?? ""} onChange={e => setFormCreds(p => ({ ...p, accountSid: e.target.value }))} className="h-8 text-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Auth Token / Secret</Label><Input type="password" value={formCreds.authToken ?? ""} onChange={e => setFormCreds(p => ({ ...p, authToken: e.target.value }))} className="h-8 text-sm" /></div>
                </>
              )}
              {(selected.type === "payment") && (
                <>
                  <div className="space-y-1.5"><Label className="text-xs">API Key</Label><Input type="password" value={formCreds.apiKey ?? ""} onChange={e => setFormCreds(p => ({ ...p, apiKey: e.target.value }))} className="h-8 text-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Webhook Secret</Label><Input type="password" value={formCreds.webhookSecret ?? ""} onChange={e => setFormCreds(p => ({ ...p, webhookSecret: e.target.value }))} className="h-8 text-sm" /></div>
                </>
              )}
              {!["email", "sms", "messaging", "payment"].includes(selected.type) && (
                <>
                  <div className="space-y-1.5"><Label className="text-xs">API Key / Access Key</Label><Input type="password" value={formCreds.apiKey ?? ""} onChange={e => setFormCreds(p => ({ ...p, apiKey: e.target.value }))} className="h-8 text-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Secret / Token</Label><Input type="password" value={formCreds.secret ?? ""} onChange={e => setFormCreds(p => ({ ...p, secret: e.target.value }))} className="h-8 text-sm" /></div>
                </>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => connectMutation.mutate({ provider: selected.id, providerType: selected.type, displayName: formCreds.displayName || selected.name, credentials: formCreds })}
                disabled={connectMutation.isPending}>Connect</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Webhooks Panel ───────────────────────────────────────────────────────────
function WebhooksPanel() {
  const [showForm, setShowForm] = useState(false);
  const [subTab, setSubTab] = useState<"endpoints" | "deliveries">("endpoints");
  const [form, setForm] = useState({ name: "", url: "", description: "", events: [] as string[] });
  const [selectedEndpoint, setSelectedEndpoint] = useState<number | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: endpointsData, isLoading } = useQuery({ queryKey: ["webhook-endpoints"], queryFn: () => apiFetch("/webhooks/endpoints") });
  const { data: deliveriesData } = useQuery({
    queryKey: ["webhook-deliveries", selectedEndpoint],
    queryFn: () => apiFetch(`/webhooks/deliveries${selectedEndpoint ? `?endpoint_id=${selectedEndpoint}` : ""}`),
  });
  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/webhooks/endpoints", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });
      setShowForm(false); setForm({ name: "", url: "", description: "", events: [] });
      toast({ title: "Webhook created" });
      if (d.endpoint?.secret) { navigator.clipboard?.writeText(d.endpoint.secret); toast({ title: "Secret copied — save it now" }); }
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const testMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/webhooks/endpoints/${id}/test`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhook-deliveries", selectedEndpoint] }); toast({ title: "Test ping sent" }); },
  });
  const retryMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/webhooks/deliveries/${id}/retry`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook-deliveries", selectedEndpoint] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/webhooks/endpoints/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhook-endpoints"] }); toast({ title: "Endpoint removed" }); },
  });

  const endpoints: Endpoint[] = endpointsData?.endpoints ?? [];
  const deliveries: Delivery[] = deliveriesData?.deliveries ?? [];
  const toggleEvent = (e: string) => setForm(p => ({ ...p, events: p.events.includes(e) ? p.events.filter(x => x !== e) : [...p.events, e] }));

  const STATUS_ICON: Record<string, React.ElementType> = { delivered: CheckCircle2, failed: XCircle, pending: Clock };
  const STATUS_COLOR: Record<string, string> = { delivered: "text-emerald-600", failed: "text-red-500", pending: "text-amber-500" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Webhooks & Events</h2>
          <p className="text-sm text-gray-500 mt-0.5">Receive real-time event notifications in external systems</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-sm gap-1.5">
          <Plus className="h-4 w-4" /> New Endpoint
        </Button>
      </div>

      <div className="flex gap-1.5">
        {(["endpoints", "deliveries"] as const).map(t => (
          <Button key={t} size="sm" variant={subTab === t ? "default" : "outline"}
            className={cn("text-xs h-7 capitalize", subTab === t ? "bg-indigo-600 text-white" : "")}
            onClick={() => setSubTab(t)}>
            {t === "endpoints" ? `Endpoints (${endpoints.length})` : "Delivery Log"}
          </Button>
        ))}
        {subTab === "deliveries" && (
          <select value={selectedEndpoint ?? ""} onChange={e => setSelectedEndpoint(e.target.value ? parseInt(e.target.value) : null)}
            className="ml-auto h-7 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2">
            <option value="">All endpoints</option>
            {endpoints.map(ep => <option key={ep.id} value={ep.id}>{ep.name}</option>)}
          </select>
        )}
      </div>

      {subTab === "endpoints" && (
        isLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        : endpoints.length === 0 ? (
          <Card className="border border-gray-100 dark:border-gray-800">
            <CardContent className="py-12 text-center">
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
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{ep.name}</p>
                          <Badge variant="outline" className={cn("text-[10px]", ep.isActive ? "text-emerald-600 border-emerald-300" : "text-gray-400")}>{ep.isActive ? "Active" : "Disabled"}</Badge>
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{ep.url}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {((ep.events as string[]) ?? []).slice(0, 3).map(ev => (
                            <span key={ev} className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 rounded px-1.5 py-0.5">{ev}</span>
                          ))}
                          {(ep.events?.length ?? 0) > 3 && <span className="text-[10px] text-gray-400">+{ep.events.length - 3} more</span>}
                          <span className="text-[10px] text-gray-400 ml-auto">{ep.deliveryCount} deliveries · {ep.failureCount} failures</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2 gap-1" onClick={() => { setSelectedEndpoint(ep.id); setSubTab("deliveries"); }}>
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

      {subTab === "deliveries" && (
        <div className="space-y-2">
          {deliveries.length === 0 ? (
            <Card className="border border-gray-100 dark:border-gray-800">
              <CardContent className="py-12 text-center">
                <Clock className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No deliveries yet.</p>
              </CardContent>
            </Card>
          ) : deliveries.map(d => {
            const Icon = STATUS_ICON[d.status] ?? AlertCircle;
            return (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <Icon className={cn("h-4 w-4 flex-shrink-0", STATUS_COLOR[d.status] ?? "text-gray-400")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{d.eventType}</span>
                    {d.responseCode && <span className={cn("text-[10px] font-mono font-bold", d.responseCode < 300 ? "text-emerald-600" : "text-red-500")}>{d.responseCode}</span>}
                    {d.durationMs && <span className="text-[10px] text-gray-400">{d.durationMs}ms</span>}
                    <span className="text-[10px] text-gray-400 ml-auto">{new Date(d.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                  {d.errorMessage && <p className="text-[10px] text-red-400 mt-0.5">{d.errorMessage}</p>}
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

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end" onClick={() => setShowForm(false)}>
          <div className="w-[420px] h-full bg-white dark:bg-gray-950 shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">New Webhook Endpoint</h2>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 p-5 space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">A signing secret will be generated. Copy it immediately after creation — it won't be shown again.</p>
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
                      className={cn("text-left text-xs px-2 py-1.5 rounded-md border transition-all",
                        form.events.includes(ev) ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-700 text-gray-500")}>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AiAssistant() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const defaultTab = (params.get("tab") as TabId) ?? "chat";
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">AI Command Centre</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Chat · Automations · Integrations · Webhooks — all in one place</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              )}>
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "chat" && <ChatPanel />}
        {activeTab === "automations" && <AutomationsPanel />}
        {activeTab === "integrations" && <IntegrationsPanel />}
        {activeTab === "webhooks" && <WebhooksPanel />}
      </div>
    </div>
  );
}
