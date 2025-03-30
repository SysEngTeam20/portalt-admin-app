import { v4 as uuidv4 } from 'uuid';
import db from './sqlite';
import { MongoClient, Collection as MongoCollection, Db } from 'mongodb';

// MongoDB client for production environments
let mongoClient: MongoClient | null = null;

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
  private findDocuments(query: Partial<T> = {}): T[] {
    try {
      let stmt;
      let rows;
      
      if (Object.keys(query).length === 0) {
        // If no query, get all documents
        stmt = db.prepare(`SELECT data FROM ${this.tableName}`);
        rows = stmt.all() as { data: string }[];
      } else {
        // If query exists, filter documents
        stmt = db.prepare(`
          SELECT data FROM ${this.tableName}
          WHERE data LIKE ?
        `);
        const queryStr = this.createQueryString(query);
        rows = stmt.all(`%${queryStr}%`) as { data: string }[];
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
  static async linkDocumentToActivity(documentId: string, activityId: string): Promise<void> {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO activity_documents (activity_id, document_id)
      VALUES (?, ?)
    `);
    
    stmt.run(activityId, documentId);
  }
  
  static async unlinkDocumentFromActivity(documentId: string, activityId: string): Promise<void> {
    const stmt = db.prepare(`
      DELETE FROM activity_documents
      WHERE activity_id = ? AND document_id = ?
    `);
    
    stmt.run(activityId, documentId);
  }
  
  static getDocumentsByActivityId(activityId: string): string[] {
    const stmt = db.prepare(`
      SELECT document_id FROM activity_documents
      WHERE activity_id = ?
    `);
    
    const rows = stmt.all(activityId) as { document_id: string }[];
    return rows.map(row => row.document_id);
  }
  
  static getActivitiesByDocumentId(documentId: string): string[] {
    const stmt = db.prepare(`
      SELECT activity_id FROM activity_documents
      WHERE document_id = ?
    `);
    
    const rows = stmt.all(documentId) as { activity_id: string }[];
    return rows.map(row => row.activity_id);
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
  const isVercel = process.env.VERCEL === '1';
  const mongodbUri = process.env.MONGODB_URI;
  
  if (isVercel && mongodbUri) {
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