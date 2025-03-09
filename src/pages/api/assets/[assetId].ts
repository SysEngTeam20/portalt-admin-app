import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getDbClient } from "@/lib/db";
import { deleteDocument, getSignedUrl } from "@/lib/cos";

interface AssetDocument {
  _id: string;
  orgId: string;
  url: string;
  name: string;
  updatedAt: string;
  // ... other fields
}

interface Document {
  _id: string;
  orgId: string;
  url: string;
  filename: string;
  updatedAt: string;
  // ... other fields
}

async function findAssetOrDocument(orgId: string, assetId: string) {
  const client = getDbClient();
  const db = client.db("cluster0");
  
  const documents = db.collection<Document>("documents");
  const doc = await documents.findOne({ 
    _id: assetId, 
    orgId 
  } as any);

  if (doc) return { type: 'document', data: doc };

  const assets = db.collection<AssetDocument>("assets");
  const asset = await assets.findOne({ 
    _id: assetId, 
    orgId 
  } as any);

  return asset ? { type: 'asset', data: asset } : null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const assetId = req.query.assetId as string;
    const client = getDbClient();
    const db = client.db("cluster0");

    if (req.method === 'GET') {
      const result = await findAssetOrDocument(orgId, assetId);
      if (!result) return res.status(404).json({ message: "Asset not found" });
      
      const signedUrl = await getSignedUrl(result.data.url, 900);
      return res.status(200).json({ ...result.data, url: signedUrl });
    }

    if (req.method === 'PATCH') {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name is required" });

      const result = await findAssetOrDocument(orgId, assetId);
      if (!result) return res.status(404).json({ message: "Asset not found" });

      const collection = result.type === 'document' ? 
        db.collection<Document>("documents") : 
        db.collection<AssetDocument>("assets");

      const updateResult = await collection.updateOne(
        { _id: assetId, orgId } as any,
        { 
          $set: { 
            ...(result.type === 'document' ? { filename: name } : {}),
            name,
            updatedAt: new Date().toISOString()
          } 
        } as any
      );

      if (updateResult.matchedCount === 0) {
        return res.status(404).json({ message: "Asset not found" });
      }

      const updatedDoc = await collection.findOne({ _id: assetId, orgId } as any);
      return res.status(200).json(updatedDoc);
    }

    if (req.method === 'DELETE') {
      const result = await findAssetOrDocument(orgId, assetId);
      if (!result) return res.status(404).json({ message: "Asset not found" });

      await deleteDocument(result.data.url);
      
      const collection = result.type === 'document' ? 
        db.collection<Document>("documents") : 
        db.collection<AssetDocument>("assets");

      const deleteResult = await collection.deleteOne({ 
        _id: assetId, 
        orgId 
      } as any);

      if (deleteResult.deletedCount === 0) {
        return res.status(404).json({ message: "Asset not found" });
      }

      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error("[ASSET_API]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}