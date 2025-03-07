import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const activityId = req.query.activityId as string;
    const client = await clientPromise;
    const db = client.db("cluster0");
    
    // GET single activity
    if (req.method === 'GET') {
      const activity = await db.collection("activities").findOne({
        _id: new ObjectId(activityId),
        orgId
      });

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      return res.status(200).json(activity);
    }
    
    // PATCH update activity
    else if (req.method === 'PATCH') {
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

      await db.collection("activities").findOneAndUpdate(
        {
          _id: new ObjectId(activityId),
          orgId
        },
        {
          $set: {
            title,
            description,
            bannerUrl,
            format,
            platform,
            ragEnabled,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      return res.status(200).json({ message: "ok" });
    }
    
    // DELETE activity
    else if (req.method === 'DELETE') {
      const result = await db.collection("activities").deleteOne({
        _id: new ObjectId(activityId),
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