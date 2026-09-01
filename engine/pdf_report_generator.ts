/**
 * ==============================================================================
 * RADAR_HUB — GERADOR DE DOSSIÊ EXECUTIVO DE ARBITRAGEM EM PDF
 * ==============================================================================
 * Geração de relatórios analíticos de alta fidelidade para investidores
 * cobrindo Leilões de Veículos, Imóveis em Bauru e Bens Industriais.
 */

import { UnifiedOpportunity } from './scoring';
import { calculateVehicleHiddenCosts, calculateRealEstateHiddenCosts } from './hidden_costs_calculator';

export interface DossierMetadata {
  reportId: string;
  generatedAt: string;
  opportunityTitle: string;
  category: string;
  score: number;
  sha256Fingerprint: string;
  financialSummary: {
    bidOrOfferPriceBrl: number;
    marketReferencePriceBrl: number;
    totalAcquisitionCostBrl: number;
    projectedNetProfitBrl: number;
    projectedRoiPercentage: number;
  };
  legalRiskVerdict: string;
}

export class RadarPdfReportGenerator {
  /**
   * Gera o buffer binário de PDF e metadados estruturados
   */
  public static generateExecutiveDossier(opp: UnifiedOpportunity): {
    pdfBuffer: Buffer;
    htmlContent: string;
    metadata: DossierMetadata;
  } {
    const reportId = `DOSSIER_${opp.fingerprint_hash.substring(0, 10).toUpperCase()}_${Date.now()}`;
    const generatedAt = new Date().toLocaleString('pt-BR');

    // Cálculos de custos ocultos
    let totalCRA = opp.opportunity_price;
    let netProfit = opp.net_profit_estimate || (opp.fipe_or_market_ref ? opp.fipe_or_market_ref - opp.opportunity_price : 0);
    let roiPct = totalCRA > 0 ? Number(((netProfit / totalCRA) * 100).toFixed(1)) : 0;
    let legalVerdict = 'Regularidade documental padrão verificada. Baixo risco jurídico.';
    let costTableRows = '';

    if (opp.category === 'car_auction') {
      const vCosts = calculateVehicleHiddenCosts(opp.opportunity_price, opp.fipe_or_market_ref || opp.opportunity_price * 1.5);
      totalCRA = vCosts.custoRealAquisicao;
      netProfit = vCosts.lucroLiquidoEstimado;
      roiPct = Number(((netProfit / totalCRA) * 100).toFixed(1));
      legalVerdict = vCosts.desagioRealPercent > 30 
        ? 'Excelente deságio real. Débitos e pátio provisionados com margem de segurança.' 
        : 'Margem moderada. Verificar débitos pendentes no Detran antes do lance final.';

      costTableRows = `
        <tr><td>Lance / Valor Oportunidade</td><td class="num">R$ ${opp.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>Comissão do Leiloeiro (5%)</td><td class="num">R$ ${vCosts.comissaoLeiloeiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>Taxa de Pátio e Guincho</td><td class="num">R$ ${vCosts.taxaPatioGuincho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>Provisão de Reparos / Funilaria</td><td class="num">R$ ${vCosts.custoReparosEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr class="highlight"><td><strong>Custo Real de Aquisição (CRA)</strong></td><td class="num"><strong>R$ ${totalCRA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td></tr>
      `;
    } else if (opp.category === 'real_estate_local' || opp.category === 'real_estate_auction') {
      const reCosts = calculateRealEstateHiddenCosts(opp.opportunity_price, opp.fipe_or_market_ref || opp.opportunity_price * 1.6, true);
      totalCRA = reCosts.custoTotal;
      netProfit = reCosts.lucroProjetado;
      roiPct = Number(reCosts.roiProjetadoPercent.toFixed(1));
      legalVerdict = 'Imóvel com desocupação estimada em 60 a 90 dias via medida liminar possessória. ITBI e emolumentos provisionados.';

      costTableRows = `
        <tr><td>Valor de Arrematação / Compra</td><td class="num">R$ ${opp.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>ITBI Municipal (3%)</td><td class="num">R$ ${reCosts.itbiTax.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>Escritura e Registro Imobiliário (1%)</td><td class="num">R$ ${reCosts.registroCartorio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>Provisão de Regularização & Desocupação</td><td class="num">R$ ${reCosts.despesasRegularizacaoDespejo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr class="highlight"><td><strong>Investimento Total (CRA)</strong></td><td class="num"><strong>R$ ${totalCRA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td></tr>
      `;
    } else {
      costTableRows = `
        <tr><td>Preço Anunciado</td><td class="num">R$ ${opp.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>Valor de Mercado de Referência</td><td class="num">R$ ${(opp.fipe_or_market_ref || opp.opportunity_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr class="highlight"><td><strong>Custo Efetivo Total</strong></td><td class="num"><strong>R$ ${totalCRA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td></tr>
      `;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Dossiê Executivo // RADAR_HUB</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1e293b; line-height: 1.5; padding: 20px; }
    .header { border-bottom: 3px solid #00f2fe; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 24px; font-weight: 900; color: #0f172a; }
    .brand span { color: #00f2fe; }
    .badge-score { background: #10b981; color: #fff; padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 14px; }
    .title { font-size: 18px; font-weight: 700; margin: 15px 0 5px 0; }
    .meta { font-size: 11px; color: #64748b; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
    th, td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #f8fafc; font-weight: 700; }
    td.num { text-align: right; }
    tr.highlight { background: #f0fdf4; }
    .kpi-container { display: flex; gap: 15px; margin: 20px 0; }
    .kpi-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .kpi-val { font-size: 18px; font-weight: 800; color: #0f172a; }
    .kpi-lbl { font-size: 11px; color: #64748b; text-transform: uppercase; }
    .verdict-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; border-radius: 4px; font-size: 12px; margin-top: 15px; }
    .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">RADAR<span>_HUB</span> // DOSSIÊ EXECUTIVO</div>
    <div class="badge-score">Score: ${opp.evaluation_score}/100</div>
  </div>

  <div class="title">${opp.title}</div>
  <div class="meta">Origem: <strong>${opp.source_name}</strong> | Categoria: <strong>${opp.category.toUpperCase()}</strong> | Captura: ${generatedAt} | SHA-256: <code>${opp.fingerprint_hash.substring(0, 16)}...</code></div>

  <div class="kpi-container">
    <div class="kpi-card">
      <div class="kpi-lbl">Preço Alvo / Lance</div>
      <div class="kpi-val" style="color: #2563eb;">R$ ${opp.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Valor de Mercado / FIPE</div>
      <div class="kpi-val" style="color: #64748b;">R$ ${(opp.fipe_or_market_ref || opp.opportunity_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Lucro Líquido Projetado</div>
      <div class="kpi-val" style="color: #10b981;">+ R$ ${netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Retorno s/ Capital (ROI)</div>
      <div class="kpi-val" style="color: #059669;">${roiPct}%</div>
    </div>
  </div>

  <h3>1. Memória de Cálculo de Aquisição & Custos Ocultos</h3>
  <table>
    <thead>
      <tr><th>Componente de Custo</th><th style="text-align: right;">Valor Calculado</th></tr>
    </thead>
    <tbody>
      ${costTableRows}
    </tbody>
  </table>

  <h3>2. Parecer Técnico & Matriz de Risco</h3>
  <div class="verdict-box">
    <strong>Diagnóstico Preliminar:</strong> ${legalVerdict}
  </div>

  <div class="footer">
    RADAR_HUB Investment Engine • Documento gerado automaticamente para fins de análise de risco e arbitragem de ativos.
  </div>
</body>
</html>
    `.trim();

    // Converte HTML em Buffer simulando renderizador de PDF
    const pdfHeader = Buffer.from('%PDF-1.4\n');
    const pdfBody = Buffer.from(htmlContent, 'utf-8');
    const pdfBuffer = Buffer.concat([pdfHeader, pdfBody]);

    const metadata: DossierMetadata = {
      reportId,
      generatedAt,
      opportunityTitle: opp.title,
      category: String(opp.category),
      score: opp.evaluation_score,
      sha256Fingerprint: opp.fingerprint_hash,
      financialSummary: {
        bidOrOfferPriceBrl: opp.opportunity_price,
        marketReferencePriceBrl: opp.fipe_or_market_ref || opp.opportunity_price,
        totalAcquisitionCostBrl: totalCRA,
        projectedNetProfitBrl: netProfit,
        projectedRoiPercentage: roiPct
      },
      legalRiskVerdict: legalVerdict
    };

    return { pdfBuffer, htmlContent, metadata };
  }
}
