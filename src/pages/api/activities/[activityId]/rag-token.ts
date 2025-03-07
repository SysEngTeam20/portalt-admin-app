import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { generateLLMToken } from "@/lib/tokens";

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

    const client = await clientPromise;
    const db = client.db("cluster0");

    const activityId = req.query.activityId as string;

    // Verify activity exists and belongs to organization
    const activity = await db.collection("activities").findOne({
      _id: new ObjectId(activityId),
      orgId,
      ragEnabled: true
    });

    if (!activity) {
      return res.status(404).json({ message: "Activity not found or RAG not enabled" });
    }

    // Generate a new LLM access token
    const token = await generateLLMToken(activityId);

    return res.status(200).json({ token });
  } catch (error) {
    console.error("[RAG_TOKEN_POST]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}