"use client";

import { X, Plus, Trash2, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/chat-store";
import Link from "next/link";

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const { threads, activeThreadId, activeThread, createThread, selectThread, deleteThread } =
    useChatStore();

  function handleNewChat() {
    createThread(activeThread?.subject ?? "General");
    onClose?.();
  }

  return (
    <div className="flex h-full w-full flex-col border-r border-slate-800 bg-slate-900">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Threads
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewChat}
            title="New chat"
            className="h-7 w-7 text-slate-400 hover:text-slate-100"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {/* Close button — mobile only */}
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-100 lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <Separator className="bg-slate-800" />

      {/* New Chat CTA when empty */}
      {threads.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800">
            <MessageSquare className="h-6 w-6 text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">No conversations yet</p>
          <Link
            href="/"
            onClick={handleNewChat}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Start a Chat
          </Link>
        </div>
      )}

      {/* Thread list */}
      {threads.length > 0 && (
        <ScrollArea className="flex-1">
          <div className="space-y-px px-2 py-2 pb-6">
            {threads.map((thread) => {
              const active = activeThreadId === thread.id;
              return (
                <div key={thread.id} className="group relative">
                  <Link href="/">
                    <button
                      onClick={() => {
                        selectThread(thread.id);
                        onClose?.();
                      }}
                      className={cn(
                        "w-full rounded-lg px-3 py-2.5 pr-8 text-left transition-colors",
                        active
                          ? "bg-slate-800 text-slate-100"
                          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                      )}
                    >
                      <p className="truncate text-sm font-medium leading-snug">
                        {thread.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {thread.preview || "Empty conversation"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-600">
                        {timeAgo(thread.createdAt)}
                      </p>
                    </button>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(thread.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-600 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                    title="Delete thread"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <Separator className="bg-slate-800" />
      <div className="shrink-0 px-4 py-3">
        <p className="text-[11px] text-slate-600">Powered by Claude</p>
      </div>
    </div>
  );
}
