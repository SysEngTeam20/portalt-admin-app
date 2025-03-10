'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

export function SceneNameEditor({
  name,
  onSave
}: {
  name: string;
  onSave: (newName: string) => void;
}) {
  const [editedName, setEditedName] = useState(name);

  return (
    <Input
      value={editedName}
      onChange={(e) => setEditedName(e.target.value)}
      onBlur={() => onSave(editedName)}
      className="text-sm font-medium border-none px-0"
    />
  );
} 