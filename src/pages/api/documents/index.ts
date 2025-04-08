import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { v4 as uuidv4 } from 'uuid';
import { getDbClient, Relations, safeLog, isUsingMongo } from "@/lib/db";
import db from "@/lib/sqlite";
import { uploadDocument } from "@/lib/cos";
import { IncomingForm } from 'formidable';
import fs from 'fs';

// Disable the default body parser for this route since we're handling file uploads
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb'
  }
};

// Promisify formidable parsing
const parseForm = (req: NextApiRequest) => {
  return new Promise<{fields: any, files: any}>((resolve, reject) => {
    const form = new IncomingForm();
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    // GET list of organization's documents
    if (req.method === 'GET') {
      const activityId = req.query.activityId as string | undefined;

      console.log('[DOCUMENTS_API] Fetching documents:', { activityId, orgId });

      const client = getDbClient();
      const db = client.db("cluster0");
      const documentsCollection = db.collection("documents");

      let documents = [];
      
      if (activityId) {
        // First verify the activity exists
        console.log('[DOCUMENTS_API] Verifying activity exists:', activityId);
        const activitiesCollection = db.collection("activities");
        const activity = await activitiesCollection.findOne({ _id: activityId });
        
        if (!activity) {
          console.error(`[DOCUMENTS_API] Activity not found: ${activityId}`);
          return res.status(404).json({ 
            message: "Activity not found",
            error: "ACTIVITY_NOT_FOUND"
          });
        }
        
        // Activity exists, proceed to get associated documents
        console.log('[DOCUMENTS_API] Activity found, getting documents');
        
        // Get documents associated with the activity
        console.log('[DOCUMENTS_API] Getting documents for activity:', activityId);
        const documentIds = await Relations.getDocumentsByActivityId(activityId);
        console.log('[DOCUMENTS_API] Found document IDs:', documentIds);
        
        if (documentIds.length > 0) {
          // If using MongoDB, fetch in batch
          if (isUsingMongo()) {
            const cursor = documentsCollection.find({ 
              _id: { $in: documentIds },
              orgId 
            } as any);
            documents = await cursor.toArray();
          } else {
            // For SQLite, fetch one by one with better error handling
            const docs = [];
            for (const id of documentIds) {
              console.log('[DOCUMENTS_API] Fetching document by ID:', id);
              try {
                const doc = await documentsCollection.findOne({ _id: id });
                if (doc) {
                  // Verify organization ownership
                  if (doc.orgId === orgId) {
                    docs.push(doc);
                  } else {
                    console.log('[DOCUMENTS_API] Document belongs to different org:', {
                      docId: id,
                      docOrgId: doc.orgId,
                      requestOrgId: orgId
                    });
                  }
                } else {
                  console.log('[DOCUMENTS_API] Document not found:', id);
                }
              } catch (err) {
                console.error('[DOCUMENTS_API] Error fetching document:', id, err);
              }
            }
            documents = docs;
          }
        }
        console.log('[DOCUMENTS_API] Retrieved documents:', documents.length);
      } else {
        // Get all organization's documents
        console.log('[DOCUMENTS_API] Getting all documents for org:', orgId);
        const cursor = documentsCollection.find({ orgId } as any);
        documents = await cursor.toArray();
        console.log('[DOCUMENTS_API] Retrieved all documents:', documents.length);
      }

      return res.status(200).json(documents);
    }
    
    // POST upload new document
    else if (req.method === 'POST') {
      // Check if this is a direct registration (no file upload)
      if (req.headers['content-type']?.includes('application/json')) {
        // Manual JSON parsing since bodyParser is disabled
        let body;
        try {
          // Get the raw request body as a string
          const buffer = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks)));
            req.on('error', reject);
          });
          
          // Parse the JSON
          body = JSON.parse(buffer.toString());
          console.log('[DOCUMENTS_API] Received JSON body:', body);
        } catch (error) {
          console.error('[DOCUMENTS_API] Error parsing JSON body:', error);
          return res.status(400).json({
            message: "Failed to parse request body",
            error: "INVALID_JSON"
          });
        }
        
        const { filename, url, mimeType, activityId, size } = body;
        
        if (!filename || !url) {
          return res.status(400).json({ 
            message: "filename and url are required",
            error: "MISSING_REQUIRED_FIELDS"
          });
        }

        try {
          const client = getDbClient();
          const db = client.db("cluster0");
          const documentsCollection = db.collection("documents");

          // Create document metadata
          const document = {
            _id: uuidv4(),
            filename,
            originalName: filename,
            mimeType: mimeType || 'application/octet-stream',
            size: size || 0, // Use provided size or default to 0
            url,
            orgId,
            activityIds: activityId ? [activityId] : [] as string[],
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await documentsCollection.insertOne(document);
          
          // Create relation in relations table if activityId is provided
          if (activityId) {
            try {
              console.log('[DOCUMENTS_API] Linking document to activity:', {
                documentId: document._id,
                activityId
              });
              
              if (!isUsingMongo()) {
                // Direct database link - create a raw SQL statement for better compatibility
                console.log('[DOCUMENTS_API] Using direct linking to bypass Relations class');
                await Relations.forceLinkDocumentToActivity(document._id, activityId);
              } else {
                // Use Relations helper for MongoDB
                await Relations.linkDocumentToActivity(document._id, activityId);
              }
              
              console.log('[DOCUMENTS_API] Successfully linked document to activity');
            } catch (error) {
              console.error("[DOCUMENTS_API] Error linking document to activity:", error);
              // Continue anyway since the document was created
            }
          }
          
          return res.status(201).json(document);
        } catch (error) {
          console.error("[DOCUMENTS_API] Registration error:", error);
          return res.status(500).json({ 
            message: "Failed to register document",
            error: "REGISTRATION_ERROR"
          });
        }
      }

      // Handle file upload (existing code)
      const { files, fields } = await parseForm(req);
      const fileEntry = files.file;
      const activityId = fields.activityId ? String(fields.activityId) : null;
      
      if (!fileEntry) {
        return res.status(400).json({ 
          message: "File is required",
          error: "MISSING_FILE"
        });
      }
      
      // Handle both single file and array of files (formidable can return either)
      const file = Array.isArray(fileEntry) ? fileEntry[0] : fileEntry;
      
      if (!file) {
        return res.status(400).json({ 
          message: "File is required",
          error: "MISSING_FILE"
        });
      }

      // Check file size (50MB limit)
      const fileSize = fs.statSync(file.filepath).size;
      if (fileSize > 50 * 1024 * 1024) {
        return res.status(413).json({ 
          message: "File size exceeds 50MB limit",
          error: "FILE_TOO_LARGE",
          maxSize: "50MB"
        });
      }

      safeLog({
        name: file.originalFilename || 'unnamed-file',
        type: file.mimetype || 'application/octet-stream',
        size: fileSize,
        activityId
      }, 'Uploading file');

      try {
        // Use original filename, just ensure it's URL-safe
        const safeName = (file.originalFilename || 'unnamed-file').replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueFilename = safeName;

        // Upload to COS
        const buffer = fs.readFileSync(file.filepath);
        const cosKey = await uploadDocument(buffer, uniqueFilename, file.mimetype || 'application/octet-stream');

        console.log('File uploaded to COS:', cosKey);

        const client = getDbClient();
        const db = client.db("cluster0");

        // Create document metadata
        const document = {
          _id: uuidv4(),
          filename: file.originalFilename || 'unnamed-file',
          originalName: file.originalFilename || 'unnamed-file',
          mimeType: file.mimetype || 'application/octet-stream',
          size: fileSize,
          url: cosKey,
          orgId,
          activityIds: activityId ? [activityId] : [] as string[],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        console.log('[DOCUMENTS_API] Creating document:', document);

        await db.collection("documents").insertOne(document);
        
        // Create relation in relations table if activityId is provided
        if (activityId) {
          try {
            console.log('[DOCUMENTS_API] Linking document to activity:', {
              documentId: document._id,
              activityId
            });
            
            if (!isUsingMongo()) {
              // Direct database link - create a raw SQL statement for better compatibility
              console.log('[DOCUMENTS_API] Using direct linking to bypass Relations class');
              await Relations.forceLinkDocumentToActivity(document._id, activityId);
            } else {
              // Use Relations helper for MongoDB
              await Relations.linkDocumentToActivity(document._id, activityId);
            }
            
            console.log('[DOCUMENTS_API] Successfully linked document to activity');
          } catch (error) {
            console.error("[DOCUMENTS_API] Error linking document to activity:", error);
            // Continue anyway since the document was created
          }
        }
        
        return res.status(201).json(document);
      } catch (error) {
        console.error("[DOCUMENTS_API] Upload error:", error);
        if (error instanceof Error) {
          if (error.message.includes('Missing required COS configuration')) {
            return res.status(500).json({ 
              message: "Storage service configuration error",
              error: "STORAGE_CONFIG_ERROR"
            });
          }
          if (error.message.includes('upload failed')) {
            return res.status(500).json({ 
              message: "Failed to upload file to storage",
              error: "STORAGE_UPLOAD_ERROR"
            });
          }
        }
        return res.status(500).json({ 
          message: "Failed to process file upload",
          error: "UPLOAD_PROCESSING_ERROR"
        });
      }
    }
    
    // Handle unsupported methods
    else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("[DOCUMENTS_API]", error);
    if (error instanceof Error) {
      console.error("[DOCUMENTS_API] Error details:", error.message);
    }
    return res.status(500).json({ message: "Internal Error" });
  }
} 