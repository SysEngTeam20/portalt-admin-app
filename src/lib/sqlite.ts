import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Determine the appropriate data directory based on environment
const isVercel = process.env.VERCEL === '1';
const DATA_DIR = isVercel 
  ? path.join('/tmp', 'data') 
  : path.join(process.cwd(), 'data');

// Ensure the data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

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
      PRIMARY KEY (activity_id, document_id),
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
  `);
}

export default db; 