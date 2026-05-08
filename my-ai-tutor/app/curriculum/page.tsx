"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Persistence ──────────────────────────────────────────────────────────────

const COMPLETION_KEY = "accttutor-curriculum-complete";

function getCompleted(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const arr = JSON.parse(localStorage.getItem(COMPLETION_KEY) ?? "[]");
    return new Set<number>(arr);
  } catch {
    return new Set();
  }
}

function persistCompleted(ids: Set<number>) {
  localStorage.setItem(COMPLETION_KEY, JSON.stringify(Array.from(ids)));
}

// ─── Module data ──────────────────────────────────────────────────────────────

interface Module {
  id: number;
  title: string;
  description: string;
  topics: string[];
  chatPrompt: string;
}

const MODULES: Module[] = [
  {
    id: 1,
    title: "The Accounting Equation",
    description: "Understand the foundation of all accounting: Assets = Liabilities + Equity.",
    topics: ["Assets, liabilities, and equity defined", "How every transaction preserves balance", "Impact on the balance sheet", "Double-entry bookkeeping overview"],
    chatPrompt: "Teach me about the accounting equation (Assets = Liabilities + Equity). Start with a clear definition, then show me how 3 different transactions affect each side with examples.",
  },
  {
    id: 2,
    title: "Debits & Credits",
    description: "Master the rules of debits and credits across all five account types.",
    topics: ["Normal balance for each account type", "DEAD CLIC mnemonic", "How debits and credits increase/decrease accounts", "T-account basics"],
    chatPrompt: "Teach me the rules of debits and credits. Explain the normal balance for assets, liabilities, equity, revenue, and expenses — then show me a worked example for each.",
  },
  {
    id: 3,
    title: "Journal Entries",
    description: "Record any business transaction using the double-entry journal entry format.",
    topics: ["Journal entry format and structure", "Cash vs credit transactions", "Compound journal entries", "Common transaction types"],
    chatPrompt: "Teach me how to write journal entries. Explain the format, then walk me through 5 common transactions: a cash sale, a credit purchase, an owner investment, an expense payment, and a loan repayment.",
  },
  {
    id: 4,
    title: "The Trial Balance",
    description: "Verify that total debits equal total credits before preparing statements.",
    topics: ["Purpose and structure of a trial balance", "How to prepare one from the ledger", "Errors it catches vs errors it misses", "Unadjusted vs adjusted trial balance"],
    chatPrompt: "Teach me about the trial balance. What is it, how is it prepared, what errors does it detect, and what errors can slip through undetected?",
  },
  {
    id: 5,
    title: "Adjusting Entries",
    description: "Record accruals, deferrals, and depreciation at period end under accrual accounting.",
    topics: ["Accrued revenues and expenses", "Deferred revenues and expenses", "Depreciation (straight-line & declining balance)", "Why adjustments are required"],
    chatPrompt: "Teach me about adjusting entries. Explain all four types — accrued revenue, accrued expense, deferred revenue, deferred expense — with a journal entry example for each. Then cover depreciation.",
  },
  {
    id: 6,
    title: "Financial Statements",
    description: "Understand the three core statements and how they connect to each other.",
    topics: ["Income statement structure", "Balance sheet layout", "Statement of cash flows (direct & indirect)", "How the three statements link together"],
    chatPrompt: "Teach me about the three financial statements. Explain what each one shows, its structure, and how the income statement, balance sheet, and cash flow statement are connected.",
  },
  {
    id: 7,
    title: "Financial Ratios",
    description: "Analyse company performance using liquidity, profitability, and leverage ratios.",
    topics: ["Current ratio & quick ratio", "Return on assets & return on equity", "Debt-to-equity ratio", "Gross & net profit margin"],
    chatPrompt: "Teach me about the most important financial ratios. Cover the key liquidity, profitability, and leverage ratios: the formula for each, what it means, and what a healthy value looks like.",
  },
  {
    id: 8,
    title: "The Accounting Cycle",
    description: "Walk through the complete 8-step process from transaction to closing entries.",
    topics: ["Identify and analyse transactions", "Post to the general ledger", "Prepare adjusted trial balance", "Close temporary accounts"],
    chatPrompt: "Walk me through the complete accounting cycle step by step. Cover all 8 steps from identifying transactions to closing entries, and explain how each step leads to the next.",
  },
];

// ─── Module card ──────────────────────────────────────────────────────────────

function ModuleCard({
  module,
  completed,
  onToggle,
  onStudy,
}: {
  module: Module;
  completed: boolean;
  onToggle: () => void;
  onStudy: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-slate-900 transition-colors",
        completed ? "border-emerald-800/60" : "border-slate-800"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Number badge */}
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
            completed ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
          )}
        >
          {module.id}
        </div>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">{module.title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{module.description}</p>
        </div>

        {/* Completion toggle */}
        <button
          onClick={onToggle}
          title={completed ? "Mark incomplete" : "Mark complete"}
          className="shrink-0 text-slate-600 transition-colors hover:text-slate-300"
        >
          {completed ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Topics */}
      <div className="border-t border-slate-800/60 px-5 py-3">
        <ul className="space-y-1">
          {module.topics.map((t) => (
            <li key={t} className="flex items-start gap-2 text-xs text-slate-500">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-700" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="mt-auto flex gap-2 border-t border-slate-800/60 px-5 py-3">
        <button
          onClick={onStudy}
          className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
        >
          Study in Chat →
        </button>
        <button
          onClick={onToggle}
          className={cn(
            "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
            completed
              ? "border-emerald-800/60 text-emerald-500 hover:border-emerald-700"
              : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
          )}
        >
          {completed ? "Completed ✓" : "Mark Done"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CurriculumPage() {
  const router = useRouter();
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  useEffect(() => {
    setCompleted(getCompleted());
  }, []);

  function toggle(id: number) {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistCompleted(next);
      return next;
    });
  }

  function studyInChat(prompt: string) {
    sessionStorage.setItem("accttutor-starter", prompt);
    router.push("/");
  }

  const doneCount = completed.size;
  const total = MODULES.length;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-emerald-500" />
          <h1 className="text-sm font-semibold text-slate-100">Curriculum</h1>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          8 core accounting modules — work through them in order or jump to any topic
        </p>

        {/* Progress bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-1.5 rounded-full bg-emerald-600 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-slate-500">
            {doneCount}/{total} complete
          </span>
        </div>
      </div>

      {/* Module grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
          {MODULES.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              completed={completed.has(module.id)}
              onToggle={() => toggle(module.id)}
              onStudy={() => studyInChat(module.chatPrompt)}
            />
          ))}
        </div>

        {doneCount === total && (
          <div className="mt-8 rounded-2xl border border-emerald-800/60 bg-emerald-900/20 px-6 py-6 text-center">
            <p className="text-2xl">🎓</p>
            <p className="mt-2 text-sm font-semibold text-emerald-300">
              You&apos;ve completed all 8 modules!
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Head to Study to test yourself, or use Tools to practise journal entries and ratios.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
