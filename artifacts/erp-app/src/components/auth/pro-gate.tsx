import { useLocation } from "wouter";
import { Crown, Lock, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

interface ProGateProps {
  children: React.ReactNode;
  feature?: string;
}

export function ProGate({ children, feature = "this feature" }: ProGateProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user?.plan === "pro") {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-64px)] px-6">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950/60 dark:to-purple-950/60 flex items-center justify-center shadow-lg">
              <Lock className="h-9 w-9 text-indigo-500 dark:text-indigo-400" />
            </div>
            <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-amber-400 flex items-center justify-center shadow">
              <Crown className="h-3.5 w-3.5 text-amber-900" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Pro Feature
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-1 text-sm leading-relaxed">
          <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{feature}</span> is available on the Pro plan.
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mb-8">
          Upgrade to unlock Ecosystem, Team & Automation, advanced integrations, webhooks, import/export, and more.
        </p>

        <div className="space-y-3">
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11 text-sm font-semibold"
            onClick={() => setLocation("/billing")}
          >
            <Crown className="mr-2 h-4 w-4" />
            Upgrade to Pro
          </Button>
          <Button
            variant="ghost"
            className="w-full text-gray-500 dark:text-gray-400 h-9 text-sm"
            onClick={() => setLocation("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 text-left">
          {[
            "Ecosystem & Integrations",
            "Webhooks & Events",
            "Import / Export",
            "Custom Fields",
            "System Health & Branding",
            "Team, Approvals & Workflows",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
              <Zap className="h-3 w-3 text-indigo-400 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
