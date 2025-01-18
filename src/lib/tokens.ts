import { SignJWT, jwtVerify } from 'jose';
import { getRandomValues } from 'crypto';

const API_SECRET = process.env.API_SECRET_KEY;
if (!API_SECRET) throw new Error('API_SECRET_KEY is required');

const secretKey = new TextEncoder().encode(API_SECRET);

export async function generateLLMToken(activityId: string): Promise<string> {
  // Generate a unique token per activity that expires in 7 days
  return new SignJWT({ activityId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setJti(Buffer.from(getRandomValues(new Uint8Array(16))).toString('hex'))
    .sign(secretKey);
}

export async function verifyLLMToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    return null;
  }
}