import { RadarFirecrawlService } from '../engine/firecrawl_service';

const s = RadarFirecrawlService.getInstance();
const opps = s.getAllUnifiedOpportunities();
console.log('Total opportunities in system:', opps.length);

const rootUrls: any[] = [];
opps.forEach(o => {
  try {
    const p = new URL(o.source_url).pathname;
    if (p === '/' || p === '') {
      rootUrls.push({
        category: o.category,
        title: o.title,
        source: o.source_name,
        url: o.source_url
      });
    }
  } catch (err) {
    console.error('Invalid URL:', o.source_url);
  }
});

console.log(`\nFound ${rootUrls.length} opportunities with ROOT homepage URLs:`);
rootUrls.forEach(r => {
  console.log(`- [${r.category}] "${r.title}" (${r.source}) -> ${r.url}`);
});
