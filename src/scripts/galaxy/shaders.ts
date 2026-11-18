// GLSL shader'ları. Gezegen yüzeyleri tamamen kodla (procedural) çiziliyor:
// resim dosyası yok, her gezegen kendi rengini ve desenini gürültü (noise) fonksiyonuyla üretiyor.

const noise = /* glsl */ `
  // 3B değer gürültüsü ve fbm (üst üste binen gürültü katmanları)
  float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

export const planetVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vObj;
  void main(){
    vObj = normalize(position);
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

// surface: 0 bands (gaz devi), 1 rocky (kraterli), 2 swirl (girdap), 3 ice (buzul), 4 lava
export const planetFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uShade;
  uniform vec3 uLight;
  uniform float uTime;
  uniform float uSurface;
  uniform float uNight;
  uniform float uGlow;
  uniform float uSeed;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vObj;
  ${noise}
  void main(){
    vec3 p = vObj * 2.2 + uSeed;
    float pattern;
    if (uSurface < 0.5) {            // bands
      float warp = fbm(p * 1.4 + vec3(0.0, 0.0, uTime * 0.02));
      pattern = 0.5 + 0.5 * sin(vObj.y * 14.0 + warp * 5.0);
    } else if (uSurface < 1.5) {     // rocky
      float n = fbm(p * 2.2);
      float crater = smoothstep(0.62, 0.7, vnoise(p * 3.1)) * 0.6;
      pattern = n - crater;
    } else if (uSurface < 2.5) {     // swirl
      vec3 q = vec3(fbm(p + uTime * 0.015), fbm(p + 4.1), fbm(p - 2.7));
      pattern = fbm(p + 2.5 * q);
    } else if (uSurface < 3.5) {     // ice
      pattern = smoothstep(0.35, 0.75, fbm(p * 1.6)) * 0.8 + 0.2 * abs(vObj.y);
    } else {                         // lava
      float n = fbm(p * 1.8 + vec3(uTime * 0.03));
      pattern = pow(n, 1.6);
    }
    vec3 base = mix(uShade, uColor, clamp(pattern * 1.25, 0.0, 1.0));

    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    vec3 l = normalize(uLight);
    // Kil hissi: sarmalayan yumuşak ışık (wrap lighting) + alt tarafta hafif sıcak dolgu
    float wrap = clamp((dot(n, l) + 0.55) / 1.55, 0.0, 1.0);
    vec3 col = base * mix(vec3(0.62, 0.56, 0.7), vec3(1.08), wrap);
    // yumuşak parlama
    vec3 h = normalize(l + v);
    col += pow(max(dot(n, h), 0.0), 28.0) * 0.22;
    // kenar ışığı (fresnel): gündüz ince, gece daha parlak
    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
    col += fres * mix(vec3(1.0), uColor, 0.5) * mix(0.25, 0.85, uNight) * (1.0 + uGlow);
    col += uColor * uGlow * 0.18;
    // gece: lav ve buzul gezegenlerinde hafif öz ışık
    if (uSurface > 3.5) col += uColor * smoothstep(0.55, 0.85, pattern) * 0.6 * uNight;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Atmosfer: gezegenin biraz büyüğü, sadece kenarda parlayan ince bir kabuk
export const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vObj;
  void main(){
    float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.0);
    gl_FragColor = vec4(uColor, f * uStrength);
  }
`;

// Halka: yarıçapa göre şeritli, yumuşak kenarlı
export const ringVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main(){ vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const ringFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uInner;
  uniform float uOuter;
  uniform float uOpacity;
  varying vec3 vPos;
  void main(){
    float r = (length(vPos.xy) - uInner) / (uOuter - uInner);
    float bands = 0.55 + 0.45 * sin(r * 40.0) * sin(r * 13.0 + 1.3);
    float edge = smoothstep(0.0, 0.08, r) * smoothstep(1.0, 0.85, r);
    gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.25 * bands), edge * bands * uOpacity);
  }
`;

// Merkezdeki güneş: yavaşça kaynayan yüzey
export const sunFragment = /* glsl */ `
  uniform float uTime;
  uniform float uMoon;
  uniform vec3 uA;
  uniform vec3 uB;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vObj;
  ${noise}
  void main(){
    float n = fbm(vObj * 3.0 + vec3(uTime * 0.05));
    float f = pow(max(dot(normalize(vNormal), normalize(vView)), 0.0), 0.8);
    vec3 sunCol = mix(uB, uA, f * 0.7 + n * 0.45);
    // ay: gri-lavanta yüzey, krater lekeleri ve kenara doğru kararma
    float m1 = fbm(vObj * 1.6 + 11.0);
    float c = fbm(vObj * 4.2 + 3.0);
    float cr = smoothstep(0.56, 0.6, c) - smoothstep(0.62, 0.68, c) * 0.5;
    vec3 moonCol = mix(vec3(0.62, 0.64, 0.76), vec3(0.92, 0.92, 0.97), smoothstep(0.3, 0.7, m1));
    moonCol = mix(moonCol, moonCol * 0.7, clamp(cr, 0.0, 1.0));
    moonCol *= 0.5 + 0.65 * f;
    gl_FragColor = vec4(mix(sunCol, moonCol, uMoon), 1.0);
  }
`;
