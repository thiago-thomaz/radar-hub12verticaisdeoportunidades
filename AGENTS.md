# RADAR_HUB - REGRAS E DIRETRIZES DO AGENTE (AGENTS.md)

Este documento define as regras operacionais invioláveis para todos os agentes e modelos de IA atuando neste projeto.

---

### 1. Confinamento Estrito de Workspace
- **Raiz do Projeto:** Todas as operações (leitura, escrita, execução de comandos e criação de arquivos) estão estritamente confinadas a:
  `c:\Users\Thiago Thomaz\OneDrive\Documentos\AntiGravity - Projetos\Monitoramento das 12 Verticais de Oportunidades`
- **Isolamento de Projetos Vizinhos:** É estritamente proibido acessar qualquer diretório fora desta raiz. Em especial, o projeto "Arena Play" e quaisquer outros contidos em `AntiGravity - Projetos` são completamente blindados e intocáveis.
- **Portas e Processos Locais:** Portas (ex: 3000), instâncias de teste e processos de dev são 100% locais a este repositório.

---

### 2. Autonomia Total & Zero Dependência do n8n
- **Proibição de Dependência Externa:** Fica proibida qualquer dependência do n8n para orquestração de fluxos, rotinas agendadas (crons), mensageria ou webhooks.
- **Internalização Nativa:** Todos os agendadores, pipelines de ingestão, réguas de mensageria (WAHA WhatsApp, Telegram, Discord) e processamento de pagamentos são implementados nativamente em código TypeScript / Node.js.

---

### 3. Publicação e Deploy Contínuo via Coolify
- **Padrão de Deploy:** As publicações e deploys de produção na VPS devem ser orquestrados através do **Coolify**.
- **Infraestrutura Pronta:** O repositório deve manter arquivos `Dockerfile`, scripts e variáveis de ambiente perfeitamente compatíveis com os ambientes de aplicação e banco de dados do Coolify.

---

### 4. Proteção de Credenciais e Segredos
- O arquivo `.env` e arquivos locais contendo segredos jamais devem ser versionados no Git.
- Mantenha `.env.example` sempre limpo e atualizado como contrato de variáveis necessárias.
