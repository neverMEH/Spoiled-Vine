import { apifyService } from '@/lib/apify';
import { supabase } from '@/lib/supabase';

interface ScrapingTask {
  id: string;
  asins: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export class ProductScraperService {
  private tasks: Map<string, ScrapingTask> = new Map();

  async startScraping(asins: string[]): Promise<string> {
    try {
      // Start Apify task
      const taskId = await apifyService.startScraping(asins);

      // Store task information
      const task: ScrapingTask = {
        id: taskId,
        asins,
        status: 'pending',
        progress: 0,
        startedAt: new Date().toISOString(),
      };

      this.tasks.set(taskId, task);

      // Start monitoring task progress
      this.monitorTask(taskId);

      return taskId;
    } catch (error) {
      console.error('Failed to start scraping:', error);
      throw error;
    }
  }

  async getTaskStatus(taskId: string): Promise<ScrapingTask | null> {
    return this.tasks.get(taskId) || null;
  }

  private async monitorTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      const status = await apifyService.getTaskStatus(taskId);

      // Update task status
      task.status =
        status.status === 'SUCCEEDED'
          ? 'completed'
          : status.status === 'FAILED'
          ? 'failed'
          : 'processing';
      task.progress = status.progress;

      if (status.error) {
        task.error = status.error;
      }

      this.tasks.set(taskId, task);

      // If task is completed, process results
      if (task.status === 'completed') {
        await this.processResults(taskId);
      }
      // If task is still running, continue monitoring
      else if (task.status === 'processing') {
        setTimeout(() => this.monitorTask(taskId), 5000);
      }
    } catch (error) {
      console.error('Error monitoring task:', error);
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.tasks.set(taskId, task);
    }
  }

  private async processResults(taskId: string) {
    try {
      const results = await apifyService.getResults(taskId);
      if (!Array.isArray(results)) {
        throw new Error('Invalid results format from Apify');
      }

      // Store results in Supabase
      for (const product of results) {
        if (!product.asin) {
          console.warn('Skipping product without ASIN:', product);
          continue;
        }

        // Prepare review summary
        // Calculate average rating from stars breakdown
        let averageRating = 0;
        if (product.starsBreakdown) {
          averageRating = (
            (product.starsBreakdown['5star'] || 0) * 5 +
            (product.starsBreakdown['4star'] || 0) * 4 +
            (product.starsBreakdown['3star'] || 0) * 3 +
            (product.starsBreakdown['2star'] || 0) * 2 +
            (product.starsBreakdown['1star'] || 0) * 1
          );
        }

        const reviewSummary = {
          rating: averageRating,
          reviewCount: product.reviewsCount,
          starsBreakdown: product.starsBreakdown ? {
            '5star': product.starsBreakdown['5star'] || 0,
            '4star': product.starsBreakdown['4star'] || 0,
            '3star': product.starsBreakdown['3star'] || 0,
            '2star': product.starsBreakdown['2star'] || 0,
            '1star': product.starsBreakdown['1star'] || 0
          } : {
            '5star': 0,
            '4star': 0,
            '3star': 0,
            '2star': 0,
            '1star': 0
          },
          verifiedPurchases: product.reviews?.filter(r => r.verified).length || 0,
          lastUpdated: new Date().toISOString()
        };
        
        // Ensure thumbnailImage is the first image if available
        const images = product.thumbnailImage 
          ? [product.thumbnailImage, ...(product.images || []).filter(img => img !== product.thumbnailImage)]
          : product.images;

        const { error } = await supabase.from('products').upsert({
          asin: product.asin,
          title: product.title,
          brand: product.brand,
          price: typeof product.price === 'object' ? product.price.value : product.price,
          currency: product.currency,
          images: images,
          categories: product.categories,
          features: product.features,
          description: product.description,
          reviews: product.reviews || [],
          review_data: {
            totalReviews: product.reviewsCount || 0,
            scrapedReviews: product.reviews?.length || 0,
            lastScraped: new Date().toISOString()
          },
          review_summary: reviewSummary,
          status: 'active',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'asin',
          ignoreDuplicates: false
        });

        if (error) {
          console.error(`Error storing product ${product.asin}:`, error);
          throw error;
        }
      }

      // Update task status
      const task = this.tasks.get(taskId);
      if (task) {
        task.completedAt = new Date().toISOString();
        this.tasks.set(taskId, task);
      }
    } catch (error) {
      console.error('Error processing results:', error);
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : 'Unknown error';
        this.tasks.set(taskId, task);
      }
    }
  }
}

export const productScraperService = new ProductScraperService();