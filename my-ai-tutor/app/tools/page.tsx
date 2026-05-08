"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Zap,
  ArrowLeftRight,
  Bug,
  Hammer,
  Loader2,
  Copy,
  Check,
  CheckSquare,
  Square,
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

const checklistMd: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  ...proseMd,
  ul: ({ children }) => <ul className="space-y-1">{children}</ul>,
  li: ({ children }) => (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-300">{children}</li>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: ({ type, checked }: any) => {
    if (type !== "checkbox") return null;
    return checked ? (
      <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
    ) : (
      <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
    );
  },
  p: ({ children }) => <>{children}</>,
  strong: ({ children }) => (
    <strong className="mb-1 mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-400 first:mt-0">
      {children}
    </strong>
  ),
};

// ─── Shared card wrapper ──────────────────────────────────────────────────────

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

// ─── Shared result area ───────────────────────────────────────────────────────

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
  color?: "emerald" | "purple" | "green" | "indigo";
}) {
  const colors = {
    emerald: "bg-emerald-600 hover:bg-emerald-500",
    purple: "bg-purple-600 hover:bg-purple-500",
    green: "bg-emerald-600 hover:bg-emerald-500",
    indigo: "bg-indigo-600 hover:bg-indigo-500",
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

// ─── Tool 1: Big-O Reference ──────────────────────────────────────────────────

const BIG_O_DATA: {
  ds: string;
  operations: { op: string; time: string; note?: string }[];
}[] = [
  {
    ds: "list",
    operations: [
      { op: "Access (l[i])", time: "O(1)" },
      { op: "Append (l.append)", time: "O(1) amortized" },
      { op: "Insert (l.insert)", time: "O(n)" },
      { op: "Delete (l.pop(i) / del)", time: "O(n)" },
      { op: "Pop last (l.pop())", time: "O(1)" },
      { op: "Search (in)", time: "O(n)" },
      { op: "Sort (l.sort)", time: "O(n log n)", note: "Timsort" },
    ],
  },
  {
    ds: "dict",
    operations: [
      { op: "Get (d[k])", time: "O(1) avg" },
      { op: "Set (d[k] = v)", time: "O(1) avg" },
      { op: "Delete (del d[k])", time: "O(1) avg" },
      { op: "Key lookup (in)", time: "O(1) avg" },
      { op: "Iteration (.items())", time: "O(n)" },
    ],
  },
  {
    ds: "set",
    operations: [
      { op: "Add (s.add)", time: "O(1) avg" },
      { op: "Remove (s.remove)", time: "O(1) avg" },
      { op: "Lookup (in)", time: "O(1) avg" },
      { op: "Union (| or .union)", time: "O(n + m)" },
      { op: "Intersection (& or .intersection)", time: "O(min(n, m))" },
    ],
  },
  {
    ds: "deque",
    operations: [
      { op: "Append right (.append)", time: "O(1)" },
      { op: "Append left (.appendleft)", time: "O(1)" },
      { op: "Pop right (.pop)", time: "O(1)" },
      { op: "Pop left (.popleft)", time: "O(1)" },
      { op: "Random access ([i])", time: "O(n)" },
    ],
  },
  {
    ds: "heapq",
    operations: [
      { op: "heappush(h, x)", time: "O(log n)" },
      { op: "heappop(h)", time: "O(log n)" },
      { op: "heapify(l)", time: "O(n)" },
      { op: "Peek min (h[0])", time: "O(1)" },
      { op: "nlargest / nsmallest", time: "O(n log k)" },
    ],
  },
];

function complexityColor(time: string) {
  if (time.startsWith("O(1)")) return "text-green-400";
  if (time.startsWith("O(log")) return "text-emerald-400";
  if (time.startsWith("O(n log")) return "text-yellow-400";
  return "text-orange-400";
}

function BigOReference() {
  const [selected, setSelected] = useState(0);
  const data = BIG_O_DATA[selected];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {BIG_O_DATA.map((d, i) => (
          <button
            key={d.ds}
            onClick={() => setSelected(i)}
            className={cn(
              "rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-colors",
              i === selected
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            )}
          >
            {d.ds}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/60">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                Operation
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                Complexity
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {data.operations.map(({ op, time, note }) => (
              <tr key={op} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5">
                  <code className="font-mono text-xs text-slate-300">{op}</code>
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn("font-mono text-xs font-semibold", complexityColor(time))}>
                    {time}
                  </span>
                  {note && <span className="ml-2 text-xs text-slate-600">— {note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-600">
        CPython implementation. &ldquo;avg&rdquo; = average case; worst case may differ due to hash collisions.
      </p>
    </div>
  );
}

// ─── Tool 2: Code Comparator ──────────────────────────────────────────────────

function CodeComparator() {
  const [conceptA, setConceptA] = useState("");
  const [conceptB, setConceptB] = useState("");
  const { result, loading, error, stream, reset } = useToolStream();

  async function compare() {
    if (!conceptA.trim() || !conceptB.trim() || loading) return;
    await stream(
      `Compare "${conceptA.trim()}" vs "${conceptB.trim()}" in Python`,
      `You are a Python programming expert creating a structured comparison for students.

Generate a clear markdown comparison between the two Python concepts the user provides.

Format:
1. One-sentence intro describing both concepts in context
2. A markdown table with columns: Aspect | ${conceptA} | ${conceptB}
   Include these rows: Definition, Syntax Example (short inline code), Mutability / Side Effects, Performance, Best Used When, Common Pitfall
3. A bold **Key Takeaway** line with the single most important distinction

Keep table cells concise (1–2 sentences or a short code snippet). No preamble before the intro.`
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
            placeholder="e.g. list"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Concept B</label>
          <input
            value={conceptB}
            onChange={(e) => { setConceptB(e.target.value); reset(); }}
            onKeyDown={(e) => e.key === "Enter" && compare()}
            placeholder="e.g. tuple"
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

// ─── Tool 3: Error Explainer ──────────────────────────────────────────────────

function ErrorExplainer() {
  const [traceback, setTraceback] = useState("");
  const { result, loading, error, stream, reset } = useToolStream();
  const charCount = traceback.length;

  async function explain() {
    if (!traceback.trim() || loading) return;
    await stream(
      traceback.trim(),
      `You are a Python debugging expert helping students understand errors.

The user will paste a Python error message or traceback. Structure your response with exactly these four markdown headers:

## Error Type
What kind of error this is (e.g. TypeError, IndexError, SyntaxError) and what it means in general.

## Root Cause
What specifically went wrong — reference the relevant line and explain why Python raised this error.

## How to Fix
A concrete fix with a corrected code snippet in a Python code block.

## How to Prevent
One or two best-practice tips to avoid this class of error in the future.

Keep each section concise (2–4 sentences). If the input is not a Python error, politely say so.`
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400">
            Paste your Python error or traceback
          </label>
          <span className={cn("text-xs", charCount > 2000 ? "text-red-400" : "text-slate-600")}>
            {charCount}/2000
          </span>
        </div>
        <textarea
          value={traceback}
          onChange={(e) => { setTraceback(e.target.value); reset(); }}
          placeholder={"Traceback (most recent call last):\n  File \"main.py\", line 5\n    print(my_list[10])\nIndexError: list index out of range"}
          rows={5}
          maxLength={2000}
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 font-mono text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
        />
      </div>

      <GenerateButton
        onClick={explain}
        loading={loading}
        disabled={!traceback.trim()}
        loadingLabel="Analyzing error…"
        label="Explain This Error"
        color="purple"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <ResultBox copyText={result} className="border-purple-900/40 bg-purple-900/10">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={proseMd}>
            {result}
          </ReactMarkdown>
        </ResultBox>
      )}
    </div>
  );
}

// ─── Tool 4: Project Builder ──────────────────────────────────────────────────

function ProjectBuilder() {
  const [project, setProject] = useState("");
  const { result, loading, error, stream, reset } = useToolStream();

  async function generate() {
    if (!project.trim() || loading) return;
    await stream(
      project.trim(),
      `You are a Python development mentor. The user will describe a Python project idea.

Generate a detailed, phase-by-phase build checklist using markdown task list syntax.

Format rules:
- Use "- [ ] Step" syntax for every task
- Group tasks under bold phase headers (e.g. **Phase 1: Project Setup**, **Phase 2: Core Logic**)
- Recommend specific Python libraries/tools where appropriate (e.g. requests, pandas, FastAPI, pytest)
- Each step must be specific and actionable — no vague steps like "do research"
- Add a realistic time estimate in parentheses at the end of each step, e.g. (30 min)
- Include 10–16 total steps across all phases
- Always end with a **Phase: Testing & Polish** section covering tests, README, and error handling

Output only the checklist. No preamble or closing remarks.`
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Describe your Python project
        </label>
        <input
          value={project}
          onChange={(e) => { setProject(e.target.value); reset(); }}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder="e.g. A web scraper that fetches news headlines and saves them to a CSV"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>

      <GenerateButton
        onClick={generate}
        loading={loading}
        disabled={!project.trim()}
        loadingLabel="Building your plan…"
        label="Generate Build Plan"
        color="green"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <ResultBox copyText={result} className="border-emerald-900/40 bg-emerald-900/10">
          <p className="mb-3 text-xs font-semibold text-emerald-400">Python Project Build Plan</p>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={checklistMd}>
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
    icon: Zap,
    title: "Big-O Reference",
    description:
      "Look up time complexity for Python's built-in data structures: list, dict, set, deque, and heapq.",
    accent: "bg-emerald-600",
    component: BigOReference,
  },
  {
    icon: ArrowLeftRight,
    title: "Code Comparator",
    description:
      "Enter any two Python concepts and Claude generates a structured side-by-side comparison with code examples.",
    accent: "bg-indigo-600",
    component: CodeComparator,
  },
  {
    icon: Bug,
    title: "Error Explainer",
    description:
      "Paste a Python traceback and Claude explains the error type, root cause, fix, and how to prevent it.",
    accent: "bg-purple-600",
    component: ErrorExplainer,
  },
  {
    icon: Hammer,
    title: "Project Builder",
    description:
      "Describe a Python project and Claude generates a phased build checklist with library recommendations.",
    accent: "bg-emerald-600",
    component: ProjectBuilder,
  },
];

export default function ToolsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
        <h1 className="text-sm font-semibold text-slate-100">Tools</h1>
        <p className="text-xs text-slate-500">
          Python-focused utilities for code, debugging, and learning
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
