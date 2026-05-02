import { useGetAccountingSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, PieChart, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function AccountingSummary() {
  const [period, setPeriod] = useState<string>("month");
  
  const { data, isLoading } = useGetAccountingSummary({
    period: period as any,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/accounting">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Profit & Loss</h1>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? (
        <div className="text-center py-12 text-muted-foreground">
          No data available for this period.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Income</p>
                </div>
                <div className="text-3xl font-bold text-emerald-500">
                  {formatCurrency(data.totalIncome)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                </div>
                <div className="text-3xl font-bold text-destructive">
                  {formatCurrency(data.totalExpenses)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6">
                <div className="flex justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-primary">Net Profit</p>
                  {data.netProfit >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-500"/> : <TrendingDown className="h-4 w-4 text-destructive"/>}
                </div>
                <div className="flex items-baseline gap-2">
                  <div className={`text-3xl font-bold ${data.netProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                    {formatCurrency(data.netProfit)}
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Margin: {data.profitMargin}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Income Breakdown</CardTitle>
                <CardDescription>Income by category</CardDescription>
              </CardHeader>
              <CardContent>
                {data.incomeBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {data.incomeBreakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.category}</span>
                        <div className="flex items-center gap-4">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full" 
                              style={{ width: `${(item.amount / data.totalIncome) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-mono w-24 text-right">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                    <PieChart className="h-8 w-8 mb-2 opacity-50"/>
                    No income data
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Expenses</CardTitle>
                <CardDescription>Where your money went</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topExpenseCategories.length > 0 ? (
                  <div className="space-y-4">
                    {data.topExpenseCategories.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.category}</span>
                        <div className="flex items-center gap-4">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-destructive rounded-full" 
                              style={{ width: `${(item.amount / data.totalExpenses) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-mono w-24 text-right">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                    <PieChart className="h-8 w-8 mb-2 opacity-50"/>
                    No expense data
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
