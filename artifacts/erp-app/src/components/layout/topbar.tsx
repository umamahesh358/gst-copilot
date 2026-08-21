import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Search, Bell } from "lucide-react";
import { useTheme } from "next-themes";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

export function Topbar() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [, setLocation] = useLocation();

  // Fetch unread notification count
  const { data: notifData } = useQuery({
    queryKey: ["/notifications", { unread: "true", limit: "1" }],
    queryFn: async () => {
      const res = await fetch("/api/notifications?unread=true&limit=1", {
        credentials: "include",
      });
      if (!res.ok) return { unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30s
    enabled: !!user,
  });

  const unreadCount = notifData?.unreadCount ?? 0;

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search anywhere..."
            className="w-full bg-muted/50 pl-9 border-none focus-visible:ring-1 h-9"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative"
          onClick={() => setLocation("/notifications")}
          title={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium leading-none">{user?.name}</span>
            <span className="text-xs text-muted-foreground">{user?.businessName}</span>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
