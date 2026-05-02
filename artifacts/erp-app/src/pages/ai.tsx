import { useGetAiHistory, useSendAiPrompt, useGetAiUsage, getGetAiHistoryQueryKey, getGetAiUsageQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Sparkles, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AiAssistant() {
  const [prompt, setPrompt] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  const { data: history, isLoading: isHistoryLoading } = useGetAiHistory({ limit: 50 });
  const { data: usage } = useGetAiUsage();
  
  const sendPromptMutation = useSendAiPrompt();

  const examplePrompts = [
    "Show my profit this month",
    "Which invoices are unpaid?",
    "Which products are low in stock?",
    "Summarize my business this week"
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Assistant
        </h1>
        {usage && (
          <div className="text-sm font-medium">
            <span className="text-muted-foreground">Prompts remaining: </span>
            <span className={usage.remaining <= 5 ? "text-destructive" : "text-primary"}>
              {usage.remaining} / {usage.limit}
            </span>
          </div>
        )}
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-0" ref={scrollRef}>
          {isHistoryLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : history?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center max-w-lg mx-auto">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-medium mb-2">How can I help you today?</h3>
              <p className="text-muted-foreground mb-8">
                I can analyze your business data, help you find invoices, check stock levels, and summarize your finances.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {examplePrompts.map((ep, i) => (
                  <Button 
                    key={i} 
                    variant="outline" 
                    className="h-auto py-3 px-4 justify-start text-left whitespace-normal"
                    onClick={() => handleSend(ep)}
                    disabled={sendPromptMutation.isPending || isLimitReached}
                  >
                    {ep}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4">
              {history?.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-3">
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                      {msg.prompt}
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.response}
                    </div>
                  </div>
                </div>
              ))}
              {sendPromptMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="p-4 border-t bg-card">
          {isLimitReached ? (
            <Alert variant="destructive" className="w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Limit Reached</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>You've used all your AI prompts for this period.</span>
                <Button size="sm" variant="outline">Upgrade to Pro</Button>
              </AlertDescription>
            </Alert>
          ) : (
            <form 
              className="flex w-full gap-2" 
              onSubmit={(e) => { e.preventDefault(); handleSend(prompt); }}
            >
              <Input
                placeholder="Ask about your business..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={sendPromptMutation.isPending}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!prompt.trim() || sendPromptMutation.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
