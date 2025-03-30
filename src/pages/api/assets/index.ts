import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getDbClient } from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';
import { uploadDocument, getPublicUrl } from "@/lib/cos";
import { documentToAsset } from "@/types/asset";
import * as formidable from 'formidable';
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

interface AssetDocument {
  _id: string;
  name: string;
  type: '3D Objects' | 'Images' | 'RAG Documents';
  size: number;
  url: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

interface Document {
  _id: string;
  filename: string;
  url: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

// Add this helper function
const getAssetType = (filename: string): AssetDocument['type'] => {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  if (['glb', 'gltf', 'fbx', 'obj', 'dae', '3ds', 'blend', 'stl', 'skp', 'dxf'].includes(extension!)) {
    return '3D Objects';
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension!)) {
    return 'Images';
  }
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(extension!)) {
    return 'RAG Documents';
  }
  return '3D Objects'; // default fallback
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const client = getDbClient();
    const db = client.db("cluster0");

    // GET all assets and documents
    if (req.method === 'GET') {
      const assetsCursor = db.collection<AssetDocument>("assets").find({ orgId } as any);
      const documentsCursor = db.collection<Document>("documents").find({ orgId } as any);
      
      const [assetsArray, documentsArray] = await Promise.all([
        assetsCursor.toArray(),
        documentsCursor.toArray()
      ]);

      // Combine and sort by creation date
      const allAssets = [
        ...assetsArray.map((a: AssetDocument) => ({ ...a, isDocument: false })),
        ...documentsArray.map((d: Document) => ({
          _id: d._id,
          name: d.filename,
          type: 'RAG Documents' as const,
          size: 0, // Documents might need size from COS metadata
          url: d.url,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt
        }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.status(200).json(allAssets);
    }

    // POST upload new asset
    if (req.method === 'POST') {
      const { fields, files } = await parseForm(req);
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Read file buffer and upload to COS
      const fileBuffer = fs.readFileSync(file.filepath);
      const cosResponse = await uploadDocument(
        fileBuffer,
        file.originalFilename || 'unnamed',
        orgId
      );
      const cosUrl = cosResponse;  // Direct assignment since response is the URL string
      
      const newAsset: AssetDocument = {
        _id: uuidv4(),
        name: fields.name?.[0] || file.originalFilename || 'Unnamed Asset',
        type: getAssetType(file.originalFilename || 'unnamed'), // Use auto-detected type
        size: file.size,
        url: cosUrl,
        orgId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.collection<AssetDocument>("assets").insertOne(newAsset);
      
      const publicUrl = await getPublicUrl(cosUrl.split('/').pop() || '');
      return res.status(201).json({
        url: publicUrl,
        fileName: file.originalFilename,
        fileType: file.mimetype
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error("[ASSETS_API]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}