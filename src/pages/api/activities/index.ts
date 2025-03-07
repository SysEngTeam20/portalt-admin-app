import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import clientPromise from "@/lib/mongodb";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { orgId } = getAuth(req);
    
  if (!orgId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Handle GET request
  if (req.method === 'GET') {
    try {
      const client = await clientPromise;
      const db = client.db("cluster0");
      
      const activities = await db
        .collection("activities")
        .find({ orgId })
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json(activities);
    } catch (error) {
      console.error("[ACTIVITIES_GET]", error);
      return res.status(500).json({ message: "Internal Error" });
    }
  } 
  
  // Handle POST request
  else if (req.method === 'POST') {
    try {
      const { title, bannerUrl, platform, format } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      if (!format || !["AR", "VR"].includes(format)) {
        return res.status(400).json({ message: "Valid format (AR/VR) is required" });
      }

      if (!platform || !["headset", "web"].includes(platform)) {
        return res.status(400).json({ message: "Valid platform (headset/web) is required" });
      }

      const client = await clientPromise;
      const db = client.db("cluster0");
      
      const activity = {
        title,
        bannerUrl: bannerUrl || "",
        platform: platform,
        format: format,
        orgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection("activities").insertOne(activity);

      return res.status(200).json({ 
        ...activity, 
        _id: result.insertedId 
      });
    } catch (error) {
      console.error("[ACTIVITIES_POST]", error);
      return res.status(500).json({ message: "Internal Error" });
    }
  } 
  
  // Handle unsupported methods
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
} 