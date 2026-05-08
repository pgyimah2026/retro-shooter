import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import LayoutShell from "@/components/LayoutShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "AcctTutor — Learn Accounting with AI",
    template: "%s — AcctTutor",
  },
  description:
    "Ask accounting questions, work through financial statements, or generate practice problems. Your personal AI-powered accounting tutor.",
  keywords: ["accounting tutor", "learn accounting", "financial accounting", "accounting education", "AI tutor", "Claude AI"],
  authors: [{ name: "AcctTutor" }],
  openGraph: {
    title: "AcctTutor — Learn Accounting with AI",
    description: "Your personal AI-powered accounting tutor.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <LayoutShell>{children}</LayoutShell>
        </Providers>
      </body>
    </html>
  );
}
