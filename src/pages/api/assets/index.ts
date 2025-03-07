import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { uploadDocument } from "@/lib/cos";
import { documentToAsset } from "@/types/asset";
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
    form.parse(req, (err: any, fields: formidable.Fields, files: formidable.Files) => {
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

    // GET all assets and documents
    if (req.method === 'GET') {
      const client = await clientPromise;
      const db = client.db("cluster0");
      
      // Fetch from both collections
      const [assets, documents] = await Promise.all([
        db.collection("assets")
          .find({ orgId })
          .toArray(),
        db.collection("documents")
          .find({ orgId })
          .toArray()
      ]);

      // Transform documents to asset format
      const documentAssets = documents.map(documentToAsset);
      
      // Combine and sort by creation date
      const allAssets = [...assets, ...documentAssets]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.status(200).json(allAssets);
    }
    
    // POST upload new asset
    else if (req.method === 'POST') {
      // Parse the multipart form data
      const { files } = await parseForm(req);
      const fileEntry = files.file;
      
      if (!fileEntry) {
        return res.status(400).json({ message: "File is required" });
      }
      
      // Handle both single file and array of files (formidable can return either)
      const file = Array.isArray(fileEntry) ? fileEntry[0] : fileEntry;
      
      if (!file) {
        return res.status(400).json({ message: "File is required" });
      }

      // Get file metadata
      const fileStats = fs.statSync(file.filepath);
      const fileBuffer = fs.readFileSync(file.filepath);
      const fileName = file.originalFilename || 'unnamed-file';
      const mimeType = file.mimetype || 'application/octet-stream';

      // Determine asset type based on file mime type
      let assetType: '3D Objects' | 'Images' | 'RAG Documents';
      if (mimeType.startsWith('image/')) {
        assetType = 'Images';
      } else if (fileName.endsWith('.obj') || fileName.endsWith('.fbx') || fileName.endsWith('.gltf')) {
        assetType = '3D Objects';
      } else {
        assetType = 'RAG Documents';
      }

      // Generate safe filename and upload to COS
      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFilename = `${timestamp}-${safeName}`;

      const cosKey = await uploadDocument(fileBuffer, uniqueFilename, mimeType);

      const client = await clientPromise;
      const db = client.db("cluster0");

      // Create asset metadata
      const asset = {
        _id: new ObjectId(),
        name: fileName,
        type: assetType,
        size: fileStats.size,
        url: cosKey,
        orgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection("assets").insertOne(asset);

      // Clean up the temp file
      fs.unlinkSync(file.filepath);

      return res.status(200).json(asset);
    }
    
    // Handle unsupported methods
    else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("[ASSETS_API]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}