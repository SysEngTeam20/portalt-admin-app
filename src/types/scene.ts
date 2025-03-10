export interface SceneConfiguration {
  _id?: string;
  activity_id: string;
  scene_id: string;
  environment?: {
    modelUrl?: string;
    thumbnailUrl?: string;
  };
  objects: SceneObject[];
}

export interface SceneObject {
  object_id: string;
  modelUrl: string;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export function isValidCOSUrl(url: string): boolean {
  const pattern = /^https:\/\/[a-z0-9-]+\.s3\.[a-z0-9-]+\.cloud-object-storage\.appdomain\.cloud\/.+/;
  return pattern.test(url);
} 