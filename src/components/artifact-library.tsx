'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Asset } from '@/types/asset';
import { PackageOpen } from 'lucide-react';

interface ArtifactLibraryProps {
  onSelect: (artifact: { modelUrl: string }) => void;
}

export function ArtifactLibrary({ onSelect }: ArtifactLibraryProps) {
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const response = await fetch('/api/assets');
        const data = await response.json();
        const filteredAssets = data.filter((a: Asset) => a.type === '3D Objects');
        setAssets(filteredAssets);
      } catch (error) {
        console.error("Failed to fetch assets", error);
      }
    };
    
    fetchAssets();
  }, []);

  const filteredAssets = assets.filter(asset => 
    asset.url?.match(/\.(glb|gltf|fbx|obj|dae|3ds|blend|stl|skp|dxf)$/i)
  );

  return (
    <div className="grid grid-cols-3 gap-4">
      {filteredAssets.length === 0 ? (
        <div className="col-span-3 text-center p-8 text-muted-foreground">
          <PackageOpen className="h-8 w-8 mx-auto mb-2" />
          <p>No 3D models found in library</p>
          <p className="text-sm mt-1">Upload new 3D models using the upload button</p>
        </div>
      ) : (
        filteredAssets.map(asset => (
          <Button
            key={asset._id}
            variant="outline"
            className="h-24 w-full flex flex-col items-center justify-center p-2"
            onClick={() => onSelect({ modelUrl: asset.url })}
          >
            <span className="text-sm truncate w-full text-center">{asset.name}</span>
            <span className="text-xs text-gray-500 mt-1">{asset.type}</span>
          </Button>
        ))
      )}
    </div>
  );
} 