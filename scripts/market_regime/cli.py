from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .catalog import build_catalog, load_json, render_catalog
from .hashing import atomic_write_bytes
from .probe import run_live_probe, write_probe_result
from .validator import validate_catalog


REPO_ROOT = Path(__file__).resolve().parents[2]


def _path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else REPO_ROOT / path


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Market Regime 历史观测目录工具")
    subcommands = parser.add_subparsers(dest="command", required=True)

    build = subcommands.add_parser("build", help="从受控输入构建 deterministic observation catalog")
    build.add_argument("--input", required=True)
    build.add_argument("--output", required=True)
    build.add_argument("--generated-at")

    validate = subcommands.add_parser("validate", help="fail-closed 校验 observation catalog")
    validate.add_argument("--catalog", required=True)
    validate.add_argument("--verify-artifacts", action="store_true")
    validate.add_argument("--artifact-root", default=str(REPO_ROOT))

    probe = subcommands.add_parser("probe", help="执行与普通测试隔离的官方源 live probe")
    probe.add_argument("--plan", required=True)
    probe.add_argument("--output-root", required=True)
    return parser


def _build(args: argparse.Namespace) -> int:
    source = load_json(_path(args.input))
    catalog = build_catalog(source, generated_at=args.generated_at)
    errors = catalog["manifest"]["validationErrors"]
    if errors:
        print(json.dumps({"status": "FAIL", "errors": errors}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    output = _path(args.output)
    atomic_write_bytes(output, render_catalog(catalog).encode("utf-8"))
    print(json.dumps({
        "status": "PASS",
        "output": output.relative_to(REPO_ROOT).as_posix(),
        "observationCount": catalog["manifest"]["observationCount"],
        "artifactCount": catalog["manifest"]["artifactCount"],
        "catalogContentSha256": catalog["manifest"]["contentHashes"]["catalogContentSha256"],
    }, ensure_ascii=False, indent=2))
    return 0


def _validate(args: argparse.Namespace) -> int:
    catalog = load_json(_path(args.catalog))
    errors = validate_catalog(
        catalog,
        artifact_root=_path(args.artifact_root),
        verify_artifacts=args.verify_artifacts,
    )
    print(json.dumps({
        "status": "FAIL" if errors else "PASS",
        "catalog": Path(args.catalog).as_posix(),
        "errorCount": len(errors),
        "errors": errors,
    }, ensure_ascii=False, indent=2))
    return 1 if errors else 0


def _probe(args: argparse.Namespace) -> int:
    plan = load_json(_path(args.plan))
    output_root = _path(args.output_root)
    result = run_live_probe(plan, output_root=output_root, repo_root=REPO_ROOT)
    result_path = output_root / "probe-result.json"
    write_probe_result(result_path, result)
    print(json.dumps({
        "status": "PARTIAL" if result["failures"] else "PASS",
        "output": result_path.relative_to(REPO_ROOT).as_posix(),
        "sourceStatus": result["sourceStatus"],
        "probeCounts": result["probeCounts"],
        "failureCount": len(result["failures"]),
    }, ensure_ascii=False, indent=2))
    return 1 if result["failures"] else 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "build":
            return _build(args)
        if args.command == "validate":
            return _validate(args)
        if args.command == "probe":
            return _probe(args)
    except (OSError, ValueError) as exc:
        print(
            json.dumps(
                {"status": "FAIL", "errors": [f"{type(exc).__name__}: {exc}"]},
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        return 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
