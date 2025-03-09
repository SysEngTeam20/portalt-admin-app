import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getDbClient, Relations } from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const { orgId } = getAuth(req);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const documentId = req.query.documentId as string;
    const { activityId } = req.body;

    if (!activityId) {
      return res.status(400).json({ message: "Activity ID is required" });
    }

    const client = await getDbClient();
    const db = client.db("cluster0");

    const documentsCollection = db.collection("documents");
    await documentsCollection.updateOne(
      { _id: documentId },
      { $addToSet: { activityIds: activityId } }
    );

    await Relations.linkDocumentToActivity(documentId, activityId);

    return res.status(200).json({ message: "ok" });
  } catch (error) {
    console.error("[DOCUMENT_LINK_POST]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}