---
title: "De RBAC pra ABAC: quando a explosão de papéis vira problema"
description: "Quando cinco papéis viraram quarenta e dois com metade terminando em `_custom_v2`, o modelo deixou de caber na realidade do produto. Como reconstruí autorização em torno de atributos no escopo da credencial dentro de um SaaS Django."
pubDate: 2026-04-29
readingTime: "10 min de leitura"
tag: "auth"
---

Antes de descrever a refatoração em si, vale dizer o que exatamente eu fiz e o que não fiz. Eu construí, dentro de uma plataforma SaaS multi-tenant em Django, um app de autorização (`permissions/`) novo, e plugado a ele uma API V2 OAuth2 onde a credencial passou a carregar **seu próprio** conjunto de papéis e permissões customizadas — desacoplado do usuário humano dono dela. Isso não foi mexer no login da plataforma (sessão Django, signup, esqueci a senha) — esses ficaram intocados. O que mudou foi a superfície de autorização que a API e o servidor OAuth2 expõem pra integrações externas.

Em código real, "RBAC" e "ABAC" não aparecem nominalmente em nenhum comentário. Essa é a leitura técnica do que o sistema virou, não um manifesto que eu escrevi. Se algum colega pegar o repo e procurar pelas siglas, não vai achar. Achei justo abrir com isso.

## O modelo antigo, que não tinha um nome bonito

O que existia antes do refactor era um híbrido entre flag-based e role-based, com cara de RBAC. No `Profile` do usuário tinha campos como `admin`, `team`, `staff`, e uma porção de `*_perm` (`courses_perm`, `gurupay_perm`, `marketing_perm`, etc.). Cada flag autorizava um conjunto difuso de ações. Não havia uma fonte da verdade clara — pra saber se alguém podia fazer X, você varria três ou quatro lugares: Profile, vínculo com curso (instrutor de qual?), pertencimento a equipe, e às vezes lógica direta na view.

A V1 da API tinha o pior cenário: autenticava contra um modelo `AppApi` legado e devolvia um `ApiUser` que era basicamente um sentinela. Quando uma integração chamava a API e disparava um upload, o arquivo ficava órfão ou atribuído ao stub. Era uma dívida técnica que ninguém olhava porque o sistema "funcionava".

A explosão começou quando o produto pediu cenários que não cabiam mais no modelo. Coisas como:

> "Esse cliente quer dar pra integração dele acesso de leitura em cursos, escrita em matrículas, mas só nos cursos que esse colaborador específico criou."

Esse "mas só nos cursos que" é a frase-chave. Ela não cabe num papel `editor` global. Não cabe nem em uma combinação fixa de papéis. Cabe num predicado que recebe `(sujeito, objeto-alvo)` e olha se o sujeito é o criador. Isso é ABAC pelo livro, mesmo que ninguém na sala tivesse usado a palavra.

A esta altura você tem três opções:

1. Adicionar mais papéis ao RBAC. Vira a explosão clássica — cada novo recorte vira um papel novo, e em pouco tempo você tem 80 papéis com diferenças sutis que ninguém entende.
2. Criar um sistema de overrides em cima dos papéis. Bandagem em bandagem, e a cada feature nova você reza pra não quebrar a soma.
3. Substituir o motor por um que aceite atributos como entrada da decisão. Foi a opção que eu escolhi.

## A arquitetura nova

Eu criei um app Django chamado `permissions/` com três peças.

**`permissions.py` — declaração dos papéis padrão.** É um dicionário aninhado por recurso → ação → predicado. O predicado pode ser `True`, `False`, ou uma função (geralmente lambda) que recebe `(sujeito, objeto, **kwargs)` e devolve booleano. No total foram declarados onze papéis padrão (`root`, `admin`, `team`, `courses`, `gurupay`, `statistics`, `marketing`, `editor`, `integration`, `teacher`, `student`) cobrindo recursos como matrícula, curso, conteúdo, prova, fórum, certificado, pagamento, assinatura, supressão de e-mail, créditos, cupons. São mais de seiscentas linhas só de declaração, e tudo bem que sejam — ler é trivial, e o que importa é que o que pode ou não pode acontecer está num lugar só.

**`typing.py` — tipagem estrutural dos recursos.** Pra cada recurso existe um `TypedDict` que diz quais ações ele aceita. Recurso de matrícula expõe `view`/`create`/`update`. Recurso de certificado expõe `view`/`update`/`download`/`reissue`/`refresh`/`cancel`. Isso me dá garantia de forma — se alguém escrever um papel novo apontando pra uma ação que não existe, o validador pega em desenvolvimento, não em produção. No final do `permissions.py` eu rodo um validador (`JsonValidator(Role, no_extra_keys=False)`) sobre cada papel padrão na inicialização, gated por `DEBUG`. Papel quebrado estoura cedo.

**`permission_manager.py` — o motor.** Aqui mora a separação que faz tudo encaixar:

```
PermissionManager        ←  pra usuário humano
  ├ Oauth2PermissionManager  ←  pra Grant (token OAuth2)
  └ ApiPermissionManager     ←  pra ApiCredential (server-side)
```

A forma de derivar papéis muda em cada caso, mas o motor que avalia o predicado é o mesmo. Pra usuário humano, eu deduzo os papéis aplicáveis em runtime a partir dos atributos do perfil (admin, staff, equipe, flags `*_perm`, vínculo de instrutor). Pra um token OAuth2, eu pego os papéis máximos do dono do token e **intersecto com os scopes** — papéis fora do scope são apagados antes de qualquer decisão. Pra uma `ApiCredential`, eu **não consulto o usuário dono**: pego os papéis e o `custom_role` armazenados na própria credencial. É aqui que mora a granularidade fina.

A `ApiCredential` tem um campo `custom_role` que é um `JSONField` validado contra o `TypedDict` `Role`. Aquele cenário do produto — "leitura em cursos, escrita em matrículas, mas só os cursos que o colaborador criou" — vira literalmente um `custom_role` escrito ad-hoc pra aquela credencial. O cliente, na UI, monta uma "personalidade de permissões" pro app dele e a credencial carrega essa personalidade junto. Não é o usuário dono que tem essa permissão. É a credencial.

## A unificação V1 ↔ V2

O passo que mais arrumou casa foi unificar credenciais. Antes do refactor, V1 e V2 tinham modelos diferentes — V1 contra `AppApi`, V2 nascendo com algo novo. Eu apaguei o ramo legado e fiz a V1 também passar a autenticar via `ApiCredential`. Isso é sutil mas importante: V1 não foi reescrita; só trocou de fonte de identidade. Os endpoints continuaram os mesmos, os contratos continuaram os mesmos. Mas agora cada chamada V1 ou V2 sabe exatamente quem é o `user` dono real (`credential.user`) e quais papéis efetivos a credencial tem.

Como efeito colateral, uploads pararam de ficar órfãos. Antes eu tinha arquivos no S3 atribuídos a um `ApiUser` stub. Depois, todo upload via API é creditado ao usuário dono da credencial — o que arrumou auditoria e recuperação. O commit que fez isso (`fix: Using the credential owner to upload the files`) parece pequeno mas é uma das peças mais importantes da história, porque é o ponto em que predicados ABAC do tipo `lambda user, obj: user.id == obj.created_by_id` finalmente começam a fazer sentido — antes desse commit, `user` era um sentinela e a comparação não significava nada.

## Os scopes do OAuth2 colaram nos papéis

Os scopes do servidor OAuth2 não viraram entidade técnica separada. Cada scope mapeia diretamente em um dos papéis padrão (`webhook`, `courses`, `gurupay`, `statistics`, `marketing`, `editor`, `team`, `admin`). Isso tem dois efeitos. Primeiro, é fácil pro cliente entender — quando ele autoriza uma integração externa, vê uma lista de scopes que casam com áreas que ele já reconhece no produto. Segundo, dá pro `Oauth2PermissionManager` aplicar a interseção com scopes sem precisar de tabela de tradução: papel é scope.

Teve um caso real que confirmou a escolha: integração com N8N parou de funcionar porque o token não tinha o scope `webhook`. Em vez de criar uma exceção ou um papel especial, o fix foi adicionar `webhook` como scope disponível e ajustar a UI de seleção. Isso é o tipo de incidente que num modelo RBAC vira hora de retrabalho. No modelo novo, foi configuração.

## O que ficou pendente, honestamente

O papel `Student` em `permissions.py` tem um comentário meu: `# TODO Needs refactoring to be used in production`. Eu escrevi como protótipo pra destravar fluxo de aluno e nunca voltei pra refinar. Deve estar lá até hoje. Funciona, mas é mais permissivo do que deveria ser pro nível de granularidade que o resto do sistema oferece. Deixei o TODO como dívida visível em vez de comentário casual exatamente pra ele me cobrar.

Outra coisa que eu não cobri: a refatoração ABAC vive no projeto `solyd_ead/`. O outro projeto do monorepo (`eadguru/`) tem o `accounts/` dele e segue com o modelo anterior. Não foi descuido — foi escopo. A ABAC nasceu pra resolver autorização de API/integrações, e essa superfície vive no `solyd_ead`. O `eadguru` é gerenciador central com uma carga de autorização diferente, e mexer nele exigiria uma rodada própria.

E o item desconfortável: as mensagens de commit deste trabalho são curtas. Boas branches isoladas (`api_v2_credential_unification`, `webhook_permission_scope_error`, `move_oauth2_auth_page_to_integrations_submenu`), boa disciplina de MR no GitLab. Mas a justificativa por escrito do "porquê ABAC" não está no repo. Está nos sentimentos de quem viveu, e em conversas que não viraram ADR. Esse próprio post é a primeira tentativa séria de colocar a justificativa em texto.

## O que aprendi

A coisa mais importante que aprendi nessa refatoração é que **autorização tem três coisas que parecem uma só**: como você descreve o que pode acontecer (papéis), como você decide se vai acontecer (motor), e onde você decide (ponto de chamada). Misturar os três no mesmo arquivo é o que cria o caos. Separar — papéis em `permissions.py`, motor em `permission_manager.py`, ponto de chamada nos authenticators — é o que permite que cada um evolua sem arrastar os outros. ABAC não é um modelo melhor só porque "atributo é mais flexível que papel". É um modelo melhor porque, quando você implementa direito, ele força essa separação.

A segunda é que **a credencial precisa ter identidade própria**. No modelo antigo, uma chave de API era uma extensão difusa do usuário humano. No modelo novo, é uma entidade de primeira classe — tem dono, tem papéis, tem `custom_role`, tem ciclo de vida. Isso é o que destrava integrações sérias. Cliente sério não quer dar acesso "do usuário admin" pra uma integração de terceiro; quer dar acesso restrito que faça sentido pro caso dele. ABAC com credencial-cidadã torna isso barato.
