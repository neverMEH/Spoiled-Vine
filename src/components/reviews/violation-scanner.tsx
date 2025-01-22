import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/feedback/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { config } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, CheckCircle, AlertCircle, Ban, Shield } from 'lucide-react';

interface ViolationType {
  type: string;
  severity: 'High' | 'Medium' | 'Low';
  userBenefit: 'High' | 'Medium' | 'Low';
  action: 'Remove' | 'Edit' | 'Keep';
  details: string;
}

interface ReviewViolation {
  reviewId: string;
  violations: ViolationType[];
  scannedAt: string;
  overridden?: boolean;
  overriddenBy?: string;
  overriddenAt?: string;
}

interface ViolationScannerProps {
  reviews: any[];
  onScanComplete?: (violations: Record<string, ReviewViolation>) => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second base delay

export function ViolationScanner({ reviews, onScanComplete }: ViolationScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [violations, setViolations] = useState<Record<string, ReviewViolation>>({});
  const [scanStats, setScanStats] = useState({
    totalScanned: 0,
    violationsFound: 0,
    byType: {
      inappropriate: 0,
      spam: 0,
      fake: 0,
      policy: 0
    }
  });
  const { toast } = useToast();

  const processReview = async (review: any) => {
    try {
      if (!review.review_id || (!review.content && !review.text)) {
        console.warn('Skipping invalid review data:', review);
        return null;
      }
      
      const reviewContent = review.content || review.text;
      if (!reviewContent.trim()) {
        console.warn('Skipping empty review content:', review.review_id);
        return null;
      }

      // Prepare review data
      const reviewData = {
        id: review.review_id,
        content: reviewContent,
        rating: review.rating,
        date: review.review_date || review.date,
        author: review.author,
        verified: review.verified_purchase || review.verified,
        product_id: review.product_id,
        title: review.title,
        helpful_votes: review.helpful_votes || 0,
        total_votes: review.total_votes || 0,
        variant: review.variant
      };

      // Add retry logic
      let attempts = 0;
      const maxAttempts = 3;
      const baseDelay = 1000; // 1 second

      while (attempts < maxAttempts) {
        try {
          const response = await fetch(config.services.n8n.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ review: reviewData })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const responseText = await response.text();
          if (!responseText.trim()) {
            throw new Error('Empty response');
          }

          try {
            const data = JSON.parse(responseText);
            if (!data || !data.violations) {
              throw new Error('Invalid response');
            }
            return {
              reviewId: review.review_id,
              violations: data.violations,
              scannedAt: new Date().toISOString()
            };
          } catch (parseError) {
            throw new Error('Parse error');
          }
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) {
            console.error('Max retry attempts reached for review:', review.review_id, error);
            throw error;
          }
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, baseDelay * Math.pow(2, attempts - 1))
          );
        }
      }
    } catch (error) {
      console.error('Error processing review:', review.review_id, error);
      return null;
    }
  };

  const scanReviews = async () => {
    if (!config.services.n8n.webhookUrl) {
      toast({
        title: 'Configuration Error',
        description: 'Review scanning service URL is not configured',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setIsScanning(true);
      setProgress(0);
      let processedCount = 0;

      // Process reviews in batches to avoid overwhelming the service
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < reviews.length; i += batchSize) {
        batches.push(reviews.slice(i, i + batchSize));
      }

      const allViolations: Record<string, ReviewViolation> = {};
      
      // Process batches sequentially
      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch
            .filter(review => review && review.review_id)
            .map(review => processReview(review))
        );

        // Process batch results
        for (const result of batchResults) {
          if (result) {
            allViolations[result.reviewId] = result;
            
            // Store violation in database
            try {
              await supabase
                .from('review_violations')
                .insert({
                  review_id: result.reviewId,
                  product_id: batch[0].product_id, // All reviews in batch are from same product
                  violations: result.violations,
                  scanned_at: result.scannedAt
                });
            } catch (error) {
              console.error('Failed to store violation:', error);
            }
          }
        }

        processedCount += batch.length;
        setProgress((processedCount / reviews.length) * 100);

        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Update violations state
      setViolations(allViolations);
      
      // Update scan stats
      const stats = {
        totalScanned: reviews.length,
        violationsFound: Object.keys(allViolations).length,
        byType: {
          inappropriate: 0,
          spam: 0,
          fake: 0,
          policy: 0
        }
      };
      
      // Count violations by type
      Object.values(allViolations).forEach((violation) => {
        violation.violations.forEach((v) => {
          if (stats.byType[v.type as keyof typeof stats.byType] !== undefined) {
            stats.byType[v.type as keyof typeof stats.byType]++;
          }
        });
      });
      
      setScanStats(stats);
      
      // Call onScanComplete callback with violations
      if (onScanComplete) {
        onScanComplete(allViolations);
      }

      toast({
        title: 'Scan Complete',
        description: `Found ${Object.keys(allViolations).length} violations in ${reviews.length} reviews.`,
      });

    } catch (error) {
      console.error('Scan error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error 
          ? `Failed to scan reviews: ${error.message}`
          : 'Failed to scan reviews',
        variant: 'destructive'
      });
    } finally {
      setIsScanning(false);
      setProgress(100);
    }
  };

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'Pricing/Availability Keywords':
        return <Ban className="h-4 w-4 text-red-500" />;
      case 'Spam Content':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'Fake Review':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'Policy Violation':
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-muted-foreground';
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          onClick={scanReviews}
          disabled={isScanning || reviews.length === 0}
          className="w-[200px]"
        >
          {isScanning ? (
            <>
              <LoadingSpinner className="mr-2" size="sm" />
              Scanning...
            </>
          ) : (
            <>
              <Shield className="mr-2 h-4 w-4" />
              Scan Reviews
            </>
          )}
        </Button>

        {scanStats.totalScanned > 0 && (
          <div className="text-sm text-muted-foreground">
            Last scan: {scanStats.violationsFound} violations found in {scanStats.totalScanned} reviews
          </div>
        )}
      </div>

      {isScanning && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            Processing reviews... {Math.round(progress)}% complete
          </p>
        </div>
      )}

      {scanStats.violationsFound > 0 && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Scan Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Inappropriate</span>
                  </div>
                  <p className="text-2xl font-bold">{scanStats.byType.inappropriate}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">Spam</span>
                  </div>
                  <p className="text-2xl font-bold">{scanStats.byType.spam}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Fake</span>
                  </div>
                  <p className="text-2xl font-bold">{scanStats.byType.fake}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Policy</span>
                  </div>
                  <p className="text-2xl font-bold">{scanStats.byType.policy}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {Object.values(violations).map((violation) => (
              <Card key={violation.reviewId} className="relative overflow-hidden">
                {!violation.overridden && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                )}
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {violation.violations.map((v, i) => (
                          <div key={i} className="space-y-2">
                            <Badge
                              variant={violation.overridden ? 'outline' : 'destructive'}
                              className="flex items-center gap-1"
                            >
                              {getViolationIcon(v.type)}
                              {v.type}
                            </Badge>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={getSeverityColor(v.severity)}>
                                Severity: {v.severity}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className={getSeverityColor(v.userBenefit)}>
                                User Benefit: {v.userBenefit}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span>Action: {v.action}</span>
                            </div>
                            {v.details && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {v.details}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {violation.overridden ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            Overridden by {violation.overriddenBy} on{' '}
                            {new Date(violation.overriddenAt!).toLocaleDateString()}
                          </span>
                        ) : (
                          `Detected on ${new Date(violation.scannedAt).toLocaleDateString()}`
                        )}
                      </p>
                    </div>
                    {!violation.overridden && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Handle override
                          const updatedViolations = {
                            ...violations,
                            [violation.reviewId]: {
                              ...violation,
                              overridden: true,
                              overriddenBy: 'Admin', // Replace with actual user
                              overriddenAt: new Date().toISOString()
                            }
                          };
                          setViolations(updatedViolations);
                          if (onScanComplete) {
                            onScanComplete(updatedViolations);
                          }
                        }}
                      >
                        Override
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}