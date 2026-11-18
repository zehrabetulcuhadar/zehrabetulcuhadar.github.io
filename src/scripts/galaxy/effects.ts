/** Küçük kutlama: bir noktadan konfeti fışkırır (DOM + Web Animations, kütüphanesiz). */
const COLORS = ['#F5C45E', '#F28AC0', '#B79BF5', '#4FC7B8', '#F9A65A', '#FFFFFF'];

export function confetti(layer: HTMLElement, x: number, y: number, n = 70) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = 'confetti';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.background = COLORS[i % COLORS.length];
    if (i % 3 === 0) el.style.borderRadius = '50%';
    layer.appendChild(el);
    const a = Math.random() * Math.PI * 2;
    const v = 80 + Math.random() * 180;
    const dx = Math.cos(a) * v,
      dy = Math.sin(a) * v - 90;
    const r = (Math.random() - 0.5) * 900;
    el.animate(
      [
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${r * 0.5}deg) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx * 1.25}px, ${dy + 280}px) rotate(${r}deg) scale(0.6)`, opacity: 0 },
      ],
      { duration: 1500 + Math.random() * 900, easing: 'cubic-bezier(.2,.7,.3,1)' },
    ).onfinish = () => el.remove();
  }
}
