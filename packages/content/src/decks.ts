import en from '../data/en.json' with { type: 'json' };
import ja from '../data/ja.json' with { type: 'json' };
import it from '../data/it.json' with { type: 'json' };
import type { Deck, Subject } from './types';

export const decks: Record<Subject, Deck> = {
  en: en as Deck,
  ja: ja as Deck,
  it: it as Deck,
};

export const subjects: Subject[] = ['en', 'ja', 'it'];
