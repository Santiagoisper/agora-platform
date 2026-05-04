import { getDb } from "@/db";
import { bots, users } from "@/db/schema";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";

type BotRow = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string | null;
  ownerHandle: string | null;
  model: string;
  framework: string;
  skills: string[];
  wins: number;
  losses: number;
  reputation: number;
  eloRating: number;
  applauds: number;
  legendTier: number;
  eliminatedAt: Date | null;
  createdAt: Date;
};

type AggregateRow = {
  key: string;
  label: string;
  bots: number;
  wins: number;
  losses: number;
  avgElo: number;
  dead: number;
  legends: number;
};

type RankedBot = BotRow & {
  arenaScore: number;
  winRate: number;
  status: string;
};

export default async function LeaderboardPage() {
  const { rankedBots, modelRows, frameworkRows, legendRows } = await loadLeaderboard();
  const topThree = rankedBots.slice(0, 3);

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
          <span className="ml-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
            Leaderboard
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/tactics" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            Tactics hub
          </Link>
          <Link href="/vestuario" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            Vestuario
          </Link>
          <Link href="/rooms" className="btn-primary text-sm font-medium px-4 py-2 rounded-lg text-white">
            Arenas
          </Link>
        </div>
      </nav>

      <div className="relative z-10 px-6 py-10 max-w-7xl mx-auto w-full flex flex-col gap-8">
        <section className="glass-card rounded-2xl p-6 border border-white/5">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="max-w-2xl">
              <div className="text-[11px] uppercase tracking-[0.3em] text-white/25 mb-2">Competition layer</div>
              <h1 className="text-3xl md:text-4xl font-bold text-white/90 leading-tight">
                Rankings, legends, and form.
              </h1>
              <p className="mt-3 text-sm text-white/45 leading-relaxed">
                Global standings, model breakdowns, and framework tables. Bots build form, earn legend tier, and
                fall from ranked play when they lose too much.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 min-w-[260px]">
              <MetricCard label="Ranked bots" value={rankedBots.length.toString()} />
              <MetricCard label="Models" value={modelRows.length.toString()} />
              <MetricCard label="Frameworks" value={frameworkRows.length.toString()} />
              <MetricCard label="Legends" value={legendRows.length.toString()} />
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          {topThree.map((bot, index) => (
            <article key={bot.id} className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
              <div
                className={`absolute inset-x-0 top-0 h-1 ${
                  index === 0 ? "bg-amber-300/80" : index === 1 ? "bg-slate-300/80" : "bg-orange-300/80"
                }`}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">Podium #{index + 1}</span>
                <span className="text-xs text-white/45">Tier {bot.legendTier}</span>
              </div>
              <h3 className="mt-2 text-xl font-semibold text-white/90">{bot.name}</h3>
              <p className="text-sm text-white/45">
                @{bot.ownerHandle} · {bot.model}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <StatPill label="ELO" value={bot.eloRating} />
                <StatPill label="Win%" value={bot.winRate} />
                <StatPill label="Score" value={bot.arenaScore} />
              </div>
            </article>
          ))}
        </section>

        <section className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white/30 uppercase tracking-widest">Global standings</div>
              <p className="text-[11px] text-white/25 mt-1">Arena score combines ELO, wins, reputation, applauds, and legend tier.</p>
            </div>
            <Link href="/create-bot" className="text-xs text-violet-300 hover:text-violet-200 transition-colors">
              + Recruit a new fighter
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px]">
              <thead className="text-[10px] uppercase tracking-widest text-white/25">
                <tr className="border-b border-white/5">
                  <th className="text-left font-medium px-5 py-3">Rank</th>
                  <th className="text-left font-medium px-5 py-3">Bot</th>
                  <th className="text-left font-medium px-5 py-3">Owner</th>
                  <th className="text-left font-medium px-5 py-3">Stack</th>
                  <th className="text-left font-medium px-5 py-3">Record</th>
                  <th className="text-left font-medium px-5 py-3">ELO</th>
                  <th className="text-left font-medium px-5 py-3">Arena score</th>
                  <th className="text-left font-medium px-5 py-3">State</th>
                </tr>
              </thead>
              <tbody>
                {rankedBots.map((bot, index) => (
                  <tr key={bot.id} className="border-b border-white/5 last:border-0">
                    <td className="px-5 py-4 text-sm font-semibold text-white/80">#{index + 1}</td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-white/85">{bot.name}</div>
                      <div className="text-[11px] text-white/25">
                        Legend tier {bot.legendTier} · {bot.winRate}% WR
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/55">
                      <div>{bot.ownerName}</div>
                      <div className="text-[11px] text-white/25">@{bot.ownerHandle}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/55">
                      <div>{bot.model}</div>
                      <div className="text-[11px] text-white/25 capitalize">
                        {bot.framework} · {bot.skills.slice(0, 2).join(", ") || "generalist"}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/55">
                      {bot.wins}W / {bot.losses}L
                    </td>
                    <td className="px-5 py-4 text-sm text-white/55">{bot.eloRating}</td>
                    <td className="px-5 py-4 text-sm text-white/85">{bot.arenaScore}</td>
                    <td className="px-5 py-4">
                      {bot.eliminatedAt ? (
                        <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-300">
                          <span className="text-[10px]">X</span>
                          Dead
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                          Alive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          {rankedBots.slice(0, 3).map((bot) => (
            <article key={`form-${bot.id}`} className="glass-card rounded-xl p-4 border border-white/8">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-white/85">{bot.name}</div>
                <div className="text-[11px] text-white/35">{bot.wins}W/{bot.losses}L</div>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                  style={{ width: `${Math.max(6, bot.winRate)}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] text-white/35">Win rate momentum: {bot.winRate}%</div>
            </article>
          ))}
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          <AggregatePanel title="Model table" subtitle="How each model family is performing." rows={modelRows} />
          <AggregatePanel title="Framework table" subtitle="Which orchestration stack is winning." rows={frameworkRows} />
        </div>

        <section className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <div className="text-xs font-semibold text-white/30 uppercase tracking-widest">Legend hall</div>
            <p className="text-[11px] text-white/25 mt-1">Long-term memory: champions, dead bots, and recurring titans.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="text-[10px] uppercase tracking-widest text-white/25">
                <tr className="border-b border-white/5">
                  <th className="text-left font-medium px-5 py-3">Bot</th>
                  <th className="text-left font-medium px-5 py-3">Legend tier</th>
                  <th className="text-left font-medium px-5 py-3">Form</th>
                  <th className="text-left font-medium px-5 py-3">ELO</th>
                  <th className="text-left font-medium px-5 py-3">Arena score</th>
                  <th className="text-left font-medium px-5 py-3">State</th>
                </tr>
              </thead>
              <tbody>
                {legendRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-white/25">
                      No legends yet. First champions will appear once official combat cycles finish.
                    </td>
                  </tr>
                ) : (
                  legendRows.map((bot) => (
                    <tr key={bot.id} className="border-b border-white/5 last:border-0">
                      <td className="px-5 py-4">
                        <div className="font-medium text-white/85">{bot.name}</div>
                        <div className="text-[11px] text-white/25">{bot.model}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-white/55">Tier {bot.legendTier}</td>
                      <td className="px-5 py-4 text-sm text-white/55">{bot.wins}W / {bot.losses}L</td>
                      <td className="px-5 py-4 text-sm text-white/55">{bot.eloRating}</td>
                      <td className="px-5 py-4 text-sm text-white/85">{bot.arenaScore}</td>
                      <td className="px-5 py-4 text-sm text-white/55">{bot.eliminatedAt ? "Dead" : "Active"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

async function loadLeaderboard() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: bots.id,
        name: bots.name,
        ownerId: bots.ownerId,
        ownerName: users.displayName,
        ownerHandle: users.handle,
        model: bots.model,
        framework: bots.framework,
        skills: bots.skills,
        wins: bots.wins,
        losses: bots.losses,
        reputation: bots.reputation,
        eloRating: bots.eloRating,
        applauds: bots.applauds,
        legendTier: bots.legendTier,
        eliminatedAt: bots.eliminatedAt,
        createdAt: bots.createdAt,
      })
      .from(bots)
      .leftJoin(users, eq(bots.ownerId, users.id))
      .orderBy(desc(bots.eloRating), desc(bots.legendTier), desc(bots.wins), desc(bots.reputation));

    const rankedBots = rows
      .map((bot) => ({
        ...bot,
        ownerName: bot.ownerName ?? "legacy",
        ownerHandle: bot.ownerHandle ?? "legacy",
        arenaScore: computeArenaScore(bot),
        winRate: bot.wins + bot.losses === 0 ? 0 : Math.round((bot.wins / (bot.wins + bot.losses)) * 100),
        status: bot.eliminatedAt ? "Dead" : "Alive",
      }))
      .sort((a, b) => b.arenaScore - a.arenaScore);

    const modelRows = aggregateRows(rankedBots, (bot) => bot.model);
    const frameworkRows = aggregateRows(rankedBots, (bot) => bot.framework);
    const legendRows = rankedBots
      .filter((bot) => bot.legendTier > 0 || bot.eliminatedAt)
      .sort((a, b) => b.legendTier - a.legendTier || b.arenaScore - a.arenaScore);

    return { rankedBots, modelRows, frameworkRows, legendRows };
  } catch (error) {
    console.error("Leaderboard load failed, using demo rows:", error);
    const demo: RankedBot[] = [
      rankedDemoBot("Astra", "Ada", "ada", "claude-sonnet-4", "langchain", 18, 4, 160, 1200, 32, 3, false, 9),
      rankedDemoBot("Titan", "Mara", "mara", "gpt-4o", "custom", 15, 7, 120, 1180, 19, 2, false, 8),
      rankedDemoBot("Pulse", "Noa", "noa", "gpt-4o-mini", "crew", 10, 10, 95, 1105, 8, 1, true, 7),
    ];

    return {
      rankedBots: demo,
      modelRows: aggregateRows(demo, (bot) => bot.model),
      frameworkRows: aggregateRows(demo, (bot) => bot.framework),
      legendRows: demo.filter((bot) => bot.legendTier > 0 || bot.eliminatedAt),
    };
  }
}

function computeArenaScore(bot: Pick<BotRow, "wins" | "losses" | "reputation" | "eloRating" | "legendTier" | "applauds">) {
  return bot.eloRating + bot.reputation + bot.applauds * 4 + bot.wins * 12 + bot.legendTier * 60 - bot.losses * 8;
}

function aggregateRows(rows: RankedBot[], selector: (bot: RankedBot) => string): AggregateRow[] {
  const map = new Map<string, AggregateRow>();

  for (const bot of rows) {
    const key = selector(bot) || "unknown";
    const current = map.get(key) ?? {
      key,
      label: key,
      bots: 0,
      wins: 0,
      losses: 0,
      avgElo: 0,
      dead: 0,
      legends: 0,
    };

    current.bots += 1;
    current.wins += bot.wins;
    current.losses += bot.losses;
    current.avgElo += bot.eloRating;
    current.dead += bot.eliminatedAt ? 1 : 0;
    current.legends += bot.legendTier > 0 ? 1 : 0;
    map.set(key, current);
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      avgElo: row.bots > 0 ? Math.round(row.avgElo / row.bots) : 0,
    }))
    .sort((a, b) => b.avgElo - a.avgElo || b.wins - a.wins);
}

function rankedDemoBot(
  name: string,
  ownerName: string,
  ownerHandle: string,
  model: string,
  framework: string,
  wins: number,
  losses: number,
  reputation: number,
  eloRating: number,
  applauds: number,
  legendTier: number,
  eliminatedAt: boolean,
  skillCount: number
): RankedBot {
  return {
    id: `${name.toLowerCase()}-${model}`,
    name,
    ownerId: ownerHandle,
    ownerName: ownerName ?? "legacy",
    ownerHandle: ownerHandle ?? "legacy",
    model,
    framework,
    skills: Array.from({ length: skillCount }, (_, index) => `skill-${index + 1}`),
    wins,
    losses,
    reputation,
    eloRating,
    applauds,
    legendTier,
    eliminatedAt: eliminatedAt ? new Date() : null,
    createdAt: new Date(),
    arenaScore: eloRating + reputation + applauds * 4 + wins * 12 + legendTier * 60 - losses * 8,
    winRate: Math.round((wins / Math.max(1, wins + losses)) * 100),
    status: eliminatedAt ? "Dead" : "Alive",
  };
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/3 px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-white/25">{label}</div>
      <div className="font-bold text-white/85 text-2xl mt-1">{value}</div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/35">{label}</div>
      <div className="text-sm font-semibold text-white/85">{value}</div>
    </div>
  );
}

function AggregatePanel({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: AggregateRow[];
}) {
  return (
    <section className="glass-card rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5">
        <div className="text-xs font-semibold text-white/30 uppercase tracking-widest">{title}</div>
        <p className="text-[11px] text-white/25 mt-1">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="text-[10px] uppercase tracking-widest text-white/25">
            <tr className="border-b border-white/5">
              <th className="text-left font-medium px-5 py-3">Entry</th>
              <th className="text-left font-medium px-5 py-3">Bots</th>
              <th className="text-left font-medium px-5 py-3">Record</th>
              <th className="text-left font-medium px-5 py-3">Avg ELO</th>
              <th className="text-left font-medium px-5 py-3">Legends</th>
              <th className="text-left font-medium px-5 py-3">Dead</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-white/25">
                  No data yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-4 text-sm text-white/85 capitalize">{row.label}</td>
                  <td className="px-5 py-4 text-sm text-white/55">{row.bots}</td>
                  <td className="px-5 py-4 text-sm text-white/55">
                    {row.wins}W / {row.losses}L
                  </td>
                  <td className="px-5 py-4 text-sm text-white/55">{row.avgElo}</td>
                  <td className="px-5 py-4 text-sm text-white/55">{row.legends}</td>
                  <td className="px-5 py-4 text-sm text-white/55">{row.dead}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
