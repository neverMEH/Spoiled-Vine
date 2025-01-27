import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CaseTemplateDialog } from './case-template-dialog';
import { Badge } from '@/components/ui/badge';
import { Star, Calendar, CheckCircle, AlertTriangle, AlertCircle, Ban, Shield } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ReviewListProps {
  reviews: Array<{
    review_id: string;
    asin: string;
    title: string;
    content: string;
    rating: number;
    review_date: string;
    verified_purchase: boolean;
    helpful_votes: number;
    variant?: string;
    reviewUrl?: string;
  }>;
  violations?: Record<string, {
    violations: Array<{
      type: string;
      category: string;
      severity: string;
      userBenefit: string;
      action: string;
      details: string;
    }>;
    scanned_at: string;
    overridden?: boolean;
    overridden_by?: string;
    overridden_at?: string;
  }>;
}

export function ReviewList({ reviews, violations = {} }: ReviewListProps) {
  const [reviewsPerPage, setReviewsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [showViolations, setShowViolations] = useState(false);

  // Filter reviews based on rating and violations
  const filteredReviews = reviews.filter(review => {
    // First apply rating filter
    if (ratingFilter !== 'all') {
      const rating = parseInt(ratingFilter);
      if (review.rating !== rating) return false;
    }

    // Then apply violations filter
    if (showViolations && violations) {
      return violations[review.review_id]?.violations?.length > 0;
    }

    return true;
  });

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'Content Violation':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Customer Reviews</CardTitle>
          <div className="flex items-center gap-4">
            <Select
              value={ratingFilter}
              onValueChange={setRatingFilter}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter by rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setShowViolations(!showViolations)}
              className={showViolations ? 'bg-red-100 hover:bg-red-200 border-red-200' : ''}
            >
              {showViolations ? 'Show All Reviews' : 'Show Violations Only'}
            </Button>
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredReviews.length > 0 ? (
            <>
              {filteredReviews
                .slice((currentPage - 1) * reviewsPerPage, currentPage * reviewsPerPage)
                .map((review) => (
                  <div
                    key={review.review_id}
                    className={`border-b last:border-0 pb-6 last:pb-0 pt-6 first:pt-0 space-y-3 ${
                      violations[review.review_id]?.violations?.length ? 'bg-red-50/10' : ''
                    }`}
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
                        {violations && violations[review.review_id]?.violations?.length > 0 && (
                          <Badge variant="destructive">
                            {violations[review.review_id].violations.length} Violation{violations[review.review_id].violations.length > 1 ? 's' : ''}
                          </Badge>
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
                        <a
                          href={`https://www.amazon.com/gp/customer-reviews/${review.review_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          View on Amazon →
                        </a>
                        {/* Keep existing reviewUrl link if present */}
                        {review.reviewUrl && review.reviewUrl !== `https://www.amazon.com/gp/customer-reviews/${review.review_id}` && (
                          <a
                            href={review.reviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            Alternate Link →
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{review.content}</p>
                    {violations && violations[review.review_id]?.violations?.length > 0 && (
                      <div className="mt-4 p-4 bg-red-50/50 rounded-md border border-red-100">
                        <h5 className="font-medium text-red-600 mb-2">Review Violations</h5>
                        <div className="space-y-2">
                          {violations[review.review_id].violations.map((violation, index) => {
                            const isOverridden = violations[review.review_id].overridden;
                            return (
                              <div key={index} className="text-sm space-y-2 p-3 bg-background rounded-md">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant={isOverridden ? 'outline' : 'destructive'}
                                    className="flex items-center gap-1"
                                  >
                                    {getViolationIcon(violation.type)}
                                    {violation.type}
                                  </Badge>
                                  <Badge variant="secondary">
                                    Category: {violation.category}
                                  </Badge>
                                  <Badge 
                                    variant={
                                      violation.severity === 'Critical' ? 'destructive' :
                                      violation.severity === 'High' ? 'destructive' :
                                      violation.severity === 'Medium' ? 'warning' :
                                      'secondary'
                                    }
                                  >
                                    Severity: {violation.severity}
                                  </Badge>
                                </div>
                                <div className="flex justify-end mt-2">
                                  <CaseTemplateDialog
                                    asin={review.asin}
                                    reviewId={review.review_id}
                                    review={{
                                      title: review.title,
                                      content: review.content
                                    }}
                                    violation={{
                                      type: violation.type,
                                      category: violation.category,
                                      details: violation.details
                                    }}
                                  />
                                </div>
                                {violation.details && (
                                  <div className="mt-2">
                                    <p className="text-sm font-medium mb-1">Details:</p>
                                    <p className="text-sm text-muted-foreground">{violation.details}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {violations[review.review_id].overridden && (
                            <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              <span>
                                Overridden by {violations[review.review_id].overridden_by} on{' '}
                                {formatDate(violations[review.review_id].overridden_at)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min((currentPage - 1) * reviewsPerPage + 1, filteredReviews.length)} to{' '}
                  {Math.min(currentPage * reviewsPerPage, filteredReviews.length)} of{' '}
                  {filteredReviews.length} reviews
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
                    Page {currentPage} of {Math.ceil(filteredReviews.length / reviewsPerPage)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredReviews.length / reviewsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(filteredReviews.length / reviewsPerPage)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No reviews match the current filters
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}