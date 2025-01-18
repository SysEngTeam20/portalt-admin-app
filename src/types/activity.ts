// types/activity.ts
export type ActivityFormat = "AR" | "VR";
export type ActivityPlatform = "headset" | "web";

export interface Scene {
  id: string;
  order: number;
  elements: SceneElement[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  title: string;
  url: string;
  activity_id: string;
}

export interface SceneElement {
  id: string;
  type: string;
  properties: Record<string, any>;
}

export interface Activity {
  _id: string;
  title: string;
  description?: string;
  bannerUrl: string;
  format: "AR" | "VR";
  platform: "headset" | "web";
  orgId: string;
  ragEnabled: boolean;
  documentIds: string[];
  createdAt: Date;
  updatedAt: Date;
}