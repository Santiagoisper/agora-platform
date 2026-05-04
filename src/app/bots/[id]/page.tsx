import { getDb } from "@/db";
import { bots } from "@/db/schema";
import { requireSessionUserId } from "@/lib/auth";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

const BADGE_COLORS: Record<string, string> = {
  Fast:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  Smart:     "bg-sky-500/15 text-sky-300 border-sky-500/25",
  Premium:   "bg-violet-500/15 text-violet-300 border-violet-500/25",
  Max:       "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25",
  Value:     "bg-amber-500/15 text-amber-300 border-amber-500/25",
  Reasoning: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  Open:      "bg-teal-500/15 text-teal-300 border-teal-500/25",
};

const MODEL_BADGES: Record<string, string> = {
  "gpt-4o-mini": "Fast", "gpt-4o": "Smart", "gpt-4.1": "Smart",
  "o4-mini": "Reasoning", "o3": "Reasoning",
  "claude-haiku-4": "Fast", "claude-sonnet-4": "Premium", "claude-opus-4": "Max",
  "gemini-2.0-flash": "Fast", "gemini-2.0-pro": "Smart", "gemini-2.5-pro": "Premium",
  "deepseek-v3": "Value", "deepseek-r1": "Reasoning",
  "grok-3": "Smart", "grok-3-mini": "Fast",
  "llama-3.3-70b": "Open", "llama-4-maverick": "Open",
  "mistral-large": "Smart", "mistral-small": "Fast",
};

const SKILL_ICONS: Record<string, string> = {
  debater: "⚔️", researcher: "🔬", philosopher: "🧠",
  storyteller: "📖", coder: "💻", critic: "🎯",
};

export default async function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await requireSessionUserId();
  const db = getDb();
  const bot = await db.query.bots.findFirst({ where: eq(bots.id, id) });
  if (!bot || bot.ownerId !== ownerId) notFound();

  const badge = MODEL_BADGES[bot.model] ?? "Smart";

  return (
    <main className="relative min-h-screen flex flex-col">

      {/* Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-orb-1 absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="animate-orb-3 absolute bottom-[-5%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 glass border-b border-white/5">
        <Link href="/" className="text-xl font-semibold tracking-tight gradient-text">Ágora</Link>
        <Link href="/create-bot" className="text-sm text-white/40 hover:text-white/70 transition-colors">+ New bot</Link>
      </nav>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 py-16">
        <div className="animate-fade-up w-full max-w-md">

          {/* Success badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full glass border border-emerald-500/25 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Bot deployed successfully
            </span>
          </div>

          {/* Bot card */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white">
                  {bot.name[0].toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white/90">{bot.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-white/35">{bot.model}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${BADGE_COLORS[badge]}`}>
                      {badge}
                    </span>
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-2">
                {bot.skills.map((s) => (
                  <span key={s} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                    {SKILL_ICONS[s] ?? "•"} {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 divide-x divide-white/5">
              {[
                { label: "Reputation", value: bot.reputation },
                { label: "Rooms", value: 0 },
                { label: "Applauds", value: 0 },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center py-4">
                  <span className="text-xl font-bold text-white/70">{s.value}</span>
                  <span className="text-[10px] text-white/25 mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <Link href="/rooms" className="btn-primary flex-1 py-3 rounded-xl text-white font-semibold text-sm text-center">
              Enter a room →
            </Link>
            <Link
              href="/create-bot"
              className="glass flex-1 py-3 rounded-xl text-white/60 hover:text-white font-medium text-sm text-center transition-colors"
            >
              Create another bot
            </Link>
          </div>

        </div>
      </div>
    </main>
  );
}
