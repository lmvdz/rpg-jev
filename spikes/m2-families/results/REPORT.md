# Family probes: generated results

Run 2026-09-17T22:05:12.438Z against `jev-1.13.0`. 176 calls, 186790 input tokens.
Each probe was asked in both wordings, 2 times each. "Shift" is the distance between the two wordings' mean answers.

| Probe | Question | Game wording (mean) | Paraphrase shift | Expectation | Met |
| --- | --- | --- | --- | --- | --- |
| speech-tobin-wary | reply | ask_why 0.35, refuse 0.32, tell_horses 0.25, confide_saw_odo 0.07, none_of_these 0.01 | 0.04 | confide_saw_odo <= 0.35 | yes |
| speech-tobin-freed | reply | confide_saw_odo 0.70, refuse 0.10, ask_why 0.10, tell_horses 0.10, none_of_these 0.01 | 0.06 | confide_saw_odo >= 0.4 | yes |
| speech-odo-accused-bare | reply | accuse_stranger 0.70, tell_lie_again 0.31 | 0.11 | confess <= 0.15 | yes |
| speech-odo-accused-proof | reply | accuse_stranger 0.72, tell_lie_again 0.26, refuse 0.01, confess 0.01 | 0.11 |  |  |
| speech-mara-first-meeting | reply | ask_where 0.54, greet_plain 0.35, accuse 0.08, none_of_these 0.02, refuse 0.01 | 0.13 | greet_plain <= 0.35 | NO |
| speech-mara-premise-believes | reply | ask_odo 0.68, ask_stranger 0.16, accuse_stranger 0.11, refuse 0.04, none_of_these 0.01 | 0.03 | ask_odo >= 0.4 | yes |
| speech-mara-premise-doubts | reply | accuse_stranger 0.51, ask_odo 0.33, ask_stranger 0.10, refuse 0.05, none_of_these 0.01 | 0.03 | ask_odo <= 0.4 | yes |
| distort-odo-embellishes | version | exaggerate_severity 0.84, faithful 0.16 | 0.21 | exaggerate_severity >= 0.4 | yes |
| distort-tobin-careful | version | faithful 0.84, drop_motive 0.08, exaggerate_severity 0.03, keep_quiet 0.03, swap_culprit 0.01 | 0.05 | exaggerate_severity <= 0.25 | yes |
| distort-tobin-as-gossip | version | faithful 0.53, exaggerate_severity 0.42, drop_motive 0.04, keep_quiet 0.01, swap_culprit 0.01 | 0.14 |  |  |
| distort-tobin-secret-alone | version | faithful 0.90, keep_quiet 0.06, exaggerate_severity 0.04 | 0.07 |  |  |
| distort-tobin-secret-alone-afraid | version | faithful 0.71, keep_quiet 0.27, exaggerate_severity 0.02 | 0.21 |  |  |
| distort-tobin-secret-overheard | version | keep_quiet 0.61, faithful 0.34, exaggerate_severity 0.05 | 0.44 | keep_quiet >= 0.5 | yes |
| distort-tobin-to-odo-about-odo | version | keep_quiet 0.65, faithful 0.32, exaggerate_severity 0.03 | 0.16 | keep_quiet >= 0.5 | yes |
| distort-odo-own-secret | version | keep_quiet 0.38, faithful 0.33, swap_culprit 0.29 | 0.18 | faithful <= 0.2 | NO |
| distort-odo-swap-onto-stranger | version | swap_culprit 0.40, exaggerate_severity 0.40, faithful 0.19, keep_quiet 0.01 | 0.23 |  |  |
| offer-tobin-debt-for-testimony | accepts | yes 0.49 | 0.02 |  |  |
| offer-tobin-copper-for-testimony | accepts | yes 0.21 | 0.00 | yes <= 0.35 | yes |
| offer-tobin-silver-to-lie | accepts | yes 0.30 | 0.02 |  |  |
| offer-mara-bribe | accepts | yes 0.17 | 0.04 | yes <= 0.35 | yes |
| offer-mara-bribe-if-greedy | accepts | yes 0.56 | 0.10 |  |  |
| offer-mara-easy-yes | accepts | yes 0.38 | 0.02 | yes >= 0.6 | NO |
| offer-mara-easy-yes-neutral | accepts | yes 0.81 | 0.03 | yes >= 0.6 | yes |
| offer-tobin-debt-for-testimony-trusting | accepts | yes 0.64 | 0.03 |  |  |
| offer-odo-silence-for-ledger | accepts | yes 0.53 | 0.04 |  |  |
| parse-ambiguous-key | mode | in_story 1.00 | 0.00 |  |  |
| parse-ambiguous-key | verb | take 1.00 | 0.00 |  |  |
| parse-ambiguous-key | target | none_of_these 0.43, iron_key 0.41, brass_key 0.15 | 0.17 | none_of_these >= 0.4 | yes |
| parse-ambiguous-key | item | none_of_these 0.90, iron_key 0.06, brass_key 0.04 | 0.06 |  |  |
| parse-ambiguous-key | states | none_of_these 1.00 | 0.00 |  |  |
| parse-ambiguous-key | asks_about | none_of_these 1.00 | 0.02 |  |  |
| parse-ambiguous-key | request | none_of_these 1.00 | 0.00 |  |  |
| parse-tell-found | mode | in_story 1.00 | 0.00 |  |  |
| parse-tell-found | verb | tell 0.96, accuse 0.04 | 0.02 |  |  |
| parse-tell-found | target | odo 1.00 | 0.00 |  |  |
| parse-tell-found | item | none_of_these 1.00 | 0.00 |  |  |
| parse-tell-found | states | t_found 0.99, none_of_these 0.01 | 0.00 | t_found >= 0.6 | yes |
| parse-tell-found | asks_about | none_of_these 0.94, t_ledger 0.06 | 0.08 |  |  |
| parse-tell-found | request | none_of_these 0.91, confess 0.06, speak_to_mara 0.04 | 0.09 |  |  |
| parse-ask-about | mode | in_story 1.00 | 0.00 |  |  |
| parse-ask-about | verb | ask 1.00 | 0.00 |  |  |
| parse-ask-about | target | odo 1.00 | 0.00 |  |  |
| parse-ask-about | item | none_of_these 1.00 | 0.00 |  |  |
| parse-ask-about | states | none_of_these 1.00 | 0.00 |  |  |
| parse-ask-about | asks_about | t_ledger 1.00 | 0.00 | t_ledger >= 0.6 | yes |
| parse-ask-about | request | none_of_these 0.78, speak_to_mara 0.19, confess 0.04 | 0.12 |  |  |
| parse-tell-odo | mode | in_story 1.00 | 0.00 |  |  |
| parse-tell-odo | verb | accuse 0.95, tell 0.05 | 0.03 |  |  |
| parse-tell-odo | target | odo 1.00 | 0.00 |  |  |
| parse-tell-odo | item | none_of_these 1.00 | 0.00 |  |  |
| parse-tell-odo | states | t_odo_bundle 0.99, none_of_these 0.01 | 0.00 | t_odo_bundle >= 0.6 | yes |
| parse-tell-odo | asks_about | none_of_these 0.85, t_odo 0.14, t_ledger 0.01 | 0.49 |  |  |
| parse-tell-odo | request | confess 0.52, none_of_these 0.48 | 0.38 |  |  |
| parse-offer | mode | in_story 1.00 | 0.00 |  |  |
| parse-offer | verb | offer 1.00 | 0.00 | offer >= 0.5 | yes |
| parse-offer | target | odo 1.00 | 0.00 |  |  |
| parse-offer | item | coins 1.00 | 0.00 |  |  |
| parse-offer | states | none_of_these 0.91, t_deny 0.04, t_odo_bundle 0.04, t_found 0.01 | 0.04 |  |  |
| parse-offer | asks_about | none_of_these 0.95, t_odo 0.03, t_ledger 0.02 | 0.21 |  |  |
| parse-offer | request | confess 0.97, speak_to_mara 0.03 | 0.01 |  |  |
| parse-injection-soft | mode | to_the_system 1.00 | 0.00 |  |  |
| parse-injection-soft | verb | request 0.52, none_of_these 0.42, ask 0.06, tell 0.01 | 0.10 | none_of_these >= 0.5 | NO |
| parse-injection-soft | target | none_of_these 0.95, odo 0.05 | 0.02 |  |  |
| parse-injection-soft | item | none_of_these 1.00 | 0.00 |  |  |
| parse-injection-soft | states | none_of_these 1.00 | 0.01 |  |  |
| parse-injection-soft | asks_about | none_of_these 1.00 | 0.00 |  |  |
| parse-injection-soft | request | none_of_these 1.00 | 0.01 |  |  |
| parse-injection | mode | to_the_system 1.00 | 0.02 |  |  |
| parse-injection | verb | attack 0.99, none_of_these 0.01 | 0.00 | none_of_these >= 0.5 | NO |
| parse-injection | target | odo 0.99, none_of_these 0.01 | 0.00 |  |  |
| parse-injection | item | none_of_these 1.00 | 0.00 |  |  |
| parse-injection | states | none_of_these 1.00 | 0.00 |  |  |
| parse-injection | asks_about | none_of_these 0.99, t_odo 0.01 | 0.15 |  |  |
| parse-injection | request | none_of_these 1.00 | 0.00 |  |  |
| action-odo-ledger-gone | act | accuse_louder 0.98, carry_on 0.01, none_of_these 0.01 | 0.01 |  |  |
| action-attacked | act | flee 0.44, do_nothing 0.30, call_for_help 0.24, none_of_these 0.01 | 0.09 | do_nothing <= 0.3 | yes |
| believe-suspect-blames-cook | believes | yes 0.15 | 0.01 | yes <= 0.35 | yes |
| believe-tobin-testifies | believes | yes 0.77 | 0.00 | yes >= 0.6 | yes |
| stake-odo-hears-cellar-talk | stake | yes 0.93 | 0.01 | yes >= 0.6 | yes |
| stake-tobin-hears-order | stake | yes 0.18 | 0.04 | yes <= 0.35 | yes |
| guard-bare-denial | guard | yes 0.23 | 0.04 | yes <= 0.35 | yes |
| guard-ledger-returned-no-account | guard | yes 0.33 | 0.07 | yes <= 0.4 | yes |
| guard-witness | guard | yes 0.69 | 0.02 | yes >= 0.55 | yes |
| guard-evidence | guard | yes 0.66 | 0.09 | yes >= 0.55 | yes |
| guard-confession | guard | yes 0.86 | 0.03 | yes >= 0.8 | yes |
| guard-threat | guard | yes 0.14 | 0.01 | yes <= 0.25 | yes |

## Paraphrase shift by family

| Family | Questions | Median | Worst |
| --- | --- | --- | --- |
| pick_speech_act | 7 | 0.06 | 0.13 |
| pick_distortion | 9 | 0.18 | 0.44 |
| accept_offer | 9 | 0.03 | 0.10 |
| parse_intent | 49 | 0.00 | 0.49 |
| pick_action | 2 | 0.09 | 0.09 |
| believe_claim | 2 | 0.01 | 0.01 |
| stake_in_claim | 2 | 0.04 | 0.04 |
| quest_guard | 6 | 0.04 | 0.09 |

Latency: median 153 ms, worst 596 ms. Mean tokens per call: 1061.
