import { useGetAiHistory, useSendAiPrompt, useGetAiUsage, getGetAiHistoryQueryKey, getGetAiUsageQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Send, Sparkles, AlertCircle, User, CheckCircle2, Workflow, Webhook, Plug, BarChart3, FileText } from "lucide-react";

const QUICK_PROMPTS = [
  "Give me a full business summary for this month",
  "Create invoice for Rajan Mehta, 18% GST, amount ₹25,000",
  "Which products are running low on stock?",
  "Set up a workflow for overdue invoices",
  "Connect WhatsApp notifications for payments",
  "Create a webhook for invoice paid events",
];

export default function AiAssistant() {
  const [prompt, setPrompt] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { data: history, isLoading: isHistoryLoading } = useGetAiHistory({ limit: 50 });
  const { data: usage } = useGetAiUsage();
  const sendPromptMutation = useSendAiPrompt();
  const isLimitReached = usage?.remaining === 0;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, sendPromptMutation.isPending]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    sendPromptMutation.mutate({ data: { prompt: text } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetAiHistoryQueryKey() });
        qc.invalidateQueries({ queryKey: getGetAiUsageQueryKey() });
        setPrompt("");
      },
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">AI Assistant</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Everything happens in one prompt</p>
          </div>
        </div>
      </div>

      {usage && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400">One prompt handles everything — ask, create, automate, or connect</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${usage.remaining <= 3 ? "border-red-300 text-red-600" : "border-indigo-200 text-indigo-600"}`}>
              {usage.plan === "pro" ? "Pro · Unlimited" : `${usage.remaining} / ${usage.limit} prompts left`}
            </Badge>
            {usage.plan !== "pro" && (
              <Link href="/billing">
                <Button size="sm" variant="outline" className="text-xs h-7 border-indigo-200 text-indigo-600">Upgrade</Button>
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Quick prompts</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {QUICK_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p)}
              disabled={sendPromptMutation.isPending || isLimitReached}
              className="text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-all disabled:opacity-50 leading-relaxed"
            >
              <span className="text-indigo-400 mr-1.5">›</span>{p}
            </button>
          ))}
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm" style={{ minHeight: 0 }}>
        <CardContent className="flex-1 overflow-y-auto p-0" ref={scrollRef}>
          {isHistoryLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : !history || history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="bg-indigo-50 dark:bg-indigo-950 p-4 rounded-2xl mb-4 shadow-inner">
                <Sparkles className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Ready to help</h3>
              <p className="text-sm text-gray-400 max-w-sm">Click a suggestion above or type one command — I’ll handle the rest.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 p-5">
              {history?.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-3">
                  <div className="flex justify-end items-start gap-2.5">
                    <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%] text-sm leading-relaxed shadow-sm">{msg.prompt}</div>
                    <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>
                  <div className="flex justify-start items-start gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-tl-sm px-5 py-4 max-w-[85%] shadow-sm">
                      <MarkdownRenderer content={msg.response} />
                      {msg.response.toLowerCase().includes("confirm") && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />Ready for your approval
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {sendPromptMutation.isPending && (
                <div className="flex justify-start items-start gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2.5 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          {isLimitReached ? (
            <Alert className="w-full border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm">Prompt Limit Reached</AlertTitle>
              <AlertDescription className="flex items-center justify-between mt-1">
                <span className="text-xs text-amber-600 dark:text-amber-500">You've used all your free AI prompts. Upgrade for unlimited access.</span>
                <Link href="/billing"><Button size="sm" className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7">Upgrade to Pro</Button></Link>
              </AlertDescription>
            </Alert>
          ) : (
            <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); handleSend(prompt); }}>
              <Input
                placeholder="Tell me what to do — create, alert, automate, or analyse..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={sendPromptMutation.isPending}
                className="flex-1 rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus-visible:ring-indigo-500 text-sm"
              />
              <Button type="submit" disabled={!prompt.trim() || sendPromptMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4">
                {sendPromptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}