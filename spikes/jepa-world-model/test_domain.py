import copy
import unittest

from domain import ACTIONS, legal_actions, partition, synthetic, validate


class DomainTests(unittest.TestCase):
    def test_reproducible_and_grouped(self):
        rows = list(synthetic(100, 17))
        self.assertEqual(rows, list(synthetic(100, 17)))
        groups = {}
        for row in rows:
            groups.setdefault(partition(row["episode_id"], 17), set()).add(row["episode_id"])
            self.assertIn("none", row["legal_actions"])
            validate(row, True)
        self.assertEqual(set(groups), {"train", "validation", "test"})
        for a in groups:
            for b in groups:
                if a != b:
                    self.assertFalse(groups[a] & groups[b])

    def test_illegal_and_nonfinite_rejected(self):
        row = next(synthetic(1, 17))
        for value in (float("nan"), float("inf"), -1, 2, True):
            bad = copy.deepcopy(row)
            bad["features"]["danger"] = value
            with self.assertRaises(ValueError):
                validate(bad)
        bad = copy.deepcopy(row)
        bad["legal_actions"] = []
        with self.assertRaises(ValueError):
            validate(bad)

    def test_none_only(self):
        f = {"witnessed": False, "guard_present": False, "escape_open": False,
             "courage": .5, "loyalty": .5, "danger": .5}
        self.assertEqual(legal_actions(f), ["none"])
        self.assertEqual(ACTIONS[0], "none")

    def test_request_identity_bounds_match_typescript(self):
        for value in (None, [], 1):
            with self.assertRaises(ValueError):
                validate(value)
        row = next(synthetic(1, 17))
        for identifier in ("", "x" * 257, "\U0001f600" * 129):
            with self.assertRaises(ValueError):
                validate(dict(row, request_id=identifier))
        validate(dict(row, request_id="\U0001f600" * 128))

    def test_action_changes_synthetic_consequence(self):
        rows = list(synthetic(100, 17))
        by_episode = {}
        for row in rows:
            by_episode.setdefault(row["episode_id"], []).append(row)
        self.assertTrue(any(len({tuple(r["outcome"].values()) for r in group}) > 1
                            for group in by_episode.values()))


if __name__ == "__main__":
    unittest.main()
