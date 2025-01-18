'use client';

import { useState, useRef } from 'react';
import { Plus, Edit3, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Activity } from '@/types/activity';

interface Scene {
  id: string;
  order: number;
  elements: any[]; // Define proper type based on your elements structure
}

interface SceneEditorProps {
  activity: Activity;
}

export function SceneEditor({ activity }: SceneEditorProps) {
  const [scenes, setScenes] = useState<Scene[]>([
    { id: '1', order: 1, elements: [] },
    { id: '2', order: 2, elements: [] },
    { id: '3', order: 3, elements: [] },
  ]);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [draggedScene, setDraggedScene] = useState<Scene | null>(null);

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
    updatedScenes.splice(draggedIndex, 1);
    // Insert it at the target position
    updatedScenes.splice(targetIndex, 0, draggedScene);

    // Update order numbers
    const reorderedScenes = updatedScenes.map((scene, index) => ({
      ...scene,
      order: index + 1,
    }));

    setScenes(reorderedScenes);
    setDraggedScene(null);
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
          <h2 className="text-lg font-semibold text-gray-900">Scene Sequence</h2>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-gray-600"
            onClick={() => {
              const newScene = {
                id: Date.now().toString(),
                order: scenes.length + 1,
                elements: []
              };
              setScenes([...scenes, newScene]);
            }}
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
                <span className="text-gray-700">Scene {scene.order}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                    <Eye className="h-3 w-3 text-gray-500" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                    <Edit3 className="h-3 w-3 text-gray-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Scene Preview/Editor */}
      <Card className="flex-1 bg-white border-gray-200 p-6 shadow-sm">
        {selectedScene ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Scene {scenes.find(s => s.id === selectedScene)?.order}
              </h2>
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
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">Select a scene to view or edit</p>
          </div>
        )}
      </Card>
    </div>
  );
}