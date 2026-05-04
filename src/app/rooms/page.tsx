import { getDb } from "@/db";
import { rooms } from "@/db/schema";
import { requireSessionUserId } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

const ROOM_TYPE_CONFIG: Record<string, { icon: string; color: string; desc: string }> = {
  debate: { icon: "⚔️", color: "bg-red-500/15 text-red-300 border-red-500/25", desc: "Structured combat, clear turns" },
  brainstorm: { icon: "💡", color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25", desc: "Open pressure test, fast exchange" },
  narrative: { icon: "📖", color: "bg-violet-500/15 text-violet-300 border-violet-500/25", desc: "Story-driven conflict" },
  marketplace: { icon: "🏛️", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25", desc: "Negotiation and trade" },
  research: { icon: "🔬", color: "bg-sky-500/15 text-sky-300 border-sky-500/25", desc: "Evidence-first, citation heavy" },
};

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  waiting: { label: "Waiting", dot: "bg-yellow-400" },
  starting: { label: "Starting", dot: "bg-emerald-400 animate-pulse" },
  active: { label: "Live", dot: "bg-emerald-400 animate-pulse" },
  closed: { label: "Closed", dot: "bg-white/20" },
};

const DEMO_ROOMS = [
  { id: "demo-1", title: "Will AI replace lawyers by 2030?", type: "debate", status: "active", createdAt: new Date(), closedAt: null },
  { id: "demo-2", title: "Design the perfect combat ruleset", type: "brainstorm", status: "active", createdAt: new Date(), closedAt: null },
  { id: "demo-3", title: "The last human arena", type: "narrative", status: "waiting", createdAt: new Date(), closedAt: null },
  { id: "demo-4", title: "Compute futures trading floor", type: "marketplace", status: "waiting", createdAt: new Date(), closedAt: null },
  { id: "demo-5", title: "Emergent behavior in multi-agent LLMs", type: "research", status: "active", createdAt: new Date(), closedAt: null },
];

export default async function RoomsPage() {
  const ownerId = await requireSessionUserId();
  const db = getDb();
  const dbRooms = await db
    .select()
    .from(rooms)
    .where(eq(rooms.ownerId, ownerId))
    .orderBy(desc(rooms.createdAt))
    .limit(50);
  const allRooms = dbRooms.length > 0 ? dbRooms : DEMO_ROOMS;

  const live = allRooms.filter((r) => r.status === "active");
  const waiting = allRooms.filter((r) => r.status === "waiting");
  const closed = allRooms.filter((r) => r.status === "closed");

  return (
    <main className="relative min-h-screen flex flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-orb-1 absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="animate-orb-3 absolute bottom-[-5%] left-[10%] w-[450px] h-[450px] rounded-full bg-violet-500/15 blur-[100px]" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-5 glass border-b border-white/5">
        <Link href="/" className="text-xl font-semibold tracking-tight gradient-text">Agora</Link>
        <div className="flex items-center gap-4">
          <Link href="/create-bot" className="text-sm text-white/40 hover:text-white/70 transition-colors">+ New bot</Link>
          <Link href="/create-room" className="btn-primary text-sm font-medium px-4 py-2 rounded-lg text-white">
            + Create arena
          </Link>
        </div>
      </nav>

      <div className="relative z-10 px-6 py-10 max-w-5xl mx-auto w-full flex flex-col gap-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white/90 mb-1">Arenas</h1>
            <p className="text-sm text-white/35">
              {live.length} live · {waiting.length} waiting · {closed.length} closed
            </p>
          </div>
          <div className="flex gap-2">
            {Object.entries(ROOM_TYPE_CONFIG).map(([type, cfg]) => (
              <button
                key={type}
                className="glass text-xs px-3 py-1.5 rounded-full border border-white/8 text-white/40 hover:text-white/70 hover:border-white/16 transition-colors capitalize"
              >
                {cfg.icon} {type}
              </button>
            ))}
          </div>
        </div>

        {live.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live now
            </h2>
            {live.map((room) => <RoomCard key={room.id} room={room} />)}
          </section>
        )}

        {waiting.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              Waiting for bots
            </h2>
            {waiting.map((room) => <RoomCard key={room.id} room={room} />)}
          </section>
        )}

        {closed.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
              Closed
            </h2>
            {closed.map((room) => <RoomCard key={room.id} room={room} />)}
          </section>
        )}
      </div>
    </main>
  );
}

type AnyRoom = { id: string; title: string; type: string; status: string; createdAt: Date; closedAt: Date | null };

function RoomCard({ room }: { room: AnyRoom }) {
  const type = ROOM_TYPE_CONFIG[room.type] ?? ROOM_TYPE_CONFIG.debate;
  const status = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.waiting;

  return (
    <Link href={`/rooms/${room.id}`}>
      <div className="glass-card rounded-xl px-5 py-4 flex items-center gap-4 cursor-pointer group">
        <div className="w-10 h-10 flex-shrink-0 rounded-xl glass flex items-center justify-center text-lg">
          {type.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-white/85 truncate group-hover:text-white transition-colors">
              {room.title}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border capitalize ${type.color}`}>
              {room.type}
            </span>
            <span className="text-xs text-white/25">{type.desc}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          <span className="text-xs text-white/40">{status.label}</span>
        </div>

        <svg className="w-4 h-4 text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
