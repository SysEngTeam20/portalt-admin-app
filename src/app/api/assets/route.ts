import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { uploadDocument } from "@/lib/cos";
import { documentToAsset } from "@/types/asset";

// GET all assets and documents for an organization
export async function GET(req: NextRequest) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const client = await clientPromise;
    const db = client.db("cluster0");
    
    // Fetch from both collections
    const [assets, documents] = await Promise.all([
      db.collection("assets")
        .find({ orgId })
        .toArray(),
      db.collection("documents")
        .find({ orgId })
        .toArray()
    ]);

    // Transform documents to asset format
    const documentAssets = documents.map(documentToAsset);
    
    // Combine and sort by creation date
    const allAssets = [...assets, ...documentAssets]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(allAssets);
  } catch (error) {
    console.error("[ASSETS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// POST new asset
export async function POST(req: NextRequest) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new NextResponse("File is required", { status: 400 });
    }

    // Determine asset type based on file mime type
    let assetType: '3D Objects' | 'Images' | 'RAG Documents';
    if (file.type.startsWith('image/')) {
      assetType = 'Images';
    } else if (file.name.endsWith('.obj') || file.name.endsWith('.fbx') || file.name.endsWith('.gltf')) {
      assetType = '3D Objects';
    } else {
      assetType = 'RAG Documents';
    }

    // Generate safe filename and upload to COS
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFilename = `${timestamp}-${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const cosKey = await uploadDocument(buffer, uniqueFilename, file.type);

    const client = await clientPromise;
    const db = client.db("cluster0");

    // Create asset metadata
    const asset = {
      _id: new ObjectId(),
      name: file.name,
      type: assetType,
      size: file.size,
      url: cosKey,
      orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection("assets").insertOne(asset);

    return NextResponse.json(asset);
  } catch (error) {
    console.error("[ASSETS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}