import { getDbClient } from "@/lib/db";
import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";

// Add Scene interface
interface Scene {
  _id?: string;
  activity_id: string;
  orgId: string;
  name: string;
  order: number;
  elements: any[];
  createdAt: Date;
  updatedAt: Date;
}

// Add SceneConfiguration interface
interface SceneConfiguration {
  _id?: string;
  scene_id: string;
  objects: any[];
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { activityId } = req.query;
  const { orgId } = getAuth(req);

  if (!orgId) return res.status(401).json({ message: "Unauthorized" });

  const client = getDbClient();
  const db = client.db("cluster0");
  const scenesCollection = db.collection<Scene>("scenes");
  const sceneConfigCollection = db.collection<SceneConfiguration>("scenes_configuration");

  try {
    if (req.method === 'POST') {
      const newScene = {
        ...req.body,
        activity_id: activityId,
        orgId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await scenesCollection.insertOne(newScene);
      await sceneConfigCollection.insertOne({
        scene_id: result.insertedId.toString(),
        objects: [],
        orgId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return res.status(201).json({
        ...newScene,
        _id: result.insertedId,
        id: result.insertedId.toString()
      });
    }

    if (req.method === 'GET') {
      const activityId = Array.isArray(req.query.activityId) 
        ? req.query.activityId[0] 
        : req.query.activityId;

      const scenes = await scenesCollection.find({
        activity_id: activityId,
        orgId
      });
      
      return res.status(200).json(scenes.map(s => ({
        ...s,
        id: s._id?.toString() || '',
        _id: undefined
      })));
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error("[SCENES_API]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}