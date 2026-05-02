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
  Menu,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLogout } from "@workspace/api-client-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Accounting", href: "/accounting", icon: Calculator },
  { name: "AI Assistant", href: "/ai", icon: Sparkles },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout: localLogout } = useAuth();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localLogout();
      }
    });
  };

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 font-bold text-xl text-sidebar-primary">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground">
            B
          </div>
          BizOS
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navigation.map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-sidebar-foreground/70")} />
                {item.name}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-sidebar-border space-y-4">
        {user?.plan === "free" && (
          <div className="rounded-lg bg-sidebar-accent p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-sidebar-foreground">Free Plan</span>
              <Badge variant="secondary" className="text-xs">Basic</Badge>
            </div>
            <p className="text-xs text-sidebar-foreground/70 mb-3">
              Upgrade to Pro for unlimited AI prompts and premium features.
            </p>
            <Button size="sm" className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
              Upgrade to Pro
            </Button>
          </div>
        )}
        
        {user?.plan === "pro" && (
           <div className="flex items-center justify-between px-2">
             <span className="text-sm font-medium text-sidebar-foreground">Pro Plan</span>
             <Badge variant="default" className="text-xs bg-primary text-primary-foreground">Active</Badge>
           </div>
        )}

        <div className="flex items-center justify-between px-2 cursor-pointer group" onClick={handleLogout}>
          <div className="flex items-center gap-3 text-sm text-sidebar-foreground group-hover:text-destructive transition-colors">
            <LogOut className="h-4 w-4" />
            Logout
          </div>
        </div>
      </div>
    </div>
  );
}
