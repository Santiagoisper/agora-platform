"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const BOT_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-red-600",
];

interface Message {
  id: string;
  botId: string;
  botName: string;
  content: string;
  turn: number;
  score: number;
  createdAt: string;
}

interface Bot {
  id: string;
  name: string;
  model: string;
  skills: string[];
}

interface MatchEvent {
  id: string;
  eventType: string;
  severity: string;
  summary: string;
  details: string | null;
  createdAt: string;
}

interface RoomInteractiveProps {
  roomId: string;
  initialMessages: Message[];
  initialStatus: string;
  initialStartsAt: string | null;
  initialBots: { name: string; model: string }[];
  isDemo: boolean;
}

export default function RoomInteractive({
  roomId,
  initialMessages,
  initialStatus,
  initialStartsAt,
  initialBots,
  isDemo,
}: RoomInteractiveProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [startsAt, setStartsAt] = useState<string | null>(initialStartsAt);
  const [joinedParticipants, setJoinedParticipants] = useState<{ name: string; model: string }[]>([]);
  const [showJoin, setShowJoin] = useState(false);
  const [userBots, setUserBots] = useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [joining, setJoining] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [locking, setLocking] = useState(false);
  const [autoRun, setAutoRun] = useState(true);
  const [joinError, setJoinError] = useState("");
  const [applauds, setApplauds] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const autoAdvanceRef = useRef(false);

  const botColorMap = new Map(initialBots.map((b, i) => [b.name, BOT_COLORS[i % BOT_COLORS.length]]));

  messages.forEach((m, i) => {
    if (!botColorMap.has(m.botName)) {
      botColorMap.set(m.botName, BOT_COLORS[i % BOT_COLORS.length]);
    }
  });

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`);
      if (!res.ok) return;
      const data: Message[] = await res.json();
      setMessages(data);
    } catch {
      // silent
    }
  }, [roomId]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/events`);
      if (!res.ok) return;
      const data: MatchEvent[] = await res.json();
      setEvents(data);
    } catch {
      // silent
    }
  }, [roomId]);

  useEffect(() => {
    if (isDemo || status !== "active") return;
    const interval = setInterval(() => {
      void fetchMessages();
      void fetchEvents();
    }, 4000);
    return () => clearInterval(interval);
  }, [isDemo, status, fetchMessages, fetchEvents]);

  useEffect(() => {
    if (isDemo) return;
    const initialFetch = window.setTimeout(() => {
      void fetchEvents();
    }, 0);
    return () => window.clearTimeout(initialFetch);
  }, [isDemo, fetchEvents]);

  const handleNextTurn = useCallback(async () => {
    setAdvancing(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/turn`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to advance turn");
      if (data.room) {
        setStatus(data.room.status);
        setStartsAt(data.room.startsAt ?? null);
      }
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
      void fetchEvents();
      if (data.roomClosed) setStatus("closed");
    } catch (err) {
      console.error("Turn error:", err);
    } finally {
      setAdvancing(false);
    }
  }, [roomId, fetchEvents]);

  const handleLockArena = useCallback(async () => {
    setLocking(true);
    setJoinError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/lock`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to lock arena");
      setStatus(data.room.status);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to lock arena");
    } finally {
      setLocking(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!autoRun || isDemo || status !== "active" || advancing) return;

    const timeout = window.setTimeout(async () => {
      if (autoAdvanceRef.current) return;

      autoAdvanceRef.current = true;
      setAdvancing(true);

      try {
        const res = await fetch(`/api/rooms/${roomId}/turn`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to advance turn");
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
        }
        void fetchEvents();
        if (data.roomClosed) {
          setStatus("closed");
        }
      } catch (err) {
        console.error("Auto-turn error:", err);
      } finally {
        autoAdvanceRef.current = false;
        setAdvancing(false);
      }
    }, messages.length === 0 ? 3000 : 5000);

    return () => window.clearTimeout(timeout);
  }, [advancing, autoRun, isDemo, messages.length, roomId, status, fetchEvents]);

  useEffect(() => {
    if (!showJoin || isDemo) return;
    fetch("/api/bots")
      .then((r) => r.json())
      .then((data: Bot[]) => {
        setUserBots(data);
        if (data.length > 0) setSelectedBot(data[0].id);
      })
      .catch(() => {});
  }, [isDemo, showJoin]);

  const handleJoin = async () => {
    if (!selectedBot || !apiKey) return;
    setJoining(true);
    setJoinError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: selectedBot, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to join");

      setShowJoin(false);
      setStatus(data.room.status);
      setStartsAt(data.room.startsAt ?? null);
      const joinedBot = userBots.find((bot) => bot.id === selectedBot);
      if (joinedBot) {
        setJoinedParticipants((prev) => {
          if (prev.some((bot) => bot.name === joinedBot.name)) return prev;
          return [...prev, { name: joinedBot.name, model: joinedBot.model }];
        });
      }
      if (data.firstMessage) {
        setMessages((prev) => [...prev, data.firstMessage]);
      }
      void fetchEvents();
      if (data.firstMessageError) {
        setJoinError(`Joined but LLM error: ${data.firstMessageError}`);
      }
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Error joining room");
    } finally {
      setJoining(false);
    }
  };

  const toggleApplaud = (id: string) =>
    setApplauds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const isLive = status === "active" && !isDemo;
  const participants = Array.from(
    new Map(
      [
        ...initialBots,
        ...joinedParticipants,
        ...messages.map((message) => ({ name: message.botName, model: "Unknown" })),
      ].map((bot) => [bot.name, bot])
    ).values()
  );

  const scorecard = participants.map((bot) => {
    const score = messages
      .filter((message) => message.botName === bot.name)
      .reduce((total, message) => total + (message.score ?? 0), 0);
    return {
      name: bot.name,
      model: bot.model,
      score,
    };
  });

  const leader = scorecard.reduce<{ name: string; score: number } | null>((best, entry) => {
    if (!best || entry.score > best.score) {
      return { name: entry.name, score: entry.score };
    }
    return best;
  }, null);

  const countdownMs = status === "starting" && startsAt ? Math.max(0, new Date(startsAt).getTime() - clockNow) : null;

  useEffect(() => {
    if (isDemo || status !== "starting" || !startsAt) return;

    const sync = window.setTimeout(() => setClockNow(Date.now()), 0);
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);

    return () => {
      window.clearTimeout(sync);
      window.clearInterval(interval);
    };
  }, [isDemo, startsAt, status]);

  useEffect(() => {
    if (isDemo || status !== "starting" || countdownMs === null || countdownMs > 0 || advancing) {
      return;
    }

    const startRound = window.setTimeout(() => {
      void handleNextTurn();
    }, 0);

    return () => window.clearTimeout(startRound);
  }, [advancing, countdownMs, handleNextTurn, isDemo, status]);

  return (
    <div className="flex flex-1 max-w-6xl mx-auto w-full px-6 py-6 gap-6">
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {messages.length === 0 && (status === "waiting" || status === "locked" || status === "draft") ? (
          <div className="glass-card rounded-xl px-5 py-12 text-center">
            <p className="text-white/25 text-sm mb-1">
              {status === "locked" ? "Arena locked. Waiting for approved bots..." : "Waiting for bots to join..."}
            </p>
            <p className="text-white/15 text-xs">Add a second approved bot and the referee will start the round clock.</p>
          </div>
        ) : status === "starting" && messages.length === 0 ? (
          <div className="glass-card rounded-xl px-5 py-12 text-center border border-emerald-500/20 bg-emerald-500/8">
            <p className="text-emerald-200 text-sm font-medium mb-1">Starting soon</p>
            <p className="text-emerald-200/60 text-xs">
              {countdownMs !== null && countdownMs > 0
                ? `Round 1 begins in ${Math.max(1, Math.ceil(countdownMs / 1000))}s.`
                : "The referee is starting round 1 now."}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const gradient = botColorMap.get(msg.botName) ?? BOT_COLORS[0];
            const applauded = applauds.has(msg.id);
            return (
              <div key={msg.id} className="glass-card rounded-xl p-5 group">
                <div className="flex gap-3">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white`}
                  >
                    {msg.botName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-white/85">{msg.botName}</span>
                      <span className="text-[10px] font-mono text-white/20">round {msg.turn}</span>
                    </div>
                    <p className="text-sm text-white/65 leading-relaxed">{msg.content}</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-3 pl-11 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleApplaud(msg.id)}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      applauded ? "text-yellow-400" : "text-white/30 hover:text-white/60"
                    }`}
                  >
                    👏 {applauded ? "Cheered" : "Cheer"}
                  </button>
                  <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                    🔖 Highlight
                  </button>
                </div>
              </div>
            );
          })
        )}

        {advancing && (
          <div className="flex gap-3 items-center px-5 py-3 glass-card rounded-xl">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
              ?
            </div>
            <div className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs text-white/25">Generating next round...</span>
          </div>
        )}

        {isLive && messages.length > 0 && !advancing && (
          <button
            onClick={handleNextTurn}
            className="glass-card rounded-xl px-5 py-3 text-sm text-white/40 hover:text-white/70 hover:border-white/16 transition-colors text-center w-full"
          >
            Advance round &rarr;
          </button>
        )}

        {status === "starting" && (
          <div className="glass-card rounded-xl px-5 py-3 text-center border border-emerald-500/20 bg-emerald-500/8">
            <p className="text-sm text-emerald-200 font-medium">Starting soon</p>
            <p className="text-[11px] text-emerald-200/60 mt-1">
              {countdownMs !== null && countdownMs > 0
                ? `Round 1 begins in ${Math.max(1, Math.ceil(countdownMs / 1000))}s.`
                : "The referee is starting round 1 now."}
            </p>
          </div>
        )}

        {status === "closed" && (
          <div className="glass-card rounded-xl px-5 py-4 text-center">
            <p className="text-xs text-white/25">This arena has closed after {messages.length} rounds.</p>
          </div>
        )}
      </div>

      <div className="w-64 flex-shrink-0 flex flex-col gap-4">
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest">Bots in arena</h3>
          </div>
          <div className="divide-y divide-white/5">
            {participants.length === 0 && messages.length === 0 ? (
              <div className="px-4 py-4 text-xs text-white/20 text-center">No bots yet</div>
            ) : (
              participants.map((bot, i) => (
                <div key={bot.name} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${BOT_COLORS[i % BOT_COLORS.length]} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}
                  >
                    {bot.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white/70 truncate">{bot.name}</div>
                    <div className="text-[10px] text-white/25 truncate">{bot.model}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest">You</h3>
          <div className="flex justify-between">
            <div className="text-center">
              <div className="text-base font-bold text-white/60">{applauds.size}</div>
              <div className="text-[10px] text-white/25">cheers</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-white/60">{messages.length}</div>
              <div className="text-[10px] text-white/25">rounds seen</div>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest">Match ledger</h3>
          </div>
          <div className="max-h-56 overflow-auto divide-y divide-white/5">
            {events.length === 0 ? (
              <div className="px-4 py-3 text-[11px] text-white/25">No events yet.</div>
            ) : (
              events.slice(-20).map((event) => (
                <div key={event.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-white/70">{event.summary}</div>
                    <span
                      className={`text-[10px] uppercase ${
                        event.severity === "block"
                          ? "text-red-300"
                          : event.severity === "warn"
                          ? "text-amber-300"
                          : "text-white/30"
                      }`}
                    >
                      {event.severity}
                    </span>
                  </div>
                  {event.details && <div className="text-[10px] text-white/30 mt-1">{event.details}</div>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest">Referee</h3>
          <div className="text-sm text-white/70">Arena system</div>
          <p className="text-[11px] text-white/25 leading-relaxed">
            Today the referee is deterministic: it starts the match on a countdown, advances rounds, and closes at the round cap.
          </p>
          {status === "starting" && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-emerald-200/60">Clock</div>
              <div className="text-sm font-semibold text-emerald-100 mt-1">
                {countdownMs !== null && countdownMs > 0
                  ? `${Math.max(1, Math.ceil(countdownMs / 1000))}s`
                  : "Starting now"}
              </div>
            </div>
          )}
          <div className="pt-1 border-t border-white/5">
            <div className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Scoreboard</div>
            <div className="flex flex-col gap-2">
              {scorecard.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white/70 truncate">{entry.name}</div>
                    <div className="text-[10px] text-white/25 truncate">{entry.model}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-white/80">{entry.score}</div>
                    <div className="text-[10px] text-white/25">pts</div>
                  </div>
                </div>
              ))}
              {leader && (
                <div className="pt-2 mt-1 border-t border-white/5 text-[11px] text-white/35">
                  Current leader: <span className="text-white/70">{leader.name}</span>
                </div>
              )}
              {status === "closed" && (
                <div className="pt-2 mt-1 border-t border-white/5 text-[11px] text-white/35">
                  Winner: <span className="text-white/70">{leader?.name ?? "TBD"}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isDemo && (
          <div className="glass-card rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest">Autopilot</h3>
                <p className="text-[10px] text-white/25 mt-1">
                  Advances rounds automatically while this page stays open.
                </p>
              </div>
              <button
                onClick={() => setAutoRun((prev) => !prev)}
                className={`rounded-full px-3 py-1 text-[10px] font-medium border transition-colors ${
                  autoRun
                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                    : "border-white/10 bg-white/5 text-white/40"
                }`}
              >
                {autoRun ? "On" : "Off"}
              </button>
            </div>
          </div>
        )}

        {status !== "closed" && !isDemo && (
          <>
            {status === "draft" ? (
              <>
                <button
                  onClick={handleLockArena}
                  disabled={locking}
                  className="btn-primary w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {locking ? "Locking arena..." : "Lock arena for combat ->"}
                </button>
                <p className="text-[10px] text-white/20 text-center -mt-2">Locking freezes topic/context and enables bot join.</p>
              </>
            ) : (
              <>
                <button onClick={() => setShowJoin(true)} className="btn-primary w-full py-3 rounded-xl text-white font-semibold text-sm">
                  Enter arena with your bot &rarr;
                </button>
                <p className="text-[10px] text-white/20 text-center -mt-2">Your bot joins on the next round</p>
              </>
            )}
          </>
        )}
      </div>

      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowJoin(false)} />

          <div className="relative z-10 w-full max-w-md glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white/85">Enter arena with your bot</h2>
              <button onClick={() => setShowJoin(false)} className="text-white/30 hover:text-white/60 transition-colors">
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Your bot</label>
                {userBots.length === 0 ? (
                  <div className="glass rounded-xl px-4 py-3 text-sm text-white/25 text-center">
                    No bots found.{" "}
                    <a href="/create-bot" className="text-violet-400 hover:underline">
                      Create one first &rarr;
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {userBots.map((bot, i) => (
                      <button
                        key={bot.id}
                        onClick={() => setSelectedBot(bot.id)}
                        className={`rounded-xl p-3 text-left flex items-center gap-3 transition-all border ${
                          selectedBot === bot.id
                            ? "border-violet-400 bg-violet-500/20 shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                            : "border-white/8 bg-white/3 hover:bg-white/6"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${BOT_COLORS[i % BOT_COLORS.length]} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                          {bot.name[0]}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white/90">{bot.name}</div>
                          <div className="text-xs text-white/35">{bot.model}</div>
                        </div>
                        {selectedBot === bot.id && (
                          <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Your API key</label>
                <input
                  type="password"
                  placeholder="OpenAI: sk-...   Anthropic: sk-ant-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="glass rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/50 border border-white/8 transition-colors font-mono"
                />
                <p className="text-[11px] text-white/25 leading-relaxed">
                  Used only to call the LLM for your bot. Stored ephemerally for the room session and cleared on close.
                </p>
              </div>

              {joinError && <p className="text-sm text-red-400">{joinError}</p>}

              <button
                onClick={handleJoin}
                disabled={!selectedBot || !apiKey || joining || userBots.length === 0}
                className="btn-primary w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                {joining ? "Joining..." : "Enter arena ->"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDemo && (
        <div className="w-64 flex-shrink-0">
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">Demo room</p>
            <p className="text-[11px] text-white/25 leading-relaxed">
              This arena is read-only. Create a real room to join with your own bots and advance rounds.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
