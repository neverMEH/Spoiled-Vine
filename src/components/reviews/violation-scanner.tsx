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
const RETRY_DELAY = 5000; // 5 second base delay
const SCAN_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const PROGRESS_INTERVAL = 10000; // 10 seconds

export function ViolationScanner({ reviews, onScanComplete }: ViolationScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [progressIntervalId, setProgressIntervalId] = useState<NodeJS.Timeout | null>(null);
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
  
  // Subscribe to violation updates
  useEffect(() => {
    const channel = supabase
      .channel('review_violations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'review_violations'
        },
        (payload) => {
          // Update local state when new violations are added
          const violation = payload.new;
          setViolations(prev => ({
            ...prev,
            [violation.review_id]: {
              reviewId: violation.review_id,
              violations: violation.violations,
              scannedAt: violation.scanned_at,
              overridden: violation.overridden,
              overriddenBy: violation.overridden_by,
              overriddenAt: violation.overridden_at
            }
          }));

          // Update scan stats
          setScanStats(prev => ({
            ...prev,
            violationsFound: prev.violationsFound + 1,
            byType: {
              ...prev.byType,
              [violation.violation_type?.toLowerCase() || 'policy']: 
                (prev.byType[violation.violation_type?.toLowerCase() || 'policy'] || 0) + 1
            }
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const { toast } = useToast();

  const processReviews = async (reviews: any[]) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT);

      // Filter out invalid reviews
      const validReviews = reviews.filter(review => {
        if (!review.review_id || (!review.content && !review.text)) {
          console.warn('Skipping invalid review data:', review);
          return false;
        }
        const reviewContent = review.content || review.text;
        if (!reviewContent.trim()) {
          console.warn('Skipping empty review content:', review.review_id);
          return false;
        }
        return true;
      });

      // Prepare all review data
      const reviewsData = validReviews.map(review => ({
        id: review.review_id,
        content: review.content || review.text,
        rating: review.rating,
        date: review.review_date || review.date,
        author: review.author,
        verified: review.verified_purchase || review.verified,
        product_id: review.product_id,
        title: review.title,
        helpful_votes: review.helpful_votes || 0,
        total_votes: review.total_votes || 0,
        variant: review.variant
      }));

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
            body: JSON.stringify({ reviews: reviewsData }),
            signal: controller.signal
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
            // Handle both single object and array responses
            if (!data) {
              throw new Error('Invalid response');
            }
            
            // If response is a single object with violations
            if (data.violations) {
              return [{
                reviewId: reviewsData[0].id,
                violations: data.violations,
                scannedAt: new Date().toISOString()
              }];
            }
            
            // If response is an array of results
            if (Array.isArray(data.results)) {
              return data.results.map((result: any) => ({
                reviewId: result.reviewId,
                violations: result.violations,
                scannedAt: new Date().toISOString()
              }));
            }
            
            // If response has a different structure
            return reviewsData.map(review => ({
              reviewId: review.id,
              violations: data[review.id]?.violations || [],
              reviewId: result.reviewId,
              violations: result.violations,
              scannedAt: new Date().toISOString()
            }));
          } catch (parseError) {
            console.error('Parse error:', parseError, 'Response:', responseText);
            throw new Error(`Parse error: ${parseError.message}`);
          }
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) {
            console.error('Max retry attempts reached:', error);
            console.error('Last response:', error.response?.text);
            throw error;
          }
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, baseDelay * Math.pow(2, attempts - 1))
          );
        }
      }
    } catch (error) {
      console.error('Error processing reviews:', error);
      return null;
    }
  };

  const scanReviews = async () => {
    setShouldStop(false);
    
    // Clear any existing intervals/timeouts
    if (timeoutId) clearTimeout(timeoutId);
    if (progressIntervalId) clearInterval(progressIntervalId);

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
      
      // Start progress simulation
      const startTime = Date.now();
      const intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        // Simulate progress up to 95% over 10 minutes
        const simulatedProgress = Math.min(95, (elapsed / (10 * 60 * 1000)) * 100);
        setProgress(simulatedProgress);
      }, PROGRESS_INTERVAL);
      setProgressIntervalId(intervalId);

      // Set overall timeout
      const timeout = setTimeout(() => {
        setIsScanning(false);
        clearInterval(intervalId);
        toast({
          title: 'Scan Timeout',
          description: 'The scan took too long and was cancelled',
          variant: 'destructive'
        });
      }, SCAN_TIMEOUT);
      setTimeoutId(timeout);

      if (shouldStop) {
        clearInterval(intervalId);
        clearTimeout(timeout);
        setIsScanning(false);
        setProgress(0);
        toast({
          title: 'Scan Stopped',
          description: 'Review scanning was stopped manually'
        });
        return;
      }

      // Process all reviews in a single request
      toast({
        title: 'Processing Started',
        description: 'Processing reviews through violation detection service...'
      });

      const results = await processReviews(reviews);
      
      if (!results || !Array.isArray(results)) {
        throw new Error('Invalid response format from violation detection service');
      }

      const allViolations: Record<string, ReviewViolation> = {};

      // Process results and store in Supabase
      for (const violation of results) {
        if (violation) {
          allViolations[violation.reviewId] = violation;
          
          // Store violation in Supabase
          try {
            await supabase
              .from('review_violations')
              .insert({
                review_id: violation.reviewId,
                product_id: reviews[0].product_id,
                violations: violation.violations,
                scanned_at: violation.scannedAt,
                parsed_output: violation.details || null,
                violation_type: violation.violations[0]?.type || null,
                severity: violation.violations[0]?.severity || null,
                user_benefit: violation.violations[0]?.userBenefit || null,
                action: violation.violations[0]?.action || null,
                details: violation.violations[0]?.details || null
              });
          } catch (error) {
            console.error('Failed to store violation:', error);
          }
        }
      }

      if (!results || results.length === 0) {
        throw new Error('No results returned from violation detection service');
      }

      setProgress(100);

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
      // Clear intervals/timeouts on error
      if (progressIntervalId) clearInterval(progressIntervalId);
      if (timeoutId) clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 15 minutes');
      }
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
      if (progressIntervalId) clearInterval(progressIntervalId);
      if (timeoutId) clearTimeout(timeoutId);
      setProgress(100);
    }
  };

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'Pricing/Availability Keywords':
      case 'Price Manipulation':
        return <Ban className="h-4 w-4 text-red-500" />;
      case 'Spam Content':
      case 'Promotional Content':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'Fake Review':
      case 'Inauthentic Review':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'Policy Violation':
      case 'Terms of Service Violation':
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
        <div className="flex items-center gap-2 w-[200px]">
          {isScanning ? (
            <Button
              variant="destructive"
              onClick={() => setShouldStop(true)}
              className="w-full"
            >
              <LoadingSpinner className="mr-2" size="sm" />
              Stop Scanning
            </Button>
          ) : (
            <Button
              onClick={scanReviews}
              disabled={reviews.length === 0}
              className="w-full"
            >
              <Shield className="mr-2 h-4 w-4" />
              Scan Reviews
            </Button>
          )}
        </div>

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