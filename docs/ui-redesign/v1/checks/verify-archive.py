"""Read-only validation of the D0 documentation archive; no application tests."""
import argparse
import hashlib
import json
import re
import subprocess
import zipfile
from pathlib import Path
from urllib.parse import unquote
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]
BASE = "bcca135530352ed9c85407e18acceed1dbf45690"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def headings(path):
    values = set()
    for title in re.findall(r"^#{1,6} (.+)$", path.read_text(encoding="utf-8"), re.M):
        values.add(re.sub(r"[^\w\-\s]", "", title.lower()).replace(" ", "-"))
    return values


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path)
    args = parser.parse_args()
    manifest = read_json(ROOT / "checks/archive-manifest.json")
    assert manifest["package_id"] == "NEON-RC1-20260909"
    assert manifest["design_input_sha"] == BASE
    assert manifest["user_approval"] == "APPROVED" and manifest["design_status"] == "FROZEN"
    entries = manifest["files"] + manifest["additional_files"]
    expected = {e["file"] for e in entries} | {"checks/archive-manifest.json"}
    actual = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if p.is_file()}
    assert actual == expected, (actual - expected, expected - actual)
    for entry in entries:
        assert digest((ROOT / entry["file"]).read_bytes()) == entry["sha256"], entry["file"]
    print(f"PASS archive inventory and SHA-256: {len(entries)} files + manifest")

    migration = (ROOT / "05-migration-and-scope.md").read_text(encoding="utf-8")
    rows = re.findall(r"^\| M\d{2} \|.*$", migration, re.M)
    assert [r.split("|")[1].strip() for r in rows] == [f"M{i:02}" for i in range(1, 57)]
    index = read_json(ROOT / "design/index.json")
    assert len(index) == len({e["id"] for e in index}) == 42
    for entry in index:
        ET.parse(ROOT / entry["file"])
    tokens = read_json(ROOT / "design/theme_tokens.json")
    assert {k: v["name"] for k, v in tokens.items()} == {"neon": "霓虹科技", "pro": "深色专业", "light": "明亮简洁"}
    for page in ["home", "macro", "industry", "stocks", "company", "watchlist", "verification", "expectations"]:
        for theme in tokens:
            entry = next(e for e in index if e["id"] == f"{page}_{theme}")
            assert entry["theme"] == theme and entry["title"].endswith(tokens[theme]["name"])
    book = read_json(ROOT / "design/book-index.json")
    assert [e["page"] for e in book] == list(range(1, 33))
    composite = {"cover", "index", "themes", "mobile_0", "mobile_1", "architecture", "migration", "checks", "implementation", "approval"}
    assert all(e["key"] in {i["id"] for i in index} | composite for e in book)
    audit = (ROOT / "07-audit-and-acceptance.md").read_text(encoding="utf-8")
    assert len(re.findall(r"^\| [TIDE]\d{2} \|", audit, re.M)) == 54
    dispatch = read_json(ROOT / "tasks/dispatch-status.json")
    assert dispatch["package_id"] == manifest["package_id"] and dispatch["user_approval"] == "APPROVED"
    assert dispatch["tasks"][0]["state"] == "ARCHIVED_PENDING_INDEPENDENT_REVIEW"
    assert all(t["state"] == "NOT_DISPATCHABLE" and t["base_sha"] is None for t in dispatch["tasks"][1:])
    print("PASS M01-M56, 42 SVGs, 32 book pages, A/B/C identities, 54 audit IDs, dispatch states")

    count = 0
    for path in ROOT.rglob("*.md"):
        text = path.read_text(encoding="utf-8")
        assert not re.search(r"AWAITING USER APPROVAL|用户尚未确认|状态：V1.0 设计候选", text), path
        for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", text):
            if re.match(r"[a-z]+://", target):
                continue
            name, _, fragment = unquote(target).partition("#")
            dest = (path.parent / name).resolve() if name else path
            assert dest.is_relative_to(REPO) and dest.exists(), (path.name, target)
            if fragment:
                assert fragment in headings(dest), (path.name, target)
            count += 1
    for name in ["architecture.md", "feature-registry.md", "development-execution-plan-2026-09-07.md"]:
        text = (REPO / "docs" / name).read_text(encoding="utf-8")
        for target in ["ui-redesign/v1/README.md", "ui-redesign/v1/execution-index.md"]:
            assert f"]({target})" in text and (REPO / "docs" / target).is_file()
    print(f"PASS {count} local document links/anchors and 6 navigation links; approval status scan")

    if args.zip:
        assert digest(args.zip.read_bytes()) == manifest["source_zip_sha256"]
        with zipfile.ZipFile(args.zip) as package:
            for entry in manifest["files"]:
                raw = package.read(manifest["source_prefix"] + entry["source"])
                assert digest(raw) == entry["source_sha256"], entry["source"]
                if entry["change"] == "byte-identical":
                    assert raw == (ROOT / entry["file"]).read_bytes()
            original = package.read("neon_ui_v1/docs/05-migration-and-scope.md").decode()
            assert rows == re.findall(r"^\| M\d{2} \|.*$", original, re.M)
            original_index = json.loads(package.read("neon_ui_v1/design/index.json"))
            for entry in original_index:
                entry["file"] = entry["file"].replace(".png", ".svg")
            assert index == original_index
            for name in ["theme_tokens.json", "book-index.json"]:
                assert package.read("neon_ui_v1/design/" + name) == (ROOT / "design" / name).read_bytes()
        print("PASS source ZIP/member hashes; 56 migration rows exact; index path-only changes; tokens/book unchanged")
    else:
        print("NOT_RUN source ZIP comparison (provide --zip)")

    changed = subprocess.check_output(["git", "-c", "core.quotepath=false", "diff", "--name-only", BASE], cwd=REPO, text=True, encoding="utf-8").splitlines()
    changed += subprocess.check_output(["git", "-c", "core.quotepath=false", "ls-files", "--others", "--exclude-standard"], cwd=REPO, text=True, encoding="utf-8").splitlines()
    allowed = {"docs/architecture.md", "docs/feature-registry.md", "docs/development-execution-plan-2026-09-07.md"}
    assert all(p.startswith("docs/ui-redesign/v1/") or p in allowed for p in changed), changed
    print("PASS Git file scope: archive and three documentation navigation files only")


if __name__ == "__main__":
    main()
