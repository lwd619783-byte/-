-- Per-domain tables preserve the canonical V1 payload. Generated columns are
-- constrained/queryable persistence mappings, not a generic JSON object store.
CREATE TABLE confirmed_operations (
  operation_key TEXT PRIMARY KEY NOT NULL CHECK(length(trim(operation_key)) > 0),
  operation TEXT NOT NULL,
  approval_ref TEXT NOT NULL CHECK(length(trim(approval_ref)) > 0),
  request_digest TEXT NOT NULL CHECK(length(request_digest) = 64),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES audit_events(event_id),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64)
) STRICT;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(id)) > 0),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_extract(payload_json,'$.schemaVersion') = 'account.v1' AND json_extract(payload_json,'$.accountId') = id),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64),
  operation_key TEXT NOT NULL REFERENCES confirmed_operations(operation_key),
  account_type TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.accountType')) STORED NOT NULL CHECK(account_type IN ('brokerage','fund','bank','cash','physical_asset','insurance','crypto','other')),
  name TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.name')) STORED NOT NULL,
  base_currency TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.baseCurrency')) STORED NOT NULL,
  status TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.status')) STORED NOT NULL CHECK(status IN ('active','inactive','archived'))
) STRICT;
CREATE TABLE assets (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(id)) > 0),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_extract(payload_json,'$.schemaVersion') = 'asset.v1' AND json_extract(payload_json,'$.assetId') = id),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64),
  operation_key TEXT NOT NULL REFERENCES confirmed_operations(operation_key),
  instrument_id TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.instrumentId')) STORED REFERENCES entity_registry(entity_id),
  asset_type TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.assetType')) STORED NOT NULL CHECK(asset_type IN ('stock','etf','fund','cash','deposit','physical_gold','insurance','crypto','commodity_proxy','other')),
  primary_category TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.primaryCategory')) STORED NOT NULL,
  display_order INTEGER GENERATED ALWAYS AS (json_extract(payload_json,'$.displayOrder')) STORED NOT NULL
) STRICT;
CREATE INDEX assets_category_order ON assets(primary_category, display_order, id);
CREATE TABLE asset_tags (
  asset_id TEXT NOT NULL REFERENCES assets(id), tag TEXT NOT NULL, ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
  PRIMARY KEY(asset_id, tag), UNIQUE(asset_id, ordinal)
) STRICT;

CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(id)) > 0),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_extract(payload_json,'$.schemaVersion') = 'transaction.v1' AND json_extract(payload_json,'$.transactionId') = id),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64),
  operation_key TEXT NOT NULL REFERENCES confirmed_operations(operation_key),
  account_id TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.accountId')) STORED NOT NULL REFERENCES accounts(id),
  asset_id TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.assetId')) STORED NOT NULL REFERENCES assets(id),
  trade_date TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.tradeDate')) STORED NOT NULL,
  side TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.side')) STORED NOT NULL CHECK(side IN ('buy','sell','subscribe','redeem','acquire','dispose','adjustment')),
  quantity REAL GENERATED ALWAYS AS (json_extract(payload_json,'$.quantity')) STORED CHECK(quantity >= 0),
  price REAL GENERATED ALWAYS AS (json_extract(payload_json,'$.price.amount')) STORED CHECK(price >= 0),
  gross_amount REAL GENERATED ALWAYS AS (json_extract(payload_json,'$.grossAmount.amount')) STORED CHECK(gross_amount >= 0),
  fees REAL GENERATED ALWAYS AS (json_extract(payload_json,'$.fees.amount')) STORED CHECK(fees >= 0),
  net_amount REAL GENERATED ALWAYS AS (json_extract(payload_json,'$.netAmount.amount')) STORED CHECK(net_amount >= 0),
  reconciliation_status TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.reconciliationStatus')) STORED NOT NULL CHECK(reconciliation_status = 'confirmed'),
  CHECK(quantity IS NOT NULL OR gross_amount IS NOT NULL OR net_amount IS NOT NULL)
) STRICT;
CREATE INDEX transactions_position_date ON transactions(account_id, asset_id, trade_date, id);
CREATE TABLE cash_flows (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(id)) > 0),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_extract(payload_json,'$.schemaVersion') = 'cash-flow.v1' AND json_extract(payload_json,'$.cashFlowId') = id),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64),
  operation_key TEXT NOT NULL REFERENCES confirmed_operations(operation_key),
  account_id TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.accountId')) STORED NOT NULL REFERENCES accounts(id),
  date TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.date')) STORED NOT NULL,
  type TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.type')) STORED NOT NULL CHECK(type IN ('external_contribution','external_withdrawal','internal_transfer','dividend','interest','fee','salary','insurance_premium','other')),
  amount REAL GENERATED ALWAYS AS (json_extract(payload_json,'$.amount.amount')) STORED NOT NULL,
  currency TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.amount.currency')) STORED NOT NULL,
  paired_transfer_id TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.pairedTransferId')) STORED,
  CHECK(type NOT IN ('external_contribution','dividend','interest','salary') OR amount > 0),
  CHECK(type NOT IN ('external_withdrawal','fee','insurance_premium') OR amount < 0),
  CHECK((type = 'internal_transfer' AND coalesce(length(trim(paired_transfer_id)),0) > 0 AND amount <> 0) OR (type <> 'internal_transfer' AND paired_transfer_id IS NULL)),
  UNIQUE(paired_transfer_id, account_id)
) STRICT;
CREATE INDEX cash_flows_type_date ON cash_flows(type, date, account_id);
CREATE INDEX cash_flows_pair ON cash_flows(paired_transfer_id);
CREATE TABLE position_snapshots (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(id)) > 0),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_extract(payload_json,'$.schemaVersion') = 'position-snapshot.v1' AND json_extract(payload_json,'$.snapshotId') = id),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64),
  operation_key TEXT NOT NULL REFERENCES confirmed_operations(operation_key),
  account_id TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.accountId')) STORED NOT NULL REFERENCES accounts(id),
  asset_id TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.assetId')) STORED NOT NULL REFERENCES assets(id),
  snapshot_date TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.snapshotDate')) STORED NOT NULL,
  quantity REAL GENERATED ALWAYS AS (json_extract(payload_json,'$.quantity')) STORED NOT NULL CHECK(quantity >= 0)
) STRICT;
CREATE INDEX positions_account_date ON position_snapshots(account_id, asset_id, snapshot_date, id);

CREATE TABLE dca_plans (
  plan_id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(plan_id)) > 0),
  operation_key TEXT NOT NULL REFERENCES confirmed_operations(operation_key)
) STRICT;
CREATE TABLE dca_plan_revisions (
  plan_id TEXT NOT NULL REFERENCES dca_plans(plan_id), revision INTEGER NOT NULL CHECK(revision >= 1),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_extract(payload_json,'$.schemaVersion') = 'dca-plan.v1' AND json_extract(payload_json,'$.planId') = plan_id),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64),
  operation_key TEXT NOT NULL REFERENCES confirmed_operations(operation_key),
  asset_id TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.assetId')) STORED REFERENCES assets(id),
  primary_category TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.primaryCategory')) STORED,
  active_from TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.activeFrom')) STORED NOT NULL,
  planned_amount REAL GENERATED ALWAYS AS (json_extract(payload_json,'$.plannedAmount.amount')) STORED CHECK(planned_amount >= 0),
  CHECK(coalesce(length(trim(asset_id)),0) > 0 OR coalesce(length(trim(primary_category)),0) > 0),
  PRIMARY KEY(plan_id, revision), UNIQUE(plan_id, active_from)
) STRICT;
CREATE TABLE dca_constraints (
  plan_id TEXT NOT NULL, revision INTEGER NOT NULL, ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  constraint_type TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.constraintType')) STORED NOT NULL,
  effective_from TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.effectiveFrom')) STORED NOT NULL,
  effective_to TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.effectiveTo')) STORED,
  PRIMARY KEY(plan_id, revision, ordinal), FOREIGN KEY(plan_id, revision) REFERENCES dca_plan_revisions(plan_id, revision)
) STRICT;
CREATE TABLE dca_executions (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(id)) > 0),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_extract(payload_json,'$.schemaVersion') = 'dca-execution.v1' AND json_extract(payload_json,'$.executionId') = id),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64),
  operation_key TEXT NOT NULL REFERENCES confirmed_operations(operation_key),
  plan_id TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.planId')) STORED NOT NULL,
  plan_revision INTEGER NOT NULL,
  period TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.period')) STORED NOT NULL,
  planned_amount REAL GENERATED ALWAYS AS (json_extract(payload_json,'$.plannedAmount.amount')) STORED NOT NULL CHECK(planned_amount >= 0),
  executed_amount REAL GENERATED ALWAYS AS (json_extract(payload_json,'$.executedAmount.amount')) STORED NOT NULL CHECK(executed_amount >= 0),
  pending_amount REAL GENERATED ALWAYS AS (json_extract(payload_json,'$.pendingAmount.amount')) STORED NOT NULL CHECK(pending_amount >= 0),
  rollover_from TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.rolloverFromExecutionId')) STORED UNIQUE REFERENCES dca_executions(id),
  status TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.status')) STORED NOT NULL CHECK(status IN ('planned','partial','completed','deferred','cancelled')),
  CHECK(rollover_from IS NULL OR rollover_from <> id),
  CHECK(status <> 'completed' OR (executed_amount > 0 AND pending_amount = 0)),
  FOREIGN KEY(plan_id, plan_revision) REFERENCES dca_plan_revisions(plan_id, revision)
) STRICT;
CREATE TABLE dca_execution_transactions (
  execution_id TEXT NOT NULL REFERENCES dca_executions(id),
  transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
  PRIMARY KEY(execution_id, transaction_id)
) STRICT;

CREATE TABLE import_plans (
  plan_id TEXT PRIMARY KEY NOT NULL, import_id TEXT NOT NULL,
  plan_digest TEXT NOT NULL CHECK(length(plan_digest) = 64), state_digest TEXT NOT NULL CHECK(length(state_digest) = 64),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64)
) STRICT;
CREATE INDEX import_plans_import ON import_plans(import_id, plan_id);
CREATE TABLE import_fingerprints (
  key TEXT PRIMARY KEY NOT NULL, fact_digest TEXT NOT NULL CHECK(length(fact_digest) = 64),
  record_id TEXT NOT NULL, operation_key TEXT NOT NULL REFERENCES confirmed_operations(operation_key)
) STRICT;

CREATE TRIGGER operations_no_update BEFORE UPDATE ON confirmed_operations BEGIN SELECT RAISE(ABORT,'operation_immutable'); END;
CREATE TRIGGER operations_no_delete BEFORE DELETE ON confirmed_operations BEGIN SELECT RAISE(ABORT,'operation_immutable'); END;
CREATE TRIGGER operations_no_replace BEFORE INSERT ON confirmed_operations WHEN EXISTS(SELECT 1 FROM confirmed_operations WHERE operation_key=NEW.operation_key) BEGIN SELECT RAISE(ABORT,'operation_immutable'); END;
CREATE TRIGGER accounts_no_update BEFORE UPDATE ON accounts BEGIN SELECT RAISE(ABORT,'account_immutable'); END;
CREATE TRIGGER accounts_no_delete BEFORE DELETE ON accounts BEGIN SELECT RAISE(ABORT,'account_immutable'); END;
CREATE TRIGGER accounts_no_replace BEFORE INSERT ON accounts WHEN EXISTS(SELECT 1 FROM accounts WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'account_immutable'); END;
CREATE TRIGGER assets_no_update BEFORE UPDATE ON assets BEGIN SELECT RAISE(ABORT,'asset_immutable'); END;
CREATE TRIGGER assets_no_delete BEFORE DELETE ON assets BEGIN SELECT RAISE(ABORT,'asset_immutable'); END;
CREATE TRIGGER assets_no_replace BEFORE INSERT ON assets WHEN EXISTS(SELECT 1 FROM assets WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'asset_immutable'); END;
CREATE TRIGGER tags_no_update BEFORE UPDATE ON asset_tags BEGIN SELECT RAISE(ABORT,'asset_immutable'); END;
CREATE TRIGGER tags_no_delete BEFORE DELETE ON asset_tags BEGIN SELECT RAISE(ABORT,'asset_immutable'); END;
CREATE TRIGGER tags_no_replace BEFORE INSERT ON asset_tags WHEN EXISTS(SELECT 1 FROM asset_tags WHERE asset_id=NEW.asset_id AND (tag=NEW.tag OR ordinal=NEW.ordinal)) BEGIN SELECT RAISE(ABORT,'asset_immutable'); END;
CREATE TRIGGER transactions_no_update BEFORE UPDATE ON transactions BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
CREATE TRIGGER transactions_no_delete BEFORE DELETE ON transactions BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
CREATE TRIGGER transactions_no_replace BEFORE INSERT ON transactions WHEN EXISTS(SELECT 1 FROM transactions WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
CREATE TRIGGER cashflows_no_update BEFORE UPDATE ON cash_flows BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
CREATE TRIGGER cashflows_no_delete BEFORE DELETE ON cash_flows BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
CREATE TRIGGER cashflows_no_replace BEFORE INSERT ON cash_flows WHEN EXISTS(SELECT 1 FROM cash_flows WHERE id=NEW.id OR (paired_transfer_id=NEW.paired_transfer_id AND account_id=NEW.account_id)) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
CREATE TRIGGER positions_no_update BEFORE UPDATE ON position_snapshots BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
CREATE TRIGGER positions_no_delete BEFORE DELETE ON position_snapshots BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
CREATE TRIGGER positions_no_replace BEFORE INSERT ON position_snapshots WHEN EXISTS(SELECT 1 FROM position_snapshots WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
CREATE TRIGGER dcaplans_no_update BEFORE UPDATE ON dca_plans BEGIN SELECT RAISE(ABORT,'dca_immutable'); END;
CREATE TRIGGER dcaplans_no_delete BEFORE DELETE ON dca_plans BEGIN SELECT RAISE(ABORT,'dca_immutable'); END;
CREATE TRIGGER dcaplans_no_replace BEFORE INSERT ON dca_plans WHEN EXISTS(SELECT 1 FROM dca_plans WHERE plan_id=NEW.plan_id) BEGIN SELECT RAISE(ABORT,'dca_immutable'); END;
CREATE TRIGGER revisions_no_update BEFORE UPDATE ON dca_plan_revisions BEGIN SELECT RAISE(ABORT,'dca_revision_immutable'); END;
CREATE TRIGGER revisions_no_delete BEFORE DELETE ON dca_plan_revisions BEGIN SELECT RAISE(ABORT,'dca_revision_immutable'); END;
CREATE TRIGGER revisions_no_replace BEFORE INSERT ON dca_plan_revisions WHEN EXISTS(SELECT 1 FROM dca_plan_revisions WHERE plan_id=NEW.plan_id AND (revision=NEW.revision OR active_from=NEW.active_from)) BEGIN SELECT RAISE(ABORT,'dca_revision_immutable'); END;
CREATE TRIGGER constraints_no_update BEFORE UPDATE ON dca_constraints BEGIN SELECT RAISE(ABORT,'dca_revision_immutable'); END;
CREATE TRIGGER constraints_no_delete BEFORE DELETE ON dca_constraints BEGIN SELECT RAISE(ABORT,'dca_revision_immutable'); END;
CREATE TRIGGER constraints_no_replace BEFORE INSERT ON dca_constraints WHEN EXISTS(SELECT 1 FROM dca_constraints WHERE plan_id=NEW.plan_id AND revision=NEW.revision AND ordinal=NEW.ordinal) BEGIN SELECT RAISE(ABORT,'dca_revision_immutable'); END;
CREATE TRIGGER executions_no_update BEFORE UPDATE ON dca_executions BEGIN SELECT RAISE(ABORT,'dca_execution_immutable'); END;
CREATE TRIGGER executions_no_delete BEFORE DELETE ON dca_executions BEGIN SELECT RAISE(ABORT,'dca_execution_immutable'); END;
CREATE TRIGGER executions_no_replace BEFORE INSERT ON dca_executions WHEN EXISTS(SELECT 1 FROM dca_executions WHERE id=NEW.id OR rollover_from=NEW.rollover_from) BEGIN SELECT RAISE(ABORT,'dca_execution_immutable'); END;
CREATE TRIGGER executionlinks_no_update BEFORE UPDATE ON dca_execution_transactions BEGIN SELECT RAISE(ABORT,'dca_execution_immutable'); END;
CREATE TRIGGER executionlinks_no_delete BEFORE DELETE ON dca_execution_transactions BEGIN SELECT RAISE(ABORT,'dca_execution_immutable'); END;
CREATE TRIGGER executionlinks_no_replace BEFORE INSERT ON dca_execution_transactions WHEN EXISTS(SELECT 1 FROM dca_execution_transactions WHERE transaction_id=NEW.transaction_id) BEGIN SELECT RAISE(ABORT,'dca_execution_immutable'); END;
CREATE TRIGGER importplans_no_update BEFORE UPDATE ON import_plans BEGIN SELECT RAISE(ABORT,'import_plan_immutable'); END;
CREATE TRIGGER importplans_no_delete BEFORE DELETE ON import_plans BEGIN SELECT RAISE(ABORT,'import_plan_immutable'); END;
CREATE TRIGGER importplans_no_replace BEFORE INSERT ON import_plans WHEN EXISTS(SELECT 1 FROM import_plans WHERE plan_id=NEW.plan_id) BEGIN SELECT RAISE(ABORT,'import_plan_immutable'); END;
CREATE TRIGGER fingerprints_no_update BEFORE UPDATE ON import_fingerprints BEGIN SELECT RAISE(ABORT,'import_fingerprint_immutable'); END;
CREATE TRIGGER fingerprints_no_delete BEFORE DELETE ON import_fingerprints BEGIN SELECT RAISE(ABORT,'import_fingerprint_immutable'); END;
CREATE TRIGGER fingerprints_no_replace BEFORE INSERT ON import_fingerprints WHEN EXISTS(SELECT 1 FROM import_fingerprints WHERE key=NEW.key) BEGIN SELECT RAISE(ABORT,'import_fingerprint_immutable'); END;
