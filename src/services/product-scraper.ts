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

        const { error } = await supabase.from('products').upsert({
          asin: product.asin,
          title: product.title,
          brand: product.brand,
          price: typeof product.price === 'object' ? product.price.value : product.price,
          currency: product.currency,
          rating: product.rating,
          review_count: product.reviewCount,
          images: product.images,
          categories: product.categories,
          features: product.features,
          description: product.description,
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