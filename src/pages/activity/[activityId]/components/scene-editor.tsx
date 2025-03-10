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

interface SceneConfiguration {
  scene_id: string;
  environment: {
    modelUrl?: string;
  };
  objects: Array<{
    object_id: string;
    modelUrl: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  }>;
  orgId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SceneEditorProps {
  activity: Activity;
}

export function SceneEditor({ activity }: SceneEditorProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const { activityId } = useParams() as { activityId: string };
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [draggedScene, setDraggedScene] = useState<Scene | null>(null);
  const [sceneConfigs, setSceneConfigs] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sceneToDelete, setSceneToDelete] = useState<string | null>(null);
  const [isAddingArtifact, setIsAddingArtifact] = useState(false);

  // Fetch scenes from API
  useEffect(() => {
    const fetchScenes = async () => {
      try {
        const response = await fetch(`/api/activities/${activityId}/scenes`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setScenes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch scenes:", error);
        setScenes([]);
      }
    };
    fetchScenes();
  }, [activityId]);

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

  const handleDragStart = (scene: Scene) => {
    setDraggedScene(scene);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetScene: Scene) => {
    if (!draggedScene || draggedScene.id === targetScene.id) return;

    const updatedScenes = [...scenes];
    const draggedIndex = scenes.findIndex(s => s.id === draggedScene.id);
    const targetIndex = scenes.findIndex(s => s.id === targetScene.id);

    // Remove dragged scene from array
    const [removed] = updatedScenes.splice(draggedIndex, 1);
    // Insert it at the target position
    updatedScenes.splice(targetIndex, 0, removed);

    // Update order numbers
    const reorderedScenes = updatedScenes.map((scene, index) => ({
      ...scene,
      order: index + 1,
    }));

    // Optimistic UI update
    setScenes(reorderedScenes);

    // Persist to backend
    fetch(`/api/activities/${activityId}/scenes/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneIds: reorderedScenes.map(s => s.id)
      })
    }).catch(error => {
      console.error("Order update failed:", error);
      // Rollback on error
      setScenes(scenes);
    });

    setDraggedScene(null);
  };

  const handleEnvironmentUpdate = async (sceneId: string, modelUrl: string) => {
    try {
      await fetch(`/api/scenes-configuration/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: { modelUrl },
          objects: sceneConfigs[sceneId]?.objects || []
        })
      });
      
      setSceneConfigs(prev => ({
        ...prev,
        [sceneId]: { ...prev[sceneId], environment: { modelUrl } }
      }));
    } catch (error) {
      console.error("Environment update failed:", error);
    }
  };

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
        environment: {}, 
        objects: [] 
      };

      // Update scene config via API
      const response = await fetch(`/api/scenes-configuration/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: currentConfig.environment,
          objects: [...currentConfig.objects, newObject]
        })
      });

      if (!response.ok) throw new Error('Failed to update scene');

      // Update local state with API response
      const updatedConfig = await response.json();
      setSceneConfigs(prev => ({
        ...prev,
        [sceneId]: updatedConfig
      }));

      // Force refresh by re-fetching scene config
      const refreshResponse = await fetch(`/api/scenes-configuration/${sceneId}`);
      const freshConfig = await refreshResponse.json();
      setSceneConfigs(prev => ({
        ...prev,
        [sceneId]: freshConfig
      }));

    } catch (error) {
      console.error("Artifact addition failed:", error);
      throw error; // Propagate error to handleFileUpload
    }
  };

  const handleRemoveArtifact = async (sceneId: string, objectId: string) => {
    try {
      const updatedObjects = sceneConfigs[sceneId]?.objects?.filter(
        (obj: { object_id: string }) => obj.object_id === objectId
      ) || [];

      // Properly filter OUT the deleted object
      const filteredObjects = sceneConfigs[sceneId]?.objects?.filter(
        (obj: { object_id: string }) => obj.object_id !== objectId
      ) || [];

      await fetch(`/api/scenes-configuration/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: sceneConfigs[sceneId]?.environment || {},
          objects: filteredObjects  // Use filtered array here
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
          environment: sceneConfigs[sceneId]?.environment || {},
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

  const handleAddScene = async () => {
    try {
      const response = await fetch(`/api/activities/${activityId}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Scene',
          order: scenes.length + 1,
          elements: []
        })
      });

      if (response.ok) {
        const newScene = await response.json();
        setScenes(prev => [...prev, newScene]);
      }
    } catch (error) {
      console.error("Scene creation failed:", error);
    }
  };

  const handleUpdateSceneName = async (sceneId: string, newName: string) => {
    try {
      await fetch(`/api/activities/${activityId}/scenes/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      
      setScenes(prev => prev.map(scene => 
        scene.id === sceneId ? { ...scene, name: newName } : scene
      ));
    } catch (error) {
      console.error("Scene rename failed:", error);
    }
  };

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
      
      await handleAddArtifact(selectedScene!, { modelUrl: url });
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

  const handleDeleteScene = async () => {
    if (!sceneToDelete) return;
    
    try {
      const response = await fetch(`/api/activities/${activityId}/scenes/${sceneToDelete}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setScenes(prev => prev.filter(s => s.id !== sceneToDelete));
        if (selectedScene === sceneToDelete) setSelectedScene(null);
        setSceneToDelete(null);
        toast({
          title: "Success",
          description: "Scene deleted successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete scene",
        variant: "destructive",
      });
    }
  };

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

  return (
    <div className="flex gap-6">
      {/* Scene Sequence */}
      <Card className="w-64 bg-white border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Scenes Sequence</h2>
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-600"
            onClick={handleAddScene}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              draggable
              onDragStart={() => handleDragStart(scene)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(scene)}
              className={`
                p-3 rounded-lg border transition-colors cursor-move
                ${draggedScene?.id === scene.id ? 'opacity-50' : 'opacity-100'}
                ${selectedScene === scene.id ? 'border-blue-500 bg-gray-100' : 'border-gray-200 bg-gray-50'}
                hover:border-gray-300
              `}
              onClick={() => setSelectedScene(scene.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 w-4">
                    {scene.order}
                  </span>
                  <SceneNameEditor 
                    name={scene.name}
                    onSave={async (newName) => {
                      try {
                        await handleUpdateSceneName(scene.id, newName);
                      } catch (error) {
                        console.error("Failed to update scene name:", error);
                      }
                    }}
                  />
                </div>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0 text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSceneToDelete(scene.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Updated Scene Editor */}
      <Card className="flex-1 bg-white border-gray-200 p-6 shadow-sm">
        {selectedScene ? (
          <>
            <div className="grid grid-cols-1 gap-6">
              {/* Environment Configuration */}
              <EnvironmentCard 
                sceneId={selectedScene}
                config={sceneConfigs[selectedScene]}
                onEnvironmentUpdate={handleEnvironmentUpdate}
              />

              {/* Artifacts Management */}
              <SceneArtifactsCard 
                sceneId={selectedScene}
                config={sceneConfigs[selectedScene]}
                onAddArtifact={handleAddArtifact}
                onUpdateArtifact={handleUpdateArtifact}
                onRemoveArtifact={handleRemoveArtifact}
                onFileUpload={handleFileUpload}
              />
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">Select a scene to view or edit</p>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      <Dialog open={!!sceneToDelete} onOpenChange={(open) => !open && setSceneToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Scene?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-600">
            This action cannot be undone. All scene configuration will be permanently removed.
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSceneToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteScene}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// New helper components
const EnvironmentCard = ({ 
  sceneId, 
  config,
  onEnvironmentUpdate 
}: { 
  sceneId: string;
  config: any;
  onEnvironmentUpdate: (sceneId: string, modelUrl: string) => Promise<void>;
}) => (
  <Card className="p-4">
    <h3 className="font-semibold mb-4">Environment Configuration</h3>
    <FileUpload 
      onUpload={async (file) => {
        const url = await uploadFileToStorage(file);
        onEnvironmentUpdate(sceneId, url);
      }}
      accept=".glb,.gltf"
      label="Upload 3D Environment"
    />
  </Card>
);

const SceneArtifactsCard = ({ 
  sceneId, 
  config,
  onAddArtifact,
  onUpdateArtifact,
  onRemoveArtifact,
  onFileUpload
}: { 
  sceneId: string;
  config?: SceneConfiguration;
  onAddArtifact: (sceneId: string, artifact: any) => Promise<void>;
  onUpdateArtifact: (sceneId: string, objectId: string, updated: any) => Promise<void>;
  onRemoveArtifact: (sceneId: string, objectId: string) => Promise<void>;
  onFileUpload: (file: File) => Promise<void>;
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
      if (!url.startsWith('https://') || !url.includes('.cloud-object-storage.appdomain.cloud')) {
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
          {config?.objects?.length === 0 ? (
            <div className="col-span-2 text-center p-8 text-muted-foreground">
              <PackageOpen className="h-8 w-8 mx-auto mb-2" />
              <p>No 3D artifacts added yet</p>
              <p className="text-sm mt-1">Add artifacts using the button above</p>
            </div>
          ) : (
            config?.objects?.map((obj) => (
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