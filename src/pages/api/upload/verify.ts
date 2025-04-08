import { NextApiRequest, NextApiResponse } from 'next';
import AWS from 'ibm-cos-sdk';

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

  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ message: 'Key is required' });
    }

    // Check if the object exists in COS
    await cosClient.headObject({
      Bucket: process.env.COS_BUCKET_NAME!,
      Key: key
    }).promise();

    return res.status(200).json({ message: 'File exists' });
  } catch (error) {
    console.error('Error verifying file:', error);
    if (error instanceof Error) {
      if (error.name === 'NotFound') {
        return res.status(404).json({ message: 'File not found' });
      }
    }
    return res.status(500).json({ message: 'Error verifying file' });
  }
} 