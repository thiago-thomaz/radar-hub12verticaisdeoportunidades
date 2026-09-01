/**
 * ==============================================================================
 * RADAR_HUB — MOTOR JURÍDICO AUTOMATIZADO LEGALTECH (CDC ARTS. 30 E 35 / JEC)
 * ==============================================================================
 * Geração automatizada de:
 * 1. Notificação Extrajudicial Prévia (Prazo 48h / PROCON / Consumidor.gov.br)
 * 2. Petição Inicial Completa para Juizado Especial Cível (JEC - até 20 SM sem advogado)
 * 3. Dossiê Probatório Estruturado com Prints, Comprovantes e Jurisprudência do STJ
 */

export interface ConsumerInfo {
  name: string;
  cpf: string;
  rg?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  cep: string;
}

export interface MerchantInfo {
  storeName: string;
  legalName?: string;
  cnpj?: string;
  address?: string;
  customerServiceEmail?: string;
}

export interface OrderDisputeInfo {
  orderNumber: string;
  orderDate: string;
  productTitle: string;
  advertisedPrice: number;
  marketReferencePrice: number;
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  pixTransactionId?: string;
  cancelDate: string;
  cancelReasonText?: string;
  screenshotOfferUrl?: string;
  paymentReceiptUrl?: string;
  orderConfirmationEmailUrl?: string;
}

export interface LegalCaseData {
  consumer: ConsumerInfo;
  merchant: MerchantInfo;
  dispute: OrderDisputeInfo;
  moralDamagesRequested?: number;
}

export interface LegalDocuments {
  extrajudicialNoticeMarkdown: string;
  extrajudicialNoticeText: string;
  jecPetitionMarkdown: string;
  evidenceDossierMarkdown: string;
  summary: {
    caseId: string;
    totalClaimValue: number;
    moralDamages: number;
    differenceClaimBrl: number;
    urgencyInjunctionRequested: boolean;
  };
}

export class RadarLegalTechEngine {
  /**
   * 1. GERAÇÃO DE NOTIFICAÇÃO EXTRAJUDICIAL PRÉVIA
   */
  public static generateExtrajudicialNotice(data: LegalCaseData): { markdown: string; text: string } {
    const { consumer, merchant, dispute } = data;
    const today = new Date().toLocaleDateString('pt-BR');
    const discountPct = (((dispute.marketReferencePrice - dispute.advertisedPrice) / dispute.marketReferencePrice) * 100).toFixed(1);

    const markdown = `# NOTIFICAÇÃO EXTRAJUDICIAL COM PEDIDO DE CUMPRIMENTO FORÇADO DE OFERTA

**DE:** ${consumer.name.toUpperCase()} (CPF nº ${consumer.cpf})  
**ENDEREÇO:** ${consumer.address}, ${consumer.city}/${consumer.state} — CEP: ${consumer.cep}  
**CONTATO:** ${consumer.email} | ${consumer.phone}  

**PARA:** **${merchant.storeName.toUpperCase()}** ${merchant.legalName ? `(${merchant.legalName})` : ''}  
**CNPJ:** ${merchant.cnpj || 'Constante no comprovante da transação'}  
**DATA:** ${today}  
**REF.:** Pedido nº **${dispute.orderNumber}** — Cumprimento Forçado da Obrigação (Arts. 30 e 35, I, da Lei Federal nº 8.078/1990 — CDC)

---

### I. DOS FATOS

1. Em **${dispute.orderDate}**, o Notificante, na qualidade de consumidor final, adquiriu no sítio eletrônico da Notificada o produto **${dispute.productTitle}**, pelo valor anunciado de **R$ ${dispute.advertisedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** (valor de mercado referencial: R$ ${dispute.marketReferencePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — desconto de ${discountPct}%).
2. O pagamento foi devidamente concluído e liquidado via **${dispute.paymentMethod}** ${dispute.pixTransactionId ? `(Autenticação PIX nº ${dispute.pixTransactionId})` : ''}, gerando o Pedido de Compra nº **${dispute.orderNumber}**, com emissão do e-mail oficial de confirmação de compra pela Notificada.
3. Não obstante a regular celebração do negócio jurídico bilateral, em **${dispute.cancelDate}**, a Notificada procedeu ao **CANCELAMENTO UNILATERAL E ARBITRÁRIO** da compra, sob a alegação genérica de *"${dispute.cancelReasonText || 'divergência de preço / indisponibilidade de estoque'}"*.

---

### II. DO FUNDAMENTO JURÍDICO

4. O artigo 30 do Código de Defesa do Consumidor estabelece que *“toda informação ou publicidade, suficientemente precisa, veiculada por qualquer forma ou meio de comunicação com relação a produtos e serviços oferecidos ou apresentados, obriga o fornecedor que a fizer veicular ou dela se utilizar e integra o contrato que vier a ser celebrado”*.
5. Ademais, o **artigo 35, inciso I, do CDC** confere expressamente ao consumidor a prerrogativa potestativa de:

> *"Art. 35. Se o fornecedor de produtos ou serviços recusar cumprimento à oferta, apresentação ou publicidade, o consumidor poderá, alternativamente e à sua livre escolha:*
> **I - exigir o cumprimento forçado da obrigação, nos termos da oferta, apresentação ou publicidade;**"

6. O cancelamento impositivo consubstancia prática abusiva e nula de pleno direito, nos termos do **Art. 51, incisos IV e XIII do CDC**, por colocar o consumidor em desvantagem exagerada e autorizar o fornecedor a rescindir unilateralmente o contrato.

---

### III. DO REQUERIMENTO E PRAZO IMPRORROGÁVEL (48 HORAS)

Diante do exposto, o Notificante **NOTIFICA FORMALMENTE** a empresa para que, no prazo improrrogável de **48 (quarenta e oito) horas**, contadas do recebimento desta:

1. **Restabeleça o pedido nº ${dispute.orderNumber}** e proceda ao faturamento e envio imediato do produto **${dispute.productTitle}** no endereço indicado, mantendo as condições originais contratadas de R$ ${dispute.advertisedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })};
2. Caso o modelo exato esteja comprovadamente esgotado no fabricante, entregue produto equivalente ou superior, sem qualquer acréscimo de preço (Art. 35, II, CDC).

**ADVERTÊNCIA:** O não atendimento no prazo fixado ensejará o ajuizamento imediato de **AÇÃO DE OBRIGAÇÃO DE FAZER C/C INDENIZAÇÃO POR DANOS MORAIS perante o Juizado Especial Cível (JEC)**, com pedido de tutela de urgência sob pena de multa diária (*astreintes*), além de representação administrativa perante a Secretaria Nacional do Consumidor (SENACON / PROCON).

Nestes termos, pede cumprimento.

**${consumer.name}**  
CPF: ${consumer.cpf}
`;

    const text = markdown.replace(/[#*`_]/g, '');
    return { markdown, text };
  }

  /**
   * 2. GERAÇÃO DE PETIÇÃO INICIAL COMPLETA PARA JUIZADO ESPECIAL CÍVEL (JEC)
   */
  public static generateJECPetition(data: LegalCaseData): string {
    const { consumer, merchant, dispute, moralDamagesRequested = 3000.00 } = data;
    const diffValue = Math.max(0, dispute.marketReferencePrice - dispute.advertisedPrice);
    const totalCauseValue = Number((diffValue + moralDamagesRequested).toFixed(2));
    const today = new Date().toLocaleDateString('pt-BR');

    return `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DO JUIZADO ESPECIAL CÍVEL DA COMARCA DE ${consumer.city.toUpperCase()} — ESTADO DE ${consumer.state.toUpperCase()}

**AUTOR:** **${consumer.name.toUpperCase()}**, brasileiro(a), inscrito(a) no CPF/MF sob o nº **${consumer.cpf}**, residente e domiciliado(a) na ${consumer.address}, ${consumer.city}/${consumer.state}, CEP: ${consumer.cep}, endereço eletrônico: ${consumer.email}, telefone: ${consumer.phone}, atuando em causa própria com fulcro no art. 9º da Lei nº 9.099/1995;

vem, respeitosamente, à presença de Vossa Excelência, propor a presente

# AÇÃO DE OBRIGAÇÃO DE FAZER (CUMPRIMENTO FORÇADO DE OFERTA VIRTUAL) CUMULADA COM PEDIDO DE TUTELA DE URGÊNCIA E INDENIZAÇÃO POR DANOS MORAIS

em face de **${merchant.storeName.toUpperCase()}** ${merchant.legalName ? `(${merchant.legalName})` : ''}, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº **${merchant.cnpj || 'constante no comprovante em anexo'}**, com sede em ${merchant.address || 'endereço eletrônico e físico constante nos autos'}, endereço eletrônico: ${merchant.customerServiceEmail || 'sac@ecommerce.com.br'}, pelos fatos e fundamentos a seguir expostos:

---

## 1. DOS FATOS

1. Em **${dispute.orderDate}**, o Autor adquiriu no sítio eletrônico da Ré o produto **${dispute.productTitle}**, pelo preço de **R$ ${dispute.advertisedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**, com pagamento confirmado via **${dispute.paymentMethod}** (Doc. 01 — Tela da Oferta e Doc. 02 — Comprovante de Pagamento).
2. A transação gerou o Pedido de Compra nº **${dispute.orderNumber}**, tendo a Ré enviado mensagem eletrônica de confirmação de celebração do negócio jurídico.
3. Contudo, em **${dispute.cancelDate}**, a Ré procedeu ao cancelamento unilateral e impositivo do pedido, alegando suposto erro sistêmico ou ausência de estoque.
4. O Autor tentou solucionar a celeuma de forma amigável mediante notificação extrajudicial e reclamação formal (Doc. 03), restando todas as tentativas infrutíferas face à recusa peremptória da Ré em honrar a entrega do produto.

---

## 2. DO DIREITO E DA VINCULAÇÃO DA OFERTA

### 2.1. Da Vinculação Obrigatória da Oferta (Arts. 30 e 35, I, do CDC)
5. A oferta veiculada pela Ré no comércio eletrônico é dotada de caráter vinculativo, integrando o contrato a teor do **Art. 30 do CDC**.
6. O **Artigo 35, inciso I, do CDC** confere ao consumidor o direito potestativo e incondicional de exigir o cumprimento forçado da obrigação.
7. Tratando-se de grande e-commerce que adota práticas de precificação dinâmica, inteligência artificial e queima de estoques promocionais (ex: Black Friday e Flash Deals), a oferta de produtos com desconto substancial insere-se no risco de sua atividade econômica lucrativa, sendo **inescusável** a alegação genérica de erro para cancelamento arbitrário.

### 2.2. Da Nulidade do Cancelamento Unilateral (Art. 51, IV e XIII, do CDC)
8. São nulas de pleno direito as cláusulas que permitem ao fornecedor a rescisão unilateral do contrato sem igual direito ao consumidor ou que estabeleçam obrigações iníquas.

### 2.3. Dos Danos Morais e Teoria do Desvio Produtivo do Consumidor
9. O cancelamento unilateral e a perda de tempo útil do consumidor para tentar reaver o que lhe é de direito geram dano moral indenizável, nos termos da consagrada **Teoria do Desvio Produtivo do Consumidor (STJ - AREsp 1.260.452/PE)**, requerendo-se o montante pedagógico de **R$ ${moralDamagesRequested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**.

---

## 3. DA TUTELA DE URGÊNCIA (ART. 300 DO CPC C/C ART. 84 DO CDC)

10. Estão presentes os requisitos para a concessão liminar da **Tutela Provisória de Urgência**:
    - **Probabilidade do Direito (*fumus boni iuris*)**: Demonstração inequívoca da compra e do pagamento (Docs. 01 e 02);
    - **Perigo de Dano (*periculum in mora*)**: Risco de esgotamento do lote e perecimento do direito à aquisição pelo preço avençado.
11. Requer-se a concessão de ordem liminar determinando que a Ré **proceda ao faturamento e remessa do produto no prazo de 5 (cinco) dias**, sob pena de multa diária (*astreintes*) não inferior a **R$ 200,00 (duzentos reais)**.

---

## 4. DOS PEDIDOS

Ante o exposto, requer a Vossa Excelência:

a) A concessão **inaudita altera parte** da **TUTELA DE URGÊNCIA**, determinando que a Ré entregue o produto **${dispute.productTitle}** no endereço do Autor no prazo de 5 dias, sob cominação de multa diária de R$ 200,00;  
b) A citação da Ré para, querendo, comparecer à audiência de conciliação e apresentar contestação;  
c) A **inversão do ônus da prova**, nos termos do art. 6º, VIII, do CDC;  
d) Ao final, a **PROCEDÊNCIA TOTAL DOS PEDIDOS** para:  
   1. Confirmar a tutela de urgência e condenar a Ré na **obrigação de fazer** consistente na entrega do produto adquirido, ou, alternativamente, produto de especificação idêntica ou superior sem custo adicional (Art. 35, I e II, CDC);  
   2. Sucessivamente, caso reste impossibilitada a entrega física, a conversão em perdas e danos no valor de mercado correspondente a **R$ ${dispute.marketReferencePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**;  
   3. A condenação da Ré ao pagamento de indenização a título de **danos morais no valor de R$ ${moralDamagesRequested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** pelo desvio produtivo e descaso com o consumidor.  

Dá-se à causa o valor de **R$ ${totalCauseValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**.

Nestes termos,  
Pede deferimento.

${consumer.city}/${consumer.state}, ${today}.

______________________________________________  
**${consumer.name}**  
CPF nº ${consumer.cpf}  
(Autor em Causa Própria)
`;
  }

  /**
   * 3. GERAÇÃO DE DOSSIÊ PROBATÓRIO E METADADOS
   */
  public static generateEvidenceDossier(data: LegalCaseData): string {
    const { consumer, dispute } = data;
    return `# DOSSIÊ PROBATÓRIO ESTRUTURADO // CASO: ${dispute.orderNumber}

## 1. DADOS DO PROCESSO
- **Autor**: ${consumer.name} (CPF: ${consumer.cpf})
- **Item Reclamado**: ${dispute.productTitle}
- **Preço Anunciado**: R$ ${dispute.advertisedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- **Preço de Referência**: R$ ${dispute.marketReferencePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- **Economia / Prejuízo**: R$ ${(dispute.marketReferencePrice - dispute.advertisedPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

## 2. CHECKLIST DE DOCUMENTOS ANEXOS
- [x] **Doc. 01**: Print screen integral da página da oferta com data, hora e URL.
- [x] **Doc. 02**: Comprovante de quitação bancária (${dispute.paymentMethod}).
- [x] **Doc. 03**: E-mail de confirmação de pedido emitido pelo e-commerce.
- [x] **Doc. 04**: Notificação de cancelamento unilateral expedida pela Ré.
- [x] **Doc. 05**: Notificação Extrajudicial enviada e comprovante de entrega/leitura.
- [x] **Doc. 06**: Cópia de documento pessoal do Autor (RG/CPF e comprovante de residência).
`;
  }

  /**
   * 4. GERAÇÃO DO PACOTE COMPLETO LEGALTECH
   */
  public static generateFullLegalPack(data: LegalCaseData): LegalDocuments {
    const notice = this.generateExtrajudicialNotice(data);
    const jecPetition = this.generateJECPetition(data);
    const evidenceDossier = this.generateEvidenceDossier(data);

    const diffValue = Math.max(0, data.dispute.marketReferencePrice - data.dispute.advertisedPrice);
    const moralDamages = data.moralDamagesRequested || 3000.00;

    return {
      extrajudicialNoticeMarkdown: notice.markdown,
      extrajudicialNoticeText: notice.text,
      jecPetitionMarkdown: jecPetition,
      evidenceDossierMarkdown: evidenceDossier,
      summary: {
        caseId: `LEGAL_${data.dispute.orderNumber}_${Date.now()}`,
        totalClaimValue: Number((diffValue + moralDamages).toFixed(2)),
        moralDamages,
        differenceClaimBrl: diffValue,
        urgencyInjunctionRequested: true
      }
    };
  }
}
