import { S3 } from 'ibm-cos-sdk';
import crypto from 'crypto';

if (!process.env.COS_ENDPOINT || !process.env.COS_API_KEY_ID || !process.env.COS_INSTANCE_CRN || !process.env.COS_BUCKET_NAME) {
  throw new Error('Missing IBM COS configuration');
}

const cos = new S3({
  endpoint: process.env.COS_ENDPOINT,
  apiKeyId: process.env.COS_API_KEY_ID,
  serviceInstanceId: process.env.COS_INSTANCE_CRN,
  signatureVersion: 'v4',
});

const BUCKET_NAME = process.env.COS_BUCKET_NAME;

export async function uploadDocument(file: Buffer, filename: string, mimeType: string): Promise<string> {
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const key = `documents/${uniqueId}/${filename}`;

  await cos.putObject({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: mimeType,
  }).promise();

  return key;
}

export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  return cos.getSignedUrl('getObject', {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: expiresIn,
  });
}

export async function deleteDocument(key: string): Promise<void> {
  await cos.deleteObject({
    Bucket: BUCKET_NAME,
    Key: key,
  }).promise();
}