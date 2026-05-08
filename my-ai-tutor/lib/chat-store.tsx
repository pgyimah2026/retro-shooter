"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Message, Thread } from "@/types";

const STORAGE_KEY = "ai-tutor-threads";
const ACTIVE_KEY = "ai-tutor-active";

interface ChatStore {
  threads: Thread[];
  activeThreadId: string | null;
  activeThread: Thread | null;
  isLoaded: boolean;
  createThread: (subject?: string) => Thread;
  selectThread: (id: string) => void;
  addMessage: (threadId: string, message: Message) => void;
  appendToLastMessage: (threadId: string, text: string) => void;
  deleteThread: (id: string) => void;
}

const ChatContext = createContext<ChatStore | null>(null);

function hydrate(raw: string): Thread[] {
  return JSON.parse(raw).map((t: Thread & { createdAt: string; messages: (Message & { createdAt: string })[] }) => ({
    ...t,
    createdAt: new Date(t.createdAt),
    messages: t.messages.map((m) => ({ ...m, createdAt: new Date(m.createdAt) })),
  }));
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setThreads(hydrate(raw));
      const active = localStorage.getItem(ACTIVE_KEY);
      if (active) setActiveThreadId(active);
    } catch {}
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    } catch {}
  }, [threads, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      if (activeThreadId) localStorage.setItem(ACTIVE_KEY, activeThreadId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {}
  }, [activeThreadId, isLoaded]);

  const createThread = useCallback((subject = "General"): Thread => {
    const thread: Thread = {
      id: crypto.randomUUID(),
      title: "New Chat",
      preview: "",
      subject,
      createdAt: new Date(),
      messages: [],
    };
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(thread.id);
    return thread;
  }, []);

  const selectThread = useCallback((id: string) => setActiveThreadId(id), []);

  const addMessage = useCallback((threadId: string, message: Message) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const title =
          t.title === "New Chat" && message.role === "user"
            ? message.content.slice(0, 42) + (message.content.length > 42 ? "…" : "")
            : t.title;
        const preview =
          message.role === "user" ? message.content.slice(0, 70) : t.preview;
        return { ...t, title, preview, messages: [...t.messages, message] };
      })
    );
  }, []);

  const appendToLastMessage = useCallback((threadId: string, text: string) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const messages = [...t.messages];
        const last = messages[messages.length - 1];
        if (!last || last.role !== "assistant") return t;
        messages[messages.length - 1] = { ...last, content: last.content + text };
        return { ...t, messages };
      })
    );
  }, []);

  const deleteThread = useCallback((id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    setActiveThreadId((prev) => (prev === id ? null : prev));
  }, []);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  return (
    <ChatContext.Provider
      value={{
        threads,
        activeThreadId,
        activeThread,
        isLoaded,
        createThread,
        selectThread,
        addMessage,
        appendToLastMessage,
        deleteThread,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatStore() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatStore must be used within ChatProvider");
  return ctx;
}
