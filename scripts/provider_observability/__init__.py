"""Offline-safe provider stability observation and eligibility primitives."""

SCHEMA_VERSION = "2.0.0"
LEGACY_SCHEMA_VERSIONS = {"1.0.0"}
GATE_SCHEMA_VERSION = "1.0.0"
RUN_STATUSES = {"success", "partial", "failed"}
ELIGIBILITY_STATUSES = {
    "insufficient_observation_window", "observing", "qualified",
    "conditionally_qualified", "disqualified", "provider_unavailable", "blocked",
}
