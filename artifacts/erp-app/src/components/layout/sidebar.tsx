import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Receipt, Package, Calculator, Sparkles, Settings,
  LogOut, Users, ArrowLeftRight, BarChart3, CreditCard, FileText,
  Moon, Sun, TrendingUp, Crown, Database, Monitor, Zap, ShieldCheck,
  ShoppingCart, Building2, ClipboardList, History, Workflow, Truck,
  Plug, Webhook, ArrowUpDown, SlidersHorizontal, Activity,
  Lock, Bot, ArrowLeftRight as Recon, ShieldAlert, CheckSquare,
  Puzzle, Smartphone, Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useLogout } from "@workspace/api-client-react";
import { useTheme } from "next-themes";

const coreItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "AI Assistant", href: "/ai", icon: Sparkles },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const operationsItems = [
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Invoice Generator", href: "/invoice-generator", icon: FileText },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Expenses", href: "/expenses", icon: ShoppingCart },
  { name: "Vendors", href: "/vendors", icon: Truck },
];

const financeItems = [
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { name: "Accounting", href: "/accounting", icon: Calculator },
  { name: "Credit & Debit", href: "/credit-debit", icon: CreditCard },
  { name: "GST Report", href: "/gst-report", icon: BarChart3 },
  { name: "Compliance Alerts", href: "/alerts", icon: ShieldCheck },
];

const teamItems = [
  { name: "Companies & Team", href: "/team", icon: Building2, proOnly: true },
  { name: "Approvals", href: "/approvals", icon: ClipboardList, proOnly: true },
  { name: "Workflows", href: "/workflows", icon: Workflow, proOnly: true },
  { name: "Tasks & Reminders", href: "/tasks", icon: CheckSquare },
  { name: "Audit Log", href: "/audit-log", icon: History },
];

const ecosystemItems = [
  { name: "Integrations", href: "/integrations", icon: Plug, proOnly: true },
  { name: "Webhooks & Events", href: "/webhooks", icon: Webhook, proOnly: true },
  { name: "Import / Export", href: "/import-export", icon: ArrowUpDown, proOnly: true },
  { name: "Custom Fields", href: "/custom-fields", icon: SlidersHorizontal, proOnly: true },
  { name: "System Health", href: "/system-health", icon: Activity, proOnly: true },
];

const v5Items = [
  { name: "AI Agents", href: "/ai-agents", icon: Bot, proOnly: true },
  { name: "Reconciliation", href: "/reconciliation", icon: Recon, proOnly: true },
  { name: "Policy Engine", href: "/policy", icon: ShieldAlert, proOnly: true },
  { name: "Enterprise Admin", href: "/enterprise", icon: Building, proOnly: true },
  { name: "Add-ons", href: "/addons", icon: Puzzle, proOnly: true },
  { name: "Mobile Companion", href: "/mobile-summary", icon: Smartphone },
];

const cloudItems = [
  { name: "Billing", href: "/billing", icon: Crown },
  { name: "Cloud Backup", href: "/backup", icon: Database },
  { name: "Devices", href: "/devices", icon: Monitor },
  { name: "Settings", href: "/settings", icon: Settings },
];

type NavItem = { name: string; href: string; icon: React.ElementType; proOnly?: boolean };

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout: localLogout } = useAuth();
  const logoutMutation = useLogout();
  const { theme, setTheme } = useTheme();

  const isPro = user?.plan === "pro";

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => localLogout(),
      onError: () => localLogout(),
    });
  };

  const isActive = (href: string) => {
    if (href === "/invoice-generator") return location === "/invoice-generator";
    if (href === "/invoices") return location.startsWith("/invoices") && location !== "/invoice-generator";
    if (href === "/inventory/new") return location === "/inventory/new";
    if (href === "/inventory") return location.startsWith("/inventory") && location !== "/inventory/new";
    if (href === "/accounting") return location === "/accounting" || location.startsWith("/accounting");
    return location === href || (href !== "/" && location.startsWith(href));
  };

  const NavItem = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    const locked = item.proOnly && !isPro;

    if (locked) {
      return (
        <div
          onClick={() => setLocation("/billing")}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer group text-gray-400 dark:text-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-500 dark:hover:text-indigo-400"
        >
          <Icon className="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-700 group-hover:text-indigo-400" />
          <span className="truncate flex-1">{item.name}</span>
          <Lock className="h-3 w-3 flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-indigo-400" />
        </div>
      );
    }

    return (
      <Link href={item.href}>
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
          active
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
        )}>
          <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-white" : "text-gray-400 dark:text-gray-500")} />
          <span className="truncate">{item.name}</span>
        </div>
      </Link>
    );
  };

  const SectionLabel = ({ label, badge, badgeColor, proLocked }: { label: string; badge?: string; badgeColor?: string; proLocked?: boolean }) => (
    <div className="flex items-center gap-2 px-3 mb-1 mt-4">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-600">{label}</p>
      {badge && (
        <span className={cn("text-[9px] font-bold rounded px-1 py-0.5", badgeColor ?? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400")}>
          {badge}
        </span>
      )}
      {proLocked && !isPro && (
        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded px-1 py-0.5 flex items-center gap-0.5">
          <Crown className="h-2 w-2" /> PRO
        </span>
      )}
    </div>
  );

  return (
    <div className="flex h-full w-60 flex-col bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800">
      {/* Logo */}
      <div className="flex h-14 items-center px-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base text-gray-900 dark:text-white tracking-tight">BizOS</span>
            <span className="text-[9px] font-semibold bg-indigo-600 text-white rounded px-1 py-0.5">V5</span>
            {isPro && (
              <span className="text-[9px] font-semibold bg-amber-400 text-amber-900 rounded px-1 py-0.5">PRO</span>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-3">
        <div className="space-y-0.5">
          {coreItems.map((item) => <NavItem key={item.name} item={item} />)}
        </div>

        <SectionLabel label="Operations" />
        <div className="space-y-0.5">
          {operationsItems.map((item) => <NavItem key={item.name} item={item} />)}
        </div>

        <SectionLabel label="Finance & GST" />
        <div className="space-y-0.5">
          {financeItems.map((item) => <NavItem key={item.name} item={item} />)}
        </div>

        <SectionLabel label="Team & Automation" proLocked />
        <div className="space-y-0.5">
          {teamItems.map((item) => <NavItem key={item.name} item={item} />)}
        </div>

        <SectionLabel label="Ecosystem" badge="V4" proLocked />
        <div className="space-y-0.5">
          {ecosystemItems.map((item) => <NavItem key={item.name} item={item} />)}
        </div>

        <SectionLabel label="Intelligence" badge="V5" badgeColor="bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400" proLocked />
        <div className="space-y-0.5">
          {v5Items.map((item) => <NavItem key={item.name} item={item} />)}
        </div>

        <SectionLabel label="Cloud & Account" />
        <div className="space-y-0.5">
          {cloudItems.map((item) => <NavItem key={item.name} item={item} />)}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
        {!isPro && (
          <div
            onClick={() => setLocation("/billing")}
            className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900 p-3 cursor-pointer hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">Free Plan</span>
              </div>
              <Badge className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 border-0 px-1.5 py-0">Basic</Badge>
            </div>
            <p className="text-xs text-indigo-700/70 dark:text-indigo-400 mb-2.5 leading-snug">
              Upgrade to Pro for AI Agents, Reconciliation, Policy Engine &amp; more.
            </p>
            <div className="w-full h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center font-medium transition-colors">
              <Crown className="mr-1.5 h-3 w-3" /> Upgrade to Pro
            </div>
          </div>
        )}

        {isPro && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
            <div className="flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Pro Plan</span>
            </div>
            <Badge className="text-[10px] bg-emerald-600 text-white border-0 px-1.5 py-0">Active</Badge>
          </div>
        )}

        {user && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-indigo-600">{user.name?.charAt(0)?.toUpperCase() || "U"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.businessName}</p>
            </div>
          </div>
        )}

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="text-xs font-medium">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-xs font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
