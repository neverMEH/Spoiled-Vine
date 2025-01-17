import { apifyReviewScraper } from '@/lib/apify-review-scraper';
import { supabase } from '@/lib/supabase';

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
      const taskId = await apifyReviewScraper.startScraping(asin);

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
      const status = await apifyReviewScraper.getTaskStatus(taskId);

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
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const rawReviews = await apifyReviewScraper.getResults(taskId);
      if (!Array.isArray(rawReviews)) {
        throw new Error('Invalid review data format from Apify');
      }

      // Transform reviews to our format
      const reviews = rawReviews.map(review => ({
        id: review.reviewId,
        title: review.reviewTitle,
        text: review.reviewDescription,
        rating: review.ratingScore,
        date: review.date,
        verified: review.isVerified,
        author: review.userId,
        author_id: review.userId,
        author_profile: review.userProfileLink,
        helpful_votes: parseInt(review.reviewReaction?.split(' ')[0]) || 0,
        images: review.reviewImages || [],
        variant: review.variant || null,
        variant_attributes: review.variantAttributes || [],
        country: review.reviewedIn?.split(' in ')[1]?.replace(' on', '') || 'Unknown'
      }));

      // Calculate review summary
      const reviewSummary = {
        rating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0,
        reviewCount: reviews.length,
        starsBreakdown: reviews.reduce((acc, r) => {
          const key = `${r.rating}star` as keyof typeof acc;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {
          '5star': 0,
          '4star': 0,
          '3star': 0,
          '2star': 0,
          '1star': 0
        }),
        verifiedPurchases: reviews.filter(r => r.verified).length,
        lastUpdated: new Date().toISOString()
      };

      // Update the product with new reviews and summary
      const { error: updateError } = await supabase
        .from('products')
        .update({
          reviews: reviews,
          review_summary: reviewSummary,
          review_data: {
            lastScraped: new Date().toISOString(),
            scrapedReviews: reviews.length,
            scrapeStatus: 'completed'
          },
          updated_at: new Date().toISOString()
        })
        .eq('asin', task.asin);

      if (updateError) {
        throw updateError;
      }

      // Mark task as completed
      task.completedAt = new Date().toISOString();
      task.status = 'completed';
      this.tasks.set(taskId, task);

    } catch (error) {
      console.error('Error processing review results:', error);
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

export const reviewScraperService = new ReviewScraperService();