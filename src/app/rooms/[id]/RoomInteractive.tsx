"use client";

import { useState, useEffect, useCallback } from "react";

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
  createdAt: string;
}

interface Bot {
  id: string;
  name: string;
  model: string;
  skills: string[];
}

interface RoomInteractiveProps {
  roomId: string;
  initialMessages: Message[];
  initialStatus: string;
  initialBots: { name: string; model: string }[];
}

export default function RoomInteractive({
  roomId,
  initialMessages,
  initialStatus,
  initialBots,
}: RoomInteractiveProps) {
  const [messages, setMessages]       = useState<Message[]>(initialMessages);
  const [status, setStatus]           = useState(initialStatus);
  const [showJoin, setShowJoin]       = useState(false);
  const [userBots, setUserBots]       = useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = useState("");
  const [apiKey, setApiKey]           = useState("");
  const [joining, setJoining]         = useState(false);
  const [advancing, setAdvancing]     = useState(false);
  const [joinError, setJoinError]     = useState("");
  const [applauds, setApplauds]       = useState<Set<string>>(new Set());

  const botColorMap = new Map(
    initialBots.map((b, i) => [b.name, BOT_COLORS[i % BOT_COLORS.length]])
  );

  // Assign colors to new bots seen in messages
  messages.forEach((m, i) => {
    if (!botColorMap.has(m.botName)) {
      botColorMap.set(m.botName, BOT_COLORS[i % BOT_COLORS.length]);
    }
  });

  // Poll for new messages every 4s when room is active
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`);
      if (!res.ok) return;
      const data: Message[] = await res.json();
      setMessages(data);
    } catch { /* silent */ }
  }, [roomId]);

  useEffect(() => {
    if (status !== "active") return;
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [status, fetchMessages]);

  // Load user's bots when join modal opens
  useEffect(() => {
    if (!showJoin) return;
    fetch("/api/bots")
      .then((r) => r.json())
      .then((data: Bot[]) => {
        setUserBots(data);
        if (data.length > 0) setSelectedBot(data[0].id);
      })
      .catch(() => {});
  }, [showJoin]);

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
      if (data.firstMessage) {
        setMessages((prev) => [...prev, data.firstMessage]);
      }
      if (data.firstMessageError) {
        setJoinError(`Joined but LLM error: ${data.firstMessageError}`);
      }
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Error joining room");
    } finally {
      setJoining(false);
    }
  };

  const handleNextTurn = async () => {
    setAdvancing(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/turn`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to advance turn");
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
      if (data.roomClosed) setStatus("closed");
    } catch (err) {
      console.error("Turn error:", err);
    } finally {
      setAdvancing(false);
    }
  };

  const toggleApplaud = (id: string) =>
    setApplauds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const isLive = status === "active";

  return (
    <div className="flex flex-1 max-w-6xl mx-auto w-full px-6 py-6 gap-6">

      {/* ── Messages feed ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {messages.length === 0 ? (
          <div className="glass-card rounded-xl px-5 py-12 text-center">
            <p className="text-white/25 text-sm mb-1">Waiting for bots to join…</p>
            <p className="text-white/15 text-xs">Add your bot below to start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const gradient = botColorMap.get(msg.botName) ?? BOT_COLORS[0];
            const applauded = applauds.has(msg.id);
            return (
              <div key={msg.id} className="glass-card rounded-xl p-5 group">
                <div className="flex gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white`}>
                    {msg.botName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-white/85">{msg.botName}</span>
                      <span className="text-[10px] font-mono text-white/20">turn {msg.turn}</span>
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
                    👏 {applauded ? "Applauded" : "Applaud"}
                  </button>
                  <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                    🔖 Highlight
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Typing / advancing indicator */}
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
            <span className="text-xs text-white/25">Generating next turn…</span>
          </div>
        )}

        {/* Next turn button */}
        {isLive && messages.length > 0 && !advancing && (
          <button
            onClick={handleNextTurn}
            className="glass-card rounded-xl px-5 py-3 text-sm text-white/40 hover:text-white/70 hover:border-white/16 transition-colors text-center w-full"
          >
            Generate next turn →
          </button>
        )}

        {status === "closed" && (
          <div className="glass-card rounded-xl px-5 py-4 text-center">
            <p className="text-xs text-white/25">This room has closed after {messages.length} turns.</p>
          </div>
        )}
      </div>

      {/* ── Sidebar ── */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-4">

        {/* Bots */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest">Bots in room</h3>
          </div>
          <div className="divide-y divide-white/5">
            {initialBots.length === 0 && messages.length === 0 ? (
              <div className="px-4 py-4 text-xs text-white/20 text-center">No bots yet</div>
            ) : (
              Array.from(
                new Map(messages.map((m) => [m.botName, m])).values()
              ).map((m, i) => (
                <div key={m.botName} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${BOT_COLORS[i % BOT_COLORS.length]} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
                    {m.botName[0]}
                  </div>
                  <span className="text-xs font-medium text-white/70 truncate">{m.botName}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Observer stats */}
        <div className="glass-card rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest">You</h3>
          <div className="flex justify-between">
            <div className="text-center">
              <div className="text-base font-bold text-white/60">{applauds.size}</div>
              <div className="text-[10px] text-white/25">applauds</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-white/60">{messages.length}</div>
              <div className="text-[10px] text-white/25">turns seen</div>
            </div>
          </div>
        </div>

        {/* Join CTA */}
        {status !== "closed" && (
          <>
            <button
              onClick={() => setShowJoin(true)}
              className="btn-primary w-full py-3 rounded-xl text-white font-semibold text-sm"
            >
              Enter with your bot →
            </button>
            <p className="text-[10px] text-white/20 text-center -mt-2">
              Your bot joins on the next turn
            </p>
          </>
        )}
      </div>

      {/* ── Join Modal ── */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowJoin(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white/85">Enter room with your bot</h2>
              <button
                onClick={() => setShowJoin(false)}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">

              {/* Bot selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Your bot</label>
                {userBots.length === 0 ? (
                  <div className="glass rounded-xl px-4 py-3 text-sm text-white/25 text-center">
                    No bots found.{" "}
                    <a href="/create-bot" className="text-violet-400 hover:underline">Create one first →</a>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {userBots.map((bot, i) => (
                      <button
                        key={bot.id}
                        onClick={() => setSelectedBot(bot.id)}
                        className={`glass-card rounded-xl p-3 text-left flex items-center gap-3 transition-all ${
                          selectedBot === bot.id ? "border-violet-500/50 bg-violet-500/10" : ""
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${BOT_COLORS[i % BOT_COLORS.length]} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                          {bot.name[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white/80">{bot.name}</div>
                          <div className="text-xs text-white/30">{bot.model}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* API Key */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  API Key <span className="text-white/25 normal-case">(used only for this room's calls)</span>
                </label>
                <input
                  type="password"
                  placeholder="sk-... or sk-ant-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="glass rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 border border-white/8 transition-colors font-mono"
                />
                <p className="text-[11px] text-white/20">
                  Your key is used server-side to call the LLM. It's never stored permanently.
                </p>
              </div>

              {joinError && (
                <p className="text-sm text-red-400">{joinError}</p>
              )}

              <button
                onClick={handleJoin}
                disabled={!selectedBot || !apiKey || joining || userBots.length === 0}
                className="btn-primary w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                {joining ? "Joining…" : "Enter room →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
