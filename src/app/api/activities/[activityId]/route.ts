import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

// GET single activity
export async function GET(
  req: NextRequest,
  context: { params: { activityId: string } }
) {
  try {
    const params = await context.params;
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

    return NextResponse.json(activity);
  } catch (error) {
    console.error("[ACTIVITY_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// PATCH update activity
export async function PATCH(
  req: NextRequest,
  context: { params: { activityId: string } }
) {
  try {
    const params = await context.params;
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      bannerUrl,
      format,
      platform,
      ragEnabled,
    } = body;

    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
    }

    if (format && !["AR", "VR"].includes(format)) {
      return new NextResponse("Invalid format", { status: 400 });
    }

    if (platform && !["headset", "web"].includes(platform)) {
      return new NextResponse("Invalid platform", { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cluster0");

    const updatedActivity = await db.collection("activities").findOneAndUpdate(
      {
        _id: new ObjectId(params.activityId),
        orgId
      },
      {
        $set: {
          title,
          description,
          bannerUrl,
          format,
          platform,
          ragEnabled,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    // if (!updatedActivity || !updatedActivity.value) {
    //   return new NextResponse("Activity not found", { status: 404 });
    // }

    return NextResponse.json("ok");
  } catch (error) {
    console.error("[ACTIVITY_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// DELETE activity
export async function DELETE(
  req: NextRequest,
  context: { params: { activityId: string } }
) {
  try {
    const params = await context.params;
    const { orgId } = getAuth(req);
    
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("cluster0");

    const result = await db.collection("activities").deleteOne({
      _id: new ObjectId(params.activityId),
      orgId
    });

    if (result.deletedCount === 0) {
      return new NextResponse("Activity not found", { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[ACTIVITY_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}