import S3 from 'ibm-cos-sdk/clients/s3';

if (!process.env.COS_ACCESS_KEY_ID || !process.env.COS_SECRET_ACCESS_KEY) {
  throw new Error('Missing HMAC credentials');
}

const config = {
  endpoint: `https://${process.env.COS_ENDPOINT}`,
  accessKeyId: process.env.COS_ACCESS_KEY_ID,
  secretAccessKey: process.env.COS_SECRET_ACCESS_KEY,
  region: process.env.IBM_CLOUD_REGION,
  apiKeyId: process.env.COS_API_KEY_ID,
  serviceInstanceId: process.env.COS_INSTANCE_CRN,
};

const BUCKET_NAME = process.env.COS_BUCKET_NAME;

let cosClient: S3 | null = null;

function getCosClient() {
  if (!cosClient) {
    if (!config.endpoint || !config.accessKeyId || !config.secretAccessKey || !BUCKET_NAME) {
      console.error('COS Config:', {
        endpoint: config.endpoint,
        hasAccessKey: !!config.accessKeyId,
        hasSecretKey: !!config.secretAccessKey,
        bucket: BUCKET_NAME
      });
      throw new Error('Missing required COS configuration');
    }
    
    console.log('Initializing COS client with config:', {
      endpoint: config.endpoint,
      region: config.region,
      bucket: BUCKET_NAME
    });
    
    cosClient = new S3(config);
  }
  return cosClient;
}

export async function uploadDocument(file: Buffer, filename: string, mimeType: string): Promise<string> {
  console.log('Starting upload with:', { filename, mimeType, size: file.length });
  
  if (!filename) {
    throw new Error('Filename is required');
  }

  try {
    const cos = getCosClient();
    // Ensure the filename is URL-safe
    const safeFilename = encodeURIComponent(filename);
    const key = `documents/${safeFilename}`;

    console.log('Preparing upload params:', {
      bucket: BUCKET_NAME,
      key,
      contentType: mimeType,
      fileSize: file.length
    });

    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: mimeType,
    };
    console.log('Starting putObject operation');
    const result = await cos.putObject({
      ...uploadParams,
      Bucket: BUCKET_NAME!
    }).promise();
    console.log('Upload successful:', result);

    return key;
  } catch (error) {
    console.error('Error uploading to COS:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      bucket: BUCKET_NAME,
      filename
    });
    throw error;
  }
}

export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  if (!key) {
    throw new Error('Key is required');
  }

  const cos = getCosClient();
  return cos.getSignedUrl('getObject', {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: expiresIn,
  });
}

export async function deleteDocument(key: string): Promise<void> {
  if (!key) {
    throw new Error('Key is required');
  }

  const cos = getCosClient();
  await cos.deleteObject({
    Bucket: BUCKET_NAME!,
    Key: key,
  }).promise();
}