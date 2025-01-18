// app/api/activities/[activityId]/scenes/[sceneId]/elements/route.ts
import { NextRequest, NextResponse } from "next/server";
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

// GET all elements for a scene
export async function GET(
  req: NextRequest,
  { params }: { params: { activityId: string; sceneId: string } }
) {
  try {
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("cluster0");
    
    const activity = await db.collection("activities").findOne(
      {
        _id: new ObjectId(params.activityId),
        orgId,
        "scenes.id": params.sceneId
      },
      { projection: { "scenes.$": 1 } }
    );

    if (!activity || !activity.scenes?.[0]) {
      return new NextResponse("Scene not found", { status: 404 });
    }

    return NextResponse.json(activity.scenes[0].elements || []);
  } catch (error) {
    console.error("[ELEMENTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// POST create new element
export async function POST(
  req: NextRequest,
  { params }: { params: { activityId: string; sceneId: string } }
) {
  try {
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { type, properties } = await req.json();

    if (!type) {
      return new NextResponse("Element type is required", { status: 400 });
    }

    const newElement = {
      id: new ObjectId().toString(),
      type,
      properties: properties || {}
    };

    const client = await clientPromise;
    const db = client.db("cluster0");

    const result = await db.collection<Activity>("activities").updateOne(
      {
        _id: new ObjectId(params.activityId),
        orgId,
        "scenes.id": params.sceneId
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
      return new NextResponse("Scene not found", { status: 404 });
    }

    return NextResponse.json(newElement);
  } catch (error) {
    console.error("[ELEMENTS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// PUT update elements (for bulk updates/reordering)
export async function PUT(
  req: NextRequest,
  { params }: { params: { activityId: string; sceneId: string } }
) {
  try {
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { elements } = await req.json();

    if (!Array.isArray(elements)) {
      return new NextResponse("Invalid elements data", { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cluster0");

    const result = await db.collection("activities").updateOne(
      {
        _id: new ObjectId(params.activityId),
        orgId,
        "scenes.id": params.sceneId
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
      return new NextResponse("Scene not found", { status: 404 });
    }

    return NextResponse.json(elements);
  } catch (error) {
    console.error("[ELEMENTS_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}