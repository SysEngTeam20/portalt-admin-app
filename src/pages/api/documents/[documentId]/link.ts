import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

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

    const client = await clientPromise;
    const db = client.db("cluster0");

    // Update document with new activityId
    await db.collection("documents").updateOne(
      { _id: new ObjectId(documentId), orgId },
      { $addToSet: { activityIds: activityId } }
    );

    // Update activity with new documentId
    await db.collection("activities").updateOne(
      { _id: new ObjectId(activityId), orgId },
      { $addToSet: { documentIds: documentId } }
    );

    return res.status(200).json({ message: "ok" });
  } catch (error) {
    console.error("[DOCUMENT_LINK_POST]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}