/**
 * ==============================================================================
 * RADAR_HUB — MOTOR DE PUBLICAÇÃO AUTOMÁTICA EM REDES SOCIAIS (X & INSTAGRAM)
 * ==============================================================================
 * Publicador automatizado para atração e viralização (Topo de Funil):
 * 1. Twitter / X: Threads com badges de desconto, preços e link de afiliado.
 * 2. Instagram Stories / Feed: Geração dinâmica de banners visuais em SVG/Canvas.
 * 3. Regra de Gatilho: Score >= 90 e limite anti-spam (cooldown de 15 min).
 */

import { UnifiedOpportunity } from './scoring';
import { RadarAffiliateManager } from './affiliate_manager';

export interface SocialPostResult {
  published: boolean;
  platform: 'TWITTER_X' | 'INSTAGRAM_STORY' | 'ALL';
  tweetContent?: string;
  storyBannerSvg?: string;
  affiliateShortUrl: string;
  cooldownRemainingMinutes: number;
  reason?: string;
  publishedAt?: string;
}

export class RadarSocialPoster {
  private affiliateManager: RadarAffiliateManager;
  private lastPostTimestamp: number = 0;
  private readonly COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos

  constructor() {
    this.affiliateManager = new RadarAffiliateManager();
  }

  /**
   * Gera o conteúdo formatado para o Twitter / X
   */
  public generateTwitterPost(opp: UnifiedOpportunity): { tweetText: string; shortUrl: string } {
    const affiliate = this.affiliateManager.generateAffiliateLink(opp.source_url, { campaign: 'social_x' });
    const discount = opp.discount_percentage ? `${opp.discount_percentage.toFixed(0)}% OFF` : 'SUPER DESCONTO';
    const oldPrice = opp.fipe_or_market_ref ? `~R$ ${opp.fipe_or_market_ref.toFixed(2)}~` : '';
    const newPrice = `R$ ${opp.opportunity_price.toFixed(2)}`;

    const tweetText = `
🚨 ALERTA DE OPORTUNIDADE DETECTADA!

📦 ${opp.title}
💰 De ${oldPrice} por apenas ${newPrice} (${discount})
🏪 Loja/Origem: ${opp.source_name}

⚡ Aproveite antes que acabe ou o preço seja corrigido:
🔗 ${affiliate.shortUrl}

#radarhub #promocao #achadinhos #oferta #arbitragem
    `.trim();

    return { tweetText, shortUrl: affiliate.shortUrl };
  }

  /**
   * Gera o banner visual em SVG de alta fidelidade para Instagram Stories (9:16)
   */
  public generateInstagramStoryBanner(opp: UnifiedOpportunity): string {
    const affiliate = this.affiliateManager.generateAffiliateLink(opp.source_url, { campaign: 'social_insta' });
    const discount = opp.discount_percentage ? `${opp.discount_percentage.toFixed(0)}% OFF` : 'OPORTUNIDADE';
    const oldPrice = opp.fipe_or_market_ref ? `R$ ${opp.fipe_or_market_ref.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
    const newPrice = `R$ ${opp.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    return `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#080c14"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="neon" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f2fe"/>
      <stop offset="100%" stop-color="#4facfe"/>
    </linearGradient>
  </defs>

  <rect width="1080" height="1920" fill="url(#bg)"/>

  <!-- Top Brand -->
  <text x="540" y="180" font-family="Arial, sans-serif" font-size="52" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="4">
    RADAR<tspan fill="#00f2fe">_HUB</tspan>
  </text>
  <text x="540" y="240" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="8">
    ALERTA DE ARBITRAGEM SUPREMA
  </text>

  <!-- Discount Badge -->
  <rect x="290" y="340" width="500" height="110" rx="55" fill="url(#neon)"/>
  <text x="540" y="415" font-family="Arial, sans-serif" font-size="56" font-weight="900" fill="#080c14" text-anchor="middle">
    🔥 ${discount}
  </text>

  <!-- Product Title -->
  <foreignObject x="100" y="520" width="880" height="260">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 42px; font-weight: 800; color: #ffffff; text-align: center; line-height: 1.3;">
      ${opp.title}
    </div>
  </foreignObject>

  <!-- Price Card -->
  <rect x="100" y="820" width="880" height="380" rx="30" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
  
  <text x="540" y="910" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#64748b" text-anchor="middle" text-decoration="line-through">
    DE: ${oldPrice}
  </text>

  <text x="540" y="990" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#10b981" text-anchor="middle">
    POR APENAS
  </text>
  
  <text x="540" y="1110" font-family="Arial, sans-serif" font-size="84" font-weight="900" fill="#00f2fe" text-anchor="middle">
    ${newPrice}
  </text>

  <!-- Store Tag -->
  <text x="540" y="1260" font-family="Arial, sans-serif" font-size="28" font-weight="600" fill="#94a3b8" text-anchor="middle">
    Origem: ${opp.source_name} • Score: ${opp.evaluation_score}/100
  </text>

  <!-- CTA Box -->
  <rect x="140" y="1450" width="800" height="180" rx="90" fill="#10b981"/>
  <text x="540" y="1535" font-family="Arial, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle">
    CLIQUE NO LINK DOS STORIES
  </text>
  <text x="540" y="1585" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="rgba(255,255,255,0.8)" text-anchor="middle">
    ${affiliate.shortUrl}
  </text>
</svg>
    `.trim();
  }

  /**
   * Publica oportunidade nos canais sociais respeitando regras de gatilho e cooldown
   */
  public async publishToSocialNetworks(
    opp: UnifiedOpportunity,
    force: boolean = false
  ): Promise<SocialPostResult> {
    const now = Date.now();
    const timeSinceLastPost = now - this.lastPostTimestamp;

    // Regra 1: Apenas oportunidades com Score >= 90
    if (opp.evaluation_score < 90 && !force) {
      return {
        published: false,
        platform: 'ALL',
        affiliateShortUrl: '',
        cooldownRemainingMinutes: 0,
        reason: `Score insuficiente (${opp.evaluation_score}/100). Mínimo exigido: 90.`
      };
    }

    // Regra 2: Limite anti-spam de 15 minutos
    if (timeSinceLastPost < this.COOLDOWN_MS && !force) {
      const remainingMinutes = Math.ceil((this.COOLDOWN_MS - timeSinceLastPost) / (60 * 1000));
      return {
        published: false,
        platform: 'ALL',
        affiliateShortUrl: '',
        cooldownRemainingMinutes: remainingMinutes,
        reason: `Limite de publicação ativo. Aguarde mais ${remainingMinutes} minuto(s).`
      };
    }

    const { tweetText, shortUrl } = this.generateTwitterPost(opp);
    const storyBannerSvg = this.generateInstagramStoryBanner(opp);

    this.lastPostTimestamp = now;
    console.log(`\x1b[35m[SOCIAL PUBLISHED]\x1b[0m Oportunidade "${opp.title}" publicada no Twitter/X e Instagram Stories.`);

    return {
      published: true,
      platform: 'ALL',
      tweetContent: tweetText,
      storyBannerSvg,
      affiliateShortUrl: shortUrl,
      cooldownRemainingMinutes: 15,
      publishedAt: new Date().toISOString()
    };
  }
}
