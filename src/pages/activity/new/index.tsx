'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ActivityFormat, ActivityPlatform } from '@/types/activity';

export default function CreateActivityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    bannerUrl: '',
    format: '' as ActivityFormat,
    platform: '' as ActivityPlatform,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create activity');
      }

      const activity = await response.json();
      
      toast({
        title: "Success!",
        description: "Activity created successfully.",
        variant: "default",
      });

      router.push(`/activity/${activity._id}`);
    } catch (error) {
      console.error('Error creating activity:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create activity",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Activity</CardTitle>
          <CardDescription>
            Set up a new AR or VR activity for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rest of the form remains the same */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter activity title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bannerUrl">Banner Image URL</Label>
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
                  <ImageIcon className="w-4 h-4" />
                  Upload
                </Button> */}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <RadioGroup
                value={formData.format}
                onValueChange={(value) => setFormData({ ...formData, format: value as ActivityFormat })}
                className="flex gap-4"
                required
              >
                {/* <div className="flex items-center space-x-2">
                  <RadioGroupItem value="AR" id="ar" />
                  <Label htmlFor="ar">AR</Label>
                </div> */}
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="VR" id="vr" />
                  <Label htmlFor="vr">VR</Label>
                </div>
              </RadioGroup>
            </div>

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
                {/* <div className="flex items-center space-x-2">
                  <RadioGroupItem value="web" id="web" />
                  <Label htmlFor="web">Web</Label>
                </div> */}
              </RadioGroup>
            </div>

            <div className="flex gap-4 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Activity'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}