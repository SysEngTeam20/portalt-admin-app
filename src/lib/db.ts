import { v4 as uuidv4 } from 'uuid';
import db from './sqlite';
import { MongoClient, Collection as MongoCollection, Db, Document } from 'mongodb';

// MongoDB client for production environments
let mongoClient: MongoClient | null = null;
let isMongoMode = false;

// Utility function to safely log objects without circular references
export function safeLog(obj: any, label?: string): void {
  try {
    // For MongoDB client or cursors, just log a simplified version
    if (
      obj && typeof obj === 'object' && 
      (
        (obj.constructor && obj.constructor.name === 'MongoClient') ||
        obj.s && obj.s.sessionPool
      )
    ) {
      console.log(label || 'Object', '[MongoDB Client or Cursor - not serializable]');
      return;
    }
    
    // For other objects, try to stringify with a replacer function
    const seen = new WeakSet();
    const replacer = (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
    
    const serialized = JSON.stringify(obj, replacer);
    console.log(label || 'Object', serialized.length > 1000 
      ? serialized.substring(0, 1000) + '... (truncated)' 
      : serialized);
  } catch (err) {
    console.log(label || 'Object', '[Not serializable]');
  }
}

// The Collection class mimics MongoDB collection operations
export class SqliteCollection<T extends { _id?: string }> {
  private tableName: string;
  
  constructor(tableName: string) {
    this.tableName = tableName;
    this.ensureTableExists();
    this.ensureIndexes();
  }
  
  private ensureTableExists() {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
    } catch (error) {
      console.error(`Table creation failed for ${this.tableName}:`, error);
    }
  }
  
  private ensureIndexes() {
    try {
      // Create basic indexes for common query patterns
      if (this.tableName === 'scenes') {
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_scenes_activity 
          ON ${this.tableName}(json_extract(data, '$.activity_id'));
          
          CREATE INDEX IF NOT EXISTS idx_scenes_org 
          ON ${this.tableName}(json_extract(data, '$.orgId'));
        `);
      }

      if (this.tableName === 'scenes_configuration') {
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_scene_config 
          ON ${this.tableName}(json_extract(data, '$.scene_id'));
        `);
      }

      // General purpose indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_updated 
        ON ${this.tableName}(updated_at);
      `);
    } catch (error) {
      console.error(`Index creation failed for ${this.tableName}:`, error);
    }
  }
  
  // Find a single document by query - MongoDB compatible
  async findOne(query: any): Promise<T | null> {
    try {
      // Special case for _id query - use the primary key directly
      if (query._id && Object.keys(query).length === 1) {
        console.log('[SQLite] Looking up document by _id:', query._id);
        const stmt = db.prepare(`
          SELECT data FROM ${this.tableName}
          WHERE id = ?
        `);
        
        const row = stmt.get(query._id) as { data: string } | undefined;
        
        if (!row) {
          console.log('[SQLite] No document found with _id:', query._id);
          return null;
        }
        
        return JSON.parse(row.data) as T;
      }
      
      // Build WHERE clause using JSON_EXTRACT for each query parameter
      const conditions = Object.keys(query)
        .map(key => `json_extract(data, '$.${key}') = ?`)
        .join(' AND ');

      const stmt = db.prepare(`
        SELECT data FROM ${this.tableName}
        ${conditions ? `WHERE ${conditions}` : ''}
      `);
      
      const values = Object.values(query).map(v => {
        if (typeof v === 'boolean') return v ? 1 : 0;
        if (v instanceof Date) return v.toISOString();
        return v;
      });
      const row = stmt.get(...values) as { data: string } | undefined;
      
      if (!row) return null;
      
      return JSON.parse(row.data) as T;
    } catch (error) {
      console.error(`Error in findOne for ${this.tableName}:`, error);
      return null;
    }
  }
  
  // MongoDB-compatible find method
  find(query: any = {}) {
    const results = this.findDocuments(query);
    return {
      toArray: () => Promise.resolve(results),
      sort: () => this,
      limit: () => this,
      next: () => Promise.resolve(results[0] || null)
    };
  }

  // Internal implementation for find
  private findDocuments(query: any = {}): T[] {
    try {
      let stmt;
      let rows;
      
      if (Object.keys(query).length === 0) {
        // If no query, get all documents
        stmt = db.prepare(`SELECT data FROM ${this.tableName}`);
        rows = stmt.all() as { data: string }[];
      } else if (query._id && typeof query._id === 'object' && query._id.$in && Array.isArray(query._id.$in)) {
        // Handle $in queries for _id field (common MongoDB pattern)
        const idList = query._id.$in as string[];
        const placeholders = idList.map(() => '?').join(',');
        stmt = db.prepare(`
          SELECT data FROM ${this.tableName}
          WHERE id IN (${placeholders})
        `);
        rows = stmt.all(...idList) as { data: string }[];
        console.log(`[SQLite] Found ${rows.length} documents matching _id in list of ${idList.length}`);
      } else if (query._id && typeof query._id === 'string') {
        // Direct _id lookup
        stmt = db.prepare(`
          SELECT data FROM ${this.tableName}
          WHERE id = ?
        `);
        rows = stmt.all(query._id) as { data: string }[];
      } else {
        // If query exists, filter documents using JSON extraction
        // First, build WHERE conditions for each field
        const conditions = [];
        const values = [];
        
        for (const [key, value] of Object.entries(query)) {
          conditions.push(`json_extract(data, '$.${key}') = ?`);
          values.push(value);
        }
        
        const whereClause = conditions.join(' AND ');
        stmt = db.prepare(`
          SELECT data FROM ${this.tableName}
          WHERE ${whereClause}
        `);
        rows = stmt.all(...values) as { data: string }[];
      }
      
      return rows.map(row => JSON.parse(row.data) as T);
    } catch (error) {
      console.error(`Error in find for ${this.tableName}:`, error);
      return [];
    }
  }
  
  // MongoDB-compatible insertOne
  async insertOne(doc: T) {
    try {
      // Generate _id if not provided
      if (!doc._id) {
        doc._id = uuidv4();
      }
      
      const now = Date.now();
      const stmt = db.prepare(`
        INSERT INTO ${this.tableName} (id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(
        doc._id,
        JSON.stringify(doc),
        now,
        now
      );
      
      return Promise.resolve({
        acknowledged: true,
        insertedId: doc._id
      });
    } catch (error) {
      console.error(`Error in insertOne for ${this.tableName}:`, error);
      throw error;
    }
  }
  
  // MongoDB-compatible updateOne
  async updateOne(
    filter: Partial<T>,
    update: { $set?: Partial<T>, $addToSet?: Record<string, any>, $pull?: Record<string, any> }
  ) {
    try {
      // Find the document first
      const doc = await this.findOne(filter);
      if (!doc) {
        return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
      }
      
      let modified = false;
      
      // Apply $set updates
      if (update.$set) {
        Object.assign(doc, update.$set);
        modified = true;
      }
      
      // Apply $addToSet updates (similar to MongoDB's behavior)
      if (update.$addToSet) {
        for (const [key, value] of Object.entries(update.$addToSet)) {
          if (!Array.isArray(doc[key as keyof T])) {
            (doc as any)[key] = [];
          }
          
          const arr = (doc as any)[key] as any[];
          if (!arr.includes(value)) {
            arr.push(value);
            modified = true;
          }
        }
      }
      
      // Apply $pull updates (similar to MongoDB's behavior)
      if (update.$pull) {
        for (const [key, value] of Object.entries(update.$pull)) {
          if (Array.isArray(doc[key as keyof T])) {
            const arr = (doc as any)[key] as any[];
            const initialLength = arr.length;
            (doc as any)[key] = arr.filter(item => item !== value);
            modified = modified || arr.length !== initialLength;
          }
        }
      }
      
      if (modified) {
        const stmt = db.prepare(`
          UPDATE ${this.tableName}
          SET data = ?, updated_at = ?
          WHERE id = ?
        `);
        
        stmt.run(
          JSON.stringify(doc),
          Date.now(),
          doc._id
        );
        
        return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
      }
      
      return { matchedCount: 1, modifiedCount: 0, acknowledged: true };
    } catch (error) {
      console.error(`Error in updateOne for ${this.tableName}:`, error);
      throw error;
    }
  }
  
  // MongoDB-compatible deleteOne
  async deleteOne(filter: Partial<T>) {
    try {
      // Find the document first to get its ID
      const doc = await this.findOne(filter);
      if (!doc || !doc._id) {
        return { deletedCount: 0, acknowledged: true };
      }
      
      const stmt = db.prepare(`
        DELETE FROM ${this.tableName}
        WHERE id = ?
      `);
      
      const result = stmt.run(doc._id);
      return { deletedCount: result.changes, acknowledged: true };
    } catch (error) {
      console.error(`Error in deleteOne for ${this.tableName}:`, error);
      throw error;
    }
  }
  
  // Create a JSON query string helper
  private createQueryString(query: Partial<T>): string {
    // A simple approach - in a real app you'd want more sophisticated JSON querying
    return JSON.stringify(query).replace(/[{}]/g, '');
  }
}

// Relations handler for many-to-many relationships
export class Relations {
  static async getDocumentsByActivityId(activityId: string): Promise<string[]> {
    if (isMongoMode) {
      // MongoDB implementation
      const client = getDbClient();
      const db = client.db("cluster0");
      const activitiesCollection = db.collection("activities");
      
      const activity = await activitiesCollection.findOne({ _id: activityId }) as Document;
      return activity?.documentIds || [];
    }
    
    // SQLite implementation
    try {
      console.log('[RELATIONS] Getting documents for activity:', activityId);
      
      // First check if the activity_documents table exists
      const tableCheck = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='activity_documents'
      `).get();
      
      if (!tableCheck) {
        console.log('[RELATIONS] The activity_documents table does not exist, creating it');
        // Create the table if it doesn't exist
        db.exec(`
          CREATE TABLE IF NOT EXISTS activity_documents (
            activity_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
            PRIMARY KEY (activity_id, document_id)
          )
        `);
        return []; // No documents yet since the table was just created
      }
      
      // Now try to get documents
      try {
        // First check if the created_at column exists
        const colCheck = db.prepare(`PRAGMA table_info(activity_documents)`).all();
        const hasCreatedAt = colCheck.some((col: any) => col.name === 'created_at');
        
        let stmt;
        if (hasCreatedAt) {
          console.log('[RELATIONS] Using query with created_at ordering');
          stmt = db.prepare(`
            SELECT document_id FROM activity_documents
            WHERE activity_id = ?
            ORDER BY created_at DESC
          `);
        } else {
          console.log('[RELATIONS] Using simple query without created_at');
          stmt = db.prepare(`
            SELECT document_id FROM activity_documents
            WHERE activity_id = ?
          `);
        }
        
        const rows = stmt.all(activityId) as { document_id: string }[];
        console.log(`[RELATIONS] Found ${rows.length} documents:`, rows);
        
        return rows.map(row => row.document_id);
      } catch (queryError) {
        console.error("[RELATIONS] Error querying documents:", queryError);
        
        // One last try with the simplest possible query
        try {
          const stmt = db.prepare(`
            SELECT * FROM activity_documents
            WHERE activity_id = ?
          `);
          
          const rows = stmt.all(activityId) as any[];
          console.log('[RELATIONS] Fallback query results:', rows);
          
          if (rows.length > 0 && rows[0].document_id) {
            return rows.map(row => row.document_id);
          } else if (rows.length > 0) {
            // Try to extract document_id from whatever structure we got
            console.log('[RELATIONS] Unusual row structure, trying to extract document_id');
            const documentIds = rows
              .map(row => {
                const keys = Object.keys(row);
                const possibleKey = keys.find(k => 
                  k.toLowerCase().includes('document') || 
                  k.toLowerCase().includes('doc')
                );
                return possibleKey ? row[possibleKey] : null;
              })
              .filter(Boolean);
              
            if (documentIds.length > 0) {
              console.log('[RELATIONS] Extracted document IDs:', documentIds);
              return documentIds;
            }
          }
          
          // If we got here, we couldn't extract any document IDs
          console.log('[RELATIONS] No document IDs could be extracted from the results');
          return [];
        } catch (finalError) {
          console.error("[RELATIONS] Critical error getting documents:", finalError);
          return [];
        }
      }
    } catch (error) {
      console.error("[RELATIONS] Error getting documents:", error);
      return [];
    }
  }
  
  static async linkDocumentToActivity(documentId: string, activityId: string): Promise<void> {
    if (isMongoMode) {
      // MongoDB implementation
      const client = getDbClient();
      const db = client.db("cluster0");
      const activitiesCollection = db.collection("activities");
      
      // Update the activity to include the document ID
      await activitiesCollection.updateOne(
        { _id: activityId },
        { $addToSet: { documentIds: documentId } }
      );
      
      return;
    }
    
    // SQLite implementation
    try {
      console.log('[RELATIONS] Linking document to activity:', { documentId, activityId });
      
      // First, verify the activity and document exist
      const activityStmt = db.prepare(`
        SELECT id FROM activities
        WHERE id = ?
      `);
      const activity = activityStmt.get(activityId);
      
      if (!activity) {
        console.error('[RELATIONS] Activity not found:', activityId);
        return;
      }
      
      const documentStmt = db.prepare(`
        SELECT id FROM documents
        WHERE id = ?
      `);
      const document = documentStmt.get(documentId);
      
      if (!document) {
        console.error('[RELATIONS] Document not found:', documentId);
        return;
      }
      
      // Now create the relation
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO activity_documents (activity_id, document_id, created_at)
        VALUES (?, ?, ?)
      `);
      
      stmt.run(activityId, documentId, Date.now());
      console.log('[RELATIONS] Successfully linked document to activity');
    } catch (error) {
      console.error("[RELATIONS] Error linking document:", error);
      // If created_at column doesn't exist, try without it
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO activity_documents (activity_id, document_id)
        VALUES (?, ?)
      `);
      
      stmt.run(activityId, documentId);
      console.log('[RELATIONS] Successfully linked document to activity (fallback)');
    }
  }
  
  static async unlinkDocumentFromActivity(documentId: string, activityId: string): Promise<void> {
    if (isMongoMode) {
      // MongoDB implementation
      const client = getDbClient();
      const db = client.db("cluster0");
      const activitiesCollection = db.collection("activities");
      
      // Remove the document ID from the activity
      await activitiesCollection.updateOne(
        { _id: activityId },
        { $pull: { documentIds: documentId } }
      );
      
      return;
    }
    
    // SQLite implementation
    const stmt = db.prepare(`
      DELETE FROM activity_documents
      WHERE activity_id = ? AND document_id = ?
    `);
    
    stmt.run(activityId, documentId);
  }
  
  static async getActivitiesByDocumentId(documentId: string): Promise<string[]> {
    if (isMongoMode) {
      // MongoDB implementation
      const client = getDbClient();
      const db = client.db("cluster0");
      const activitiesCollection = db.collection("activities");
      
      const cursor = activitiesCollection.find({ documentIds: documentId });
      const activities = await cursor.toArray() as Document[];
      return activities.map((activity: Document) => activity._id as string);
    }
    
    // SQLite implementation
    try {
      // First try with created_at ordering
      const stmt = db.prepare(`
        SELECT activity_id FROM activity_documents
        WHERE document_id = ?
        ORDER BY created_at DESC
      `);
      
      const rows = stmt.all(documentId) as { activity_id: string }[];
      return rows.map(row => row.activity_id);
    } catch (error) {
      // If created_at column doesn't exist, fall back to simple query
      const stmt = db.prepare(`
        SELECT activity_id FROM activity_documents
        WHERE document_id = ?
      `);
      
      const rows = stmt.all(documentId) as { activity_id: string }[];
      return rows.map(row => row.activity_id);
    }
  }
  
  // Force link document to activity - more robust version that ensures linking works
  static async forceLinkDocumentToActivity(documentId: string, activityId: string): Promise<void> {
    console.log('[RELATIONS] Force-linking document to activity:', { documentId, activityId });
    
    if (isMongoMode) {
      // For MongoDB, use the normal method
      return this.linkDocumentToActivity(documentId, activityId);
    }
    
    // For SQLite, use a more direct approach that doesn't rely on verification
    try {
      // Create the activity_documents table if it doesn't exist (just to be sure)
      db.exec(`
        CREATE TABLE IF NOT EXISTS activity_documents (
          activity_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
          PRIMARY KEY (activity_id, document_id)
        )
      `);
      
      // Insert with the REPLACE strategy to avoid duplicates
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO activity_documents (activity_id, document_id, created_at)
        VALUES (?, ?, ?)
      `);
      
      stmt.run(activityId, documentId, Date.now());
      
      // Also update the document data with the activityId (if possible)
      try {
        const updateStmt = db.prepare(`
          UPDATE documents 
          SET data = json_set(data, '$.activityIds', json_array(?))
          WHERE id = ?
        `);
        updateStmt.run(activityId, documentId);
      } catch (err) {
        // If updating the document data fails, log but continue
        console.error('[RELATIONS] Could not update document activityIds:', err);
      }
      
      console.log('[RELATIONS] Force-link successful');
    } catch (error) {
      console.error("[RELATIONS] Error in force-linking document:", error);
      
      // Last resort - try the simplest possible statement
      try {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO activity_documents (activity_id, document_id)
          VALUES (?, ?)
        `);
        
        stmt.run(activityId, documentId);
        console.log('[RELATIONS] Basic force-link successful');
      } catch (finalError) {
        console.error("[RELATIONS] Critical error in force-linking document:", finalError);
        throw finalError;
      }
    }
  }
}

// Custom DB interface that can be used with both MongoDB and SQLite
export interface DbClient {
  db: (name: string) => {
    collection: <T extends { _id?: string }>(name: string) => any;
  };
}

// Export a database client with collections
export function getDbClient(): DbClient {
  // In production on Vercel, use MongoDB if MONGODB_URI is set
  const mongodbUri = process.env.MONGODB_URI;
  
  if (process.env.VERCEL === '1' && mongodbUri) {
    isMongoMode = true;
    console.log('Using MongoDB in production on Vercel');
    
    if (!mongoClient) {
      mongoClient = new MongoClient(mongodbUri);
    }
    
    // Wrap MongoDB client to ensure consistent interface
    return {
      db: (name: string) => {
        const mongoDb = mongoClient!.db(name);
        return {
          collection: <T extends { _id?: string }>(collectionName: string) => 
            mongoDb.collection(collectionName)
        };
      }
    };
  }
  
  // Otherwise use our SQLite implementation
  isMongoMode = false;
  console.log('Using SQLite implementation');
  return {
    db: (dbName: string) => {
      return {
        collection: <T extends { _id?: string }>(collectionName: string) => 
          new SqliteCollection<T>(collectionName)
      };
    }
  };
}

// Helper to check if we're in MongoDB mode
export function isUsingMongo(): boolean {
  return isMongoMode;
}

// Add new collection type for scene configurations
export interface SceneConfiguration {
  _id?: string;
  activity_id: string;
  scene_id: string;
  objects: {
    object_id: string;
    modelUrl: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  }[];
}