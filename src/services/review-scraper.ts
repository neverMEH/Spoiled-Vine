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

      // Get the product first
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, review_summary')
        .eq('asin', task.asin)
        .single();

      if (productError || !product) {
        throw new Error(`Product not found for ASIN ${task.asin}`);
      }

      const rawReviews = await apifyReviewScraper.getResults(taskId);
      if (!Array.isArray(rawReviews)) {
        throw new Error('Invalid review data format from Apify');
      }

      // Calculate review statistics
      const totalReviews = rawReviews.length;
      const verifiedReviews = rawReviews.filter(r => r.isVerified).length;
      const ratingCounts = rawReviews.reduce((acc, review) => {
        const rating = review.ratingScore;
        acc[`${rating}star`] = (acc[`${rating}star`] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const starsBreakdown = {
        '5star': (ratingCounts['5star'] || 0) / totalReviews,
        '4star': (ratingCounts['4star'] || 0) / totalReviews,
        '3star': (ratingCounts['3star'] || 0) / totalReviews,
        '2star': (ratingCounts['2star'] || 0) / totalReviews,
        '1star': (ratingCounts['1star'] || 0) / totalReviews
      };

      const averageRating = rawReviews.reduce((sum, review) => sum + review.ratingScore, 0) / totalReviews;

      // Update product review summary
      const { error: updateError } = await supabase
        .from('products')
        .update({
          review_summary: {
            ...product.review_summary,
            rating: averageRating,
            reviewCount: totalReviews,
            starsBreakdown,
            verifiedPurchases: verifiedReviews,
            lastUpdated: new Date().toISOString()
          }
        })
        .eq('id', product.id);

      if (updateError) {
        throw updateError;
      }

      // Transform and save reviews
      const reviews = rawReviews.map(review => ({
        review_id: review.reviewId,
        product_id: product.id,
        title: review.reviewTitle,
        content: review.reviewDescription,
        rating: review.ratingScore,
        review_date: new Date(review.date),
        verified_purchase: review.isVerified,
        author: review.userId,
        author_id: review.userId,
        author_profile: review.userProfileLink,
        helpful_votes: parseInt(review.reviewReaction?.split(' ')[0]) || 0,
        images: review.reviewImages || [],
        variant: review.variant || null,
        variant_attributes: review.variantAttributes ? review.variantAttributes : null,
        country: review.reviewedIn?.split(' in ')[1]?.replace(' on', '') || 'Unknown'
      }));

      // Upsert reviews to database
      const { error: reviewsError } = await supabase
        .from('reviews')
        .upsert(
          reviews,
          {
            onConflict: 'product_id,review_id',
            ignoreDuplicates: false
          }
        );

      if (reviewsError) {
        throw reviewsError;
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