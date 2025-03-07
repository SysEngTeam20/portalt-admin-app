import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId, Document } from "mongodb";
import clientPromise from "@/lib/mongodb";

interface Activity {
  _id: ObjectId;
  orgId: string;
  documentIds: string[];
}

interface DocumentType extends Document {
  activityIds: string[];
  orgId: string;
}

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

    // Remove activityId from document
    await db.collection<DocumentType>("documents").updateOne(
      { _id: new ObjectId(documentId), orgId },
      { $pull: { activityIds: activityId } }
    );

    // Remove documentId from activity
    await db.collection<Activity>("activities").updateOne(
      { _id: new ObjectId(activityId), orgId },
      { $pull: { documentIds: documentId } }
    );

    return res.status(200).json({ message: "ok" });
  } catch (error) {
    console.error("[DOCUMENT_UNLINK_POST]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}
  