import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new Database(join(dataDir, 'checklist.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'Member',
      department TEXT,
      notify_inapp INTEGER NOT NULL DEFAULT 1,
      notify_email INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS template_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      default_duration_days INTEGER NOT NULL DEFAULT 1,
      default_role TEXT,
      requires_attachment INTEGER NOT NULL DEFAULT 0,
      depends_on_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      template_id INTEGER REFERENCES templates(id),
      template_version INTEGER,
      manager_id INTEGER REFERENCES users(id),
      start_date TEXT,
      target_end_date TEXT,
      budget REAL,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      template_step_id INTEGER,
      order_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      assignee_id INTEGER REFERENCES users(id),
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'Not Started',
      requires_attachment INTEGER NOT NULL DEFAULT 0,
      depends_on_id INTEGER,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_step_id INTEGER NOT NULL REFERENCES project_steps(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      is_done INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      project_step_id INTEGER,
      actor_id INTEGER,
      action TEXT NOT NULL,
      from_value TEXT,
      to_value TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      channel TEXT NOT NULL DEFAULT 'in-app',
      is_read INTEGER NOT NULL DEFAULT 0,
      email_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

export default db
