'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Activity } from '@/types/activity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

export default function HomePage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch('/api/activities');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setActivities(data);
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Activities</h1>
        <Button 
          onClick={() => router.push('/activity/new')}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {activities.map((activity) => (
          <Link 
            key={activity._id} 
            href={`/activity/${activity._id}`}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                {activity.bannerUrl && (
                  <div className="relative w-full h-48">
                    <Image
                      src={activity.bannerUrl}
                      alt={activity.title}
                      fill
                      className="object-cover rounded-t-lg"
                    />
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-4">
                <h2 className="text-xl font-semibold">{activity.title}</h2>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}