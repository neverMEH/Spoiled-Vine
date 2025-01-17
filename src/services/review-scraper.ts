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
      if (!taskId) {
        throw new Error('Invalid task ID');
      }

      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Get the product first
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, rating_data, review_summary, reviews')
        .eq('asin', task.asin)
        .single();

      if (productError || !product) {
        throw new Error(`Product not found for ASIN ${task.asin}`);
      }

      const rawReviews = await apifyReviewScraper.getResults(taskId);
      if (!Array.isArray(rawReviews)) {
        throw new Error('Invalid review data format from Apify: not an array');
      }

      console.log(`Processing ${rawReviews.length} reviews for ASIN ${task.asin}`);

      // Count verified reviews
      const verifiedReviews = rawReviews.filter(r => r.isVerified).length;

      // Keep existing rating data
      const rating_data = product.rating_data || {
        rating: 0,
        reviewCount: 0,
        starsBreakdown: {
          '5star': 0,
          '4star': 0,
          '3star': 0,
          '2star': 0,
          '1star': 0
        },
        lastUpdated: null
      };
      // Transform and save reviews
      const reviews = rawReviews.map(review => {
        // Parse helpful votes from review reaction
        let helpfulVotes = 0;
        if (review.reviewReaction) {
          const match = review.reviewReaction.match(/(\d+)/);
          if (match) {
            helpfulVotes = parseInt(match[1]);
          }
        }

        // Parse country from reviewedIn
        let country = 'Unknown';
        if (review.reviewedIn) {
          const match = review.reviewedIn.match(/in ([^on]+)/);
          if (match) {
            country = match[1].trim();
          }
        }

        return {
          review_id: review.reviewId,
          title: review.reviewTitle,
          content: review.reviewDescription,
          rating: review.ratingScore,
          review_date: new Date(review.date).toISOString(),
          verified_purchase: review.isVerified,
          author: review.userId,
          author_id: review.userId,
          author_profile: review.userProfileLink,
          helpful_votes: helpfulVotes,
          images: review.reviewImages || [],
          variant: review.variant || null,
          variant_attributes: review.variantAttributes ? review.variantAttributes : null,
          country: country
        };
      });

      // Update product with reviews and summary
      const { error: updateError } = await supabase
        .from('products')
        .update({
          reviews: reviews,
          review_summary: {
            verifiedPurchases: verifiedReviews,
            lastUpdated: new Date().toISOString()
          },
          rating_data: rating_data,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (updateError) {
        console.error('Error updating product with reviews:', updateError);
        throw updateError;
      }

      console.log(`Successfully stored ${reviews.length} reviews for ASIN ${task.asin}`);

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