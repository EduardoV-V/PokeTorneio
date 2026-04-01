# 🏆 Torneio Pokémon

Site para gerenciar torneios de Pokémon com fase de pontos corridos, chave eliminatória e montagem de times via PokéAPI.

## ✨ Funcionalidades

- **Pontos Corridos** — tabela com 9 jogadores, vitórias/derrotas ajustáveis, ordenação automática por pontos
- **Fase Eliminatória** — chave com os top 4 jogadores, semifinais e final interativas
- **Times** — cada jogador monta seu time de 9 Pokémon com busca por nome, tipo e geração via PokéAPI
- **Persistência** — todos os dados salvos no `localStorage` do navegador
- **Fotos personalizadas** — cada jogador pode ter sua própria foto/ícone

## 🚀 Rodando localmente

```bash
npm install
npm run dev
```

## 🌐 Deploy no GitHub Pages

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
