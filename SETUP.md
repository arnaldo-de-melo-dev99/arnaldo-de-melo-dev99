# Setup do README Dinâmico

Este repositório usa um README base com blocos gerados automaticamente a partir da GitHub API.

## O que é actualizado

- `Impacto em Tempo Real`
- `Projetos reais em tempo real`

## Tokens

- O script funciona com dados públicos sem token.
- Se quiseres mais margem de rate limit ou preparar o perfil para dados privados no futuro, cria o secret `README_GITHUB_TOKEN` no GitHub Actions.
- O workflow lê esse secret e passa-o como `README_GITHUB_TOKEN`.
- O token não deve ser escrito no código nem no README.

## Scopes sugeridos

- Para dados públicos, normalmente não precisas de scopes especiais.
- Se quiseres usar um token pessoal, um classic PAT com `read:user` já ajuda bastante.
- Se mais tarde quiseres incluir repositórios privados, usa os scopes adequados para leitura de repositórios.

## Como executar localmente

```bash
node scripts/update-readme.mjs
```

Se quiseres forçar o utilizador ou o limite de projectos:

```bash
GITHUB_USERNAME=arnaldo-de-melo-dev99 PROJECT_LIMIT=5 node scripts/update-readme.mjs
```

## Variáveis suportadas

- `GITHUB_USERNAME`: utilizador GitHub a analisar.
- `PROFILE_REPO_NAME`: repositório do perfil a excluir da lista de projectos.
- `PROJECT_LIMIT`: número de projectos a mostrar.
- `README_PATH`: caminho do README a actualizar.
- `README_GITHUB_TOKEN`: token opcional para chamadas autenticadas.

## Banner

- O README usa `./assets/arnaldo.png` como banner principal.
- Se quiseres trocar a imagem, basta substituir esse ficheiro por outro com o mesmo nome.
- Mantém a imagem em formato largo para o banner continuar elegante no GitHub.

## Como o bloco de projectos funciona

- Os repositórios são ordenados pela data de criação.
- O repositório do perfil é excluído para não misturar configuração com projectos.
- As techs vêm das linguagens detectadas pela API.
- Quando criares um novo repositório, ele sobe para o topo na próxima execução do workflow.
- O GitHub README tem limites de CSS interativo, por isso o visual é limpo e leve em vez de depender de hover customizado.

## Agendamento

- O workflow corre de hora em hora.
- Também podes disparar manualmente com `workflow_dispatch`.
