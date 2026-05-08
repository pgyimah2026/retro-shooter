"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Quiz history ─────────────────────────────────────────────────────────────

const QUIZ_HISTORY_KEY = "accttutor-quiz-history";

interface QuizScore {
  topic: string;
  score: number;
  total: number;
  pct: number;
  date: string;
}

function getQuizHistory(): QuizScore[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUIZ_HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQuizScore(entry: QuizScore) {
  const history = getQuizHistory();
  localStorage.setItem(
    QUIZ_HISTORY_KEY,
    JSON.stringify([entry, ...history].slice(0, 20))
  );
}

// ─── Skeleton shapes ──────────────────────────────────────────────────────────

function QuizSkeleton() {
  return (
    <div className="mt-6 animate-fade-in space-y-4">
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="mb-6 h-6 w-3/4" />
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

function FlashcardSkeleton() {
  return (
    <div className="mt-6 animate-fade-in space-y-5">
      <Skeleton className="h-56 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-11 rounded-xl" />
        <Skeleton className="h-11 rounded-xl" />
      </div>
    </div>
  );
}

function CaseStudySkeleton() {
  return (
    <div className="mt-6 animate-fade-in space-y-4">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-4 w-24" />
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ─── Local types ──────────────────────────────────────────────────────────────

interface QuizQuestion {
  id: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
  explanation: string;
}
interface Quiz {
  topic: string;
  questions: QuizQuestion[];
}

interface Flashcard {
  id: number;
  front: string;
  back: string;
}
interface FlashcardDeck {
  topic: string;
  cards: Flashcard[];
}

interface CaseQuestion {
  id: number;
  question: string;
  analysis: string;
}
interface CaseStudy {
  topic: string;
  title: string;
  scenario: string;
  questions: CaseQuestion[];
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function TopicInput({
  value,
  onChange,
  onGenerate,
  loading,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
  placeholder: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !loading && onGenerate()}
        placeholder={placeholder}
        disabled={loading}
        className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 disabled:opacity-50"
      />
      <button
        onClick={onGenerate}
        disabled={loading || !value.trim()}
        className={cn(
          "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors",
          loading || !value.trim()
            ? "cursor-not-allowed bg-slate-700 text-slate-500"
            : "bg-emerald-600 text-white hover:bg-emerald-500"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate
          </>
        )}
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-xl border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
      {message}
    </div>
  );
}

// ─── Quiz tab ─────────────────────────────────────────────────────────────────

function ScoreSummary({
  score,
  total,
  topic,
  onRetry,
  onNew,
}: {
  score: number;
  total: number;
  topic: string;
  onRetry: () => void;
  onNew: () => void;
}) {
  const pct = Math.round((score / total) * 100);
  const message =
    pct === 100
      ? "Perfect score! Outstanding work."
      : pct >= 80
      ? "Excellent! You've got a strong grasp of this topic."
      : pct >= 60
      ? "Good effort! A bit more practice and you'll nail it."
      : "Keep studying — every attempt builds understanding.";

  useEffect(() => {
    saveQuizScore({ topic, score, total, pct, date: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center py-10">
      <div
        className={cn(
          "flex h-28 w-28 items-center justify-center rounded-full text-3xl font-bold",
          pct === 100
            ? "bg-green-900/40 text-green-400 ring-4 ring-green-600/40"
            : pct >= 60
            ? "bg-emerald-900/40 text-emerald-400 ring-4 ring-emerald-600/40"
            : "bg-slate-800 text-slate-400 ring-4 ring-slate-700"
        )}
      >
        {score}/{total}
      </div>
      <p className="mt-5 text-lg font-semibold text-slate-100">{message}</p>
      <p className="mt-1 text-sm text-slate-500">You scored {pct}%</p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
        >
          <RotateCcw className="h-4 w-4" />
          Try Again
        </button>
        <button
          onClick={onNew}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
        >
          <Sparkles className="h-4 w-4" />
          New Quiz
        </button>
      </div>
    </div>
  );
}

function QuizView({ quiz, onReset }: { quiz: Quiz; onReset: () => void }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [done, setDone] = useState(false);

  const q = quiz.questions[current];
  const selected = answers[q.id];
  const answered = selected !== undefined;
  const score = quiz.questions.filter((x) => answers[x.id] === x.correct).length;

  function pick(opt: string) {
    if (answered) return;
    setAnswers((prev) => ({ ...prev, [q.id]: opt }));
  }

  function next() {
    if (current < quiz.questions.length - 1) setCurrent((c) => c + 1);
    else setDone(true);
  }

  if (done) {
    return (
      <ScoreSummary
        score={score}
        total={quiz.questions.length}
        topic={quiz.topic}
        onRetry={() => { setAnswers({}); setCurrent(0); setDone(false); }}
        onNew={onReset}
      />
    );
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-1.5 rounded-full bg-emerald-600 transition-all"
            style={{ width: `${((current + (answered ? 1 : 0)) / quiz.questions.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-slate-500">
          {current + 1} / {quiz.questions.length}
        </span>
      </div>

      <p className="mb-6 text-base font-medium leading-relaxed text-slate-100">{q.question}</p>

      <div className="space-y-3">
        {(["A", "B", "C", "D"] as const).map((key) => {
          const isCorrect = key === q.correct;
          const isSelected = key === selected;
          return (
            <button
              key={key}
              onClick={() => pick(key)}
              disabled={answered}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all",
                !answered && "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-emerald-600/60 hover:bg-slate-800 hover:text-slate-100",
                answered && isCorrect && "border-green-600 bg-green-900/30 text-green-300",
                answered && isSelected && !isCorrect && "border-red-600 bg-red-900/30 text-red-300",
                answered && !isSelected && !isCorrect && "border-slate-800 bg-slate-800/30 text-slate-600"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                  !answered && "bg-slate-700 text-slate-300",
                  answered && isCorrect && "bg-green-600 text-white",
                  answered && isSelected && !isCorrect && "bg-red-600 text-white",
                  answered && !isSelected && !isCorrect && "bg-slate-800 text-slate-600"
                )}
              >
                {key}
              </span>
              <span className="leading-relaxed">{q.options[key]}</span>
              {answered && isCorrect && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-400" />}
              {answered && isSelected && !isCorrect && <XCircle className="ml-auto h-4 w-4 shrink-0 text-red-400" />}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Explanation</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{q.explanation}</p>
        </div>
      )}

      {answered && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={next}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            {current < quiz.questions.length - 1 ? "Next Question →" : "See Results →"}
          </button>
        </div>
      )}
    </div>
  );
}

function QuizHistory() {
  const [history, setHistory] = useState<QuizScore[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setHistory(getQuizHistory());
  }, []);

  if (history.length === 0) return null;

  return (
    <div className="mt-8 border-t border-slate-800 pt-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300"
      >
        <History className="h-3.5 w-3.5" />
        Recent Scores ({history.length})
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-3 space-y-1.5">
          {history.map((h, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2"
            >
              <div>
                <p className="text-xs font-medium text-slate-300">{h.topic}</p>
                <p className="text-[10px] text-slate-600">
                  {new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <span
                className={cn(
                  "font-mono text-xs font-bold",
                  h.pct >= 80 ? "text-green-400" : h.pct >= 60 ? "text-yellow-400" : "text-red-400"
                )}
              >
                {h.score}/{h.total} ({h.pct}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuizTab() {
  const [topic, setTopic] = useState("");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    setQuiz(null);
    try {
      const res = await fetch("/api/study/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate quiz");
      setQuiz(data as Quiz);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <TopicInput
        value={topic}
        onChange={setTopic}
        onGenerate={generate}
        loading={loading}
        placeholder="e.g. Debits and credits, Balance sheet, Financial ratios…"
      />
      {error && <ErrorBanner message={error} />}
      {loading && <QuizSkeleton />}
      {quiz && !loading && (
        <div className="mt-8 animate-fade-in">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-semibold text-slate-100">{quiz.topic}</h3>
            <button onClick={() => setQuiz(null)} className="text-xs text-slate-500 hover:text-slate-300">
              ← Change topic
            </button>
          </div>
          <QuizView key={quiz.topic} quiz={quiz} onReset={() => setQuiz(null)} />
        </div>
      )}
      {!quiz && !loading && !error && (
        <div className="mt-16 text-center text-sm text-slate-600">
          Enter an accounting topic above and click Generate to create a 5-question quiz.
        </div>
      )}
      <QuizHistory />
    </div>
  );
}

// ─── Flashcards tab — spaced repetition ──────────────────────────────────────

function FlashcardView({ deck, onNewDeck }: { deck: FlashcardDeck; onNewDeck: () => void }) {
  const [remaining, setRemaining] = useState(() => deck.cards.map((c) => c.id));
  const [mastered, setMastered] = useState<number[]>([]);
  const [flipped, setFlipped] = useState(false);

  const total = deck.cards.length;
  const done = remaining.length === 0;
  const card = done ? null : deck.cards.find((c) => c.id === remaining[0])!;

  function gotIt() {
    setMastered((prev) => [...prev, remaining[0]]);
    setRemaining((prev) => prev.slice(1));
    setFlipped(false);
  }

  function stillLearning() {
    setRemaining((prev) => [...prev.slice(1), prev[0]]);
    setFlipped(false);
  }

  function restart() {
    setRemaining(deck.cards.map((c) => c.id));
    setMastered([]);
    setFlipped(false);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-10">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-900/40 text-2xl font-bold text-emerald-400 ring-4 ring-emerald-600/40">
          {total}/{total}
        </div>
        <p className="mt-5 text-lg font-semibold text-slate-100">Deck Complete!</p>
        <p className="mt-1 text-sm text-slate-500">You mastered all {total} cards.</p>
        <div className="mt-8 flex gap-3">
          <button
            onClick={restart}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
          >
            <RotateCcw className="h-4 w-4" />
            Restart
          </button>
          <button
            onClick={onNewDeck}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            <Sparkles className="h-4 w-4" />
            New Deck
          </button>
        </div>
      </div>
    );
  }

  const progress = mastered.length / total;

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-1.5 rounded-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-slate-500">{mastered.length}/{total} mastered</span>
        <span className="shrink-0 text-xs text-slate-600">{remaining.length} left</span>
      </div>

      {/* Card */}
      <div
        className="cursor-pointer [perspective:1200px]"
        onClick={() => setFlipped((f) => !f)}
        title="Click to flip"
      >
        <div
          className={cn(
            "relative h-56 w-full rounded-2xl [transform-style:preserve-3d] transition-transform duration-500",
            flipped && "[transform:rotateY(180deg)]"
          )}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 px-8 py-6 [backface-visibility:hidden]">
            <span className="mb-3 rounded-full bg-emerald-600/20 px-3 py-1 text-xs font-medium text-emerald-400">
              Term
            </span>
            <p className="text-center text-lg font-semibold leading-snug text-slate-100">{card!.front}</p>
            <p className="mt-4 text-xs text-slate-600">Click to reveal answer</p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-emerald-700/50 bg-emerald-900/30 px-8 py-6 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="mb-3 rounded-full bg-emerald-600/20 px-3 py-1 text-xs font-medium text-emerald-400">
              Answer
            </span>
            <p className="text-center text-sm leading-relaxed text-slate-200">{card!.back}</p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-slate-600">Flip the card, then rate yourself below</p>

      {/* Spaced repetition buttons */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={stillLearning}
          className="flex items-center justify-center gap-2 rounded-xl border border-orange-800/50 bg-orange-900/20 px-4 py-3 text-sm font-medium text-orange-300 transition-colors hover:bg-orange-900/40"
        >
          <RotateCcw className="h-4 w-4" />
          Still Learning
        </button>
        <button
          onClick={gotIt}
          className="flex items-center justify-center gap-2 rounded-xl border border-green-800/50 bg-green-900/20 px-4 py-3 text-sm font-medium text-green-300 transition-colors hover:bg-green-900/40"
        >
          <CheckCircle2 className="h-4 w-4" />
          Got It ✓
        </button>
      </div>
    </div>
  );
}

function FlashcardsTab() {
  const [topic, setTopic] = useState("");
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    setDeck(null);
    try {
      const res = await fetch("/api/study/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate flashcards");
      setDeck(data as FlashcardDeck);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <TopicInput
        value={topic}
        onChange={setTopic}
        onGenerate={generate}
        loading={loading}
        placeholder="e.g. Accounting terminology, Financial ratios, GAAP principles…"
      />
      {error && <ErrorBanner message={error} />}
      {loading && <FlashcardSkeleton />}
      {deck && !loading && (
        <div className="mt-8 animate-fade-in">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-semibold text-slate-100">{deck.topic}</h3>
            <button onClick={() => setDeck(null)} className="text-xs text-slate-500 hover:text-slate-300">
              ← Change topic
            </button>
          </div>
          <FlashcardView key={deck.topic} deck={deck} onNewDeck={() => setDeck(null)} />
        </div>
      )}
      {!deck && !loading && !error && (
        <div className="mt-16 text-center text-sm text-slate-600">
          Enter an accounting topic above and click Generate to create 8 flashcards.
        </div>
      )}
    </div>
  );
}

// ─── Case Studies tab ─────────────────────────────────────────────────────────

function CaseStudyView({ cs }: { cs: CaseStudy }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-100">{cs.title}</h3>
      <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scenario</p>
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-300">{cs.scenario}</p>
      </div>

      <div className="mt-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Guided Questions</p>
        {cs.questions.map((q) => {
          const open = expanded.has(q.id);
          return (
            <div key={q.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/40">
              <div className="flex items-start gap-3 p-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-xs font-bold text-emerald-400">
                  {q.id}
                </span>
                <p className="flex-1 text-sm font-medium leading-relaxed text-slate-200">{q.question}</p>
                <button
                  onClick={() => toggle(q.id)}
                  className="ml-2 flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
                >
                  {open ? (
                    <><ChevronUp className="h-3.5 w-3.5" />Hide Analysis</>
                  ) : (
                    <><ChevronDown className="h-3.5 w-3.5" />Show Analysis</>
                  )}
                </button>
              </div>
              {open && (
                <div className="border-t border-slate-700 bg-slate-900/60 px-4 py-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-500">
                    Suggested Analysis
                  </p>
                  <p className="text-sm leading-relaxed text-slate-300">{q.analysis}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CaseStudiesTab() {
  const [topic, setTopic] = useState("");
  const [cs, setCs] = useState<CaseStudy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    setCs(null);
    try {
      const res = await fetch("/api/study/case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate case study");
      setCs(data as CaseStudy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <TopicInput
        value={topic}
        onChange={setTopic}
        onGenerate={generate}
        loading={loading}
        placeholder="e.g. Recording a credit sale, Depreciation methods, Inventory valuation…"
      />
      {error && <ErrorBanner message={error} />}
      {loading && <CaseStudySkeleton />}
      {cs && !loading && (
        <div className="mt-8 animate-fade-in">
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">{cs.topic}</span>
            <button onClick={() => setCs(null)} className="text-xs text-slate-500 hover:text-slate-300">
              ← Change topic
            </button>
          </div>
          <CaseStudyView key={cs.title} cs={cs} />
        </div>
      )}
      {!cs && !loading && !error && (
        <div className="mt-16 text-center text-sm text-slate-600">
          Enter an accounting scenario above and click Generate to create a case study with guided questions.
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "quizzes" | "flashcards" | "casestudies";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "quizzes", label: "Quizzes", emoji: "🧠" },
  { id: "flashcards", label: "Flashcards", emoji: "🃏" },
  { id: "casestudies", label: "Case Studies", emoji: "📋" },
];

export default function StudyPage() {
  const [tab, setTab] = useState<Tab>("quizzes");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
        <h1 className="text-sm font-semibold text-slate-100">Study</h1>
        <p className="text-xs text-slate-500">AI-generated accounting quizzes, flashcards, and case studies</p>
      </div>

      <div className="shrink-0 overflow-x-auto border-b border-slate-800 px-2 sm:px-4">
        <div className="flex min-w-max gap-0.5">
          {TABS.map(({ id, label, emoji }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:gap-2 sm:px-4",
                tab === id
                  ? "border-emerald-500 text-slate-100"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              <span>{emoji}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-2xl">
          {tab === "quizzes" && <QuizTab />}
          {tab === "flashcards" && <FlashcardsTab />}
          {tab === "casestudies" && <CaseStudiesTab />}
        </div>
      </div>
    </div>
  );
}
