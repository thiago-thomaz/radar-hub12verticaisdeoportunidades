/**
 * ==============================================================================
 * RADAR_HUB — ASSISTENTE CONVERSACIONAL DE ARBITRAGEM (RAG & INTELIGÊNCIA)
 * ==============================================================================
 * Motor de atendimento inteligente para Telegram e WhatsApp (WAHA), com RAG
 * conectado aos motores de scoring, custos ocultos, IA preditiva e checkout PIX.
 */

import { RadarPredictiveAIEngine } from './predictive_ai';
import { calculateVehicleHiddenCosts, calculateRealEstateHiddenCosts } from './hidden_costs_calculator';
import { RadarCrossBorderEngine } from './cross_border_engine';
import { buildOneClickCheckoutTask } from './one_click_checkout';

export interface UserMessageContext {
  channel: 'WHATSAPP' | 'TELEGRAM';
  senderId: string;
  senderName?: string;
  isVip?: boolean;
}

export interface AssistantResponse {
  responseText: string;
  actionRequired?: 'NONE' | 'SHOW_PIX' | 'OPEN_URL';
  pixPayload?: string;
  suggestedButtons?: Array<{ text: string; callbackData: string }>;
  confidence: number;
}

export class RadarAIAssistant {
  /**
   * Processa a mensagem do usuário utilizando heurísticas RAG e motores internos
   */
  public static async processUserMessage(
    userText: string,
    context: UserMessageContext
  ): Promise<AssistantResponse> {
    const textLower = userText.toLowerCase();

    // 1. INTENÇÃO: ADESÃO OU RENOVAÇÃO DO GRUPO VIP (CHECKOUT PIX)
    if (
      textLower.includes('assinar') ||
      textLower.includes('vip') ||
      textLower.includes('plano') ||
      textLower.includes('quanto custa') ||
      textLower.includes('comprar vip')
    ) {
      const task = buildOneClickCheckoutTask({
        opportunityId: 'VIP_SUBSCRIPTION_WAHA',
        targetUrl: 'https://radarhub.local/vip',
        maxPriceLimit: 49.90,
        accountEmail: `${context.senderId}@radarhub.com`
      });

      return {
        responseText: `
💎 *PLANO RADAR_HUB VIP — ACESSO SUPREMO*

Com o VIP você recebe todos os alertas das 12 verticais com *10 a 15 minutos de antecedência*, links com travas 1-Click e suporte do bot 24/7.

💰 *Valor:* R$ 49,90/mês  
⚡ *Chave PIX Copia e Cola para Ativação Instantânea:*
\`${task.pixCode}\`

_Assim que o pagamento for liquidado, você receberá automaticamente o link de convite único do Grupo VIP!_
        `.trim(),
        actionRequired: 'SHOW_PIX',
        pixPayload: task.pixCode,
        suggestedButtons: [
          { text: '📋 Copiar Código PIX', callbackData: 'COPY_PIX' },
          { text: '❓ Dúvidas sobre o VIP', callbackData: 'VIP_FAQ' }
        ],
        confidence: 0.98
      };
    }

    // 2. INTENÇÃO: ANÁLISE DE RISCO DE CANCELAMENTO (BUGS DE PREÇO / E-COMMERCE)
    if (
      textLower.includes('cancelar') ||
      textLower.includes('cancelamento') ||
      textLower.includes('risco') ||
      textLower.includes('chance') ||
      textLower.includes('bug')
    ) {
      const insights = RadarPredictiveAIEngine.generatePredictiveInsights({
        currentPrice: 699.00,
        historicalAveragePrice: 4999.00,
        isOfficialStore1P: true,
        isFulfilledOrPrime: true,
        storeRating: 4.8
      });

      return {
        responseText: `
🧠 *ANÁLISE PREDITIVA DE RISCO DE CANCELAMENTO*

📊 *Diagnóstico da IA:*
• *Risco de Cancelamento:* \`${insights.cancelationRiskScore}/100\` (${insights.cancelationRiskLevel})
• *Janela Estimada de Correção:* ~${insights.estimatedTimeToCorrectionMinutes} minutos
• *Segurança Jurídica (CDC Art. 30/35):* *${insights.legalEnforceabilityRating}*

⚖️ *Veredito:* *${insights.verdict}*
💡 *Dica:* ${insights.actionPlanChecklist[0]}
        `.trim(),
        actionRequired: 'NONE',
        confidence: 0.95
      };
    }

    // 3. INTENÇÃO: VEÍCULOS EM LEILÃO E TABELA FIPE
    if (
      textLower.includes('corolla') ||
      textLower.includes('civic') ||
      textLower.includes('carro') ||
      textLower.includes('leilao') ||
      textLower.includes('veiculo') ||
      textLower.includes('fipe')
    ) {
      const costs = calculateVehicleHiddenCosts(48000.00, 85000.00, 3500.00);

      return {
        responseText: `
🚗 *CONSULTA DE LEILÃO // TOYOTA COROLLA XEI 2021*

💰 *Valor do Lance:* R$ 48.000,00  
📈 *Tabela FIPE Oficial:* R$ 85.000,00  
📉 *Deságio Bruto:* 43.5% OFF

🔍 *Detalhamento de Custos Ocultos:*
• Comissão Leiloeiro (5%): R$ ${costs.comissaoLeiloeiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
• Guincho/Pátio + Reparos Est.: R$ ${(costs.taxaPatioGuincho + costs.custoReparosEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
• *Custo Real de Aquisição (CRA):* *R$ ${costs.custoRealAquisicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*

💵 *Lucro Líquido Estimado na Revenda:* *R$ ${costs.lucroLiquidoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}* (Deságio Real: ${costs.desagioRealPercent.toFixed(1)}%)
        `.trim(),
        actionRequired: 'NONE',
        confidence: 0.96
      };
    }

    // 4. INTENÇÃO: IMPORTAÇÃO CROSS-BORDER & IMPOSTOS (REMESSA CONFORME)
    if (
      textLower.includes('importar') ||
      textLower.includes('china') ||
      textLower.includes('dolar') ||
      textLower.includes('remessa conforme') ||
      textLower.includes('imposto')
    ) {
      const crossBorder = RadarCrossBorderEngine.calculateImportArbitrage({
        foreignPrice: 35.00,
        currency: 'USD',
        shippingForeign: 5.00,
        localMarketReferenceBrl: 450.00,
        marketplacePreset: 'MERCADO_LIVRE'
      });

      return {
        responseText: `
🌐 *ANÁLISE DE IMPORTAÇÃO & REMESSA CONFORME*

📦 *Item:* Smartwatch / Gadget Importado (CIF: US$ ${crossBorder.totalCifUsd})
💵 *Câmbio Atual:* R$ ${crossBorder.exchangeRateBrl.toFixed(2)} / USD

📑 *Impostos & Custo:*
• Imposto de Importação (II 20%): R$ ${crossBorder.importTaxIiBrl.toFixed(2)}
• ICMS Estadual (17% por dentro): R$ ${crossBorder.icmsBrl.toFixed(2)}
• *Custo Total de Entrada (Brasil):* *R$ ${crossBorder.totalLandedCostBrl.toFixed(2)}*

📈 *Revenda no Mercado Livre (R$ ${crossBorder.localMarketReferenceBrl}):*
• *Lucro Líquido Projetado:* *R$ ${crossBorder.netArbitrageProfitBrl.toFixed(2)}* (ROI: ${crossBorder.netRoiPct}%)
• *Veredito:* *${crossBorder.verdict}*
        `.trim(),
        actionRequired: 'NONE',
        confidence: 0.94
      };
    }

    // 5. INTENÇÃO: IMÓVEIS E CUSTOS EM BAURU
    if (textLower.includes('bauru') || textLower.includes('imovel') || textLower.includes('apartamento')) {
      const reCosts = calculateRealEstateHiddenCosts(180000.00, 300000.00, true);

      return {
        responseText: `
🏢 *ANÁLISE IMOBILIÁRIA // BAURU (SP)*

💰 *Valor de Arrematação:* R$ 180.000,00  
📊 *Avaliação de Mercado da Região:* R$ 300.000,00

📑 *Custos Cartorários e Regularização:*
• ITBI (3%): R$ ${reCosts.itbiTax.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
• Escritura & Registro (1%): R$ ${reCosts.registroCartorio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
• Regularização/Despejo Est.: R$ ${reCosts.despesasRegularizacaoDespejo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
• *Custo Total do Imóvel:* *R$ ${reCosts.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*

📈 *Lucro Líquido Projetado:* *R$ ${reCosts.lucroProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}* (ROI: ${reCosts.roiProjetadoPercent.toFixed(1)}%)
        `.trim(),
        actionRequired: 'NONE',
        confidence: 0.93
      };
    }

    // RESPOSTA PADRÃO / MENU DE AJUDA
    return {
      responseText: `
🤖 *ASSISTENTE DE INTELIGÊNCIA RADAR_HUB*

Olá! Posso ajudá-lo a encontrar as melhores oportunidades de arbitragem em tempo real. Você pode me perguntar sobre:

1. 🚗 *"Carros em leilão com mais de 40% de margem"*
2. 🔥 *"Qual o risco de cancelamento de bugs na Amazon ou Magalu?"*
3. 🌐 *"Quanto custa importar um gadget e revender no Mercado Livre?"*
4. 🏢 *"Oportunidades e custos de imóveis em Bauru"*
5. 💎 *"Como assinar o grupo VIP com alertas antecipados?"*

_Como posso te ajudar agora?_
      `.trim(),
      actionRequired: 'NONE',
      confidence: 0.80
    };
  }
}
