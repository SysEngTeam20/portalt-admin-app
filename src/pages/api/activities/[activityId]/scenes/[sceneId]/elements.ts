import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

interface Element {
  id: string;
  type: any;
  properties: any;
}

interface Scene {
  id: string;
  elements: Element[];
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
    const sceneId = req.query.sceneId as string;
    const client = await clientPromise;
    const db = client.db("cluster0");

    // GET all elements for a scene
    if (req.method === 'GET') {
      const activity = await db.collection("activities").findOne(
        {
          _id: new ObjectId(activityId),
          orgId,
          "scenes.id": sceneId
        },
        { projection: { "scenes.$": 1 } }
      );

      if (!activity || !activity.scenes?.[0]) {
        return res.status(404).json({ message: "Scene not found" });
      }

      return res.status(200).json(activity.scenes[0].elements || []);
    }
    
    // POST create new element
    else if (req.method === 'POST') {
      const { type, properties } = req.body;

      if (!type) {
        return res.status(400).json({ message: "Element type is required" });
      }

      const newElement = {
        id: new ObjectId().toString(),
        type,
        properties: properties || {}
      };

      const result = await db.collection<Activity>("activities").updateOne(
        {
          _id: new ObjectId(activityId),
          orgId,
          "scenes.id": sceneId
        },
        {
          $push: { "scenes.$.elements": { $each: [newElement] } },
          $set: { 
            updatedAt: new Date(),
            "scenes.$.updatedAt": new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Scene not found" });
      }

      return res.status(200).json(newElement);
    }
    
    // PUT update elements (for bulk updates/reordering)
    else if (req.method === 'PUT') {
      const { elements } = req.body;

      if (!Array.isArray(elements)) {
        return res.status(400).json({ message: "Invalid elements data" });
      }

      const result = await db.collection("activities").updateOne(
        {
          _id: new ObjectId(activityId),
          orgId,
          "scenes.id": sceneId
        },
        {
          $set: { 
            "scenes.$.elements": elements,
            updatedAt: new Date(),
            "scenes.$.updatedAt": new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Scene not found" });
      }

      return res.status(200).json(elements);
    }
    
    // Handle unsupported methods
    else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("[ELEMENTS_API]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}