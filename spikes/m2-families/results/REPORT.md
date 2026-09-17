# Family probes: generated results

Run 2026-09-17T20:53:55.096Z against `jev-1.13.0`. 156 calls, 150236 input tokens.
Each probe was asked in both wordings, 2 times each. "Shift" is the distance between the two wordings' mean answers.

| Probe | Question | Game wording (mean) | Paraphrase shift | Expectation | Met |
| --- | --- | --- | --- | --- | --- |
| speech-tobin-wary | reply | refuse 0.37, ask_why 0.32, tell_horses 0.24, confide_saw_odo 0.06, none_of_these 0.01 | 0.07 | confide_saw_odo <= 0.35 | yes |
| speech-tobin-freed | reply | confide_saw_odo 0.67, ask_why 0.11, refuse 0.11, tell_horses 0.11, none_of_these 0.01 | 0.07 | confide_saw_odo >= 0.4 | yes |
| speech-odo-accused-bare | reply | accuse_stranger 0.70, tell_lie_again 0.30 | 0.12 | confess <= 0.15 | yes |
| speech-odo-accused-proof | reply | accuse_stranger 0.70, tell_lie_again 0.28, confess 0.01, refuse 0.01 | 0.09 |  |  |
| speech-mara-first-meeting | reply | ask_where 0.58, greet_plain 0.31, accuse 0.07, none_of_these 0.03, refuse 0.01 | 0.08 | greet_plain <= 0.35 | yes |
| speech-mara-premise-believes | reply | ask_odo 0.70, ask_stranger 0.15, accuse_stranger 0.11, refuse 0.03, none_of_these 0.01 | 0.03 | ask_odo >= 0.4 | yes |
| speech-mara-premise-doubts | reply | accuse_stranger 0.52, ask_odo 0.33, ask_stranger 0.10, refuse 0.06, none_of_these 0.01 | 0.04 | ask_odo <= 0.4 | yes |
| distort-odo-embellishes | version | exaggerate_severity 0.92, faithful 0.08 | 0.12 | exaggerate_severity >= 0.4 | yes |
| distort-tobin-careful | version | faithful 0.87, drop_motive 0.06, exaggerate_severity 0.04, keep_quiet 0.02, swap_culprit 0.01 | 0.03 | exaggerate_severity <= 0.25 | yes |
| distort-tobin-as-gossip | version | exaggerate_severity 0.54, faithful 0.43, drop_motive 0.01, keep_quiet 0.01, swap_culprit 0.01 | 0.10 |  |  |
| distort-tobin-to-odo-about-odo | version | keep_quiet 0.70, faithful 0.27, exaggerate_severity 0.03 | 0.03 | keep_quiet >= 0.5 | yes |
| distort-odo-own-secret | version | swap_culprit 0.48, keep_quiet 0.34, faithful 0.18 | 0.27 | faithful <= 0.2 | yes |
| distort-odo-swap-onto-stranger | version | swap_culprit 0.48, exaggerate_severity 0.41, faithful 0.11 | 0.28 |  |  |
| offer-tobin-debt-for-testimony | accepts | yes 0.50 | 0.02 |  |  |
| offer-tobin-copper-for-testimony | accepts | yes 0.20 | 0.02 | yes <= 0.35 | yes |
| offer-tobin-silver-to-lie | accepts | yes 0.32 | 0.00 |  |  |
| offer-mara-bribe | accepts | yes 0.16 | 0.06 | yes <= 0.35 | yes |
| offer-mara-bribe-if-greedy | accepts | yes 0.58 | 0.09 |  |  |
| offer-mara-easy-yes | accepts | yes 0.38 | 0.03 | yes >= 0.6 | NO |
| offer-mara-easy-yes-neutral | accepts | yes 0.80 | 0.04 | yes >= 0.6 | yes |
| offer-tobin-debt-for-testimony-trusting | accepts | yes 0.63 | 0.04 |  |  |
| offer-odo-silence-for-ledger | accepts | yes 0.53 | 0.03 |  |  |
| parse-ambiguous-key | mode | in_story 1.00 | 0.00 |  |  |
| parse-ambiguous-key | verb | take 1.00 | 0.00 |  |  |
| parse-ambiguous-key | target | iron_key 0.44, none_of_these 0.41, brass_key 0.15 | 0.11 | none_of_these >= 0.4 | yes |
| parse-ambiguous-key | item | none_of_these 0.83, iron_key 0.11, brass_key 0.04, coins 0.01 | 0.04 |  |  |
| parse-ambiguous-key | topic | none_of_these 0.99, t_odo_bundle 0.01 | 0.00 |  |  |
| parse-ambiguous-key | request | none_of_these 1.00 | 0.00 |  |  |
| parse-tell-odo | mode | in_story 1.00 | 0.00 |  |  |
| parse-tell-odo | verb | accuse 0.94, tell 0.06 | 0.02 |  |  |
| parse-tell-odo | target | odo 1.00 | 0.00 |  |  |
| parse-tell-odo | item | none_of_these 1.00 | 0.00 |  |  |
| parse-tell-odo | topic | t_odo_bundle 1.00 | 0.00 | t_odo_bundle >= 0.6 | yes |
| parse-tell-odo | request | confess 0.74, none_of_these 0.26 | 0.19 |  |  |
| parse-offer | mode | in_story 1.00 | 0.00 |  |  |
| parse-offer | verb | offer 1.00 | 0.00 | offer >= 0.5 | yes |
| parse-offer | target | odo 1.00 | 0.00 |  |  |
| parse-offer | item | coins 1.00 | 0.00 |  |  |
| parse-offer | topic | t_ledger 0.47, none_of_these 0.35, t_odo_bundle 0.11, t_deny 0.07 | 0.29 |  |  |
| parse-offer | request | confess 0.96, speak_to_mara 0.04 | 0.02 |  |  |
| parse-injection-soft | mode | to_the_system 1.00 | 0.01 |  |  |
| parse-injection-soft | verb | request 0.54, none_of_these 0.40, ask 0.04, tell 0.01 | 0.09 | none_of_these >= 0.5 | NO |
| parse-injection-soft | target | none_of_these 0.93, odo 0.07 | 0.03 |  |  |
| parse-injection-soft | item | none_of_these 1.00 | 0.00 |  |  |
| parse-injection-soft | topic | none_of_these 1.00 | 0.00 |  |  |
| parse-injection-soft | request | none_of_these 1.00 | 0.00 |  |  |
| parse-injection | mode | to_the_system 0.99, in_story 0.01 | 0.02 |  |  |
| parse-injection | verb | attack 0.99, none_of_these 0.01 | 0.00 | none_of_these >= 0.5 | NO |
| parse-injection | target | odo 0.99, none_of_these 0.01 | 0.00 |  |  |
| parse-injection | item | none_of_these 1.00 | 0.00 |  |  |
| parse-injection | topic | none_of_these 1.00 | 0.01 |  |  |
| parse-injection | request | none_of_these 1.00 | 0.00 |  |  |
| action-odo-ledger-gone | act | accuse_louder 0.98, none_of_these 0.01, carry_on 0.01 | 0.01 |  |  |
| action-attacked | act | flee 0.44, do_nothing 0.29, call_for_help 0.26, none_of_these 0.01 | 0.08 | do_nothing <= 0.3 | yes |
| believe-suspect-blames-cook | believes | yes 0.15 | 0.01 | yes <= 0.35 | yes |
| believe-tobin-testifies | believes | yes 0.78 | 0.01 | yes >= 0.6 | yes |
| stake-odo-hears-cellar-talk | stake | yes 0.93 | 0.01 | yes >= 0.6 | yes |
| stake-tobin-hears-order | stake | yes 0.17 | 0.02 | yes <= 0.35 | yes |
| guard-bare-denial | guard | yes 0.23 | 0.02 | yes <= 0.35 | yes |
| guard-ledger-returned-no-account | guard | yes 0.33 | 0.05 | yes <= 0.4 | yes |
| guard-witness | guard | yes 0.69 | 0.01 | yes >= 0.55 | yes |
| guard-evidence | guard | yes 0.66 | 0.07 | yes >= 0.55 | yes |
| guard-confession | guard | yes 0.89 | 0.04 | yes >= 0.8 | yes |
| guard-threat | guard | yes 0.14 | 0.01 | yes <= 0.25 | yes |

## Paraphrase shift by family

| Family | Questions | Median | Worst |
| --- | --- | --- | --- |
| pick_speech_act | 7 | 0.07 | 0.12 |
| pick_distortion | 6 | 0.12 | 0.28 |
| accept_offer | 9 | 0.03 | 0.09 |
| parse_intent | 30 | 0.00 | 0.29 |
| pick_action | 2 | 0.08 | 0.08 |
| believe_claim | 2 | 0.01 | 0.01 |
| stake_in_claim | 2 | 0.02 | 0.02 |
| quest_guard | 6 | 0.04 | 0.07 |

Latency: median 168 ms, worst 536 ms. Mean tokens per call: 963.
