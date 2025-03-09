// app/api/assets/[assetId]/access/route.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getDbClient, Relations } from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';
import { getSignedUrl } from "@/lib/cos";

interface Document {
  _id: string;  // Uses string IDs instead of ObjectId
  orgId: string;
  url: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET method
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const { orgId } = getAuth(req);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const assetId = req.query.assetId as string;
    
    const client = getDbClient();
    const db = client.db("cluster0");

    // Try finding in assets collection first
    let item = await db.collection("assets").findOne({
      _id: assetId,
      orgId
    } as any);

    // If not found in assets, try documents collection
    if (!item) {
      const documents = db.collection<Document>("documents");
      const doc = await documents.findOne({ 
        _id: assetId,
        orgId
      } as any);

      if (!doc) {
        return res.status(404).json({ message: "Asset not found" });
      }

      item = doc;
    }

    // Generate short-lived signed URL (15 minutes)
    const signedUrl = await getSignedUrl((item as { url: string }).url, 900);

    return res.status(200).json({ url: signedUrl });
  } catch (error) {
    console.error("[ASSET_ACCESS_GET]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}