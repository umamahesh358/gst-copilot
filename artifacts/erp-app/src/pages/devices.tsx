import { useEffect, useState } from "react";
import { useListDevices, useRegisterDevice, useRevokeDevice, useDeleteDevice, getListDevicesQueryKey, useGetSubscription } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Globe, Loader2, Shield, ShieldAlert, Plus, Trash2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

function generateDeviceId(): string {
  const stored = localStorage.getItem("bizos_device_id");
  if (stored) return stored;
  const id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem("bizos_device_id", id);
  return id;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS Device";
  if (/Android/.test(ua)) return "Android Device";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Linux/.test(ua)) return "Linux PC";
  return "Web Browser";
}

function getPlatform(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android/.test(ua)) return "mobile";
  return "web";
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const DEVICE_LIMITS: Record<string, number> = { free: 1, pro: 3, pro_monthly: 3, pro_yearly: 5 };

export default function Devices() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [revokeDialog, setRevokeDialog] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<number | null>(null);
  const [autoRegister, setAutoRegister] = useState(false);

  const { data, isLoading } = useListDevices();
  const { data: subData } = useGetSubscription();
  const registerMutation = useRegisterDevice();
  const revokeMutation = useRevokeDevice();
  const deleteMutation = useDeleteDevice();

  const currentPlan = subData?.plan || "free";
  const deviceLimit = DEVICE_LIMITS[currentPlan] || 1;
  const currentDeviceId = generateDeviceId();
  const currentDeviceCount = data?.devices?.length || 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });

  useEffect(() => {
    if (!autoRegister && !isLoading) {
      const isRegistered = data?.devices?.some(d => d.deviceId === currentDeviceId);
      if (!isRegistered && currentDeviceCount < deviceLimit) {
        setAutoRegister(true);
        registerMutation.mutate({
          data: {
            deviceId: currentDeviceId,
            name: getDeviceName(),
            platform: getPlatform(),
            browserInfo: navigator.userAgent.slice(0, 200),
          },
        }, {
          onSuccess: () => invalidate(),
          onSettled: () => setAutoRegister(false),
        });
      }
    }
  }, [isLoading, data]);

  const handleRevoke = (id: number) => {
    revokeMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Device revoked" });
        setRevokeDialog(null);
        invalidate();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message });
      },
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Device removed" });
        setDeleteDialog(null);
        invalidate();
      },
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Device Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage devices that can access your account</p>
        </div>
        <Badge className={cn("text-xs", currentDeviceCount >= deviceLimit ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-0" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-0")}>
          {currentDeviceCount} / {deviceLimit} {currentPlan === "free" ? "device (Free)" : `devices (${currentPlan})`}
        </Badge>
      </div>

      {/* Current device info */}
      <Alert className="rounded-2xl border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20">
        <Shield className="h-4 w-4 text-indigo-600" />
        <AlertDescription className="text-sm text-indigo-700 dark:text-indigo-300">
          <strong>Current device:</strong> {getDeviceName()} · ID: <code className="text-xs bg-white dark:bg-gray-900 px-1 rounded">{currentDeviceId.slice(0, 20)}…</code>
        </AlertDescription>
      </Alert>

      {/* Device limit warning */}
      {currentDeviceCount >= deviceLimit && (
        <Alert className="rounded-2xl border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
            You've reached the device limit for your {currentPlan} plan ({deviceLimit} device{deviceLimit > 1 ? "s" : ""}).
            Revoke an existing device to add a new one, or upgrade your plan.
          </AlertDescription>
        </Alert>
      )}

      <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Monitor className="h-4 w-4 text-indigo-600" />
            Registered Devices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : !data?.devices || data.devices.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Monitor className="mx-auto h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">No devices registered yet</p>
              <p className="text-xs mt-1">Devices are registered automatically when you log in</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.devices.map((device) => {
                const isCurrentDevice = device.deviceId === currentDeviceId;
                const DeviceIcon = device.platform === "mobile" ? Smartphone : Globe;
                return (
                  <div key={device.id} className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-colors",
                    isCurrentDevice
                      ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20"
                      : "border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center",
                        isCurrentDevice ? "bg-indigo-100 dark:bg-indigo-900" : "bg-gray-100 dark:bg-gray-800"
                      )}>
                        <DeviceIcon className={cn("h-4 w-4", isCurrentDevice ? "text-indigo-600" : "text-gray-500")} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{device.name}</p>
                          {isCurrentDevice && (
                            <Badge className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-0 px-1.5">
                              This device
                            </Badge>
                          )}
                          {device.isTrusted && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-400 capitalize">{device.platform}</span>
                          <span className="text-xs text-gray-400">Last seen: {formatDate(device.lastSeenAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isCurrentDevice && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs rounded-lg text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={() => setRevokeDialog(device.id)}
                          >
                            <ShieldAlert className="mr-1 h-3 w-3" /> Revoke
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-lg text-gray-400 hover:text-red-500"
                            onClick={() => setDeleteDialog(device.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Device Security</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Devices are automatically registered when you log in. Free plan allows 1 device, Pro allows 3-5 devices.
                Revoke a device to prevent it from accessing your account. If you see an unfamiliar device, revoke it immediately.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!revokeDialog} onOpenChange={() => setRevokeDialog(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke Device?</DialogTitle>
            <DialogDescription>This device will no longer be able to access your account. You can re-register it later.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRevokeDialog(null)}>Cancel</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => revokeDialog && handleRevoke(revokeDialog)}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Device?</DialogTitle>
            <DialogDescription>This device record will be permanently removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteDialog && handleDelete(deleteDialog)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
