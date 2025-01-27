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
  private readonly actorId = 'R8WeJwLuzLZ6g4Bkk';

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
      deduplicateRedirectedAsins: true,
      filterByRatings: [
        "oneStar",
        "twoStar",
        "threeStar",
        "critical"
      ],
      includeGdprSensitive: false,
      maxReviews: 200,
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
      reviewsAlwaysSaveCategoryData: false,
      reviewsEnqueueProductVariants: false,
      reviewsUseProductVariantFilter: false,
      scrapeProductDetails: false,
      scrapeQuickProductReviews: true,
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
      // Get results from Apify
      const result = await this.request<ApifyReview[]>(
        `/actor-runs/${taskId}/dataset/items`
      );

      // Validate and format reviews
      const reviews = Array.isArray(result) ? result : [];

      // Send reviews directly to n8n
      if (reviews && reviews.length > 0) {
        try {
          // Format reviews for n8n
          const formattedReviews = reviews.map(review => ({
            reviewId: review.reviewId,
            title: review.reviewTitle,
            content: review.reviewDescription,
            rating: review.ratingScore,
            date: review.date,
            verified: review.isVerified,
            author: review.userId,
            authorProfile: review.userProfileLink,
            helpfulVotes: review.reviewReaction ? parseInt(review.reviewReaction.match(/\d+/)?.[0] || '0') : 0,
            variant: review.variant,
            variantAttributes: review.variantAttributes,
            images: review.reviewImages || [],
            asin: review.productAsin
          }));

          const response = await fetch(config.services.n8n.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ reviews: formattedReviews })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`N8N request failed with status ${response.status}: ${errorText}`);
          }

          const responseData = await response.json();
          console.log('N8N response:', responseData);

        } catch (error) {
          console.error('Failed to send reviews to n8n:', error);
          // Don't throw here - we still want to return the reviews even if n8n fails
          console.warn('Continuing despite n8n error');
        }
      }

      return reviews;
    } catch (error) {
      console.error('Failed to get review results:', error);
      throw new Error(`Failed to get review results: ${error.message}`);
    }
  }
}

export const apifyReviewScraper = new ApifyReviewScraper();