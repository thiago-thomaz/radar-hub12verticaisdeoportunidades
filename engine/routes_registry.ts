/**
 * ==============================================================================
 * RADAR_HUB — CENTRAL ROUTE & VERTICAL REGISTRY (SINGLE SOURCE OF TRUTH)
 * ==============================================================================
 * Arquitetura unificada e centralizada para todas as 12 verticais, módulos de
 * suporte, rotas internas do cockpit, rotas de API e regras de segurança de links.
 */

export type LinkType = 'INTERNAL' | 'EXTERNAL' | 'API';

export interface VerticalDefinition {
  id: string;
  name: string;
  slug: string;
  category: string;
  badgeClass: string;
  icon: string;
  description: string;
  internalRoute: string;
  enabled: boolean;
  scoreThreshold: number;
}

export interface RouteDefinition {
  id: string;
  name: string;
  path: string;
  type: LinkType;
  description: string;
  authRequired?: boolean;
}

/**
 * 1. REGISTRO OFICIAL DAS 12 VERTICAIS DE OPORTUNIDADES + STACKING
 */
export const VERTICALS_REGISTRY: Record<string, VerticalDefinition> = {
  price_bug: {
    id: 'price_bug',
    name: 'Bugs de Preço',
    slug: 'bugs-preco',
    category: 'ecommerce',
    badgeClass: 'badge-bug',
    icon: '🛒',
    description: 'Bugs de preço, erros de digitação e quedas >60% OFF em grandes e-commerces',
    internalRoute: '/?vertical=price_bug',
    enabled: true,
    scoreThreshold: 60
  },
  car_auction: {
    id: 'car_auction',
    name: 'Leilões de Veículos',
    slug: 'leiloes-veiculos',
    category: 'auctions',
    badgeClass: 'badge-auction',
    icon: '🚗',
    description: 'Leilões judiciais e extrajudiciais com deságio real vs Tabela FIPE',
    internalRoute: '/?vertical=car_auction',
    enabled: true,
    scoreThreshold: 70
  },
  industrial_auction: {
    id: 'industrial_auction',
    name: 'Leilões Industriais',
    slug: 'bens-industriais',
    category: 'auctions',
    badgeClass: 'badge-auction',
    icon: '🏭',
    description: 'Maquinário pesado, massas falidas, inversores e equipamentos industriais',
    internalRoute: '/?vertical=industrial_auction',
    enabled: true,
    scoreThreshold: 70
  },
  real_estate_local: {
    id: 'real_estate_local',
    name: 'Imóveis Bauru',
    slug: 'imoveis-bauru',
    category: 'real_estate',
    badgeClass: 'badge-auction',
    icon: '🏢',
    description: 'Imóveis em leilão e venda direta com deságio >40% por m² em Bauru e região',
    internalRoute: '/?vertical=real_estate_local',
    enabled: true,
    scoreThreshold: 75
  },
  public_tender: {
    id: 'public_tender',
    name: 'Licitações PNCP',
    slug: 'licitacoes-pncp',
    category: 'government',
    badgeClass: 'badge-stacking',
    icon: '🏛️',
    description: 'Dispensas eletrônicas e editais públicos com alta margem de fornecimento',
    internalRoute: '/?vertical=public_tender',
    enabled: true,
    scoreThreshold: 70
  },
  expired_domain: {
    id: 'expired_domain',
    name: 'Domínios Expirando',
    slug: 'dominios-expirando',
    category: 'seo_domains',
    badgeClass: 'badge-miles',
    icon: '🌐',
    description: 'Domínios .br e globais em processo de liberação com autoridade e backlinks',
    internalRoute: '/?vertical=expired_domain',
    enabled: true,
    scoreThreshold: 65
  },
  remote_job: {
    id: 'remote_job',
    name: 'Vagas Remotas USD',
    slug: 'vagas-remotas-usd',
    category: 'career',
    badgeClass: 'badge-stacking',
    icon: '💼',
    description: 'Vagas internacionais 100% home office remuneradas em moeda forte (USD/EUR)',
    internalRoute: '/?vertical=remote_job',
    enabled: true,
    scoreThreshold: 70
  },
  coupon_deal: {
    id: 'coupon_deal',
    name: 'Cupons & Descontos',
    slug: 'cupons-descontos',
    category: 'ecommerce',
    badgeClass: 'badge-bug',
    icon: '🎟️',
    description: 'Cupons ativos, cumulativos e brechas em regras promocionais de carrinho',
    internalRoute: '/?vertical=coupon_deal',
    enabled: true,
    scoreThreshold: 60
  },
  cashback_max: {
    id: 'cashback_max',
    name: 'Cashback Máximo',
    slug: 'cashback-maximo',
    category: 'fintech',
    badgeClass: 'badge-stacking',
    icon: '💰',
    description: 'Agregação e ranking de maiores percentuais de cashback e afiliados',
    internalRoute: '/?vertical=cashback_max',
    enabled: true,
    scoreThreshold: 60
  },
  sweepstake_promo: {
    id: 'sweepstake_promo',
    name: 'Sorteios SECAP',
    slug: 'sorteios-secap',
    category: 'promotions',
    badgeClass: 'badge-miles',
    icon: '🎁',
    description: 'Promoções comerciais autorizadas com alta premiação e baixa concorrência',
    internalRoute: '/?vertical=sweepstake_promo',
    enabled: true,
    scoreThreshold: 65
  },
  miles_promo: {
    id: 'miles_promo',
    name: 'Milhas CPM',
    slug: 'milhas-cpm',
    category: 'travel',
    badgeClass: 'badge-miles',
    icon: '✈️',
    description: 'Transferências bonificadas, custo por milheiro e passagens com desconto',
    internalRoute: '/?vertical=miles_promo',
    enabled: true,
    scoreThreshold: 70
  },
  microtask_gig: {
    id: 'microtask_gig',
    name: 'Microtarefas Digitais',
    slug: 'microtarefas-digitais',
    category: 'career',
    badgeClass: 'badge-stacking',
    icon: '⚡',
    description: 'Gigs, rotulação para IA e testes de software com alta remuneração horária',
    internalRoute: '/?vertical=microtask_gig',
    enabled: true,
    scoreThreshold: 65
  },
  stacking_deal: {
    id: 'stacking_deal',
    name: 'Stacking de Descontos',
    slug: 'stacking-descontos',
    category: 'arbitrage',
    badgeClass: 'badge-stacking',
    icon: '🧱',
    description: 'Combinações multi-camadas de cupom + cashback + cartão + pontuação',
    internalRoute: '/?vertical=stacking_deal',
    enabled: true,
    scoreThreshold: 75
  }
};

/**
 * 2. REGISTRO OFICIAL DE ROTAS DO SISTEMA
 */
export const SYSTEM_ROUTES: RouteDefinition[] = [
  // Rotas do Cockpit
  { id: 'cockpit_home', name: 'Cockpit Principal', path: '/', type: 'INTERNAL', description: 'Visão unificada em tempo real' },
  { id: 'cockpit_pwa_manifest', name: 'Manifest PWA', path: '/manifest.json', type: 'INTERNAL', description: 'Manifest de instalação PWA' },
  { id: 'cockpit_service_worker', name: 'Service Worker PWA', path: '/sw.js', type: 'INTERNAL', description: 'Worker de cache e push' },

  // Rotas de Telemetria e Monitoramento
  { id: 'api_health', name: 'Health Check', path: '/health', type: 'API', description: 'Status de saúde dos serviços e banco' },
  { id: 'api_metrics', name: 'Métricas Prometheus', path: '/metrics', type: 'API', description: 'Métricas de telemetria' },
  { id: 'api_docs', name: 'Documentação Swagger UI', path: '/api/docs', type: 'INTERNAL', description: 'Documentação interativa OpenAPI 3.0' },
  { id: 'api_docs_spec', name: 'Especificação OpenAPI YAML', path: '/api/docs/spec.yaml', type: 'API', description: 'Especificação OpenAPI' },

  // Rotas de Oportunidades & Ações
  { id: 'api_evaluate', name: 'Avaliar Oportunidade', path: '/api/evaluate', type: 'API', description: 'Normalização e scoring em tempo real' },
  { id: 'api_checkout_create', name: 'Criar Ordem Checkout', path: '/api/checkout/create-order', type: 'API', description: 'Ordem de 1-clique PIX' },
  { id: 'api_checkout_session', name: 'Sessão de Pagamento Multi-Gateway', path: '/api/checkout/session', type: 'API', description: 'Assinaturas VIP Mercado Pago/Asaas/Stripe' },
  { id: 'api_legal_notice', name: 'Minutas Jurídicas CDC', path: '/api/legal/generate-notice', type: 'API', description: 'Geração de Notificação 48h e Petição JEC' },
  { id: 'api_affiliates_gen', name: 'Gerar Link Afiliado', path: '/api/affiliates/generate', type: 'API', description: 'Parametrização de links monetizados' },
  { id: 'api_redirect_short', name: 'Redirecionamento Rastreável', path: '/r/:shortCode', type: 'INTERNAL', description: 'Redirecionamento seguro com tracking' },
  { id: 'api_sniper_exec', name: 'Executar Sniper Headless', path: '/api/sniper/execute', type: 'API', description: 'Reserva e compra automatizada' },
  { id: 'api_reports_dossier', name: 'Dossiê em PDF', path: '/api/reports/dossier/:opportunityId', type: 'API', description: 'Relatório executivo em PDF' },
  { id: 'api_financial_overview', name: 'Cockpit Financeiro', path: '/api/financial/overview', type: 'API', description: 'DRE e métricas SaaS' },
  { id: 'api_telegram_webhook', name: 'Webhook do Telegram', path: '/api/telegram/webhook', type: 'API', description: 'Interação com bot e alertas' },
  { id: 'api_waha_webhook', name: 'Webhook WhatsApp WAHA', path: '/api/webhooks/waha', type: 'API', description: 'Mensageria e RAG WhatsApp' },
  { id: 'api_push_subscribe', name: 'Inscrição Web Push', path: '/api/push/subscribe', type: 'API', description: 'Registro de dispositivo para alertas' }
];

/**
 * 3. VALIDADOR DE SEGURANÇA DE LINKS EXTERNOS
 */
export class URLSafetyValidator {
  private static readonly DISALLOWED_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:'];
  private static readonly DUMMY_DOMAINS = ['radarhub.local', 'exemplo.com', 'localhost'];

  /**
   * Verifica se uma URL é estritamente válida para navegação externa
   */
  public static isValidExternalUrl(urlStr: unknown): boolean {
    if (typeof urlStr !== 'string' || !urlStr.trim()) return false;
    const cleanUrl = urlStr.trim();

    // Bloqueia esquemas perigosos
    const lower = cleanUrl.toLowerCase();
    for (const proto of this.DISALLOWED_PROTOCOLS) {
      if (lower.startsWith(proto)) return false;
    }

    try {
      const parsed = new URL(cleanUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

      // Não permite domínios dummy em links de compra/origem reais
      for (const dummy of this.DUMMY_DOMAINS) {
        if (parsed.hostname.toLowerCase() === dummy || parsed.hostname.toLowerCase().endsWith(`.${dummy}`)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitiza e normaliza URL para redirecionamento seguro
   */
  public static sanitizeRedirectUrl(urlStr: string, fallbackUrl = '/'): string {
    if (!urlStr || typeof urlStr !== 'string') return fallbackUrl;
    const trimmed = urlStr.trim();

    // Se for caminho relativo seguro
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
      return trimmed;
    }

    if (this.isValidExternalUrl(trimmed)) {
      return trimmed;
    }

    return fallbackUrl;
  }
}
