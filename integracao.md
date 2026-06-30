# Integração com iFood e Zé Delivery — Pesquisa e Observações

> Documento de pesquisa, sem alterações de código. Objetivo: avaliar viabilidade de integrar o DISTOK (gestão de estoque + futuro controle de pedidos para distribuidoras) com iFood e Zé Delivery.

## Resumo executivo

| | iFood | Zé Delivery |
|---|---|---|
| Tem API pública documentada? | Sim (`developer.ifood.com.br`) | Sim (`seller-public-api.ze.delivery`), mas com relatos de dificuldade de acesso |
| Quem pode integrar tecnicamente? | Qualquer empresa de software, via processo de homologação | Não fica claro se é aberto a qualquer ERP ou só a parceiros já credenciados (ver seção 3) |
| Pré-requisito comercial? | Não — a homologação é técnica, separada da relação loja↔iFood | Sim — primeiro é preciso ser um **estabelecimento distribuidor cadastrado e aprovado** no Zé Delivery (CNAE de distribuição de bebidas, frota própria, estrutura de refrigeração etc.) |
| "Fácil" pra uma SaaS pequena como o DISTOK? | Tecnicamente sim, burocraticamente médio (homologação leva tempo) | Mais difícil — depende de aprovação comercial da AmBev/Zé, não só técnica |
| Alternativa sem homologação direta | Hubs de integração (Saipos, ConnectPlug, Consumer, Anota AI, LETS/Max, MarketUP) | Hubs também (Alterdata, FWI, Instaleap, Linx, Mainô são parceiros oficiais já homologados) |

## 1. iFood — como funciona

### 1.1 Modelo de API
A plataforma é o **iFood Developer** (`developer.ifood.com.br`), com duas frentes:
- **Guias** (tutoriais, jornadas de integração)
- **Referência de API** (specs técnicas)

Existe uma **Merchant-API** voltada a Restaurantes e uma API separada para **Groceries** (mercados/conveniência — provavelmente a mais relevante para uma distribuidora, já que vende produtos, não pratos prontos). Principais módulos:
- **Order** (pedidos — recebimento e ciclo de vida)
- **Item / Catalog** (catálogo de produtos, disponibilidade, preço)
- **Merchant** (dados da loja, abrir/fechar loja)
- **Events** (eventos assíncronos — polling, ex.: `/order/v1.0/events:polling`)
- **Financial** (repasses/conciliação)

### 1.2 Autenticação
OAuth2 com dois fluxos possíveis:
- **Aplicações centralizadas**: `client_credentials` (client_id + client_secret) direto, sem refresh token; token expira em ~6h.
- **Aplicações distribuídas**: o lojista autentica no Portal do Parceiro e autoriza o app a acessar a loja dele especificamente (modelo "Conectar app", parecido com OAuth de terceiros tipo "Login com Google").

### 1.3 Processo de homologação
1. Cadastro no portal → é gerado automaticamente um **app de teste** (sandbox) com `client_id`/`client_secret` próprios.
2. Desenvolvimento e testes na sandbox.
3. Solicitação de homologação pela aba "Suporte" do portal → agenda de validação.
4. Se aprovado, é criado um **app oficial de produção**; só a partir daí a integração pode ser habilitada em lojas reais.
5. Tempo estimado: homologação formal ~1 semana após submissão, mas ajustes de adequação podem consumir 10-15% do tempo total do projeto.
6. Exige CNPJ para o integrador.

### 1.4 Custos e modelo comercial
A homologação técnica em si não tem custo direto divulgado — o iFood ganha via comissão sobre os pedidos da loja (não do integrador). Para referência, planos de loja: comissão de ~23% sobre pedidos no plano Delivery/Delivery Flex + taxa de pagamento online de 3,5% + mensalidade de R$150 para lojas com faturamento mensal acima de R$1.800. Isso é o custo do **lojista**, não necessariamente o do desenvolvedor da integração — mas é relevante se o DISTOK pretende cobrar/repassar isso aos seus clientes distribuidores.

### 1.5 Como atualizar estoque/disponibilidade via API
O módulo **Item/Catalog** permite habilitar/desabilitar item e atualizar preço e disponibilidade — esse é o ponto de integração natural com o módulo de estoque do DISTOK: quando `stock_balance.current_stock` chega a zero (ou abaixo do mínimo), a integração dispararia uma chamada para desabilitar o item no catálogo iFood, e o reverso ao reabastecer.

**Fontes:** [iFood Developer – Visão geral](https://developer.ifood.com.br/pt-BR/docs/getting-started/), [Escopos de integração](https://developer.ifood.com.br/pt-BR/docs/guides/solutions/integration-scopes/), [Autenticação – Introdução](https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/intro/), [Fluxo distribuído](https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/distributed/), [Fluxo centralizado](https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/centralized/), [Critérios de homologação](https://developer.ifood.com.br/pt-BR/docs/guides/modules/merchant/homologacao/), [Parceiros Homologados (iFood Mercado)](https://developermercado.ifood.com.br/docs/partners/), [Planos iFood para parceiros](https://blog-parceiros.ifood.com.br/planos-ifood/), [Taxas do iFood](https://blog-parceiros.ifood.com.br/taxas-ifood/).

## 2. Zé Delivery — como funciona

### 2.1 Existe API pública
Diferente do que eu esperava, o Zé Delivery **tem** uma API documentada: **Zé Seller Public API** (`seller-public-api.ze.delivery/docs`), também com workspace no Postman.

- **Autenticação:** OAuth2 `client_credentials` (endpoint `/auth`), escopo observado: `orders/read`.
- **Grupos de endpoints:**
  - **Events** — polling de eventos de pedido (`CREATED`, `CONFIRMED`, `DISPATCHED`, `CANCELLED`, `CONCLUDED`, `EDITED`), com confirmação de consumo do evento (evita reprocessar).
  - **Orders** — consultar, confirmar, cancelar/restaurar pedidos.
  - **Products** — catálogo: criar/atualizar produto, promoções, **disponibilidade e preço** (ponto de integração com estoque, igual ao iFood).
  - **Logistics** — acompanhamento de entrega (coleta, rota, chegada, código de confirmação).
  - **Merchants** — dados do estabelecimento e disponibilidade (abrir/fechar loja).
  - **Reports** — KPIs e repasses.

A documentação não detalha um processo formal de homologação técnica como o do iFood — sugere apenas registro como parceiro para obter `client_id`/`client_secret`.

### 2.2 O obstáculo real: o pré-requisito comercial
Para usar essa API, é preciso primeiro **ser um distribuidor cadastrado e aprovado no Zé Delivery** — isso é um processo comercial separado e mais restritivo que o do iFood:
- Estar na área de atuação do Zé Delivery.
- CNPJ com CNAE compatível com distribuição de bebidas.
- Frota de entrega própria.
- Estrutura de armazenamento refrigerado (recomendado ≥5 geladeiras/câmaras frias).
- Aceitar múltiplas formas de pagamento.
- Aprovação **sem prazo definido** — depende de demanda regional (a AmBev/Zé só ativa novos pontos onde há "potencial de crescimento" na região).

Ou seja: **a integração técnica (API) só importa depois que o cliente distribuidor do DISTOK já é um parceiro Zé Delivery aprovado**. O DISTOK não integra "com o Zé Delivery" de forma genérica — cada tenant/distribuidora precisa primeiro passar pelo cadastro comercial deles mesmos.

### 2.3 Parceiros de integração oficiais já existentes
A aba de integrações do Zé Delivery lista parceiros tecnológicos já homologados: **Alterdata, FWI Sistemas, Instaleap, Linx, Linx Menew, Mainô**. Isso sugere que, mesmo tendo API pública, a AmBev prioriza relacionamento com fornecedores de PDV/ERP já estabelecidos no setor de bebidas — o que pode dificultar (ou exigir negociação direta) para uma SaaS nova como o DISTOK entrar nessa lista.

### 2.4 Relatos de dificuldade
Há reclamações registradas no Reclame Aqui sobre dificuldade em obter informações/documentação para integração própria com a API do Zé Delivery — sinal de que o canal de suporte para integradores não-parceiros é menos maduro que o do iFood.

**Fontes:** [Zé Seller Public API – docs](https://seller-public-api.ze.delivery/docs), [Zé Seller Public API – Postman](https://www.postman.com/publicapizedelivery/workspace/z-delivery-public-api/overview), [Cadastro parceiro distribuidor](https://seu.ze.delivery/cadastro-parceiro), [Como se tornar distribuidor Zé Delivery (Tecnoblog)](https://tecnoblog.net/responde/como-comecar-a-vender-seus-produtos-no-ze-delivery/), [Guia passo a passo (montarumnegocio.com)](https://montarumnegocio.com/como-ser-um-distribuidor-ze-delivery/), [Reclamação sobre dificuldade de integração via API (Reclame Aqui)](https://www.reclameaqui.com.br/ze-delivery-de-bebidas/dificuldade-em-obter-informacoes-para-integracao-com-a-api-do-ze-delivery_cSrPALSInMRI-ZEy/), [Integração Zé Delivery com sistema de gestão (erp4me)](https://erpfor.me/sobre/blog/alimentacao/integracao-ze-delivery-com-sistema-de-gestao).

## 3. "Dá pra fazer fácil?" — avaliação honesta

**iFood:** sim, é viável para uma equipe pequena, mas não é trivial nem imediato. É um processo técnico bem documentado (OAuth2, sandbox, eventos via polling), porém com etapas de homologação que consomem tempo (semanas, não dias) e exigem testes ponta-a-ponta com pedido de teste real. Não há barreira comercial — qualquer empresa com CNPJ pode tentar.

**Zé Delivery:** mais difícil em dois níveis:
1. **Comercial** — cada distribuidora cliente do DISTOK precisaria primeiro ser aprovada como ponto de venda Zé Delivery (processo fora do controle do DISTOK, sem prazo, dependente de demanda regional da AmBev).
2. **Técnico/relacionamento** — a API existe, mas o ecossistema de integração parece concentrado nos parceiros já homologados (Linx, Alterdata etc.); não está claro se a Zé abre o cadastro de `client_id`/`client_secret` para qualquer ERP novo ou se exige aprovação prévia como parceiro tecnológico.

## 4. Alternativa: hub de integração (evita homologar com cada marketplace)

Um **hub de integração de delivery** é um serviço de middleware que já está homologado com iFood, Zé Delivery, Rappi etc., e expõe **uma única API** para o ERP (no caso, o DISTOK) conectar. O hub repassa pedidos de todos os canais para uma tela/API unificada e propaga atualizações de estoque/catálogo para os marketplaces.

**Vantagens:**
- Evita repetir o processo de homologação técnica com cada marketplace.
- Um único contrato/integração cobre múltiplos canais.
- Sincronização de catálogo/estoque já pronta (ex.: zerar estoque tira o item do ar automaticamente).

**Desvantagens:**
- Mais uma camada de dependência/custo (mensalidade do hub).
- Menos controle fino sobre cada API nativa.
- Cobertura de Zé Delivery específica pode ser limitada (poucos hubs genéricos de "delivery de comida" cobrem bebidas/distribuidoras — os parceiros homologados do Zé são majoritariamente ERPs de varejo/bebidas como Linx e Alterdata, não hubs multi-marketplace de comida).

**Exemplos encontrados:** Saipos (chamado de "Super Integrador" do iFood, +100 integrações), ConnectPlug, LETS/Max, MarketUP, Consumer, Anota AI.

**Fontes:** [O que é um Hub de integração para delivery (ConnectPlug)](https://blog.connectplug.com.br/hub-de-integracao-para-delivery/), [Integração Saipos e iFood](https://saipos.com/integracoes/ifood), [Integrações Max + iFood (LETS)](https://www.uselets.com/integracoes/ifood).

## 5. Recomendação para o DISTOK

1. **Priorizar iFood primeiro** se a meta é "controle de pedidos" — API mais aberta, processo de homologação claro e bem documentado, sem depender de aprovação comercial prévia do cliente final.
2. **Zé Delivery é mais incerto** — antes de investir em código, vale confirmar diretamente com o time de parceiros do Zé (`seu.ze.delivery`) se uma SaaS nova consegue credenciais de API sem ser um dos parceiros já listados (Alterdata, FWI, Instaleap, Linx, Mainô). Isso é uma pergunta comercial, não técnica.
3. Para o **modelo de dados do DISTOK** (multi-tenant, `products`, `stock_balance`, `stock_movements` via `TenantScopedRepository`/`StockLedger`), a integração se encaixaria como um **novo módulo** (`modules/integrations/ifood` e/ou `modules/integrations/ze-delivery`) que:
   - Consome eventos de pedido via polling (ambas APIs usam esse padrão) e cria `stock_movements` do tipo `exit` através do `StockLedger.createMovement` existente — reaproveitando o lock pessimista e a auditoria já implementados.
   - Reage a mudanças de `stock_balance` (mínimo/zero) para chamar a API de disponibilidade de catálogo de cada marketplace.
   - Precisaria de uma nova tabela de credenciais por tenant (ex.: `tenant_integrations` com `provider`, `client_id`, `client_secret` cifrado, `external_merchant_id`) — não existe hoje no schema.
4. Considerar um **hub** (Saipos/ConnectPlug/Consumer) como atalho de curto prazo se o objetivo é validar a demanda antes de investir em homologação direta com cada marketplace.
