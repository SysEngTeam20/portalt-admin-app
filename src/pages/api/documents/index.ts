import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { uploadDocument, deleteDocument } from "@/lib/cos";
import formidable from 'formidable';
import fs from 'fs';

// Disable the default body parser for this route since we're handling file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Promisify formidable parsing
const parseForm = (req: NextApiRequest) => {
  return new Promise<{fields: formidable.Fields, files: formidable.Files}>((resolve, reject) => {
    const form = new formidable.IncomingForm();
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

      const client = await clientPromise;
      const db = client.db("cluster0");

      const query = {
        orgId,
        ...(activityId && { activityIds: activityId }),
      };

      const documents = await db
        .collection("documents")
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json(documents);
    }
    
    // POST upload new document
    else if (req.method === 'POST') {
      // Parse the multipart form data
      const { files, fields } = await parseForm(req);
      const fileEntry = files.file;
      const activityId = fields.activityId ? String(fields.activityId) : null;
      
      if (!fileEntry) {
        return res.status(400).json({ message: "File is required" });
      }
      
      // Handle both single file and array of files (formidable can return either)
      const file = Array.isArray(fileEntry) ? fileEntry[0] : fileEntry;
      
      if (!file) {
        return res.status(400).json({ message: "File is required" });
      }

      console.log('Uploading file:', {
        name: file.originalFilename || 'unnamed-file',
        type: file.mimetype || 'application/octet-stream',
        size: fs.statSync(file.filepath).size,
        activityId
      });

      // Generate a safe filename
      const timestamp = Date.now();
      const safeName = (file.originalFilename || 'unnamed-file').replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFilename = `${timestamp}-${safeName}`;

      // Upload to COS
      const buffer = fs.readFileSync(file.filepath);
      const cosKey = await uploadDocument(buffer, uniqueFilename, file.mimetype || 'application/octet-stream');

      console.log('File uploaded to COS:', cosKey);

      const client = await clientPromise;
      const db = client.db("cluster0");

      // Create document metadata
      const document = {
        _id: new ObjectId(),
        filename: file.originalFilename || 'unnamed-file',
        originalName: file.originalFilename || 'unnamed-file',
        mimeType: file.mimetype || 'application/octet-stream',
        size: fs.statSync(file.filepath).size,
        url: cosKey,
        orgId,
        activityIds: activityId ? [activityId] : [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection("documents").insertOne(document);

      // If activityId provided, update activity's documentIds
      if (activityId) {
        await db.collection("activities").updateOne(
          { _id: new ObjectId(activityId), orgId },
          { $addToSet: { documentIds: document._id.toString() } }
        );
      }

      // Clean up the temp file
      fs.unlinkSync(file.filepath);

      return res.status(200).json(document);
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