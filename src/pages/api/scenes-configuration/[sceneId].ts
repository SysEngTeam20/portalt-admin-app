import { getDbClient } from "@/lib/db";
import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { orgId } = getAuth(req);
  const sceneId = req.query.sceneId as string;

  // Skip auth check for GET requests
  if (req.method !== 'GET' && !orgId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const client = getDbClient();
  const collection = client.db("cluster0").collection<{
    _id?: string;
    scene_id: string;
    objects?: any[];
    orgId?: string;
    createdAt: Date;
    updatedAt: Date;
  }>("scenes_configuration");

  try {
    switch (req.method) {
      case 'GET':
        const config = await collection.findOne({ scene_id: sceneId });
        if (!config) {
          // Create neutral config without orgId
          const newConfig = {
            scene_id: sceneId,
            objects: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await collection.insertOne(newConfig);
          return res.status(200).json(newConfig);
        }
        return res.status(200).json(config);

      case 'PUT':
        const existing = await collection.findOne({ scene_id: sceneId });
        if (!existing) {
          await collection.insertOne({
            scene_id: sceneId,
            ...req.body,
            orgId,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else {
          await collection.updateOne(
            { scene_id: sceneId },
            { $set: { ...req.body, updatedAt: new Date() } }
          );
        }
        return res.status(200).json({ success: true });

      default:
        return res.status(405).json({ message: "Method not allowed" });
    }
  } catch (error) {
    console.error("[SCENE_CONFIG_API]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
} 