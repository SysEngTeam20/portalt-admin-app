import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getDbClient, Relations, isUsingMongo } from "@/lib/db";
import db from "@/lib/sqlite";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Require authentication for security
    const { userId, orgId } = getAuth(req);
    if (!userId || !orgId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get activity ID from query
    const activityId = req.query.activityId as string | undefined;
    
    if (!activityId) {
      return res.status(400).json({ 
        message: "Activity ID is required",
        error: "MISSING_ACTIVITY_ID"
      });
    }

    const diagnosticInfo: any = {
      timestamp: new Date().toISOString(),
      activityId,
      dbMode: isUsingMongo() ? 'MongoDB' : 'SQLite'
    };

    // Get activity
    const client = getDbClient();
    const dbConn = client.db("cluster0");
    
    // Get activity
    const activitiesCollection = dbConn.collection("activities");
    const activity = await activitiesCollection.findOne({ _id: activityId });
    
    diagnosticInfo.activity = activity ? {
      _id: activity._id,
      name: activity.name,
      ragEnabled: activity.ragEnabled
    } : null;
    
    // Get document IDs
    const documentIds = await Relations.getDocumentsByActivityId(activityId);
    diagnosticInfo.documentIds = documentIds;
    
    // Get document details
    const documentsCollection = dbConn.collection("documents");
    const documents = [];
    
    for (const id of documentIds) {
      const doc = await documentsCollection.findOne({ _id: id });
      if (doc) {
        documents.push({
          _id: doc._id,
          filename: doc.filename,
          url: doc.url
        });
      } else {
        documents.push({ _id: id, error: 'Document not found' });
      }
    }
    
    diagnosticInfo.documents = documents;
    
    // If using SQLite, add raw table info
    if (!isUsingMongo()) {
      diagnosticInfo.sqlite = {
        tables: {}
      };
      
      try {
        // List tables
        const tables = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `).all();
        
        diagnosticInfo.sqlite.tables.list = tables;
        
        // Get activity_documents table info
        const tableInfo = db.prepare(`PRAGMA table_info(activity_documents)`).all();
        diagnosticInfo.sqlite.tables.activity_documents = {
          schema: tableInfo
        };
        
        // Get all relations
        const relations = db.prepare(`SELECT * FROM activity_documents WHERE activity_id = ?`).all(activityId);
        diagnosticInfo.sqlite.tables.activity_documents.relations = relations;
        
        // Get document table info for each document
        for (const id of documentIds) {
          const docRow = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(id);
          if (docRow) {
            diagnosticInfo.sqlite.documents = diagnosticInfo.sqlite.documents || {};
            diagnosticInfo.sqlite.documents[id] = docRow;
          }
        }
      } catch (err) {
        diagnosticInfo.sqlite.error = String(err);
      }
    }
    
    res.status(200).json(diagnosticInfo);
  } catch (error) {
    console.error("Diagnostic API error:", error);
    res.status(500).json({ 
      message: "Error running diagnostics",
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 