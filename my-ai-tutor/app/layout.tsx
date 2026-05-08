import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import LayoutShell from "@/components/LayoutShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "PyTutor — Learn Python with AI",
    template: "%s — PyTutor",
  },
  description:
    "Ask Python questions, walk through data structures and algorithms, or generate practice problems. Your personal AI-powered Python tutor.",
  keywords: ["Python tutor", "learn Python", "Python programming", "coding education", "AI tutor", "Claude AI"],
  authors: [{ name: "PyTutor" }],
  openGraph: {
    title: "PyTutor — Learn Python with AI",
    description: "Your personal AI-powered Python programming tutor.",
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
