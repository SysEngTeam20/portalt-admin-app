'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Trash2, 
  Loader2,
  ImagePlus 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Card,
  CardContent
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Activity, ActivityFormat, ActivityPlatform } from '@/types/activity';

interface SettingsPanelProps {
  activity: Activity;
  onUpdate: (activity: Activity) => void;
}

export function SettingsPanel({ activity, onUpdate }: SettingsPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    title: activity.title,
    description: activity.description || '',
    bannerUrl: activity.bannerUrl || '',
    format: activity.format,
    platform: activity.platform,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const response = await fetch(`/api/activities/${activity._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const updatedActivity = await response.json();
      onUpdate(updatedActivity);
      
      toast({
        title: "Success",
        description: "Activity updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update activity",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/activities/${activity._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Success",
        description: "Activity deleted successfully",
      });

      router.push('/');
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete activity",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
  <Card>
    <CardContent className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cover Image */}
        <div className="space-y-2">
          <Label htmlFor="bannerUrl">Cover Image</Label>
          <div className="flex gap-2">
            <Input
              id="bannerUrl"
              value={formData.bannerUrl}
              onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
              placeholder="https://example.com/image.jpg"
              type="url"
            />
            {/* <Button 
              type="button" 
              variant="outline" 
              className="flex gap-2"
            >
              <ImagePlus className="h-4 w-4" />
              Upload
            </Button> */}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Name</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Activity name"
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe your activity"
            rows={4}
          />
        </div>

        {/* Format */}
        <div className="space-y-2">
          <Label>Format</Label>
          <RadioGroup
            value={formData.format}
            onValueChange={(value) => setFormData({ ...formData, format: value as ActivityFormat })}
            className="flex gap-4"
            required
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="VR" id="vr" />
              <Label htmlFor="vr">VR</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Platform */}
        <div className="space-y-2">
          <Label>Platform</Label>
          <RadioGroup
            value={formData.platform}
            onValueChange={(value) => setFormData({ ...formData, platform: value as ActivityPlatform })}
            className="flex gap-4"
            required
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="headset" id="headset" />
              <Label htmlFor="headset">Headset</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                type="button"
                variant="destructive"
                disabled={isDeleting}
                className="flex gap-2"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete Activity
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this
                  activity and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button 
            type="submit" 
            disabled={isLoading}
            className="flex gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>
  );
}