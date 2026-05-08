"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/chat-store";
import type { Message } from "@/types";

// ─── Starter prompts ────────────────────────────────────────────────────────

const STARTERS = [
  {
    title: "Debits & credits",
    prompt: "Explain debits and credits with clear examples. Why does debit mean different things for different account types?",
  },
  {
    title: "Balance sheet",
    prompt: "Walk me through the structure of a balance sheet — assets, liabilities, and equity — and how the accounting equation ties them together.",
  },
  {
    title: "Income statement",
    prompt: "What is the difference between gross profit, operating income, and net income? Show me how each is calculated.",
  },
  {
    title: "Financial ratios",
    prompt: "Explain the most important financial ratios — liquidity, profitability, and leverage — and what each tells us about a company.",
  },
  {
    title: "GAAP vs IFRS",
    prompt: "What are the key differences between GAAP and IFRS? When does each apply and why does it matter?",
  },
  {
    title: "Quiz me",
    prompt: "Quiz me on basic accounting principles — give me 5 transaction scenarios and ask me how to record each one, then explain the correct entries.",
  },
];

// ─── Markdown renderer ───────────────────────────────────────────────────────

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-lg font-bold text-slate-100 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-base font-semibold text-slate-100 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-3 text-sm font-semibold text-slate-200 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-slate-300">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-slate-300">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code: ({ inline, children, ...props }: any) =>
    inline ? (
      <code
        className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-xs text-emerald-300"
        {...props}
      >
        {children}
      </code>
    ) : (
      <code className="block" {...props}>
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg border border-slate-700 bg-slate-900 p-4 font-mono text-xs text-slate-300">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-emerald-500 pl-4 italic text-slate-400">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-100">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-emerald-400 underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-slate-700" />,
};

// ─── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mr-3 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
          AI
        </div>
      )}
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-emerald-600 text-white"
            : "bg-slate-800 text-slate-200"
        )}
      >
        {isUser ? (
          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {msg.content || "▋"}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { activeThread, activeThreadId, isLoaded, createThread, addMessage, appendToLastMessage } =
    useChatStore();

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingThreadRef = useRef<string | null>(null);

  const messages = activeThread?.messages ?? [];

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Ensure a thread exists
      let threadId = activeThreadId;
      if (!threadId) {
        const t = createThread("General");
        threadId = t.id;
      }
      streamingThreadRef.current = threadId;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: new Date(),
      };
      addMessage(threadId, userMsg);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };
      addMessage(threadId, assistantMsg);
      setIsStreaming(true);

      try {
        // Collect messages to send (everything before the empty assistant placeholder)
        const historyToSend = [
          ...(activeThread?.messages ?? []),
          userMsg,
        ];

        const subject = activeThread?.subject ?? "General";
        const systemPrompt =
          "You are an accounting tutor. Your students are learners from beginner to intermediate level studying financial accounting, managerial accounting, and related topics. Focus on foundational concepts (debits/credits, financial statements, journal entries, the accounting equation), financial ratio analysis, GAAP and IFRS standards, and core accounting principles. Always explain with real-world examples and check for understanding. When relevant, use structured formatting with headers, bullet points, and tables.";

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyToSend.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            systemPrompt,
          }),
        });

        if (!res.ok) {
          throw new Error(`API error ${res.status}`);
        }
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (streamingThreadRef.current === threadId) {
            appendToLastMessage(threadId, chunk);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        appendToLastMessage(
          threadId,
          "Sorry, I ran into an error. Please check your API key and try again."
        );
      } finally {
        setIsStreaming(false);
        streamingThreadRef.current = null;
      }
    },
    [
      activeThread,
      activeThreadId,
      isStreaming,
      createThread,
      addMessage,
      appendToLastMessage,
    ]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3.5 sm:px-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-20" />
        </div>
        <div className="flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                <Skeleton
                  className={cn("rounded-2xl", i % 2 === 0 ? "h-10 w-48" : "h-16 w-64")}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-slate-100">
            {activeThread?.title ?? "New Chat"}
          </h1>
          {activeThread?.subject && activeThread.subject !== "General" && (
            <p className="text-xs text-slate-500">{activeThread.subject}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => createThread("General")}
          className="ml-2 shrink-0 gap-1.5 text-xs text-slate-400 hover:text-slate-100"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-900/20 px-4 py-2.5 text-xs text-red-400 sm:mx-6">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Messages ── */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl px-3 py-6 sm:px-6">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="animate-fade-in flex flex-col items-center">
              {/* Hero */}
              <div className="mb-8 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-600 shadow-lg shadow-emerald-900/40">
                  <span className="text-3xl">📊</span>
                </div>
                <h2 className="text-xl font-bold text-slate-100 sm:text-2xl">
                  What would you like to learn?
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
                  Ask accounting questions, work through financial statements and journal entries, or
                  generate practice problems. Everything saves in{" "}
                  <span className="font-medium text-slate-300">Threads</span>.
                </p>
              </div>

              {/* Starter prompt grid — 1 col → 2 col → 3 col */}
              <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {STARTERS.map(({ title, prompt }) => (
                  <button
                    key={title}
                    onClick={() => send(prompt)}
                    className="group rounded-xl border border-slate-800 bg-slate-800/40 p-4 text-left transition-all hover:border-emerald-600/40 hover:bg-slate-800"
                  >
                    <p className="text-sm font-medium text-slate-300 group-hover:text-slate-100">
                      {title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="animate-fade-up">
                <MessageBubble msg={msg} />
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className="animate-fade-up flex justify-start">
                <div className="mr-3 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  AI
                </div>
                <div className="rounded-2xl bg-slate-800 px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              </div>
            )}
          </div>

          <div ref={bottomRef} className="h-4" />
        </div>
      </ScrollArea>

      {/* ── Input bar ── */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-3 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2.5 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600/30 sm:px-4 sm:py-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything… (Enter sends, Shift+Enter = new line)"
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none disabled:opacity-50"
              style={{ maxHeight: 160 }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || isStreaming}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                input.trim() && !isStreaming
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              )}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Disclaimer */}
          <p className="mt-2.5 text-center text-[11px] text-slate-600">
            For educational purposes only. AI responses may contain errors — always verify
            important information.
          </p>
        </div>
      </div>
    </div>
  );
}
