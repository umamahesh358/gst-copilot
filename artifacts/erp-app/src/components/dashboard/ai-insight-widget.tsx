import { useState, useRef, useEffect } from "react";
import { useSendAiPrompt, useGetAiUsage, getGetAiHistoryQueryKey, getGetAiUsageQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Sparkles, Send, Loader2, ChevronDown, ChevronUp, TrendingUp, AlertTriangle, IndianRupee, BarChart2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";
import { Link } from "wouter";

interface DashboardSummary {
  totalRevenue?: number;
  totalExpenses?: number;
  netProfit?: number;
  pendingPayments?: number;
  unpaidInvoicesCount?: number;
  lowStockCount?: number;
  revenueGrowth?: number;
  totalInvoicesThisMonth?: number;
}

interface AiInsightWidgetProps {
  summary?: DashboardSummary;
  isLoading?: boolean;
}

interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

function buildSmartSnapshot(summary: DashboardSummary): string {
  const lines: string[] = [];

  const revenue = summary.totalRevenue ?? 0;
  const expenses = summary.totalExpenses ?? 0;
  const profit = summary.netProfit ?? revenue - expenses;
  const growth = summary.revenueGrowth ?? 0;
  const unpaid = summary.unpaidInvoicesCount ?? 0;
  const unpaidAmt = summary.pendingPayments ?? 0;
  const lowStock = summary.lowStockCount ?? 0;
  const invoicesThisMonth = summary.totalInvoicesThisMonth ?? 0;
  const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0";

  lines.push("## Business Snapshot");
  lines.push(`Here's how your business is performing right now.\n`);

  lines.push("### Revenue & Profitability");
  lines.push(`- **Total Sales:** ${formatCurrency(revenue)}${growth !== 0 ? ` *(${growth >= 0 ? "↑" : "↓"}${Math.abs(growth).toFixed(1)}% vs last month)*` : ""}`);
  lines.push(`- **Expenses:** ${formatCurrency(expenses)}`);
  lines.push(`- **Net Profit:** **${formatCurrency(profit)}** *(${profitMargin}% margin)*`);
  if (invoicesThisMonth > 0) {
    lines.push(`- **Invoices This Month:** ${invoicesThisMonth}`);
  }

  const alerts: string[] = [];
  if (unpaid > 0) {
    alerts.push(`- **${unpaid} unpaid invoice${unpaid > 1 ? "s"  : ""}** worth ${formatCurrency(unpaidAmt)} — follow up to improve cash flow`);
  }
  if (lowStock > 0) {
    alerts.push(`- **${lowStock} product${lowStock > 1 ? "s" : ""}** running low on stock — reorder before running out`);
  }

  if (alerts.length > 0) {
    lines.push("\n### Action Needed");
    lines.push(...alerts);
  } else {
    lines.push("\n### Status");
    lines.push("- Everything looks good — no urgent issues to flag");
  }

  if (profit > 0 && revenue > 0) {
    lines.push("\n> Your business is profitable. Keep an eye on expenses to improve margins further.");
  } else if (profit < 0) {
    lines.push("\n> **Heads up:** You're running at a loss this period. Review your top expense categories.");
  }

  return lines.join("\n");
}

export function AiInsightWidget({ summary, isLoading }: AiInsightWidgetProps) {
  const [expanded, setExpanded] = useState(true);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const sendMutation = useSendAiPrompt();
  const { data: usage } = useGetAiUsage();

  const snapshot = summary ? buildSmartSnapshot(summary) : null;
  const isLimitReached = usage?.remaining === 0;

  const handleAsk = (text: string) => {
    if (!text.trim() || sendMutation.isPending || isLimitReached) return;
    const q = text.trim();
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setQuestion("");

    sendMutation.mutate(
      { data: { prompt: q } },
      {
        onSuccess: (data: any) => {
          queryClient.invalidateQueries({ queryKey: getGetAiHistoryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAiUsageQueryKey() });
          setMessages(prev => [...prev, { role: "ai", content: data.answer }]);
        },
        onError: () => {
          setMessages(prev => [...prev, { role: "ai", content: "Sorry, I couldn't process that. Please try again." }]);
        },
      }
    );
  };

  const quickPrompts = [
    "Which invoices need follow-up?",
    "What's my profit margin?",
    "Any stock running out?",
    "Show me this month's summary",
  ];

  return (
    <Card className="border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-white to-indigo-50/30 dark:from-gray-900 dark:to-indigo-950/20 shadow-sm">
      <CardContent className="p-0">
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">AI Business Assistant</span>
              <span className="ml-2 text-xs text-gray-400">•</span>
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Smart insights from your data</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {usage && (
              <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400">
                {usage.plan === "pro" ? "Pro · Unlimited" : `${usage.remaining} prompts left`}
              </Badge>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>

        {expanded && (
          <div className="border-t border-indigo-100 dark:border-indigo-900">
            {/* Snapshot */}
            <div className="px-5 py-4">
              {isLoading ? (
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  <span>Analysing your business data...</span>
                </div>
              ) : snapshot ? (
                <MarkdownRenderer content={snapshot} />
              ) : (
                <p className="text-sm text-gray-500">No data available yet. Add invoices or transactions to get insights.</p>
              )}
            </div>

            {/* Chat Messages */}
            {messages.length > 0 && (
              <div className="px-5 pb-3 space-y-3 border-t border-indigo-50 dark:border-indigo-900/50 pt-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "user" ? (
                      <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 max-w-[80%] text-sm">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%] shadow-sm">
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    )}
                  </div>
                ))}
                {sendMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900 rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2 shadow-sm">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                      <span className="text-xs text-gray-500">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Prompts */}
            {messages.length === 0 && !isLimitReached && (
              <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                {quickPrompts.map((qp, i) => (
                  <button
                    key={i}
                    onClick={() => handleAsk(qp)}
                    disabled={sendMutation.isPending}
                    className="text-xs px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors disabled:opacity-50"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-5 pb-4 pt-2 border-t border-indigo-50 dark:border-indigo-900/50">
              {isLimitReached ? (
                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5">
                  <span className="text-xs text-amber-700 dark:text-amber-400">AI prompt limit reached for free plan</span>
                  <Link href="/billing">
                    <Button size="sm" className="h-6 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">Upgrade</Button>
                  </Link>
                </div>
              ) : (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => { e.preventDefault(); handleAsk(question); }}
                >
                  <Input
                    ref={inputRef}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about your business... e.g. What's my revenue this month?"
                    disabled={sendMutation.isPending}
                    className="text-sm border-indigo-200 dark:border-indigo-800 focus-visible:ring-indigo-500 bg-white dark:bg-gray-900"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!question.trim() || sendMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0"
                  >
                    {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
