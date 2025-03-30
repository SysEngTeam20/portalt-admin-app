'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Edit3, Eye, Upload, Loader2, Trash2, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity } from '@/types/activity';
import { useParams } from 'next/navigation';
import { FileUpload } from '@/components/file-upload';
import { ArtifactLibrary } from '@/components/artifact-library';
import { ArtifactItem } from '@/components/artifact-item';
import { SceneNameEditor } from '@/components/scene-name-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface Scene {
  id: string;
  name: string;
  order: number;
  elements: any[];
}

interface SceneEditorProps {
  activity: Activity;
}

interface ArtifactObject {
  object_id: string;
  modelUrl: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

export function SceneEditor({ activity }: SceneEditorProps) {
  const { activityId } = useParams() as { activityId: string };
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [sceneConfigs, setSceneConfigs] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sceneToDelete, setSceneToDelete] = useState<string | null>(null);
  const [isAddingArtifact, setIsAddingArtifact] = useState(false);

  // Initialize scene for VR activities
  useEffect(() => {
    if (activity.format === 'VR' && activity.scenes?.[0]) {
      console.log("[SCENE_EDITOR] Setting initial scene for VR:", activity);
      setSelectedScene(activity.scenes[0].id);
      
      // Set initial scene config
      setSceneConfigs(prev => ({
        ...prev,
        [activity.scenes[0].id]: activity.scenes[0].config
      }));
    }
  }, [activity]);

  // Fetch scene configuration when scene is selected
  useEffect(() => {
    if (selectedScene) {
      const fetchSceneConfig = async () => {
        try {
          const response = await fetch(`/api/scenes-configuration/${selectedScene}`);
          const config = await response.json();
          setSceneConfigs(prev => ({
            ...prev,
            [selectedScene]: config
          }));
        } catch (error) {
          console.error("Failed to fetch scene config:", error);
        }
      };

      fetchSceneConfig();
    }
  }, [selectedScene]);

  const handleAddArtifact = async (sceneId: string, artifact: any) => {
    try {
      // Create new object with position data
      const newObject = {
        object_id: crypto.randomUUID(),
        modelUrl: artifact.modelUrl,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };

      // Get current config or initialize empty
      const currentConfig = sceneConfigs[sceneId] || { 
        objects: [] 
      };

      // Ensure objects is an array
      const currentObjects = Array.isArray(currentConfig.objects) ? currentConfig.objects : [];

      console.log("[SCENE_EDITOR] Adding artifact to scene:", {
        sceneId,
        currentConfig,
        newObject
      });

      // Update scene config via API
      const response = await fetch(`/api/scenes-configuration/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objects: [...currentObjects, newObject]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[SCENE_EDITOR] API error:", errorData);
        throw new Error(`Failed to update scene: ${errorData.message || response.statusText}`);
      }

      // Update local state with API response
      const updatedConfig = await response.json();
      console.log("[SCENE_EDITOR] Updated config:", updatedConfig);
      
      setSceneConfigs(prev => ({
        ...prev,
        [sceneId]: updatedConfig
      }));

    } catch (error) {
      console.error("[SCENE_EDITOR] Artifact addition failed:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add artifact to scene",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleRemoveArtifact = async (sceneId: string, objectId: string) => {
    try {
      // Properly filter OUT the deleted object
      const filteredObjects = sceneConfigs[sceneId]?.objects?.filter(
        (obj: { object_id: string }) => obj.object_id !== objectId
      ) || [];

      await fetch(`/api/scenes-configuration/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objects: filteredObjects
        })
      });

      setSceneConfigs(prev => ({
        ...prev,
        [sceneId]: {
          ...prev[sceneId],
          objects: filteredObjects
        }
      }));
    } catch (error) {
      console.error("Artifact removal failed:", error);
    }
  };

  const handleUpdateArtifact = async (sceneId: string, objectId: string, updated: any) => {
    try {
      const updatedObjects = sceneConfigs[sceneId]?.objects?.map((obj: { object_id: string; }) => 
        obj.object_id === objectId ? { ...obj, ...updated } : obj
      ) || [];

      await fetch(`/api/scenes-configuration/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objects: updatedObjects
        })
      });

      setSceneConfigs(prev => ({
        ...prev,
        [sceneId]: {
          ...prev[sceneId],
          objects: updatedObjects
        }
      }));
    } catch (error) {
      console.error("Failed to update artifact:", error);
    }
  };

  // For VR activities, show the scene artifacts card directly
  if (activity.format === 'VR') {
    // Only show loading state if we haven't initialized the scene yet
    if (!selectedScene && !sceneConfigs[activity.scenes?.[0]?.id]) {
      return (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Loading scene...</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <SceneArtifactsCard
          artifacts={sceneConfigs[selectedScene || activity.scenes?.[0]?.id]?.objects}
          onAddArtifact={handleAddArtifact}
          onUpdateArtifact={handleUpdateArtifact}
          onRemoveArtifact={handleRemoveArtifact}
          sceneId={selectedScene || activity.scenes?.[0]?.id}
        />
      </div>
    );
  }

  // AR format handling
  if (activity.format === 'AR') {
    return (
      <Card className="bg-white border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Scene 1</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-gray-600">
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
            <Button variant="outline" size="sm" className="text-gray-600">
              <Edit3 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
        <div className="aspect-video bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
          <p className="text-gray-500">Scene preview will appear here</p>
        </div>
      </Card>
    );
  }

  return null;
}

const SceneArtifactsCard = ({ 
  artifacts,
  onAddArtifact,
  onUpdateArtifact,
  onRemoveArtifact,
  sceneId
}: { 
  artifacts: ArtifactObject[] | undefined;
  onAddArtifact: (sceneId: string, artifact: any) => Promise<void>;
  onUpdateArtifact: (sceneId: string, objectId: string, updated: any) => Promise<void>;
  onRemoveArtifact: (sceneId: string, objectId: string) => Promise<void>;
  sceneId: string;
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'upload' | 'library'>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingArtifact, setIsAddingArtifact] = useState(false);

  const handleFileUpload = async (file: File) => {
    setIsAddingArtifact(true);
    try {
      // Step 1: Upload to assets
      const assetFormData = new FormData();
      assetFormData.append('file', file);
      const assetResponse = await fetch('/api/assets', {
        method: 'POST',
        body: assetFormData
      });
      
      if (!assetResponse.ok) throw new Error('Asset upload failed');
      const { url } = await assetResponse.json();

      // Verify URL format before saving
      if (!url.startsWith('https://') || !url.includes('.cloud-object-storage')) {
        throw new Error('Invalid model URL format');
      }
      
      await onAddArtifact(sceneId, { modelUrl: url });
      setShowAddModal(false);

    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload Error",
        description: "Failed to add artifact to scene",
        variant: "destructive",
      });
    } finally {
      setIsAddingArtifact(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>3D Artifacts</CardTitle>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Artifact
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {artifacts?.length === 0 ? (
            <div className="col-span-2 text-center p-8 text-muted-foreground">
              <PackageOpen className="h-8 w-8 mx-auto mb-2" />
              <p>No 3D artifacts added yet</p>
              <p className="text-sm mt-1">Add artifacts using the button above</p>
            </div>
          ) : (
            artifacts?.map((obj) => (
              <ArtifactItem
                key={obj.object_id}
                object={obj}
                onUpdate={(updated) => onUpdateArtifact(sceneId, obj.object_id, updated)}
                onRemove={() => onRemoveArtifact(sceneId, obj.object_id)}
              />
            ))
          )}
        </div>

        {/* Add Artifact Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="p-6 max-w-md">
            <div className="mt-4">
              <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="upload">Upload New</TabsTrigger>
                  <TabsTrigger value="library">From Library</TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload" className="mx-4">
                  <div className="space-y-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors hover:border-primary/50">
                      <Input 
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".glb,.gltf,.fbx,.obj,.dae,.3ds,.blend,.stl,.skp,.dxf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            await handleFileUpload(file);
                          }
                        }}
                      />
                      <label 
                        htmlFor="file-upload"
                        className={`cursor-pointer flex flex-col items-center space-y-2 ${
                          isAddingArtifact ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        {isAddingArtifact ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">
                              Adding artifact to scene...
                            </p>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground">
                              Drag and drop or click to upload
                            </p>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="library" className="mx-2">
                  <div className="h-96 overflow-y-auto p-2">
                    <ArtifactLibrary 
                      onSelect={async (artifact) => {
                        setIsAddingArtifact(true);
                        try {
                          await onAddArtifact(sceneId, artifact);
                          setShowAddModal(false);
                        } finally {
                          setIsAddingArtifact(false);
                        }
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

// utility function
async function uploadFileToStorage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) throw new Error('Upload failed');
  const { url } = await response.json();
  return url;
}