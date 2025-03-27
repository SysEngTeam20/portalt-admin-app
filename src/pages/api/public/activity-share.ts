import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbClient } from "@/lib/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { shareCode } = req.query;

    if (!shareCode || typeof shareCode !== 'string') {
      return res.status(400).json({ message: "Share code is required" });
    }

    const client = getDbClient();
    const db = client.db("cluster0");
    const shareCodesCollection = db.collection("shareCodes");
    const activitiesCollection = db.collection("activities");
    const scenesCollection = db.collection("scenes");

    // Find valid share code
    const shareCodeDoc = await shareCodesCollection.findOne({
      shareCode,
      expiresAt: { $gt: new Date() }
    });

    if (!shareCodeDoc) {
      return res.status(404).json({ message: "Invalid or expired share code" });
    }

    // Get activity
    const activity = await activitiesCollection.findOne({
      _id: shareCodeDoc.activityId
    });

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    // Get first scene's configuration
    const firstScene = await scenesCollection.findOne({
      activityId: activity._id
    }, {
      sort: { order: 1 }
    });

    if (!firstScene) {
      return res.status(404).json({ message: "No scenes found for this activity" });
    }

    return res.status(200).json({
      activity: {
        title: activity.title,
        description: activity.description,
        format: activity.format,
        platform: activity.platform
      },
      scene: {
        name: firstScene.name,
        configuration: firstScene.configuration
      }
    });
  } catch (error) {
    console.error("[PUBLIC_SHARE_API]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
} 