"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart2,
  BookOpen,
  ArrowLeftRight,
  FileText,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Streaming hook ───────────────────────────────────────────────────────────

function useToolStream() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function stream(userContent: string, systemPrompt: string) {
    setLoading(true);
    setResult("");
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: userContent }],
          systemPrompt,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResult((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult("");
    setError(null);
  }

  return { result, loading, error, stream, reset };
}

// ─── Markdown components ──────────────────────────────────────────────────────

const proseMd: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-slate-300 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  em: ({ children }) => <em className="text-slate-400">{children}</em>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-4 text-slate-300">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-4 text-slate-300">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  h2: ({ children }) => <h2 className="mb-1 mt-4 text-sm font-semibold text-slate-100 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-semibold text-slate-200 first:mt-0">{children}</h3>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code: ({ inline, children }: any) =>
    inline ? (
      <code className="rounded bg-slate-700 px-1 py-0.5 font-mono text-xs text-emerald-300">{children}</code>
    ) : (
      <pre className="mb-3 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-300">
        <code>{children}</code>
      </pre>
    ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-slate-800">{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-slate-800 last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="bg-slate-800/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2.5 text-xs text-slate-300">{children}</td>,
};

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function ToolCard({
  icon: Icon,
  title,
  description,
  accent,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex items-start gap-3.5 border-b border-slate-800 px-5 py-4">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", accent)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex-1 p-5">{children}</div>
    </div>
  );
}

function ResultBox({
  children,
  className,
  copyText,
}: {
  children: React.ReactNode;
  className?: string;
  copyText?: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!copyText) return;
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={cn("relative rounded-xl border border-slate-800 bg-slate-800/40 p-4", className)}>
      {copyText && (
        <button
          onClick={copy}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-700 hover:text-slate-300"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
      {children}
    </div>
  );
}

function GenerateButton({
  onClick,
  loading,
  disabled,
  loadingLabel,
  label,
  color = "emerald",
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  loadingLabel: string;
  label: string;
  color?: "emerald" | "purple" | "indigo" | "blue";
}) {
  const colors = {
    emerald: "bg-emerald-600 hover:bg-emerald-500",
    purple: "bg-purple-600 hover:bg-purple-500",
    indigo: "bg-indigo-600 hover:bg-indigo-500",
    blue: "bg-blue-600 hover:bg-blue-500",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white transition-colors",
        loading || disabled ? "cursor-not-allowed bg-slate-700 text-slate-500" : colors[color]
      )}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

// ─── Tool 1: Financial Ratio Calculator (static) ──────────────────────────────

interface RatioInputs {
  currentAssets: string;
  currentLiabilities: string;
  inventory: string;
  totalDebt: string;
  totalEquity: string;
  netIncome: string;
  totalAssets: string;
  revenue: string;
  grossProfit: string;
}

const EMPTY_INPUTS: RatioInputs = {
  currentAssets: "",
  currentLiabilities: "",
  inventory: "",
  totalDebt: "",
  totalEquity: "",
  netIncome: "",
  totalAssets: "",
  revenue: "",
  grossProfit: "",
};

function parseNum(v: string): number {
  const n = parseFloat(v.replace(/,/g, ""));
  return isNaN(n) ? NaN : n;
}

function fmt(n: number, decimals = 2): string {
  if (!isFinite(n)) return "—";
  return n.toFixed(decimals) + (decimals === 0 ? "" : "");
}

function ratioColor(label: string, value: number): string {
  if (!isFinite(value)) return "text-slate-500";
  if (label === "Current Ratio") return value >= 2 ? "text-green-400" : value >= 1 ? "text-yellow-400" : "text-red-400";
  if (label === "Quick Ratio") return value >= 1 ? "text-green-400" : value >= 0.5 ? "text-yellow-400" : "text-red-400";
  if (label === "Debt-to-Equity") return value <= 1 ? "text-green-400" : value <= 2 ? "text-yellow-400" : "text-red-400";
  return "text-emerald-400";
}

function FinancialRatioCalculator() {
  const [inputs, setInputs] = useState<RatioInputs>(EMPTY_INPUTS);

  function set(key: keyof RatioInputs, val: string) {
    setInputs((prev) => ({ ...prev, [key]: val }));
  }

  const ca = parseNum(inputs.currentAssets);
  const cl = parseNum(inputs.currentLiabilities);
  const inv = parseNum(inputs.inventory);
  const debt = parseNum(inputs.totalDebt);
  const equity = parseNum(inputs.totalEquity);
  const ni = parseNum(inputs.netIncome);
  const ta = parseNum(inputs.totalAssets);
  const rev = parseNum(inputs.revenue);
  const gp = parseNum(inputs.grossProfit);

  const ratios = [
    { label: "Current Ratio", formula: "Current Assets / Current Liabilities", value: ca / cl, suffix: "x", tip: "≥ 2 healthy" },
    { label: "Quick Ratio", formula: "(Current Assets − Inventory) / Current Liabilities", value: (ca - inv) / cl, suffix: "x", tip: "≥ 1 healthy" },
    { label: "Debt-to-Equity", formula: "Total Debt / Total Equity", value: debt / equity, suffix: "x", tip: "≤ 1 conservative" },
    { label: "Return on Assets", formula: "Net Income / Total Assets × 100", value: (ni / ta) * 100, suffix: "%", tip: "Higher = better" },
    { label: "Return on Equity", formula: "Net Income / Total Equity × 100", value: (ni / equity) * 100, suffix: "%", tip: "Higher = better" },
    { label: "Net Profit Margin", formula: "Net Income / Revenue × 100", value: (ni / rev) * 100, suffix: "%", tip: "Higher = better" },
    { label: "Gross Profit Margin", formula: "Gross Profit / Revenue × 100", value: (gp / rev) * 100, suffix: "%", tip: "Higher = better" },
  ];

  const fields: { key: keyof RatioInputs; label: string }[] = [
    { key: "currentAssets", label: "Current Assets" },
    { key: "currentLiabilities", label: "Current Liabilities" },
    { key: "inventory", label: "Inventory" },
    { key: "totalDebt", label: "Total Debt" },
    { key: "totalEquity", label: "Total Equity" },
    { key: "netIncome", label: "Net Income" },
    { key: "totalAssets", label: "Total Assets" },
    { key: "revenue", label: "Revenue" },
    { key: "grossProfit", label: "Gross Profit" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="mb-1 block text-xs text-slate-500">{label}</label>
            <input
              type="number"
              value={inputs[key]}
              onChange={(e) => set(key, e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-emerald-500"
            />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/60">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Ratio</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Value</th>
              <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 sm:table-cell">Benchmark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {ratios.map(({ label, value, suffix, tip }) => (
              <tr key={label} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 text-xs text-slate-300">{label}</td>
                <td className={cn("px-4 py-2.5 font-mono text-xs font-semibold", ratioColor(label, value))}>
                  {isFinite(value) ? fmt(value) + suffix : "—"}
                </td>
                <td className="hidden px-4 py-2.5 text-xs text-slate-600 sm:table-cell">{tip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-600">
        Enter values in the same currency unit. Ratios auto-calculate as you type.
      </p>
    </div>
  );
}

// ─── Tool 2: Journal Entry Helper (AI) ───────────────────────────────────────

function JournalEntryHelper() {
  const [transaction, setTransaction] = useState("");
  const { result, loading, error, stream, reset } = useToolStream();

  async function generate() {
    if (!transaction.trim() || loading) return;
    await stream(
      `Transaction: "${transaction.trim()}"`,
      `You are an accounting tutor specializing in journal entries. The user will describe a business transaction. Generate the correct journal entry using this exact markdown format:

## Journal Entry

| Account | Debit ($) | Credit ($) |
|---------|-----------|------------|
| Account Name | amount or — | amount or — |

Rules:
- Use "—" in a cell when no amount applies for that side
- List debits first, then credits
- Indent credit account names with two spaces as per accounting convention (e.g. "  Cash")
- Use real account names (e.g. Accounts Receivable, Revenue, Cash, Inventory)

After the table, add:
## Explanation
A 2–3 sentence plain-English explanation of why each account is debited or credited, referencing the accounting equation or double-entry principles.

Keep it concise and educational.`
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Describe the transaction
        </label>
        <textarea
          value={transaction}
          onChange={(e) => { setTransaction(e.target.value); reset(); }}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), generate())}
          placeholder="e.g. Purchased $5,000 of office equipment on credit"
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>

      <GenerateButton
        onClick={generate}
        loading={loading}
        disabled={!transaction.trim()}
        loadingLabel="Building entry…"
        label="Generate Journal Entry"
        color="emerald"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <ResultBox copyText={result} className="border-emerald-900/40 bg-emerald-900/10">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={proseMd}>
            {result}
          </ReactMarkdown>
        </ResultBox>
      )}
    </div>
  );
}

// ─── Tool 3: Concept Comparator (AI) ─────────────────────────────────────────

function ConceptComparator() {
  const [conceptA, setConceptA] = useState("");
  const [conceptB, setConceptB] = useState("");
  const { result, loading, error, stream, reset } = useToolStream();

  async function compare() {
    if (!conceptA.trim() || !conceptB.trim() || loading) return;
    await stream(
      `Compare "${conceptA.trim()}" vs "${conceptB.trim()}" in accounting`,
      `You are an accounting expert creating a structured comparison for students.

Generate a clear markdown comparison between the two accounting concepts the user provides.

Format:
1. One-sentence intro contextualising both concepts
2. A markdown table with columns: Aspect | ${conceptA} | ${conceptB}
   Include these rows: Definition, Key Feature, When Used, Example, Advantage, Common Pitfall
3. A bold **Key Takeaway** line with the single most important distinction

Keep table cells concise (1–2 sentences). No preamble before the intro.`
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Concept A</label>
          <input
            value={conceptA}
            onChange={(e) => { setConceptA(e.target.value); reset(); }}
            placeholder="e.g. Accrual basis"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Concept B</label>
          <input
            value={conceptB}
            onChange={(e) => { setConceptB(e.target.value); reset(); }}
            onKeyDown={(e) => e.key === "Enter" && compare()}
            placeholder="e.g. Cash basis"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <GenerateButton
        onClick={compare}
        loading={loading}
        disabled={!conceptA.trim() || !conceptB.trim()}
        loadingLabel="Comparing…"
        label={`Compare ${conceptA || "A"} vs ${conceptB || "B"} →`}
        color="indigo"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <ResultBox copyText={result}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={proseMd}>
            {result}
          </ReactMarkdown>
        </ResultBox>
      )}
    </div>
  );
}

// ─── Tool 4: Financial Statement Analyzer (AI) ───────────────────────────────

function StatementAnalyzer() {
  const [scenario, setScenario] = useState("");
  const { result, loading, error, stream, reset } = useToolStream();
  const charCount = scenario.length;

  async function analyze() {
    if (!scenario.trim() || loading) return;
    await stream(
      scenario.trim(),
      `You are an accounting tutor helping students understand financial statements and scenarios.

The user will describe a financial statement, a set of figures, or an accounting scenario. Analyze it using exactly these markdown sections:

## Key Observations
2–4 bullet points identifying the most important figures or patterns.

## Ratio Highlights
Calculate and interpret any relevant ratios you can derive from the data provided (e.g. liquidity, profitability, leverage). If numbers are not present, explain which ratios would apply and why.

## Areas of Concern
1–3 bullet points flagging potential issues, red flags, or items that warrant further investigation.

## Learning Takeaways
1–2 sentences summarizing what an accounting student should learn from this scenario.

Keep each section concise (2–4 sentences or bullet points). If the input is not financial in nature, politely redirect.`
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400">
            Paste financial data or describe a scenario
          </label>
          <span className={cn("text-xs", charCount > 2000 ? "text-red-400" : "text-slate-600")}>
            {charCount}/2000
          </span>
        </div>
        <textarea
          value={scenario}
          onChange={(e) => { setScenario(e.target.value); reset(); }}
          placeholder={"e.g. Current Assets: $120,000 | Current Liabilities: $80,000 | Net Income: $25,000 | Revenue: $200,000 | Total Assets: $350,000"}
          rows={5}
          maxLength={2000}
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
        />
      </div>

      <GenerateButton
        onClick={analyze}
        loading={loading}
        disabled={!scenario.trim()}
        loadingLabel="Analyzing…"
        label="Analyze Statement"
        color="blue"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <ResultBox copyText={result} className="border-blue-900/40 bg-blue-900/10">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={proseMd}>
            {result}
          </ReactMarkdown>
        </ResultBox>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    icon: BarChart2,
    title: "Financial Ratio Calculator",
    description:
      "Enter balance sheet and income statement figures to instantly compute key liquidity, profitability, and leverage ratios.",
    accent: "bg-emerald-600",
    component: FinancialRatioCalculator,
  },
  {
    icon: BookOpen,
    title: "Journal Entry Helper",
    description:
      "Describe any business transaction and Claude generates the correct double-entry journal entry with a plain-English explanation.",
    accent: "bg-emerald-600",
    component: JournalEntryHelper,
  },
  {
    icon: ArrowLeftRight,
    title: "Concept Comparator",
    description:
      "Enter any two accounting concepts and Claude builds a structured side-by-side comparison table with examples.",
    accent: "bg-indigo-600",
    component: ConceptComparator,
  },
  {
    icon: FileText,
    title: "Statement Analyzer",
    description:
      "Paste financial figures or describe a scenario and Claude identifies key observations, ratios, and red flags.",
    accent: "bg-blue-600",
    component: StatementAnalyzer,
  },
];

export default function ToolsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
        <h1 className="text-sm font-semibold text-slate-100">Tools</h1>
        <p className="text-xs text-slate-500">
          Accounting utilities — ratio calculator, journal entries, concept comparisons, and statement analysis
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
          {TOOLS.map(({ icon, title, description, accent, component: Component }) => (
            <ToolCard key={title} icon={icon} title={title} description={description} accent={accent}>
              <Component />
            </ToolCard>
          ))}
        </div>
      </div>
    </div>
  );
}
