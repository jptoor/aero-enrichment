import fs from 'fs';
import path from 'path';

export type TickerEntry = {
  cik_str: number;
  ticker: string;
  title: string;
};

export type PublicCompanyMatch = {
  isPublic: boolean;
  confidence: number;
  matchedTitle?: string;
  ticker?: string;
  cik?: string; // zero-padded 10 digits
  source?: 'overrides' | 'sec_directory';
};

export type TenKItem = {
  form: string; // 10-K or 10-K/A
  accessionNumber: string; // e.g., 0000320193-24-000093
  primaryDocument: string; // e.g., a10k20230930.htm
  reportDate?: string; // YYYY-MM-DD
  filingDate?: string; // YYYY-MM-DD
};

export type EdgarFiling = {
  form: string; // e.g., 10-K, 8-K, 10-Q, etc.
  accessionNumber: string;
  primaryDocument: string;
  reportDate?: string;
  filingDate?: string;
  description?: string;
  isExcluded: boolean; // true if it's a stock purchase/sale note
};

export type FilingDownloadResult = {
  rawPath: string;
  markdownPath: string;
  textPath: string;
};

export type SECClientOptions = {
  userAgent?: string;
  cacheRoot?: string;
  exaApiKey?: string;
};

export class SECEdgarClient {
  private userAgent: string;
  private cacheRoot: string;
  private overridesByDomain: Record<string, string> = {};
  private overridesByName: Record<string, string> = {};

  constructor(options: SECClientOptions = {}) {
    this.userAgent = options.userAgent || process.env.SEC_USER_AGENT || 'fire-enrich (contact: unknown@example.com)';
    this.cacheRoot = options.cacheRoot || path.join(process.cwd(), 'cache', 'sec');
    this.ensureDir(this.cacheRoot);
    this.loadOverrides();
  }

  private ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private loadOverrides() {
    // Optional JSON files: config/domain_ticker_overrides.json, config/name_ticker_overrides.json
    try {
      const domainPath = path.join(process.cwd(), 'config', 'domain_ticker_overrides.json');
      if (fs.existsSync(domainPath)) {
        const raw = fs.readFileSync(domainPath, 'utf-8');
        this.overridesByDomain = JSON.parse(raw);
      }
    } catch {}
    try {
      const namePath = path.join(process.cwd(), 'config', 'name_ticker_overrides.json');
      if (fs.existsSync(namePath)) {
        const raw = fs.readFileSync(namePath, 'utf-8');
        this.overridesByName = JSON.parse(raw);
      }
    } catch {}
  }

  private async fetchJSON<T = unknown>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`SEC request failed: ${res.status} ${res.statusText} for ${url}`);
    }
    return res.json() as Promise<T>;
  }

  private getTickerCachePath(): string {
    return path.join(this.cacheRoot, 'company_tickers.json');
  }

  async loadTickerDirectory(forceRefresh: boolean = false): Promise<TickerEntry[]> {
    const cachePath = this.getTickerCachePath();
    if (!forceRefresh && fs.existsSync(cachePath)) {
      try {
        const raw = fs.readFileSync(cachePath, 'utf-8');
        const obj = JSON.parse(raw) as Record<string, TickerEntry> | TickerEntry[];
        if (Array.isArray(obj)) return obj;
        return Object.values(obj);
      } catch {
        // fall through to refetch
      }
    }

    const url = 'https://www.sec.gov/files/company_tickers.json';
    const data = await this.fetchJSON<Record<string, TickerEntry>>(url);
    const arr = Object.values(data);
    fs.writeFileSync(cachePath, JSON.stringify(arr, null, 2));
    return arr;
  }

  async identifyPublicCompany(companyName: string, website?: string): Promise<PublicCompanyMatch> {
    try {
      // 1) Overrides (domain/name -> ticker)
      const domain = (website || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      if (domain && this.overridesByDomain[domain]) {
        return { isPublic: true, confidence: 1, matchedTitle: companyName, ticker: this.overridesByDomain[domain], cik: undefined, source: 'overrides' };
      }
      
      const normalizedName = this.normalizeCompanyName(companyName);
      if (normalizedName && this.overridesByName[normalizedName]) {
        return { isPublic: true, confidence: 1, matchedTitle: companyName, ticker: this.overridesByName[normalizedName], cik: undefined, source: 'overrides' };
      }

      // 2) SEC directory matching
      const directory = await this.loadTickerDirectory();
      const match = this.findCompanyMatch(companyName, directory);

      if (match) {
        const cikPadded = this.zeroPadCIK(match.entry.cik_str);
        return {
          isPublic: true,
          confidence: Number(match.score.toFixed(2)),
          matchedTitle: match.entry.title,
          ticker: match.entry.ticker,
          cik: cikPadded,
          source: 'sec_directory',
        };
      }

      return { isPublic: false, confidence: 0 };
    } catch (err) {
      return { isPublic: false, confidence: 0 };
    }
  }

  async getCompanySubmissions(cik: string) {
    const cikPadded = this.zeroPadCIK(cik);
    const url = `https://data.sec.gov/submissions/CIK${cikPadded}.json`;
    return this.fetchJSON<any>(url);
  }

  async list10KFilings(cik: string, maxCount: number = 5): Promise<TenKItem[]> {
    const submissions = await this.getCompanySubmissions(cik);
    const filings = submissions?.filings?.recent;
    if (!filings) return [];
    const out: TenKItem[] = [];
    for (let i = 0; i < filings.form.length; i++) {
      const form = filings.form[i] as string;
      if (form !== '10-K' && form !== '10-K/A') continue;
      out.push({
        form,
        accessionNumber: filings.accessionNumber[i] as string,
        primaryDocument: filings.primaryDocument[i] as string,
        reportDate: filings.reportDate[i] as string | undefined,
        filingDate: filings.filingDate[i] as string | undefined,
      });
    }
    return out.slice(0, maxCount);
  }

  async listAllFilings(cik: string, maxCount: number = 50): Promise<EdgarFiling[]> {
    const submissions = await this.getCompanySubmissions(cik);
    const filings = submissions?.filings?.recent;
    if (!filings) return [];
    
    const out: EdgarFiling[] = [];
    for (let i = 0; i < filings.form.length && out.length < maxCount; i++) {
      const form = filings.form[i] as string;
      const description = filings.primaryDocument[i] as string;
      
      // Exclude stock purchase/sale related filings
      const isExcluded = this.isStockTransactionFiling(form, description);
      
      out.push({
        form,
        accessionNumber: filings.accessionNumber[i] as string,
        primaryDocument: filings.primaryDocument[i] as string,
        reportDate: filings.reportDate[i] as string | undefined,
        filingDate: filings.filingDate[i] as string | undefined,
        description,
        isExcluded,
      });
    }
    return out;
  }

  async downloadFiling(cik: string, item: EdgarFiling): Promise<FilingDownloadResult> {
    const url = this.buildFilingURL(cik, item.accessionNumber, item.primaryDocument);
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': '*/*',
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText} for ${item.form} filing ${item.accessionNumber}`);
    }

    const filingsDir = this.getAllFilingsDir(cik);
    const year = (item.reportDate || item.filingDate || '').slice(0, 4) || 'unknown';
    const month = (item.reportDate || item.filingDate || '').slice(5, 7) || '01';
    const day = (item.reportDate || item.filingDate || '').slice(8, 10) || '01';
    const dateStr = `${year}-${month}-${day}`;
    const baseName = `${dateStr}-${item.form}-${item.accessionNumber.replace(/-/g, '')}`;
    const ext = path.extname(item.primaryDocument).toLowerCase();
    const rawFile = path.join(filingsDir, `${baseName}${ext || '.html'}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(rawFile, buf);

    // Convert to Markdown / Text
    let markdownContent = '';
    let plainText = '';

    if (ext === '.htm' || ext === '.html' || ext === '') {
      const html = buf.toString('utf-8');
      // Simple HTML to text conversion (you might want to use a proper library)
      plainText = this.htmlToText(html);
      markdownContent = `# ${item.form} Filing\n\n${plainText}`;
    } else if (ext === '.txt') {
      const text = buf.toString('utf-8');
      plainText = text;
      markdownContent = `# ${item.form} Filing\n\n${text}`;
    } else {
      // Default: try treat as text
      const text = buf.toString('utf-8');
      plainText = text;
      markdownContent = `# ${item.form} Filing\n\n${text}`;
    }

    const mdPath = path.join(filingsDir, `${baseName}.md`);
    fs.writeFileSync(mdPath, markdownContent, 'utf-8');
    const textPath = path.join(filingsDir, `${baseName}.txt`);
    fs.writeFileSync(textPath, plainText, 'utf-8');

    return { rawPath: rawFile, markdownPath: mdPath, textPath };
  }

  async downloadAllFilings(cik: string, maxCount: number = 50): Promise<Array<{ item: EdgarFiling; paths: FilingDownloadResult }>> {
    const items = await this.listAllFilings(cik, maxCount);
    const outputs: Array<{ item: EdgarFiling; paths: FilingDownloadResult }> = [];
    
    for (const item of items) {
      if (item.isExcluded) {
        console.log(`  Skipping excluded filing: ${item.form} - ${item.description}`);
        continue;
      }
      
      try {
        const paths = await this.downloadFiling(cik, item);
        outputs.push({ item, paths });
        
        // Add a small delay between requests to avoid rate limiting
        if (outputs.length < items.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (err) {
        console.warn(`Failed to process filing ${item.accessionNumber}: ${(err as Error).message}`);
        continue;
      }
    }
    
    return outputs;
  }

  // Helper methods
  private zeroPadCIK(cikNumber: number | string): string {
    const numeric = `${cikNumber}`.replace(/^0+/, '');
    return numeric.padStart(10, '0');
  }

  private normalizeCompanyName(name: string): string {
    const lower = name.toLowerCase().trim();
    const cleaned = lower
      .replace(/[&.,'"()\-]/g, ' ')
      .replace(/\b(incorporated|inc|corp|corporation|ltd|limited|plc|group|holdings|co|company|s\.a\.|s\.a|sa|ag|nv|se|ab)\b/g, '')
      .replace(/\b(operations|international|aerospace|defense|systems|technologies|solutions|services|manufacturing|aviation|space|military)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned;
  }

  private findCompanyMatch(companyName: string, directory: TickerEntry[]): { entry: TickerEntry; score: number } | null {
    const normalizedName = this.normalizeCompanyName(companyName);
    const targetTokens = new Set(normalizedName.split(' ').filter(Boolean));
    
    let best: { entry: TickerEntry; score: number } | null = null;
    
    for (const entry of directory) {
      const normalizedTitle = this.normalizeCompanyName(entry.title);
      const titleTokens = new Set(normalizedTitle.split(' ').filter(Boolean));
      
      const score = this.jaccardSimilarity(targetTokens, titleTokens);
      if (score >= 0.8 && (!best || score > best.score)) {
        best = { entry, score };
      }
    }
    
    return best;
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersectionSize = new Set([...a].filter(x => b.has(x))).size;
    const unionSize = new Set([...a, ...b]).size || 1;
    return intersectionSize / unionSize;
  }

  private isStockTransactionFiling(form: string, description: string): boolean {
    const lowerForm = form.toLowerCase();
    const lowerDesc = description.toLowerCase();
    
    // Exclude forms related to stock transactions
    const stockForms = ['3', '4', '5', '144', '3/A', '4/A', '5/A', '144/A'];
    if (stockForms.includes(form)) return true;
    
    // Exclude descriptions related to stock purchases/sales
    const stockKeywords = [
      'stock purchase', 'stock sale', 'share purchase', 'share sale',
      'insider trading', 'beneficial ownership', 'ownership change',
      'acquisition of securities', 'disposition of securities',
      'form 3', 'form 4', 'form 5', 'form 144'
    ];
    
    return stockKeywords.some(keyword => lowerDesc.includes(keyword));
  }

  private buildFilingURL(cik: string, accessionNumber: string, primaryDocument: string): string {
    const cikNoZeros = `${cik}`.replace(/^0+/, '');
    const accNoNoDashes = accessionNumber.replace(/-/g, '');
    return `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accNoNoDashes}/${primaryDocument}`;
  }

  private getAllFilingsDir(cik: string): string {
    const dir = path.join(this.cacheRoot, cik, 'all-filings');
    this.ensureDir(dir);
    return dir;
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
