import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ReviewStatsProps {
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
  lastUpdated: string;
}

export function ReviewStats({
  rating,
  reviewCount,
  starsBreakdown,
  verifiedPurchases,
  lastUpdated,
}: ReviewStatsProps) {
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
                <span className="text-4xl font-bold">
                  {rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  out of 5
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on {reviewCount.toLocaleString()} reviews
              </p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-3">
              {Object.entries(starsBreakdown)
                .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                .map(([stars, percentage]) => {
                  const percent = percentage * 100;
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
                        {percent.toFixed(0)}%
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
              <span>{reviewCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Verified Purchases</span>
              <span>{verifiedPurchases.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Updated</span>
              <span>{formatDate(lastUpdated)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}