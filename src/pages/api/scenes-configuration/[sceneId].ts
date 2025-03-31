import { getDbClient } from "@/lib/db";
import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";

// Helper function to parse JSON body
const parseJsonBody = async (req: NextApiRequest) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(body);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const sceneId = req.query.sceneId as string;
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

        const config = await collection.findOne({ scene_id: sceneId, orgId });
        if (!config) {
          // Create neutral config with orgId
          const newConfig = {
            scene_id: sceneId,
            objects: [],
            orgId,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await collection.insertOne(newConfig);
          return res.status(200).json(newConfig);
        }
        return res.status(200).json(config);
      }

      case 'PUT': {
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

        let body;
        if (req.headers['content-type']?.includes('application/json')) {
          body = await parseJsonBody(req);
        } else {
          body = req.body;
        }

        console.log("[SCENE_CONFIG_API] PUT request body:", body);
        const existing = await collection.findOne({ scene_id: sceneId, orgId });
        console.log("[SCENE_CONFIG_API] Existing config:", existing);
        
        if (!existing) {
          const newConfig = {
            scene_id: sceneId,
            ...body,
            orgId,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          console.log("[SCENE_CONFIG_API] Creating new config:", newConfig);
          await collection.insertOne(newConfig);
          return res.status(200).json(newConfig);
        } else {
          // Remove _id and any other immutable fields from the update
          const { _id, ...updateData } = body;
          const updatedConfig = {
            ...existing,
            ...updateData,
            updatedAt: new Date()
          };
          console.log("[SCENE_CONFIG_API] Updating config:", updatedConfig);
          const result = await collection.updateOne(
            { scene_id: sceneId, orgId },
            { $set: updatedConfig }
          );
          console.log("[SCENE_CONFIG_API] Update result:", result);
          return res.status(200).json(updatedConfig);
        }
      }

      default:
        return res.status(405).json({ message: "Method not allowed" });
    }
  } catch (error) {
    console.error("[SCENE_CONFIG_API] Detailed error:", error);
    return res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 