/* =====================================================================
   PATCH DR-27 (17/11/2026) — 🏔 LEVANTAMENTO DA BACIA: malha de pontos do terreno + poligonal da bacia +
   linha da estrada → ESTUDO COMPLETO DA BACIA e PROJETO DA ESTRADA (travessias, greide, ponte do deságue).
   Estado em P.lev27 = {nome, pts:[[lon,lat,z]], poly:[[lon,lat]], road:[[lon,lat]], out:[lon,lat], par:{...}}.
   Passos (lev27Calcula, mesmo método do estudo de Aldeia Velha de 16/11/2026):
   1. Coordenadas → UTM SIRGAS 2000 (zona pelo centro). Grade quadrada dentro da poligonal com o espaçamento
      da malha (mediana da distância ao vizinho mais próximo, ou o informado); cota de cada célula por IDW
      (inverso do quadrado da distância, 8 vizinhos).
   2. Caminho da água: D8 com preenchimento de depressões (priority-flood) a partir do DESÁGUE (célula mais baixa
      perto do ponto informado — ex.: a ponte —, ou a mais baixa da borda). Área drenada, comprimento do talvegue
      (L), desnível (H), declividade média e 10–85 %, hipsometria.
   3. Tempo de concentração: média de Kirpich, Ventura e Pasini (bacia rural grande). Vazões pelo racional
      modificado Q = 0,278·C·φ·i·A, φ = A^-0,15 (A > 1 km²), IDF do projeto (aba 2), C da bacia, TR 10/25/50/100.
   4. Estrada: perfil a cada 25 m (IDW), filtro de mediana, CORREÇÃO DE COPA (topos > mínimo local ±300 m + 4 m
      são copas: descontar 4 m), pontos baixos onde a água acumula até a profundidade informada (1 m), greide
      mínimo = nível de cheia + folga (0,30 m).
   5. Bacia local de cada ponto baixo (células cuja água chega primeiro à estrada naquele trecho entre cristas,
      sem passar pelo rio > 5 km²): A, L, H, Tc (Kirpich, mín. 10 min), Q do TR das travessias (C local);
      seção da travessia = tubo único até Ø1500 ou galeria de aduelas de MENOR ALTURA que leva a vazão
      (Manning com as funções do programa: partFlow / rectFlow, y/D limite do programa); greide levantado no
      ponto para cobrir a travessia (recobrimento informado + 2 % até a borda), com rampas de 5 %.
   6. Ponte do deságue (BR-101): seção retangular B × H, Manning (n, S do talvegue), capacidade com a folga sob a
      viga × Q do TR da ponte; largura necessária.
   "Criar o projeto pela estrada" (lev27Projeto): a estrada vira ruas retas encadeadas (Douglas-Peucker), estacas
   com greide e terreno, uma travessia (2 PVs de cabeceira/saída + trecho) por ponto baixo, bacia local ligada
   à travessia, IDF/TR/recobrimento do estudo e georreferenciamento UTM exato (DR-26). O cálculo e o orçamento do
   programa passam a valer para as travessias. Verificação: "Ponte do deságue — capacidade" (checks27).
   ===================================================================== */
const LEV27_PAR = {cel: 0, copa: 4, copaLim: 4, copaJan: 300, prof: 1.0, folga: 0.30, Cbac: 0.40, Cloc: 0.50, trTrav: 50, trPonte: 100,
  rioA: 5, passo: 25, Strav: 0.005, recob: 0.30, rampa: 0.05, larg: 8, talude: 1.5, dp: 10,
  ponteB: 8, ponteH: 5, ponteN: 0.035, ponteS: 0, ponteFolga: 1.0, ponteNome: 'Ponte da BR-101'};
function lev27Par(k) { const p = P && P.lev27 && P.lev27.par; const v = p ? p[k] : undefined; return v === undefined || v === '' || v === null ? LEV27_PAR[k] : (typeof LEV27_PAR[k] === 'number' ? +v : v); }
let LEV27_CACHE = {s: null, E: null};
function lev27Estudo() {
  const lv = P && P.lev27; if (!lv || !lv.pts || lv.pts.length < 10 || !lv.poly || lv.poly.length < 3) return null;
  const s = JSON.stringify([lv.pts.length, lv.pts[0], lv.pts[lv.pts.length - 1], lv.poly, lv.road, lv.out, lv.par, P.idf]);
  if (LEV27_CACHE.s === s && LEV27_CACHE.E) return LEV27_CACHE.E;
  let E = null; try { E = lev27Calcula(lv); } catch (e) { console.error('Levantamento:', e); E = {erro: e.message}; }
  LEV27_CACHE = {s, E}; return E;
}
/* ---------- utilidades ---------- */
function lev27Heap() { const a = []; return {
  push(v) { a.push(v); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } },
  pop() { const t = a[0], e = a.pop(); if (a.length) { a[0] = e; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return t; },
  get n() { return a.length; }}; }
function lev27Dentro(x, y, pol) { let c = false; for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) { const a = pol[i], b = pol[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function lev27Med(v, w) { const n = v.length, o = new Array(n), h = w >> 1; for (let i = 0; i < n; i++) { const s = []; for (let k = i - h; k <= i + h; k++) s.push(v[Math.max(0, Math.min(n - 1, k))]); s.sort((a, b) => a - b); o[i] = s[h]; } return o; }
function lev27Mov(v, w) { const n = v.length, o = new Array(n), h = w >> 1; for (let i = 0; i < n; i++) { let s = 0; for (let k = i - h; k <= i + h; k++) s += v[Math.max(0, Math.min(n - 1, k))]; o[i] = s / w; } return o; }
function lev27Min(v, w) { const n = v.length, o = new Array(n), h = w >> 1; for (let i = 0; i < n; i++) { let m = Infinity; for (let k = i - h; k <= i + h; k++) m = Math.min(m, v[Math.max(0, Math.min(n - 1, k))]); o[i] = m; } return o; }
function lev27Kirpich(L, H) { return 57 * Math.pow(Math.pow(L / 1000, 3) / Math.max(H, 1), 0.385); }
function lev27TcBacia(A, L, H) { const S = Math.max(H, 1) / L; const k = lev27Kirpich(L, H), v = 0.127 * Math.sqrt(A / S) * 60, p = 0.107 * Math.pow(A * L / 1000, 1 / 3) / Math.sqrt(S) * 60; return {k, v, p, tc: (k + v + p) / 3}; }
function lev27Phi(A) { return A > 1 ? Math.pow(A, -0.15) : 1; }
function lev27Idf(tc, tr) { const f = P.idf || {}; return (+f.a || 0) * Math.pow(tr, +f.b || 0) / Math.pow(tc + (+f.c || 0), +f.d || 1); }   // sem o fator de chuva do 3D
function lev27Q(C, A, tc, tr) { return 0.278 * C * lev27Phi(A) * lev27Idf(tc, tr) * A; }
/* picos com proeminência (como scipy.signal.find_peaks) */
function lev27Picos(z, prom) {
  const n = z.length, out = []; let i = 1;
  while (i < n - 1) {
    if (z[i] > z[i - 1]) { let j = i; while (j + 1 < n && z[j + 1] === z[i]) j++; if (j + 1 < n && z[j + 1] < z[i]) { const k = (i + j) >> 1;
        let lm = z[k], a = k; while (a > 0 && z[a - 1] <= z[k]) { a--; lm = Math.min(lm, z[a]); } let rm = z[k], b = k; while (b < n - 1 && z[b + 1] <= z[k]) { b++; rm = Math.min(rm, z[b]); }
        if (z[k] - Math.max(lm, rm) >= prom) out.push(k); } i = j + 1; } else i++;
  }
  return out;
}
/* ---------- estudo ---------- */
function lev27Calcula(lv) {
  const par = k => { const v = lv.par ? lv.par[k] : undefined; return v === undefined || v === '' || v === null ? LEV27_PAR[k] : (typeof LEV27_PAR[k] === 'number' ? +v : v); };
  const cx = lv.poly.reduce((a, p) => a + p[0], 0) / lv.poly.length, cy = lv.poly.reduce((a, p) => a + p[1], 0) / lv.poly.length;
  const zona = Math.floor((cx + 180) / 6) + 1, U = (lon, lat) => { const u = geo26ParaUTM(lat, lon, zona); return [u.e, u.n]; }, LL = (x, y) => { const l = geo26DeUTM(x, y, zona, cy < 0); return [l[1], l[0]]; };
  const pol = lv.poly.map(p => U(p[0], p[1])), pts = lv.pts.map(p => { const u = U(p[0], p[1]); return [u[0], u[1], +p[2]]; }).filter(p => isFinite(p[2]));
  let Apol = 0; for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) Apol += (pol[j][0] + pol[i][0]) * (pol[j][1] - pol[i][1]); Apol = Math.abs(Apol) / 2 / 1e6;
  const xs = pol.map(p => p[0]), ys = pol.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  /* espaçamento: mediana da distância ao vizinho mais próximo (amostra) */
  let cel = par('cel');
  const B = 60, bk = new Map(), key = (i, j) => i + ',' + j; pts.forEach((p, k) => { const kk = key(Math.floor(p[0] / B), Math.floor(p[1] / B)); if (!bk.has(kk)) bk.set(kk, []); bk.get(kk).push(k); });
  const viz = (x, y, nmin, rmax) => { const i0 = Math.floor(x / B), j0 = Math.floor(y / B); let r = 0, got = []; while (r * B <= rmax) { got = []; for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) { const l = bk.get(key(i, j)); if (l) l.forEach(k => got.push(k)); } if (got.length >= nmin && r > 0) break; r++; } return got; };
  if (!(cel > 0)) { const sm = []; const st = Math.max(1, Math.floor(pts.length / 1500)); for (let k = 0; k < pts.length; k += st) { const p = pts[k]; let d = Infinity; viz(p[0], p[1], 2, 2000).forEach(q => { if (q !== k) d = Math.min(d, Math.hypot(pts[q][0] - p[0], pts[q][1] - p[1])); }); if (isFinite(d)) sm.push(d); }
    sm.sort((a, b) => a - b); cel = sm.length ? sm[Math.floor(sm.length * 0.5)] : 100; cel = Math.max(10, Math.min(500, Math.round(cel / 5) * 5)); }
  const nx = Math.max(3, Math.ceil((x1 - x0) / cel) + 1), ny = Math.max(3, Math.ceil((y1 - y0) / cel) + 1), N = nx * ny;
  const Z = new Float64Array(N).fill(NaN), cxy = i => [x0 + (i % nx) * cel, y0 + Math.floor(i / nx) * cel];
  const idw = (x, y) => { const c = viz(x, y, 8, Math.max(4 * cel, 600)); if (!c.length) return NaN; const d = c.map(k => [Math.hypot(pts[k][0] - x, pts[k][1] - y), k]).sort((a, b) => a[0] - b[0]).slice(0, 8);
    if (d[0][0] < 0.5) return pts[d[0][1]][2]; let s = 0, w = 0; d.forEach(([dd, k]) => { const q = 1 / (dd * dd); s += q * pts[k][2]; w += q; }); return s / w; };
  for (let i = 0; i < N; i++) { const [x, y] = cxy(i); if (lev27Dentro(x, y, pol)) Z[i] = idw(x, y); }
  const ok = i => i >= 0 && i < N && isFinite(Z[i]), cellA = cel * cel / 1e6, NB = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const nbr = i => { const ix = i % nx, iy = Math.floor(i / nx), o = []; NB.forEach(([a, b]) => { const jx = ix + a, jy = iy + b; if (jx >= 0 && jx < nx && jy >= 0 && jy < ny) o.push(jy * nx + jx); }); return o; };
  const dd = (i, j) => Math.hypot((i % nx) - (j % nx), Math.floor(i / nx) - Math.floor(j / nx)) * cel;
  const valid = []; for (let i = 0; i < N; i++) if (ok(i)) valid.push(i);
  if (valid.length < 9) throw new Error('A malha tem poucos pontos dentro da poligonal.');
  /* deságue */
  let o0 = -1, outPt = lv.out && lv.out.length === 2 ? U(lv.out[0], lv.out[1]) : null;
  if (outPt) { let best = null; valid.forEach(i => { const [x, y] = cxy(i), d = Math.hypot(x - outPt[0], y - outPt[1]); if (d <= Math.max(1200, 3 * cel) && (!best || Z[i] < best[0])) best = [Z[i], i]; }); if (best) o0 = best[1]; }
  if (o0 < 0) { let best = null; valid.forEach(i => { if (nbr(i).length < 8 || nbr(i).some(j => !ok(j))) if (!best || Z[i] < best[0]) best = [Z[i], i]; }); o0 = best[1]; }
  /* priority-flood + D8 */
  const done = new Uint8Array(N), recv = new Int32Array(N).fill(-1), Fz = new Float64Array(N).fill(Infinity), h = lev27Heap();
  Fz[o0] = Z[o0]; h.push([Z[o0], o0]);
  while (h.n) { const [z, i] = h.pop(); if (done[i]) continue; done[i] = 1; nbr(i).forEach(j => { if (!ok(j) || done[j]) return; const nz = Math.max(Z[j], z + 1e-3); if (nz < Fz[j]) { Fz[j] = nz; recv[j] = i; h.push([nz, j]); } }); }
  const cells = valid.filter(i => done[i]), L = new Float64Array(N).fill(NaN); L[o0] = 0;
  const flen = c => { const path = []; let cur = c; while (!isFinite(L[cur])) { path.push(cur); cur = recv[cur]; } let b = L[cur]; for (let k = path.length - 1; k >= 0; k--) { const p = path[k]; b += dd(p, recv[p]); L[p] = b; } };
  cells.forEach(flen);
  const order = cells.slice().sort((a, b) => L[b] - L[a]), acc = new Float64Array(N), upL = new Float64Array(N), farZ = new Float64Array(N);
  cells.forEach(c => { acc[c] = 1; farZ[c] = Z[c]; });
  order.forEach(c => { if (c === o0) return; const r = recv[c]; acc[r] += acc[c]; const cl = upL[c] + dd(c, r); if (cl > upL[r]) { upL[r] = cl; farZ[r] = farZ[c]; } });
  let far = o0; cells.forEach(c => { if (L[c] > L[far]) far = c; });
  const Lm = L[far], Hm = Math.max(1, Z[far] - Z[o0]), path = []; for (let c = far; c >= 0; c = c === o0 ? -1 : recv[c]) path.push(c);
  const pd = path.map(c => L[c]).reverse(), pz = path.map(c => Z[c]).reverse(), interp = (x, X, Y) => { if (x <= X[0]) return Y[0]; for (let k = 1; k < X.length; k++) if (x <= X[k]) return Y[k - 1] + (Y[k] - Y[k - 1]) * (x - X[k - 1]) / ((X[k] - X[k - 1]) || 1); return Y[Y.length - 1]; };
  const S1085 = (interp(0.85 * Lm, pd, pz) - interp(0.10 * Lm, pd, pz)) / (0.75 * Lm), Sout = (interp(Math.min(6000, Lm), pd, pz) - interp(0, pd, pz)) / Math.min(6000, Lm);
  const zin = lv.pts.filter(p => lev27Dentro(p[0], p[1], lv.poly)).map(p => +p[2]).sort((a, b) => a - b), pct = q => zin.length ? zin[Math.min(zin.length - 1, Math.floor(q * zin.length))] : NaN;
  let sg = 0, ng = 0; cells.forEach(c => { const ix = c % nx, iy = Math.floor(c / nx), e = ok(c + 1) && ix < nx - 1 ? c + 1 : c, w = ok(c - 1) && ix > 0 ? c - 1 : c, nn = ok(c + nx) && iy < ny - 1 ? c + nx : c, ss = ok(c - nx) && iy > 0 ? c - nx : c;
    if (e !== w || nn !== ss) { const gx = e !== w ? (Z[e] - Z[w]) / ((e - w) * cel) : 0, gy = nn !== ss ? (Z[nn] - Z[ss]) / (((nn - ss) / nx) * cel) : 0; sg += Math.hypot(gx, gy); ng++; } });
  const A = Apol, tcB = lev27TcBacia(A, Lm, Hm), Cb = par('Cbac'), Qb = {}, ib = {}; [2, 5, 10, 25, 50, 100].forEach(T => { ib[T] = lev27Idf(tcB.tc, T); Qb[T] = lev27Q(Cb, A, tcB.tc, T); });
  const QbC = {}; [0.30, 0.40, 0.50].forEach(C => { QbC[C] = {}; [10, 25, 50, 100].forEach(T => { QbC[C][T] = lev27Q(C, A, tcB.tc, T); }); });
  const bac = {A, Agrade: acc[o0] * cellA, L: Lm, H: Hm, S: Hm / Lm, S1085, Sout, tcK: tcB.k, tcV: tcB.v, tcP: tcB.p, tc: tcB.tc, C: Cb, phi: lev27Phi(A), i: ib, Q: Qb, QC: QbC,
    zmin: zin[0], zmax: zin[zin.length - 1], zmed: zin.reduce((a, b) => a + b, 0) / (zin.length || 1), z10: pct(0.10), z85: pct(0.85), decl: ng ? sg / ng : NaN, nPts: lv.pts.length, nCel: cells.length, cel, zona,
    far: (() => { const [x, y] = cxy(far), l = LL(x, y); return {lon: l[0], lat: l[1], z: Z[far]}; })(), perfilTalv: {d: pd, z: pz}};
  /* talvegues (células com área drenada ≥ 0,5 km² ou 1 % da bacia) */
  const tA = Math.max(0.5, 0.01 * A), talv = []; cells.forEach(c => { if (c === o0 || acc[c] * cellA < tA) return; const a = cxy(c), b = cxy(recv[c]); talv.push({p: [LL(a[0], a[1]), LL(b[0], b[1])], A: acc[c] * cellA}); });
  const [ox, oy] = cxy(o0), oll = LL(ox, oy), out = {lon: oll[0], lat: oll[1], z: Z[o0]};
  /* ---- estrada ---- */
  let road = null, pools = [], canopy = [], along = [];
  if (lv.road && lv.road.length > 1) {
    const RU = lv.road.map(p => U(p[0], p[1])), seg = [0]; for (let k = 1; k < RU.length; k++) seg.push(seg[k - 1] + Math.hypot(RU[k][0] - RU[k - 1][0], RU[k][1] - RU[k - 1][1]));
    const Ltot = seg[seg.length - 1], passo = par('passo'), ds = []; for (let s = 0; s < Ltot - 1e-6; s += passo) ds.push(s); ds.push(Ltot);
    const at = s => { let k = 1; while (k < seg.length - 1 && seg[k] < s) k++; const t = (s - seg[k - 1]) / ((seg[k] - seg[k - 1]) || 1); return [RU[k - 1][0] + (RU[k][0] - RU[k - 1][0]) * t, RU[k - 1][1] + (RU[k][1] - RU[k - 1][1]) * t]; };
    const xy = ds.map(at), n = ds.length, zraw = xy.map(p => idw(p[0], p[1]));
    const zsm = lev27Mov(lev27Med(zraw, 5), 3), W = Math.max(1, Math.round(par('copaJan') / passo)), base = lev27Min(zsm, 2 * W + 1);
    const cr0 = zsm.map((z, k) => z - base[k] >= par('copaLim')), crown = cr0.map((c, k) => c || cr0[k - 1] || cr0[k + 1]);
    let zc = zsm.map((z, k) => Math.max(z - (crown[k] ? par('copa') : 0), base[k])); zc = lev27Mov(zc, 3);
    for (let k = 0; k < n;) { if (crown[k]) { let j = k; while (j + 1 < n && crown[j + 1]) j++; canopy.push({s0: ds[k], s1: ds[j], zmax: Math.max(...zsm.slice(k, j + 1))}); k = j + 1; } else k++; }
    /* pontos baixos */
    const DEP = par('prof'), FOL = par('folga'), level = new Array(n).fill(NaN), cov = new Uint8Array(n), pl = [];
    const mins = []; for (let k = 0; k < n; k++) { let m = Infinity; for (let q = Math.max(0, k - 3); q <= Math.min(n - 1, k + 3); q++) m = Math.min(m, zc[q]); if (zc[k] <= m) mins.push(k); }
    mins.sort((a, b) => zc[a] - zc[b]);
    mins.forEach(m => { if (cov[m]) return; const lvl = zc[m] + DEP; let l = m, r = m; while (l > 0 && zc[l - 1] < lvl) l--; while (r < n - 1 && zc[r + 1] < lvl) r++;
      for (let k = l; k <= r; k++) if (cov[k]) return; for (let k = l; k <= r; k++) { if (!isFinite(level[k])) level[k] = lvl; cov[k] = 1; } pl.push([l, r, m, lvl]); });
    pl.sort((a, b) => a[2] - b[2]);
    const alt = zc.map((z, k) => isFinite(level[k]) ? Math.max(0, level[k] + FOL - z) : 0), gEst = zc.map((z, k) => z + alt[k]);
    /* estrada × células */
    const cellOf = p => { const ix = Math.round((p[0] - x0) / cel), iy = Math.round((p[1] - y0) / cel); let best = null; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const jx = ix + a, jy = iy + b; if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) continue; const c = jy * nx + jx; if (!done[c]) continue; const d = Math.abs(a) + Math.abs(b); if (!best || d < best[0]) best = [d, c]; } return best ? best[1] : -1; };
    const rc = xy.map(cellOf), rset = new Set(rc.filter(c => c >= 0)), thr = par('rioA') / cellA, first = new Map();
    cells.forEach(c => { if (rset.has(c)) return; let cur = c, okk = true, g = 0; while (!rset.has(cur)) { if (cur === o0 || acc[cur] > thr || cur < 0 || ++g > 100000) { okk = false; break; } cur = recv[cur]; } if (okk) first.set(c, cur); });
    const pk = lev27Picos(zc, 1.0), bounds = [...new Set([0].concat(pk, [n - 1]))].sort((a, b) => a - b);
    const segOf = k => { for (let t = 0; t < bounds.length - 1; t++) if (bounds[t] <= k && k <= bounds[t + 1]) return t; return bounds.length - 2; };
    const segCells = bounds.slice(0, -1).map((b, t) => new Set(rc.slice(b, bounds[t + 1] + 1).filter(c => c >= 0)));
    const usado = new Set(), trT = par('trTrav'), Cl = par('Cloc'), S = par('Strav'), nT = +P.crit.nTubo || 0.013;
    pl.forEach(([l, r, m, lvl]) => {
      const t = segOf(m), zone = segCells[t], loc = []; first.forEach((tg, c) => { if (zone.has(tg)) loc.push(c); });
      const shared = usado.has(t); usado.add(t);
      const Aloc = (loc.length + zone.size) * cellA; let Ll, Hl;
      if (loc.length) { let cf = loc[0]; loc.forEach(c => { if (L[c] - L[first.get(c)] > L[cf] - L[first.get(cf)]) cf = c; }); Ll = L[cf] - L[first.get(cf)] + 0.5 * cel; Hl = Math.max(1, Z[cf] - Z[first.get(cf)]); }
      else { Ll = 0.5 * cel; Hl = 2; }
      let cm = [...zone][0]; zone.forEach(c => { if (acc[c] > acc[cm]) cm = c; }); const Am = cm >= 0 ? acc[cm] * cellA : 0;
      /* lado da bacia (+1 = esquerda do sentido do estaqueamento) */
      const k1 = Math.min(n - 1, m + 1), k0 = Math.max(0, m - 1), ux = xy[k1][0] - xy[k0][0], uy = xy[k1][1] - xy[k0][1]; let sd = 0;
      loc.forEach(c => { const [x, y] = cxy(c); sd += Math.sign(ux * (y - xy[m][1]) - uy * (x - xy[m][0])); });
      if (!loc.length) { const nb = nbr(rc[m] >= 0 ? rc[m] : 0).filter(ok); let hi = null; nb.forEach(j => { if (!hi || Z[j] > Z[hi]) hi = j; }); if (hi != null) { const [x, y] = cxy(hi); sd = Math.sign(ux * (y - xy[m][1]) - uy * (x - xy[m][0])); } }
      const tc = Math.max(10, lev27Kirpich(Ll, Hl)), Q = lev27Q(Cl, Aloc, tc, trT), Q25 = lev27Q(Cl, Aloc, tc, 25), ll = LL(xy[m][0], xy[m][1]);
      const rio = Am >= par('rioA'); let tcR = null, QR = null; if (rio && cm >= 0) { tcR = lev27TcBacia(Am, upL[cm] || cel, Math.max(1, farZ[cm] - Z[cm])).tc; QR = lev27Q(Cb, Am, tcR, par('trPonte')); }
      const cand = lev27Secoes(Q, S, nT), sec = cand.tubo || cand.gal;
      pools.push({k: m, s: ds[m], s0: ds[l], s1: ds[r], lon: ll[0], lat: ll[1], x: xy[m][0], y: xy[m][1], zf: zc[m], nivel: lvl, alt: lvl + FOL - zc[m], crista0: ds[bounds[t]], crista1: ds[bounds[t + 1]],
        seg: t, comp: shared, A: Aloc, Lloc: Ll, Hloc: Hl, tc, Q, Q25, C: Cl, phi: lev27Phi(Aloc), Am, Lm: cm >= 0 ? upL[cm] : 0, Hm: cm >= 0 ? Math.max(1, farZ[cm] - Z[cm]) : 0, rio, tcR, QR, lado: sd >= 0 ? 1 : -1, cand, sec, secTxt: sec ? sec.txt : 'acima de 4 células 3,00 × 3,00 — ponte'});
    });
    /* greide final: estudo + cobertura das travessias (rampas). Tubo sem proteção pede o recobrimento do programa
       (crit.recPA1, 1,00 m); galeria de aduelas pede o recobrimento informado (0,30 m). Fica a opção que exige MENOS aterro. */
    const g2 = gEst.slice(), rec = par('recob'), larg = par('larg'), tal = par('talude'), ramp = par('rampa'), recT = Math.max(rec, +P.crit.recPA1 || 1.0), mg = 0.02;
    const reqDe = (q, sec, Lb) => q.zf + S * Lb / 2 + sec.H + sec.e + (sec.tipo === 'tubo' ? recT : rec) + 0.02 * larg / 2 + mg;
    const LbDe = (q, g) => Math.max(10, Math.ceil(larg + 2 * tal * Math.max(0.5, g - q.zf)));
    pools.forEach(q => { const c = q.cand; if (!c || (!c.tubo && !c.gal)) return; const Lb = LbDe(q, gEst[q.k]);
      const rt = c.tubo ? reqDe(q, c.tubo, Lb) : Infinity, rg = c.gal ? reqDe(q, c.gal, Lb) : Infinity;
      q.sec = rt <= rg + 0.10 ? c.tubo : c.gal; q.secTxt = q.sec.txt; q.reqTubo = rt; q.reqGal = rg; });
    for (let it = 0; it < 4; it++) pools.forEach(q => { if (!q.sec) return; q.Lb = LbDe(q, Math.max(g2[q.k], gEst[q.k])); q.greideReq = reqDe(q, q.sec, q.Lb);
      for (let k = 0; k < n; k++) g2[k] = Math.max(g2[k], q.greideReq - ramp * Math.abs(ds[k] - q.s)); });
    pools.forEach(q => { q.greide = g2[q.k]; q.aterro = g2[q.k] - q.zf; if (q.sec) { q.Lb = LbDe(q, q.greide); q.cm = +(q.zf + S * q.Lb / 2).toFixed(3); q.cj = +(q.zf - S * q.Lb / 2).toFixed(3); } });
    const at2 = g2.map((g, k) => g - zc[k]); let vol = 0, volE = 0; const Wt = larg; for (let k = 0; k < n - 1; k++) { const dl = ds[k + 1] - ds[k], a1 = (Wt + tal * at2[k]) * at2[k], a2 = (Wt + tal * at2[k + 1]) * at2[k + 1]; vol += (a1 + a2) / 2 * dl; const b1 = (Wt + tal * alt[k]) * alt[k], b2 = (Wt + tal * alt[k + 1]) * alt[k + 1]; volE += (b1 + b2) / 2 * dl; }
    for (let t = 0; t < bounds.length - 1; t++) { const z = segCells[t]; let cm = [...z][0]; z.forEach(c => { if (acc[c] > acc[cm]) cm = c; }); along.push({s0: ds[bounds[t]], s1: ds[bounds[t + 1]], A: cm >= 0 ? acc[cm] * cellA : 0, L: cm >= 0 ? upL[cm] : 0, H: cm >= 0 ? Math.max(1, farZ[cm] - Z[cm]) : 0}); }
    road = {ds, xy, ll: xy.map(p => LL(p[0], p[1])), zraw, zsm, zc, level, alt, gEst, greide: g2, aterro: at2, L: Ltot, vol, volEst: volE, altMax: Math.max(...at2), extAlag: level.filter(isFinite).length * passo, crown};
  }
  /* ponte */
  const pB = par('ponteB'), pH = par('ponteH'), pn = par('ponteN'), pS = par('ponteS') > 0 ? par('ponteS') : Math.max(0.0005, Sout), pf = par('ponteFolga'), trP = par('trPonte');
  const qRet = (Bw, y) => { const a = Bw * y, pp = Bw + 2 * y; return a * Math.pow(a / pp, 2 / 3) * Math.sqrt(pS) / pn; };
  const Qd = lev27Q(Cb, A, tcB.tc, trP), yF = Math.max(0.1, pH - pf), Qf = qRet(pB, yF), Qc = qRet(pB, pH);
  const yN = (() => { let lo = 0.01, hi = 30; for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (qRet(pB, m) < Qd) lo = m; else hi = m; } return (lo + hi) / 2; })();
  const Bn = (() => { let lo = 0.5, hi = 500; for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (qRet(m, yF) < Qd) lo = m; else hi = m; } return (lo + hi) / 2; })();
  const ponte = {B: pB, H: pH, n: pn, S: pS, folga: pf, tr: trP, Qd, Qf, Qc, yN, VN: Qd / (pB * yN), Vf: Qf / (pB * yF), Bn, ok: Qf >= Qd - 1e-6, okCheia: Qc >= Qd - 1e-6,
    tab: [10, 25, 50, 100].map(T => { const q = lev27Q(Cb, A, tcB.tc, T); let lo = 0.01, hi = 30; for (let k = 0; k < 70; k++) { const m = (lo + hi) / 2; if (qRet(pB, m) < q) lo = m; else hi = m; } return {T, Q: q, y: (lo + hi) / 2, V: q / (pB * (lo + hi) / 2)}; })};
  return {zona, cel, bac, talv, out, road, pools, canopy, along, ponte, grade: {nx, ny, x0, y0, cel, n: cells.length}, zAt: idw};
}
/* seções candidatas da travessia: tubo único até Ø1500 e galeria de MENOR ALTURA (funções hidráulicas do programa);
   fora da faixa de Froude 0,86–1,13 (superfície instável) quando houver outra opção */
function lev27Secoes(Q, S, n) {
  const lim = h => (typeof yDlim === 'function' ? Math.min(yDlim(h), +P.crit.yD || 0.75) : (+P.crit.yD || 0.75)) + 1e-9, vmx = +P.crit.vmax || 5, frOk = h => !(isNum(h.Fr) && h.Fr > 0.86 && h.Fr < 1.13);
  let tubo = null, gal = null, galFr = null;
  for (const D of DIAMS.filter(d => d >= Math.max(+P.crit.dmin || 400, 600) && d <= 1500)) { const h = partFlow(Q, D, S, n); if (!h.carga && isNum(h.yD) && h.yD <= lim(h) && h.V <= vmx) { tubo = {tipo: 'tubo', D, H: D / 1000, e: D / 1000 * (+P.crit.espF || 0.10), V: h.V, yD: h.yD, Fr: h.Fr, txt: 'Tubo Ø' + D + ' · V ' + fmt(h.V, 2) + ' m/s · y/D ' + fmt(h.yD, 2)}; break; } }
  const Hs = [...new Set(GAL_PAD.map(x => x[1]))].sort((a, b) => a - b);
  busca: for (const H of Hs) for (let N = 1; N <= 4; N++) for (const [Bw] of GAL_PAD.filter(x => x[1] === H).sort((a, b) => a[0] - b[0])) {
    const g = galOf({sec: 'gal', galB: Bw, galH: H, galN: N, galE: ''}); if (!g) continue; const h = rectFlow(Q, g, S, n);
    if (!h.carga && isNum(h.yD) && h.yD <= lim(h) && h.V <= vmx) { const o = {tipo: 'gal', B: Bw, H, N, e: g.e, V: h.V, yD: h.yD, Fr: h.Fr, txt: 'Galeria ' + (N > 1 ? N + ' células ' : '') + fmt(Bw, 2) + ' × ' + fmt(H, 2) + ' m · V ' + fmt(h.V, 2) + ' m/s · y/H ' + fmt(h.yD, 2)};
      if (frOk(h)) { gal = o; break busca; } if (!galFr) galFr = o; }
  }
  return {tubo, gal: gal || galFr};
}
function lev27Secao(Q, S, n) { const c = lev27Secoes(Q, S, n); return c.tubo || c.gal; }
/* ---------- criar o projeto pela estrada ---------- */
function lev27DP(pts, tol) { if (pts.length < 3) return [0, pts.length - 1]; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let dm = -1, im = -1; const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1], l = Math.hypot(bx - ax, by - ay) || 1;
    for (let k = a + 1; k < b; k++) { const d = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / l; if (d > dm) { dm = d; im = k; } } if (dm > tol) { keep[im] = 1; st.push([a, im], [im, b]); } }
  const o = []; keep.forEach((v, k) => { if (v) o.push(k); }); return o; }
function lev27Projeto(silencioso) {
  const E = lev27Estudo(); if (!E || E.erro) return toast('Calcule o estudo antes (falta malha, poligonal ou estrada).');
  if (!E.road) return toast('Importe a linha da estrada (KML com LineString) para criar o projeto.');
  if (!silencioso && (P.ruas.length || P.pvs.length) && !confirm('Isto SUBSTITUI as ruas, estacas, PVs, trechos, caixas e bacias deste projeto pelos da estrada do levantamento. Continuar?')) return;
  const rd = E.road, nome = (P.lev27.estrada || 'Estrada'), larg = lev27Par('larg'), S = lev27Par('Strav');
  const idx = lev27DP(rd.xy, lev27Par('dp'));
  /* trechos retos: precisam de comprimento ≥ 20 m (junta pontos muito próximos) */
  const cut = [idx[0]]; idx.slice(1).forEach(k => { if (rd.ds[k] - rd.ds[cut[cut.length - 1]] >= 20 || k === idx[idx.length - 1]) cut.push(k); });
  if (cut.length > 2 && rd.ds[cut[cut.length - 1]] - rd.ds[cut[cut.length - 2]] < 20) cut.splice(cut.length - 2, 1);
  const ruas = [], est = [], segs = [];
  for (let t = 0; t < cut.length - 1; t++) {
    const a = cut[t], b = cut[t + 1], A = rd.xy[a], Bp = rd.xy[b], Ls = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), az = Math.atan2(Bp[1] - A[1], Bp[0] - A[0]) * 180 / Math.PI, id = 'E' + String(t + 1).padStart(2, '0');
    ruas.push(Object.assign({id, nome: 'Estrada T' + String(t + 1).padStart(2, '0'), larg, passeio: 0, it: 2, x0: +A[0].toFixed(3), y0: +A[1].toFixed(3), az: +az.toFixed(4), raio: 0, mf: 'mf15', obs: nome + ' — trecho reto de ' + estLabel(rd.ds[a]) + ' a ' + estLabel(rd.ds[b]) + ' da estrada (' + fmt(rd.ds[a], 2) + ' a ' + fmt(rd.ds[b], 2) + ' m)'}, {mfH: 0.15, sjW: 0, sjI: ''}));
    segs.push({id, a, b, s0: rd.ds[a], s1: rd.ds[b], L: Ls, f: Ls / ((rd.ds[b] - rd.ds[a]) || 1), A, az});
    for (let k = a; k <= b; k++) { if (t > 0 && k === a) { /* a estaca de início repete a do fim do trecho anterior */ }
      const d = (rd.ds[k] - rd.ds[a]) * Ls / ((rd.ds[b] - rd.ds[a]) || 1); est.push({rua: id, dist: +d.toFixed(2), cota: +rd.greide[k].toFixed(3), tn: +rd.zc[k].toFixed(3), obs: k === a || k === b ? 'Est. ' + estLabel(rd.ds[k]) : ''}); }
  }
  const segDe = s => segs.find(q => s >= q.s0 - 1e-6 && s <= q.s1 + 1e-6) || segs[segs.length - 1];
  const pvs = [], trs = [], bacs = [];
  E.pools.forEach((q, i) => {
    if (!q.sec) return; const k = i + 1, sg = segDe(q.s), dl = +((q.s - sg.s0) * sg.f).toFixed(2), id = 'X' + String(k).padStart(2, '0'), Lb = q.Lb, h2 = Lb / 2;
    ruas.push({id, nome: 'Bueiro ' + k, obs2: 'Travessia ' + k + ' — bueiro na estaca ' + estLabel(q.s) + ' da estrada', larg: 1.0, passeio: 0, it: 2, ref: sg.id, refDist: dl, ang: 90, dist0: 20, raio: 0, mf: 'mf15', mfH: 0.15, sjW: 0, sjI: '', obs: 'Rua auxiliar só para posicionar o bueiro sob a estrada (não é pavimentada).'});
    const gE = q.greide - 0.02 * larg / 2;   // borda da pista (2 % do eixo para a borda)
    [[0, q.zf + 0.5], [20 - h2, q.zf], [20, q.greide], [20 + h2, q.zf], [40, q.zf - 0.2]].forEach(([d, z]) => est.push({rua: id, dist: +d.toFixed(2), cota: +z.toFixed(3), tn: +(d === 20 ? q.zf : z).toFixed(3), obs: d === 20 ? 'eixo da estrada' : ''}));
    const up = q.lado > 0 ? 20 + h2 : 20 - h2, dn = q.lado > 0 ? 20 - h2 : 20 + h2, sec = q.sec, gal = sec.tipo === 'gal';
    const Wd = gal ? sec.N * sec.B + (sec.N + 1) * sec.e : sec.D / 1000 * 1.2;
    pvs.push({id: id + '-E', rua: id, dist: +up.toFixed(2), tipo: PVTIPOS[5], dpv: Math.max(1500, Math.ceil((Wd + 0.4) * 10) * 100), tampaCl: TAMPAS[1], tampa: +gE.toFixed(3), defl: 'ini', na: '', obs: 'Entrada do bueiro (caixa de cabeceira) — lado da bacia local'});
    pvs.push({id: id + '-S', rua: id, dist: +dn.toFixed(2), tipo: PVTIPOS[5], dpv: Math.max(1500, Math.ceil((Wd + 0.4) * 10) * 100), tampaCl: TAMPAS[1], tampa: +gE.toFixed(3), defl: 'reta', na: '', obs: 'Saída do bueiro — deságue no talvegue a jusante'});
    const t = {id: 'BT-' + String(k).padStart(2, '0'), m: id + '-E', j: id + '-S', L: Lb, D: gal ? Math.round(sec.H * 1000) : sec.D, cm: q.cm, cj: q.cj, mat: MATS[1], aL: '', cL: '', tcL: ''};
    if (gal) Object.assign(t, {sec: 'gal', galB: sec.B, galH: sec.H, galN: sec.N, galE: ''}); else t.sec = 'circ';
    trs.push(t);
    bacs.push({id: 'BL' + String(k).padStart(2, '0'), nome: 'Bacia local do ponto baixo ' + k + ' (est. ' + estLabel(q.s) + ') · A ' + fmt(q.A, 3) + ' km² · φ ' + fmt(q.phi, 3) + ' · C ' + fmt(q.C, 2) + '×φ',
      A: +(q.A * 100).toFixed(3), C: +(q.C * q.phi).toFixed(4), dest: id + '-E', tcMode: 'man', tc: +q.tc.toFixed(1), kL: +q.Lloc.toFixed(0), kH: +q.Hloc.toFixed(1)});
  });
  Object.assign(P, {ruas, estacas: est, pvs, trechos: trs, bacias: bacs, bls: []});
  P.idf = P.idf || {}; if (P.lev27.idfMacae !== false && (!P.idf.fonte || /Jardim Botânico/.test(P.idf.fonte))) Object.assign(P.idf, {a: 1270, b: 0.2477, c: 18.9, d: 0.8277, fonte: 'Macaé / RJ — CPRM (Davis & Naghettini, 2001)'});
  Object.assign(P.crit, {tr: lev27Par('trTrav'), recob: lev27Par('recob')});
  P.georef = Object.assign(P.georef || {}, {utm: true, zona: E.zona, hem: 'S', fix: true});
  P.proj.obs = 'Projeto criado pelo 🏔 Levantamento da bacia (DR-27): ' + ruas.filter(r => r.id[0] === 'E').length + ' trechos retos da estrada (' + fmt(E.road.L, 0) + ' m), ' + trs.length + ' travessias nos pontos baixos, greide com aterro máx. ' + fmt(E.road.altMax, 2) + ' m. Bacia ' + fmt(E.bac.A, 2) + ' km², Tc ' + fmt(E.bac.tc, 0) + ' min, Q' + lev27Par('trPonte') + ' = ' + fmt(E.ponte.Qd, 1) + ' m³/s no deságue (' + lev27Par('ponteNome') + ').';
  save(); calc(); if (!silencioso) { renderTab(); toast('Projeto criado: ' + ruas.length + ' ruas, ' + trs.length + ' travessias. Confira a aba 13 (Verificação).'); }
  return {ruas: ruas.length, trechos: trs.length};
}
/* ---------- verificação: ponte do deságue ---------- */
function checks27(res) {
  const E = lev27Estudo(); if (!E || E.erro) return; const p = E.ponte, nm = lev27Par('ponteNome');
  res.checks.push({tab: 'bacias', el: nm, par: 'Ponte do deságue — capacidade (TR ' + p.tr + ')', val: 'Q ' + fmt(p.Qd, 1) + ' m³/s × capacidade ' + fmt(p.Qf, 1) + ' m³/s (folga ' + fmt(p.folga, 2) + ' m)',
    lim: 'vão ' + fmt(p.B, 2) + ' × ' + fmt(p.H, 2) + ' m · n ' + fmt(p.n, 3) + ' · S ' + fmt(p.S * 100, 3) + ' %', st: p.ok ? 'ok' : p.okCheia ? 'warn' : 'err',
    nota: p.ok ? '' : 'A ponte não passa a cheia de projeto com a folga sob a viga: lâmina necessária ' + fmt(p.yN, 2) + ' m (altura ' + fmt(p.H, 2) + ' m). Para passar com folga, vão de cerca de ' + fmt(p.Bn, 1) + ' m (mesma altura) ou estudo hidráulico detalhado (HEC-RAS) com levantamento do canal.'});
  res.checks.push({tab: 'bacias', el: 'Bacia', par: 'Bacia do deságue — método', val: fmt(E.bac.A, 2) + ' km², Tc ' + fmt(E.bac.tc, 0) + ' min', lim: 'racional modificado (φ = A^-0,15)', st: E.bac.A > 2 ? 'warn' : 'ok',
    nota: 'Bacia grande: o racional modificado é estimativa; para o projeto executivo da ponte use hidrograma unitário (SCS) e confirme com o DNIT.'});
}
(function () { if (typeof POS_CALC !== 'undefined') POS_CALC.push(['Ponte e bacia (DR-27)', 'checks27']); })();
