import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Receipt,
  Package,
  Calculator,
  Sparkles,
  Settings,
  LogOut,
  Users,
  ArrowLeftRight,
  BarChart3,
  CreditCard,
  Bell,
  FileText,
  Moon,
  Sun,
  TrendingUp,
  Crown,
  Database,
  Monitor,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLogout } from "@workspace/api-client-react";
import { useTheme } from "next-themes";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Invoice Generator", href: "/invoice-generator", icon: FileText },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { name: "Accounting", href: "/accounting", icon: Calculator },
  { name: "Credit & Debit", href: "/credit-debit", icon: CreditCard },
  { name: "GST Report", href: "/gst-report", icon: BarChart3 },
  { name: "Compliance Alerts", href: "/alerts", icon: ShieldCheck },
  { name: "AI Assistant", href: "/ai", icon: Sparkles },
  { name: "Settings", href: "/settings", icon: Settings },
];

const cloudItems = [
  { name: "Billing", href: "/billing", icon: Crown },
  { name: "Cloud Backup", href: "/backup", icon: Database },
  { name: "Devices", href: "/devices", icon: Monitor },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout: localLogout } = useAuth();
  const logoutMutation = useLogout();
  const { theme, setTheme } = useTheme();

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
    return location === href || (href !== "/" && location.startsWith(href));
  };

  const NavItem = ({ item }: { item: { name: string; href: string; icon: React.ElementType } }) => {
    const active = isActive(item.href);
    const Icon = item.icon;
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
            {user?.plan === "pro" && (
              <span className="text-[9px] font-semibold bg-amber-400 text-amber-900 rounded px-1 py-0.5">PRO</span>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-3">
        <div className="space-y-0.5">
          {navItems.map((item) => <NavItem key={item.name} item={item} />)}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-600">Cloud</p>
          <div className="space-y-0.5">
            {cloudItems.map((item) => <NavItem key={item.name} item={item} />)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
        {user?.plan === "free" && (
          <Link href="/billing">
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900 p-3 cursor-pointer hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">Free Plan</span>
                </div>
                <Badge className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 border-0 px-1.5 py-0">Basic</Badge>
              </div>
              <p className="text-xs text-indigo-700/70 dark:text-indigo-400 mb-2.5 leading-snug">
                Upgrade to Pro for unlimited AI, cloud backup &amp; more.
              </p>
              <div className="w-full h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center font-medium transition-colors">
                <Crown className="mr-1.5 h-3 w-3" /> Upgrade to Pro
              </div>
            </div>
          </Link>
        )}

        {user?.plan === "pro" && (
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
