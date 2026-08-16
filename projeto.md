# Prompt para desenvolver bot de automação de ofertas Shopee

Atue como um **desenvolvedor full-stack sênior especializado em automação, WhatsApp, APIs, integrações de afiliados e sistemas de processamento de mensagens**.

Quero desenvolver um sistema de automação de ofertas da **Shopee**, integrado ao WhatsApp através da **Evolution API** e à **API da Shopee/Afiliados**.

## 1. Objetivo do sistema

Já possuo grupos de WhatsApp onde recebo ofertas de diferentes lojas, como Mercado Livre, Amazon, Magalu etc.

Quero criar um novo bot cuja função seja:

1. Monitorar mensagens recebidas em determinados **grupos de origem** do WhatsApp.
2. Quando uma nova mensagem chegar em um grupo configurado como grupo-alvo, o sistema deve identificar a oferta.
3. O bot deve preservar a mensagem **o mais fielmente possível ao original**, incluindo:

   * Texto;
   * Emojis;
   * Formatação;
   * Imagens;
   * Vídeos, quando aplicável;
   * Outros elementos de mídia suportados pela Evolution API.
4. O único elemento que deverá ser alterado é o **link do produto**.
5. Se a mensagem original possuir um link de Mercado Livre, Amazon ou outra plataforma, o sistema deverá utilizar esse produto para localizar o produto correspondente na Shopee.
6. Depois de encontrar o produto na Shopee, deverá gerar/obter o **meu link de afiliado da Shopee** através da API/integrador disponível.
7. O link original deverá ser substituído pelo meu link de afiliado da Shopee.
8. A mensagem processada deverá ser enviada para um ou mais **grupos de destino configurados**.
9. O sistema deve evitar processar a mesma mensagem duas vezes.

### Exemplo conceitual

Mensagem recebida:

> 🔥 Oferta incrível!
> Produto XYZ por R$ 99,90
> https://mercadolivre.com.br/...

O sistema deverá localizar o produto XYZ na Shopee e enviar para o grupo de destino mantendo a estrutura da mensagem original, porém substituindo o link por algo como:

> 🔥 Oferta incrível!
> Produto XYZ por R$ 99,90
> [meu link de afiliado Shopee]

A implementação deve priorizar a **preservação da mensagem original**, não devendo reescrever ou modificar o conteúdo desnecessariamente.

---

## 2. Tecnologias

Utilize como base:

* **Evolution API** para integração com WhatsApp;
* **API da Shopee / Shopee Affiliate API**, conforme a documentação e recursos realmente disponíveis;
* Backend moderno e organizado;
* Banco de dados para configurações, mensagens processadas, logs e histórico;
* Interface web administrativa.

Antes de implementar qualquer integração com a Shopee, analise a documentação oficial/API disponível e determine exatamente quais endpoints e métodos podem ser utilizados para:

* Buscar produtos;
* Localizar um produto a partir de informações de outra plataforma;
* Gerar links de afiliado;
* Obter informações necessárias do produto.

**Não invente endpoints, parâmetros ou funcionalidades da API.** Se alguma operação não for possível diretamente pela API oficial, sinalize isso e proponha uma alternativa tecnicamente viável.

---

## 3. Painel administrativo

Crie uma interface web simples, moderna e responsiva para administrar o sistema.

### Configurações da Evolution API

Criar campos para:

* Server URL;
* Global API Key;
* Nome/identificador da instância;
* Outros parâmetros necessários para funcionamento.

O sistema deve validar a conexão com a Evolution API através de um botão como:

**"Testar conexão"**

---

### Configurações da Shopee

Criar uma seção específica para credenciais e configurações da Shopee, contendo os campos realmente necessários conforme a API utilizada, por exemplo:

* App ID;
* App Secret/Senha;
* Affiliate ID, caso necessário;
* Outros parâmetros exigidos pela API.

Adicionar botão:

**"Testar conexão com Shopee"**

As credenciais nunca devem aparecer em logs nem ser expostas desnecessariamente no frontend.

---

## 4. Grupos de origem

Criar uma tela para cadastrar os grupos que o bot deverá monitorar.

Cada grupo deve possuir:

* Nome;
* ID do grupo no WhatsApp;
* Status ativo/inativo;
* Descrição opcional.

O sistema deve permitir cadastrar vários grupos de origem.

Também seria interessante disponibilizar uma opção para **listar/buscar os grupos disponíveis através da Evolution API**, quando suportado.

---

## 5. Grupos de destino

Criar uma tela semelhante para os grupos que receberão as ofertas processadas.

Permitir:

* Cadastrar vários grupos;
* Nome;
* ID do grupo;
* Ativar/desativar;
* Definir quais grupos de origem alimentam quais grupos de destino.

Idealmente, permitir uma estrutura como:

**Grupo Origem A → Grupo Destino 1 e 2**

**Grupo Origem B → Grupo Destino 3**

---

## 6. Processamento das mensagens

O fluxo principal deve ser:

**WhatsApp → Evolution API → Webhook → Backend → Identificação do link → Busca do produto na Shopee → Geração do link afiliado → Substituição do link → Envio para grupo destino**

O sistema deverá receber os eventos através de **webhook da Evolution API**, em vez de ficar fazendo polling desnecessário.

Ao receber uma mensagem:

1. Verificar se o grupo de origem está cadastrado e ativo.
2. Identificar o tipo da mensagem.
3. Extrair texto e URLs.
4. Detectar URLs de lojas/plataformas.
5. Identificar o produto associado ao link.
6. Pesquisar o produto correspondente na Shopee.
7. Determinar o produto mais provável.
8. Gerar o link afiliado.
9. Substituir somente o link original.
10. Preservar o restante da mensagem.
11. Enviar a mídia e/ou texto para os grupos de destino.
12. Registrar o resultado no banco de dados.

---

## 7. Correspondência de produtos

Essa é uma parte crítica do projeto.

Não assuma que será possível transformar diretamente qualquer URL de Mercado Livre/Amazon em um produto Shopee.

Crie uma camada de **Product Matching**.

Utilize, quando disponíveis:

* Nome do produto;
* Marca;
* Modelo;
* SKU;
* EAN/GTIN;
* Características;
* Palavras-chave;
* Outras informações extraídas da página/link.

O sistema deverá atribuir um **score de confiança** à correspondência.

Exemplo:

* 90–100% → correspondência muito provável;
* 70–89% → correspondência provável;
* abaixo disso → não enviar automaticamente ou enviar para revisão, conforme configuração.

Esses limites devem ser configuráveis no painel.

---

## 8. Tratamento de links

Criar um módulo específico para identificar URLs.

Ele deverá:

* Detectar links no texto;
* Identificar a plataforma;
* Extrair informações relevantes;
* Remover parâmetros de tracking quando necessário;
* Preservar o restante da mensagem;
* Substituir somente a URL processada.

O sistema deve suportar inicialmente plataformas como:

* Mercado Livre;
* Amazon;
* Outras plataformas configuráveis futuramente.

A arquitetura deve permitir adicionar novos provedores sem precisar reescrever o sistema inteiro.

---

## 9. Mensagens com mídia

Tratar corretamente mensagens contendo:

* Texto + imagem;
* Imagem sem texto;
* Texto + vídeo;
* Outras mídias suportadas pela Evolution API.

Quando houver imagem junto com texto, o ideal é enviar a **mesma imagem** acompanhada do texto modificado.

Não baixar e recomprimir a mídia desnecessariamente.

Preservar, sempre que possível:

* Caption;
* Imagem;
* Vídeo;
* Nome do arquivo;
* Formatação;
* Emojis.

---

## 10. Anti-duplicação

Implementar um sistema robusto para impedir duplicação.

Cada mensagem recebida deverá possuir uma identificação única baseada nos dados fornecidos pelo evento da Evolution API.

Registrar:

* Message ID;
* Grupo de origem;
* Data/hora;
* Conteúdo;
* Link original;
* Produto encontrado;
* Link Shopee;
* Resultado do processamento;
* Grupos para os quais foi enviada;
* Erros.

Se a mesma mensagem chegar novamente pelo webhook, ela não deverá ser processada novamente.

---

## 11. Logs e monitoramento

Criar uma tela de **Logs** mostrando:

* Mensagens recebidas;
* Mensagens processadas;
* Produto encontrado;
* Link original;
* Link Shopee;
* Status;
* Horário;
* Grupo de origem;
* Grupo destino;
* Erros.

Criar filtros por:

* Data;
* Grupo;
* Status;
* Plataforma;
* Erro/sucesso.

Adicionar uma página/dashboard com métricas como:

* Mensagens recebidas;
* Ofertas processadas;
* Ofertas enviadas;
* Produtos não encontrados;
* Erros;
* Última atividade do bot.

---

## 12. Configurações adicionais

Adicionar configurações para:

* Ativar/desativar o bot;
* Ativar/desativar determinados grupos;
* Timeout das requisições;
* Número máximo de tentativas;
* Delay entre mensagens;
* Score mínimo para correspondência automática;
* Comportamento quando o produto não for encontrado;
* Enviar ou não mensagens sem link;
* Plataformas habilitadas;
* Logs detalhados;
* Fila de processamento.

Não utilizar delays ou mecanismos que tenham como objetivo burlar limitações ou políticas do WhatsApp/Shopee. O sistema deve trabalhar dentro das limitações e regras das APIs utilizadas.

---

## 13. Fila de processamento

Não processe tudo de forma síncrona dentro do webhook.

O webhook deve:

1. Receber o evento;
2. Validar;
3. Registrar;
4. Colocar a tarefa em uma fila;
5. Responder rapidamente à Evolution API.

Um worker separado deverá processar as ofertas.

Isso permitirá lidar melhor com várias mensagens simultâneas.

---

## 14. Banco de dados

Modele o banco de dados de forma organizada.

Sugestão de entidades:

* settings;
* whatsapp_instances;
* source_groups;
* destination_groups;
* routing_rules;
* messages;
* products;
* product_matches;
* affiliate_links;
* processing_jobs;
* processing_logs.

Defina corretamente:

* Chaves primárias;
* Índices;
* Foreign Keys;
* Campos de auditoria;
* Status;
* Timestamps.

---

## 15. Segurança

Implementar:

* Autenticação no painel;
* Senhas armazenadas com hash;
* Credenciais de APIs protegidas;
* Variáveis sensíveis fora do código;
* Validação de webhooks;
* Rate limiting;
* Validação de entrada;
* Proteção contra SSRF ao trabalhar com URLs externas;
* Logs sem exposição de secrets;
* Controle de acesso ao painel.

---

## 16. Arquitetura

Organize o projeto de forma modular.

Sugestão:

```text
Frontend
   ↓
Backend API
   ↓
Webhook Handler
   ↓
Message Queue
   ↓
Processing Worker
   ├── Message Parser
   ├── URL Detector
   ├── Platform Resolver
   ├── Product Matcher
   ├── Shopee API Client
   ├── Affiliate Link Generator
   └── WhatsApp/Evolution Client
   ↓
Database
```

O código deve ser preparado para futuras integrações, por exemplo:

```text
PlatformResolver
├── MercadoLivreResolver
├── AmazonResolver
├── AliExpressResolver
└── FutureResolver
```

E:

```text
AffiliateProvider
└── ShopeeAffiliateProvider
```

---

## 17. Tratamento de erros

Defina claramente o comportamento para situações como:

* Link inválido;
* Link expirado;
* Produto não encontrado;
* API da Shopee indisponível;
* Evolution API indisponível;
* Erro de autenticação;
* Grupo inexistente;
* Falha no envio;
* Timeout;
* Rate limit;
* Produto com baixa confiança.

Implementar retry com backoff para erros temporários.

Não repetir indefinidamente operações que falharam de forma permanente.

---

## 18. Interface

O painel deve ter uma aparência profissional e simples.

Menu lateral:

* Dashboard;
* Grupos de origem;
* Grupos de destino;
* Regras de roteamento;
* Configurações Evolution;
* Configurações Shopee;
* Processamentos;
* Logs;
* Sistema.

Na tela inicial, mostrar o status:

🟢 Evolution API conectada
🟢 Shopee conectada
🟢 Bot ativo
📨 Mensagens processadas
🔗 Links convertidos
❌ Erros

---

## 19. Desenvolvimento

Não entregue apenas uma demonstração visual.

Quero uma implementação funcional e organizada.

Antes de escrever o código:

1. Analise os requisitos.
2. Identifique possíveis limitações da API da Shopee.
3. Analise a documentação da Evolution API.
4. Defina a arquitetura.
5. Defina o banco de dados.
6. Explique as decisões técnicas mais importantes.
7. Depois implemente por etapas.

Durante a implementação:

* Gere código completo;
* Não utilize funções fictícias sem deixar isso explícito;
* Não invente endpoints;
* Não coloque credenciais reais no código;
* Use `.env.example`;
* Inclua migrations;
* Inclua instruções para instalação;
* Inclua configuração do webhook;
* Inclua tratamento de erros;
* Inclua testes para as partes críticas.

Ao final, forneça:

* Estrutura completa de pastas;
* Código;
* Schema/migrations do banco;
* `.env.example`;
* Instruções de instalação;
* Instruções de configuração da Evolution API;
* Instruções de configuração da Shopee;
* Como configurar o webhook;
* Como cadastrar grupos;
* Como iniciar o worker;
* Como testar o fluxo completo.

### Importante

Se existir alguma limitação técnica na API da Shopee que impeça exatamente o fluxo "pegar qualquer link de outra loja → descobrir automaticamente o produto equivalente na Shopee → gerar meu link de afiliado", **não esconda essa limitação**.

Nesse caso, explique exatamente o que a API permite fazer e adapte a arquitetura para a solução mais próxima possível, deixando a camada de busca/matching preparada para evoluir posteriormente.

O objetivo final é ter um **bot de automação de ofertas Shopee funcional, escalável e administrável por painel**, capaz de receber ofertas de grupos do WhatsApp, encontrar o produto correspondente na Shopee, transformar o link em meu link de afiliado e encaminhar a oferta para os grupos de destino preservando a mensagem original.
