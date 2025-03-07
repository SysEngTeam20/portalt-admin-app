import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { deleteDocument, getSignedUrl } from "@/lib/cos";

// Helper function to safely convert string to ObjectId
function toObjectId(id: string) {
  try {
    return new ObjectId(id);
  } catch (error) {
    return null;
  }
}

// Helper function to find asset or document
async function findAssetOrDocument(db: any, id: string, orgId: string) {
  const objectId = toObjectId(id);
  if (!objectId) return null;

  // Try documents collection first
  const doc = await db.collection("documents").findOne({
    _id: objectId,
    orgId
  });

  if (doc) {
    return {
      type: 'document',
      data: doc
    };
  }

  // Then try assets collection
  const asset = await db.collection("assets").findOne({
    _id: objectId,
    orgId
  });

  if (asset) {
    return {
      type: 'asset',
      data: asset
    };
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const assetId = req.query.assetId as string;
    const client = await clientPromise;
    const db = client.db("cluster0");

    // GET asset details
    if (req.method === 'GET') {
      const result = await findAssetOrDocument(db, assetId, orgId);

      if (!result) {
        return res.status(404).json({ message: "Asset not found" });
      }

      // Generate signed URL regardless of type since both use COS
      const signedUrl = await getSignedUrl(result.data.url, 900);

      return res.status(200).json({ url: signedUrl });
    }
    
    // PATCH update asset
    else if (req.method === 'PATCH') {
      const { name } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({ message: "Name is required" });
      }

      const objectId = toObjectId(assetId);
      if (!objectId) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      // Find which collection the item is in
      const result = await findAssetOrDocument(db, assetId, orgId);
      if (!result) {
        return res.status(404).json({ message: "Asset not found" });
      }

      if (result.type === 'document') {
        await db.collection("documents").updateOne(
          { _id: objectId, orgId },
          { 
            $set: { 
              filename: name,
              name: name,
              updatedAt: new Date() 
            } 
          }
        );

        // Fetch updated document
        const updatedDoc = await db.collection("documents").findOne({ _id: objectId, orgId });
        return res.status(200).json(updatedDoc);
      } else {
        await db.collection("assets").updateOne(
          { _id: objectId, orgId },
          { 
            $set: { 
              name: name,
              updatedAt: new Date() 
            } 
          }
        );

        // Fetch updated asset
        const updatedAsset = await db.collection("assets").findOne({ _id: objectId, orgId });
        return res.status(200).json(updatedAsset);
      }
    }
    
    // DELETE asset
    else if (req.method === 'DELETE') {
      const result = await findAssetOrDocument(db, assetId, orgId);
      if (!result) {
        return res.status(404).json({ message: "Asset not found" });
      }

      // Delete from COS
      await deleteDocument(result.data.url);

      // Delete from appropriate collection
      const collection = result.type === 'document' ? "documents" : "assets";
      const filter: any = { orgId };
      if (assetId) {
        filter._id = toObjectId(assetId);
      }
      await db.collection(collection).deleteOne(filter);

      return res.status(204).end();
    }
    
    // Handle unsupported methods
    else {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("[ASSET_API]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}