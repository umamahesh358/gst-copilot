import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import {
  useCreateProduct,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Package } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

// Valid GST rates as per Indian GST law
const GST_RATES = [0, 5, 12, 18, 28] as const;
type GstRate = (typeof GST_RATES)[number];

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().optional(),
  hsnCode: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().min(1, "Unit of measure is required"),
  price: z.coerce
    .number({ invalid_type_error: "Enter a valid price" })
    .min(0, "Price must be >= 0"),
  costPrice: z.coerce
    .number({ invalid_type_error: "Enter a valid cost price" })
    .min(0, "Cost price must be >= 0")
    .default(0),
  gstRate: z.coerce
    .number()
    .refine((v): v is GstRate => (GST_RATES as readonly number[]).includes(v), {
      message: "Select a valid GST rate",
    }),
  stockQty: z.coerce
    .number({ invalid_type_error: "Enter a valid quantity" })
    .min(0, "Stock quantity must be >= 0"),
  lowStockThreshold: z.coerce
    .number({ invalid_type_error: "Enter a valid threshold" })
    .min(0, "Threshold must be >= 0"),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function NewProduct() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProductMutation = useCreateProduct();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      hsnCode: "",
      category: "",
      unit: "pcs",
      price: 0,
      costPrice: 0,
      gstRate: 18,
      stockQty: 0,
      lowStockThreshold: 5,
    },
  });

  const onSubmit = (values: ProductFormValues) => {
    createProductMutation.mutate(
      {
        data: {
          name: values.name,
          sku: values.sku || undefined,
          hsnCode: values.hsnCode || undefined,
          category: values.category || undefined,
          unit: values.unit,
          price: values.price,
          costPrice: values.costPrice,
          gstRate: values.gstRate as GstRate,
          stockQty: values.stockQty,
          lowStockThreshold: values.lowStockThreshold,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({
            title: "Product added",
            description: `"${values.name}" has been added to inventory.`,
          });
          setLocation("/inventory");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Failed to add product",
            description:
              err?.message || "Something went wrong. Please try again.",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link href="/inventory">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-600" />
            Add Inventory Item
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Add a new product or service to your inventory
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Basic Details ── */}
          <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Basic Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {/* Product Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>
                      Product / Service Name{" "}
                      <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="E.g. Wireless Mouse, Consulting Service"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* SKU */}
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU / Item Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="PROD-001"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* HSN Code */}
              <FormField
                control={form.control}
                name="hsnCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HSN / SAC Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 8471"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Electronics, Clothing, Services..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Pricing & GST ── */}
          <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Pricing &amp; GST
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {/* Selling Price */}
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Selling Price (excl. GST){" "}
                      <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₹
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="pl-7"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cost Price */}
              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost / Purchase Price</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₹
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="pl-7"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* GST Rate */}
              <FormField
                control={form.control}
                name="gstRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      GST Rate <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={String(field.value ?? 18)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select GST %" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">0% — Exempt</SelectItem>
                        <SelectItem value="5">5% — Essential Goods</SelectItem>
                        <SelectItem value="12">12% — Standard</SelectItem>
                        <SelectItem value="18">18% — Standard</SelectItem>
                        <SelectItem value="28">28% — Luxury</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Inventory Tracking ── */}
          <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Inventory Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {/* Current Stock */}
              <FormField
                control={form.control}
                name="stockQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Current Stock <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unit of Measure */}
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Unit of Measure <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        <SelectItem value="g">Grams (g)</SelectItem>
                        <SelectItem value="l">Liters (L)</SelectItem>
                        <SelectItem value="ml">Milliliters (mL)</SelectItem>
                        <SelectItem value="m">Meters (m)</SelectItem>
                        <SelectItem value="cm">Centimeters (cm)</SelectItem>
                        <SelectItem value="box">Boxes</SelectItem>
                        <SelectItem value="set">Sets</SelectItem>
                        <SelectItem value="dozen">Dozen</SelectItem>
                        <SelectItem value="hr">Hours (hr)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Low Stock Alert Threshold */}
              <FormField
                control={form.control}
                name="lowStockThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low Stock Alert At</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="5"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Actions ── */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8"
              disabled={createProductMutation.isPending}
            >
              {createProductMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {createProductMutation.isPending ? "Saving..." : "Save Product"}
            </Button>
            <Link href="/inventory">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-xl"
              >
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
