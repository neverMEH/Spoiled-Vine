import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Section } from '@/components/layout/section';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { columns, Product } from '@/components/data-table/columns';
import { ArrowLeft, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/feedback/loading-spinner';

type ProductRow = Product & { id: string };

export function ListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formattedProducts: ProductRow[] = data.map(product => {
        return {
          id: product.id,
          brand: product.brand || 'Unknown',
          asin: product.asin,
          title: product.title,
          price: product.price || 0,
          rating: product.rating_data?.rating || 0,
          reviewCount: product.rating_data?.reviewCount || 0,
          lastUpdated: product.updated_at,
          status: product.status || 'active'
        };
      });

      setProducts(formattedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Container>
        <Section>
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Products</h1>
                <p className="text-muted-foreground">
                  Manage and monitor your tracked products
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
                <Button
                  onClick={() => navigate('/reviews/gather')}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Products
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <DataTable 
                columns={columns} 
                data={products} 
                onRefresh={fetchProducts}
              />
            )}
          </div>
        </Section>
      </Container>
    </div>
  );
}