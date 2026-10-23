(() => {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.createElement("canvas");
  canvas.className = "ripple";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    depth: false,
    stencil: false,
    alpha: false,
  });
  if (!gl) return;

  const MAX_PIXELS = 5e6;
  const VS = `#version 300 es
in vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

  const FS = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 R;
uniform float t;
uniform float fr, fine, sp, warpA, warpS, drift, radial, bow, relief, glow, grain;
uniform float pinch, ripple, micro, edge, slant, kink, fade, src, reach, bright, legX, legY, straight;
uniform vec3 L;

const float TAU = 6.28318530718;
const mat2 M = mat2(0.8, -0.6, 0.6, 0.8);

float hash(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*f*(f*(f*6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p, int n){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++){
    if (i >= n) break;
    s += a * noise(p);
    p = M * p * 2.02 + 17.3;
    a *= 0.5;
  }
  return s;
}

// Brightness 0..1 -> black -> deep green -> mid green -> brand-ish green.
// The top of the ramp is deliberately dark (no neon, no white, no other hue).
vec3 gramp(float x){
  x = clamp(x, 0.0, 1.0);
  vec3 c0 = vec3(0.0);
  vec3 c1 = vec3(0.0, 0.030, 0.006);
  vec3 c2 = vec3(0.012, 0.11, 0.012);
  vec3 c3 = vec3(0.022, 0.19, 0.022);
  vec3 c = mix(c0, c1, smoothstep(0.06, 0.32, x));
  c = mix(c, c2, smoothstep(0.32, 0.64, x));
  c = mix(c, c3, smoothstep(0.64, 1.0, x));
  return c;
}

// Three stripe layers driven by one phase field.
// x = coarse ridges, y = fine ridges, z = hairline ridges.
vec3 field(vec2 p, out float phi2, out float phi3){
  float st = 1.0 - straight;                                     // 1 = perfectly straight ripples
  vec2 q = p;
  q.x *= 1.0 + bow * st * q.y * q.y;
  float u = q.x - slant * st * q.y;
  float asp = R.x / R.y;
  float wa = warpA * st;

  // Distance from the tilted center line. Time is added below so crests
  // move toward smaller distances: both flanks flow in toward the logo.
  float fromSide = abs(u);

  vec2 wp = vec2(u * warpS * 1.3, q.y * warpS * 0.4 - t * drift);
  float w0 = fbm(vec2(u * warpS * 0.45, q.y * warpS * 0.12 - t * drift * 0.4) + 3.7, 3) - 0.5;
  float w1 = fbm(wp, 4) - 0.5;
  float w2 = fbm(wp * 2.7 + vec2(5.2, t * drift * 1.5), 3) - 0.5;
  float kk = (fbm(vec2(q.y * 4.5 - t * 0.25, u * 1.8 + 2.3), 3) - 0.5) * 2.0 * kink * st * 0.03;

  float base = mix(fromSide, length(q), radial * st);
  float rip  = ripple * st * 0.02 * sin(TAU * (base * 1.6 + t * 0.22) + q.y * 3.0 + w1 * 6.0);
  float phi1 = (base + wa * (w1 + 0.35 * w2) + pinch * wa * 3.0 * w0 + rip + kk) * fr + t * sp;
  phi2 = phi1 * fine + w2 * wa * fr * 1.2;
  phi3 = phi1 * fine * 3.3 + w1 * wa * fr * 2.0 + t * sp * 1.2;
  float s1 = 0.5 + 0.5 * sin(TAU * phi1);
  float s2 = 0.5 + 0.5 * sin(TAU * phi2);
  float s3 = 0.5 + 0.5 * sin(TAU * phi3);
  return vec3(pow(s1, 1.6), pow(s2, 2.0), s3);
}

// Single-channel studio reflection (brightness only).
float env(vec3 r, float sweep){
  float a = r.x * 0.9 + r.y * 0.7 + 0.15 * sin(r.y * 3.0) + sweep;
  float s = 0.5 + 0.5 * sin(TAU * a * 0.55);
  float lit = smoothstep(-0.3, 0.9, r.y);
  float box = smoothstep(0.62, 0.98, 0.5 + 0.5 * sin(r.y * 6.0 + r.x * 2.5 + 1.3));
  return pow(0.08 + 0.78 * s * s, 1.75) * 1.15 * (0.2 + lit) + box * 0.7;
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * R) / R.y;
  float eps = 1.0 / R.y;
  float asp = R.x / R.y;

  float ph2, ph3, d2, d3;
  vec3 f0 = field(p, ph2, ph3);
  vec3 fx = field(p + vec2(eps, 0.0), d2, d3);
  vec3 fy = field(p + vec2(0.0, eps), d2, d3);

  float fade2 = 1.0 - smoothstep(0.22, 0.50, fwidth(ph2));
  float fade3 = 1.0 - smoothstep(0.20, 0.45, fwidth(ph3));
  vec3 amp = vec3(1.0, 0.38 * fade2, 0.04 * micro * fade3);

  float H0 = dot(f0, amp), Hx = dot(fx, amp), Hy = dot(fy, amp);
  vec2 g = vec2(Hx - H0, Hy - H0) / eps * relief * 0.01;
  vec3 n = normalize(vec3(-g, 1.0));

  // Outer left and right, tilted, clear through the logo, running to the bottom edge.
  float side = abs(p.x - slant * p.y) / (0.5 * asp);
  float m = pow(smoothstep(0.22, 0.78, side), 1.2);
  float sweep = abs(p.x - slant * p.y) * 0.35 + t * 0.05;
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  float e = env(r, sweep);

  float F  = 0.18 + 0.82 * pow(1.0 - n.z, 3.0);
  float ao = mix(0.18, 1.0, smoothstep(0.05, 0.72, H0));
  float I  = e * (0.32 + 0.95 * F) * ao;

  vec3 l  = normalize(vec3(L.xy, 0.7));
  vec3 hv = normalize(l + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(n, hv), 0.0);
  I += pow(nh, 70.0) * 1.6 + pow(nh, 10.0) * 0.12;

  I += pow(f0.x, 4.0) * glow * 0.45;                                    // ridge glow
  I += (pow(f0.x, 15.0) + 0.5 * fade2 * pow(f0.y, 7.0)) * edge * 0.85;  // crest lines

  I *= bright;
  I *= mix(1.0, m, fade);                                               // strongest at the corners, fading to the middle

  float Ig = pow(1.0 - exp(-1.5 * I), 1.0 / 2.2);
  Ig += (hash(gl_FragCoord.xy + fract(t) * 100.0) - 0.5) * grain;       // grain stays green
  o = vec4(gramp(Ig), 1.0);
}`;

  const UNIFORMS = {
    fr: 11.5,
    fine: 1.4,
    sp: 1.05,
    warpA: 0.19,
    warpS: 1.6,
    drift: 0.135,
    radial: 0.07,
    bow: 0,
    relief: 8,
    glow: 0.22,
    grain: 0.04,
    pinch: 0.1,
    ripple: 0.77,
    micro: 0.7,
    edge: 0.42,
    slant: 0.315,
    kink: 1.6,
    fade: 1,
    src: 1,
    reach: 1,
    legX: 0.55,
    legY: 0.85,
    straight: 0,
    bright: 0.56,
  };

  let program = null;
  let u = {};
  let raf = 0;
  let visible = false;
  let lost = false;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function init() {
    const vs = compile(gl.VERTEX_SHADER, VS);
    const frag = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !frag) return false;
    const next = gl.createProgram();
    gl.attachShader(next, vs);
    gl.attachShader(next, frag);
    gl.bindAttribLocation(next, 0, "p");
    gl.linkProgram(next);
    gl.deleteShader(vs);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(next, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(next));
      gl.deleteProgram(next);
      return false;
    }
    if (program) gl.deleteProgram(program);
    program = next;
    gl.useProgram(program);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    u = { R: gl.getUniformLocation(program, "R"), t: gl.getUniformLocation(program, "t"), L: gl.getUniformLocation(program, "L") };
    for (const [name, value] of Object.entries(UNIFORMS)) {
      gl.uniform1f(gl.getUniformLocation(program, name), value);
    }
    gl.uniform3f(u.L, -0.4, 0.6, 0.7);
    return true;
  }

  function layout() {
    const box = hero.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const scale = Math.min(devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / (box.width * box.height)));
    const w = Math.max(1, Math.round(box.width * scale));
    const h = Math.max(1, Math.round(box.height * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.R, w, h);
    if (!raf) draw(still.matches ? 20000 : performance.now());
  }

  function draw(now) {
    gl.uniform1f(u.t, still.matches ? 20 : now / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    draw(now);
    hero.classList.add("rippling");
  }

  function update() {
    const on = !lost && !still.matches && visible && !document.hidden;
    if (!on) {
      if (!lost && visible) hero.classList.add("rippling");
      else if (lost) hero.classList.remove("rippling");
    }
    if (on) {
      if (!raf) raf = requestAnimationFrame(frame);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      if (!lost && visible) draw(still.matches ? 20000 : performance.now());
    }
  }

  if (!init()) return;
  hero.prepend(canvas);
  layout();
  hero.classList.add("rippling");

  const resize = new ResizeObserver(layout);
  resize.observe(hero);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(hero);

  still.addEventListener("change", () => {
    layout();
    update();
  });
  document.addEventListener("visibilitychange", update);

  hero.addEventListener("pointermove", (e) => {
    const box = hero.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const x = ((e.clientX - box.left) / box.width - 0.5) * 2;
    const y = (0.5 - (e.clientY - box.top) / box.height) * 2;
    gl.uniform3f(u.L, x, y, 0.7);
  });

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
    update();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = !init();
    layout();
    update();
  });
})();
