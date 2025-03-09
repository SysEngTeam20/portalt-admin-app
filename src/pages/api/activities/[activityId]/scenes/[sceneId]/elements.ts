import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getDbClient } from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';

interface Element {
  id: string;
  type: any;
  properties: any;
}

interface Scene {
  id: string;
  elements: Element[];
  updatedAt: string;
}

interface Activity {
  _id: string;
  orgId: string;
  scenes: Scene[];
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
    const sceneId = req.query.sceneId as string;
    const client = getDbClient();
    const db = client.db("cluster0");
    const activitiesCollection = db.collection<Activity>("activities");

    // GET all elements for a scene
    if (req.method === 'GET') {
      const activity = await activitiesCollection.findOne({
        _id: activityId,
        orgId
      });

      if (!activity || !activity.scenes) {
        return res.status(404).json({ message: "Scene not found" });
      }

      const scene = activity.scenes.find((s: any) => s.id === sceneId);
      if (!scene) {
        return res.status(404).json({ message: "Scene not found" });
      }

      return res.status(200).json(scene.elements || []);
    }
    
    // POST create new element
    else if (req.method === 'POST') {
      const { type, properties } = req.body;

      if (!type) {
        return res.status(400).json({ message: "Element type is required" });
      }

      const newElement = {
        id: uuidv4(),
        type,
        properties: properties || {}
      };

      const activity = await activitiesCollection.findOne({
        _id: activityId,
        orgId
      });

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const sceneIndex = activity.scenes.findIndex((s: any) => s.id === sceneId);
      if (sceneIndex === -1) {
        return res.status(404).json({ message: "Scene not found" });
      }

      activity.scenes[sceneIndex].elements.push(newElement);
      activity.updatedAt = new Date().toISOString();
      activity.scenes[sceneIndex].updatedAt = new Date().toISOString();

      const result = await activitiesCollection.updateOne(
        { _id: activityId },
        { $set: activity }
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

      const activity = await activitiesCollection.findOne({
        _id: activityId,
        orgId
      });

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const sceneIndex = activity.scenes.findIndex((s: any) => s.id === sceneId);
      if (sceneIndex === -1) {
        return res.status(404).json({ message: "Scene not found" });
      }

      activity.scenes[sceneIndex].elements = elements;
      activity.updatedAt = new Date().toISOString();
      activity.scenes[sceneIndex].updatedAt = new Date().toISOString();

      const result = await activitiesCollection.updateOne(
        { _id: activityId },
        { $set: activity }
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