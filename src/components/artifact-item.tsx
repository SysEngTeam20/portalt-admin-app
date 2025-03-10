'use client';

import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ArtifactItemProps {
  object: {
    object_id: string;
    modelUrl: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };
  onUpdate: (updated: any) => void;
  onRemove: () => void;
}

export function ArtifactItem({ object, onUpdate, onRemove }: ArtifactItemProps) {
  return (
    <Card className="relative hover:shadow-md transition-shadow border p-2 rounded-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm truncate">
          {object.modelUrl?.split('/').pop() || 'Unnamed Model'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-1 right-1 p-1 h-6 w-6 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3 text-red-500" />
        </Button>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-gray-500">
          Position: {object.position.x.toFixed(2)}, {object.position.y.toFixed(2)}, {object.position.z.toFixed(2)}
        </div>
        <div className="text-xs text-gray-500">
          Rotation: {object.rotation.x.toFixed(2)}, {object.rotation.y.toFixed(2)}, {object.rotation.z.toFixed(2)}
        </div>
        <div className="text-xs text-gray-500">
          Scale: {object.scale.x.toFixed(2)}, {object.scale.y.toFixed(2)}, {object.scale.z.toFixed(2)}
        </div>
      </div>
    </Card>
  );
} 