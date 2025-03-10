import { v4 as uuidv4 } from 'uuid';
import db from './sqlite';

// The Collection class mimics MongoDB collection operations
export class Collection<T extends { _id?: string }> {
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
  
  // Find a single document by query
  findOne(query: Partial<T>): T | null {
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
  
  // Find multiple documents by query
  find(query: Partial<T> = {}): T[] {
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
  
  // Insert a new document
  insertOne(doc: T): { insertedId: string } {
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
      
      return { insertedId: doc._id };
    } catch (error) {
      console.error(`Error in insertOne for ${this.tableName}:`, error);
      throw error;
    }
  }
  
  // Update an existing document
  updateOne(
    filter: Partial<T>,
    update: { $set?: Partial<T>, $addToSet?: Record<string, any>, $pull?: Record<string, any> }
  ): { matchedCount: number, modifiedCount: number } {
    try {
      // Find the document first
      const doc = this.findOne(filter);
      if (!doc) {
        return { matchedCount: 0, modifiedCount: 0 };
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
        
        return { matchedCount: 1, modifiedCount: 1 };
      }
      
      return { matchedCount: 1, modifiedCount: 0 };
    } catch (error) {
      console.error(`Error in updateOne for ${this.tableName}:`, error);
      throw error;
    }
  }
  
  // Delete a document
  deleteOne(filter: Partial<T>): { deletedCount: number } {
    try {
      // Find the document first to get its ID
      const doc = this.findOne(filter);
      if (!doc || !doc._id) {
        return { deletedCount: 0 };
      }
      
      const stmt = db.prepare(`
        DELETE FROM ${this.tableName}
        WHERE id = ?
      `);
      
      const result = stmt.run(doc._id);
      return { deletedCount: result.changes };
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

// Export a database client with collections
export function getDbClient() {
  return {
    db: function(dbName: string) {
      return {
        collection: function<T extends { _id?: string }>(collectionName: string) {
          return new Collection<T>(collectionName);
        }
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