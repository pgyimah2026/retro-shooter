"use client";

import { ChatProvider } from "@/lib/chat-store";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ChatProvider>{children}</ChatProvider>;
}
