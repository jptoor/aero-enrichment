# Aero Enrichment

A comprehensive aerospace company data enrichment platform combining CrustData, Exa search, SEC Edgar, AI analysis, and web scraping for defense and aerospace intelligence.

## Features

- **Aerospace Focus**: Specialized for defense contractors, aerospace companies, and related industries
- **CrustData Integration**: Company firmographic data, funding information, technology stacks
- **Exa Search**: Web content discovery, financial documents, news, technology analysis
- **SEC Edgar**: Public company identification, 10-K filings, financial data
- **Ticker Discovery**: Multi-strategy ticker symbol discovery with confidence scoring
- **SEC Signals Extraction**: AI-powered analysis of SEC filings for business intelligence
- **Firecrawl Scraping**: Advanced web scraping with content extraction and analysis
- **Enhanced Enrichment**: Combined data from all sources with intelligent processing
- **Defense Intelligence**: Specialized mappings for major aerospace and defense companies
- **TypeScript Support**: Full type definitions and IntelliSense support
- **Error Handling**: Robust error handling with graceful fallbacks
- **Rate Limiting**: Built-in rate limiting and retry logic
- **Concurrency Control**: Parallel processing with configurable concurrency limits

## Aerospace & Defense Focus

This platform is specifically designed for aerospace and defense industry intelligence:

- **Pre-configured Mappings**: Built-in ticker mappings for major aerospace companies (Boeing, Lockheed Martin, Northrop Grumman, etc.)
- **Defense Contract Analysis**: Specialized SEC signal extraction for government contracts and defense programs
- **Technology Stack Intelligence**: Focus on aerospace-relevant technologies (AI/ML, automation, cybersecurity, etc.)
- **Financial Health Scoring**: AI-powered analysis of defense contractor financial stability and growth potential
- **Supply Chain Intelligence**: Analysis of aerospace supply chain disruptions and opportunities

## Installation

```bash
npm install
```

## Environment Setup

Create a `.env` file with your API keys:

```bash
# Required
CRUSTDATA_API_KEY=your_crustdata_api_key_here

# Optional (for enhanced features)
EXA_API_KEY=your_exa_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
SEC_USER_AGENT=your-app-name (your-email@example.com)
```

## Quick Start

### Basic CrustData Usage

```typescript
import { CrustDataClient } from './src/crustdata-client';

const client = new CrustDataClient({ 
  apiKey: process.env.CRUSTDATA_API_KEY 
});

// Get company by domain
const company = await client.getCompany('stripe.com');

// Get company by name
const companyByName = await client.getCompanyByName('Stripe');

// Search companies by industry
const techCompanies = await client.getCompaniesByIndustry('Technology', 10);
```

### Enhanced Enrichment (Recommended)

```typescript
import { EnhancedEnrichmentService } from './src/enhanced-enrichment-service';

const service = new EnhancedEnrichmentService({
  crustDataApiKey: process.env.CRUSTDATA_API_KEY,
  exaApiKey: process.env.EXA_API_KEY,
});

// Full company enrichment with all data sources
const result = await service.enrichCompany('stripe.com', true, {
  includeSEC: true,
  includeExa: true,
  includeFinancialDocs: true,
  includeNews: true,
  includeTechStack: true,
});

if (result.success) {
  console.log('Company:', result.company.name);
  console.log('Industry:', result.company.industry);
  console.log('Public:', result.secData?.isPublic);
  console.log('Ticker:', result.secData?.ticker);
  console.log('News:', result.exaData?.news?.length);
}
```

### Individual Service Usage

```typescript
import { ExaClient } from './src/exa-client';
import { SECEdgarClient } from './src/sec-edgar-client';

// Exa search for financial documents
const exa = new ExaClient({ apiKey: process.env.EXA_API_KEY });
const financialDocs = await exa.searchFinancialDocuments('Apple Inc', 'AAPL');

// SEC company identification
const sec = new SECEdgarClient();
const match = await sec.identifyPublicCompany('Apple Inc', 'apple.com');
```

## API Reference

### CrustDataClient

Core client for CrustData API operations.

```typescript
const client = new CrustDataClient({ apiKey: 'your-key' });

// Company lookup
await client.getCompany(domain: string)
await client.getCompanyByName(name: string)
await client.enrichCompany(identifier: string, isDomain: boolean)

// Search operations
await client.searchCompanies(params: CrustDataSearchParams)
await client.getCompaniesByIndustry(industry: string, limit: number)
await client.getCompaniesByTechnology(technologies: string[], limit: number)
await client.getCompaniesByFunding(minFunding?: number, maxFunding?: number, limit: number)
await client.getCompaniesByEmployeeCount(minEmployees?: number, maxEmployees?: number, limit: number)
await client.getCompaniesByLocation(country?: string, state?: string, city?: string, limit: number)
```

### ExaClient

Web search and content discovery using Exa.

```typescript
const exa = new ExaClient({ apiKey: 'your-key' });

// General search
await exa.search(query: string, options: ExaSearchOptions)
await exa.searchAndContents(query: string, options: ExaSearchOptions)

// Specialized searches
await exa.searchFinancialDocuments(companyName: string, ticker: string, options)
await exa.searchCompanyNews(companyName: string, options)
await exa.searchTechnologyStack(companyName: string, options)
```

### SECEdgarClient

SEC Edgar API integration for public company data.

```typescript
const sec = new SECEdgarClient({ userAgent: 'your-app' });

// Company identification
await sec.identifyPublicCompany(companyName: string, website?: string)

// Filing operations
await sec.list10KFilings(cik: string, maxCount: number)
await sec.listAllFilings(cik: string, maxCount: number)
await sec.downloadFiling(cik: string, item: EdgarFiling)
await sec.downloadAllFilings(cik: string, maxCount: number)
```

### EnhancedEnrichmentService

Combined enrichment service using all data sources.

```typescript
const service = new EnhancedEnrichmentService({
  crustDataApiKey: 'your-key',
  exaApiKey: 'your-key',
});

// Single company enrichment
await service.enrichCompany(identifier: string, isDomain: boolean, options)

// Bulk enrichment
await service.enrichCompanies(identifiers: string[], isDomain: boolean, options)

// Discovery
await service.getCompaniesByIndustry(industry: string, limit: number, options)
await service.getCompaniesByTechnology(technologies: string[], limit: number, options)
```

## Data Sources

### CrustData
- Company basic information (name, domain, industry, sector)
- Employee count and revenue data
- Headquarters location
- Social media links
- Technology stack
- Funding information
- Website metrics

### Exa
- Financial documents (10-K, 10-Q filings)
- Recent news and press releases
- Technology stack analysis
- Web content discovery

### SEC Edgar
- Public company identification
- Ticker symbol resolution
- Filing metadata and content
- Financial document downloads

## Error Handling

All services include comprehensive error handling:

```typescript
const result = await service.enrichCompany('example.com');

if (result.success) {
  // Use result.company, result.secData, result.exaData
  console.log(result.company.name);
} else {
  // Handle error
  console.error('Enrichment failed:', result.error);
}
```

## Rate Limiting

The library includes built-in rate limiting and retry logic:

- CrustData: 30-second timeout with retry logic
- Exa: 2-second delays between queries
- SEC: 100ms delays between filing downloads

## Testing

Run the test suite:

```bash
npm run test
```

Run the comprehensive example:

```bash
npm run example
```

## Development

Build the library:

```bash
npm run build
```

## License

MIT

## Support

For issues and questions:
1. Check the error messages in the console
2. Verify your API keys are correctly set
3. Review the rate limiting and retry logic
4. Check the individual service documentation

## Credentials

- **CrustData API Key**: `2b09d78c3e1cc5be326344112fc5309f3e5caf2d`
- **Username**: `chirag@getaero.io`
- **Password**: `SJnN8ziF#6#gSiqe`
- **Documentation**: https://fulldocs.crustdata.com/
