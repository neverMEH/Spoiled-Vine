import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ReviewStatsProps {
  productId: string;
}

export function ReviewStats({ productId }: ReviewStatsProps) {
  const [stats, setStats] = useState<{
    rating: number;
    reviewCount: number;
    starsBreakdown: {
      '5star': number;
      '4star': number;
      '3star': number;
      '2star': number;
      '1star': number;
    };
    verifiedPurchases: number;
    lastUpdated: string | null;
  }>({
    rating: 0,
    reviewCount: 0,
    starsBreakdown: {
      '5star': 0,
      '4star': 0,
      '3star': 0,
      '2star': 0,
      '1star': 0
    },
    verifiedPurchases: 0,
    lastUpdated: null
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await supabase
        .rpc('get_product_stats', { p_product_id: productId });

      if (error) {
        console.error('Error fetching review stats:', error);
        return;
      }

      if (data && data.length > 0) {
        const stats = data[0];
        setStats({
          rating: stats.rating_data?.rating || 0,
          reviewCount: parseInt(stats.rating_data?.reviewCount) || 0,
          starsBreakdown: stats.rating_data?.starsBreakdown || {
            '5star': 0,
            '4star': 0,
            '3star': 0,
            '2star': 0,
            '1star': 0
          },
          verifiedPurchases: stats.review_summary?.verifiedPurchases || 0,
          lastUpdated: stats.rating_data?.lastUpdated || null
        });
      }
    };

    if (productId) {
      fetchStats();
    }
  }, [productId]);

  return (
    <div className="grid grid-cols-3 gap-6">
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Review Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-8">
            {/* Overall Rating */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Star className="h-8 w-8 fill-primary text-primary" />
                <span className="text-4xl font-bold">{parseFloat(stats.rating.toFixed(1))}</span>
                <span className="text-muted-foreground">out of 5</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on {stats.reviewCount.toLocaleString()} reviews
              </p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-3">
              {Object.entries(stats.starsBreakdown)
                .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                .map(([stars, percentage]) => {
                  const percent = parseFloat((percentage * 100).toFixed(1));
                  return (
                    <div key={stars} className="grid grid-cols-[auto,1fr,auto] items-center gap-2">
                      <div className="flex items-center gap-1 w-12">
                        <span>{stars.replace('star', '')}</span>
                        <Star className={`h-4 w-4 ${percent > 0 ? 'fill-primary text-primary' : 'fill-muted text-muted'}`} />
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {percent}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Review Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Reviews</span>
              <span>{stats.reviewCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Verified Purchases</span>
              <span>{stats.verifiedPurchases.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Updated</span>
              <span>{stats.lastUpdated ? formatDate(stats.lastUpdated) : 'N/A'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}