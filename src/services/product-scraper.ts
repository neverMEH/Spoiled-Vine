import { apifyService } from '@/lib/apify';
import { reviewScraperService } from './review-scraper';
import { supabase } from '@/lib/supabase';

interface ScrapingTask {
  id: string;
  asins: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refreshing';
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
    
    // Update product status to refreshing
    try {
      for (const asin of task.asins) {
        await supabase
          .from('products')
          .update({ status: 'refreshing' })
          .eq('asin', asin);
      }
    } catch (error) {
      console.error('Error updating product status:', error);
    }

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
        // Update product status back to active
        for (const asin of task.asins) {
          await supabase
            .from('products')
            .update({ status: 'active' })
            .eq('asin', asin);
        }
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

      if (!Array.isArray(results) || results.length === 0) {
        throw new Error('Invalid results format from Apify');
      }

      // Store results in Supabase
      for (const product of results) {
        try {
          if (!product?.asin) {
            console.warn('Skipping invalid product:', product);
            continue;
          }

          // Get existing product first
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id')
            .eq('asin', product.asin)
            .maybeSingle();

          // Store rating data from product scraper
          const rating_data = {
            rating: product.stars || 0,
            reviewCount: product.reviewsCount || 0,
            starsBreakdown: {
              '5star': product.starsBreakdown?.['5star'] || 0,
              '4star': product.starsBreakdown?.['4star'] || 0,
              '3star': product.starsBreakdown?.['3star'] || 0,
              '2star': product.starsBreakdown?.['2star'] || 0,
              '1star': product.starsBreakdown?.['1star'] || 0
            },
            lastUpdated: new Date().toISOString()
          };
          
          const productData = {
            asin: product.asin,
            title: product.title,
            brand: product.brand,
            price: typeof product.price === 'object' ? product.price.value : product.price,
            currency: product.currency,
            availability: product.availability,
            dimensions: product.dimensions,
            specifications: product.specifications,
            best_sellers_rank: product.bestSellersRank,
            variations: product.variations,
            frequently_bought_together: product.frequentlyBoughtTogether,
            customer_questions: product.customerQuestions,
            images: Array.isArray(product.images) 
              ? product.images
                .filter(url => url && typeof url === 'string' && url.startsWith('http'))
                .slice(0, 10)
              : [],
            categories: product.categories,
            features: product.features,
            description: product.description,
            rating_data: rating_data,
            status: 'active',
            updated_at: new Date().toISOString()
          };

          // Insert or update product with upsert
          const { error: updateError } = await supabase
            .from('products')
            .upsert(
              {
                ...productData,
                id: existingProduct?.id || undefined
              },
              {
                onConflict: 'asin',
                ignoreDuplicates: false
              }
            );

          if (updateError) {
            throw updateError;
          }
          
        } catch (error) {
          console.error(`Failed to process product ${product.asin}:`, error);
          throw error;
        }
      }

      // Mark task as completed
      const task = this.tasks.get(taskId);
      if (task) {
        task.completedAt = new Date().toISOString();
        task.status = 'completed';
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
      throw error;
    }
  }
}

export const productScraperService = new ProductScraperService();