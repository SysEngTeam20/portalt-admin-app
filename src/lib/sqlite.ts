import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Determine the appropriate data directory based on environment
const isVercel = process.env.VERCEL === '1';
const DATA_DIR = isVercel 
  ? path.join('/tmp', 'data') 
  : path.join(process.cwd(), '.data');

// Ensure the data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'sqlite.db');

// Create or open the SQLite database
let db: BetterSqlite3.Database;

// In development mode, use a global variable to maintain the connection
if (process.env.NODE_ENV === "development") {
  let globalWithSqlite = global as typeof globalThis & {
    _sqliteDatabase?: BetterSqlite3.Database;
  };

  if (!globalWithSqlite._sqliteDatabase) {
    globalWithSqlite._sqliteDatabase = new BetterSqlite3(DB_PATH);
    initDatabase(globalWithSqlite._sqliteDatabase);
  }
  db = globalWithSqlite._sqliteDatabase;
} else {
  // In production mode, create a new connection
  db = new BetterSqlite3(DB_PATH);
  initDatabase(db);
}

// Initialize database schema if needed
function initDatabase(database: BetterSqlite3.Database) {
  // Enable foreign keys
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  
  // Create tables
  database.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS activity_documents (
      activity_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (activity_id, document_id),
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_activity_documents_activity 
    ON activity_documents(activity_id);

    CREATE INDEX IF NOT EXISTS idx_activity_documents_document 
    ON activity_documents(document_id);

    CREATE INDEX IF NOT EXISTS idx_activity_documents_created 
    ON activity_documents(created_at);
  `);

  // Check if activity_documents table exists and has created_at column
  try {
    database.prepare('SELECT created_at FROM activity_documents LIMIT 1').get();
  } catch (error) {
    // If the column doesn't exist, add it
    database.exec(`
      ALTER TABLE activity_documents ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
      UPDATE activity_documents SET created_at = strftime('%s', 'now') * 1000;
    `);
  }

  // Log the current state of the tables
  try {
    const activityStmt = database.prepare('SELECT * FROM activities');
    const activities = activityStmt.all();
    console.log('[SQLITE] Current activities table state:', activities);
    
    const documentStmt = database.prepare('SELECT * FROM documents');
    const documents = documentStmt.all();
    console.log('[SQLITE] Current documents table state:', documents);
    
    const relationStmt = database.prepare('SELECT * FROM activity_documents');
    const relations = relationStmt.all();
    console.log('[SQLITE] Current activity_documents table state:', relations);
  } catch (error) {
    console.error('[SQLITE] Error checking tables:', error);
  }
}

export default db; 