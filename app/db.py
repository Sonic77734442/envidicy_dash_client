import os
import sqlite3
from contextlib import contextmanager

DB_URL = os.getenv("DATABASE_URL", "sqlite:///local.db")


def _connect():
    if DB_URL.startswith("sqlite:///"):
        path = DB_URL.replace("sqlite:///", "")
        conn = sqlite3.connect(path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    raise RuntimeError("Only sqlite is supported in this stub. Set DATABASE_URL=sqlite:///path.db")


@contextmanager
def get_conn():
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()


def apply_schema():
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
            "wallet_topup_requests",
            """
            CREATE TABLE IF NOT EXISTS wallet_topup_requests (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER REFERENCES users(id),
              amount DOUBLE PRECISION NOT NULL,
              currency TEXT DEFAULT 'KZT',
              note TEXT,
              status TEXT DEFAULT 'requested',
              legal_entity_id INTEGER REFERENCES legal_entities(id),
              client_name TEXT,
              client_bin TEXT,
              client_address TEXT,
              client_email TEXT,
              order_ref TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
        _ensure_column(conn, "wallet_transactions", "account_id", "INTEGER")
        _ensure_column(conn, "user_profiles", "whatsapp_phone", "TEXT")
        _ensure_column(conn, "user_profiles", "telegram_handle", "TEXT")
        _ensure_column(conn, "invoice_uploads", "status", "TEXT")
        _ensure_column(conn, "invoice_uploads", "updated_at", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "legal_entity_id", "INTEGER")
        _ensure_column(conn, "wallet_topup_requests", "invoice_number", "TEXT")
        _ensure_column(conn, "wallet_topup_requests", "invoice_date", "TEXT")
        _ensure_column(conn, "legal_entities", "short_name", "TEXT")
        _ensure_column(conn, "legal_entities", "full_name", "TEXT")
        _ensure_column(conn, "legal_entities", "legal_address", "TEXT")
        _ensure_column(conn, "account_requests", "manager_email", "TEXT")
        _ensure_column(conn, "users", "password_hash", "TEXT")
        _ensure_column(conn, "users", "salt", "TEXT")
        _ensure_column(conn, "ad_accounts", "user_id", "INTEGER")
        _ensure_column(conn, "ad_accounts", "account_code", "TEXT")
        _ensure_column(conn, "topups", "user_id", "INTEGER")
        _ensure_column(conn, "topups", "seen_by_admin", "INTEGER")
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
