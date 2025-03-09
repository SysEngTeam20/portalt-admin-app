import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getDbClient } from "@/lib/db";
import { getSignedUrl } from "@/lib/cos";

interface Document {
  _id: string;
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

    const documentId = req.query.documentId as string;
    const client = getDbClient();
    const db = client.db("cluster0");

    // Verify document exists and belongs to organization
    const document = await db.collection<Document>("documents").findOne({
      _id: documentId,
      orgId
    } as any);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Generate short-lived signed URL
    const signedUrl = await getSignedUrl(document.url, 3600); // 1 hour expiry

    return res.status(200).json({ url: signedUrl });
  } catch (error) {
    console.error("[DOCUMENT_ACCESS_GET]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}