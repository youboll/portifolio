---
title: "Caçando N+1: como eu sistematizo gargalos de query em datatables Django"
description: "Datatable lento é quase sempre N+1. A rotina de detetive que virou uma skill do Claude Code — gatilhos, instrumentação, critérios de sucesso, e os dois casos onde foi aplicada."
pubDate: 2026-04-29
readingTime: "9 min de leitura"
tag: "performance"
---

Datatable lento é uma das experiências mais frustrantes que um produto pode entregar. O usuário faz uma busca, espera, vê o spinner girando, troca de aba pra abrir o YouTube, volta. A tabela carregou. Você como dev olha aquilo e sabe que é N+1, mas onde exatamente, e como provar?

Eu virei essa rotina de detetive numa skill do Claude Code chamada `optimize-datatable`, no projeto onde eu trabalhei. Ela documenta o método que eu já vinha usando manualmente — o que era um conjunto de truques na cabeça virou um playbook reproduzível. Esse post explica o método e mostra os dois casos onde apliquei, com honestidade sobre o que tá auditado e o que não tá.

## A premissa: detecção é estática + execução controlada, não APM mágico

Tem gente que pensa em "performance" e visualiza um APM caro, dashboards bonitos, alertas P95. Isso tudo é válido. Mas em datatable Django específico, o caminho que pega 80% do problema é mais humilde:

1. Ler o código da `BaseDatatableView` e procurar por gatilhos conhecidos.
2. Instrumentar uma execução controlada via shell do Django, com `connection.queries` ligado.
3. Ler o `EXPLAIN` das queries piores.
4. Decidir o que muda, aplicar, repetir.

A skill orienta o agente (ou um humano disciplinado) a fazer exatamente isso. Não substitui APM, mas também não exige nada que você não tenha em qualquer projeto Django.

## Os gatilhos que eu procuro

Os padrões que mais aparecem em datatables Django, em ordem de frequência:

**Annotations pesadas no `get_initial_queryset()`.** Um `annotate(Sum=...)`, `Count`, `Subquery`, `Case/When` ou `ExpressionWrapper` no queryset base envenena o `COUNT(*)` que o `django_datatables_view` faz pra contar total de registros. O ORM tenta replicar a annotation no count e a query fica gigante sem necessidade. Sintoma: contagem de total demora muito mais que a query de dados em si.

**Lambda em `add_column(...)` que acessa FK ou M2M.** É o N+1 clássico. Cada linha da tabela dispara uma query nova pra carregar a relação. Sem `select_related` ou `prefetch_related` no queryset base, isso multiplica linearmente.

**`@property` ou método no model que faz query interna.** Esse é o sutil. Você lê o código do datatable e parece limpo, mas a coluna acessa `item.profile.last_active` — e `last_active` é uma `@property` que faz `Action.objects.filter(actor=self.user).order_by('-timestamp').first()`. `select_related` não resolve, porque o ORM não sabe que aquela `@property` faz query.

**`__icontains` em `search_fields` sobre coluna sem índice.** Funciona, mas table-scan completo a cada busca. Em tabela grande, é segundo de UI.

**Coluna `orderable=True` apontando pra annotation.** Se você marca a coluna como ordenável e ela é uma annotation, ordenar a tabela aciona a annotation no `ORDER BY`, o que costuma forçar `Using temporary; Using filesort` no `EXPLAIN`.

## A instrumentação

A parte mais útil da skill é a instrumentação de medição. Não é difícil mas a maioria dos devs não tem isso na ponta da língua.

```python
from django.test import RequestFactory, override_settings
from django.db import connection, reset_queries

with override_settings(DEBUG=True):
    reset_queries()
    factory = RequestFactory()
    request = factory.get('/admin/datatable/users/', {
        'draw': 1,
        'start': 0,
        'length': 50,
        'order[0][column]': 0,
        'order[0][dir]': 'asc',
    })
    request.user = some_admin_user
    
    view = UsersDatatable.as_view()
    response = view(request)
    
    print(f"Queries: {len(connection.queries)}")
    print(f"Slowest: {sorted(connection.queries, key=lambda q: float(q['time']), reverse=True)[:5]}")
```

Isso te dá em segundos o número exato de queries por request e quais foram as piores. Em um datatable com N+1 sério, você vai ver 50+ queries. Em um datatable saudável, 3 a 5.

Pra leitura do `EXPLAIN`, a skill mantém uma tabela mental de o que olhar:

- `type: ALL` → table scan, falta índice ou query mal formada.
- `Extra: Using temporary` → o servidor materializou em memória, geralmente por GROUP BY ou ORDER BY em coluna sem índice.
- `Extra: Using filesort` → ordenação fora do índice, custa proporcional ao tamanho do result set.
- `key: NULL` em coluna que devia estar indexada → o índice não foi escolhido (pode ser cardinalidade baixa, pode ser conversão de tipo silenciosa).
- `rows: <muito grande>` → o otimizador está estimando varrer muita coisa; revisar filtros.

## Critérios de sucesso

A parte que eu acho mais importante da skill, e que vejo pouca gente codificar, são os **critérios de aceitação**. O que conta como "otimizado"?

- **Número de queries é constante em N**, não cresce com o tamanho da tabela. Se a query de página 1 (50 itens) faz 5 queries, a página 100 (50 itens) também precisa fazer 5. Se faz 55, é N+1 mascarado.
- **Tempo de COUNT cresce no máximo proporcional a N**, não a N². Se você tem JOIN duplicador no `get_initial_queryset()` (M2M reversa sem cuidado), o COUNT vira O(N²) silenciosamente.
- **`EXPLAIN` não mostra `type: ALL`** em tabelas grandes.
- **Tempo total < 1s para tabelas até 100k registros**.

Esses critérios são o que evita o ciclo "achei que tinha otimizado". Sem eles, você muda alguma coisa, sente que melhorou, e seis meses depois descobre que a curva continua quadrática só que com constante menor.

A skill inclui um benchmark em escala — você roda o datatable em volumes crescentes (100, 1k, 5k, 10k, 50k, 100k linhas via `bulk_create` em batches), salva os tempos em JSON, e classifica heuristicamente o crescimento comparando a razão `tempo_final / tempo_inicial` com `N_final / N_inicial`. Se a primeira é ≈ a segunda, é O(n). Se é muito maior, é O(n²) ou pior. Se é constante, é O(1). Bonito de ver com `matplotlib` (o backend Agg, sem GUI).

## Caso 1: `UsersDatatable` — coluna "Ativo em"

Esse é o caso que motivou a criação do `BulkBinder`, um helper que eu adicionei em `datatable_base/utils.py`.

A coluna "Ativo em" mostrava a data da última ação do usuário no sistema. Implementação inocente:

```python
def render_last_active(self, item):
    return item.profile.last_active  # property que faz query
```

A `@property` `last_active` no `Profile` fazia:

```python
@property
def last_active(self):
    return Action.objects.filter(
        actor_object_id=self.user_id
    ).order_by('-timestamp').first().timestamp
```

Pra cada linha de uma página de 50 usuários: 1 query na `Action`. 50 queries só pra essa coluna. Pior, `select_related('profile')` ajuda a carregar o profile mas não a property — a property continua disparando query independente.

A solução foi parar de avaliar a property por linha. Em vez disso:

1. No `prepare_results()` do datatable, depois de pegar o queryset paginado, emitir **uma única query agregada**: `Action.objects.values('actor_object_id').annotate(last=Max('timestamp'))` filtrada pelos `user_id`s da página.
2. Construir um dicionário `{user_id: last_timestamp}` em memória.
3. "Bindar" esse dicionário aos itens do queryset por uma chave virtual — daí o nome `BulkBinder.bind('last_active', ...)`.
4. A coluna passa a ler `item.last_active_bound` que é só lookup em dict, zero query.

50 queries viram 1 query. Em volume de página, isso é quase o teto da economia possível pra uma coluna desse tipo.

Uma armadilha que eu codifiquei na skill e quase me pegou na primeira vez: se o `Action.Meta.ordering` está definido (e estava), e você usa `.values('actor_object_id').annotate(...)`, o Django **injeta os campos de ordering no GROUP BY**. Resultado: você acha que vai receber uma linha por usuário e recebe uma linha por (usuário, timestamp), o que é uma linha por action, ou seja, nada agrupado. O fix é chamar `.order_by()` (vazio) antes de `.values().annotate()` pra desabilitar o ordering padrão. É uma daquelas pegadinhas do ORM que não está em tutorial nenhum.

## Caso 2: dashboard do gerente — JOIN duplicador

Esse é mais sutil. A query base do dashboard de pagamentos do gerente fazia:

```python
Payment.objects.filter(
    Q(account_key=key) | Q(splits__account_key=key)
)
```

A intenção: pegar pagamentos onde a conta gestora é o titular **ou** uma das partes do split. Faz sentido na cabeça. Faz menos sentido no SQL.

`splits` é uma reverse M2M. Quando você usa `Q(splits__account_key=...)`, o ORM cria um JOIN com a tabela de splits. Isso significa que **um pagamento com 3 splits aparece 3 vezes no result set bruto**. O Django tenta esconder isso com `DISTINCT` (que tem custo próprio) ou você acaba lidando com duplicação no código.

Pior: o `COUNT(*)` que o datatable faz agora também é sobre o JOIN duplicador. Você conta 3000 linhas em vez de 1000 pagamentos.

A solução foi trocar o JOIN por um semi-join via subquery `Exists`:

```python
Payment.objects.filter(
    Q(account_key=key) | Q(
        pk__in=PaymentSplit.objects.filter(account_key=key).values('payment_id')
    )
)
```

Ou, equivalente:

```python
Payment.objects.filter(
    Q(account_key=key) | Exists(
        PaymentSplit.objects.filter(payment=OuterRef('pk'), account_key=key)
    )
)
```

`Exists` não duplica linhas — ele responde "tem ou não tem split com essa conta?". O result set sai limpo, o COUNT volta a ser real, e o plano de execução fica simétrico.

## O que eu não tenho

Vou ser explícito sobre o que essa skill **não** documenta numericamente. Eu não tenho registrado em commit nem em PR o tempo "antes" e "depois" das duas otimizações acima. Sei que melhoraram porque o método que descrevi prova qualitativamente, e porque dava pra sentir clicando. Mas se você me perguntar "passou de 800ms pra 80ms?", eu não tenho o número.

Honestidade calibrada: o caso `UsersDatatable` em particular tinha N+1 visível com `connection.queries` no console — saímos de algumas dezenas pra um número de um dígito. O caso do dashboard gerente eliminou duplicação de linhas, então o ganho depende do número médio de splits por pagamento na base do cliente, que eu não medi.

A skill também só foi formalmente aplicada nesses dois casos, embora eu tenha aplicado o mesmo método manualmente em vários outros lugares antes de virar skill. Quem ler o repo só vai ver um uso do `BulkBinder` no momento — em `UsersDatatable`. A abstração existe, o índice de adoção ainda é baixo.

## O que eu tirei desse trabalho

A coisa mais importante: **datatable em Django é uma superfície que recompensa ferramentas reusáveis muito mais do que otimizações pontuais**. Investir 1h em `BulkBinder` rende em todo datatable que toca o mesmo padrão de coluna. Investir 1h em otimizar uma coluna específica rende só naquela coluna.

A segunda: **codificar critérios de sucesso por escrito é o que separa "achei que melhorou" de "melhorou".** O benchmark em escala parece exagero pra uma otimização. Não é. É o que te impede de aceitar uma melhoria de constante quando o problema era de ordem de magnitude.

A terceira, mais filosófica: **escrever a skill é metade da diversão**. Antes da skill, eu tinha esse método na cabeça, e quando precisava aplicar dependia de eu lembrar do padrão certo. Depois da skill, ela aplica o método em qualquer datatable que eu apontar. Eu não substitui a intuição — codifiquei ela. E o exercício de codificar te força a explicitar coisas que você não sabia que sabia.
