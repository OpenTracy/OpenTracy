# PureAI Console

Plataforma de gerenciamento de modelos de IA com deploy em GPU, playground multi-provider, fine tuning e analytics.

## Features

- **Deployments**: Deploy de modelos LLM em instancias GPU (AWS SageMaker)
- **Metricas em Tempo Real**: CPU, GPU, memoria, latencia, invocacoes
- **Playground**: Teste de modelos de 15+ provedores (OpenAI, Anthropic, etc)
- **Fine Tuning**: Ajuste fino de modelos
- **Analytics**: Dashboard com custos, performance e uso
- **Integracoes**: Configuracao de API keys de provedores

## Stack

- **Frontend**: React 19, TypeScript, Vite
- **UI**: Tailwind CSS 4, Lucide Icons, Recharts
- **Auth**: AWS Amplify 6, Amazon Cognito
- **Backend**: AWS API Gateway, Lambda, SageMaker

## Quick Start

```bash
# Instalar dependencias
npm install

# Copiar variaveis de ambiente
cp .env.example .env

# Rodar em desenvolvimento
npm run dev

# Build para producao
npm run build
```

## Configuracao de Ambiente

### Como funciona

As APIs sao determinadas pela variavel `VITE_ENVIRONMENT`, que e injetada automaticamente pelo Amplify via Terraform:

| Amplify App | `VITE_ENVIRONMENT` | API Gateway | Router |
|---|---|---|---|
| `pureai-autodestill-prod-console` | `prod` | Prod API Gateway | `api.lunar-sys.com` |
| `pureai-autodestill-dev-console` | `dev` | Dev API Gateway | `dev-api.lunar-sys.com` |

A branch `main` no **Amplify app de prod** e a unica que usa APIs de producao. Todas as outras combinacoes (dev app, feature branches, local dev) usam APIs de desenvolvimento.

### Variaveis de Ambiente

| Variavel | Descricao | Onde e definida |
|---|---|---|
| `VITE_ENVIRONMENT` | `dev` ou `prod` - determina URLs default | Terraform (app level) |
| `VITE_API_BASE_URL` | URL do API Gateway (JWT auth) | Terraform (app level) |
| `VITE_ROUTER_URL` | URL do Router (API Key auth) | Terraform (app level) |
| `VITE_STATS_URL` | URL do Stats API (default: ROUTER_URL) | Terraform (app level) |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID | Terraform (app level) |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID | Terraform (app level) |
| `VITE_COGNITO_REGION` | AWS Region | Terraform (app level) |
| `VITE_ROUTER_KEY` | Router key para delecao de APIs | Manual (Amplify console) |
| `VITE_PUBLIC_POSTHOG_KEY` | PostHog analytics key | Manual (Amplify console) |
| `VITE_PUBLIC_POSTHOG_HOST` | PostHog host URL | Manual (Amplify console) |

### Prioridade de resolucao

```
1. Variavel de ambiente do Amplify (VITE_API_BASE_URL, VITE_ROUTER_URL)
2. Default baseado em VITE_ENVIRONMENT (dev → dev URLs, prod → prod URLs)
3. Local dev (npm run dev) → sempre usa dev URLs
```

### Desenvolvimento Local

Copie `.env.example` para `.env`. Para dev local, nao precisa mudar nada — os defaults apontam para dev.

```env
# .env (local dev - nao committar)
VITE_ENVIRONMENT=dev
VITE_API_BASE_URL=https://dev-gateway.lunar-sys.com
VITE_ROUTER_URL=https://dev-api.lunar-sys.com
```

### Deploy (Amplify)

O deploy e automatico via Amplify conectado ao GitHub:

| Branch | Amplify App | Ambiente | URL |
|---|---|---|---|
| `main` | prod-console | Producao | `app.lunar-sys.com` |
| `dev` | dev-console | Desenvolvimento | `dev.lunar-sys.com` |
| `feature/*` | dev-console | Desenvolvimento | PR preview |

As variaveis de ambiente sao gerenciadas pelo Terraform em:
- **Dev**: `terraform/environments/dev/main.tf` → `module "amplify_console"`
- **Prod**: `terraform/environments/prod/main.tf` → `module "amplify_console"`

**Nunca hardcode URLs de producao no codigo.** Elas sao injetadas pelo Terraform no build.

## Documentacao

Ver `/docs` para documentacao completa:

- [Visao Geral](./docs/01-visao-geral.md)
- [Autenticacao](./docs/02-autenticacao.md)
- [Deployments](./docs/03-deployments.md)
- [Metricas](./docs/04-deployment-metrics.md)
- [Services](./docs/09-services.md)
- [Types](./docs/10-types.md)

## Modelos Suportados

| Modelo | ID |
| ------ | -- |
| Llama 4 Scout 17B | `Llama-4-Scout-17B-16E-Instruct` |
| DeepSeek R1 8B | `DeepSeek-R1-Distill-Llama-8B` |
| LLaMA 3.2 1B | `Llama-3.2-1B` |
| Qwen3 30B | `Qwen3-30B-A3B-Instruct-2507` |
| Qwen3 4B | `Qwen3-4B-Instruct-2507` |
| Gemma 3 4B | `gemma-3-4b-it` |

## Estrutura

```plaintext
src/
├── components/      # Componentes React
│   ├── Dashboard/   # Dashboard e analytics
│   ├── Deployment/  # Deploy de modelos
│   └── UI/          # Componentes base
├── config/          # Configuracao de API e ambiente
├── contexts/        # React Contexts
├── hooks/           # Custom hooks
├── services/        # Servicos de API
├── types/           # TypeScript types
└── views/           # Paginas principais
```

## License

Proprietary - PureAI Tools
