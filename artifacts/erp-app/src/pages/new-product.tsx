import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useCreateProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

const GST_RATES = [0, 5, 12, 18, 28] as const;
type GstRate = typeof GST_RATES[number];

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  price: z.coerce.number().min(0, "Price must be >= 0"),
  costPrice: z.coerce.number().min(0, "Cost price must be >= 0").optional(),
  gstRate: z.coerce.number().refine((v): v is GstRate => (GST_RATES as readonly number[]).includes(v), {
    message: "Select a valid GST rate",
  }),
  stockQty: z.coerce.number().min(0, "Stock qty must be >= 0"),
  lowStockThreshold: z.coerce.number().min(0, "Threshold must be >= 0"),
  category: z.string().optional(),
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
      unit: "pcs",
      price: 0,
      costPrice: 0,
      gstRate: 18,
      stockQty: 0,
      lowStockThreshold: 5,
      category: "",
    },
  });

  const onSubmit = (data: ProductFormValues) => {
    createProductMutation.mutate(
      {
        data: {
          name: data.name,
          sku: data.sku || undefined,
          unit: data.unit,
          price: data.price,
          costPrice: data.costPrice,
          gstRate: data.gstRate as GstRate,
          stockQty: data.stockQty,
          lowStockThreshold: data.lowStockThreshold,
          category: data.category || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Product added successfully" });
          setLocation("/inventory");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Error adding product",
            description: err.message || "Something went wrong.",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/inventory">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Add Product</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Add a new product to your inventory</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g. Wireless Mouse" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU / Code</FormLabel>
                    <FormControl>
                      <Input placeholder="PROD-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="Electronics, Clothing..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Pricing & GST</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price (excl. GST)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gstRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST Rate</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value?.toString() ?? "18"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select GST %" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">0% — Exempt</SelectItem>
                        <SelectItem value="5">5% — Essential</SelectItem>
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

          <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Inventory Tracking</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="stockQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Stock</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                        <SelectItem value="m">Meters (m)</SelectItem>
                        <SelectItem value="box">Boxes</SelectItem>
                        <SelectItem value="set">Sets</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lowStockThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low Stock Alert At</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="submit"
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8"
              disabled={createProductMutation.isPending}
            >
              {createProductMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Product
            </Button>
            <Link href="/inventory">
              <Button type="button" variant="outline" size="lg" className="rounded-xl">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
