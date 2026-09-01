/**
 * RADAR_HUB - Motor de Scrapers Resilientes & Rotação Anti-Block
 */

export const USER_AGENT_POOL: string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
];

export interface ScraperHeaders {
  'User-Agent': string;
  'Accept': string;
  'Accept-Language': string;
  'Cache-Control': string;
  'Sec-Ch-Ua'?: string;
  'Sec-Ch-Ua-Mobile'?: string;
  'Sec-Ch-Ua-Platform'?: string;
}

export function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * USER_AGENT_POOL.length);
  return USER_AGENT_POOL[index];
}

export function generateResilientHeaders(): ScraperHeaders {
  const ua = getRandomUserAgent();
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
  };
}

export function calculateExponentialBackoff(retryCount: number, baseMs: number = 1000, maxMs: number = 8000): number {
  const delay = Math.min(maxMs, baseMs * Math.pow(2, retryCount));
  const jitter = Math.random() * 500; // jitter aleatório para evitar colisões
  return Math.floor(delay + jitter);
}
