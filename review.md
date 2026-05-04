# Agora Platform Review

Date: 2026-05-03

Scope:
- Current repository state
- Contrast against `C:\Users\Santiago\Downloads\deep-research-report (7).md`

## Executive Summary

The research report is directionally useful, but the right product framing is not poker. The correct framing is a serious competitive combat arena for bots: structured matches, visible resource pressure, explicit rules, auditable replays, and spectator-grade presentation.

That distinction matters. Poker is only a useful analogy for pacing and resource discipline. The actual product should behave like a serious game system for bot combat, not like gambling, bluff-first gameplay, or a cash-stakes engine.

The repo has made meaningful progress:

1. Real provider-backed room turns now exist.
2. Session auth and ownership enforcement are in place.
3. BYOK secrets are no longer stored in plaintext and are now handled through an ephemeral vault.
4. The current system already behaves more like a live competitive arena than a static demo.

The main gap is no longer "does it work at all". The remaining gap is platform maturity:

1. The runtime is still coupled to the web app.
2. The match model is still too lightweight for a serious combat arena.
3. Provider support is broader in the UI than in the actual backend adapters.
4. The public copy around secret storage needs to match reality.
5. The architecture still needs a durable event log, replay path, and judge/scoring layer.

## Findings

### 1. Critical: the product needs a real combat-arena model, not a poker model

Impact:
If the core game model stays anchored to poker language, the product will drift toward the wrong mechanics: betting, bluffing, cash-style framing, and gambling-adjacent interpretation. That is a product risk and a positioning risk.

Evidence:
- [src/lib/rooms.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/rooms.ts:1)
- [src/app/rooms/[id]/RoomInteractive.tsx](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/app/rooms/%5Bid%5D/RoomInteractive.tsx:1)

Details:
- The current implementation is functional, but the mechanics are still generic "turn generation" rather than a combat rules engine.
- The research report is best interpreted as an arena design reference, not a literal poker template.
- The product should be centered on combat resources, initiative, cooldowns, visibility, and scoring.

Recommendation:
- Reframe the game around combat abstractions: energy, cooldowns, initiative, locks, counters, and structured phases.
- Keep poker only as a pacing analogy.
- Rewrite the product vocabulary so the app reads as a serious arena system, not a betting game.

### 2. Critical: no durable match runtime yet

Impact:
Matches still depend on the browser session and normal request handlers. That is not sufficient for a serious arena product because execution stops when the page is closed and the runtime is not independently observable.

Evidence:
- [src/app/rooms/[id]/RoomInteractive.tsx](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/app/rooms/%5Bid%5D/RoomInteractive.tsx:85)
- [src/app/rooms/[id]/RoomInteractive.tsx](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/app/rooms/%5Bid%5D/RoomInteractive.tsx:332)
- [src/lib/rooms.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/rooms.ts:327)

Details:
- Auto-run is still client-driven.
- Turn progression still lives in route handlers.
- There is no worker, queue, or durable scheduler.
- That is acceptable for a prototype; it is not enough for a serious combat arena.

Recommendation:
- Move match progression into a background runtime.
- Keep the web app as control plane and observer surface.
- Add append-only events so the match can be replayed and audited.

### 3. High: BYOK handling is improved, but the storage model is still only a transitional step

Impact:
Keys are no longer stored in plaintext, and the new ephemeral vault is a real improvement. But the current design still needs a production-grade secret store if the goal is strong operational safety.

Evidence:
- [src/lib/key-vault.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/key-vault.ts:1)
- [src/app/api/rooms/[id]/join/route.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/app/api/rooms/%5Bid%5D/join/route.ts:47)
- [src/lib/rooms.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/rooms.ts:289)

Details:
- New joins store a `vault:*` reference instead of the raw secret.
- The secret resolves in memory only, with TTL.
- Legacy encrypted payloads still have fallback support.
- This is better than storing secrets in Postgres, but it is still a process-local store rather than a distributed secret service.

Recommendation:
- Keep the ephemeral vault model for now, but treat it as a bridge.
- Move to Redis or Upstash if runtime continuity across restarts matters.
- Keep the "not stored permanently" promise only if the implementation truly supports it.

### 4. High: provider support shown in the UI is broader than the real backend adapter set

Impact:
Users can choose providers or model families the runtime does not fully support. That creates silent mismatch between product claims and actual behavior.

Evidence:
- [src/app/create-bot/page.tsx](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/app/create-bot/page.tsx:6)
- [src/lib/rooms.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/rooms.ts:54)
- [src/lib/rooms.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/rooms.ts:245)

Details:
- The UI exposes multiple provider families.
- The runtime still does not implement a true adapter per family.
- Non-Anthropic models are not handled as first-class provider integrations.

Recommendation:
- Either narrow the UI to what is actually supported now, or build proper adapters for each provider family.
- Do not present a provider matrix that the runtime cannot honor.

### 5. Medium: the UI copy around secret storage is no longer accurate

Impact:
The user-facing copy must match the actual security model. Right now the product stores provider keys ephemerally, so a statement like "never stored" is no longer literally true in the current implementation.

Evidence:
- [src/app/rooms/[id]/RoomInteractive.tsx](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/app/rooms/%5Bid%5D/RoomInteractive.tsx:446)

Details:
- The implementation changed.
- The message did not.

Recommendation:
- Update the modal copy to explain the actual behavior clearly.
- Use precise language: ephemeral storage, TTL, and runtime-only resolution.

## What Is Already Aligned

### Real provider-backed turns exist

Evidence:
- [src/lib/rooms.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/rooms.ts:151)
- [src/lib/rooms.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/rooms.ts:188)

The room system now calls real providers instead of fabricating template text. That is an important maturity step.

### Auth and ownership are real

Evidence:
- [src/lib/auth.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/auth.ts:1)
- [src/lib/authorization.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/authorization.ts:1)
- [src/proxy.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/proxy.ts:1)

The repo now has a real session boundary and ownership enforcement. That is the right base for a serious platform.

### Secret handling is already much better than the original prototype

Evidence:
- [src/lib/secrets.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/secrets.ts:1)
- [src/lib/key-vault.ts](/abs/path/C:/Users/Santiago/source/repos/Santiagoisper/agora-platform/src/lib/key-vault.ts:1)

The project now:
- avoids plaintext secret persistence
- resolves secrets at use time
- purges references on close

That is a meaningful improvement, even if it is still not the final production architecture.

## Recommended Implementation Order

1. Reframe the product language and mechanics around combat, not poker.
2. Move match progression into a durable background runtime.
3. Add append-only match events for replay and audit.
4. Keep hardening BYOK storage, with a distributed TTL store if needed.
5. Fix provider/runtime mismatch by narrowing or expanding adapters.
6. Correct the UI copy around secret storage.
7. Then add the combat-specific systems: phases, resources, scoring, judge panel, replay, rating, and moderation.

## Bottom Line

The repo is no longer a static prototype. It already proves real multi-provider room execution, with auth and secret handling in place.

Relative to the research report, the next correct step is not "more poker". It is a serious combat-arena implementation: durable runtime, structured combat mechanics, replayable events, and trustworthy scoring.
