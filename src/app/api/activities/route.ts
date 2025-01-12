import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { NextApiRequest, NextApiResponse } from "next";

export async function GET(
  req: NextApiRequest, 
  res: NextApiResponse
) {

  try {
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
      // return res.status(401).json({ message: "Unauthorized" });
    }

    const client = await clientPromise;
    const db = client.db("cluster0");
    
    const activities = await db
      .collection("activities")
      .find({ orgId })
      .sort({ createdAt: -1 })
      .toArray();

      return NextResponse.json(activities);
      // return res.json(activities);
  } catch (error) {
    console.error("[ACTIVITIES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
    // return res.status(500).json({ message: "Internal Error" });
  }
}

export async function POST(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
      // return res.status(401).json({ message: "Unauthorized" });
    }

    const { title, bannerUrl } = await req.body;

    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
      // return res.status(400).json({ message: "Title is required" });
    }

    const client = await clientPromise;
    const db = client.db("cluster0");
    
    const activity = {
      title,
      bannerUrl: bannerUrl || "",
      orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("activities").insertOne(activity);

    return NextResponse.json({ 
      ...activity, 
      _id: result.insertedId 
    });
    // return res.json({ 
    //   ...activity, 
    //   _id: result.insertedId 
    // });
  } catch (error) {
    console.error("[ACTIVITIES_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
    // return res.status(500).json({ message: "Internal Error" });
  }
}