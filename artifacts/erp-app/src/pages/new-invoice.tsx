import { useState } from "react";
import { useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateInvoice, useListProducts, useListCustomers, useCreateCustomer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const invoiceItemSchema = z.object({
  productId: z.coerce.number().optional(),
  productName: z.string().min(1, "Product name required"),
  quantity: z.coerce.number().min(1, "Qty > 0"),
  unitPrice: z.coerce.number().min(0, "Price >= 0"),
  gstRate: z.coerce.number(),
});

const invoiceSchema = z.object({
  customerId: z.coerce.number().optional(),
  customerName: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least 1 item required"),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export default function NewInvoice() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createInvoiceMutation = useCreateInvoice();
  const { data: productsData } = useListProducts({ limit: 100 });
  const { data: customersData } = useListCustomers({ limit: 100 });
  const createCustomerMutation = useCreateCustomer();

  const [customerMode, setCustomerMode] = useState<"select" | "new">("select");

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerName: "",
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      items: [{ productName: "", quantity: 1, unitPrice: 0, gstRate: 18 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");

  const calculateTotals = () => {
    let subtotal = 0;
    let gstAmount = 0;
    watchedItems.forEach((item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
      const itemGst = itemSubtotal * ((item.gstRate || 0) / 100);
      subtotal += itemSubtotal;
      gstAmount += itemGst;
    });
    return { subtotal, gstAmount, total: subtotal + gstAmount };
  };

  const totals = calculateTotals();

  const onSubmit = async (data: InvoiceFormValues) => {
    try {
      if (customerMode === "select" && !data.customerId) {
        toast({ variant: "destructive", title: "Customer required", description: "Please select a customer or add a new one." });
        return;
      }
      if (customerMode === "new" && (!data.customerName || data.customerName.trim() === "")) {
        toast({ variant: "destructive", title: "Customer name required", description: "Please enter a customer name." });
        return;
      }

      let finalCustomerId = data.customerId;
      let finalCustomerName = data.customerName || "";

      if (customerMode === "new" && data.customerName) {
        const newCustomer = await createCustomerMutation.mutateAsync({
          data: { name: data.customerName },
        });
        finalCustomerId = (newCustomer as any).id;
        finalCustomerName = data.customerName;
      }

      await createInvoiceMutation.mutateAsync({
        data: {
          customerId: finalCustomerId,
          customerName: finalCustomerName,
          dueDate: data.dueDate || undefined,
          notes: data.notes,
          items: data.items.map((item) => ({
            productId: item.productId || undefined,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
          })),
        },
      });

      toast({ title: "Invoice created successfully" });
      setLocation("/invoices");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error creating invoice",
        description: err.message || "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/invoices">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Create Invoice</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Generate a new tax invoice for your customer</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={customerMode === "select" ? "default" : "outline"}
                  onClick={() => setCustomerMode("select")}
                  className={customerMode === "select" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                >
                  Select Existing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={customerMode === "new" ? "default" : "outline"}
                  onClick={() => {
                    setCustomerMode("new");
                    form.setValue("customerId", undefined);
                    form.setValue("customerName", "");
                  }}
                  className={customerMode === "new" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                >
                  Add New Customer
                </Button>
              </div>

              {customerMode === "select" ? (
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Customer</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(Number(val));
                          const customer = customersData?.customers.find((c) => c.id.toString() === val);
                          if (customer) form.setValue("customerName", customer.name);
                        }}
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a customer..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customersData?.customers && customersData.customers.length > 0 ? (
                            customersData.customers.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__none__" disabled>
                              No customers yet — add one instead
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter customer or business name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-col md:flex-row gap-3 p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-900/50 relative items-end"
                >
                  <div className="flex-1 space-y-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.productId`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Product</FormLabel>
                          <Select
                            onValueChange={(val) => {
                              if (val === "custom") {
                                f.onChange(undefined);
                                form.setValue(`items.${index}.productName`, "");
                              } else {
                                f.onChange(Number(val));
                                const product = productsData?.products.find((p) => p.id.toString() === val);
                                if (product) {
                                  form.setValue(`items.${index}.productName`, product.name);
                                  form.setValue(`items.${index}.unitPrice`, product.price);
                                  form.setValue(`items.${index}.gstRate`, product.gstRate);
                                }
                              }
                            }}
                            value={f.value?.toString() || "custom"}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select or custom" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="custom">Custom Item</SelectItem>
                              {productsData?.products.map((p) => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.productName`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Description</FormLabel>
                          <FormControl>
                            <Input
                              className="h-9 text-sm"
                              placeholder="Item description"
                              {...f}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-3 items-end">
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field: f }) => (
                        <FormItem className="w-20">
                          <FormLabel className="text-xs">Qty</FormLabel>
                          <FormControl>
                            <Input className="h-9 text-sm" type="number" min="1" {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.unitPrice`}
                      render={({ field: f }) => (
                        <FormItem className="w-32">
                          <FormLabel className="text-xs">Price (₹)</FormLabel>
                          <FormControl>
                            <Input className="h-9 text-sm" type="number" min="0" step="0.01" {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.gstRate`}
                      render={({ field: f }) => (
                        <FormItem className="w-24">
                          <FormLabel className="text-xs">GST %</FormLabel>
                          <Select
                            onValueChange={(val) => f.onChange(Number(val))}
                            value={f.value?.toString() ?? "18"}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">0%</SelectItem>
                              <SelectItem value="5">5%</SelectItem>
                              <SelectItem value="12">12%</SelectItem>
                              <SelectItem value="18">18%</SelectItem>
                              <SelectItem value="28">28%</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => append({ productName: "", quantity: 1, unitPrice: 0, gstRate: 18 })}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Line Item
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-col md:flex-row gap-4">
            <Card className="flex-1 rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Thank you for your business!" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="w-full md:w-72 rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Invoice Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">₹{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">GST</span>
                  <span className="font-medium text-amber-600">₹{totals.gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span>Total</span>
                  <span className="text-indigo-600">₹{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

                <Button
                  type="submit"
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                  disabled={createInvoiceMutation.isPending || createCustomerMutation.isPending}
                >
                  {(createInvoiceMutation.isPending || createCustomerMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create Invoice
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  );
}
