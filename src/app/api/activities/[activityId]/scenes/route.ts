import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

interface Scene {
  id: string;
  order: number;
  elements: any[];
  createdAt: Date;
  updatedAt: Date;
}

interface Activity {
  _id: ObjectId;
  orgId: string;
  scenes: Scene[];
  updatedAt: Date;
}

// GET all scenes for an activity
export async function GET(
  req: NextRequest,
  { params }: any
) {
  try {
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("cluster0");
    
    const activity = await db.collection("activities").findOne({
      _id: new ObjectId(params.activityId),
      orgId
    });

    if (!activity) {
      return new NextResponse("Activity not found", { status: 404 });
    }

    return NextResponse.json(activity.scenes || []);
  } catch (error) {
    console.error("[SCENES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// POST create new scene
export async function POST(
  req: NextRequest,
  { params }: any
) {
  try {
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("cluster0");
    
    // First get the activity to check ownership and get current scenes count
    const activity = await db.collection<Activity>("activities").findOne({
      _id: new ObjectId(params.activityId),
      orgId
    });

    if (!activity) {
      return new NextResponse("Activity not found", { status: 404 });
    }

    const currentScenes = activity.scenes || [];
    const newScene = {
      id: new ObjectId().toString(),
      order: currentScenes.length + 1,
      elements: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<Activity>("activities").updateOne(
      { _id: new ObjectId(params.activityId) },
      { 
        $push: { scenes: { $each: [newScene] } },
        $set: { updatedAt: new Date() }
      }
    );

    return NextResponse.json(newScene);
  } catch (error) {
    console.error("[SCENES_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// PUT update scene order
export async function PUT(
  req: NextRequest,
  { params }: any
) {
  try {
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { scenes } = await req.json();

    if (!Array.isArray(scenes)) {
      return new NextResponse("Invalid scenes data", { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cluster0");

    const result = await db.collection("activities").updateOne(
      {
        _id: new ObjectId(params.activityId),
        orgId
      },
      {
        $set: {
          scenes,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return new NextResponse("Activity not found", { status: 404 });
    }

    return NextResponse.json(scenes);
  } catch (error) {
    console.error("[SCENES_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}