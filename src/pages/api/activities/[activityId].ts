import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getDbClient } from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';

interface ActivityDocument {
  _id: string;
  title: string;
  description?: string;
  bannerUrl: string;
  format: string;
  platform: string;
  ragEnabled?: boolean;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const activityId = req.query.activityId as string;
    const client = getDbClient();
    const db = client.db("cluster0");
    const activitiesCollection = db.collection<ActivityDocument>("activities");

    // GET single activity
    if (req.method === 'GET') {
      const { orgId } = req.query;
      
      if (!orgId || typeof orgId !== 'string') {
        return res.status(400).json({ message: "orgId query parameter is required" });
      }

      const activity = await activitiesCollection.findOne({
        _id: activityId,
        orgId
      });
      
      console.log('Query params:', { activityId, orgId });
      console.log('Raw query:', { _id: activityId, orgId });

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      return res.status(200).json(activity);
    }
    
    // PATCH update activity
    else if (req.method === 'PATCH') {
      const { orgId } = getAuth(req);
      
      if (!orgId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        title,
        description,
        bannerUrl,
        format,
        platform,
        ragEnabled,
      } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      if (format && !["AR", "VR"].includes(format)) {
        return res.status(400).json({ message: "Invalid format" });
      }

      if (platform && !["headset", "web"].includes(platform)) {
        return res.status(400).json({ message: "Invalid platform" });
      }

      const result = await activitiesCollection.updateOne(
        { _id: activityId, orgId },
        {
          $set: {
            title,
            description,
            bannerUrl,
            format,
            platform,
            ragEnabled,
            updatedAt: new Date().toISOString()
          }
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Activity not found" });
      }

      return res.status(200).json({ message: "ok" });
    }
    
    // DELETE activity
    else if (req.method === 'DELETE') {
      const { orgId } = getAuth(req);
      
      if (!orgId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const result = await activitiesCollection.deleteOne({
        _id: activityId,
        orgId
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Activity not found" });
      }

      return res.status(204).end();
    }
    
    // Handle unsupported methods
    else {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("[ACTIVITY_API]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}