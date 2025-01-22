import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Section } from '@/components/layout/section';
import { LoadingSpinner } from '@/components/feedback/loading-spinner';
import { TrendChart } from '@/components/charts/trend-chart';
import { Button } from '@/components/ui/button';
import { ProductHeader } from '@/components/reviews/product-header';
import { ProductInfo } from '@/components/reviews/product-info';
import { ReviewStats } from '@/components/reviews/review-stats';
import { ReviewList } from '@/components/reviews/review-list';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { productScraperService } from '@/services/product-scraper';

interface ProductDetails {
  id: string;
  asin: string;
  title: string;
  brand: string;
  price: number;
  currency: string;
  availability: string;
  specifications: Record<string, string>;
  dimensions?: {
    width?: string;
    height?: string;
    length?: string;
    weight?: string;
  };
  best_sellers_rank?: Array<{
    category: string;
    rank: number;
  }>;
  variations?: Array<{
    title: string;
    asin: string;
    price?: number;
    available?: boolean;
  }>;
  frequently_bought_together?: Array<{
    asin: string;
    title: string;
    price?: number;
  }>;
  customer_questions?: Array<{
    question: string;
    answer: string;
    votes: number;
    date: string;
  }>;
  images: string[];
  categories: string[];
  features: string[];
  description: string;
  rating_data: {
    rating: number;
    reviewCount: number;
    starsBreakdown: {
      '5star': number;
      '4star': number;
      '3star': number;
      '2star': number;
      '1star': number;
    };
    lastUpdated: string | null;
  };
  review_summary: {
    verifiedPurchases: number;
    lastUpdated: string;
  };
  reviews: Array<{
    id: string;
    title: string;
    text: string;
    rating: number;
    date: string;
    verified: boolean;
    author: string;
    images?: string[];
  }>;
  status: string;
  updated_at: string;
}

export function DetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'refreshing'>('idle');
  const [historicalData, setHistoricalData] = useState<{
    prices: Array<{ date: string; value: number }>;
    ratings: Array<{ date: string; value: number }>;
    reviews: Array<{ date: string; value: number }>;
    ranks: Array<{ date: string; value: number }>;
  }>({
    prices: [],
    ratings: [],
    reviews: [],
    ranks: []
  });

  useEffect(() => {
    if (id) {
      fetchProduct(id);
      fetchHistoricalData(id);
    }
  }, [id]);

  const fetchProduct = async (productId: string) => {
    try {
      setIsLoading(true);
      let { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Product not found');
      
      // Ensure reviews is always an array
      if (!Array.isArray(data.reviews)) {
        data.reviews = [];
      }
      
      // Sort reviews by date (most recent first)
      data.reviews.sort((a, b) => {
        const dateA = new Date(a.review_date || a.date);
        const dateB = new Date(b.review_date || b.date);
        return dateB.getTime() - dateA.getTime();
      });

      setProduct(data as ProductDetails);
    } catch (error) {
      console.error('Error fetching product:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch product details',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistoricalData = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_history')
        .select(`
          price,
          rating,
          review_count,
          best_sellers_rank,
          captured_at
        `)
        .eq('product_id', productId)
        .order('captured_at', { ascending: true })
        .limit(30);

      if (error) throw error;

      const prices: Array<{ date: string; value: number }> = [];
      const ratings: Array<{ date: string; value: number }> = [];
      const reviews: Array<{ date: string; value: number }> = [];
      const ranks: Array<{ date: string; value: number }> = [];

      data.forEach(record => {
        const date = new Date(record.captured_at).toISOString();
        
        if (record.price !== null && !isNaN(record.price)) {
          prices.push({ date, value: record.price });
        }
        
        if (record.rating !== null && !isNaN(record.rating)) {
          ratings.push({ date, value: record.rating });
        }
        
        if (record.review_count !== null && !isNaN(record.review_count)) {
          reviews.push({ date, value: record.review_count });
        }
        
        if (record.best_sellers_rank?.[0]?.rank !== null && !isNaN(record.best_sellers_rank[0].rank)) {
          ranks.push({ date, value: record.best_sellers_rank[0].rank });
        }
      });

      setHistoricalData({
        prices,
        ratings,
        reviews,
        ranks
      });
    } catch (error) {
      console.error('Error fetching historical data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch historical data',
        variant: 'destructive'
      });
    }
  };

  const handleRefresh = async () => {
    if (!product) return;

    try {
      setIsRefreshing(true);
      setRefreshStatus('refreshing');
      
      await supabase
        .from('products')
        .update({ status: 'refreshing' })
        .eq('id', product.id);
      
      await productScraperService.startScraping([product.asin]);
      toast({
        title: 'Refresh Started',
        description: 'Product data refresh has been initiated.',
      });
      
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from('products')
          .select('status')
          .eq('id', product.id)
          .single();
          
        if (data?.status === 'active') {
          clearInterval(interval);
          setRefreshStatus('idle');
          fetchProduct(product.id);
        }
      }, 2000);
      
      setTimeout(() => {
        clearInterval(interval);
        setRefreshStatus('idle');
      }, 5 * 60 * 1000);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to refresh data',
        variant: 'destructive',
      });
      setRefreshStatus('idle');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Product Not Found</h2>
          <Button onClick={() => navigate('/reviews')}>Back to Products</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Container>
        <Section>
          <div className="space-y-8">
            <ProductHeader
              brand={product.brand}
              asin={product.asin}
              availability={product.availability}
              isRefreshing={isRefreshing || refreshStatus === 'refreshing'}
              onBack={() => navigate('/reviews')}
              onRefresh={handleRefresh}
            />

            <div className="space-y-6">
              <ProductInfo product={product} />

              {/* Trend Charts */}
              <div className="grid grid-cols-2 gap-6">
                <TrendChart
                  title="Price History"
                  data={historicalData.prices}
                  valueFormatter={(value) => formatCurrency(value)}
                />
                <TrendChart
                  title="Rating Trend"
                  data={historicalData.ratings}
                  valueFormatter={(value) => value.toFixed(1)}
                />
                <TrendChart
                  title="Best Sellers Rank"
                  data={historicalData.ranks}
                  valueFormatter={(value) => `#${value.toLocaleString()}`}
                />
                <TrendChart
                  title="Total Reviews"
                  data={historicalData.reviews}
                  valueFormatter={(value) => value.toLocaleString()}
                />
              </div>

              <ReviewStats
                rating={product.rating_data.rating}
                reviewCount={product.rating_data.reviewCount}
                starsBreakdown={product.rating_data.starsBreakdown}
                verifiedPurchases={product.review_summary.verifiedPurchases}
                lastUpdated={product.rating_data.lastUpdated || product.updated_at}
              />

              <ReviewList
                reviews={product.reviews}
                onViolationScanComplete={(violations) => {
                  const updatedReviews = product.reviews.map(review => ({
                    ...review,
                    violations: violations[review.review_id]?.violations || []
                  }));
                  setProduct({
                    ...product,
                    reviews: updatedReviews
                  });
                }}
              />
            </div>
          </div>
        </Section>
      </Container>
    </div>
  );
}