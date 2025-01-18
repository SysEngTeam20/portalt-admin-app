export type AssetType = '3D Objects' | 'Images' | 'RAG Documents';

export interface Asset {
  _id: string;
  name: string;
  type: AssetType;
  size: number;
  url: string;
  orgId: string;
  activityIds?: string[]; // For RAG documents
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to transform a document to an asset
export function documentToAsset(doc: any): Asset {
  return {
    _id: doc._id,
    name: doc.filename || doc.name,
    type: 'RAG Documents',
    size: doc.size,
    url: doc.url,
    orgId: doc.orgId,
    activityIds: doc.activityIds,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}