import { supabase } from '@/lib/supabase';
import { apifyReviewService } from '@/lib/apify-reviews';

interface ReviewScrapingTask {
  id: string;
  asin: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export class ReviewScraperService {
  private tasks: Map<string, ReviewScrapingTask> = new Map();

  async startScraping(asin: string): Promise<string> {
    try {
      // Start Apify task
      const taskId = await apifyReviewService.startScraping(asin);

      // Store task information
      const task: ReviewScrapingTask = {
        id: taskId,
        asin,
        status: 'pending',
        progress: 0,
        startedAt: new Date().toISOString(),
      };

      this.tasks.set(taskId, task);

      // Start monitoring task progress
      this.monitorTask(taskId);

      return taskId;
    } catch (error) {
      console.error('Failed to start review scraping:', error);
      throw error;
    }
  }

  async getTaskStatus(taskId: string): Promise<ReviewScrapingTask | null> {
    return this.tasks.get(taskId) || null;
  }

  private async monitorTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      const status = await apifyReviewService.getTaskStatus(taskId);

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
      const results = await apifyReviewService.getResults(taskId);
      if (!Array.isArray(results) || results.length === 0) {
        throw new Error('No review data received from Apify');
      }

      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Get the product's current reviews
      const { data: currentProduct, error: fetchError } = await supabase
        .from('products')
        .select('reviews, review_summary')
        .eq('asin', task.asin)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Extract reviews from the product data
      const productReviews = results[0]?.reviews || [];
      const reviewSummary = {
        rating: results[0]?.rating || 0,
        reviewCount: results[0]?.reviewsCount || 0,
        starsBreakdown: results[0]?.starsBreakdown || {
          '5star': 0,
          '4star': 0,
          '3star': 0,
          '2star': 0,
          '1star': 0
        },
        verifiedPurchases: productReviews.filter(r => r.verified).length,
        lastUpdated: new Date().toISOString()
      };

      // Update the product's reviews in the database
      const { error: updateError } = await supabase
        .from('products')
        .update({
          reviews: productReviews,
          review_summary: reviewSummary,
          review_data: {
            lastScraped: new Date().toISOString(),
            scrapedReviews: productReviews.length,
            scrapeStatus: 'completed'
          }
        })
        .eq('asin', task.asin);

      if (updateError) {
        throw updateError;
      }

      // Update task status
      if (task) {
        task.completedAt = new Date().toISOString();
        this.tasks.set(taskId, task);
      }
      
      return results;
    } catch (error) {
      console.error('Error processing results:', error);
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : 'Unknown error';
        this.tasks.set(taskId, task);

        // Update the product's review status to failed
        try {
          await supabase
            .from('products')
            .update({
              review_data: {
                lastScraped: new Date().toISOString(),
                scrapeStatus: 'failed',
                error: task.error
              }
            })
            .eq('asin', task.asin);
        } catch (dbError) {
          console.error('Failed to update review status in database:', dbError);
        }
      }
      throw error;
    }
  }
}

export const reviewScraperService = new ReviewScraperService();