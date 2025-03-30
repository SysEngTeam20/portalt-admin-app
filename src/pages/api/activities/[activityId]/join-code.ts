import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getDbClient } from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';

interface JoinCodeDocument {
  _id: string;
  activityId: string;
  joinCode: string;
  createdAt: Date;
  expiresAt: Date;
}

interface ActivityDocument {
  _id: string;
  orgId: string;
  title: string;
  description?: string;
  format: string;
  platform: string;
}

function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const activityId = req.query.activityId as string;
    const client = getDbClient();
    const db = client.db("cluster0");
    const joinCodesCollection = db.collection<JoinCodeDocument>("joinCodes");
    const activitiesCollection = db.collection<ActivityDocument>("activities");

    // Verify user has access to the activity
    const auth = getAuth(req);
    if (!auth.orgId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const activity = await activitiesCollection.findOne({
      _id: activityId,
      orgId: auth.orgId
    });

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    // Generate new join code
    if (req.method === 'POST') {
      // First, try to find an existing valid join code
      const existingCodes = await joinCodesCollection.find({
        activityId
      });

      const codesArray = await existingCodes.toArray();
      const existingCode = codesArray.find((code: JoinCodeDocument) => 
        new Date(code.expiresAt) > new Date()
      );

      if (existingCode) {
        return res.status(200).json({ 
          joinCode: existingCode.joinCode,
          expiresAt: existingCode.expiresAt
        });
      }

      // If no valid code exists, generate a new one
      const joinCode = generateSixDigitCode();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      await joinCodesCollection.insertOne({
        _id: uuidv4(),
        activityId,
        joinCode,
        createdAt: now,
        expiresAt
      });

      return res.status(200).json({ 
        joinCode,
        expiresAt
      });
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error("[JOIN_CODE_API]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
} 