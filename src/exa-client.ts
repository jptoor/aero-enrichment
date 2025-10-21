import Exa from 'exa-js';

export type ExaSearchOptions = {
  type?: 'keyword' | 'neural' | 'auto';
  numResults?: number;
  livecrawl?: 'always' | 'fallback' | 'never';
  text?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  excludeSourceType?: string[];
};

export type ExaSearchResult = {
  url: string;
  title: string;
  text?: string;
  publishedDate?: string;
  score?: number;
};

export type ExaSearchResponse = {
  results: ExaSearchResult[];
  autopromptString?: string;
};

export type ExaClientOptions = {
  apiKey?: string;
};

export class ExaClient {
  private client: Exa;

  constructor(options: ExaClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.EXA_API_KEY;
    if (!apiKey) {
      throw new Error('Missing Exa API key. Set EXA_API_KEY environment variable.');
    }
    this.client = new Exa(apiKey);
  }

  /**
   * Search for content using Exa
   */
  async search(
    query: string,
    options: ExaSearchOptions = {}
  ): Promise<ExaSearchResponse> {
    try {
      const result = await this.client.search(query, {
        type: options.type || 'keyword',
        numResults: options.numResults || 10,
        livecrawl: options.livecrawl || 'fallback',
        text: options.text || true,
        includeDomains: options.includeDomains,
        excludeDomains: options.excludeDomains,
        startPublishedDate: options.startPublishedDate,
        endPublishedDate: options.endPublishedDate,
        excludeSourceType: options.excludeSourceType,
      });

      return {
        results: result.results || [],
        autopromptString: result.autopromptString,
      };
    } catch (error) {
      throw new Error(`Exa search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search and get content in one call
   */
  async searchAndContents(
    query: string,
    options: ExaSearchOptions = {}
  ): Promise<ExaSearchResponse> {
    try {
      const result = await this.client.searchAndContents(query, {
        type: options.type || 'keyword',
        numResults: options.numResults || 10,
        livecrawl: options.livecrawl || 'fallback',
        text: options.text || true,
        includeDomains: options.includeDomains,
        excludeDomains: options.excludeDomains,
        startPublishedDate: options.startPublishedDate,
        endPublishedDate: options.endPublishedDate,
        excludeSourceType: options.excludeSourceType,
      });

      return {
        results: result.results || [],
        autopromptString: result.autopromptString,
      };
    } catch (error) {
      throw new Error(`Exa searchAndContents failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for financial documents (10-K, 10-Q, etc.)
   */
  async searchFinancialDocuments(
    companyName: string,
    ticker: string,
    options: {
      numResults?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<ExaSearchResponse> {
    const queries = [
      `"${companyName}" 10-K filetype:htm site:sec.gov/Archives/edgar`,
      `"${ticker}" form 10-K filetype:htm site:sec.gov/Archives/edgar`,
      `"${companyName}" annual report 10-K filing site:sec.gov/Archives/edgar`,
      `"${ticker}" 10-K management discussion analysis site:sec.gov/Archives/edgar`,
      `"${companyName}" business description 10-K site:sec.gov/Archives/edgar`
    ];

    const allResults: ExaSearchResult[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries) {
      try {
        const result = await this.searchAndContents(query, {
          type: 'keyword',
          livecrawl: 'always',
          text: true,
          numResults: options.numResults || 8,
          includeDomains: ['sec.gov'],
          startPublishedDate: options.startDate || '2023-01-01T00:00:00.000Z',
          endPublishedDate: options.endDate || new Date().toISOString(),
          excludeSourceType: ['application/xbrl+xml'],
        });

        // Filter and deduplicate results
        for (const searchResult of result.results) {
          if (!seenUrls.has(searchResult.url)) {
            // Validate that results are for the correct company
            const content = (searchResult.text || '').toLowerCase();
            const title = (searchResult.title || '').toLowerCase();
            const companyLower = companyName.toLowerCase();
            const tickerLower = ticker.toLowerCase();
            
            if (content.includes(companyLower) || 
                content.includes(tickerLower) || 
                title.includes(companyLower) ||
                title.includes(tickerLower)) {
              allResults.push(searchResult);
              seenUrls.add(searchResult.url);
            }
          }
        }

        // Add delay between queries to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.warn(`Query failed: ${query} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }

    return {
      results: allResults,
    };
  }

  /**
   * Search for company news and recent information
   */
  async searchCompanyNews(
    companyName: string,
    options: {
      numResults?: number;
      daysBack?: number;
    } = {}
  ): Promise<ExaSearchResponse> {
    const daysBack = options.daysBack || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    return this.searchAndContents(`${companyName} news`, {
      type: 'keyword',
      livecrawl: 'always',
      text: true,
      numResults: options.numResults || 10,
      startPublishedDate: startDate.toISOString(),
      endPublishedDate: new Date().toISOString(),
      excludeDomains: ['sec.gov'], // Exclude SEC filings for news search
    });
  }

  /**
   * Search for company technology stack information
   */
  async searchTechnologyStack(
    companyName: string,
    options: {
      numResults?: number;
    } = {}
  ): Promise<ExaSearchResponse> {
    const queries = [
      `${companyName} technology stack`,
      `${companyName} software tools`,
      `${companyName} tech stack`,
      `${companyName} programming languages`,
      `${companyName} development tools`,
    ];

    const allResults: ExaSearchResult[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries) {
      try {
        const result = await this.searchAndContents(query, {
          type: 'keyword',
          livecrawl: 'fallback',
          text: true,
          numResults: options.numResults || 5,
        });

        for (const searchResult of result.results) {
          if (!seenUrls.has(searchResult.url)) {
            allResults.push(searchResult);
            seenUrls.add(searchResult.url);
          }
        }

        // Add delay between queries
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn(`Technology search failed: ${query} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }

    return {
      results: allResults,
    };
  }
}
