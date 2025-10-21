export type CrustDataCompany = {
  id: string;
  name: string;
  domain: string;
  description?: string;
  industry?: string;
  sector?: string;
  employee_count?: number;
  revenue?: number;
  founded_year?: number;
  headquarters?: {
    city?: string;
    state?: string;
    country?: string;
    address?: string;
  };
  social_media?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  technologies?: string[];
  funding?: {
    total_funding?: number;
    last_funding_date?: string;
    last_funding_round?: string;
    investors?: string[];
  };
  metrics?: {
    alexa_rank?: number;
    monthly_visitors?: number;
    bounce_rate?: number;
    page_views_per_visit?: number;
    time_on_site?: number;
  };
  contact_info?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  last_updated?: string;
};

export type CrustDataCompanyResponse = {
  data: CrustDataCompany;
  success: boolean;
  message?: string;
};

export type CrustDataSearchParams = {
  company_domain?: string;
  company_name?: string;
  industry?: string;
  sector?: string;
  employee_count_min?: number;
  employee_count_max?: number;
  revenue_min?: number;
  revenue_max?: number;
  founded_year_min?: number;
  founded_year_max?: number;
  headquarters_country?: string;
  headquarters_state?: string;
  headquarters_city?: string;
  technologies?: string[];
  funding_min?: number;
  funding_max?: number;
  page?: number;
  limit?: number;
};

export type CrustDataSearchResponse = {
  data: CrustDataCompany[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  success: boolean;
  message?: string;
};

export type CrustDataClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
};

export type CrustDataEnrichmentResult = {
  company: CrustDataCompany | null;
  success: boolean;
  error?: string;
  source: 'crustdata';
  timestamp: string;
};
