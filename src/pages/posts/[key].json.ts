// Her yazının gövdesi ayrı bir dosya olur: /posts/<klasör>.<dil>.json
// Okuma sayfası yıldıza dokununca bu dosyayı ister; ana sayfa böylece hafif kalır.
import type { APIRoute } from 'astro';
import { loadSky } from '../../data/sky';

export async function getStaticPaths() {
  const posts = await loadSky();
  return posts.flatMap((p) =>
    (['tr', 'en'] as const).map((l) => ({ params: { key: `${p.id}.${l}` }, props: { body: p.body[l] } })),
  );
}

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.body), { headers: { 'content-type': 'application/json; charset=utf-8' } });
