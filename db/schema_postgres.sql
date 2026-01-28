CREATE TABLE IF NOT EXISTS campaigns (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fact_rows (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
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
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  salt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  company TEXT,
  language TEXT DEFAULT 'ru',
  whatsapp_phone TEXT,
  telegram_handle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  platform TEXT NOT NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  account_code TEXT,
  currency TEXT DEFAULT 'USD',
  budget_total DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  payload JSONB NOT NULL,
  account_code TEXT,
  manager_email TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_request_events (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES account_requests(id) ON DELETE CASCADE,
  admin_email TEXT,
  manager_email TEXT,
  type TEXT NOT NULL,
  status TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  balance DOUBLE PRECISION DEFAULT 0,
  currency TEXT DEFAULT 'KZT',
  low_threshold DOUBLE PRECISION DEFAULT 50000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  account_id BIGINT REFERENCES ad_accounts(id),
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'KZT',
  type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legal_entities (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  full_name TEXT,
  bin TEXT,
  address TEXT,
  legal_address TEXT,
  email TEXT,
  bank TEXT,
  iban TEXT,
  bic TEXT,
  kbe TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topups (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT REFERENCES ad_accounts(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id),
  amount_input DOUBLE PRECISION NOT NULL,
  fee_percent DOUBLE PRECISION DEFAULT 0,
  vat_percent DOUBLE PRECISION DEFAULT 0,
  amount_net DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'USD',
  fx_rate DOUBLE PRECISION,
  status TEXT DEFAULT 'pending',
  seen_by_admin INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_topup_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'KZT',
  note TEXT,
  status TEXT DEFAULT 'requested',
  legal_entity_id BIGINT REFERENCES legal_entities(id),
  client_name TEXT,
  client_bin TEXT,
  client_address TEXT,
  client_email TEXT,
  order_ref TEXT,
  invoice_number TEXT,
  invoice_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_legal_entities (
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  legal_entity_id BIGINT REFERENCES legal_entities(id) ON DELETE CASCADE,
  is_default INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, legal_entity_id)
);

CREATE TABLE IF NOT EXISTS invoice_uploads (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES wallet_topup_requests(id),
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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_documents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
