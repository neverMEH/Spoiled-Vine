import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { ViolationScanner } from './violation-scanner';

interface ReviewListProps {
  reviews: Array<{
    review_id: string;
    title: string;
    content: string;
    rating: number;
    review_date: string;
    verified_purchase: boolean;
    helpful_votes: number;
    variant?: string;
    reviewUrl?: string;
  }>;
  onViolationScanComplete?: (violations: any) => void;
}

export function ReviewList({ reviews, onViolationScanComplete }: ReviewListProps) {
  const [reviewsPerPage, setReviewsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Customer Reviews</CardTitle>
          <Select
            value={reviewsPerPage.toString()}
            onValueChange={(value) => {
              setReviewsPerPage(parseInt(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Reviews per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="recent" className="space-y-4">
          <TabsList>
            <TabsTrigger value="recent">Most Recent</TabsTrigger>
            <TabsTrigger value="helpful">Most Helpful</TabsTrigger>
            <TabsTrigger value="critical">Critical Reviews</TabsTrigger>
            <TabsTrigger value="violations">Review Violations</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="space-y-4">
            {reviews.length > 0 ? (
              <>
                {reviews
                  .slice((currentPage - 1) * reviewsPerPage, currentPage * reviewsPerPage)
                  .map((review) => (
                    <div
                      key={review.review_id}
                      className="border-b last:border-0 pb-6 last:pb-0 pt-6 first:pt-0 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating
                                    ? 'fill-primary text-primary'
                                    : 'fill-muted text-muted'
                                }`}
                              />
                            ))}
                          </div>
                          <h4 className="font-medium">{review.title || 'Review'}</h4>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {review.variant && (
                            <Badge variant="outline">
                              {review.variant}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(review.review_date)}
                          </div>
                          {review.verified_purchase && (
                            <Badge variant="success">Verified Purchase</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {review.helpful_votes > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <span>👍</span>
                              <span>{review.helpful_votes.toLocaleString()}</span>
                            </Badge>
                          )}
                          {review.reviewUrl && (
                            <a
                              href={review.reviewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline"
                            >
                              View Review →
                            </a>
                          )}
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{review.content}</p>
                    </div>
                  ))}
                {/* Pagination */}
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Showing {Math.min((currentPage - 1) * reviewsPerPage + 1, reviews.length)} to{' '}
                    {Math.min(currentPage * reviewsPerPage, reviews.length)} of{' '}
                    {reviews.length} reviews
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {currentPage} of {Math.ceil(reviews.length / reviewsPerPage)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(reviews.length / reviewsPerPage), p + 1))}
                      disabled={currentPage >= Math.ceil(reviews.length / reviewsPerPage)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No reviews available
              </div>
            )}
          </TabsContent>

          <TabsContent value="violations">
            <ViolationScanner
              reviews={reviews}
              onScanComplete={onViolationScanComplete}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}