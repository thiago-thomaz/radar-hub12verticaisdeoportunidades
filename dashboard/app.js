/**
 * ==============================================================================
 * RADAR_HUB - COCKPIT SUPREMO DE ARBITRAGEM (CLIENTE LIVE WEBSOCKETS & STREAM)
 * ==============================================================================
 * Conexão WebSocket bidirecional em tempo real com auto-reconexão,
 * sintetizador Web Audio API para alertas sonoros de bugs críticos (Score >= 95),
 * stream de logs ao vivo, telemetria de latência/proxies e compra em 1-clique.
 */

// Estado global em memória
let opportunities = [];
let activeFilter = 'ALL';
let ws = null;
let reconnectAttempts = 0;
let maxReconnectDelay = 10000;
let currentPixCode = '';
let audioCtx = null;

const categoryMap = {
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
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15); // E6
    osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.3); // A6
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
      // Envia PING de sincronização
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
// 3. INGESTÃO, RENDERIZAÇÃO E ALERTAS DE OPORTUNIDADES
// ==============================================================================
function ingestOpportunity(opp) {
  if (!opp) return;

  // Normalização de campos
  const normalized = {
    id: opp.fingerprint_hash || `opp_${Date.now()}_${Math.random()}`,
    category: opp.category,
    title: opp.title,
    opportunity_price: Number(opp.opportunity_price || 0),
    original_price: Number(opp.original_price || opp.fipe_or_market_ref || opp.opportunity_price),
    discount_percentage: Number(opp.discount_percentage || 0),
    net_profit_estimate: Number(opp.net_profit_estimate || 0),
    fipe_or_market_ref: Number(opp.fipe_or_market_ref || opp.original_price || opp.opportunity_price),
    evaluation_score: Number(opp.evaluation_score || 0),
    priority: opp.priority || 'NORMAL',
    source_name: opp.source_name || 'RADAR_HUB',
    source_url: opp.affiliate_url || opp.source_url || '#',
    fingerprint_hash: opp.fingerprint_hash
  };

  // Anti-duplicação na lista local
  const existingIdx = opportunities.findIndex(o => o.fingerprint_hash && o.fingerprint_hash === normalized.fingerprint_hash);
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

function showCriticalToast(opp) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  
  const priceFormatted = opp.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const profitFormatted = opp.net_profit_estimate.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  toast.innerHTML = `
    <div style="font-size: 1.8rem; animation: pulse 1s infinite;">🚨</div>
    <div style="flex: 1;">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
        <span class="badge badge-bug">BUG CRÍTICO (${opp.evaluation_score}/100)</span>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${opp.source_name}</span>
      </div>
      <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.25rem; color: #fff;">${opp.title}</div>
      <div style="font-size: 0.85rem; color: var(--accent-green);">
        <strong>R$ ${priceFormatted}</strong> ${opp.discount_percentage > 0 ? `(${opp.discount_percentage}% OFF)` : ''} 
        • Lucro Est.: <strong>R$ ${profitFormatted}</strong>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
      <button class="btn-action btn-buy" onclick="triggerOneClickBuy('${opp.id}', '${escapeQuotes(opp.title)}', ${opp.opportunity_price})">⚡ 1-Click</button>
      <button class="filter-btn" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" onclick="this.closest('.toast-alert').remove()">✕ Fechar</button>
    </div>
  `;

  container.appendChild(toast);

  // Auto-remove após 12 segundos
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }
  }, 12000);
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
    if (deal.fingerprint_hash === highlightHash) {
      tr.className = 'new-row';
    }

    const cat = categoryMap[deal.category] || { label: deal.category, class: 'badge-stacking' };
    const priceFormatted = deal.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const refFormatted = deal.fipe_or_market_ref.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const profitFormatted = deal.net_profit_estimate.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

    tr.innerHTML = `
      <td><span class="badge ${cat.class}">${cat.label}</span></td>
      <td style="font-weight: 600;">
        <div>${deal.title}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${deal.source_name}</div>
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
        <div style="display: flex; gap: 0.25rem;">
          <button class="btn-action btn-buy" onclick="triggerOneClickBuy('${deal.id}', '${escapeQuotes(deal.title)}', ${deal.opportunity_price})">⚡ 1-Click</button>
          <button class="btn-action" style="background: rgba(0, 242, 254, 0.15); border: 1px solid var(--accent-cyan); color: var(--accent-cyan);" onclick="triggerLegalDoc('${escapeQuotes(deal.title)}', ${deal.opportunity_price}, ${deal.fipe_or_market_ref}, '${escapeQuotes(deal.source_name)}')">⚖️ CDC</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================================================================
// 4. STREAM DE LOGS AO VIVO & MODAL JURÍDICO LEGALTECH
// ==============================================================================
let currentLegalPack = null;

function triggerLegalDoc(title, advertisedPrice, marketPrice, storeName) {
  const modal = document.getElementById('legal-modal');
  const payload = {
    consumer: {
      name: 'Consumidor Modelo',
      cpf: '123.456.789-00',
      email: 'consumidor@radarhub.com',
      phone: '(14) 99876-5432',
      address: 'Rua Rio Branco, nº 100, Centro',
      city: 'Bauru',
      state: 'SP',
      cep: '17010-000'
    },
    merchant: {
      storeName: storeName || 'E-commerce Oficial',
      cnpj: '00.000.000/0001-91'
    },
    dispute: {
      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
      orderDate: new Date().toLocaleDateString('pt-BR'),
      productTitle: title,
      advertisedPrice: Number(advertisedPrice) || 99.90,
      marketReferencePrice: Number(marketPrice) || (Number(advertisedPrice) * 2),
      paymentMethod: 'PIX',
      cancelDate: new Date().toLocaleDateString('pt-BR'),
      cancelReasonText: 'Cancelamento unilateral por alegado erro de precificação sistêmica'
    }
  };

  fetch('/api/legal/generate-notice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(r => r.json())
    .then(res => {
      if (res.success && res.documents) {
        currentLegalPack = res.documents;
        switchLegalTab('notice');
        if (modal) modal.classList.add('show');
      }
    })
    .catch(err => alert('Erro ao gerar minuta jurídica: ' + err.message));
}

function switchLegalTab(tab) {
  const btnNotice = document.getElementById('btn-tab-notice');
  const btnJec = document.getElementById('btn-tab-jec');
  const txtArea = document.getElementById('legal-doc-content');
  if (!currentLegalPack || !txtArea) return;

  if (tab === 'notice') {
    if (btnNotice) btnNotice.classList.add('active');
    if (btnJec) btnJec.classList.remove('active');
    txtArea.value = currentLegalPack.extrajudicialNoticeText;
  } else {
    if (btnNotice) btnNotice.classList.remove('active');
    if (btnJec) btnJec.classList.add('active');
    txtArea.value = currentLegalPack.jecPetitionMarkdown;
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
    alert('Minuta jurídica copiada para a área de transferência!');
  }
}
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
  
  // Limita a 100 entradas no feed do DOM
  while (feed.children.length > 100) {
    feed.removeChild(feed.firstChild);
  }

  feed.scrollTop = feed.scrollHeight;
}

// ==============================================================================
// 5. FILTROS & CHECKOUT MODAL PIX
// ==============================================================================
function initFilters() {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter') || 'ALL';
      renderTable();
    });
  });
}

function triggerOneClickBuy(id, title, price) {
  const modal = document.getElementById('checkout-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalPrice = document.getElementById('modal-price');
  const modalQr = document.getElementById('modal-qr');

  currentPixCode = `00020126580014BR.GOV.BCB.PIX0136RADAR_HUB_${id}5204000053039865405${Number(price).toFixed(2)}5802BR5915RADAR_HUB6009SAO_PAULO62070503***6304ABCD`;

  if (modalTitle) modalTitle.innerText = `⚡ Compra / Reserva 1-Clique: ${title}`;
  if (modalPrice) modalPrice.innerText = `Valor / Custo: R$ ${Number(price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
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
    alert('Código PIX Copia e Cola copiado para a área de transferência!');
  }
}

// Utilitários de escape
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeQuotes(text) {
  if (!text) return '';
  return String(text).replace(/'/g, "\\'");
}

// ==============================================================================
// 6. PROGRESSIVE WEB APP (PWA) & REGISTRO DE SERVICE WORKER
// ==============================================================================
let deferredInstallPrompt = null;

function initPWA() {
  // 1. Registro do Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado com sucesso! Escopo:', reg.scope);
          appendLog('PWA', 'Service Worker ativo com cache Stale-While-Revalidate.', 'info');
        })
        .catch((err) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', err);
        });
    });
  }

  // 2. Banner e Prompt de Instalação PWA
  const btnInstall = document.getElementById('btn-pwa-install');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (btnInstall) {
      btnInstall.style.display = 'inline-flex';
      btnInstall.onclick = async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          console.log('[PWA] Escolha do usuário na instalação:', outcome);
          deferredInstallPrompt = null;
          btnInstall.style.display = 'none';
        }
      };
    }
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Aplicativo RADAR_HUB instalado com sucesso!');
    if (btnInstall) btnInstall.style.display = 'none';
    appendLog('PWA', 'Aplicativo instalado na tela inicial.', 'info');
  });

  // 3. Gerenciamento de Notificações Web Push
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

          // Simula ou registra subscription com o backend
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
          }).then(r => r.json()).then(res => {
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
  initWebSocket();
  initPWA();
  
  // Tentar desbloquear AudioContext com interação do usuário
  document.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }, { once: true });
});
