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

      // Get product first
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, rating_data, review_summary, reviews')
        .eq('asin', task.asin)
        .single();

      if (productError || !product) {
        throw new Error(`Product not found for ASIN ${task.asin}`);
      }
      
      const rawReviews = await apifyReviewScraper.getResults(taskId);
      if (!rawReviews || !Array.isArray(rawReviews)) {
        throw new Error('Invalid review data format from Apify: not an array');
      }

      console.log(`Processing ${rawReviews.length} reviews for ASIN ${task.asin}`);
      
      // Insert reviews into reviews table
      for (const review of rawReviews) {
        try {
          if (!review.reviewId) {
            console.warn('Skipping review without ID:', review);
            continue;
          }

          const { error: insertError } = await supabase
            .from('reviews')
            .upsert({
              product_id: product.id,
              review_id: review.reviewId,
              title: review.reviewTitle,
              content: review.reviewDescription,
              rating: review.ratingScore,
              review_date: new Date(review.date).toISOString(),
              verified_purchase: review.isVerified,
              author: review.userId,
              author_id: review.userId,
              author_profile: review.userProfileLink,
              helpful_votes: review.reviewReaction ? parseInt(review.reviewReaction.match(/\d+/)?.[0] || '0') : 0,
              variant: review.variant || null,
              variant_attributes: review.variantAttributes ? review.variantAttributes : null,
              images: review.reviewImages || [],
              country: review.reviewedIn?.replace('Reviewed in ', '') || 'Unknown'
            }, {
              onConflict: 'review_id',
              ignoreDuplicates: false
            });

          if (insertError) {
            console.error(`Error inserting review ${review.reviewId}:`, insertError);
          }
        } catch (error) {
          console.error(`Error processing review ${review.reviewId}:`, error);
        }
      }

      // Update product status
      const { error: statusError } = await supabase
        .from('products')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (statusError) {
        console.error('Error updating product status:', statusError);
      }

      console.log(`Successfully processed ${rawReviews.length} reviews for ASIN ${task.asin}`);

      // Mark task as completed immediately after storing reviews
      // Mark task as completed
      task.completedAt = new Date().toISOString();
      task.status = 'completed';
      this.tasks.set(taskId, task);
      
      // Send to n8n for violation detection asynchronously
      if (config.services.n8n.webhookUrl) {
        fetch(config.services.n8n.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ 
            reviews: transformedReviews,
            productId: product.id,
            asin: task.asin
          })
        }).catch(error => {
          console.error('Error sending reviews to n8n:', error);
          // Non-blocking error - violation detection can fail without affecting review display
        });
      }

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