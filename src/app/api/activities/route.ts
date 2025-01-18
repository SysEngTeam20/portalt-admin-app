import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
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
    }

    const client = await clientPromise;
    const db = client.db("cluster0");
    
    const activities = await db
      .collection("activities")
      .find({ orgId })
      .sort({ createdAt: -1 })
      .toArray();

      return NextResponse.json(activities);
  } catch (error) {
    console.error("[ACTIVITIES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { title, bannerUrl, platform, format } = await req.json();

    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
    }

    if (!format || !["AR", "VR"].includes(format)) {
      return new NextResponse("Valid format (AR/VR) is required", { status: 400 });
    }

    if (!platform || !["headset", "web"].includes(platform)) {
      return new NextResponse("Valid platform (headset/web) is required", { status: 400 });
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

    return NextResponse.json({ 
      ...activity, 
      _id: result.insertedId 
    });
  } catch (error) {
    console.error("[ACTIVITIES_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}