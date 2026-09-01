/**
 * ==============================================================================
 * RADAR_HUB — FRONTEND SINGLE SOURCE OF TRUTH (ROTAS, VERTICAIS & SEGURANÇA)
 * ==============================================================================
 * Definição centralizada de categorias, badges, rotas internas, deep links e
 * utilitários de segurança contra open redirect e XSS.
 */

const RADAR_VERTICALS = {
  price_bug: {
    id: 'price_bug',
    name: 'Bugs de Preço',
    shortName: 'Bugs',
    slug: 'bugs-preco',
    category: 'ecommerce',
    badgeClass: 'badge-bug',
    icon: '🛒',
    description: 'Bugs de preço, erros de digitação e quedas >60% OFF'
  },
  car_auction: {
    id: 'car_auction',
    name: 'Leilões de Veículos',
    shortName: 'Leilões Veículos',
    slug: 'leiloes-veiculos',
    category: 'auctions',
    badgeClass: 'badge-auction',
    icon: '🚗',
    description: 'Leilões judiciais e extrajudiciais com deságio real vs FIPE'
  },
  industrial_auction: {
    id: 'industrial_auction',
    name: 'Leilões Industriais',
    shortName: 'Leilões Industriais',
    slug: 'bens-industriais',
    category: 'auctions',
    badgeClass: 'badge-auction',
    icon: '🏭',
    description: 'Maquinário pesado, massas falidas e bens industriais'
  },
  real_estate_local: {
    id: 'real_estate_local',
    name: 'Imóveis Bauru',
    shortName: 'Imóveis Bauru',
    slug: 'imoveis-bauru',
    category: 'real_estate',
    badgeClass: 'badge-auction',
    icon: '🏢',
    description: 'Imóveis em leilão e venda direta com deságio >40% por m²'
  },
  public_tender: {
    id: 'public_tender',
    name: 'Licitações PNCP',
    shortName: 'Licitações PNCP',
    slug: 'licitacoes-pncp',
    category: 'government',
    badgeClass: 'badge-stacking',
    icon: '🏛️',
    description: 'Dispensas eletrônicas e compras públicas lucrativas'
  },
  expired_domain: {
    id: 'expired_domain',
    name: 'Domínios Expirando',
    shortName: 'Domínios Expirando',
    slug: 'dominios-expirando',
    category: 'seo_domains',
    badgeClass: 'badge-miles',
    icon: '🌐',
    description: 'Domínios .br em processo de liberação com autoridade SEO'
  },
  remote_job: {
    id: 'remote_job',
    name: 'Vagas Remotas USD',
    shortName: 'Vagas Remotas USD',
    slug: 'vagas-remotas-usd',
    category: 'career',
    badgeClass: 'badge-stacking',
    icon: '💼',
    description: 'Vagas internacionais 100% home office pagando em USD/EUR'
  },
  coupon_deal: {
    id: 'coupon_deal',
    name: 'Cupons & Descontos',
    shortName: 'Cupons',
    slug: 'cupons-descontos',
    category: 'ecommerce',
    badgeClass: 'badge-bug',
    icon: '🎟️',
    description: 'Cupons ativos e brechas em regras de checkout'
  },
  cashback_max: {
    id: 'cashback_max',
    name: 'Cashback Máximo',
    shortName: 'Cashback Max',
    slug: 'cashback-maximo',
    category: 'fintech',
    badgeClass: 'badge-stacking',
    icon: '💰',
    description: 'Ranking em tempo real de maiores taxas de cashback'
  },
  sweepstake_promo: {
    id: 'sweepstake_promo',
    name: 'Sorteios SECAP',
    shortName: 'Sorteios SECAP',
    slug: 'sorteios-secap',
    category: 'promotions',
    badgeClass: 'badge-miles',
    icon: '🎁',
    description: 'Sorteios oficiais com alta premiação e baixa concorrência'
  },
  miles_promo: {
    id: 'miles_promo',
    name: 'Milhas CPM',
    shortName: 'Milhas CPM',
    slug: 'milhas-cpm',
    category: 'travel',
    badgeClass: 'badge-miles',
    icon: '✈️',
    description: 'Transferências bonificadas e emissões com desconto'
  },
  microtask_gig: {
    id: 'microtask_gig',
    name: 'Microtarefas Digitais',
    shortName: 'Microtarefas',
    slug: 'microtarefas-digitais',
    category: 'career',
    badgeClass: 'badge-stacking',
    icon: '⚡',
    description: 'Rotulação para IA e testes com alta taxa horária'
  },
  stacking_deal: {
    id: 'stacking_deal',
    name: 'Stacking Multi-Desconto',
    shortName: 'Stacking',
    slug: 'stacking-descontos',
    category: 'arbitrage',
    badgeClass: 'badge-stacking',
    icon: '🧱',
    description: 'Combinações acumulativas de cupons + cashback + cartões'
  }
};

/**
 * Utilitários de Segurança para Navegação e URLs
 */
const SafeNavigator = {
  disallowedProtocols: ['javascript:', 'data:', 'vbscript:', 'file:'],
  dummyDomains: ['radarhub.local', 'exemplo.com', 'localhost'],

  isValidExternalUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    const clean = urlStr.trim();
    const lower = clean.toLowerCase();

    for (const proto of this.disallowedProtocols) {
      if (lower.startsWith(proto)) return false;
    }

    try {
      const parsed = new URL(clean, window.location.origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

      // Impede abertura de domínios dummy em novas abas
      for (const dummy of this.dummyDomains) {
        if (parsed.hostname.toLowerCase() === dummy || parsed.hostname.toLowerCase().endsWith('.' + dummy)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  },

  openExternal(urlStr) {
    if (!this.isValidExternalUrl(urlStr)) return false;
    window.open(urlStr, '_blank', 'noopener,noreferrer');
    return true;
  }
};

// Exportação compatível com browser
if (typeof window !== 'undefined') {
  window.RADAR_VERTICALS = RADAR_VERTICALS;
  window.SafeNavigator = SafeNavigator;
}
