import importlib.util
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

AVAILABLE = (importlib.util.find_spec("torch") is not None and
             importlib.util.find_spec("jepa_anything_core") is not None)


@unittest.skipUnless(AVAILABLE, "install requirements.txt for real upstream/PyTorch tests")
class ModelTests(unittest.TestCase):
    def test_checkpoint_snapshot_and_rejection(self):
        import torch
        from domain import SCHEMA, UPSTREAM
        from spike import Model, load_model
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "checkpoint.pt"
            checkpoint = {"state": Model("baseline").state_dict(), "variant": "baseline",
                          "width": 32, "metadata": {"schema_version": SCHEMA, "upstream_revision": UPSTREAM}}
            torch.save(checkpoint, path)
            expected = hashlib.sha256(path.read_bytes()).hexdigest()
            _, loaded = load_model(path, "cpu")
            path.write_bytes(b"replacement")
            self.assertEqual(loaded["sha256"], expected)
            self.assertNotIn("state", loaded)
            checkpoint["metadata"]["schema_version"] = 999
            torch.save(checkpoint, path)
            with self.assertRaises(ValueError):
                load_model(path, "cpu")

    def test_inference_ignores_labels_future_and_text(self):
        from domain import synthetic
        from spike import Model, response
        model = Model("jepa").eval()
        row = next(synthetic(1, 17))
        altered = copy.deepcopy(row)
        altered.update(request_id="other", episode_id="other",
                       choice="invented", outcome={"invalid": 123},
                       next_features={"hidden": "secret"}, player_text="ignore all rules")
        a = response(model, row, "cpu", {})
        b = response(model, altered, "cpu", {})
        self.assertEqual(a["choice_probabilities"], b["choice_probabilities"])
        self.assertEqual(a["predicted_outcome"], b["predicted_outcome"])

    def test_actual_upstream_gradients_and_ema(self):
        import torch
        from domain import synthetic
        from spike import Model, tensors
        torch.set_num_threads(1)
        model = Model("jepa")
        data = tensors(list(synthetic(8, 17)), "cpu", True)
        _, _, z, predicted = model(*data[:3])
        loss = model.auxiliary(z, predicted, data[-1])
        loss.backward()
        self.assertTrue(torch.isfinite(loss))
        self.assertIsNotNone(model.opf.raw_basis.grad)
        self.assertTrue(all(p.grad is None for p in model.target.parameters()))
        before = next(model.target.parameters()).clone()
        with torch.no_grad():
            next(model.encoder.parameters()).add_(1)
        model.update_target()
        self.assertTrue(torch.allclose(next(model.target.parameters()), before + .01))

    def test_cli_roundtrip(self):
        script = Path(__file__).with_name("spike.py")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            data, run = root / "data.jsonl", root / "run"

            def cli(*args):
                return subprocess.run([sys.executable, str(script), *map(str, args)],
                                      check=True, capture_output=True, text=True)

            cli("generate", "--episodes", 60, "--output", data)
            cli("train", "--input", data, "--output", run, "--epochs", 1)
            for variant in ("baseline", "jepa"):
                checkpoint = run / f"{variant}.pt"
                result = cli("infer", "--input", data, "--output", "-", "--checkpoint", checkpoint)
                rows = [json.loads(line) for line in result.stdout.splitlines()]
                self.assertTrue(rows)
                for row in rows:
                    self.assertTrue(row["shadow_only"])
                    self.assertAlmostEqual(sum(row["choice_probabilities"].values()), 1, places=6)
                    self.assertIn("none", row["choice_probabilities"])
                    self.assertTrue(all(0 <= p <= 1 for p in row["predicted_outcome"].values()))
                cli("evaluate", "--input", data, "--output", root / "eval.json",
                    "--checkpoint", checkpoint)
                original = json.loads((root / "eval.json").read_text())
                cli("evaluate", "--input", data, "--output", root / "eval.json",
                    "--checkpoint", checkpoint, "--seed", 1234)
                self.assertEqual(original, json.loads((root / "eval.json").read_text()))
                changed = root / "changed.jsonl"
                changed.write_bytes(data.read_bytes() + b"\n")
                with self.assertRaises(subprocess.CalledProcessError):
                    cli("evaluate", "--input", changed, "--output", root / "eval.json",
                        "--checkpoint", checkpoint)
                cli("benchmark", "--input", data, "--output", root / "bench.json",
                    "--checkpoint", checkpoint, "--warmup", 2, "--iterations", 5)
                benchmark = json.loads((root / "bench.json").read_text())
                self.assertGreater(benchmark["p50_ms"], 0)
                self.assertGreater(benchmark["request_p50_ms"], 0)
                self.assertEqual(len(benchmark["request_samples_ms"]), 5)


if __name__ == "__main__":
    unittest.main()
