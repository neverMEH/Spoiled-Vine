import { supabase } from '@/lib/supabase';
import { productScraperService } from './product-scraper';
import { reviewScraperService } from './review-scraper';

interface QueueItem {
  id: string;
  asin: string;
  priority: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  progress: number;
  attempts: number;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export class QueueManager {
  private static instance: QueueManager;
  private queue: Map<string, QueueItem> = new Map();
  private processing: Set<string> = new Set();
  private maxConcurrent: number = 3;
  private maxRetries: number = 3;
  private subscribers: Set<(items: QueueItem[]) => void> = new Set();

  private constructor() {
    // Start processing loop
    this.processQueue();
  }

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  // Subscribe to queue updates
  subscribe(callback: (items: QueueItem[]) => void) {
    this.subscribers.add(callback);
    // Initial callback with current state
    callback(this.getQueueItems());
    return () => this.subscribers.delete(callback);
  }

  // Notify all subscribers of queue updates
  private notifySubscribers() {
    const items = this.getQueueItems();
    this.subscribers.forEach(callback => callback(items));
  }

  // Add items to queue
  async addToQueue(asins: string[], priority: number = 0): Promise<void> {
    for (const asin of asins) {
      // Add to product queue
      const productId = `product_${crypto.randomUUID()}`;
      const item: QueueItem = {
        id: productId,
        asin,
        priority,
        status: 'queued',
        progress: 0,
        attempts: 0,
        queuedAt: new Date(),
      };
      this.queue.set(productId, item);

      // Add to review queue
      const reviewId = `review_${crypto.randomUUID()}`;
      const reviewItem: QueueItem = {
        id: reviewId,
        asin,
        priority,
        status: 'queued',
        progress: 0,
        attempts: 0,
        queuedAt: new Date(),
      };
      this.queue.set(reviewId, reviewItem);

      // Update product status in database
      await supabase
        .from('products')
        .update({ status: 'queued' })
        .eq('asin', asin);
    }
    this.notifySubscribers();
  }

  // Get all queue items sorted by priority and queue time
  getQueueItems(): QueueItem[] {
    return Array.from(this.queue.values())
      .sort((a, b) => {
        // Sort by priority first (higher priority first)
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Then by queue time (older first)
        return a.queuedAt.getTime() - b.queuedAt.getTime();
      });
  }

  // Get queue status
  getQueueStatus() {
    const items = this.getQueueItems();
    return {
      total: items.length,
      queued: items.filter(i => i.status === 'queued').length,
      processing: items.filter(i => i.status === 'processing').length,
      completed: items.filter(i => i.status === 'completed').length,
      failed: items.filter(i => i.status === 'failed').length,
    };
  }

  // Process queue
  private async processQueue() {
    while (true) {
      // Check if we can process more items
      if (this.processing.size < this.maxConcurrent) {
        const items = this.getQueueItems();
        const nextItem = items.find(i => 
          i.status === 'queued' && 
          !this.processing.has(i.id) &&
          i.attempts < this.maxRetries
        );

        if (nextItem) {
          await this.processItem(nextItem);
        }
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Process a single item
  private async processItem(item: QueueItem) {
    this.processing.add(item.id);
    item.status = 'processing';
    item.startedAt = new Date();
    item.attempts++;
    this.notifySubscribers();

    try {
      // Update status
      await supabase
        .from('products')
        .update({ status: 'refreshing' })
        .eq('asin', item.asin);

      // Start scraping based on queue item type
      if (item.id.startsWith('review_')) {
        await reviewScraperService.startScraping(item.asin);
        console.log(`Started review scraping for ASIN: ${item.asin}`);
      } else {
        await productScraperService.startScraping([item.asin]);
        console.log(`Started product scraping for ASIN: ${item.asin}`);
      }

      // Poll for completion
      while (item.status === 'processing') {
        const { data } = await supabase
          .from('products')
          .select('status')
          .eq('asin', item.asin)
          .single();

        if (data?.status === 'active') {
          item.status = 'completed';
          item.progress = 100;
          item.completedAt = new Date();
          break;
        }

        // Update progress (estimate based on time)
        const elapsed = Date.now() - item.startedAt!.getTime();
        const estimatedDuration = 30000; // 30 seconds
        item.progress = Math.min(95, (elapsed / estimatedDuration) * 100);

        this.notifySubscribers();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      item.status = 'failed';
      item.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset product status
      await supabase
        .from('products')
        .update({ status: 'active' })
        .eq('asin', item.asin);
    } finally {
      this.processing.delete(item.id);
      this.notifySubscribers();

      // Remove completed items after a delay
      if (item.status === 'completed') {
        setTimeout(() => {
          this.queue.delete(item.id);
          this.notifySubscribers();
        }, 5000);
      }
    }
  }

  // Clear completed items
  clearCompleted() {
    for (const [id, item] of this.queue.entries()) {
      if (item.status === 'completed') {
        this.queue.delete(id);
      }
    }
    this.notifySubscribers();
  }

  // Clear failed items
  clearFailed() {
    for (const [id, item] of this.queue.entries()) {
      if (item.status === 'failed') {
        this.queue.delete(id);
      }
    }
    this.notifySubscribers();
  }

  // Retry failed items
  retryFailed() {
    for (const item of this.queue.values()) {
      if (item.status === 'failed' && item.attempts < this.maxRetries) {
        item.status = 'queued';
        item.error = undefined;
      }
    }
    this.notifySubscribers();
  }
}

export const queueManager = QueueManager.getInstance();