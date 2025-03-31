import { NextApiRequest, NextApiResponse } from 'next';
import AWS from 'ibm-cos-sdk';
import { v4 as uuidv4 } from 'uuid';

// Validate required environment variables
const requiredEnvVars = {
  IBM_CLOUD_REGION: process.env.IBM_CLOUD_REGION,
  COS_BUCKET_NAME: process.env.COS_BUCKET_NAME,
  COS_ACCESS_KEY_ID: process.env.COS_ACCESS_KEY_ID,
  COS_SECRET_ACCESS_KEY: process.env.COS_SECRET_ACCESS_KEY
};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
}

// Initialize IBM Cloud COS client
const cosClient = new AWS.S3({
  endpoint: `https://s3.${process.env.IBM_CLOUD_REGION}.cloud-object-storage.appdomain.cloud`,
  accessKeyId: process.env.COS_ACCESS_KEY_ID,
  secretAccessKey: process.env.COS_SECRET_ACCESS_KEY,
  region: process.env.IBM_CLOUD_REGION,
  signatureVersion: 'v4',
  s3ForcePathStyle: true
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Check for missing environment variables
  if (missingVars.length > 0) {
    console.error('Missing environment variables:', missingVars);
    return res.status(500).json({ 
      message: 'Missing required environment variables',
      missing: missingVars
    });
  }

  try {
    const { fileName, contentType } = req.body;
    
    // Validate request body
    if (!fileName) {
      return res.status(400).json({ 
        message: 'fileName is required in request body',
        received: req.body
      });
    }

    console.log('Received request for presigned URL:', {
      fileName,
      contentType,
      body: req.body
    });

    // Use original filename, just ensure it's URL-safe
    const safeFileName = encodeURIComponent(fileName);
    // Add unique identifier to filename
    const uniqueId = uuidv4();
    const fileExtension = safeFileName.split('.').pop();
    const baseFileName = safeFileName.slice(0, -(fileExtension?.length || 0) - 1);
    const uniqueFileName = `${baseFileName}_${uniqueId}.${fileExtension}`;
    const key = `uploads/${uniqueFileName}`;

    // Log configuration for debugging
    console.log('COS Configuration:', {
      endpoint: `https://s3.${process.env.IBM_CLOUD_REGION}.cloud-object-storage.appdomain.cloud`,
      region: process.env.IBM_CLOUD_REGION,
      bucket: process.env.COS_BUCKET_NAME,
      key: key,
      hasAccessKeyId: !!process.env.COS_ACCESS_KEY_ID,
      hasSecretAccessKey: !!process.env.COS_SECRET_ACCESS_KEY
    });

    // Generate presigned URL with 1 hour expiration
    const uploadUrl = await cosClient.getSignedUrl('putObject', {
      Bucket: process.env.COS_BUCKET_NAME,
      Key: key,
      ContentType: contentType || 'application/octet-stream',
      Expires: 3600, // 1 hour
      ServerSideEncryption: 'AES256',
      ACL: 'public-read'
    });

    // Create the public URL using the correct endpoint
    const publicUrl = `https://s3.${process.env.IBM_CLOUD_REGION}.cloud-object-storage.appdomain.cloud/${process.env.COS_BUCKET_NAME}/${key}`;

    return res.status(200).json({
      uploadUrl,
      publicUrl,
      key
    });
  } catch (error) {
    console.error('Error in presigned URL handler:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      env: {
        hasRegion: !!process.env.IBM_CLOUD_REGION,
        hasBucket: !!process.env.COS_BUCKET_NAME,
        hasAccessKeyId: !!process.env.COS_ACCESS_KEY_ID,
        hasSecretAccessKey: !!process.env.COS_SECRET_ACCESS_KEY
      }
    });
    return res.status(500).json({ 
      message: 'Error generating presigned URL',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 