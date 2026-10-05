# BLINDAGEM DE WORKSPACE & DIRETRIZES FUNDAMENTAIS (RADAR_HUB)

## 1. Confinamento Estrito de Workspace
- NENHUM agente do Antigravity tem permissão para ler, inspecionar, criar, alterar ou deletar arquivos fora do diretório raiz deste projeto:
  `c:\Users\Thiago Thomaz\OneDrive\Documentos\AntiGravity - Projetos\Monitoramento das 12 Verticais de Oportunidades`
- É TERMINANTEMENTE PROIBIDO acessar diretórios-irmãos em `AntiGravity - Projetos`.
- O projeto `Arena Play` e outros projetos vizinhos são 100% blindados, isolados e intocáveis. Nenhuma IA deste workspace pode cruzar fronteiras.
- Variáveis de ambiente, portas de serviço (Porta 3000 padrão), processos em background e scripts de teste pertencem única e exclusivamente a este ecossistema local.

## 2. Arquitetura 100% Autônoma — Zero Dependência do n8n
- NENHUMA automação, cron, pipeline, webhook ou mensageria deve depender de instâncias ou nós do n8n.
- Todas as rotinas de orquestração, ingestão de dados, réguas de mensageria (WhatsApp via WAHA, Telegram Bot, Discord Webhook) e disparos de alertas são 100% internalizados em código nativo TypeScript/Node.js.
- Qualquer automação nova deve ser construída diretamente no backend nativo do projeto.

## 3. Publicação e Deploy na VPS via Coolify
- O padrão obrigatório de deploy e publicação na VPS é via **Coolify**.
- As configurações de contêiner (Dockerfile / docker-compose / variáveis de ambiente) devem se manter prontas para build e deploy contínuo no Coolify.
