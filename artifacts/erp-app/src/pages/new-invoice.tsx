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
  customerName: z.string().min(1, "Customer name required"),
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
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
    
    watchedItems.forEach(item => {
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
      let finalCustomerId = data.customerId;
      let finalCustomerName = data.customerName;

      if (customerMode === "new") {
        const newCustomer = await createCustomerMutation.mutateAsync({
          data: { name: data.customerName }
        });
        finalCustomerId = newCustomer.id;
      }

      await createInvoiceMutation.mutateAsync({
        data: {
          ...data,
          customerId: finalCustomerId,
          customerName: finalCustomerName,
          items: data.items.map(item => ({
            ...item,
            productId: item.productId || undefined
          }))
        }
      });

      toast({ title: "Invoice created" });
      setLocation("/invoices");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to create invoice" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/invoices">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                  <Button 
                    type="button" 
                    variant={customerMode === "select" ? "default" : "outline"} 
                    onClick={() => setCustomerMode("select")}
                  >
                    Select Existing
                  </Button>
                  <Button 
                    type="button" 
                    variant={customerMode === "new" ? "default" : "outline"} 
                    onClick={() => {
                      setCustomerMode("new");
                      form.setValue("customerId", undefined);
                      form.setValue("customerName", "");
                    }}
                  >
                    Add New Customer
                  </Button>
                </div>
              </div>

              {customerMode === "select" ? (
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select 
                        onValueChange={(val) => {
                          field.onChange(val);
                          const customer = customersData?.customers.find(c => c.id.toString() === val);
                          if (customer) form.setValue("customerName", customer.name);
                        }} 
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customersData?.customers.map(c => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
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
                        <Input placeholder="Enter customer name" {...field} />
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
                  <FormItem>
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

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-col md:flex-row gap-4 p-4 border rounded-md relative items-end">
                  <div className="flex-1 space-y-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.productId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product</FormLabel>
                          <Select 
                            onValueChange={(val) => {
                              if (val === "custom") {
                                field.onChange(undefined);
                                form.setValue(`items.${index}.productName`, "");
                              } else {
                                field.onChange(val);
                                const product = productsData?.products.find(p => p.id.toString() === val);
                                if (product) {
                                  form.setValue(`items.${index}.productName`, product.name);
                                  form.setValue(`items.${index}.unitPrice`, product.price);
                                  form.setValue(`items.${index}.gstRate`, product.gstRate);
                                }
                              }
                            }} 
                            value={field.value?.toString() || "custom"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select or custom" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="custom">Custom Item</SelectItem>
                              {productsData?.products.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {form.watch(`items.${index}.productId`) === undefined && (
                      <FormField
                        control={form.control}
                        name={`items.${index}.productName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter item description" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                  
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormLabel>Qty</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.unitPrice`}
                    render={({ field }) => (
                      <FormItem className="w-32">
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.gstRate`}
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormLabel>GST %</FormLabel>
                        <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="0%" />
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
                      className="text-destructive mb-2" 
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              <Button type="button" variant="outline" onClick={() => append({ productName: "", quantity: 1, unitPrice: 0, gstRate: 18 })}>
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-col md:flex-row gap-6">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Additional Info</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes / Terms</FormLabel>
                      <FormControl>
                        <Input placeholder="Thank you for your business" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="w-full md:w-80">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST</span>
                  <span>₹{totals.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-4 border-t">
                  <span>Total</span>
                  <span>₹{totals.total.toFixed(2)}</span>
                </div>
                
                <Button type="submit" className="w-full mt-4" disabled={createInvoiceMutation.isPending || createCustomerMutation.isPending}>
                  {(createInvoiceMutation.isPending || createCustomerMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
