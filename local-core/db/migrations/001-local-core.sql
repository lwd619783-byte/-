CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE entity_registry (
  entity_id TEXT PRIMARY KEY NOT NULL CHECK(length(entity_id) = 36),
  entity_type TEXT NOT NULL CHECK(entity_type IN ('industry','theme','instrument','company','macro_metric','account','asset')),
  canonical_name TEXT NOT NULL CHECK(length(trim(canonical_name)) > 0),
  status TEXT NOT NULL CHECK(status IN ('active','candidate','merged','archived')),
  market TEXT,
  exchange TEXT,
  ticker TEXT,
  parent_entity_id TEXT REFERENCES entity_registry(entity_id),
  merged_into_entity_id TEXT REFERENCES entity_registry(entity_id),
  user_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(user_confirmed IN (0,1)),
  revision INTEGER NOT NULL CHECK(revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(parent_entity_id IS NULL OR parent_entity_id <> entity_id),
  CHECK((status = 'merged' AND merged_into_entity_id IS NOT NULL AND merged_into_entity_id <> entity_id) OR (status <> 'merged' AND merged_into_entity_id IS NULL))
) STRICT;
CREATE INDEX entity_registry_type_name ON entity_registry(entity_type, canonical_name);
CREATE INDEX entity_registry_exchange_ticker ON entity_registry(exchange, ticker);
CREATE TABLE entity_aliases (
  entity_id TEXT NOT NULL REFERENCES entity_registry(entity_id),
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL CHECK(length(normalized_alias) > 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY(entity_id, normalized_alias)
) STRICT;
CREATE INDEX entity_aliases_lookup ON entity_aliases(normalized_alias);
CREATE TABLE entity_provider_identifiers (
  entity_id TEXT NOT NULL REFERENCES entity_registry(entity_id),
  provider_id TEXT NOT NULL CHECK(length(trim(provider_id)) > 0),
  provider_identifier TEXT NOT NULL CHECK(length(trim(provider_identifier)) > 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY(provider_id, provider_identifier)
) STRICT;
CREATE INDEX entity_provider_identifiers_entity ON entity_provider_identifiers(entity_id);

CREATE TRIGGER entity_no_delete BEFORE DELETE ON entity_registry BEGIN
  SELECT RAISE(ABORT, 'entity_history_immutable');
END;
CREATE TRIGGER entity_no_replace BEFORE INSERT ON entity_registry
WHEN EXISTS(SELECT 1 FROM entity_registry WHERE entity_id = NEW.entity_id) BEGIN
  SELECT RAISE(ABORT, 'entity_history_immutable');
END;
CREATE TRIGGER entity_identity_immutable BEFORE UPDATE ON entity_registry
WHEN NEW.entity_id <> OLD.entity_id OR NEW.entity_type <> OLD.entity_type OR NEW.created_at <> OLD.created_at OR OLD.status = 'merged' OR NEW.revision <> OLD.revision + 1 BEGIN
  SELECT RAISE(ABORT, 'entity_identity_immutable');
END;

CREATE TABLE audit_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  actor_json TEXT NOT NULL CHECK(json_valid(actor_json)),
  client_json TEXT NOT NULL CHECK(json_valid(client_json)),
  operation TEXT NOT NULL,
  success INTEGER NOT NULL CHECK(success IN (0,1)),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX audit_events_request ON audit_events(request_id, created_at, event_id);
CREATE INDEX audit_events_timestamp ON audit_events(timestamp);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN
  SELECT RAISE(ABORT, 'audit_append_only');
END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN
  SELECT RAISE(ABORT, 'audit_append_only');
END;
CREATE TRIGGER audit_no_replace BEFORE INSERT ON audit_events
WHEN EXISTS(SELECT 1 FROM audit_events WHERE event_id = NEW.event_id) BEGIN
  SELECT RAISE(ABORT, 'audit_append_only');
END;
