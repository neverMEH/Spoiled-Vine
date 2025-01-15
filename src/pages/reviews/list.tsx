import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Section } from '@/components/layout/section';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { columns } from '@/components/data-table/columns';
import { ArrowLeft, Plus } from 'lucide-react';

// Sample data
const data = [
  {
    id: '1',
    brand: 'Amazon Basics',
    asin: 'B01NBKTPTS',
    title: 'Amazon Basics High-Back Executive Swivel Office Desk Chair',
    price: 159.99,
    rating: 4.5,
    reviewCount: 1234,
    lastUpdated: '2024-01-15T12:00:00Z',
    status: 'active',
  },
  {
    id: '2',
    brand: 'Samsung',
    asin: 'B08FYTSXGQ',
    title: 'SAMSUNG 34-Inch Odyssey G5 Ultra-Wide Gaming Monitor',
    price: 549.99,
    rating: 4.7,
    reviewCount: 2567,
    lastUpdated: '2024-01-14T15:30:00Z',
    status: 'active',
  },
  // Add more sample data as needed
];

export function ListPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

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

            <DataTable columns={columns} data={data} />
          </div>
        </Section>
      </Container>
    </div>
  );
}