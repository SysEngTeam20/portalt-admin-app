import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

interface Scene {
  id: string;
  order: number;
  elements: any[];
  createdAt: Date;
  updatedAt: Date;
}

interface Activity {
  _id: ObjectId;
  orgId: string;
  scenes: Scene[];
  updatedAt: Date;
}

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
    
    // GET all scenes for an activity
    if (req.method === 'GET') {
      const activity = await db.collection("activities").findOne({
        _id: new ObjectId(activityId),
        orgId
      });

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      return res.status(200).json(activity.scenes || []);
    }
    
    // POST create new scene
    else if (req.method === 'POST') {
      // First get the activity to check ownership and get current scenes count
      const activity = await db.collection<Activity>("activities").findOne({
        _id: new ObjectId(activityId),
        orgId
      });

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const currentScenes = activity.scenes || [];
      const newScene = {
        id: new ObjectId().toString(),
        order: currentScenes.length + 1,
        elements: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection<Activity>("activities").updateOne(
        { _id: new ObjectId(activityId) },
        { 
          $push: { scenes: { $each: [newScene] } },
          $set: { updatedAt: new Date() }
        }
      );

      return res.status(200).json(newScene);
    }
    
    // PUT update scene order
    else if (req.method === 'PUT') {
      const { scenes } = req.body;

      if (!Array.isArray(scenes)) {
        return res.status(400).json({ message: "Invalid scenes data" });
      }

      const result = await db.collection("activities").updateOne(
        {
          _id: new ObjectId(activityId),
          orgId
        },
        {
          $set: {
            scenes,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Activity not found" });
      }

      return res.status(200).json(scenes);
    }
    
    // Handle unsupported methods
    else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("[SCENES_API]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}