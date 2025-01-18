import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromist from "@/lib/mongodb";
import { deleteDocument, getSignedUrl } from "@/lib/cos";

// Helper function to safely convert string to ObjectId
function toObjectId(id: string) {
  try {
    return new ObjectId(id);
  } catch (error) {
    return null;
  }
}

// Helper function to find asset or document
async function findAssetOrDocument(db: any, id: string, orgId: string) {
  const objectId = toObjectId(id);
  if (!objectId) return null;

  // Try documents collection first (since you mentioned RAG documents aren't showing)
  const doc = await db.collection("documents").findOne({
    _id: objectId,
    orgId
  });

  if (doc) {
    return {
      type: 'document',
      data: doc
    };
  }

  // Then try assets collection
  const asset = await db.collection("assets").findOne({
    _id: objectId,
    orgId
  });

  if (asset) {
    return {
      type: 'asset',
      data: asset
    };
  }

  return null;
}

export async function GET(
  req: NextRequest,
  context: { params: { assetId: string } }
) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const params = await context.params;
    
    const client = await clientPromist;
    const db = client.db("cluster0");

    const result = await findAssetOrDocument(db, params.assetId, orgId);

    if (!result) {
      return new NextResponse("Asset not found", { status: 404 });
    }

    // Generate signed URL regardless of type since both use COS
    const signedUrl = await getSignedUrl(result.data.url, 900);

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error("[ASSET_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
    req: NextRequest,
    context: { params: { assetId: string } }
  ) {
    try {
      const { orgId } = getAuth(req);
      if (!orgId) return new NextResponse("Unauthorized", { status: 401 });
  
      const params = await context.params;
      const { name } = await req.json();
  
      if (!name?.trim()) {
        return new NextResponse("Name is required", { status: 400 });
      }
  
      const client = await clientPromist;
      const db = client.db("cluster0");
  
      const objectId = toObjectId(params.assetId);
      if (!objectId) {
        return new NextResponse("Invalid ID format", { status: 400 });
      }
  
      // Find which collection the item is in
      const result = await findAssetOrDocument(db, params.assetId, orgId);
      if (!result) {
        return new NextResponse("Asset not found", { status: 404 });
      }
  
      if (result.type === 'document') {
        await db.collection("documents").updateOne(
          { _id: objectId, orgId },
          { 
            $set: { 
              filename: name,
              name: name,
              updatedAt: new Date() 
            } 
          }
        );
  
        // Fetch updated document
        const updatedDoc = await db.collection("documents").findOne({ _id: objectId, orgId });
        return NextResponse.json(updatedDoc);
      } else {
        await db.collection("assets").updateOne(
          { _id: objectId, orgId },
          { 
            $set: { 
              name: name,
              updatedAt: new Date() 
            } 
          }
        );
  
        // Fetch updated asset
        const updatedAsset = await db.collection("assets").findOne({ _id: objectId, orgId });
        return NextResponse.json(updatedAsset);
      }
    } catch (error) {
      console.error("[ASSET_PATCH]", error);
      return new NextResponse("Internal Error", { status: 500 });
    }
  }

export async function DELETE(
  req: NextRequest,
  context: { params: { assetId: string } }
) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const params = await context.params;
    const client = await clientPromist;
    const db = client.db("cluster0");

    const result = await findAssetOrDocument(db, params.assetId, orgId);
    if (!result) {
      return new NextResponse("Asset not found", { status: 404 });
    }

    // Delete from COS
    await deleteDocument(result.data.url);

    // Delete from appropriate collection
    const collection = result.type === 'document' ? "documents" : "assets";
    const filter: any = { orgId };
    if (params.assetId) {
      filter._id = toObjectId(params.assetId);
    }
    await db.collection(collection).deleteOne(filter);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[ASSET_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}