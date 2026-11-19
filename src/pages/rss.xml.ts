import type { APIRoute } from 'astro';
import { rss } from '../data/rss';

export const GET: APIRoute = () => rss('tr');
