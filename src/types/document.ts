export interface Document {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string; // COS URL
  orgId: string;
  activityIds: string[]; // Activities this document is associated with
  metadata: {
    title?: string;
    author?: string;
    createdDate?: string;
    keywords?: string[];
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}