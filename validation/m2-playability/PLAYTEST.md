# M2: is the inn worth building on?

**Historical fixture exercise:** the owner subsequently replaced this
inn-centric gate with the browser open-world target in SPEC §16. This document
is retained for testing the inn; completing it is no longer required before
working on the world renderer, world engine or JEPA research.

This was the remaining **human** inn gate, not another automated test result.
The technical checklist, complete-night recordings and scheduled proposals
exist. At the time, M3 authoring and subsequent world delivery were gated on the
inn being worth playing. The browser gate in current SPEC §16 supersedes that
requirement.

## Play without reading a route

Allow about 15–20 minutes, or stop when you no longer want to continue. This is
a suggested feedback session, not a new numerical definition of “fun.”

From the repository, with the API key supplied only through the existing ignored
environment file:

```sh
pnpm play --new --handwritten --save=m2-human --cost
```

In a Delta worktree that does not have the ignored environment file:

```sh
node --env-file=H:/rpg-jev/.env packages/terminal/src/play.ts --new --handwritten --save=m2-human --cost
```

Your goal: work out what happened to the missing ledger and decide how to handle
the suspicion against you. Choose your own approach; there is no required route.
Read the introduction and `help`. Explore, question people and act on what you
learn. Use `journal` to remember accounts and sources; its note commands let you
discuss an account without guessing the parser's wording.

- Avoid `why <name>` for this first pass: it is an omniscient debugging tool.
- Type `huh` immediately after confusing behavior to flag it in the save.
- `quit` saves. Resume with `pnpm play --save=m2-human --cost` (omit `--new`).
- The offline fallback is useful for recovery checks, but does not assess the
  live Jev experience.
- An epilogue is an out-of-scene world-state summary. It does not mean your
  character heard remote speech or handed over an item.

## Feedback to return

Keep `saves/m2-human.jsonl`; it contains actions, decisions, RNG and effects, not
your environment file. Share it only if comfortable sharing the text you typed.
Do not share `.env`.

1. What did you try to achieve, and why?
2. What evidence or account changed your next action?
3. Where did you lose track of what to do, who knew what, or why something happened?
4. Did the ending follow understandably from your choices? Was an offstage
   verdict satisfying, or did you want a playable final exchange?
5. **Is this inn worth building the author thread and larger world on?**

The owner records the acceptance judgment. A “not yet” should name the most
important player-facing failure so the next change addresses that instead of
adding unrelated infrastructure. No human result has been recorded for this build.
