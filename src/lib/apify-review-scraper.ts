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
      maxReviews: 500,
      productUrls: [
        {
          url: `https://www.amazon.com/dp/${asin}`,
          method: "GET"
        }
      ],
      proxyConfiguration: {
        useApifyProxy: true,
        countryCode: "US"
      },
      proxyCountry: "AUTO_SELECT_PROXY_COUNTRY",
      sort: "recent"
    };

    try {
      // Use the direct run-sync endpoint
      const result = await this.request<{ data: { id: string } }>(
        `/acts/${this.actorId}/runs`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );

      return result.data.id;

    } catch (error) {
      console.error('Failed to start review scraping:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to start review scraping: ${error.message}`);
      }
      throw new Error('Failed to start review scraping');
    }
  }

  async getTaskStatus(taskId: string): Promise<{
    status: string;
    progress: number;
    error?: string;
  }> {
    try {
      const result = await this.request<{ data: ApifyTask }>(
        `/acts/${this.actorId}/runs/${taskId}`
      );

      return {
        status: result.data.status,
        progress: result.data.progress?.percent || 0,
      };
    } catch (error) {
      console.error('Failed to get task status:', error);
      throw new Error('Failed to get task status');
    }
  }

  async getResults(taskId: string): Promise<ApifyReview[]> {
    try {
      const result = await this.request<ApifyReview[]>(
        `/actor-runs/${taskId}/dataset/items`
      );

      return result;
    } catch (error) {
      console.error('Failed to get review results:', error);
      throw new Error('Failed to get review results');
    }
  }
}

export const apifyReviewScraper = new ApifyReviewScraper();