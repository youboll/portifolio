---
title: "Database-per-tenant em Django: roteamento dinâmico e troca de plataforma sem reautenticar"
description: "Cada cliente tem o próprio banco MySQL. O roteador foi fácil. O difícil foi deixar um admin logar na plataforma A e clicar pra plataforma B sem reautenticar."
pubDate: 2026-04-29
readingTime: "11 min de leitura"
tag: "django"
---

A plataforma onde eu trabalhei é multi-tenant database-per-tenant: cada cliente tem o próprio banco MySQL, e o roteamento é resolvido em runtime pelo hostname (`<tenant>.ead.guru`, `<tenant>.mindz.com.br`, ou um domínio próprio que o cliente apontou). A base disso já existia quando eu cheguei na feature — o Diego tinha escrito um `TenantMiddleware` enxuto e um `TenantRouter` que devolvia o nome do banco do tenant atual em `db_for_read` / `db_for_write`. Funcionava bem pro caso normal: um navegador, um hostname, um banco.

O problema veio quando o produto pediu uma coisa nova: **um mesmo usuário precisa acessar várias plataformas com um único login**. Pensa no professor que tem três cursos vendidos em três marcas diferentes, cada uma rodando como tenant separado. Hoje ele precisa lembrar três URLs e fazer três logins. Queremos: ele loga uma vez na conta dele, vê uma listinha das plataformas que tem acesso, e clica numa pra "entrar" — sem digitar senha de novo.

Essa frase aparentemente simples toca em quase tudo: middleware, sessão, router de banco, modelo de identidade entre bancos, ORM, cache, signals, e bypass pra webhook de pagamento. Esse post é a anatomia da solução que ficou rodando.

## Premissas que dão contexto

Identidade entre bancos é o **email**. Não há sincronização de IDs. O usuário Pedro existe no banco do tenant A com `id=42`, no banco do tenant B com `id=7`, e a única coisa que liga os dois é o campo `email`. Eu sei que esse desenho tem trade-offs — perde-se a chance de FK cross-banco —, mas dado o estado do sistema quando esse trabalho começou, era o caminho realista. Alterar identidade pra UUID compartilhado seria uma migração de outra ordem.

Existe um banco "compartilhado" pequeno (vou chamar de `multi_tenant`) que guarda o registro de quais workspaces existem, quais usuários estão associados a quais (a tabela `UserWorkspace`), configurações que cruzam tenants, e esse tipo de metadado. Os bancos por-tenant guardam o conteúdo real (cursos, alunos, pagamentos, etc.).

E existe a base do Diego: o `setup_db_connection` que registra dinamicamente conexões em `connections.databases` com nome `eadguru_<id>` e senha derivada por HMAC-SHA256, pra que o ORM consiga falar com o banco do tenant ao longo do request.

## O que eu construí em cima

Três peças.

### 1. `TenantMiddleware` ganha três modos de resolução

Antes era só hostname. Agora é uma cadeia em ordem de precedência:

1. **Hostname** — modo membros tradicional. Continuou funcionando como antes, sem mudança pra usuário final que entra direto na URL da plataforma.
2. **Cookie assinado `selected_ead_id`** — HTTP-only, `samesite=Lax`, 30 dias de validade, assinado com `request.get_signed_cookie` e um `salt` próprio. Esse cookie é a memória da seleção do usuário. Quando ele clica numa plataforma da listinha, eu emito esse cookie e o middleware o lê em todo request seguinte. Tampering no cookie vira `BadSignature` e cai no fallback.
3. **Fallback DEV** — primeiro `UserWorkspace` do usuário. Útil em desenvolvimento, não acionável em produção.

A peça que faz a troca persistir é o `_sync_cookie`: sempre que o `THREAD_LOCAL.EAD_ID` resolvido neste request difere do valor recebido no cookie, eu reemito o cookie. Isso evita drift entre o que o middleware decidiu e o que o navegador acredita.

Detalhe meio prosaico mas importante: também adicionei um `_is_affiliate_path` que separa paths de afiliado em uma flag de thread-local consumida pelo router e por uma terceira peça, o `profile_table_patch` — explico abaixo.

### 2. `DatabaseBoundaryMiddleware` — a costura entre "logado em A" e "agora estou em B"

Essa é a peça central. Ela compara dois valores em todo request: o `THREAD_LOCAL.EAD_ID` resolvido neste request (que veio do hostname ou do cookie) e o `request.session.authenticated_ead_id` (que foi gravado quando o usuário fez login). Se forem diferentes, significa que o usuário cruzou uma fronteira de banco — saiu do tenant A pro tenant B sem fazer logout. O middleware chama então `cross_database_boundary`.

O que `cross_database_boundary` faz:

1. Já tem a conexão certa registrada (`set_current_ead` carimbou em `THREAD_LOCAL` e Sentry tags).
2. Busca o User no banco-alvo pelo email do usuário logado.
3. Se não existe, força `logout`. O usuário não tem conta nesse tenant, ponto.
4. Se existe, faz `logout` do contexto velho e `login` no novo banco. Isso refaz o login do Django na nova fronteira sem pedir senha.

A parte que dá pra alguém estranhar: **não há verificação de senha**. O login no banco-alvo é por confiança numa sessão já autenticada. A pergunta que isso levanta é "o que impede um atacante de forjar `selected_ead_id`?". Resposta: o cookie é assinado. Forjar exige a `SECRET_KEY`. Se o atacante tem a `SECRET_KEY` o jogo já acabou bem antes de chegar nesse middleware.

A pergunta mais interessante é "o que impede o usuário de selecionar um tenant que não é dele?". Resposta: o `UserWorkspace` é a fonte da verdade. Mesmo que o cookie aponte pra qualquer `EAD_ID`, se o usuário não existe no banco-alvo, o `cross_database_boundary` desloga. Email é a chave de validação.

### 3. `TenantRouter` ganha proteção de escrita

A versão original do router devolvia simplesmente o nome do banco em `db_for_read` e `db_for_write`. Sem proteção. Confiava que o ORM, no contexto do tenant atual, ia escrever no banco certo.

Isso quase nunca quebra. Mas "quase" é o problema. Bastava um signal mal configurado, um `obj.save()` em um lugar inesperado, ou um migration rodando fora de hora, pra escrever no banco compartilhado o que devia ir pro tenant. E como o banco compartilhado é cross-tenant, isso vira leak.

Eu adicionei duas camadas:

- `ALLOWED_APPS_DEFAULT_WORKSPACE`: allowlist de apps que **podem** escrever no banco compartilhado.
- `ALLOWED_MODELS_ON_DEFAULT_WORKSPACE`: whitelist de modelos com granularidade por campo. Mais restritiva que a allowlist por app.

Se uma escrita não passa na whitelist, ela cai em `_route_to_user_workspace`. Essa função tenta achar o workspace certo do usuário no `UserWorkspace`. Se o workspace ainda não foi provisionado, ela chama o eadguru pra criar e fica em polling até estar pronto (timeout de `WORKSPACE_PROVISION_TIMEOUT`, que default é 30s, polling de 2s). Se nem isso resolve, **levanta exceção** em vez de aceitar a escrita silenciosamente.

A postura é fail-loud em vez de fail-open. Eu prefiro um request quebrado e um erro no Sentry a uma escrita silenciosa no lugar errado.

Em desenvolvimento eu curto-circuito tudo isso com `EAD_FORCE_DEFAULT_DB=True`. O comentário no código está lá: "only makes sense in prod where each tenant has its own workspace". Em dev cada um tem só um banco e a proteção atrapalha.

## O `profile_table_patch` (a peça mais estranha)

Tem um caso onde o mesmo `User` tem perfis diferentes em bancos diferentes — o paths de afiliado usam `multi_tenant.Profile`, o resto usa `ead.Profile`. Ambos estão atrelados ao mesmo `User` via uma relação `OneToOne`, mas vivem em apps diferentes. O ORM tem cache de descriptor em runtime e se confunde se você troca de contexto sem avisar.

A solução foi um context manager que troca o descriptor `User.profile` em runtime conforme o request seja afiliado ou não. É feio. Eu sei que é feio. Mas alternativas — duplicar o `User`, criar uma camada de abstração no model — eram mais invasivas pro escopo.

Esse é o tipo de peça que fica num arquivo isolado (`profile_table_patch.py`) com um comentário gigante explicando porque ela existe, justamente porque ninguém vai entender lendo o nome.

## Outros pontos de costura

**Webhooks de pagamento bypassam.** A lista `ALLOWED_URLS` no middleware tem os endpoints de webhook de gateway de pagamento. Eles entram em qualquer banco pra gravar o resultado da cobrança, sem passar pelas checagens de tenant suspended/maintenance/cookie. É necessário porque o gateway não conhece a sessão do usuário — ele bate na URL com o token do evento, e a gente precisa processar.

**Sentry tag por request.** O `set_current_ead` carimba `ead_name` e `ead_id` como tags, então qualquer erro no Sentry já vem rotulado por tenant. Sem isso, debug em multi-tenant vira loteria.

**Cache prefixado por tenant.** Já vinha do trabalho do Diego: `cache_prefix` (django-redis) e `cacheops_prefix` (cacheops) usam `<ead_id>:` como prefixo. Eu adicionei um `APICache` por-request que limpa no fim do `__call__` do middleware — útil pra evitar leak de cache entre requests no mesmo processo.

**Migrações.** O `allow_migrate` orquestra a separação: o app `multi_tenant` migra no banco compartilhado em produção, no `default` em testes; os outros apps migram nos bancos por-tenant. Isso parece pequeno até você esquecer e migrar a tabela `UserWorkspace` em todos os bancos do mundo.

## Onde fica e onde não fica honesto

Algumas coisas dessa feature foram codificadas pelo Diego antes de mim — o `setup_db_connection`, a estrutura inicial do app `multi_tenant`, a base do `TenantRouter`. Eu construí em cima. O salto arquitetural (cookie de seleção, `DatabaseBoundaryMiddleware`, `cross_database_boundary`, proteção de escrita, `profile_table_patch`, `UserWorkspace` no eadguru) foi meu, mas foi possível porque a base estava lá.

Não confirmei em produção que o `_route_to_user_workspace` é caminho frio (espero que sim — escritas inadvertidas deveriam ser raras). Não tenho métricas de quantos usuários efetivamente alternam entre plataformas no dia a dia. Toda a feature foi consolidada num squash gigante em março/2026, então a história de iteração ficou parcialmente perdida no histórico — outra dívida que esse post tenta consertar narrativamente.

A pergunta que sempre fica em multi-tenant é: até quando database-per-tenant escala? Depende do volume de tenants e do peso de cada um. No caso desse projeto, eram dezenas de bancos, não milhares, e cada banco era pequeno. Pra esse perfil, database-per-tenant é confortável. Pra outros perfis (milhares de tenants pequenos compartilhando recursos), schema-per-tenant ou row-level com tenant ID na chave seriam mais adequados. Não é uma decisão religiosa, é uma decisão de carga.
