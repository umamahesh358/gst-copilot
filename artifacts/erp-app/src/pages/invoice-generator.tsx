import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateInvoice, useListProducts, useGetSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Printer, Save, FileText } from "lucide-react";

const lineItemSchema = z.object({
  productName: z.string().min(1, "Item name required"),
  hsnCode: z.string().optional(),
  quantity: z.coerce.number().min(1, "Qty ≥ 1"),
  unitPrice: z.coerce.number().min(0),
  gstRate: z.coerce.number(),
});

const formSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number required"),
  invoiceDate: z.string().min(1),
  type: z.enum(["sale", "purchase"]),
  sellerName: z.string().optional(),
  sellerGstin: z.string().optional(),
  sellerAddress: z.string().optional(),
  buyerName: z.string().min(1, "Buyer name required"),
  buyerGstin: z.string().optional(),
  buyerAddress: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least 1 item required"),
});

type FormValues = z.infer<typeof formSchema>;

const GST_RATES = [0, 5, 12, 18, 28];

function generateInvNumber() {
  return "INV-" + Math.floor(100000 + Math.random() * 900000);
}

export default function InvoiceGenerator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createInvoiceMutation = useCreateInvoice();
  const { data: productsData } = useListProducts({ limit: 200 });
  const { data: settingsData } = useGetSettings();
  const printRef = useRef<HTMLDivElement>(null);

  const settings = settingsData;
  const products = productsData?.products || [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoiceNumber: generateInvNumber(),
      invoiceDate: new Date().toISOString().split("T")[0],
      type: "sale",
      sellerName: settings?.businessName || "",
      sellerGstin: settings?.gstNumber || "",
      sellerAddress: settings?.address || "",
      buyerName: "",
      buyerGstin: "",
      buyerAddress: "",
      notes: "",
      items: [{ productName: "", hsnCode: "", quantity: 1, unitPrice: 0, gstRate: 18 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const watchedItems = form.watch("items");

  const calcTotals = () => {
    return watchedItems.reduce(
      (acc, item) => {
        const subtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        const gstAmt = subtotal * ((Number(item.gstRate) || 0) / 100);
        return { subtotal: acc.subtotal + subtotal, gstAmount: acc.gstAmount + gstAmt };
      },
      { subtotal: 0, gstAmount: 0 }
    );
  };

  const { subtotal, gstAmount } = calcTotals();
  const grandTotal = subtotal + gstAmount;

  // GST breakup by rate
  const gstBreakup = watchedItems.reduce<Record<number, { taxable: number; cgst: number; sgst: number }>>((acc, item) => {
    const sub = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    const rate = Number(item.gstRate) || 0;
    if (!acc[rate]) acc[rate] = { taxable: 0, cgst: 0, sgst: 0 };
    acc[rate].taxable += sub;
    acc[rate].cgst += (sub * rate) / 200;
    acc[rate].sgst += (sub * rate) / 200;
    return acc;
  }, {});

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

  const handlePrint = () => {
    window.print();
  };

  const onSubmit = (values: FormValues) => {
    const itemsPayload = values.items.map((item) => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const lineGst = lineSubtotal * (item.gstRate / 100);
      return {
        productName: item.productName,
        hsnCode: item.hsnCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        gstAmount: lineGst,
        total: lineSubtotal + lineGst,
      };
    });

    createInvoiceMutation.mutate(
      {
        data: {
          invoiceNumber: values.invoiceNumber,
          customerName: values.buyerName,
          type: values.type,
          buyerGstin: values.buyerGstin,
          buyerAddress: values.buyerAddress,
          sellerName: values.sellerName,
          sellerGstin: values.sellerGstin,
          sellerAddress: values.sellerAddress,
          subtotal: subtotal,
          gstAmount,
          totalAmount: grandTotal,
          notes: values.notes,
          status: "pending",
          items: itemsPayload,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "Invoice saved successfully" });
          setLocation("/invoices");
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Error", description: err.message });
        },
      }
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-600" /> Invoice Generator
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Create professional GST-compliant invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5"
            onClick={form.handleSubmit(onSubmit)}
            disabled={createInvoiceMutation.isPending}
          >
            {createInvoiceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Invoice
          </Button>
        </div>
      </div>

      <div className="flex gap-5" ref={printRef}>
        {/* Main Form */}
        <div className="flex-1 space-y-4">
          {/* Invoice Details */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-4">Invoice Details</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Invoice Number</label>
                <Input {...form.register("invoiceNumber")} className="rounded-xl text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Invoice Date</label>
                <Input type="date" {...form.register("invoiceDate")} className="rounded-xl text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Type</label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">Sale</SelectItem>
                        <SelectItem value="purchase">Purchase</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Seller / Buyer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-4">Seller (Your Business)</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Business Name</label>
                  <Input {...form.register("sellerName")} placeholder="Your Company" className="rounded-xl text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">GSTIN</label>
                  <Input {...form.register("sellerGstin")} placeholder="22AAAAA0000A1Z5" className="rounded-xl text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Address</label>
                  <Input {...form.register("sellerAddress")} placeholder="City, State" className="rounded-xl text-sm" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-4">Bill To (Buyer)</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Name *</label>
                  <Input {...form.register("buyerName")} placeholder="Buyer Company" className="rounded-xl text-sm" />
                  {form.formState.errors.buyerName && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.buyerName.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">GSTIN</label>
                  <Input {...form.register("buyerGstin")} placeholder="22BBBBB0000B1Z5" className="rounded-xl text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Address</label>
                  <Input {...form.register("buyerAddress")} placeholder="City, State" className="rounded-xl text-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Line Items</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl gap-1 text-xs"
                onClick={() => append({ productName: "", hsnCode: "", quantity: 1, unitPrice: 0, gstRate: 18 })}
              >
                <Plus className="h-3.5 w-3.5" /> Add Row
              </Button>
            </div>

            {/* Quick fill */}
            {products.length > 0 && (
              <div className="mb-3">
                <Select onValueChange={(val) => {
                  const prod = products.find((p) => p.id.toString() === val);
                  if (prod) {
                    append({
                      productName: prod.name,
                      hsnCode: (prod as any).hsnCode || "",
                      quantity: 1,
                      unitPrice: Number(prod.price),
                      gstRate: Number(prod.gstRate),
                    });
                  }
                }}>
                  <SelectTrigger className="rounded-xl text-sm text-gray-500">
                    <SelectValue placeholder="Quick fill from inventory..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name} — {fmt(Number(p.price))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Items Table */}
            <div className="space-y-2">
              <div className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 px-1" style={{ gridTemplateColumns: "1fr 80px 70px 100px 90px 36px" }}>
                <span>Description</span>
                <span>HSN</span>
                <span>Qty</span>
                <span>Rate (₹)</span>
                <span>GST %</span>
                <span></span>
              </div>
              {fields.map((field, idx) => (
                <div key={field.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 80px 70px 100px 90px 36px" }}>
                  <Input
                    {...form.register(`items.${idx}.productName`)}
                    placeholder="Item name"
                    className="rounded-xl text-sm h-9"
                  />
                  <Input
                    {...form.register(`items.${idx}.hsnCode`)}
                    placeholder="1234"
                    className="rounded-xl text-sm h-9 font-mono"
                  />
                  <Input
                    type="number"
                    {...form.register(`items.${idx}.quantity`)}
                    min="1"
                    className="rounded-xl text-sm h-9"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register(`items.${idx}.unitPrice`)}
                    min="0"
                    className="rounded-xl text-sm h-9"
                  />
                  <Controller
                    control={form.control}
                    name={`items.${idx}.gstRate`}
                    render={({ field }) => (
                      <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                        <SelectTrigger className="rounded-xl text-sm h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {GST_RATES.map((r) => <SelectItem key={r} value={r.toString()}>{r}%</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    disabled={fields.length === 1}
                    className="h-9 w-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Notes</label>
              <Input
                {...form.register("notes")}
                placeholder="Payment terms, bank details, thank you note..."
                className="rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="w-64 flex-shrink-0 space-y-4">
          {/* Invoice Summary */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Invoice Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Subtotal (Taxable)</span>
                <span className="font-medium text-gray-900 dark:text-white">{fmt(subtotal)}</span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Grand Total</span>
                  <span className="text-lg font-bold text-indigo-600">{fmt(grandTotal)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Total GST: {fmt(gstAmount)}</p>
              </div>
            </div>
          </div>

          {/* GST Breakup */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">GST Breakup</h3>
            {Object.keys(gstBreakup).length === 0 || subtotal === 0 ? (
              <p className="text-xs text-gray-400">Add items with GST to see breakup</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(gstBreakup).map(([rate, data]) => (
                  data.taxable > 0 && (
                    <div key={rate} className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-semibold text-gray-700 dark:text-gray-300">
                        <span>GST @ {rate}%</span>
                        <span className="text-amber-600">{fmt(data.cgst + data.sgst)}</span>
                      </div>
                      <div className="pl-3 space-y-1 text-gray-500">
                        <div className="flex justify-between">
                          <span>Taxable</span><span>{fmt(data.taxable)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>CGST ({Number(rate) / 2}%)</span><span>{fmt(data.cgst)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>SGST ({Number(rate) / 2}%)</span><span>{fmt(data.sgst)}</span>
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
