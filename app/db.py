import os
import re
import sqlite3
from urllib.parse import parse_qs, unquote, urlparse
from contextlib import contextmanager
from typing import Optional

DB_URL = (os.getenv("DATABASE_URL") or "sqlite:///local.db").strip()
DB_SCHEMA = (os.getenv("DB_SCHEMA") or "").strip()


def _is_postgres(url: str) -> bool:
    scheme = urlparse(url).scheme.lower()
    return scheme in {"postgres", "postgresql", "postgresql+psycopg", "postgres+psycopg"}


def _extract_search_path(url: str) -> Optional[str]:
    if DB_SCHEMA:
        return DB_SCHEMA
    parsed = urlparse(url)
    qs = parse_qs(parsed.query or "")
    options = qs.get("options")
    if not options:
        return None
    # Render/psycopg URLs may encode search_path in several equivalent forms.
    for opt in options:
        decoded = unquote(opt)
        match = re.search(
            r"(?:--search_path=|-c\s*search_path=|-csearch_path=|search_path=)([A-Za-z0-9_]+)",
            decoded,
        )
        if match:
            return match.group(1)
    return None


def _rewrite_query(query: str) -> str:
    q = query.replace("?", "%s")
    q = q.replace("json(%s)", "%s::jsonb")
    if re.search(r"(?i)\bINSERT\s+OR\s+IGNORE\b", q):
        q = re.sub(r"(?i)INSERT\s+OR\s+IGNORE\s+INTO\s+", "INSERT INTO ", q)
        if "ON CONFLICT" not in q.upper():
            q = q.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"
    return q


class PgCursor:
    def __init__(self, cursor, conn):
        self._cursor = cursor
        self._conn = conn

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    @property
    def lastrowid(self):
        try:
            row = self._conn.execute("SELECT lastval() AS id").fetchone()
            if isinstance(row, dict):
                return row.get("id")
            if row and len(row) > 0:
                return row[0]
        except Exception:
            return None
        return None


class PgConn:
    def __init__(self, conn):
        self._conn = conn

    def execute(self, query, params=None):
        q = _rewrite_query(query)
        if params is None:
            cur = self._conn.execute(q)
        else:
            cur = self._conn.execute(q, params)
        return PgCursor(cur, self._conn)

    def executemany(self, query, params):
        q = _rewrite_query(query)
        return self._conn.executemany(q, params)

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def _connect():
    if DB_URL.startswith("sqlite:///"):
        path = DB_URL.replace("sqlite:///", "")
        conn = sqlite3.connect(path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    if _is_postgres(DB_URL):
        try:
            import psycopg
            from psycopg.rows import dict_row
        except Exception as exc:
            raise RuntimeError("psycopg is required for Postgres support") from exc
        conn = psycopg.connect(DB_URL, row_factory=dict_row)
        schema_name = _extract_search_path(DB_URL)
        if schema_name:
            conn.execute(f"SET search_path TO {schema_name}")
        return PgConn(conn)
    raise RuntimeError(f"Unsupported DATABASE_URL scheme: {urlparse(DB_URL).scheme}")


@contextmanager
def get_conn():
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()


def apply_schema():
    if _is_postgres(DB_URL):
        schema_path = os.path.join(os.path.dirname(__file__), "..", "db", "schema_postgres.sql")
        with open(schema_path, "r", encoding="utf-8") as f:
            ddl = f.read()
        with get_conn() as conn:
            schema_name = _extract_search_path(DB_URL)
            if schema_name:
                conn.execute(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")
                conn.execute(f"SET search_path TO {schema_name}")
            for stmt in ddl.split(";"):
                if stmt.strip():
                    conn.execute(stmt)
            conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_client INTEGER DEFAULT 0")
            conn.execute("ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS contract_code TEXT")
            conn.execute("ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS account_code TEXT")
            conn.execute("ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS comment TEXT")
            conn.execute("ALTER TABLE ad_accounts ADD COLUMN IF NOT EXISTS visible_to_client INTEGER DEFAULT 1")
            conn.execute("ALTER TABLE ad_accounts ADD COLUMN IF NOT EXISTS budget_total DOUBLE PRECISION")
            conn.execute("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS fee_config TEXT")
            conn.execute("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ")
            conn.execute("ALTER TABLE topups ADD COLUMN IF NOT EXISTS hold_applied INTEGER DEFAULT 0")
            conn.execute("ALTER TABLE user_tokens ADD COLUMN IF NOT EXISTS login_email TEXT")
            conn.execute("ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS tax_mode TEXT DEFAULT 'without_vat'")
            conn.execute("ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS issuer_type TEXT DEFAULT 'too'")
            conn.execute("ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS contract_number TEXT")
            conn.execute("ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS contract_date TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS amount_kind TEXT DEFAULT 'gross'")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS tax_mode TEXT DEFAULT 'without_vat'")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS vat_rate DOUBLE PRECISION DEFAULT 0")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS issuer_type TEXT DEFAULT 'too'")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS contract_number TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS contract_date TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS issuer_name TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS issuer_bin TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS issuer_iin TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS issuer_legal_address TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS issuer_factual_address TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS issuer_bank TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS issuer_iban TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS issuer_bic TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS issuer_kbe TEXT")
            conn.execute("ALTER TABLE wallet_topup_requests ADD COLUMN IF NOT EXISTS issuer_currency TEXT")
            conn.execute("""
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
              updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS agencies (
              id BIGSERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              slug TEXT NOT NULL UNIQUE,
              owner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
              status TEXT DEFAULT 'active',
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS agency_members (
              id BIGSERIAL PRIMARY KEY,
              agency_id BIGINT REFERENCES agencies(id) ON DELETE CASCADE,
              user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
              role TEXT NOT NULL DEFAULT 'client_viewer',
              status TEXT DEFAULT 'active',
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(agency_id, user_id)
            )
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS account_funding_events (
              id BIGSERIAL PRIMARY KEY,
              account_id BIGINT REFERENCES ad_accounts(id) ON DELETE CASCADE,
              user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
              platform TEXT NOT NULL,
              amount DOUBLE PRECISION NOT NULL,
              currency TEXT NOT NULL,
              amount_usd DOUBLE PRECISION,
              amount_kzt DOUBLE PRECISION,
              source_type TEXT NOT NULL,
              source_id BIGINT,
              source_key TEXT UNIQUE,
              note TEXT,
              created_by TEXT,
              reversed_by_event_id BIGINT,
              reversal_for_event_id BIGINT,
              voided_at TIMESTAMPTZ,
              voided_by TEXT,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS agency_ad_accounts (
              id BIGSERIAL PRIMARY KEY,
              agency_id BIGINT REFERENCES agencies(id) ON DELETE CASCADE,
              ad_account_id BIGINT REFERENCES ad_accounts(id) ON DELETE CASCADE,
              label TEXT,
              status TEXT DEFAULT 'active',
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(agency_id, ad_account_id)
            )
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS agency_user_account_access (
              id BIGSERIAL PRIMARY KEY,
              agency_id BIGINT REFERENCES agencies(id) ON DELETE CASCADE,
              user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
              agency_ad_account_id BIGINT REFERENCES agency_ad_accounts(id) ON DELETE CASCADE,
              access_level TEXT DEFAULT 'viewer',
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(agency_id, user_id, agency_ad_account_id)
            )
            """)
            conn.execute("ALTER TABLE account_funding_events ADD COLUMN IF NOT EXISTS reversed_by_event_id BIGINT")
            conn.execute("ALTER TABLE account_funding_events ADD COLUMN IF NOT EXISTS reversal_for_event_id BIGINT")
            conn.execute("ALTER TABLE account_funding_events ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ")
            conn.execute("ALTER TABLE account_funding_events ADD COLUMN IF NOT EXISTS voided_by TEXT")
            conn.execute("""
            CREATE TABLE IF NOT EXISTS user_accesses (
              id BIGSERIAL PRIMARY KEY,
              user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT,
              salt TEXT,
              role TEXT DEFAULT 'member',
              status TEXT DEFAULT 'active',
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS client_finance_documents (
              id BIGSERIAL PRIMARY KEY,
              user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
              document_type TEXT NOT NULL DEFAULT 'invoice',
              title TEXT NOT NULL,
              document_number TEXT,
              document_date TEXT,
              amount DOUBLE PRECISION,
              currency TEXT DEFAULT 'KZT',
              note TEXT,
              file_name TEXT,
              file_path TEXT NOT NULL,
              mime_type TEXT,
              uploaded_by TEXT,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
            """)
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS document_type TEXT")
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS title TEXT")
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS document_number TEXT")
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS document_date TEXT")
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS amount DOUBLE PRECISION")
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS currency TEXT")
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS note TEXT")
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS file_name TEXT")
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS file_path TEXT")
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS mime_type TEXT")
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS uploaded_by TEXT")
            conn.execute("ALTER TABLE client_finance_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP")
            conn.execute("""
            CREATE TABLE IF NOT EXISTS ad_account_stats (
              id BIGSERIAL PRIMARY KEY,
              platform TEXT NOT NULL,
              account_id BIGINT NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
              client_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              account_external_id TEXT,
              stat_date DATE NOT NULL,
              currency TEXT DEFAULT 'USD',
              spend DOUBLE PRECISION DEFAULT 0,
              impressions DOUBLE PRECISION DEFAULT 0,
              clicks DOUBLE PRECISION DEFAULT 0,
              raw_payload_json JSONB,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(account_id, stat_date)
            )
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS ad_account_finance_snapshots (
              account_id BIGINT PRIMARY KEY REFERENCES ad_accounts(id) ON DELETE CASCADE,
              platform TEXT NOT NULL,
              client_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              account_external_id TEXT,
              currency TEXT DEFAULT 'USD',
              spend_today DOUBLE PRECISION DEFAULT 0,
              spend_total DOUBLE PRECISION DEFAULT 0,
              optional_balance DOUBLE PRECISION,
              internal_client_balance DOUBLE PRECISION DEFAULT 0,
              remaining_balance DOUBLE PRECISION DEFAULT 0,
              last_synced_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_ad_account_stats_client_date ON ad_account_stats(client_id, stat_date)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_ad_account_stats_platform_date ON ad_account_stats(platform, stat_date)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_ad_account_finance_snapshots_client ON ad_account_finance_snapshots(client_id)")
            conn.commit()
        return
    schema_path = os.path.join(os.path.dirname(__file__), "..", "db", "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        ddl = f.read()
    with get_conn() as conn:
        conn.executescript(ddl)
        _ensure_table(
            conn,
            "user_tokens",
            """
            CREATE TABLE IF NOT EXISTS user_tokens (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              token TEXT NOT NULL UNIQUE,
              login_email TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """,
        )
        _ensure_table(
            conn,
            "user_accesses",
            """
            CREATE TABLE IF NOT EXISTS user_accesses (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT,
              salt TEXT,
              role TEXT DEFAULT 'member',
              status TEXT DEFAULT 'active',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """,
        )
        _ensure_table(
            conn,
            "account_requests",
            """
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
            """,
        )
        _ensure_table(
            conn,
            "account_request_events",
            """
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
            """,
        )
        _ensure_table(
            conn,
            "wallets",
            """
            CREATE TABLE IF NOT EXISTS wallets (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER REFERENCES users(id),
              balance DOUBLE PRECISION DEFAULT 0,
              currency TEXT DEFAULT 'KZT',
              low_threshold DOUBLE PRECISION DEFAULT 50000,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """,
        )
        _ensure_table(
            conn,
            "wallet_transactions",
            """
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
            """,
        )
        _ensure_table(
            conn,
            "user_profiles",
            """
            CREATE TABLE IF NOT EXISTS user_profiles (
              user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
              name TEXT,
              company TEXT,
              language TEXT DEFAULT 'ru',
              whatsapp_phone TEXT,
              telegram_handle TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """,
        )
        _ensure_table(
            conn,
            "user_documents",
            """
            CREATE TABLE IF NOT EXISTS user_documents (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              title TEXT NOT NULL,
              file_path TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """,
        )
        _ensure_table(
            conn,
            "client_finance_documents",
            """
            CREATE TABLE IF NOT EXISTS client_finance_documents (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              document_type TEXT NOT NULL DEFAULT 'invoice',
              title TEXT NOT NULL,
              document_number TEXT,
              document_date TEXT,
              amount DOUBLE PRECISION,
              currency TEXT DEFAULT 'KZT',
              note TEXT,
              file_name TEXT,
              file_path TEXT NOT NULL,
              mime_type TEXT,
              uploaded_by TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """,
        )
        _ensure_table(
            conn,
            "wallet_topup_requests",
            """
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
            """,
        )
        _ensure_table(
            conn,
            "account_funding_events",
            """
            CREATE TABLE IF NOT EXISTS account_funding_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              account_id INTEGER REFERENCES ad_accounts(id) ON DELETE CASCADE,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              platform TEXT NOT NULL,
              amount DOUBLE PRECISION NOT NULL,
              currency TEXT NOT NULL,
              amount_usd DOUBLE PRECISION,
              amount_kzt DOUBLE PRECISION,
              source_type TEXT NOT NULL,
              source_id INTEGER,
              source_key TEXT UNIQUE,
              note TEXT,
              created_by TEXT,
              reversed_by_event_id INTEGER,
              reversal_for_event_id INTEGER,
              voided_at TEXT,
              voided_by TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """,
        )
        _ensure_table(
            conn,
            "agencies",
            """
            CREATE TABLE IF NOT EXISTS agencies (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              slug TEXT NOT NULL UNIQUE,
              owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
              status TEXT DEFAULT 'active',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """,
        )
        _ensure_table(
            conn,
            "agency_members",
            """
            CREATE TABLE IF NOT EXISTS agency_members (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              agency_id INTEGER REFERENCES agencies(id) ON DELETE CASCADE,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              role TEXT NOT NULL DEFAULT 'client_viewer',
              status TEXT DEFAULT 'active',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(agency_id, user_id)
            );
            """,
        )
        _ensure_table(
            conn,
            "agency_ad_accounts",
            """
            CREATE TABLE IF NOT EXISTS agency_ad_accounts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              agency_id INTEGER REFERENCES agencies(id) ON DELETE CASCADE,
              ad_account_id INTEGER REFERENCES ad_accounts(id) ON DELETE CASCADE,
              label TEXT,
              status TEXT DEFAULT 'active',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(agency_id, ad_account_id)
            );
            """,
        )
        _ensure_table(
            conn,
            "agency_user_account_access",
            """
            CREATE TABLE IF NOT EXISTS agency_user_account_access (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              agency_id INTEGER REFERENCES agencies(id) ON DELETE CASCADE,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              agency_ad_account_id INTEGER REFERENCES agency_ad_accounts(id) ON DELETE CASCADE,
              access_level TEXT DEFAULT 'viewer',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(agency_id, user_id, agency_ad_account_id)
            );
            """,
        )
        _ensure_table(
            conn,
            "legal_entities",
            """
            CREATE TABLE IF NOT EXISTS legal_entities (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              issuer_type TEXT DEFAULT 'too',
              tax_mode TEXT DEFAULT 'without_vat',
              contract_number TEXT,
              contract_date TEXT,
              bin TEXT,
              address TEXT,
              email TEXT,
              bank TEXT,
              iban TEXT,
              bic TEXT,
              kbe TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """,
        )
        _ensure_table(
            conn,
            "user_legal_entities",
            """
            CREATE TABLE IF NOT EXISTS user_legal_entities (
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              legal_entity_id INTEGER REFERENCES legal_entities(id) ON DELETE CASCADE,
              is_default INTEGER DEFAULT 0,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, legal_entity_id)
            );
            """,
        )
        _ensure_table(
            conn,
            "invoice_uploads",
            """
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
            """,
        )
        _ensure_table(
            conn,
            "invoice_counters",
            """
            CREATE TABLE IF NOT EXISTS invoice_counters (
              year INTEGER PRIMARY KEY,
              seq INTEGER NOT NULL
            );
            """,
        )
        _ensure_table(
            conn,
            "company_profile",
            """
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
            """,
        )
        _ensure_table(
            conn,
            "billing_issuers",
            """
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
            """,
        )
        _ensure_table(
            conn,
            "ad_account_stats",
            """
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
            """,
        )
        _ensure_table(
            conn,
            "ad_account_finance_snapshots",
            """
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
            """,
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ad_account_stats_client_date ON ad_account_stats(client_id, stat_date)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ad_account_stats_platform_date ON ad_account_stats(platform, stat_date)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ad_account_finance_snapshots_client ON ad_account_finance_snapshots(client_id)")
        _ensure_column(conn, "wallet_transactions", "account_id", "INTEGER")
        _ensure_column(conn, "client_finance_documents", "document_type", "TEXT")
        _ensure_column(conn, "client_finance_documents", "title", "TEXT")
        _ensure_column(conn, "client_finance_documents", "document_number", "TEXT")
        _ensure_column(conn, "client_finance_documents", "document_date", "TEXT")
        _ensure_column(conn, "client_finance_documents", "amount", "DOUBLE PRECISION")
        _ensure_column(conn, "client_finance_documents", "currency", "TEXT")
        _ensure_column(conn, "client_finance_documents", "note", "TEXT")
        _ensure_column(conn, "client_finance_documents", "file_name", "TEXT")
        _ensure_column(conn, "client_finance_documents", "mime_type", "TEXT")
        _ensure_column(conn, "client_finance_documents", "uploaded_by", "TEXT")
        _ensure_column(conn, "client_finance_documents", "updated_at", "TEXT")
        _ensure_column(conn, "user_profiles", "whatsapp_phone", "TEXT")
        _ensure_column(conn, "user_profiles", "telegram_handle", "TEXT")
        _ensure_column(conn, "user_profiles", "avatar_path", "TEXT")
        _ensure_column(conn, "user_profiles", "fee_config", "TEXT")
        _ensure_column(conn, "user_profiles", "notifications_seen_at", "TEXT")
        _ensure_column(conn, "invoice_uploads", "status", "TEXT")
        _ensure_column(conn, "invoice_uploads", "updated_at", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "legal_entity_id", "INTEGER")
        _ensure_column(conn, "wallet_topup_requests", "invoice_number", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "invoice_date", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "amount_kind", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "issuer_type", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "tax_mode", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "vat_rate", "DOUBLE PRECISION")
        _ensure_column(conn, "wallet_topup_requests", "contract_number", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "contract_date", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "issuer_name", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "issuer_bin", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "issuer_iin", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "issuer_legal_address", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "issuer_factual_address", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "issuer_bank", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "issuer_iban", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "issuer_bic", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "issuer_kbe", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "issuer_currency", "TEXT")
        _ensure_column(conn, "legal_entities", "short_name", "TEXT")
        _ensure_column(conn, "legal_entities", "full_name", "TEXT")
        _ensure_column(conn, "legal_entities", "legal_address", "TEXT")
        _ensure_column(conn, "legal_entities", "issuer_type", "TEXT")
        _ensure_column(conn, "legal_entities", "tax_mode", "TEXT")
        _ensure_column(conn, "legal_entities", "contract_number", "TEXT")
        _ensure_column(conn, "legal_entities", "contract_date", "TEXT")
        _ensure_column(conn, "account_requests", "manager_email", "TEXT")
        _ensure_column(conn, "account_requests", "contract_code", "TEXT")
        _ensure_column(conn, "account_requests", "account_code", "TEXT")
        _ensure_column(conn, "account_requests", "comment", "TEXT")
        _ensure_column(conn, "users", "password_hash", "TEXT")
        _ensure_column(conn, "users", "salt", "TEXT")
        _ensure_column(conn, "user_tokens", "login_email", "TEXT")
        _ensure_column(conn, "users", "is_client", "INTEGER")
        _ensure_column(conn, "ad_accounts", "user_id", "INTEGER")
        _ensure_column(conn, "ad_accounts", "account_code", "TEXT")
        _ensure_column(conn, "ad_accounts", "visible_to_client", "INTEGER")
        _ensure_column(conn, "ad_accounts", "budget_total", "DOUBLE PRECISION")
        _ensure_column(conn, "topups", "user_id", "INTEGER")
        _ensure_column(conn, "topups", "seen_by_admin", "INTEGER")
        _ensure_column(conn, "topups", "hold_applied", "INTEGER")
        _ensure_column(conn, "account_funding_events", "reversed_by_event_id", "INTEGER")
        _ensure_column(conn, "account_funding_events", "reversal_for_event_id", "INTEGER")
        _ensure_column(conn, "account_funding_events", "voided_at", "TEXT")
        _ensure_column(conn, "account_funding_events", "voided_by", "TEXT")
        _ensure_column(conn, "ad_account_stats", "platform", "TEXT")
        _ensure_column(conn, "ad_account_stats", "account_id", "INTEGER")
        _ensure_column(conn, "ad_account_stats", "client_id", "INTEGER")
        _ensure_column(conn, "ad_account_stats", "account_external_id", "TEXT")
        _ensure_column(conn, "ad_account_stats", "stat_date", "TEXT")
        _ensure_column(conn, "ad_account_stats", "currency", "TEXT")
        _ensure_column(conn, "ad_account_stats", "spend", "DOUBLE PRECISION")
        _ensure_column(conn, "ad_account_stats", "impressions", "DOUBLE PRECISION")
        _ensure_column(conn, "ad_account_stats", "clicks", "DOUBLE PRECISION")
        _ensure_column(conn, "ad_account_stats", "raw_payload_json", "TEXT")
        _ensure_column(conn, "ad_account_stats", "updated_at", "TEXT")
        _ensure_column(conn, "ad_account_finance_snapshots", "platform", "TEXT")
        _ensure_column(conn, "ad_account_finance_snapshots", "client_id", "INTEGER")
        _ensure_column(conn, "ad_account_finance_snapshots", "account_external_id", "TEXT")
        _ensure_column(conn, "ad_account_finance_snapshots", "currency", "TEXT")
        _ensure_column(conn, "ad_account_finance_snapshots", "spend_today", "DOUBLE PRECISION")
        _ensure_column(conn, "ad_account_finance_snapshots", "spend_total", "DOUBLE PRECISION")
        _ensure_column(conn, "ad_account_finance_snapshots", "optional_balance", "DOUBLE PRECISION")
        _ensure_column(conn, "ad_account_finance_snapshots", "internal_client_balance", "DOUBLE PRECISION")
        _ensure_column(conn, "ad_account_finance_snapshots", "remaining_balance", "DOUBLE PRECISION")
        _ensure_column(conn, "ad_account_finance_snapshots", "last_synced_at", "TEXT")
        _ensure_column(conn, "ad_account_finance_snapshots", "updated_at", "TEXT")
        conn.commit()


def _ensure_table(conn: sqlite3.Connection, name: str, ddl: str) -> None:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (name,),
    ).fetchone()
    if row:
        return
    conn.executescript(ddl)


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl_type: str) -> None:
    cols = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})")]
    if column in cols:
        return
    conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}")
