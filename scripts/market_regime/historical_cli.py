"""Explicit offline commands; failed builds never replace a sealed output."""
import argparse
import json
from pathlib import Path

from .catalog import render_catalog, utc_now_iso
from .hashing import atomic_write_bytes
from .historical import build_dataset
from .historical_validator import safe_file, validate_dataset


ROOT = Path(__file__).resolve().parents[2]


def load(path):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result
    def invalid(value):
        raise ValueError(f"nonfinite JSON: {value}")
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs, parse_constant=invalid)


def main(argv=None):
    parser = argparse.ArgumentParser(description='R2-A offline dataset contract core')
    parser.add_argument('command', choices=['build','validate'])
    parser.add_argument('--input', required=True, help='Controlled bundle containing catalog and dataset seed')
    parser.add_argument('--plans', required=True, help='Versioned external plan registry')
    parser.add_argument('--output', required=True, help='Dataset envelope path')
    parser.add_argument('--generated-at', help='Explicit timestamp for deterministic offline builds; defaults to current UTC')
    args=parser.parse_args(argv)
    try:
        bundle=load(safe_file(ROOT,args.input))
        plans=load(safe_file(ROOT,args.plans))
        target=(ROOT/args.output).resolve()
        # Output may not exist yet, but still must stay within the repository.
        from .validator import _safe_relative_path
        if not _safe_relative_path(args.output) or ':' in args.output or '\\' in args.output or not target.is_relative_to(ROOT.resolve()):
            raise ValueError('unsafe output path')
        if args.command=='build':
            dataset=build_dataset(bundle['dataset'],bundle['catalog'],plans=plans,artifact_root=ROOT,
                                  generated_at=args.generated_at or utc_now_iso())
            payload=render_catalog(dataset).encode('utf-8')
            # A sealed version is append-only. Same bytes is an idempotent rebuild.
            if target.exists() and target.read_bytes()!=payload:
                raise ValueError('sealed output differs; use a new dataset version/output path')
            atomic_write_bytes(target,payload)
        else:
            dataset=load(safe_file(ROOT,args.output))
            errors=validate_dataset(dataset,bundle['catalog'],plans=plans,artifact_root=ROOT)
            if errors:
                raise ValueError('\n'.join(errors))
        manifest=dataset['manifest']
        print(json.dumps({'status':'PASS', **{k:manifest[k] for k in
              ('planId','datasetContentSha256','admissionStatus','coverageSummary')}},ensure_ascii=False,indent=2))
        return 0
    except (ValueError,KeyError,TypeError,OSError) as exc:
        print(json.dumps({'status':'FAIL','errors':[str(exc)]},ensure_ascii=False))
        return 1


if __name__=='__main__':
    raise SystemExit(main())
