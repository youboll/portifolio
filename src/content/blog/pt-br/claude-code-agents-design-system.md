---
title: "Orquestrando dezenas de agentes Claude Code para migrar um design system"
description: "Liderando a migração de um design system com agentes Claude Code orquestrados — o que funcionou, o que não funcionou, e três coisas que refaria diferente."
pubDate: 2026-04-29
readingTime: "12 min de leitura"
tag: "estudo de caso"
---

Em 2026, eu liderei uma frente da migração do design system de uma plataforma SaaS multi-tenant que eu mantinha junto com mais dois ou três devs. Saímos de Fomantic UI (um fork do Semantic UI, dependente de jQuery) pra Vuexy Bootstrap 5 dentro de templates Django. A migração toda — admin, portal do aluno, checkout, fluxos de auth — passou por algumas semanas de execução, com picos curtos onde a coisa rodava em paralelo de um jeito que sozinho eu não conseguiria.

Esse post é sobre como eu organizei a parte que coube a mim, o que funcionou, e três coisas que eu refaria diferente.

## O ponto de partida

Fomantic UI tinha sido a aposta do projeto desde 2019. As classes eram semânticas e bonitas de ler (`ui large primary button`, `eight wide column`), mas o pacote inteiro vinha com jQuery, build LESS+Gulp e ~50 componentes carregados em bloco. Cada modal, dropdown, calendário e validador era inicializado imperativamente depois do DOM ready, em arquivos `.mjs` espalhados pela árvore. Pra rodar uma página simples, o navegador puxava muita coisa.

A decisão de migrar não foi minha sozinha. O Diego, que era o arquiteto-mor do monorepo, tinha avaliado a hipótese de ir pra Vue 3 + Vuetify e desistido (com razão). A escolha pragmática foi Vuexy **Bootstrap 5**, não a versão Vue. Isso preservou o template engine do Django, evitou virar SPA e manteve SEO. O Diego foi quem montou o esqueleto inicial — `templates/vuexy/base.html`, a herança de templates, a estrutura de `static/vuexy/` — em março/2026.

O que sobrou pra eu liderar foi a frente do admin: dezenas de páginas de listagem, CRUD, dashboards, com a complicação extra de que a mesma base de código serve dois servidores diferentes via flag `MEMBERS_MODE` (admin e portal do aluno). Mesmo template, condicional dentro.

## Por que agentes em vez de fazer manualmente

Eu fiz a conta antes de decidir. Reescrever uma página média do admin Fomantic pra Vuexy levava de 2 a 4 horas, dependendo da complexidade. Eram páginas demais. Em paralelo, o Vuexy traz um catálogo de componentes que você precisa internalizar pra usar bem — não é "trocar `class='ui button'` por `class='btn'`". É repensar grid (de 16 colunas pra 12), trocar ícones (Font Awesome → Material Design Icons via Iconify), adaptar datatables, lidar com diferenças de markup em forms.

Fazer manualmente, sozinho, eu estimava em meses. Com a equipe inteira focada nisso por seis semanas, talvez. Com agentes orquestrados, eu apostei que daria pra paralelizar de um jeito que humanos não conseguem — porque o gargalo deixa de ser tempo-de-desenvolvedor e vira capacidade-de-revisão.

A aposta deu certo, mas com asteriscos.

## A arquitetura: skills + worktrees + subagentes

Eu construí três coisas antes de soltar agente nenhum.

**Skills customizadas no Claude Code.** No diretório `.claude/skills/` do repo, eu escrevi instruções específicas pra essa migração. As principais:

- `create-vuexy-page` — pipeline de "planejar → implementar → verificar" pra reconstruir uma página Django do zero em Vuexy. O cabeçalho dela diz literalmente "nunca adapte ou reutilize componentes Fomantic". Era a regra que eu precisava codificar porque a tentação natural de qualquer agente (e de qualquer humano com pressa) é tentar fazer find-and-replace de classe CSS. Não funciona. Os componentes têm contratos diferentes.
- `mindzclub-design` — a skill mãe, que cobria a tradução de Figma pra Vuexy nos dois servidores (admin e portal). Ela documentava também um atalho que eu criei só pra agentes: uma rota `/ead/mcp-login/` gated por `DEBUG=True` + localhost, que autenticava com 1 navegação em vez de preencher formulário. Detalhe pequeno, economia enorme em volume.
- `vuexy-components` — catálogo dos componentes disponíveis. Era a "documentação que eu queria ter" pros agentes consultarem.
- `vuexy-to-figma` — caminho inverso, pra gerar um relatório de fidelidade visual da página migrada.

**Subagentes especializados.** Dentro de `mindzclub-design` eu separei prompts de quatro a cinco perfis distintos: revisão de design, verificação funcional, verificação de integridade do markup, comparação visual com Figma. A ideia: cada página, depois de migrada, era auditada por mais de um par de olhos automáticos antes de eu olhar. Cada subagente carregava só o contexto que precisava.

**Worktrees do git em vez de branches.** Cada agente principal trabalhava num diretório isolado via `git worktree add`. Isso evita o inferno de troca de branch, mantém cada execução estanque, e me permite ter vários agentes editando arquivos completamente diferentes ao mesmo tempo sem stomp. No final, o merge voltava direto pra branch principal — então no histórico do GitLab não aparece "vuexy-01, vuexy-02"; aparecem squash commits grandes assinados por mim. Isso causou um efeito colateral chato (volto nele).

A estrutura mental era: agentes principais lidam com uma página por vez, do começo ao fim, e disparam subagentes pra verificar dimensões específicas. Eu ficava em cima da fila, validando o que voltava, juntando os PRs, resolvendo conflitos.

Quantos agentes principais simultâneos? Variou. Em pico, o suficiente pra eu ter trabalho de revisão sem parar por uma semana inteira. Em janelas mais frias, um ou dois rodando enquanto eu fazia outras coisas. O número exato vivia mais na minha cabeça do que num orquestrador formal — e essa é uma das coisas que eu refaria diferente.

## O que funcionou

A primeira coisa boa foi a reescrita da fachada de datatables. Em vez de migrar página de listagem por página de listagem, eu reescrevi a base — `datatable_base/templates/vuexy_datatable.html` e o `datatable_vuexy.mjs` que vai junto. Dezenas de telas de listagem ganharam o visual novo trocando só o include base. Isso é alavanca de produtividade que não tem nada a ver com agente nenhum: é arquitetura. Mas casou bem com o pipeline porque os agentes não precisavam reaprender o jeito de cada listagem.

A segunda coisa boa foi o atalho `/ead/mcp-login/`. Parece bobo. Quem nunca tentou rodar um agente Chrome DevTools MCP num app autenticado sabe que 80% do tempo dele é preenchendo o formulário de login. Uma rota DEBUG-only que loga o agente direto economizou uma quantidade absurda de retries. Tooling sob medida pra orquestração paga rápido.

A terceira foi a auditoria visual automatizada. Os subagentes geravam screenshots e comparavam com o Figma de referência. Quando havia divergência, vinha um relatório curto (`sidebar-figma-divergencias.md` foi um dos exemplos) que eu lia em 30 segundos antes de aprovar. Sem isso, eu estaria abrindo cada página manualmente. Com, eu lia diff de prosa.

## O que eu refaria diferente

**O protocolo de despacho era informal.** Quem decidia qual página ia pra qual worktree? Eu, na minha cabeça, olhando o backlog. Sem fila, sem priorização escrita, sem política de retry quando um agente falhava. Funcionou porque eu estava 100% dedicado, mas é frágil — se eu tivesse ficado doente uma semana, ninguém continuava do ponto. Da próxima vez, eu escreveria o despacho como código (uma fila simples, um JSON de status, não precisa ser orquestrador profissional).

**Mensagens de commit ficaram horríveis.** Como cada worktree mergeava direto via squash, os commits que sobraram no histórico têm rótulos como "test: add test cases for partial invoice refunds" pra um diff de 240 arquivos com mudanças massivas em datatable Vuexy. Quem for ler o git log seis meses depois vai ter um trabalhão pra entender o que aconteceu. Solução simples seria escrever um template de commit que descreva o conteúdo real do squash — eu não fiz, e é o tipo de dívida que dói no longo prazo. Esse próprio post está parcialmente exorcizando essa dívida.

**Eu era o único gate de qualidade.** Os agentes geravam, os subagentes auditavam, e eu mergeava. Não passou por code review humano em volume. Em uma equipe que tava em outro modo de trabalho isso seria inaceitável; no nosso caso funcionou porque o Diego e o resto da equipe tinham banda zero pra revisar. Mas é uma postura que eu não recomendaria por default.

## A pergunta que importa

Vale a pena? Pra esse caso específico — migração de design system com componentes bem definidos, possibilidade de verificação automatizada, e uma fachada de datatables dando alavanca — valeu, e com folga. O multiplicador que eu senti foi de uma ordem de grandeza, não duas. Não substituiu o pensamento arquitetural (Diego ainda fez o trabalho mais importante: escolher Vuexy Bootstrap 5 sobre Vue 3 e montar a base). Substituiu a parte mecânica de aplicar essa decisão em centenas de arquivos.

Onde eu **não** apostaria nessa metodologia: features novas com requisitos vagos, mudanças que dependem de contexto de produto que não cabe em prompt, e qualquer coisa onde a verificação automatizada é fraca (lógica de negócio sutil, regras fiscais, autorização). Pra essas, agentes ajudam mas o gargalo continua sendo humano.

A migração caminhou.
