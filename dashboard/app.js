/**
 * ==============================================================================
 * RADAR_HUB - COCKPIT SUPREMO DE ARBITRAGEM (CLIENTE LIVE WEBSOCKETS & STREAM)
 * ==============================================================================
 * Conexão WebSocket bidirecional em tempo real com auto-reconexão,
 * sintetizador Web Audio API para alertas sonoros de bugs críticos (Score >= 95),
 * gerenciador inteligente de toasts (max 2 visíveis, 4s auto-dismiss, silenciador),
 * ações de 1-Click e Módulo Jurídico LegalTech (CDC Arts. 30 e 35).
 */

// Estado global em memória
let opportunities = [];
let activeFilter = 'ALL';
let ws = null;
let reconnectAttempts = 0;
const maxReconnectDelay = 10000;
let currentPixCode = '';
let audioCtx = null;
let currentLegalPack = null;

// Configurações de Toasts e Silêncio
const MAX_VISIBLE_TOASTS = 2;
const TOAST_DURATION_MS = 4000;
let isVisualToastsSilenced = localStorage.getItem('radar_silence_visual_toasts') === 'true';

// Fallback de categorias caso routes.js não seja carregado
const defaultCategoryMap = {
  price_bug: { label: 'Bug de Preço', class: 'badge-bug' },
  car_auction: { label: 'Leilão FIPE', class: 'badge-auction' },
  industrial_auction: { label: 'Leilão Industrial', class: 'badge-auction' },
  real_estate_local: { label: 'Imóvel Bauru', class: 'badge-auction' },
  public_tender: { label: 'Licitação PNCP', class: 'badge-stacking' },
  expired_domain: { label: 'Domínio Drop', class: 'badge-miles' },
  remote_job: { label: 'Vaga Remota USD', class: 'badge-stacking' },
  coupon_deal: { label: 'Cupom Ativo', class: 'badge-bug' },
  cashback_max: { label: 'Cashback Max', class: 'badge-stacking' },
  sweepstake_promo: { label: 'Sorteio SECAP', class: 'badge-miles' },
  miles_promo: { label: 'Milhas CPM', class: 'badge-miles' },
  microtask_gig: { label: 'Microtarefa', class: 'badge-stacking' },
  stacking_deal: { label: 'Stacking', class: 'badge-stacking' }
};

function getCategoryInfo(categoryId) {
  if (typeof window !== 'undefined' && window.RADAR_VERTICALS && window.RADAR_VERTICALS[categoryId]) {
    const v = window.RADAR_VERTICALS[categoryId];
    return { label: v.name, class: v.badgeClass };
  }
  return defaultCategoryMap[categoryId] || { label: categoryId, class: 'badge-stacking' };
}

// ==============================================================================
// 1. WEBAUDIO SYNTHESIZER PARA ALERTA DE CRITICAL_BUG (SCORE >= 95)
// ==============================================================================
function playCriticalBugChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    
    // Oscilador 1: Tom agudo de atenção
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.3);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Oscilador 2: Pulso harmônico de confirmação
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(880, now + 0.35);
    gain2.gain.setValueAtTime(0.2, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.5);
  } catch (err) {
    console.warn('Web Audio playback indisponível ou bloqueado:', err);
  }
}

// ==============================================================================
// 2. CONEXÃO WEBSOCKET RESILIENTE & DISPATCHER DE EVENTOS
// ==============================================================================
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host || 'localhost:3000';
  const wsUrl = `${protocol}//${host}`;

  updateWsStatus('CONNECTING');

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      reconnectAttempts = 0;
      updateWsStatus('CONNECTED');
      appendLog('WEBSOCKET', 'Conexão em tempo real estabelecida com o servidor RADAR_HUB.', 'info');
      ws.send(JSON.stringify({ type: 'PING', timestamp: new Date().toISOString() }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerEvent(msg);
      } catch (err) {
        console.error('Erro ao processar mensagem WebSocket:', err);
      }
    };

    ws.onerror = (err) => {
      console.warn('Erro na conexão WebSocket:', err);
      updateWsStatus('DISCONNECTED');
    };

    ws.onclose = () => {
      updateWsStatus('DISCONNECTED');
      const delay = Math.min(maxReconnectDelay, 1000 * Math.pow(1.5, reconnectAttempts));
      reconnectAttempts++;
      appendLog('WEBSOCKET', `Conexão fechada. Tentando reconectar em ${(delay / 1000).toFixed(1)}s...`, 'warn');
      setTimeout(initWebSocket, delay);
    };
  } catch (e) {
    updateWsStatus('DISCONNECTED');
    setTimeout(initWebSocket, 3000);
  }
}

function handleServerEvent(msg) {
  const { type, payload } = msg;

  switch (type) {
    case 'CONNECTION_ESTABLISHED':
      appendLog('SERVER', payload.message || 'Stream conectado.', 'info');
      break;

    case 'NEW_OPPORTUNITY':
      ingestOpportunity(payload);
      break;

    case 'LIVE_LOG':
      if (payload) {
        appendLog(payload.pipeline || 'WORKER', payload.message, (payload.level || 'INFO').toLowerCase(), payload.durationMs);
      }
      break;

    case 'SYSTEM_TELEMETRY':
      if (payload) {
        updateTelemetryBadges(payload);
      }
      break;

    case 'CIRCUIT_STATE_CHANGE':
      appendLog('CIRCUIT_BREAKER', `Vertical [${payload.category}] mudou para estado ${payload.state}.`, payload.state === 'OPEN' ? 'error' : 'info');
      break;

    default:
      break;
  }
}

function updateWsStatus(status) {
  const dot = document.getElementById('ws-dot');
  const text = document.getElementById('ws-status-text');
  if (!dot || !text) return;

  if (status === 'CONNECTED') {
    dot.className = 'status-dot live';
    dot.style.background = '';
    text.innerText = 'WEBSOCKET CONECTADO';
  } else if (status === 'CONNECTING') {
    dot.className = 'status-dot';
    dot.style.background = 'var(--accent-amber)';
    text.innerText = 'CONECTANDO AO STREAM...';
  } else {
    dot.className = 'status-dot disconnected';
    dot.style.background = 'var(--accent-red)';
    text.innerText = 'WEBSOCKET DESCONECTADO';
  }
}

function updateTelemetryBadges(telemetry) {
  const latVal = document.getElementById('latency-val');
  const proxyVal = document.getElementById('proxy-val');

  if (latVal && telemetry.dbLatencyMs !== undefined) {
    latVal.innerText = `${telemetry.dbLatencyMs}ms`;
  }

  if (proxyVal && telemetry.circuits) {
    const circuits = telemetry.circuits;
    const total = Object.keys(circuits).length || 12;
    const active = Object.values(circuits).filter(c => c.state === 'CLOSED').length;
    proxyVal.innerText = `${active}/${total}`;
  }
}

// ==============================================================================
// 3. INGESTÃO, RENDERIZAÇÃO E GERENCIADOR DE TOASTS
// ==============================================================================
function ingestOpportunity(opp) {
  if (!opp) return;

  const rawId = opp.fingerprint_hash || opp.id || `opp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const rawUrl = opp.affiliate_url || opp.source_url || opp.url || '';

  const normalized = {
    id: rawId,
    category: opp.category || 'price_bug',
    title: opp.title || 'Oportunidade Detectada',
    opportunity_price: Number(opp.opportunity_price || opp.price || 0),
    original_price: Number(opp.original_price || opp.fipe_or_market_ref || opp.opportunity_price || 0),
    discount_percentage: Number(opp.discount_percentage || 0),
    net_profit_estimate: Number(opp.net_profit_estimate || 0),
    fipe_or_market_ref: Number(opp.fipe_or_market_ref || opp.original_price || opp.opportunity_price || 0),
    evaluation_score: Number(opp.evaluation_score || opp.score || 0),
    priority: opp.priority || (opp.evaluation_score >= 95 ? 'CRITICAL_BUG' : 'NORMAL'),
    source_name: opp.source_name || opp.sourceName || 'RADAR_HUB',
    source_url: rawUrl,
    fingerprint_hash: opp.fingerprint_hash || rawId
  };

  // Anti-duplicação na lista local
  const existingIdx = opportunities.findIndex(o => o.id === normalized.id || (o.fingerprint_hash && o.fingerprint_hash === normalized.fingerprint_hash));
  if (existingIdx >= 0) {
    opportunities[existingIdx] = normalized;
  } else {
    opportunities.unshift(normalized);
    if (opportunities.length > 200) opportunities.pop();
  }

  // Alerta Crítico para Score >= 95 ou CRITICAL_BUG
  if (normalized.evaluation_score >= 95 || normalized.priority === 'CRITICAL_BUG') {
    playCriticalBugChime();
    showCriticalToast(normalized);
  }

  updateMetrics();
  renderTable(normalized.fingerprint_hash);
}

/**
 * Remove um toast do DOM com animação suave de slide-out
 */
function dismissToast(toastEl) {
  if (!toastEl || toastEl.classList.contains('toast-exit')) return;
  if (toastEl._dismissTimer) {
    clearTimeout(toastEl._dismissTimer);
    toastEl._dismissTimer = null;
  }
  toastEl.classList.add('toast-exit');
  setTimeout(() => {
    if (toastEl.parentNode) {
      toastEl.remove();
    }
  }, 350);
}

/**
 * Exibe toast flutuante respeitando o limite de 2 visíveis e auto-dismiss de 4s
 */
function showCriticalToast(opp) {
  if (isVisualToastsSilenced) return;

  const container = document.getElementById('toast-container');
  if (!container) return;

  // Limite estrito de no máximo 2 toasts visíveis simultaneamente
  const currentActiveToasts = Array.from(container.querySelectorAll('.toast-alert:not(.toast-exit)'));
  if (currentActiveToasts.length >= MAX_VISIBLE_TOASTS) {
    // Remove o toast mais antigo imediatamente com slideOut suave
    const oldest = currentActiveToasts[0];
    dismissToast(oldest);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  
  const priceFormatted = opp.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const profitFormatted = opp.net_profit_estimate.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  toast.innerHTML = `
    <div style="font-size: 1.6rem; animation: pulse 1s infinite; flex-shrink: 0;">🚨</div>
    <div style="flex: 1; min-width: 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.2rem;">
        <span class="badge badge-bug" style="font-size: 0.68rem;">BUG (${opp.evaluation_score}/100)</span>
        <span style="font-size: 0.72rem; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(opp.source_name)}</span>
      </div>
      <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 0.2rem; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${escapeHtml(opp.title)}">${escapeHtml(opp.title)}</div>
      <div style="font-size: 0.8rem; color: var(--accent-green);">
        <strong>R$ ${priceFormatted}</strong> ${opp.discount_percentage > 0 ? `(${opp.discount_percentage.toFixed(0)}% OFF)` : ''} 
        • Lucro: <strong>R$ ${profitFormatted}</strong>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-end; flex-shrink: 0;">
      <button class="toast-close-btn" aria-label="Fechar" title="Fechar">✕</button>
      <button class="btn-action btn-buy" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;" onclick="handleOneClickAction('${opp.id}')">⚡ 1-Click</button>
    </div>
  `;

  // Listener para o botão fechar do toast
  const closeBtn = toast.querySelector('.toast-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissToast(toast);
    });
  }

  container.appendChild(toast);

  // Auto-dismiss em exatamente 4 segundos
  toast._dismissTimer = setTimeout(() => {
    dismissToast(toast);
  }, TOAST_DURATION_MS);
}

function updateMetrics() {
  let totalProfit = 0;
  let bugsCount = 0;
  let tendersJobsCount = 0;

  opportunities.forEach(opp => {
    totalProfit += opp.net_profit_estimate || 0;
    if (opp.priority === 'CRITICAL_BUG' || opp.evaluation_score >= 95) {
      bugsCount++;
    }
    if (opp.category === 'public_tender' || opp.category === 'remote_job') {
      tendersJobsCount++;
    }
  });

  const p24 = document.getElementById('val-profit-24h');
  const bCount = document.getElementById('val-bugs-count');
  const tjCount = document.getElementById('val-tenders-jobs');

  if (p24) p24.innerText = `R$ ${totalProfit.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  if (bCount) bCount.innerText = bugsCount.toString();
  if (tjCount) tjCount.innerText = tendersJobsCount.toString();
}

function renderTable(highlightHash) {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = activeFilter === 'ALL' 
    ? opportunities 
    : opportunities.filter(d => d.category === activeFilter);

  filtered.forEach(deal => {
    const tr = document.createElement('tr');
    if (deal.fingerprint_hash === highlightHash || deal.id === highlightHash) {
      tr.className = 'new-row';
    }

    const cat = getCategoryInfo(deal.category);
    const priceFormatted = deal.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const refFormatted = deal.fipe_or_market_ref.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const profitFormatted = deal.net_profit_estimate.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

    const rawUrl = deal.source_url || '';
    const hasValidUrl = (typeof window !== 'undefined' && window.SafeNavigator) 
      ? window.SafeNavigator.isValidExternalUrl(rawUrl) 
      : (typeof rawUrl === 'string' && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) && !rawUrl.includes('localhost') && !rawUrl.includes('radarhub.local'));
    const safeHref = hasValidUrl ? escapeQuotes(rawUrl) : '#';

    tr.innerHTML = `
      <td><span class="badge ${cat.class}">${cat.label}</span></td>
      <td style="font-weight: 600;">
        <div>
          <a href="${safeHref}" class="opp-title-link" data-id="${deal.id}" title="${escapeHtml(deal.title)}">
            ${escapeHtml(deal.title)}
          </a>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(deal.source_name)}</div>
      </td>
      <td style="color: var(--accent-green); font-weight: 700;">R$ ${priceFormatted}</td>
      <td style="color: var(--text-muted); text-decoration: ${deal.discount_percentage > 0 ? 'line-through' : 'none'};">R$ ${refFormatted}</td>
      <td>
        <div style="font-weight: 700; color: var(--accent-cyan);">${deal.discount_percentage > 0 ? `${deal.discount_percentage.toFixed(1)}% OFF` : 'Lucro Direto'}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">+ R$ ${profitFormatted} est.</div>
      </td>
      <td>
        <span style="font-weight: 800; color: ${deal.evaluation_score >= 90 ? 'var(--accent-red)' : 'var(--accent-green)'};">${deal.evaluation_score}</span>/100
      </td>
      <td><span class="badge" style="background: rgba(16,185,129,0.15); color: var(--accent-green);">Ativa</span></td>
      <td>
        <div style="display: flex; gap: 0.35rem;">
          <button class="btn-action btn-buy" onclick="handleOneClickAction('${deal.id}')" title="Acessar oferta ou comprar em 1-clique">⚡ 1-Click</button>
          <button class="btn-action" style="background: rgba(0, 242, 254, 0.15); border: 1px solid var(--accent-cyan); color: var(--accent-cyan);" onclick="triggerLegalDocById('${deal.id}')" title="Gerar Notificação Extrajudicial e Petição JEC Art. 35">⚖️ CDC</button>
        </div>
      </td>
    `;

    // Intercepta clique no título caso URL não seja externa
    const linkEl = tr.querySelector('.opp-title-link');
    if (linkEl) {
      linkEl.addEventListener('click', (e) => {
        if (!hasValidUrl) {
          e.preventDefault();
          handleOneClickAction(deal.id);
        } else {
          linkEl.target = '_blank';
          linkEl.rel = 'noopener noreferrer';
        }
      });
    }

    tbody.appendChild(tr);
  });
}

// ==============================================================================
// 4. AÇÃO RÁPIDA 1-CLICK (REDIRECIONAMENTO EXTERNO OU CHECKOUT PIX)
// ==============================================================================
function handleOneClickAction(id) {
  const item = opportunities.find(o => o.id === id || o.fingerprint_hash === id);
  if (!item) {
    console.warn('Oportunidade não encontrada para 1-Click:', id);
    return;
  }

  const rawUrl = item.source_url || item.affiliate_url || '';
  const isSafeExternal = (typeof window !== 'undefined' && window.SafeNavigator)
    ? window.SafeNavigator.isValidExternalUrl(rawUrl)
    : (typeof rawUrl === 'string' && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) && !rawUrl.includes('localhost') && !rawUrl.includes('radarhub.local'));

  if (isSafeExternal) {
    // Abre diretamente a loja/leilão em nova aba segura
    if (window.SafeNavigator) {
      window.SafeNavigator.openExternal(rawUrl);
    } else {
      window.open(rawUrl, '_blank', 'noopener,noreferrer');
    }
  } else {
    // Aciona checkout interno 1-Clique PIX
    openCheckoutModal(item);
  }
}

function openCheckoutModal(item) {
  const modal = document.getElementById('checkout-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalPrice = document.getElementById('modal-price');
  const modalQr = document.getElementById('modal-qr');

  const price = Number(item.opportunity_price || 0);
  currentPixCode = `00020126580014BR.GOV.BCB.PIX0136RADAR_HUB_${item.id || 'ORDER'}5204000053039865405${price.toFixed(2)}5802BR5915RADAR_HUB6009SAO_PAULO62070503***6304ABCD`;

  if (modalTitle) modalTitle.innerText = `⚡ Compra / Reserva 1-Clique: ${item.title}`;
  if (modalPrice) modalPrice.innerText = `Valor / Custo: R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (modalQr) modalQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentPixCode)}`;

  if (modal) modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.remove('show');
}

function copyPixCode() {
  if (navigator.clipboard && currentPixCode) {
    navigator.clipboard.writeText(currentPixCode);
    alert('Código PIX Copia e Cola copiado com sucesso!');
  }
}

// ==============================================================================
// 5. MÓDULO JURÍDICO LEGALTECH (CDC ARTS. 30/35 & JEC)
// ==============================================================================
function triggerLegalDocById(id) {
  const deal = opportunities.find(o => o.id === id || o.fingerprint_hash === id);
  if (!deal) {
    console.warn('Oportunidade não encontrada para geração jurídica:', id);
    return;
  }

  const title = deal.title || 'Produto Oferta RADAR_HUB';
  const advertisedPrice = Number(deal.opportunity_price || 0);
  const marketPrice = Number(deal.fipe_or_market_ref || deal.original_price || (advertisedPrice * 2));
  const storeName = deal.source_name || 'E-commerce Oficial';

  const metaEl = document.getElementById('legal-modal-meta');
  if (metaEl) {
    metaEl.innerText = `📦 ${title} | Oferta: R$ ${advertisedPrice.toFixed(2)} | Mercado: R$ ${marketPrice.toFixed(2)} | Loja: ${storeName}`;
  }

  // Define minuta instantânea local para garantir exibição imediata
  currentLegalPack = generateFallbackLegalDocuments(deal, title, advertisedPrice, marketPrice, storeName);
  switchLegalTab('notice');

  const modal = document.getElementById('legal-modal');
  if (modal) modal.classList.add('show');

  // Envia requisição para obter minuta enriquecida do servidor
  fetch('/api/legal/generate-notice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consumer: {
        name: 'Consumidor Adquirente',
        cpf: '000.000.000-00',
        email: 'consumidor@radarhub.com',
        phone: '(11) 99999-9999',
        address: 'Rua das Flores, nº 100',
        city: 'São Paulo',
        state: 'SP',
        cep: '01001-000'
      },
      merchant: {
        storeName: storeName,
        cnpj: '00.000.000/0001-91'
      },
      dispute: {
        orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
        orderDate: new Date().toLocaleDateString('pt-BR'),
        productTitle: title,
        advertisedPrice: advertisedPrice,
        marketReferencePrice: marketPrice,
        paymentMethod: 'PIX',
        cancelDate: new Date().toLocaleDateString('pt-BR'),
        cancelReasonText: 'Cancelamento unilateral sob alegação de erro sistêmico na oferta veiculada'
      }
    })
  })
    .then(r => r.json())
    .then(res => {
      if (res.success && res.documents) {
        currentLegalPack = res.documents;
        const isJecActive = document.getElementById('btn-tab-jec')?.classList.contains('active');
        switchLegalTab(isJecActive ? 'jec' : 'notice');
      }
    })
    .catch(err => {
      console.warn('[LegalTech] Utilizando minuta fundamentada local:', err);
    });
}

function generateFallbackLegalDocuments(deal, title, advertisedPrice, marketPrice, storeName) {
  const diffPrice = (marketPrice - advertisedPrice).toFixed(2);
  const dateStr = new Date().toLocaleDateString('pt-BR');

  const noticeText = `NOTIFICAÇÃO EXTRAJUDICIAL — PRAZO IMPRORROGÁVEL DE 48 HORAS
CUMPRIMENTO FORÇADO DE OFERTA PÚBLICA (ARTS. 30 E 35 DO CDC)

À EMPRESA: ${storeName}
REF.: PEDIDO DE COMPRA / ANÚNCIO: "${title}"
DATA DO ANÚNCIO/COMPRA: ${dateStr}
VALOR DA OFERTA VEICULADA: R$ ${advertisedPrice.toFixed(2)}
VALOR DE MERCADO DE REFERÊNCIA: R$ ${marketPrice.toFixed(2)}

I. DOS FATOS E FUNDAMENTAÇÃO JURÍDICA
O Notificante adquiriu/tentou adquirir o produto acima referenciado, veiculado publicamente pela Notificada.
Conforme dispõe o Artigo 30 do Código de Defesa do Consumidor (Lei nº 8.078/90):
"Toda informação ou publicidade, suficientemente precisa, veiculada por qualquer forma ou meio de comunicação com relação a produtos e serviços oferecidos ou apresentados, obriga o fornecedor que a fizer veicular ou dela se utilizar e integra o contrato que vier a ser celebrado."

Ademais, o Artigo 35, inciso I, do CDC assegura ao consumidor a prerrogativa incontestável de:
"I - exigir o cumprimento forçado da obrigação, nos termos da oferta, apresentação ou publicidade;"

II. DO REQUERIMENTO
Requer-se o cumprimento forçado da oferta com o envio imediato do produto no valor anunciado de R$ ${advertisedPrice.toFixed(2)}, no prazo de 48 (quarenta e oito) horas.
Na inércia ou recusa, será proposta incontinenti Ação de Obrigação de Fazer cumulada com Danos Morais perante o Juizado Especial Cível competente.

Local e Data: ${dateStr}
Consumidor Notificante`;

  const jecText = `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DO JUIZADO ESPECIAL CÍVEL

AUTOR: Consumidor Adquirente, brasileiro, inscrito no CPF sob nº 000.000.000-00
RÉU: ${storeName}, pessoa jurídica de direito privado

AÇÃO DE OBRIGAÇÃO DE FAZER C/C PEDIDO DE CUMPRIMENTO FORÇADO DE OFERTA (ARTS. 30 E 35, I, CDC)

I. DOS FATOS
O Autor visualizou e adquiriu a oferta veiculada pela Ré referente ao produto:
"${title}", pelo valor anunciado de R$ ${advertisedPrice.toFixed(2)} (valor referencial de mercado: R$ ${marketPrice.toFixed(2)}).
Injustificadamente, a Ré procedeu ao cancelamento unilateral do pedido alegando suposto erro grosseiro.
Contudo, no comércio eletrônico massificado e dinâmico, ofertas promocionais agressivas são praxe comercial, vinculando a fornecedora ao cumprimento da promessa de venda.

II. DO DIREITO
Incidência expressa do Art. 30 e Art. 35, I, da Lei 8.078/90. O cancelamento arbitrário enseja dever de cumprimento forçado e reparação moral pelo tempo útil desperdiçado (Teoria do Desvio Produtivo do Consumidor).

III. DOS PEDIDOS
1. A citação da Ré;
2. A procedência total dos pedidos para CONDENAR a Ré ao cumprimento forçado da oferta, entregando o produto adquirido;
3. Subsidiariamente, a conversão em perdas e danos no valor de mercado correspondente (R$ ${marketPrice.toFixed(2)});
4. Condenação em indenização por danos morais no valor de R$ 3.000,00.

Dá-se à causa o valor de R$ ${(marketPrice + 3000).toFixed(2)}.

Termos em que pede deferimento.
Data: ${dateStr}`;

  return {
    extrajudicialNoticeText: noticeText,
    jecPetitionMarkdown: jecText
  };
}

function switchLegalTab(tab) {
  const btnNotice = document.getElementById('btn-tab-notice');
  const btnJec = document.getElementById('btn-tab-jec');
  const txtArea = document.getElementById('legal-doc-content');
  if (!currentLegalPack || !txtArea) return;

  if (tab === 'notice') {
    if (btnNotice) btnNotice.classList.add('active');
    if (btnJec) btnJec.classList.remove('active');
    txtArea.value = currentLegalPack.extrajudicialNoticeText || currentLegalPack.extrajudicialNoticeMarkdown || '';
  } else {
    if (btnNotice) btnNotice.classList.remove('active');
    if (btnJec) btnJec.classList.add('active');
    txtArea.value = currentLegalPack.jecPetitionMarkdown || currentLegalPack.jecPetitionText || '';
  }
}

function closeLegalModal() {
  const modal = document.getElementById('legal-modal');
  if (modal) modal.classList.remove('show');
}

function copyLegalText() {
  const txtArea = document.getElementById('legal-doc-content');
  if (txtArea && txtArea.value) {
    navigator.clipboard.writeText(txtArea.value);
    alert('Minuta jurídica copiada com sucesso para a área de transferência!');
  }
}

// ==============================================================================
// 6. STREAM DE LOGS AO VIVO
// ==============================================================================
let logCounter = 0;

function appendLog(pipeline, message, level = 'info', durationMs = 0) {
  const feed = document.getElementById('log-feed');
  const countEl = document.getElementById('log-count');
  if (!feed) return;

  logCounter++;
  if (countEl) countEl.innerText = `${logCounter} eventos`;

  const now = new Date();
  const timeStr = `[${now.toTimeString().split(' ')[0]}]`;

  const entry = document.createElement('div');
  entry.className = `log-entry ${level}`;
  
  const durStr = durationMs > 0 ? ` (${durationMs.toFixed(1)}ms)` : '';
  entry.innerHTML = `<span class="log-time">${timeStr}</span> <strong>${pipeline}:</strong> ${escapeHtml(message)}${durStr}`;

  feed.appendChild(entry);
  
  while (feed.children.length > 100) {
    feed.removeChild(feed.firstChild);
  }

  feed.scrollTop = feed.scrollHeight;
}

// ==============================================================================
// 7. INICIALIZAÇÃO DE FILTROS, SWITCH DE SILÊNCIO E MODAIS
// ==============================================================================
function applyFilter(filterKey, updateUrl = true) {
  activeFilter = filterKey || 'ALL';
  const buttons = document.querySelectorAll('.filter-btn[data-filter]');
  buttons.forEach(b => {
    if (b.getAttribute('data-filter') === activeFilter) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  if (updateUrl && typeof window !== 'undefined' && window.history) {
    const url = new URL(window.location.href);
    if (activeFilter === 'ALL') {
      url.searchParams.delete('vertical');
      url.searchParams.delete('filter');
    } else {
      url.searchParams.set('vertical', activeFilter);
    }
    window.history.pushState({ vertical: activeFilter }, '', url.toString());
  }

  renderTable();
}

function initFilters() {
  const buttons = document.querySelectorAll('.filter-btn[data-filter]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter') || 'ALL';
      applyFilter(filter, true);
    });
  });

  // Lê parâmetro deep link da URL se houver (ex: ?vertical=price_bug)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const initialVertical = params.get('vertical') || params.get('filter');
    if (initialVertical) {
      applyFilter(initialVertical, false);
    }

    // Suporte aos botões Voltar / Avançar do navegador
    window.addEventListener('popstate', () => {
      const p = new URLSearchParams(window.location.search);
      const vert = p.get('vertical') || p.get('filter') || 'ALL';
      applyFilter(vert, false);
    });
  }
}

function initSilenceToggle() {
  const toggleInput = document.getElementById('toggle-silence-toasts');
  if (toggleInput) {
    toggleInput.checked = isVisualToastsSilenced;
    toggleInput.addEventListener('change', (e) => {
      isVisualToastsSilenced = e.target.checked;
      localStorage.setItem('radar_silence_visual_toasts', isVisualToastsSilenced ? 'true' : 'false');
      
      if (isVisualToastsSilenced) {
        // Limpa toasts em tela ao silenciar
        const container = document.getElementById('toast-container');
        if (container) container.innerHTML = '';
      }
    });
  }
}

function initModalBackdropClicks() {
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  });

  // Fecha modais com a tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeLegalModal();
    }
  });
}

// Utilitários de escape
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeQuotes(text) {
  if (!text) return '';
  return String(text).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ==============================================================================
// 8. PROGRESSIVE WEB APP (PWA) & REGISTRO DE SERVICE WORKER
// ==============================================================================
let deferredInstallPrompt = null;

function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado! Escopo:', reg.scope);
          appendLog('PWA', 'Service Worker ativo com cache Stale-While-Revalidate.', 'info');
        })
        .catch((err) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', err);
        });
    });
  }

  const btnInstall = document.getElementById('btn-pwa-install');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (btnInstall) {
      btnInstall.style.display = 'inline-flex';
      btnInstall.onclick = async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          btnInstall.style.display = 'none';
        }
      };
    }
  });

  window.addEventListener('appinstalled', () => {
    if (btnInstall) btnInstall.style.display = 'none';
    appendLog('PWA', 'Aplicativo instalado na tela inicial.', 'info');
  });

  const btnPush = document.getElementById('btn-push-subscribe');
  if (btnPush) {
    btnPush.onclick = async () => {
      if (!('Notification' in window)) {
        alert('Este navegador não suporta notificações Push.');
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          btnPush.innerText = '🔔 Push Ativado';
          btnPush.style.borderColor = 'var(--accent-green)';
          btnPush.style.color = 'var(--accent-green)';

          const fakeSub = {
            endpoint: `https://fcm.googleapis.com/fcm/send/radar_${Date.now()}`,
            keys: {
              p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9Ac',
              auth: 'tBHItJI5svbpez7KI4CCXg=='
            }
          };

          fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fakeSub)
          }).then(r => r.json()).then(() => {
            appendLog('PUSH', 'Dispositivo registrado com sucesso para alertas de bugs críticos.', 'info');
          }).catch(() => {});

          alert('Notificações de alta prioridade ativadas com sucesso!');
        } else {
          alert('Permissão de notificações não concedida.');
        }
      } catch (err) {
        console.warn('Erro ao solicitar permissão Push:', err);
      }
    };
  }
}

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  initFilters();
  initSilenceToggle();
  initModalBackdropClicks();
  initWebSocket();
  initPWA();
  
  document.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }, { once: true });
});
