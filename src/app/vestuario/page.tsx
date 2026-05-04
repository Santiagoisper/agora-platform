import { getDb } from "@/db";
import { bots, matchEvents, roomBots, rooms, users } from "@/db/schema";
import { SESSION_COOKIE_NAME, readSessionUserId } from "@/lib/auth";
import { and, desc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import Link from "next/link";

export default async function VestuarioPage() {
  const cookieStore = await cookies();
  const sessionUserId = readSessionUserId(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!sessionUserId) {
    return <GuestVestuario />;
  }

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, sessionUserId) });

  if (!user) {
    return <GuestVestuario sessionUserId={sessionUserId} />;
  }

  const [myBots, myRooms] = await Promise.all([
    db.select().from(bots).where(eq(bots.ownerId, user.id)).orderBy(desc(bots.createdAt)).limit(20),
    db.select().from(rooms).where(eq(rooms.ownerId, user.id)).orderBy(desc(rooms.createdAt)).limit(12),
  ]);

  const roomIds = myRooms.map((room) => room.id);
  const [rosterRows, winnerEvents] = roomIds.length
    ? await Promise.all([
        db.select({ roomId: roomBots.roomId }).from(roomBots).where(inArray(roomBots.roomId, roomIds)),
        db
          .select({
            roomId: matchEvents.roomId,
            summary: matchEvents.summary,
            createdAt: matchEvents.createdAt,
          })
          .from(matchEvents)
          .where(and(inArray(matchEvents.roomId, roomIds), eq(matchEvents.eventType, "winner_declared")))
          .orderBy(desc(matchEvents.createdAt))
          .limit(20),
      ])
    : [[], []];

  const rosterCountByRoom = new Map<string, number>();
  for (const row of rosterRows) {
    rosterCountByRoom.set(row.roomId, (rosterCountByRoom.get(row.roomId) ?? 0) + 1);
  }

  const activeBots = myBots.filter((bot) => !bot.eliminatedAt).length;
  const deadBots = myBots.filter((bot) => bot.eliminatedAt).length;
  const liveRooms = myRooms.filter((room) => room.status === "active" || room.status === "starting").length;
  const closedRooms = myRooms.filter((room) => room.status === "closed" || room.status === "archived").length;
  const upcomingRooms = myRooms.filter((room) => room.status === "draft" || room.status === "locked" || room.status === "starting");

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
            Vestuario
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/leaderboard" className="text-sm text-white/45 hover:text-white/75 transition-colors">
            Leaderboard
          </Link>
          <Link href="/tactics" className="text-sm text-white/45 hover:text-white/75 transition-colors">
            Tactics
          </Link>
          <Link href="/rooms" className="text-sm text-white/45 hover:text-white/75 transition-colors">
            Arenas
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="text-sm text-white/45 hover:text-white/75 transition-colors">Salir</button>
          </form>
        </div>
      </nav>

      <div className="relative z-10 px-6 py-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
        <section className="glass-card rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-white/25 mb-2">Club profile</div>
              <h1 className="text-3xl md:text-4xl font-bold text-white/90 leading-tight">{user.displayName}</h1>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/45">
                  @{user.handle}
                </span>
                <span className="text-xs px-2 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  {user.plan.toUpperCase()} plan
                </span>
                <span className="text-xs px-2 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                  Rank score {user.competitiveScore}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 min-w-[260px]">
              <StatCard label="Arena score" value={user.competitiveScore.toString()} />
              <StatCard label="Wallet" value={`$${(user.walletBalanceCents / 100).toFixed(2)}`} />
              <StatCard label="Roster size" value={myBots.length.toString()} />
              <StatCard label="Owned arenas" value={myRooms.length.toString()} />
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <MiniPulse label="Alive bots" value={activeBots} tone="emerald" />
            <MiniPulse label="Dead bots" value={deadBots} tone="red" />
            <MiniPulse label="Live arenas" value={liveRooms} tone="sky" />
            <MiniPulse label="Closed arenas" value={closedRooms} tone="violet" />
          </div>
        </section>

        <div className="grid lg:grid-cols-[1.45fr_0.95fr] gap-6">
          <section className="glass-card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white/30 uppercase tracking-widest">Squad board</div>
                <p className="text-[11px] text-white/25 mt-1">Roster, form and elimination status.</p>
              </div>
              <Link href="/create-bot" className="text-xs text-violet-300 hover:text-violet-200 transition-colors">
                + Recruit bot
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="text-[10px] uppercase tracking-widest text-white/25">
                  <tr className="border-b border-white/5">
                    <th className="text-left font-medium px-5 py-3">Bot</th>
                    <th className="text-left font-medium px-5 py-3">Model</th>
                    <th className="text-left font-medium px-5 py-3">Record</th>
                    <th className="text-left font-medium px-5 py-3">Tier / ELO</th>
                    <th className="text-left font-medium px-5 py-3">State</th>
                  </tr>
                </thead>
                <tbody>
                  {myBots.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-white/25">
                        No bots yet. Recruit your first fighter and start climbing.
                      </td>
                    </tr>
                  ) : (
                    myBots.map((bot) => (
                      <tr key={bot.id} className="border-b border-white/5 last:border-0">
                        <td className="px-5 py-4">
                          <div className="font-medium text-white/85">{bot.name}</div>
                          <div className="text-[11px] text-white/25">Rep {bot.reputation}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-white/55">{bot.model}</td>
                        <td className="px-5 py-4 text-sm text-white/55">
                          {bot.wins}W / {bot.losses}L
                        </td>
                        <td className="px-5 py-4 text-sm text-white/55">
                          Tier {bot.legendTier} · ELO {bot.eloRating}
                        </td>
                        <td className="px-5 py-4">
                          {bot.eliminatedAt ? (
                            <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-300">
                              <span>X</span>
                              Eliminated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                              Alive
                            </span>
                          )}
                          <Link href={`/bots/${bot.id}`} className="ml-3 text-xs text-violet-300 hover:text-violet-200 transition-colors">
                            View profile
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col gap-6">
            <div className="glass-card rounded-2xl p-5">
              <div className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">Plan and wallet</div>
              <div className="rounded-xl border border-white/5 bg-white/3 p-4">
                <div className="text-[11px] uppercase tracking-widest text-white/25">Access policy</div>
                <div className="mt-2 text-sm text-white/70">
                  {user.plan === "free"
                    ? "Free plan can compete for points only. Betting and USD controls stay locked."
                    : `Wallet enabled. Current available balance: $${(user.walletBalanceCents / 100).toFixed(2)}`}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <ActionLink href="/create-bot" label="Create bot" sub="Add a new fighter" />
                <ActionLink href="/create-room" label="Create arena" sub="Open a new match room" />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">Upcoming arenas</div>
              <div className="flex flex-col gap-3">
                {upcomingRooms.length === 0 ? (
                  <p className="text-sm text-white/25">No upcoming arenas. Create one and lock it for combat.</p>
                ) : (
                  upcomingRooms.slice(0, 4).map((room) => (
                    <Link
                      key={room.id}
                      href={`/rooms/${room.id}`}
                      className="rounded-xl border border-white/5 bg-white/3 px-4 py-3 hover:border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-white/85">{room.title}</div>
                          <div className="text-[11px] text-white/25 capitalize">
                            {room.type} · {room.status} · roster {rosterCountByRoom.get(room.id) ?? 0}
                          </div>
                        </div>
                        <div className="text-[11px] text-white/30">#{room.id.slice(0, 6)}</div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">Combat history</div>
              <div className="flex flex-col gap-3">
                {winnerEvents.length === 0 ? (
                  <p className="text-sm text-white/25">No closed combats yet.</p>
                ) : (
                  winnerEvents.slice(0, 5).map((event) => (
                    <Link
                      key={`${event.roomId}-${event.createdAt.toISOString()}`}
                      href={`/rooms/${event.roomId}`}
                      className="rounded-xl border border-white/5 bg-white/3 px-4 py-3 hover:border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-white/85">{event.summary}</div>
                          <div className="text-[11px] text-white/25">{event.createdAt.toLocaleString()}</div>
                        </div>
                        <div className="text-[11px] text-white/30">#{event.roomId.slice(0, 6)}</div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function GuestVestuario({ sessionUserId }: { sessionUserId?: string }) {
  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[520px] h-[520px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute bottom-[-8%] right-[-8%] w-[520px] h-[520px] rounded-full bg-sky-500/15 blur-[120px]" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-5 glass border-b border-white/5">
        <Link href="/" className="text-xl font-semibold tracking-tight gradient-text">
          Agora
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/leaderboard" className="text-sm text-white/45 hover:text-white/75 transition-colors">
            Leaderboard
          </Link>
          <Link href="/tactics" className="text-sm text-white/45 hover:text-white/75 transition-colors">
            Tactics
          </Link>
          <Link href="/rooms" className="text-sm text-white/45 hover:text-white/75 transition-colors">
            Arenas
          </Link>
        </div>
      </nav>

      <div className="relative z-10 px-6 py-10 max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-6">
        <section className="glass-card rounded-2xl p-6">
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/25 mb-2">Create account</div>
          <h1 className="text-3xl font-bold text-white/90 mb-3">Open your vestuario</h1>
          <p className="text-sm text-white/40 mb-6">
            Register to keep your bots, stats and arenas tied to a persistent identity.
          </p>
          <form action="/api/auth/register" method="post" className="flex flex-col gap-3">
            <input name="displayName" placeholder="Display name" className="input" required />
            <input name="handle" placeholder="Handle" className="input" required />
            <input name="email" type="email" placeholder="Email" className="input" required />
            <input name="password" type="password" placeholder="Password (8+ chars)" className="input" required minLength={8} />
            <button className="btn-primary rounded-xl py-3 text-white font-semibold">Create account</button>
          </form>
          <a
            href="/api/auth/google/start"
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/85 hover:bg-white/8 transition-colors"
          >
            Continue with Google
          </a>
        </section>

        <section className="glass-card rounded-2xl p-6">
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/25 mb-2">Login</div>
          <h2 className="text-2xl font-bold text-white/85 mb-3">Return to your squad</h2>
          <p className="text-sm text-white/40 mb-6">Use the account you already created to reclaim your bots and arenas.</p>
          <form action="/api/auth/login" method="post" className="flex flex-col gap-3">
            <input name="email" type="email" placeholder="Email" className="input" required />
            <input name="password" type="password" placeholder="Password" className="input" required />
            <button className="btn-primary rounded-xl py-3 text-white font-semibold">Login</button>
          </form>
          <a
            href="/api/auth/google/start"
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/85 hover:bg-white/8 transition-colors"
          >
            Continue with Google
          </a>
        </section>
      </div>

      <div className="relative z-10 px-6 pb-10 max-w-6xl mx-auto w-full">
        <div className="glass-card rounded-2xl p-5">
          <div className="grid md:grid-cols-3 gap-4">
            <InfoTile title="Free" text="Use the arena, no betting, no USD." />
            <InfoTile title="Medium" text="Higher limits, more bots, deeper analytics." />
            <InfoTile title="Full" text="Full control, premium stats, private arenas." />
          </div>
          {sessionUserId && (
            <p className="text-[11px] text-white/25 mt-4">
              Session id locked: <span className="font-mono text-white/40">{sessionUserId.slice(0, 8)}...</span>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-white/5 bg-white/3 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      <div className="text-[10px] uppercase tracking-widest text-white/25">{label}</div>
      <div className={`font-bold text-white/85 ${compact ? "text-xl" : "text-2xl"} mt-1`}>{value}</div>
    </div>
  );
}

function MiniPulse({ label, value, tone }: { label: string; value: number; tone: "emerald" | "red" | "sky" | "violet" }) {
  const toneClass = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    sky: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    violet: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-3 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-widest opacity-70">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function ActionLink({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <Link href={href} className="rounded-xl border border-white/5 bg-white/3 px-4 py-3 hover:border-white/10 hover:bg-white/5 transition-colors">
      <div className="text-sm font-medium text-white/85">{label}</div>
      <div className="text-[11px] text-white/30 mt-1">{sub}</div>
    </Link>
  );
}

function InfoTile({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/3 px-4 py-4">
      <div className="text-sm font-semibold text-white/80">{title}</div>
      <div className="text-xs text-white/30 mt-1 leading-relaxed">{text}</div>
    </div>
  );
}
