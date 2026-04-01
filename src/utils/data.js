export const DEFAULT_PLAYERS = [
  { id: 1, name: 'Ash', wins: 0, losses: 0, icon: null },
  { id: 2, name: 'Misty', wins: 0, losses: 0, icon: null },
  { id: 3, name: 'Brock', wins: 0, losses: 0, icon: null },
  { id: 4, name: 'Gary', wins: 0, losses: 0, icon: null },
  { id: 5, name: 'Serena', wins: 0, losses: 0, icon: null },
  { id: 6, name: 'Dawn', wins: 0, losses: 0, icon: null },
  { id: 7, name: 'Clemont', wins: 0, losses: 0, icon: null },
  { id: 8, name: 'Iris', wins: 0, losses: 0, icon: null },
  { id: 9, name: 'Cilan', wins: 0, losses: 0, icon: null },
]

export const POKEMON_TYPES = [
  'normal','fire','water','electric','grass','ice',
  'fighting','poison','ground','flying','psychic','bug',
  'rock','ghost','dragon','dark','steel','fairy'
]

export const GENERATIONS = [
  { label: 'Gen I (1-151)', min: 1, max: 151 },
  { label: 'Gen II (152-251)', min: 152, max: 251 },
  { label: 'Gen III (252-386)', min: 252, max: 386 },
  { label: 'Gen IV (387-493)', min: 387, max: 493 },
  { label: 'Gen V (494-649)', min: 494, max: 649 },
  { label: 'Gen VI (650-721)', min: 650, max: 721 },
  { label: 'Gen VII (722-809)', min: 722, max: 809 },
  { label: 'Gen VIII (810-905)', min: 810, max: 905 },
  { label: 'Gen IX (906-1025)', min: 906, max: 1025 },
]

export const TYPE_COLORS = {
  normal: '#a4acaf',
  fire: '#fd7d24',
  water: '#4592c4',
  electric: '#eed535',
  grass: '#9bcc50',
  ice: '#51c4e7',
  fighting: '#d56723',
  poison: '#b97fc9',
  ground: '#f7de3f',
  flying: '#3dc7ef',
  psychic: '#f366b9',
  bug: '#729f3f',
  rock: '#a38c21',
  ghost: '#7b62a3',
  dragon: '#53a4cf',
  dark: '#707070',
  steel: '#9eb7b8',
  fairy: '#fdb9e9',
}

export function getSortedPlayers(players) {
  return [...players].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    if (a.losses !== b.losses) return a.losses - b.losses
    return a.name.localeCompare(b.name)
  })
}

export function getTop4(players) {
  return getSortedPlayers(players).slice(0, 4)
}

export const DEFAULT_BRACKET = {
  phase: 'semis', // 'semis' | 'finals' | 'done'
  semis: [
    { p1: null, p2: null, winner: null },
    { p1: null, p2: null, winner: null },
  ],
  final: { p1: null, p2: null, winner: null },
  champion: null,
}

export function buildBracketFromTop4(players) {
  const top = getTop4(players)
  return {
    phase: 'semis',
    semis: [
      { p1: top[0] || null, p2: top[3] || null, winner: null },
      { p1: top[1] || null, p2: top[2] || null, winner: null },
    ],
    final: { p1: null, p2: null, winner: null },
    champion: null,
  }
}
