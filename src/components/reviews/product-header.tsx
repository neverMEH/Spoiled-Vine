import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/feedback/loading-spinner';
import { ArrowLeft, Package, RefreshCw } from 'lucide-react';

interface ProductHeaderProps {
  brand: string;
  asin: string;
  availability?: string;
  isRefreshing: boolean;
  onBack: () => void;
  onRefresh: () => void;
}

export function ProductHeader({
  brand,
  asin,
  availability,
  isRefreshing,
  onBack,
  onRefresh,
}: ProductHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Package className="h-4 w-4" />
          <span>{brand}</span>
          <span>•</span>
          <code className="font-mono">{asin}</code>
          <span>•</span>
          <Badge variant={availability?.toLowerCase().includes('in stock') ? 'success' : 'secondary'}>
            {availability || 'Unknown Status'}
          </Badge>
        </div>
      </div>
      <Button
        variant="outline"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="shrink-0"
      >
        {isRefreshing ? (
          <LoadingSpinner className="mr-2" size="sm" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
      </Button>
    </div>
  );
}