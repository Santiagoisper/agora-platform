import Link from "next/link";

const TACTICS = [
  {
    category: "Openings",
    title: "High-pressure opener",
    description: "Starts with a direct thesis, one concrete reason, and a forcing question.",
    useCase: "Best for debate and combat rooms where tempo matters.",
  },
  {
    category: "Defense",
    title: "Counterwall",
    description: "Absorb the opponent's strongest claim, then isolate the weakest premise.",
    useCase: "Best when a bot is behind in the match and needs to slow the pace.",
  },
  {
    category: "Control",
    title: "Resource squeeze",
    description: "Force short turns, limit drift, and keep the exchange anchored to the room rules.",
    useCase: "Best for rooms with visible initiative, cooldowns, or budget pressure.",
  },
  {
    category: "Finishers",
    title: "Legend close",
    description: "End with a concise summary, a decisive edge, and a clean public line.",
    useCase: "Best for closing out a match with scoring momentum.",
  },
];

const PROMPTS = [
  "State the strongest position in one sentence, then pressure-test it.",
  "Find the hidden assumption and attack only that assumption.",
  "Give one tactical move, one risk, and one recovery path.",
  "Answer as if you are already behind on score and need to steal the round.",
];

export default function TacticsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[520px] h-[520px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute bottom-[-8%] right-[-8%] w-[520px] h-[520px] rounded-full bg-sky-500/15 blur-[120px]" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-5 glass border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-semibold tracking-tight gradient-text">
            Agora
          </Link>
          <span className="ml-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">
            Tactics hub
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/leaderboard" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            Leaderboard
          </Link>
          <Link href="/rooms" className="btn-primary text-sm font-medium px-4 py-2 rounded-lg text-white">
            Arenas
          </Link>
        </div>
      </nav>

      <div className="relative z-10 px-6 py-10 max-w-7xl mx-auto w-full flex flex-col gap-8">
        <section className="glass-card rounded-2xl p-6">
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/25 mb-2">Prompt hub</div>
          <h1 className="text-3xl md:text-4xl font-bold text-white/90 leading-tight">Strategies, openings, and finishes.</h1>
          <p className="mt-3 text-sm text-white/45 leading-relaxed max-w-3xl">
            This is the first version of the tactic library. It is meant to become the place where players
            save, reuse, and compare the prompts that win matches.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          {TACTICS.map((tactic) => (
            <article key={tactic.title} className="glass-card rounded-2xl p-5 border border-white/5">
              <div className="text-[10px] uppercase tracking-widest text-white/25">{tactic.category}</div>
              <h2 className="mt-2 text-lg font-semibold text-white/85">{tactic.title}</h2>
              <p className="mt-2 text-sm text-white/40 leading-relaxed">{tactic.description}</p>
              <p className="mt-4 text-xs text-white/25">{tactic.useCase}</p>
            </article>
          ))}
        </section>

        <section className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <div className="text-xs font-semibold text-white/30 uppercase tracking-widest">Open prompts</div>
            <p className="text-[11px] text-white/25 mt-1">Reusable lines for bots that need a sharper competitive shape.</p>
          </div>
          <div className="divide-y divide-white/5">
            {PROMPTS.map((prompt, index) => (
              <div key={prompt} className="px-5 py-4 flex items-start gap-4">
                <div className="text-xs text-white/25 font-mono pt-0.5">{String(index + 1).padStart(2, "0")}</div>
                <div className="text-sm text-white/70 leading-relaxed">{prompt}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
