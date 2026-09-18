// Source-specific code-reviewed allowlist. Extending it requires plan/capture review.
export const EIA_ADDITIONAL_OWNERS = Object.freeze([
  {
    "plan": "config/industry/eia-production.v1.json",
    "artifact": "src/data/real/industry-eia-production.generated.json",
    "binding": "config/industry/eia-production-semantic-binding.v2.json",
    "bindingId": "eia-production.v1",
    "planHash": "0f094f5a39098954eb734beb488e585f1a83b458a8154f108c3f61efa5f70305",
    "manifest": "research-data/industry/eia-petroleum-production-v1/manifest.json",
    "manifestHash": "81b5aab7659fa53f31bff661a114a169a4f02bfa016bc3ccaa847916a3d01370"
  },
  {
    "plan": "config/industry/eia-exports.v1.json",
    "artifact": "src/data/real/industry-eia-exports.generated.json",
    "binding": "config/industry/eia-exports-semantic-binding.v2.json",
    "bindingId": "eia-exports.v1",
    "planHash": "0cc2e783a7137d6be0136793ee9511d583569b037ce560a302df9683b1074c11",
    "manifest": "research-data/industry/eia-petroleum-exports-v1/manifest.json",
    "manifestHash": "b4ea69a95b80e3e8a601b24d46bfd3b6e07c9377fea40f2cc59cb08fb8fda1a6"
  },
  {
    "plan": "config/industry/eia-refinery-input.v1.json",
    "artifact": "src/data/real/industry-eia-refinery-input.generated.json",
    "binding": "config/industry/eia-refinery-input-semantic-binding.v2.json",
    "bindingId": "eia-refinery-input.v1",
    "planHash": "3d0bc37fbbd9929caf6d004aa7f41e41a5d2c59c894626e89a1ae2592b889818",
    "manifest": "research-data/industry/eia-petroleum-refinery-input-v1/manifest.json",
    "manifestHash": "7d8087de31902269b821b25a71792ad8257ae7877862989c559ab9f227099d5d"
  }
].map(Object.freeze));
