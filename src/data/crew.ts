import mtugaQuotes from './quotes/mtuga.json';
import melonTuskQuotes from './quotes/melon_tusk.json';
import samusAltmanQuotes from './quotes/samus_altman.json';

export interface Perk {
  type: 'positive' | 'negative';
  label: string;
  description: string;
}

export interface CrewMember {
  id: string;
  name: string;
  image: string;
  cost: number;
  quotes: string[];
  perks: Perk[];
}

export const CREW_MEMBERS: CrewMember[] = [
  {
    id: 'mtuga',
    name: 'MtUGA',
    image: '/mtuga.jpeg',
    cost: 999,
    quotes: mtugaQuotes,
    perks: [
      { type: 'positive', label: 'Infectious Ideology',  description: 'Virus spread rate +1%' },
      { type: 'negative', label: 'Far-rightiousness',    description: 'Disables left rotation (← arrow)' },
    ],
  },
  {
    id: 'melon_tusk',
    name: 'Melon Tusk',
    image: '/melon_tusk.jpeg',
    cost: 999,
    quotes: melonTuskQuotes,
    perks: [
      { type: 'positive', label: 'Mars Obsession',       description: 'Rocket thrust +20% toward Mars' },
      { type: 'negative', label: 'Erratic Governance',   description: 'Randomly reverses controls for 3s' },
    ],
  },
  {
    id: 'samus_altman',
    name: 'Samus Altman',
    image: '/samus_altman.jpeg',
    cost: 999,
    quotes: samusAltmanQuotes,
    perks: [
      { type: 'positive', label: 'AGI Acceleration',     description: 'Global virus spawn rate +5%' },
      { type: 'negative', label: 'Safety Pause',         description: 'Thrust disabled for 2s every 30s' },
    ],
  },
];
