// app/api/assets/[assetId]/access/route.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { getSignedUrl } from "@/lib/cos";

function toObjectId(id: string) {
  try {
    return new ObjectId(id);
  } catch (error) {
    return null;
  }
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
    const objectId = toObjectId(assetId);
    
    if (!objectId) {
      return res.status(400).json({ message: "Invalid asset ID" });
    }
    
    const client = await clientPromise;
    const db = client.db("cluster0");

    // Try finding in assets collection first
    let item = await db.collection("assets").findOne({
      _id: objectId,
      orgId
    });

    // If not found in assets, try documents collection
    if (!item) {
      item = await db.collection("documents").findOne({
        _id: objectId,
        orgId
      });
    }

    if (!item) {
      return res.status(404).json({ message: "Asset not found" });
    }

    // Generate short-lived signed URL (15 minutes)
    const signedUrl = await getSignedUrl(item.url, 900);

    return res.status(200).json({ url: signedUrl });
  } catch (error) {
    console.error("[ASSET_ACCESS_GET]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}