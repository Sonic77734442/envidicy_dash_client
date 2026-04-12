CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  payload JSON NOT NULL,
  result JSON NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fact_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  platform TEXT NOT NULL,
  ad_account_id TEXT,
  campaign_name TEXT,
  impressions DOUBLE PRECISION DEFAULT 0,
  clicks DOUBLE PRECISION DEFAULT 0,
  cost DOUBLE PRECISION DEFAULT 0,
  leads DOUBLE PRECISION DEFAULT 0,
  conversions DOUBLE PRECISION DEFAULT 0,
  views DOUBLE PRECISION DEFAULT 0,
  raw JSON,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  salt TEXT,
  is_client INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agency_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER REFERENCES agencies(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'client_viewer',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agency_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  company TEXT,
  language TEXT DEFAULT 'ru',
  whatsapp_phone TEXT,
  telegram_handle TEXT,
  avatar_path TEXT,
  fee_config TEXT,
  notifications_seen_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  platform TEXT NOT NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  account_code TEXT,
  visible_to_client INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'USD',
  budget_total DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_account_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  account_id INTEGER NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_external_id TEXT,
  stat_date DATE NOT NULL,
  currency TEXT DEFAULT 'USD',
  spend DOUBLE PRECISION DEFAULT 0,
  impressions DOUBLE PRECISION DEFAULT 0,
  clicks DOUBLE PRECISION DEFAULT 0,
  raw_payload_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_ad_account_stats_client_date ON ad_account_stats(client_id, stat_date);
CREATE INDEX IF NOT EXISTS idx_ad_account_stats_platform_date ON ad_account_stats(platform, stat_date);

CREATE TABLE IF NOT EXISTS ad_account_finance_snapshots (
  account_id INTEGER PRIMARY KEY REFERENCES ad_accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_external_id TEXT,
  currency TEXT DEFAULT 'USD',
  spend_today DOUBLE PRECISION DEFAULT 0,
  spend_total DOUBLE PRECISION DEFAULT 0,
  optional_balance DOUBLE PRECISION,
  internal_client_balance DOUBLE PRECISION DEFAULT 0,
  remaining_balance DOUBLE PRECISION DEFAULT 0,
  last_synced_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ad_account_finance_snapshots_client ON ad_account_finance_snapshots(client_id);

CREATE TABLE IF NOT EXISTS agency_ad_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER REFERENCES agencies(id) ON DELETE CASCADE,
  ad_account_id INTEGER REFERENCES ad_accounts(id) ON DELETE CASCADE,
  label TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agency_id, ad_account_id)
);

CREATE TABLE IF NOT EXISTS agency_user_account_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER REFERENCES agencies(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  agency_ad_account_id INTEGER REFERENCES agency_ad_accounts(id) ON DELETE CASCADE,
  access_level TEXT DEFAULT 'viewer',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agency_id, user_id, agency_ad_account_id)
);

CREATE TABLE IF NOT EXISTS account_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  payload JSON NOT NULL,
  contract_code TEXT,
  account_code TEXT,
  comment TEXT,
  manager_email TEXT,
  status TEXT DEFAULT 'new',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_request_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER REFERENCES account_requests(id) ON DELETE CASCADE,
  admin_email TEXT,
  manager_email TEXT,
  type TEXT NOT NULL,
  status TEXT,
  comment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  balance DOUBLE PRECISION DEFAULT 0,
  currency TEXT DEFAULT 'KZT',
  low_threshold DOUBLE PRECISION DEFAULT 50000,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  account_id INTEGER REFERENCES ad_accounts(id),
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'KZT',
  type TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER REFERENCES ad_accounts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  amount_input DOUBLE PRECISION NOT NULL,
  fee_percent DOUBLE PRECISION DEFAULT 0,
  vat_percent DOUBLE PRECISION DEFAULT 0,
  amount_net DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'USD',
  fx_rate DOUBLE PRECISION,
  hold_applied INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  seen_by_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_topup_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'KZT',
  note TEXT,
  status TEXT DEFAULT 'requested',
  amount_kind TEXT DEFAULT 'gross',
  issuer_type TEXT DEFAULT 'too',
  tax_mode TEXT DEFAULT 'without_vat',
  vat_rate DOUBLE PRECISION DEFAULT 0,
  contract_number TEXT,
  contract_date TEXT,
  issuer_name TEXT,
  issuer_bin TEXT,
  issuer_iin TEXT,
  issuer_legal_address TEXT,
  issuer_factual_address TEXT,
  issuer_bank TEXT,
  issuer_iban TEXT,
  issuer_bic TEXT,
  issuer_kbe TEXT,
  issuer_currency TEXT,
  legal_entity_id INTEGER REFERENCES legal_entities(id),
  client_name TEXT,
  client_bin TEXT,
  client_address TEXT,
  client_email TEXT,
  order_ref TEXT,
  invoice_number TEXT,
  invoice_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS legal_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  short_name TEXT,
  full_name TEXT,
  issuer_type TEXT DEFAULT 'too',
  tax_mode TEXT DEFAULT 'without_vat',
  contract_number TEXT,
  contract_date TEXT,
  bin TEXT,
  address TEXT,
  legal_address TEXT,
  email TEXT,
  bank TEXT,
  iban TEXT,
  bic TEXT,
  kbe TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_legal_entities (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  legal_entity_id INTEGER REFERENCES legal_entities(id) ON DELETE CASCADE,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, legal_entity_id)
);

CREATE TABLE IF NOT EXISTS billing_issuers (
  issuer_type TEXT PRIMARY KEY,
  name TEXT,
  bin TEXT,
  iin TEXT,
  legal_address TEXT,
  factual_address TEXT,
  bank TEXT,
  iban TEXT,
  bic TEXT,
  kbe TEXT,
  currency TEXT DEFAULT 'KZT',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER REFERENCES wallet_topup_requests(id),
  invoice_number TEXT,
  invoice_date TEXT,
  amount DOUBLE PRECISION,
  currency TEXT,
  client_name TEXT,
  client_bin TEXT,
  client_address TEXT,
  order_ref TEXT,
  pdf_path TEXT,
  status TEXT DEFAULT 'pending',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_counters (
  year INTEGER PRIMARY KEY,
  seq INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS company_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT,
  bin TEXT,
  iin TEXT,
  legal_address TEXT,
  factual_address TEXT,
  bank TEXT,
  iban TEXT,
  bic TEXT,
  kbe TEXT,
  currency TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
