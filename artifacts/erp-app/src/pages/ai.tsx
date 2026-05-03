import { useGetAiHistory, useSendAiPrompt, useGetAiUsage, getGetAiHistoryQueryKey, getGetAiUsageQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Sparkles, AlertCircle, Bot, User, CheckCircle2, Webhook, Workflow, BellRing, FileText } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Link } from "wouter";

export default function AiAssistant() {
  const [prompt, setPrompt] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: history, isLoading: isHistoryLoading } = useGetAiHistory({ limit: 50 });
  const { data: usage } = useGetAiUsage();

  const sendPromptMutation = useSendAiPrompt();

  const examplePrompts = [
    "Give me a full business summary for this month",
    "Which invoices are unpaid and how much is owed?",
    "What products are running low on stock?",
    "Analyze my profit and loss — where can I save?",
    "How is my revenue trending compared to last month?",
    "What actions should I take this week?",
  ];

  const actionExamples = [
    { icon: FileText, title: "Create invoices", text: "Create invoice for Rajan Mehta, invoice number 2301, 18% GST" },
    { icon: BellRing, title: "Set alerts", text: "Notify me when stock goes below 10 units" },
    { icon: Workflow, title: "Automate work", text: "When an invoice is paid, mark the workflow as completed" },
    { icon: Webhook, title: "Connect webhooks", text: "Send invoice paid events to my webhook URL" },
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, sendPromptMutation.isPending]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    sendPromptMutation.mutate(
      { data: { prompt: text } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAiHistoryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAiUsageQueryKey() });
          setPrompt("");
        }
      }
    );
  };

  const isLimitReached = usage?.remaining === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">AI Assistant</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Chat-first business actions, insights, automations, and alerts</p>
          </div>
        </div>
        {usage && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs ${usage.remaining <= 3 ? "border-red-300 text-red-600 dark:border-red-700 dark:text-red-400" : "border-indigo-200 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400"}`}
            >
              {usage.plan === "pro" ? "Pro · Unlimited" : `${usage.remaining} / ${usage.limit} prompts left`}
            </Badge>
            {usage.plan !== "pro" && (
              <Link href="/billing">
                <Button size="sm" variant="outline" className="text-xs h-7 border-indigo-200 text-indigo-600">Upgrade</Button>
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-4">
        {actionExamples.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              onClick={() => handleSend(item.text)}
              disabled={sendPromptMutation.isPending || isLimitReached}
              className="text-left rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-indigo-300 hover:shadow-sm transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="font-semibold text-sm text-gray-900 dark:text-white">{item.title}</div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{item.text}</p>
            </button>
          );
        })}
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
        {/* Messages area */}
        <CardContent className="flex-1 overflow-y-auto p-0" ref={scrollRef}>
          {isHistoryLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !history || history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center max-w-2xl mx-auto">
              <div className="bg-indigo-50 dark:bg-indigo-950 p-4 rounded-2xl mb-4 shadow-inner">
                <Sparkles className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">How can I help you today?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                Ask me to create invoices, set alerts, run automations, trigger workflows, or analyse your business data — all from chat.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                {examplePrompts.map((ep, i) => (
                  <button
                    key={i}
                    className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/50 transition-all text-gray-700 dark:text-gray-300 disabled:opacity-50"
                    onClick={() => handleSend(ep)}
                    disabled={sendPromptMutation.isPending || isLimitReached}
                  >
                    {ep}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 p-5">
              {history?.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-3">
                  {/* User message */}
                  <div className="flex justify-end items-start gap-2.5">
                    <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%] text-sm leading-relaxed shadow-sm">
                      {msg.prompt}
                    </div>
                    <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex justify-start items-start gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-tl-sm px-5 py-4 max-w-[85%] shadow-sm">
                      <MarkdownRenderer content={msg.response} />
                      {msg.response.toLowerCase().includes("confirm") ? (
                        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Ready for your approval
                        </div>
                      ) : null}
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
                    <span className="text-sm text-gray-500 dark:text-gray-400">Analysing your data...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>

        {/* Input footer */}
        <CardFooter className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          {isLimitReached ? (
            <Alert className="w-full border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm">Prompt Limit Reached</AlertTitle>
              <AlertDescription className="flex items-center justify-between mt-1">
                <span className="text-xs text-amber-600 dark:text-amber-500">You've used all your free AI prompts. Upgrade for unlimited access.</span>
                <Link href="/billing">
                  <Button size="sm" className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7">Upgrade to Pro</Button>
                </Link>
              </AlertDescription>
            </Alert>
          ) : (
            <form
              className="flex w-full gap-2"
              onSubmit={(e) => { e.preventDefault(); handleSend(prompt); }}
            >
              <Input
                placeholder="Tell me what to do — create, alert, automate, or analyse..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={sendPromptMutation.isPending}
                className="flex-1 rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus-visible:ring-indigo-500 text-sm"
              />
              <Button
                type="submit"
                disabled={!prompt.trim() || sendPromptMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4"
              >
                {sendPromptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
