---
title: "OAuth2 server-side em Django: quando django-oauth-toolkit não basta"
description: "django-oauth-toolkit cobre o lado cliente. Emitir tokens pra um SaaS multi-tenant federado com credenciais rotativas mora fora do caminho feliz — e é aí que o trabalho realmente começa."
pubDate: 2026-04-29
readingTime: "9 min de leitura"
tag: "auth"
---

A gente costuma pensar em OAuth2 do lado do **cliente**: você é um app, quer falar com a API do Google, segue o fluxo, recebe um access token, manda no header e acabou. Esse é o cenário comum, é didático, e a internet inteira documenta. O problema é que ele só conta metade da história.

A outra metade é quando **você é o servidor de OAuth2**. Outras ferramentas — N8N, Zapier, integrações de terceiros que o seu cliente quer plugar — vão pedir acesso à conta dele dentro do seu produto. Você precisa ter a tela de consentimento (a tal "Allow App X to access your data?"), gerenciar grants, scopes, refresh tokens, revogação. E precisa fazer isso integrado ao modelo de autorização da sua aplicação, não como um sistema paralelo.

Essa é a parte que dói mais, e é a parte que eu trabalhei na plataforma SaaS multi-tenant onde eu estava.

## Por que `django-oauth-toolkit` sozinho não resolve

A `django-oauth-toolkit` (DOT, daqui em diante) é uma biblioteca sólida. Ela te dá os endpoints (`/o/authorize/`, `/o/token/`, `/o/revoke_token/`), os modelos (`Application`, `Grant`, `AccessToken`, `RefreshToken`), e os fluxos padrão. Pra uma aplicação simples, você instala, configura `AUTHENTICATION_BACKENDS`, declara seus scopes em `settings.py`, e pronto.

O que ela **não** te dá:

- Integração entre os scopes do OAuth2 e o seu modelo de autorização interno. Se você tem um sistema de papéis ou flags de permissão, é por sua conta encaixar isso na decisão "este token pode fazer X?".
- Boa UX da tela de consentimento. O template padrão é funcional e feio. Cliente sério não autoriza integração olhando aquilo.
- Defesa contra fluxos sutis. Por exemplo: o usuário não autenticado bate em `/o/authorize/` e a DOT manda direto pra tela de consent — sem exigir login antes. Esse é um bug real que eu corrigi.
- Vocabulário de scope alinhado ao produto. Por padrão você acaba com scopes técnicos (`read`, `write`) que não fazem sentido pro seu cliente final.
- Atribuição de ações. Quando uma integração externa via OAuth2 cria um recurso, quem é o "criador"? O usuário dono do token? A própria integração? Sem decidir e implementar, fica órfão.

A DOT é a base, mas ela é genérica de propósito. A camada que faz ela ser útil pro seu produto você precisa construir.

## A abordagem: vendor + customização cirúrgica

A primeira decisão foi *vendoring*. Em vez de manter `django-oauth-toolkit` como dependência externa, eu (e quem veio antes) fiz uma cópia do código dela pra dentro do repo, em `solyd_ead/oauth2_provider/`. Isso é uma decisão controversa — você assume a manutenção, perde upgrades fáceis, e ganha controle total.

Pro caso, valeu. As customizações que precisamos não eram triviais o bastante pra caber em subclasses ou monkey-patching. Eram em templates, em `views/base.py`, em serializers — coisas espalhadas. Ter a árvore inteira no repo facilitou tanto o entendimento quanto as mudanças cirúrgicas.

Aviso: a maior parte do código nesse app é upstream. Quem clonar isso de mim não está vendo trabalho meu — está vendo o trabalho da equipe `jazzband/django-oauth-toolkit`. Os meus commits ali são pequenos e específicos, nunca uma reescrita do core.

## O que eu mudei (em ordem de impacto)

### 1. Login obrigatório antes do consent

Bug clássico. O fluxo OAuth2 manda o usuário pro endpoint de autorização do servidor com `client_id`, `redirect_uri`, `response_type`, `scope`, `state`. Se o usuário **não estiver logado** quando bater nessa URL, o que deveria acontecer? Resposta certa: redireciona pra login, e depois traz de volta pro consent. A DOT, no nosso ponto da versão, mostrava o consent direto.

A consequência prática: o usuário entrava na tela de "Allow App X to access your data?" sem ter se autenticado, e ao clicar em "Authorize" a aplicação dava erro porque não havia `request.user`. Pior: em alguns navegadores com sessão reciclada, dava pra autorizar como o último usuário que tinha logado naquele browser. Não era exploit ativo, mas era cheiro de problema.

Fix foi adicionar `LoginRequiredMixin` (ou equivalente, dependendo da view) na hierarquia da `AuthorizationView`. Branch isolada, MR pequeno, fácil de revisar. Esse é o tipo de arrumação que parece insignificante mas evita uma classe inteira de incidente.

### 2. Redesign do modal de consent

A tela padrão do DOT é uma `<form>` em HTML cru com a lista de scopes em `<ul>`. Funciona. Não dá confiança nenhuma pro usuário final — parece phishing. Eu redesenhei em cima do design system (Vuexy Bootstrap 5) com layout consistente com o resto do produto: header com nome da integração, descrição, lista de scopes em cards explicáveis, botões claros de "Authorize" e "Cancel", e um link discreto pra revogar depois.

Detalhe importante: o **texto** de cada scope foi reescrito do nível "view_courses" pro nível "Read your courses and lesson contents". Quem autoriza não é dev. Quem autoriza é o admin do cliente, e ele precisa entender o que tá acontecendo.

### 3. Movi a página de gerenciamento OAuth2 pro submenu de Integrações

Detalhe de IA (information architecture). A página onde o cliente final via os apps OAuth2 que ele tinha autorizado estava no nível superior do admin, com chamada pouco intuitiva. Movi pra dentro do submenu "Integrações", junto com Webhooks e API Keys, e ajustei a chamada na sidebar. Pequeno, mas o efeito de discoverability foi visível.

### 4. Scopes alinhados aos papéis

Esse é o ponto onde o OAuth2 toca a refatoração ABAC que eu fiz na mesma janela (escrevi sobre ela em outro post). Os scopes não viraram conceito técnico separado. Cada scope mapeia diretamente em um papel do sistema de autorização: `webhook`, `courses`, `gurupay`, `statistics`, `marketing`, `editor`, `team`, `admin`. Isso tem dois efeitos.

Primeiro: o `Oauth2PermissionManager` aplica a interseção entre os papéis máximos do dono do token e os scopes do token, sem precisar de tabela de tradução. Papel é scope.

Segundo: cliente que autoriza vê uma lista que combina com áreas que ele já reconhece no produto. "Allow X to read your **courses**" é entendível; "Allow X to access scope `read:resources:c`" não é.

Essa decisão não custou nada e simplificou a manutenção. Toda vez que eu adicionei um papel novo, o scope correspondente entrou de graça.

### 5. Caso N8N: scope `webhook` faltando

Caso real que eu resolvi e que ilustra como a integração com modelo interno paga. Cliente plugou N8N. N8N pediu o scope `webhook`. O scope não estava na lista de scopes disponíveis no servidor, então o token saía sem essa permissão e as automações N8N silenciosamente falhavam.

Num modelo onde scopes são entidade técnica separada, isso seria um bug com retrabalho. No modelo onde scope = papel, foi: adicionar `webhook` como scope disponível, ajustar a UI de seleção, mergear, deploy. Fim. Branch dedicada, MR pequeno, tudo no lugar.

## A peça do design ABAC que casa com OAuth2

Vou ser breve aqui porque tem um post inteiro só sobre isso, mas o ponto é: o servidor OAuth2 emite tokens de duas formas, e a forma como o sistema decide o que cada token pode fazer é diferente.

- **`Grant` / `AccessToken` (OAuth2 normal)**: o token pertence a um usuário humano. O `Oauth2PermissionManager` deduz os papéis máximos do usuário e intersecta com os scopes do token.
- **`ApiCredential` (server-side, fora do fluxo OAuth2)**: a credencial tem `roles` e um `custom_role` próprios. O `ApiPermissionManager` **não consulta o usuário dono** — usa o que está na credencial. Granularidade fina.

A separação é o que permite que cada um evolua sem arrastar o outro. OAuth2 é o caminho pro cliente final autorizar integrações de terceiros. `ApiCredential` é o caminho pro próprio cliente criar uma chave server-side com permissões customizadas pra um app dele. São casos diferentes que precisam de UX e de modelo diferentes.

## Pontos que merecem qualificação

A maior parte do código no app `oauth2_provider/` não é minha — é da `django-oauth-toolkit`. Meus commits ali são focados nas mudanças listadas acima. Se você for ler o repo, a percepção pode ser de "ele tocou pouca coisa". É verdade. Mas as poucas coisas que toquei são justamente o que tornou a DOT viável pro nosso produto.

Eu não escrevi um servidor OAuth2 do zero. Quem quer aprender o protocolo no nível mais profundo vai querer ler a [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) e talvez implementar um draft simples só pra aprender. Mas pra produto em produção com timeline real, vendor-and-customize foi a aposta certa, e é a aposta que eu refaria.

A integração com a refatoração ABAC foi o que fez tudo encaixar. Se você está pensando em adicionar OAuth2 server-side num produto que já tem um modelo de autorização rico, faça isso na mesma janela de trabalho. Tentar fazer separado deixa pontas soltas que doem por anos.
