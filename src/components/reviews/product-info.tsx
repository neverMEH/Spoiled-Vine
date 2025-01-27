import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Package, Star, ChevronsUpDown, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ProductInfoProps {
  product: {
    title: string;
    brand: string;
    id: string;
    price: number;
    rating_data: {
      rating: number;
      reviewCount: number;
    };
    images?: string[];
    categories?: string[];
    features?: string[];
    specifications?: Record<string, string>;
    best_sellers_rank?: Array<{ category: string; rank: number }>;
    frequently_bought_together?: Array<{ title: string; price?: number }>;
    description?: string;
  };
}

function ViolationBadge({ productId }: { productId: string }) {
  const [violationCount, setViolationCount] = useState(0);

  useEffect(() => {
    const fetchViolations = async () => {
      const { data, error } = await supabase
        .from('review_violations')
        .select('*')
        .eq('product_id', productId)
        .eq('overridden', false);

      if (error) {
        console.error('Error fetching violations:', error);
        return;
      }

      setViolationCount(data.length);
    };

    fetchViolations();
  }, [productId]);

  if (violationCount === 0) return null;

  return (
    <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/50 rounded-lg border border-red-200 dark:border-red-800">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
        <Badge variant="destructive" className="text-sm">
          {violationCount} Active {violationCount === 1 ? 'Violation' : 'Violations'}
        </Badge>
      </div>
    </div>
  );
}

export function ProductInfo({ product }: ProductInfoProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-6">
          {/* Product Image */}
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.title}
              className="w-48 h-48 object-cover rounded-lg border"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-muted rounded-lg border">
              <Package className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
          
          {/* Title and Basic Info */}
          <div className="flex-1 space-y-4">
            <div>
              <CardTitle className="text-2xl">{product.title}</CardTitle>
              <p className="text-muted-foreground mt-2">by {product.brand}</p>
            </div>
            
            {/* Price and Rating */}
            <div className="flex items-center gap-8 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-md">
                <span className="text-2xl font-bold">
                  {formatCurrency(product.price)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-primary text-primary" />
                <span className="text-2xl font-bold">
                  {product.rating_data.rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  ({product.rating_data.reviewCount.toLocaleString()} reviews)
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Images */}
        {product.images?.length > 1 && (
          <div className="grid grid-cols-6 gap-2 pb-4">
            {product.images.slice(1).map((image, index) => (
              <img
                key={index}
                src={image}
                alt={`${product.title} - Image ${index + 1}`}
                className="aspect-square w-24 h-24 object-contain bg-white rounded-md border hover:border-primary transition-colors cursor-zoom-in"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ))}
          </div>
        )}

        {/* Categories */}
        {product.categories && product.categories.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {product.categories.map((category, index) => (
                <Badge key={index} variant="secondary">
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Features */}
        {product.features && product.features.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Key Features</h3>
            <ul className="grid gap-3 pl-6">
              {product.features.map((feature, index) => (
                <li key={index} className="list-disc marker:text-primary">
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Violations Badge */}
        <ViolationBadge productId={product.id} />

        {/* Specifications */}
        {Object.keys(product.specifications || {}).length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                <h3 className="text-lg font-semibold">Specifications</h3>
                <Button variant="ghost" size="sm" className="w-9 p-0 hover:bg-background/50">
                  <ChevronsUpDown className="h-4 w-4" />
                  <span className="sr-only">Toggle specifications</span>
                </Button>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-lg p-4">
                {Object.entries(product.specifications || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Best Sellers Rank */}
        {product.best_sellers_rank && product.best_sellers_rank.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Best Sellers Rank</h3>
            <div className="space-y-1">
              {product.best_sellers_rank.map((rank, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">#{rank.rank}</Badge>
                  <span>{rank.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Description</h3>
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap">{product.description}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}