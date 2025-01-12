export type ActivityFormat = "AR" | "VR";
export type ActivityPlatform = "headset" | "web";

export interface Activity {
  _id: string;
  title: string;
  bannerUrl: string;
  format: ActivityFormat;
  platform: ActivityPlatform;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}