import type { Character } from './kit';
import about from './about';
import growth from './growth';
import contact from './contact';
import basics from './basics';
import backend from './backend';
import frontend from './frontend';
import data from './data';
import quality from './quality';
import architecture from './architecture';
import ai from './ai';
import english from './english';
import news from './news';
import music from './music';
import art from './art';
import magazine from './magazine';
import sun from './sun';
import moon from './moon';

/** Gezegen anahtarı → karakter üreticisi. */
export const CHARACTERS: Record<string, () => Character> = {
  about,
  growth,
  contact,
  basics,
  backend,
  frontend,
  data,
  quality,
  architecture,
  ai,
  english,
  news,
  music,
  art,
  magazine,
  sun,
  moon,
};
