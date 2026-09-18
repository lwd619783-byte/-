"""Targeted acquisition must retain every unselected company across all modules."""
import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "fetch-a-stock-data.py"
spec = importlib.util.spec_from_file_location("a_stock_targeted", SCRIPT)
fetcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetcher)


class TargetedRefreshTests(unittest.TestCase):
    def setUp(self):
        self.universe = [
            {"id": "tracked-new", "code": "688999", "name": "Fixture A", "market": "A股", "exchange": "SH", "dataProvider": "aStockData", "dataStatus": "supported", "shouldFetchQuote": True, "shouldValidate": True},
            {"id": "retained-a", "code": "300001", "name": "Fixture B", "market": "A股", "exchange": "SZ", "dataProvider": "aStockData", "dataStatus": "supported", "shouldFetchQuote": True, "shouldValidate": True},
            {"id": "retained-hk", "code": "9999", "name": "Fixture H", "market": "港股", "dataProvider": "yfinance", "dataStatus": "supported", "shouldValidate": True},
        ]

    def test_identity_selection_fails_closed(self):
        self.assertEqual(fetcher.select_stocks(self.universe, "tracked-new"), [self.universe[0]])
        self.assertEqual(fetcher.select_stocks(self.universe, "688999"), [self.universe[0]])
        for identity in ("missing", "retained-hk", "9999"):
            with self.assertRaises(ValueError):
                fetcher.select_stocks(self.universe, identity)
        with self.assertRaises(ValueError):
            fetcher.select_stocks([*self.universe, self.universe[0]], "688999")

    def test_targeted_refresh_preserves_all_other_modules_and_hk_coverage(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files = ["stocks", "quotes", "financials", "priceHistory", "research", "announcements", "signals", "sectorMembership"]
            previous = {identity: {"id": identity, "retained": [0, None, "original"], "quality": {"status": "real", "updatedAt": "2026-01-01"}} for identity in ("retained-a", "retained-hk")}
            for name in files:
                (root / f"{name}.generated.json").write_text(json.dumps({"updatedAt": "old", "items": previous}), encoding="utf-8")
            hk_coverage = {"real": 1, "total": 1, "missing": []}
            (root / "data-manifest.generated.json").write_text(json.dumps({"coverage": {"hkQuotes": hk_coverage}, "universe": {"privateCompanies": 0}, "sourceSummary": ["retained HK source"], "errors": []}), encoding="utf-8")
            record = {"id": "tracked-new", "quality": {"status": "real"}}
            with patch.multiple(fetcher, REAL_DIR=root, LOG_DIR=root / "logs"), patch.object(fetcher, "load_stock_universe", return_value=self.universe), patch("sys.argv", [str(SCRIPT), "--stock", "688999"]), patch.object(fetcher, "fetch_tencent_quote", return_value=(dict(record), dict(record), dict(record))):
                patches = [patch.object(fetcher, name, return_value=dict(record)) for name in ("fetch_eastmoney_stock_info", "fetch_eastmoney_f10", "fetch_tencent_history", "fetch_financial", "fetch_research", "fetch_announcements", "generate_signals_from_real_data", "fetch_sector", "merge_sector_profile_fallback")]
                for item in patches:
                    item.start()
                try:
                    self.assertEqual(fetcher.main(), 0)
                finally:
                    for item in patches:
                        item.stop()
            for name in files:
                result = json.loads((root / f"{name}.generated.json").read_text(encoding="utf-8"))["items"]
                self.assertEqual({key: result[key] for key in previous}, previous)
                self.assertIn("tracked-new", result)
            manifest = json.loads((root / "data-manifest.generated.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["coverage"]["hkQuotes"], hk_coverage)
            self.assertEqual(manifest["coverage"]["quotes"]["real"], 2)
            self.assertEqual(manifest["coverage"]["quotes"]["total"], 2)
            self.assertEqual(manifest["universe"]["total"], 3)
            self.assertEqual(manifest["universe"]["markets"]["港股"], 1)

    def test_invalid_retained_artifact_is_not_silently_dropped(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "quotes.generated.json").write_text('{"items": []}', encoding="utf-8")
            with patch.object(fetcher, "REAL_DIR", root), self.assertRaises(ValueError):
                fetcher.retained_items("quotes.generated.json", True)

    def test_tencent_total_and_float_caps_follow_official_hs_adapter(self):
        fields = [""] * 49
        fields[1], fields[2], fields[3] = "Fixture A", "688999", "10"
        fields[44], fields[45] = "12", "100"
        with patch.object(fetcher, "http_get", return_value='v_sh688999="' + "~".join(fields) + '";'):
            profile, quote, _ = fetcher.fetch_tencent_quote(self.universe[0], "2026-09-18T00:00:00Z")
        self.assertEqual((quote["marketCap"], quote["floatMarketCap"]), (100, 12))
        self.assertEqual((profile["totalShares"], profile["floatShares"]), (10, 1.2))

    def test_tencent_missing_caps_do_not_become_zero(self):
        fields = [""] * 49
        fields[2], fields[3] = "688999", "10"
        with patch.object(fetcher, "http_get", return_value='v_sh688999="' + "~".join(fields) + '";'):
            profile, quote, _ = fetcher.fetch_tencent_quote(self.universe[0], "2026-09-18T00:00:00Z")
        self.assertIsNone(quote["marketCap"])
        self.assertIsNone(quote["floatMarketCap"])
        self.assertIsNone(profile["totalShares"])

    def test_tencent_foreign_identity_fails_closed(self):
        fields = [""] * 49
        fields[2], fields[3] = "688998", "10"
        with patch.object(fetcher, "http_get", return_value='v_sh688999="' + "~".join(fields) + '";'), self.assertRaisesRegex(ValueError, "identity"):
            fetcher.fetch_tencent_quote(self.universe[0], "2026-09-18T00:00:00Z")

    def test_retained_live_quotes_replay_corrected_mapping(self):
        root = SCRIPT.parents[1]
        capture_root = root / "research-data/provider-probes/tencent-market-cap/2026-09-18"
        manifest = json.loads((capture_root / "manifest.json").read_text(encoding="utf-8"))
        universe = json.loads((root / "src/data/real/stock-universe.generated.json").read_text(encoding="utf-8"))["items"]
        stocks = {stock["id"]: stock for stock in universe if stock["market"] == "A股"}
        quotes = json.loads((root / "src/data/real/quotes.generated.json").read_text(encoding="utf-8"))["items"]
        self.assertEqual({item["id"] for item in manifest["items"]}, set(stocks))
        for capture in manifest["items"]:
            raw = (capture_root / capture["path"]).read_bytes()
            self.assertEqual(len(raw), capture["bytes"])
            self.assertEqual(hashlib.sha256(raw).hexdigest(), capture["sha256"])
            with self.subTest(stock=capture["id"]), patch.object(fetcher, "http_get", return_value=raw.decode("gbk")):
                _, quote, _ = fetcher.fetch_tencent_quote(stocks[capture["id"]], capture["fetchedAt"])
            self.assertEqual(quote, quotes[capture["id"]])


if __name__ == "__main__":
    unittest.main()
