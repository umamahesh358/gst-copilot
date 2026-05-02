import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTheme } from "next-themes";

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

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();
  
  const { data: settings, isLoading } = useGetSettings();
  const updateSettingsMutation = useUpdateSettings();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: "",
      gstNumber: "",
      address: "",
      phone: "",
      email: "",
      invoicePrefix: "INV-",
      currency: "INR",
      currencySymbol: "₹",
      taxLabel: "GST",
      theme: "dark",
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
    updateSettingsMutation.mutate(
      { data },
      {
        onSuccess: (updatedSettings) => {
          queryClient.setQueryData(getGetSettingsQueryKey(), updatedSettings);
          setTheme(updatedSettings.theme);
          toast({ title: "Settings updated successfully" });
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Error", description: err.message });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

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
              )}/>
              <FormField control={form.control} name="gstNumber" render={({ field }) => (
                <FormItem><FormLabel>GST Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Business Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
            </CardContent>
          </Card>

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
              )}/>
              
              <FormField control={form.control} name="theme" render={({ field }) => (
                <FormItem>
                  <FormLabel>Theme</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}/>

              <FormField control={form.control} name="taxLabel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Label</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormDescription>E.g., GST, VAT, Tax.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}/>
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
    </div>
  );
}
