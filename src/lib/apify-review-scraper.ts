import { config } from './config';

interface ApifyTask {
  id: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  startedAt?: string;
  finishedAt?: string;
  progress?: {
    percent: number;
  };
}

interface ApifyReview {
  reviewedIn: string;
  userId: string;
  userProfileLink: string;
  ratingScore: number;
  reviewTitle: string;
  reviewId: string;
  reviewUrl: string;
  reviewReaction: string;
  reviewDescription: string;
  isVerified: boolean;
  isAmazonVine: boolean;
  reviewImages: string[];
  date: string;
  position: number;
  variant: string;
  variantAttributes: Array<{
    key: string;
    value: string;
  }>;
  totalCategoryRatings: number | null;
  totalCategoryReviews: number | null;
  reviewCategoryUrl: string;
  filterByRating: string;
  filterByKeyword: string | null;
  productAsin: string;
  productOriginalAsin: string;
  variantAsin: string;
  product: {
    price: number | null;
    listPrice: number | null;
  };
}

class ApifyReviewScraper {
  private readonly baseUrl = 'https://api.apify.com/v2';
  private readonly token: string;
  private readonly actorId = 'junglee~amazon-reviews-scraper';

  constructor() {
    const token = config.services.apify.token;
    if (!token) {
      throw new Error('Apify API token is not configured');
    }
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.token;

    if (!token || token === 'your-apify-token') {
      throw new Error('Invalid Apify API token');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Apify API request failed:', error);
      throw error instanceof Error ? error : new Error('Failed to make Apify request');
    }
  }

  async startScraping(asin: string): Promise<string> {
    const input = {
      filterByRatings: ["allStars"],
      includeGdprSensitive: false,
      maxReviews: 500,
      productUrls: [
        {
          url: `https://www.amazon.com/dp/${asin}`,
          method: "GET"
        }
      ],
      proxyCountry: "AUTO_SELECT_PROXY_COUNTRY",
      reviewsAlwaysSaveCategoryData: false,
      reviewsEnqueueProductVariants: false,
      reviewsUseProductVariantFilter: true,
      scrapeProductDetails: false,
      scrapeQuickProductReviews: true,
      sort: "recent"
    };

    try {
      // Use the direct run-sync endpoint
      const result = await this.request<ApifyReview[]>(
        `/acts/${this.actorId}/run-sync-get-dataset-items`,
        { method: 'POST', body: JSON.stringify(input) }
      );

      // Store the results directly since this is a synchronous call
      this.results.set(asin, result);
      return asin; // Use ASIN as task ID since we're not using async runs

    } catch (error) {
      console.error('Failed to start review scraping:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to start review scraping: ${error.message}`);
      }
      throw new Error('Failed to start review scraping');
    }
  }

  private results: Map<string, ApifyReview[]> = new Map();

  async getTaskStatus(taskId: string): Promise<{
    status: string;
    progress: number;
    error?: string;
  }> {
    // Since we're using sync API, task is always complete
    return {
      status: 'SUCCEEDED',
      progress: 100
    };
  }

  async getResults(taskId: string): Promise<ApifyReview[]> {
    // Return stored results from sync call
    const results = this.results.get(taskId);
    if (!results) {
      throw new Error('No results found for task');
    }
    return results;
  }
}

export const apifyReviewScraper = new ApifyReviewScraper();