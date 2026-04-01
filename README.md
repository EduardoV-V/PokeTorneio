Site para gerenciar torneio, e isso

1. Crie um repositório chamado `PokeTorneio` no GitHub
2. Faça push do código para a branch `main`
3. Vá em **Settings → Pages** e escolha **GitHub Actions** como source
4. O workflow em `.github/workflows/deploy.yml` fará o deploy automaticamente

> ⚠️ Se o nome do seu repositório for diferente, edite o campo `base` em `vite.config.js`

## 🛠️ Personalizando jogadores

Edite o arquivo `src/utils/data.js` e altere o array `DEFAULT_PLAYERS` com os nomes dos seus jogadores.

```js
export const DEFAULT_PLAYERS = [
  { id: 1, name: 'SeuNome', wins: 0, losses: 0, icon: null },
  // ...
]
```

## 📦 Tecnologias

- React 18 + Vite 5
- React Router DOM v6
- PokéAPI (https://pokeapi.co)
- LocalStorage para persistência
- CSS puro com variáveis temáticas
- Fonte: Press Start 2P + Nunito (Google Fonts)
