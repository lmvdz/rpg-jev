# Fun-test kit (gate J4)

J4 asks whether people who have never seen the game want to play it again. It
is run by people, not by the agent. It passes when **at least 5 strangers**
play a 20-minute session and **at least 3 of them say, unprompted, that they
would play again** (SPEC section 16, milestone J).

## What you need

- This repository on branch `feat/jepa-proof`, with `pnpm install --store-dir H:\.pnpm-store` done.
- SpacetimeDB CLI 2.10.1 installed (the same one the shared world uses).
- Chrome or Firefox on the host machine. Strangers play on the host machine;
  the local host does not accept remote browsers without `wss`.
- One printed copy of the [questionnaire](../../validation/jepa-proof/fun-test/questionnaire.md) per stranger.

## One command per session

```
pnpm jepa:fun-test --session s01
```

This starts the local world host on port 3088 if it is not already running. It
also publishes a fresh world for this session (database `fun-s01`), turns the
learned model on (`--mode live`; `shadow` and `off` are the alternatives), and
starts the archive worker, which is the session's recording. Finally it serves
the game at **http://127.0.0.1:5190/?shared**. Use a new session name for
every stranger: each world admits eight players in its whole life, and a fresh
world means every stranger starts in the same place. Stop with Ctrl+C when the
session is over.

The recording is the archive file in `packages/server/.stdb/instances/3088/`
named after the session's database. It holds every command and every tick,
and replays offline with `validation/shared-world/replay.mjs`. Keep it with
the session's questionnaire.

About the model: in live mode the model ranks physical outcomes each tick and
code commits them. At the clearing's size the model does not finish inside its
10 ms deadline in the SpacetimeDB module (see `REPORT.md`, J2), so almost every
tick falls back to the code engine and logs that it did. The game plays the
same either way. What J4 measures is whether the world is worth playing, not
the model.

## The session (20 minutes)

Keep to the script. The point is to see what a stranger does with no help, so
do not demonstrate, suggest goals or praise.

| Minute | Host says or does |
| --- | --- |
| 0 | "This is an early game about a small world that behaves by its own rules. There is no goal I will give you. Play however you like for about fifteen minutes; think aloud if you can. I will not help unless you are stuck on the controls." Open the address; let them take the mouse. |
| 0–2 | If asked about controls only: left click or the arrow keys walk, and right click opens what you can do with a thing. Nothing else. |
| 2–17 | Watch and write down, in their words, what they try and what they say. Note the minute of anything surprising, confusing or broken. Do not answer questions about what things do: "What do you think it does?" |
| 17 | "Let's stop there." Close nothing yet. |
| 17–20 | Hand over the questionnaire. Do not read the questions aloud first. |

**Unprompted** means before question 4 is read. Mark "would play again,
unprompted" only if they say it, or ask to keep playing or to come back, before
seeing that question. An answer to the question itself is recorded, but does
not count toward the gate.

## After the session

1. Stop the kit (Ctrl+C) and copy the archive file to
   `validation/jepa-proof/fun-test/sessions/<session>/`.
2. Fill in one row of `validation/jepa-proof/fun-test/results.csv`.
3. After five or more strangers, count the unprompted "would play again".
   J4 passes at 3 or more. Record the result in `docs/jepa-proof/REPORT.md`.

Who counts as a stranger: someone who has not seen the game, its code or its
design documents, and is not on the project.
