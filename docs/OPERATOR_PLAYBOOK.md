# 📘 RADAR_HUB — Manual Operacional do Operador (Playbook de Arbitragem & SRE)

> **Documento de Operações e Procedimentos Padrão (SOP)**  
> **Versão:** 1.0.0 (Produção)  
> **Classificação:** Confidencial / Operação Interna

---

## 🎯 Sumário Executivo

Este Playbook estabelece os procedimentos operacionais padrão para analistas, operadores de arbitragem e engenheiros SRE do ecossistema **RADAR_HUB**. O objetivo é garantir **velocidade máxima de execução (<30s)**, **mitigação de riscos financeiros/jurídicos** e **alta disponibilidade da infraestrutura**.

---

## 1. 🚨 Protocolo para Bugs de Preço Críticos (Score >= 95 / `CRITICAL_BUG`)

### 1.1 Triagem Instantânea (< 15 segundos)
1. **Verificar Notificação**: Alertas prioritários disparados no canal VIP do Telegram ou Toast sonoro no Cockpit Web.
2. **Avaliação da Origem**:
   - **Prioridade Máxima**: Grandes varejistas (*Amazon Prime, Mercado Livre Full, Magazine Luiza Oficial, Kabum!*).
   - **Alerta de Risco**: Marketplace 3P sem reputação (risco de não envio ou golpe).
3. **Análise de Probabilidade de Erro de Dígito**:
   - Se o preço for < 10% do valor histórico (ex: R$ 699 em TV de R$ 6.999), o checkout deve ser imediato via **Compra 1-Clique**.

### 1.2 Estratégia de Pagamento & Blindagem do Pedido
* **Uso de Cartões Virtuais Dinâmicos**: Gerar cartão virtual de uso único com limite exato do valor da compra para evitar cobranças indevidas caso haja alteração de preço no gateway.
* **Opção PIX Instantâneo**: Se a loja permitir fixação de preço na emissão do QR Code, concluir via PIX Copia e Cola em até 5 minutos.
* **Registro Probatório**:
  - Salvar print completo da página de oferta, carrinho e tela de pedido concluído.
  - Guardar o e-mail de confirmação e número do pedido para garantir cumprimento da oferta sob o **Artigo 30 e 35 do Código de Defesa do Consumidor (CDC)**.

### 1.3 Mitigação de Cancelamento Unilateral
* Caso o e-commerce cancele alegando "erro crasso", enviar notificação extrajudicial padrão exigindo o cumprimento forçado da obrigação ou produto equivalente.

---

## 2. 🚗 Protocolo para Leilões de Veículos & Bens Industriais

### 2.1 Análise Prévia do Edital (Checklist Obrigatório)
Antes de emitir qualquer lance no auditório presencial ou eletrônico:
1. **Taxa do Leiloeiro**: Reservar obrigatoriamente **5%** sobre o valor da batida do martelo.
2. **Despesas de Pátio e Guincho**: Verificar na cláusula de despesas se há taxa diária de guarda (média de R$ 45 a R$ 90/dia).
3. **Condição Mecânica (Monta)**:
   - `Pequena Monta` / `Recuperado de Financiamento`: Elegível para revenda direta com margem.
   - `Média Monta`: Exige laudo do INMETRO (CSV) — aplicar deságio adicional de 25% na FIPE.
   - `Grande Monta` / `Sucata`: Apenas venda de peças regulamentadas no Detran.

### 2.2 Auditoria de Débitos & Bloqueios Judiciais
* **Consulta RENAJUD**: Verificar se há restrição de circulação ativa ou penhora trabalhista vinculada ao processo de origem.
* **Débitos Vinculados**: Confirmar se o edital declara que o arrematante recebe o bem livre de débitos anteriores (IPTU/IPVA) ou se correrão por conta do comprador.

### 2.3 Cálculo do Teto Máximo de Lance Seguro (Fórmula)

$$\text{Lance Máximo} = \frac{\text{FIPE} \times 0.85 - (\text{Comissão 5\%} + \text{Reparos Est.} + \text{Pátio/Documentação}) - \text{Lucro Mínimo Desejado}}{1.05}$$

* Utilize o módulo [engine/hidden_costs_calculator.ts](file:///c:/Users/Thiago%20Thomaz/OneDrive/Documentos/AntiGravity%20-%20Projetos/New%20project/engine/hidden_costs_calculator.ts) para simulação em tempo real.

---

## 3. 🏢 Protocolo para Oportunidades Imobiliárias (Bauru e Região)

### 3.1 Auditoria Cartorária & Imobiliária
1. **Matrícula Atualizada (CRI Bauru - 1º e 2º Ofício)**:
   - Verificar se há hipotecas, penhoras não extintas ou usufruto vitalício averbado.
2. **Débitos Fiscais & Condominiais**:
   - Emitir Certidão Negativa de Débitos de IPTU na Prefeitura Municipal de Bauru.
   - Solicitar declaração de quitação de débitos condominiais ao síndico (dívida *propter rem*).

### 3.2 Validação de Valor Médio por M²
* Comparar o custo do m² com a tabela de referência de Bauru:

| Bairro / Região | Preço Médio Residencial/m² | Faixa de Compra Oportuna |
| :--- | :--- | :--- |
| **Vila Aviação** | R$ 8.200,00 | < R$ 5.300,00/m² (>35% OFF) |
| **Jardim América** | R$ 6.800,00 | < R$ 4.400,00/m² (>35% OFF) |
| **Altos da Cidade** | R$ 5.400,00 | < R$ 3.500,00/m² (>35% OFF) |
| **Vila Universitária** | R$ 5.100,00 | < R$ 3.300,00/m² (>35% OFF) |
| **Centro** | R$ 3.900,00 | < R$ 2.500,00/m² (>35% OFF) |

### 3.3 Vistoria e Ocupação
* Se o imóvel estiver ocupado, calcular provisão de R$ 5.000 a R$ 12.000 para custas de advogado e ação de Imissão na Posse com prazo estimado de 60 a 120 dias.

---

## 4. 🛠️ Contingência Operacional & Resiliência SRE

### 4.1 Acionamento Manual do Circuit Breaker
Se uma fonte de dados começar a retornar captchas excessivos, erros 429 (Rate Limit) ou dados corrompidos:
```bash
# Pausar scraping na vertical com problemas (ex: price_bug)
npx tsx -e "import { RadarScraperDaemon } from './engine'; const d = new RadarScraperDaemon(); d.injectSyntheticFailure('price_bug', 'Manual Operator Override');"
```

### 4.2 Rotação e Renovação do Pool de Proxies
```bash
# Inspecionar saúde dos proxies no PostgreSQL
docker compose exec postgres psql -U radar_admin -d radar_hub_db -c "SELECT proxy_url, protocol, latency_ms, fail_count, is_active FROM radar_hub.proxy_pool ORDER BY latency_ms ASC;"
```

### 4.3 Backup Emergencial Pré-Manutenção
```bash
# Executar backup imediato com upload para S3/R2
npm run db:backup
```

### 4.4 Procedimento de Restauração (Disaster Recovery)
```bash
# Restaurar o snapshot mais recente com validação de Checksum SHA-256
npm run db:restore
```

---

## 5. 📞 Matriz de Escalação e Contatos de Emergência

* **SRE / DevOps Plantão**: Canal `#radar-sre-ops` (Telegram)
* **Engenharia de Scraping**: Canal `#radar-scrapers`
* **Jurídico / Notificações Extrajudiciais**: `juridico@radarhub.com`
