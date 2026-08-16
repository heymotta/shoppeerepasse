# Shopee Offers Bot

Bot para receber ofertas via webhook da Evolution API, trocar URLs por links Shopee e encaminhar mensagens para grupos configurados.

## Limitação importante

A API de afiliados da Shopee não oferece, de forma universal e garantida, uma operação oficial que aceite qualquer URL de Mercado Livre/Amazon e descubra automaticamente o item equivalente. A aplicação separa essa responsabilidade em `ProductProvider` e não inventa endpoints, assinaturas ou parâmetros. Sem um contrato/endpoints válidos fornecidos pela Shopee, o worker marca a tarefa como `manual_review` em vez de fabricar um link.

O matching local já calcula confiança usando o título/termos extraídos da mensagem. Um provedor real deve ser implementado em `src/integrations/shopee.js` conforme a documentação liberada para a conta.

## Instalação

1. Instale Node.js 22.5+.
2. Execute `npm install`.
3. Copie `.env.example` para `.env` e altere `ADMIN_PASSWORD` e `WEBHOOK_SECRET`.
4. Execute `npm start` e abra `http://localhost:3000`.
5. Em produção, mantenha `npm start` e `npm run worker` em processos separados.

Login inicial sem `.env`: usuário `admin`, senha `admin`. Se existir `.env`, use os valores definidos em `ADMIN_USER` e `ADMIN_PASSWORD`.

## Evolution API

Configure no painel a URL, a API key e o nome da instância. Configure o webhook da instância para:

`POST https://seu-dominio/webhooks/evolution`

Envie o segredo no header `x-webhook-secret`. O endpoint responde rapidamente e só coloca a mensagem na fila; o processamento acontece no worker.

O cliente usa os endpoints documentados comuns da Evolution (`/instance/fetchInstances`, `/group/fetchAllGroups`, `/message/sendText`, `/message/sendMedia`). Como versões podem variar, falhas de endpoint são registradas sem expor credenciais.

## Shopee

Cadastre as credenciais apenas quando tiver a documentação/contrato correspondente. O painel armazena o segredo localmente e nunca o devolve nas respostas. Preencha `SHOPEE_API_URL` somente com um endpoint oficial autorizado. A integração não assume que busca cross-marketplace ou geração de deep link estejam disponíveis.

## Fluxo

1. Cadastre grupos de origem e destino.
2. Crie uma regra de roteamento ligando-os.
3. Ative o bot em Sistema.
4. Envie um evento da Evolution para o webhook.
5. Acompanhe fila, logs, score e falhas no painel.

Mensagens sem URL são ignoradas por padrão. Mídias são reenviadas sem download/recompressão quando a Evolution fornecer `mediaUrl`/`url`; caso contrário, o texto ainda é processado.

## Testes

`npm test`
