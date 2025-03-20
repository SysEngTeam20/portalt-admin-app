import { Vector3 } from "@/types/scene";
import { getDbClient } from "@/lib/db";
import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";

interface PublicSceneResponse {
  objects: Array<{
    model: string;
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
  }>;
}

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { activityId, sceneId } = req.query;
  const client = getDbClient();
  const scenesCollection = client.db("cluster0").collection<Scene>("scenes");

  try {
    const activityId = Array.isArray(req.query.activityId) 
      ? req.query.activityId[0] 
      : req.query.activityId;

    const sceneId = Array.isArray(req.query.sceneId)
      ? req.query.sceneId[0]
      : req.query.sceneId;

    switch (req.method) {
      case 'GET': {
        let orgId: string | undefined;
        
        // First try to get orgId from query params
        if (req.query.orgId && typeof req.query.orgId === 'string') {
          orgId = req.query.orgId;
        } else {
          // Fall back to Clerk auth
          const auth = getAuth(req);
          if (auth.orgId) {
            orgId = auth.orgId;
          }
        }

        if (!orgId) {
          return res.status(400).json({ message: "orgId is required either as a query parameter or through authentication" });
        }

        const scene = await scenesCollection.findOne({ 
          _id: sceneId,
          activity_id: activityId,
          orgId
        });
        return res.status(scene ? 200 : 404).json(scene || { message: "Not found" });
      }

      case 'PUT': {
        const { orgId } = getAuth(req);
        
        if (!orgId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        await scenesCollection.updateOne(
          { _id: sceneId, orgId },
          { $set: { ...req.body, updatedAt: new Date() } }
        );
        return res.status(200).json({ success: true });
      }

      case 'DELETE': {
        const { orgId } = getAuth(req);
        
        if (!orgId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        await scenesCollection.deleteOne({ _id: sceneId, orgId });
        return res.status(204).end();
      }

      default:
        return res.status(405).json({ message: "Method not allowed" });
    }
  } catch (error) {
    console.error("[SCENE_API]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
