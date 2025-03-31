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

// Helper function to extract the key from a full S3 URL
function extractKeyFromUrl(url: string): string {
  console.log("[ASSET_API] Original URL:", url);
  try {
    // If the URL contains the full S3 URL, extract just the key part
    if (url.includes('cloud-object-storage.appdomain.cloud')) {
      const urlObj = new URL(url);
      // Get the pathname and remove the leading slash
      let key = urlObj.pathname.replace(/^\//, '');
      // Remove the 'useruploads/' prefix if it exists
      if (key.startsWith('useruploads/')) {
        key = key.substring('useruploads/'.length);
      }
      // Decode URL-encoded characters
      key = decodeURIComponent(key);
      console.log("[ASSET_API] Extracted key:", key);
      return key;
    }
    // If it's already just a key, return it as is
    console.log("[ASSET_API] Using URL as key:", url);
    return url;
  } catch (error) {
    console.error("[ASSET_API] URL parsing error:", error);
    // If URL parsing fails, try to extract the key manually
    if (url.includes('cloud-object-storage.appdomain.cloud')) {
      const parts = url.split('cloud-object-storage.appdomain.cloud/');
      if (parts.length > 1) {
        let key = parts[1];
        // Remove the 'useruploads/' prefix if it exists
        if (key.startsWith('useruploads/')) {
          key = key.substring('useruploads/'.length);
        }
        // Decode URL-encoded characters
        key = decodeURIComponent(key);
        console.log("[ASSET_API] Manually extracted key:", key);
        return key;
      }
    }
    // If all else fails, return the original URL
    console.log("[ASSET_API] Using original URL as key:", url);
    return url;
  }
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

    const { assetId } = req.query;

    // GET single asset
    if (req.method === 'GET') {
      const client = getDbClient();
      const db = client.db("cluster0");
      
      // First try to find in assets collection
      let asset = await db.collection("assets").findOne({ _id: assetId, orgId });
      
      // If not found in assets, try documents collection
      if (!asset) {
        asset = await db.collection("documents").findOne({ _id: assetId, orgId });
      }

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      console.log("[ASSET_API] Found asset:", asset);

      // Extract the key from the URL and generate a signed URL
      const key = extractKeyFromUrl(asset.url);
      console.log("[ASSET_API] Using key for signed URL:", key);
      
      try {
        const signedUrl = await getSignedUrl(key, 900); // 15 minutes expiry
        console.log("[ASSET_API] Generated signed URL:", signedUrl);
        return res.status(200).json({
          ...asset,
          url: signedUrl
        });
      } catch (error) {
        console.error("[ASSET_API] Error generating signed URL:", error);
        return res.status(500).json({ 
          message: "Failed to generate signed URL",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // PATCH update asset
    else if (req.method === 'PATCH') {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });

      const client = getDbClient();
      const db = client.db("cluster0");
      
      // Try to update in assets collection first
      const result = await db.collection("assets").updateOne(
        { _id: assetId, orgId },
        { 
          $set: { 
            name,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        // If not found in assets, try documents collection
        const docResult = await db.collection("documents").updateOne(
          { _id: assetId, orgId },
          { 
            $set: { 
              name,
              updatedAt: new Date()
            }
          }
        );

        if (docResult.matchedCount === 0) {
          return res.status(404).json({ message: "Asset not found" });
        }
      }

      return res.status(200).json({ message: "Asset updated successfully" });
    }

    // DELETE asset
    else if (req.method === 'DELETE') {
      const client = getDbClient();
      const db = client.db("cluster0");
      
      // Try to delete from assets collection first
      const result = await db.collection("assets").deleteOne({ _id: assetId, orgId });

      if (result.deletedCount === 0) {
        // If not found in assets, try documents collection
        const docResult = await db.collection("documents").deleteOne({ _id: assetId, orgId });

        if (docResult.deletedCount === 0) {
          return res.status(404).json({ message: "Asset not found" });
        }
      }

      return res.status(200).json({ message: "Asset deleted successfully" });
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