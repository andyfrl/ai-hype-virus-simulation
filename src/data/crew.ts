import mtugaQuotes from './quotes/mtuga.json';
import melonTuskQuotes from './quotes/melon_tusk.json';
import samusAltmanQuotes from './quotes/samus_altman.json';

export interface CrewMember {
  id: string;
  name: string;
  image: string;
  cost: number;
  quotes: string[];
}

export const CREW_MEMBERS: CrewMember[] = [
  { id: 'mtuga',        name: 'MtUGA',        image: '/mtuga.jpeg',        cost: 999, quotes: mtugaQuotes },
  { id: 'melon_tusk',   name: 'Melon Tusk',   image: '/melon_tusk.jpeg',   cost: 999, quotes: melonTuskQuotes },
  { id: 'samus_altman', name: 'Samus Altman', image: '/samus_altman.jpeg', cost: 999, quotes: samusAltmanQuotes },
];
