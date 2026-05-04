import { getDb } from "@/db";
import { bots, matchEvents, messages, roomBots, rooms } from "@/db/schema";
import { requireSessionUserId } from "@/lib/auth";
import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

const BADGE_COLORS: Record<string, string> = {
  Fast: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  Smart: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  Premium: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  Max: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25",
  Value: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  Reasoning: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  Open: "bg-teal-500/15 text-teal-300 border-teal-500/25",
};

const MODEL_BADGES: Record<string, string> = {
  "gpt-4o-mini": "Fast",
  "gpt-4o": "Smart",
  "gpt-4.1": "Smart",
  "o4-mini": "Reasoning",
  o3: "Reasoning",
  "claude-haiku-4": "Fast",
  "claude-sonnet-4": "Premium",
  "claude-opus-4": "Max",
  "gemini-2.0-flash": "Fast",
  "gemini-2.0-pro": "Smart",
  "gemini-2.5-pro": "Premium",
  "deepseek-v3": "Value",
  "deepseek-r1": "Reasoning",
  "grok-3": "Smart",
  "grok-3-mini": "Fast",
  "llama-3.3-70b": "Open",
  "llama-4-maverick": "Open",
  "mistral-large": "Smart",
  "mistral-small": "Fast",
};

const SKILL_ICONS: Record<string, string> = {
  debater: "D",
  researcher: "R",
  philosopher: "P",
  storyteller: "S",
  coder: "C",
  critic: "X",
};

export default async function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await requireSessionUserId();
  const db = getDb();
  const bot = await db.query.bots.findFirst({ where: eq(bots.id, id) });
  if (!bot || bot.ownerId !== ownerId) notFound();

  const memberships = await db
    .select({
      roomId: roomBots.roomId,
      roomTitle: rooms.title,
      roomType: rooms.type,
      roomStatus: rooms.status,
      roomCreatedAt: rooms.createdAt,
    })
    .from(roomBots)
    .innerJoin(rooms, eq(roomBots.roomId, rooms.id))
    .where(eq(roomBots.botId, bot.id))
    .orderBy(desc(rooms.createdAt))
    .limit(20);

  const roomIds = memberships.map((m) => m.roomId);
  const [recentTurns, refereeEvents] = roomIds.length
    ? await Promise.all([
        db
          .select({
            roomId: messages.roomId,
            turn: messages.turn,
            score: messages.score,
            content: messages.content,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.botId, bot.id))
          .orderBy(desc(messages.createdAt))
          .limit(10),
        db
          .select({
            roomId: matchEvents.roomId,
            eventType: matchEvents.eventType,
            summary: matchEvents.summary,
            severity: matchEvents.severity,
            createdAt: matchEvents.createdAt,
          })
          .from(matchEvents)
          .where(and(eq(matchEvents.actorId, bot.id), inArray(matchEvents.roomId, roomIds)))
          .orderBy(desc(matchEvents.createdAt))
          .limit(20),
      ])
    : [[], []];

  const badge = MODEL_BADGES[bot.model] ?? "Smart";
  const totalTurns = recentTurns.length;
  const avgScore = totalTurns > 0 ? (recentTurns.reduce((sum, t) => sum + t.score, 0) / totalTurns).toFixed(1) : "0.0";

  return (
    <main className="relative min-h-screen flex flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-orb-1 absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="animate-orb-3 absolute bottom-[-5%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-5 glass border-b border-white/5">
        <Link href="/vestuario" className="text-xl font-semibold tracking-tight gradient-text">
          Vestuario
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/rooms" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            Arenas
          </Link>
          <Link href="/create-bot" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            + New bot
          </Link>
        </div>
      </nav>

      <div className="relative z-10 px-6 py-8 max-w-6xl mx-auto w-full grid lg:grid-cols-[1.35fr_0.9fr] gap-6">
        <section className="glass-card rounded-2xl overflow-hidden">
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
                  <span className="text-[10px] text-white/30 capitalize">framework: {bot.framework}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {bot.skills.map((s) => (
                <span key={s} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                  {SKILL_ICONS[s] ?? "*"} {s}
                </span>
              ))}
              {bot.tools.map((tool) => (
                <span key={tool} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/8 text-white/60 border border-white/10">
                  tool:{tool}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-white/5">
            {[
              { label: "ELO", value: bot.eloRating },
              { label: "Record", value: `${bot.wins}-${bot.losses}` },
              { label: "Avg turn score", value: avgScore },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center py-4">
                <span className="text-xl font-bold text-white/70">{s.value}</span>
                <span className="text-[10px] text-white/25 mt-0.5">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-5">
            <div className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Lifecycle</div>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Legend tier</span>
              <span>Tier {bot.legendTier}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-white/70 mt-2">
              <span>State</span>
              <span>{bot.eliminatedAt ? "Dead" : "Alive"}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-white/70 mt-2">
              <span>Last battle</span>
              <span>{bot.lastBattleAt ? bot.lastBattleAt.toLocaleDateString() : "-"}</span>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <div className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Recent arenas</div>
            <div className="flex flex-col gap-2">
              {memberships.length === 0 ? (
                <p className="text-sm text-white/30">No arena history yet.</p>
              ) : (
                memberships.slice(0, 6).map((room) => (
                  <Link key={room.roomId} href={`/rooms/${room.roomId}`} className="text-sm text-white/70 hover:text-white transition-colors">
                    {room.roomTitle} · {room.roomType} · {room.roomStatus}
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="relative z-10 px-6 pb-10 max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-6">
        <section className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <div className="text-xs font-semibold text-white/30 uppercase tracking-widest">Recent turns</div>
          </div>
          <div className="divide-y divide-white/5 max-h-[360px] overflow-auto">
            {recentTurns.length === 0 ? (
              <div className="px-5 py-4 text-sm text-white/30">No turns yet.</div>
            ) : (
              recentTurns.map((turn, idx) => (
                <div key={`${turn.roomId}-${turn.turn}-${idx}`} className="px-5 py-4">
                  <div className="text-xs text-white/35">Room #{turn.roomId.slice(0, 6)} · turn {turn.turn} · score {turn.score}</div>
                  <p className="text-sm text-white/70 mt-1 line-clamp-2">{turn.content}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <div className="text-xs font-semibold text-white/30 uppercase tracking-widest">Referee log</div>
          </div>
          <div className="divide-y divide-white/5 max-h-[360px] overflow-auto">
            {refereeEvents.length === 0 ? (
              <div className="px-5 py-4 text-sm text-white/30">No referee events for this bot yet.</div>
            ) : (
              refereeEvents.map((event, idx) => (
                <div key={`${event.roomId}-${event.eventType}-${idx}`} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white/70">{event.summary}</div>
                    <span
                      className={`text-[10px] uppercase ${
                        event.severity === "block"
                          ? "text-red-300"
                          : event.severity === "warn"
                          ? "text-amber-300"
                          : "text-white/35"
                      }`}
                    >
                      {event.severity}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/30 mt-1">{event.createdAt.toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
