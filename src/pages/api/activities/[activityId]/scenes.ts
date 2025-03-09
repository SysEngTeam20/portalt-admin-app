import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getDbClient, Relations } from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';

interface Scene {
  id: string;
  order: number;
  elements: any[];
  createdAt: string;
  updatedAt: string;
}

interface ActivityDocument {
  _id: string;
  orgId: string;
  scenes?: Scene[];
  updatedAt: string;
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
    const client = getDbClient();
    const db = client.db("cluster0");
    const activitiesCollection = db.collection("activities");

    // GET all scenes for an activity
    if (req.method === 'GET') {
      const activity = await activitiesCollection.findOne({
        _id: activityId,
        orgId
      } as any) as unknown as { scenes?: Scene[] };

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      if (!activity?.scenes) {
        return res.status(404).json({ message: "Activity not found" });
      }

      return res.status(200).json(activity.scenes || []);
    }
    
    // POST create new scene
    else if (req.method === 'POST') {
      const activity = await activitiesCollection.findOne({
        _id: activityId,
        orgId
      } as any) as unknown as ActivityDocument;

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const currentScenes = activity.scenes || [];
      const newScene = {
        id: uuidv4(),
        order: currentScenes.length + 1,
        elements: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updatedScenes = [...currentScenes, newScene];

      const result = await activitiesCollection.updateOne(
        { _id: activityId },
        { 
          $set: { 
            scenes: updatedScenes,
            updatedAt: new Date().toISOString() 
          } as any
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Activity not found" });
      }

      return res.status(200).json(newScene);
    }
    
    // PUT update scene order
    else if (req.method === 'PUT') {
      const { scenes } = req.body;

      if (!Array.isArray(scenes)) {
        return res.status(400).json({ message: "Invalid scenes data" });
      }

      const result = await activitiesCollection.updateOne(
        {
          _id: activityId,
          orgId
        } as any,  // Type assertion here
        {
          $set: {
            scenes: scenes.map(s => ({
              ...s,
              updatedAt: new Date().toISOString()
            })),
            updatedAt: new Date().toISOString()
          } as any
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