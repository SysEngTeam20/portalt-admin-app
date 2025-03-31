import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getCosClient } from "@/lib/cos";
import { v4 as uuidv4 } from 'uuid';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { orgId } = getAuth(req);
    if (!orgId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { filename, contentType } = req.body;
    if (!filename) {
      return res.status(400).json({ message: 'Filename is required' });
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFilename = `${orgId}/${timestamp}-${safeName}`;

    const cos = getCosClient();
    const params = {
      Bucket: process.env.COS_BUCKET_NAME!,
      Key: uniqueFilename,
      ContentType: contentType || 'application/octet-stream',
      Expires: 900, // URL expires in 15 minutes
    };

    const signedUrl = await cos.getSignedUrlPromise('putObject', params);

    // Generate the public URL
    const publicUrl = `https://${process.env.COS_BUCKET_NAME}.s3.${process.env.IBM_CLOUD_REGION}.cloud-object-storage.appdomain.cloud/${uniqueFilename}`;

    return res.status(200).json({
      uploadUrl: signedUrl,
      key: uniqueFilename,
      publicUrl,
      expiresIn: 900
    });
  } catch (error) {
    console.error('[PRESIGNED_URL_API] Error:', error);
    return res.status(500).json({ 
      message: 'Failed to generate upload URL',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 