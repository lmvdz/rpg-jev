"""Code-owned toy task. Labels are synthetic rules, not Jev or causal evidence."""

import hashlib
import json
import math
import random

SCHEMA = 1
ACTIONS = ("none", "report", "confront", "flee")
FEATURES = ("witnessed", "guard_present", "escape_open", "courage", "loyalty", "danger")
OUTCOMES = ("recovered", "alarm", "injury")
UPSTREAM = "c6e6c88f3ef75a4ce7acd660d6fa5779d995512c"


def legal_actions(f):
    return [
        a for a, allowed in zip(
            ACTIONS,
            (True, f["witnessed"] and f["guard_present"], f["witnessed"], f["escape_open"]),
        ) if allowed
    ]


def validate(row, labeled=False):
    if not isinstance(row, dict):
        raise ValueError("request must be an object")
    if type(row.get("schema_version")) is not int or row["schema_version"] != SCHEMA:
        raise ValueError("unsupported schema_version")
    for key in ("request_id", "episode_id"):
        if not isinstance(row.get(key), str) or not 1 <= len(row[key].encode("utf-16-le")) // 2 <= 256:
            raise ValueError(f"{key} must contain 1 to 256 UTF-16 code units")
    f = row.get("features")
    if not isinstance(f, dict) or set(f) != set(FEATURES):
        raise ValueError("features must match the fixed structured schema")
    for key in FEATURES[:3]:
        if type(f[key]) is not bool:
            raise ValueError(f"{key} must be boolean")
    for key in FEATURES[3:]:
        if type(f[key]) not in (int, float) or not math.isfinite(f[key]) or not 0 <= f[key] <= 1:
            raise ValueError(f"{key} must be finite in [0,1]")
    if row.get("legal_actions") != legal_actions(f):
        raise ValueError("legal_actions must match code-built canonical options")
    if row.get("action") not in row["legal_actions"]:
        raise ValueError("conditioned action must be legal")
    if labeled:
        if row.get("label_source") != "synthetic_rules_v1":
            raise ValueError("only explicitly synthetic labels supported")
        if row.get("choice") not in row["legal_actions"]:
            raise ValueError("illegal choice label")
        for key, names in (("outcome", OUTCOMES), ("next_features", FEATURES)):
            if not isinstance(row.get(key), dict) or set(row[key]) != set(names):
                raise ValueError(f"invalid {key}")
        for value in row["outcome"].values():
            if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1:
                raise ValueError("outcome targets must be finite probabilities")
        future = dict(row, features=row["next_features"])
        future["legal_actions"] = legal_actions(future["features"])
        future["action"] = "none"
        validate(future)
    return row


def partition(episode_id, seed):
    bucket = int(hashlib.sha256(f"{seed}:{episode_id}".encode()).hexdigest()[:8], 16) % 10
    return "train" if bucket < 7 else "validation" if bucket < 9 else "test"


def synthetic(episodes, seed):
    rng = random.Random(seed)
    for i in range(episodes):
        f = dict(zip(FEATURES, [rng.random() < .85, rng.random() < .5, rng.random() < .7,
                                rng.random(), rng.random(), rng.random()]))
        legal = legal_actions(f)
        scores = {"none": .3, "report": f["loyalty"] + .4,
                  "confront": f["courage"] - f["danger"] + .5,
                  "flee": f["danger"] - f["courage"] + .5}
        choice = max(legal, key=scores.__getitem__)
        # All intervention rows from one episode remain together in the split.
        for action in legal:
            recovered = float(action == "report" or
                              (action == "confront" and f["courage"] > f["danger"]))
            alarm = float(action == "report" or (action == "confront" and f["guard_present"]))
            injury = float(action == "confront" and f["danger"] > .5)
            future = dict(f)
            future["witnessed"] = bool(f["witnessed"] and not recovered)
            future["guard_present"] = bool(f["guard_present"] or alarm)
            future["danger"] = max(0., min(1., f["danger"] + .2 * injury - .4 * recovered))
            yield validate({
                "schema_version": SCHEMA, "request_id": f"synthetic-{seed}-{i}-{action}",
                "episode_id": f"synthetic-{seed}-{i}", "features": f, "legal_actions": legal,
                "action": action, "choice": choice,
                "outcome": dict(zip(OUTCOMES, (recovered, alarm, injury))),
                "next_features": future, "label_source": "synthetic_rules_v1",
            }, labeled=True)


def load_jsonl(path, labeled=False):
    import sys
    stream = sys.stdin if path == "-" else open(path, encoding="utf-8")
    try:
        rows = [validate(json.loads(line), labeled) for line in stream if line.strip()]
    finally:
        if stream is not sys.stdin:
            stream.close()
    if not rows or len({r["request_id"] for r in rows}) != len(rows):
        raise ValueError("require nonempty data and unique request IDs")
    return rows
