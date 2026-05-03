import { useState } from "react";
import { useGetSubscription, useListPlans, useCreateCheckout, useVerifyPayment, useCancelSubscription, useGetBillingHistory, getGetSubscriptionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Crown, Zap, Star, CreditCard, Calendar, AlertCircle, ChevronRight, RefreshCw, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Zap,
  pro_monthly: Crown,
  pro_yearly: Star,
};

const PLAN_COLORS: Record<string, string> = {
  free: "border-gray-200 dark:border-gray-700",
  pro_monthly: "border-indigo-500 ring-2 ring-indigo-500/20",
  pro_yearly: "border-amber-500 ring-2 ring-amber-500/20",
};

const PLAN_HEADER_COLORS: Record<string, string> = {
  free: "bg-gray-50 dark:bg-gray-900",
  pro_monthly: "bg-indigo-600",
  pro_yearly: "bg-gradient-to-br from-amber-500 to-orange-500",
};

export default function Billing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cancelDialog, setCancelDialog] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [upgradeDialog, setUpgradeDialog] = useState<string | null>(null);

  const { data: subData, isLoading: subLoading } = useGetSubscription();
  const { data: plansData, isLoading: plansLoading } = useListPlans();
  const { data: historyData, isLoading: historyLoading } = useGetBillingHistory({ limit: 10 });

  const checkoutMutation = useCreateCheckout();
  const verifyMutation = useVerifyPayment();
  const cancelMutation = useCancelSubscription();

  const currentPlan = subData?.plan || "free";
  const subscription = subData?.subscription;

  const handleUpgradeClick = (planId: string) => {
    setUpgradeDialog(planId);
  };

  const handleConfirmUpgrade = async () => {
    if (!upgradeDialog) return;
    setCheckoutPlan(upgradeDialog);
    setUpgradeDialog(null);

    checkoutMutation.mutate(
      { data: { planId: upgradeDialog as "pro_monthly" | "pro_yearly" } },
      {
        onSuccess: (order) => {
          const razorpayKey = order.keyId;
          if (razorpayKey === "rzp_test_placeholder" || !window.Razorpay) {
            verifyMutation.mutate(
              {
                data: {
                  paymentId: order.paymentId,
                  gatewayPaymentId: `pay_demo_${Date.now()}`,
                  gatewayOrderId: order.orderId,
                },
              },
              {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
                  toast({ title: "Subscription activated!", description: "Welcome to Pro! Enjoy all premium features." });
                  setCheckoutPlan(null);
                },
                onError: (err: any) => {
                  toast({ variant: "destructive", title: "Activation failed", description: err.message });
                  setCheckoutPlan(null);
                },
              }
            );
            return;
          }

          const options = {
            key: razorpayKey,
            amount: order.amount,
            currency: order.currency,
            name: "BizOS",
            description: `${order.planName} Subscription`,
            order_id: order.orderId,
            handler: (response: any) => {
              verifyMutation.mutate(
                {
                  data: {
                    paymentId: order.paymentId,
                    gatewayPaymentId: response.razorpay_payment_id,
                    gatewayOrderId: response.razorpay_order_id,
                    gatewaySignature: response.razorpay_signature,
                  },
                },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
                    toast({ title: "Payment successful!", description: "Your Pro subscription is now active." });
                    setCheckoutPlan(null);
                  },
                  onError: (err: any) => {
                    toast({ variant: "destructive", title: "Verification failed", description: err.message });
                    setCheckoutPlan(null);
                  },
                }
              );
            },
            modal: { ondismiss: () => setCheckoutPlan(null) },
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Checkout failed", description: err.message });
          setCheckoutPlan(null);
        },
      }
    );
  };

  const handleCancel = () => {
    cancelMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
        toast({ title: "Subscription cancelled", description: "You'll retain access until the end of your billing period." });
        setCancelDialog(false);
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message });
      },
    });
  };

  if (subLoading || plansLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Subscription & Billing</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your plan and payment history</p>
      </div>

      {/* Current Plan Status */}
      <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center",
                currentPlan === "free" ? "bg-gray-100 dark:bg-gray-800" : "bg-indigo-100 dark:bg-indigo-950"
              )}>
                <Crown className={cn("h-6 w-6", currentPlan === "free" ? "text-gray-500" : "text-indigo-600")} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {subData?.planDetails?.name || "Free Plan"}
                  </h2>
                  <Badge className={cn("text-xs font-medium border-0",
                    currentPlan === "free"
                      ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  )}>
                    {currentPlan === "free" ? "Free" : "Active"}
                  </Badge>
                </div>
                {subscription ? (
                  <p className="text-sm text-gray-500 mt-0.5">
                    Renews {formatDate(subscription.renewalDate)} · {subscription.billingCycle === "yearly" ? "Annual" : "Monthly"} billing
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {subData?.aiPromptsUsed || 0} / {subData?.aiPromptsLimit || 10} AI prompts used
                  </p>
                )}
              </div>
            </div>
            {currentPlan !== "free" && subscription && (
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setCancelDialog(true)}>
                Cancel Plan
              </Button>
            )}
          </div>

          {subscription && (
            <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-xs text-gray-400 mb-1">Start Date</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(subscription.startDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Next Renewal</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(subscription.renewalDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Amount</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {subscription.amount ? formatCurrency(parseFloat(String(subscription.amount))) : "—"}
                  <span className="text-xs text-gray-400 ml-1">/ {subscription.billingCycle === "yearly" ? "year" : "month"}</span>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plansData?.plans?.map((plan) => {
            const isCurrent = plan.id === currentPlan || (currentPlan === "pro" && (plan.id === "pro_monthly" || plan.id === "pro_yearly"));
            const Icon = PLAN_ICONS[plan.id] || Zap;
            const isPaid = plan.id !== "free";
            return (
              <Card key={plan.id} className={cn("rounded-2xl overflow-hidden", PLAN_COLORS[plan.id] || "border-gray-200 dark:border-gray-700")}>
                <div className={cn("p-5", PLAN_HEADER_COLORS[plan.id] || "bg-gray-50")}>
                  <div className="flex items-center justify-between mb-1">
                    <Icon className={cn("h-5 w-5", plan.id === "free" ? "text-gray-500" : "text-white")} />
                    {plan.badge && (
                      <Badge className="text-[10px] bg-white/20 text-white border-0 px-1.5">{plan.badge}</Badge>
                    )}
                    {isCurrent && (
                      <Badge className="text-[10px] bg-white/20 text-white border-0 px-1.5">Current</Badge>
                    )}
                  </div>
                  <p className={cn("text-base font-bold mt-2", plan.id === "free" ? "text-gray-800 dark:text-white" : "text-white")}>{plan.name}</p>
                  <p className={cn("text-2xl font-black mt-1", plan.id === "free" ? "text-gray-900 dark:text-white" : "text-white")}>
                    {plan.price === 0 ? "Free" : formatCurrency(plan.price)}
                    {plan.price > 0 && (
                      <span className={cn("text-sm font-normal ml-1", plan.id === "free" ? "text-gray-500" : "text-white/70")}>
                        / {plan.billingCycle}
                      </span>
                    )}
                  </p>
                </div>
                <CardContent className="p-5">
                  <ul className="space-y-2 mb-5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Check className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button className="w-full rounded-xl" variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : isPaid ? (
                    <Button
                      className={cn("w-full rounded-xl text-white", plan.id === "pro_yearly"
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                        : "bg-indigo-600 hover:bg-indigo-700"
                      )}
                      onClick={() => handleUpgradeClick(plan.id)}
                      disabled={!!checkoutPlan}
                    >
                      {checkoutPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upgrade Now"}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Billing History */}
      <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-indigo-600" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : !historyData?.payments || historyData.payments.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CreditCard className="mx-auto h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">No payments yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyData.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {payment.plan.replace("_", " ")} plan
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(payment.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={cn("text-xs border-0",
                      payment.status === "paid"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : payment.status === "pending"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    )}>
                      {payment.status}
                    </Badge>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(parseFloat(String(payment.amount)))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade confirmation dialog */}
      <Dialog open={!!upgradeDialog} onOpenChange={() => setUpgradeDialog(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Upgrade</DialogTitle>
            <DialogDescription>
              You're upgrading to{" "}
              <strong>{plansData?.plans?.find(p => p.id === upgradeDialog)?.name}</strong>.
              {upgradeDialog === "pro_monthly" ? " ₹999/month" : " ₹8,999/year"} will be charged.
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
              Demo mode: Payment will be simulated without an actual Razorpay charge.
            </AlertDescription>
          </Alert>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUpgradeDialog(null)}>Cancel</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleConfirmUpgrade}
              disabled={checkoutMutation.isPending || verifyMutation.isPending}
            >
              {(checkoutMutation.isPending || verifyMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Subscription?</DialogTitle>
            <DialogDescription>
              You'll keep Pro access until <strong>{formatDate(subscription?.endDate)}</strong>.
              After that, your account will revert to the Free plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialog(false)}>Keep Plan</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
