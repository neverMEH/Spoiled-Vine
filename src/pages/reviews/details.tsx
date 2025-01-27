import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Section } from '@/components/layout/section';
import { LoadingSpinner } from '@/components/feedback/loading-spinner';
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
  const [violations, setViolations] = useState<Record<string, any>>({});
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'refreshing'>('idle');
  const [violationCount, setViolationCount] = useState(0);

  useEffect(() => {
    if (id) {
      fetchProduct(id);
      fetchViolations(id);
    }
  }, [id]);

  const fetchViolations = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('review_violations') 
        .select('*')
        .eq('product_id', productId)
        .eq('overridden', false); // Only get non-overridden violations

      if (error) throw error;

      // Count total non-overridden violations
      const totalViolations = data.reduce((count, violation) => {
        return violation.overridden ? count : count + 1;
      }, 0);
      setViolationCount(totalViolations);

      // Create a map of review_id to violations
      const violationsMap = data.reduce((acc: Record<string, any>, violation) => {
        if (!acc[violation.review_id]) {
          acc[violation.review_id] = {
            violations: [],
            scanned_at: violation.scanned_at,
            overridden: violation.overridden,
            overridden_by: violation.overridden_by,
            overridden_at: violation.overridden_at
          };
        }
        
        acc[violation.review_id].violations.push({
            type: violation.violation_type,
            category: violation.violation_category,
            severity: violation.severity,
            userBenefit: violation.user_benefit,
            action: violation.action,
            details: violation.details
        });
        
        return acc;
      }, {});

      setViolations(violationsMap);
    } catch (error) {
      console.error('Error fetching violations:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch review violations',
        variant: 'destructive'
      });
    }
  };

  const fetchProduct = async (productId: string) => {
    try {
      setIsLoading(true);
      
      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select(`
          id,
          asin,
          title,
          brand,
          price,
          currency,
          availability,
          specifications,
          dimensions,
          best_sellers_rank,
          variations,
          frequently_bought_together,
          customer_questions,
          images,
          categories,
          features,
          description,
          rating_data,
          review_summary,
          status,
          updated_at
        `)
        .eq('id', productId)
        .single();

      if (productError) throw productError;
      if (!productData) throw new Error('Product not found');
      
      // Fetch reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .order('review_date', { ascending: false });

      if (reviewsError) throw reviewsError;
      
      const product = {
        ...productData,
        reviews: reviewsData || []
      };
      
      setProduct(product as ProductDetails);
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

              <ReviewStats
                productId={product.id}
              />

              <ReviewList
                reviews={product.reviews}
                violations={violations}
              />
            </div>
          </div>
        </Section>
      </Container>
    </div>
  );
}