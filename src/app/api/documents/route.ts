import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { uploadDocument, deleteDocument } from "@/lib/cos";

// GET list of organization's documents
export async function GET(req: NextRequest) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const activityId = searchParams.get('activityId');

    const client = await clientPromise;
    const db = client.db("cluster0");

    const query = {
      orgId,
      ...(activityId && { activityIds: activityId }),
    };

    const documents = await db
      .collection("documents")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(documents);
  } catch (error) {
    console.error("[DOCUMENTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// POST upload new document
export async function POST(req: NextRequest) {
    try {
      const { orgId } = getAuth(req);
      if (!orgId) return new NextResponse("Unauthorized", { status: 401 });
  
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const activityId = formData.get('activityId') as string | null;
      
      if (!file) {
        return new NextResponse("File is required", { status: 400 });
      }
  
      console.log('Uploading file:', {
        name: file.name,
        type: file.type,
        size: file.size,
        activityId
      });
  
      // Generate a safe filename
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFilename = `${timestamp}-${safeName}`;
  
      // Upload to COS
      const buffer = Buffer.from(await file.arrayBuffer());
      const cosKey = await uploadDocument(buffer, uniqueFilename, file.type);
  
      console.log('File uploaded to COS:', cosKey);
  
      const client = await clientPromise;
      const db = client.db("cluster0");
  
      // Create document metadata
      const document = {
        _id: new ObjectId(),
        filename: file.name,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url: cosKey,
        orgId,
        activityIds: activityId ? [activityId] : [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
  
      await db.collection("documents").insertOne(document);
  
      // If activityId provided, update activity's documentIds
      if (activityId) {
        await db.collection("activities").updateOne(
          { _id: new ObjectId(activityId), orgId },
          { $addToSet: { documentIds: document._id.toString() } }
        );
      }
  
      return NextResponse.json(document);
    } catch (error) {
      console.error("[DOCUMENTS_POST]", error);
      if (error instanceof Error) {
        console.error("[DOCUMENTS_POST] Error details:", error.message);
      }
      return new NextResponse("Internal Error", { status: 500 });
    }
  }