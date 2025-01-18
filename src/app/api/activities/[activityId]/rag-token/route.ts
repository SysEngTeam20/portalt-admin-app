// app/api/activities/[activityId]/rag-token/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { generateLLMToken } from "@/lib/tokens";

type Props = {
  params: {
    activityId: string;
  };
};

export async function POST(
  request: NextRequest,
  { params }: Props
) {
  try {
    const { orgId } = getAuth(request);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });
    
    const client = await clientPromise;
    const db = client.db("cluster0");

    // Verify activity exists and belongs to organization
    const activity = await db.collection("activities").findOne({
      _id: new ObjectId(params.activityId),
      orgId,
      ragEnabled: true
    });

    if (!activity) {
      return new NextResponse("Activity not found or RAG not enabled", { status: 404 });
    }

    // Generate a new LLM access token
    const token = await generateLLMToken(params.activityId);

    return NextResponse.json({ token });
  } catch (error) {
    console.error("[RAG_TOKEN_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}