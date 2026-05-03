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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLogout } from "@workspace/api-client-react";
import { useTheme } from "@/components/theme-provider";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Invoice Generator", href: "/invoices/new", icon: FileText },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { name: "Accounting", href: "/accounting", icon: Calculator },
  { name: "Credit & Debit", href: "/credit-debit", icon: CreditCard },
  { name: "GST Report", href: "/gst-report", icon: BarChart3 },
  { name: "Alerts", href: "/alerts", icon: Bell },
  { name: "AI Assistant", href: "/ai", icon: Sparkles },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout: localLogout } = useAuth();
  const logoutMutation = useLogout();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localLogout();
      },
      onError: () => {
        localLogout();
      }
    });
  };

  const isActive = (href: string) => {
    if (href === "/invoices/new") return location === "/invoices/new";
    if (href === "/invoices") return location.startsWith("/invoices") && location !== "/invoices/new";
    if (href === "/inventory/new") return location === "/inventory/new";
    if (href === "/inventory") return location.startsWith("/inventory") && location !== "/inventory/new";
    return location.startsWith(href);
  };

  return (
    <div className="flex h-full w-64 flex-col bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800">
      <div className="flex h-14 items-center px-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">BizOS</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navigation.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-white" : "text-gray-400 dark:text-gray-500")} />
                <span className="truncate">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
        {user?.plan === "free" && (
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">Free Plan</span>
              <Badge className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 border-0 px-1.5 py-0">Basic</Badge>
            </div>
            <p className="text-xs text-indigo-700/70 dark:text-indigo-400 mb-2.5 leading-snug">
              Upgrade to Pro for unlimited invoices, AI prompts & GST filing.
            </p>
            <Button size="sm" className="w-full h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white border-0 rounded-lg">
              Upgrade to Pro
            </Button>
          </div>
        )}

        {user?.plan === "pro" && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Pro Plan</span>
            <Badge className="text-[10px] bg-emerald-600 text-white border-0 px-1.5 py-0">Active</Badge>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex flex-1 items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="text-xs font-medium">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>
        </div>

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
