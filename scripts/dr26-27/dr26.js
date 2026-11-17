/* =====================================================================
   PATCH DR-26 (17/11/2026) — 🛰 GEORREFERENCIAR na aba 11 (3D), como no Esgoto (ES-04) e no Intertravado.
   Janela com mapa Leaflet + satélite Esri, tipo Satélite / Satélite + nomes / Mapa, pesquisa de local
   (OpenStreetMap/Nominatim), coordenadas Lat/Lon ou UTM SIRGAS 2000 (com zona), colar coordenadas, mover
   (arrastar o ● vermelho ou Shift + arrastar o mapa), girar (arrastar o ◎ azul, campo ou Shift + roda),
   escala, transparência do desenho e da imagem, níveis (ruas, rede, PVs, caixas, nomes, levantamento da
   bacia), pontos de controle (PV com coordenada medida → giro + deslocamento por mínimos quadrados),
   projeto já em UTM (locação exata), ✔ Salvar posição / ✎ Reposicionar, KMZ/KML para o Google Earth e
   link do Google Maps. Estado em P.georef (vai junto com o projeto). Só desenho: nenhum cálculo muda.
   O levantamento da bacia (DR-27: malha, poligonal, talvegues, pontos baixos, ponte) aparece no mesmo
   mapa, sempre em coordenadas geográficas.
   ===================================================================== */
const GEO26_L = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.', GEO26_M = 111320;
const GEO26_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
let GM26 = null;
function geo26G() {
  if (!P.georef) P.georef = {lat: null, lng: null, rot: 0, esc: 100, opD: 85, opS: 100, base: 'sat', fix: false, modo: 'dec', ctrl: [], niv: {}};
  const g = P.georef; g.niv = Object.assign({ruas: 1, rede: 1, pvs: 1, bls: 1, rot: 1, lev: 1, malha: 0, talv: 1, baixos: 1}, g.niv || {});
  if (!g.ctrl) g.ctrl = []; return g;
}
function geo26Pronto() { const g = P.georef; return !!(g && ((g.utm && g.zona) || (g.lat != null && g.lng != null))); }
function geo26Limites() { const G = geoRuas(), b = plantaBBox(G); return {x: b.x0, y: b.y0, w: Math.max(1, b.x1 - b.x0), h: Math.max(1, b.y1 - b.y0)}; }
function geo26EhUTM() {
  const G = geoRuas(), b = plantaBBox(G); if (!P.ruas.length && !P.pvs.length) return false;
  return b.x0 > 160000 && b.x1 < 840000 && b.y0 > 1000000 && b.y1 < 10000000;
}
function geo26Centro() { const g = geo26G(); if (g.cx == null) { const L = geo26Limites(); g.cx = +(L.x + L.w / 2).toFixed(3); g.cy = +(L.y + L.h / 2).toFixed(3); } return [g.cx, g.cy]; }
/* UTM SIRGAS 2000 (mesmas fórmulas do Intertravado e do Esgoto) */
function geo26ParaUTM(lat, lng, zona) {
  const a = 6378137, f = 1 / 298.257222101, k0 = .9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const z = zona || Math.floor((lng + 180) / 6) + 1, l0 = ((z - 1) * 6 - 180 + 3) * Math.PI / 180, ph = lat * Math.PI / 180, l = lng * Math.PI / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(ph) ** 2), T = Math.tan(ph) ** 2, C = ep2 * Math.cos(ph) ** 2, A = Math.cos(ph) * (l - l0);
  const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256) * ph - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * ph) + (15 * e2 * e2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * ph) - (35 * e2 ** 3 / 3072) * Math.sin(6 * ph));
  const E = 500000 + k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120);
  const Nn = k0 * (M + N * Math.tan(ph) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720)) + (lat < 0 ? 1e7 : 0);
  return {e: E, n: Nn, z};
}
function geo26DeUTM(E, Nn, z, sul) {
  const a = 6378137, f = 1 / 298.257222101, k0 = .9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2), e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const x = E - 500000, y = sul ? Nn - 1e7 : Nn, M = y / k0, mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const C1 = ep2 * Math.cos(p1) ** 2, T1 = Math.tan(p1) ** 2, N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(p1) ** 2, 1.5), D = x / (N1 * k0);
  const lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = ((z - 1) * 6 - 180 + 3) * Math.PI / 180 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(p1);
  return [lat * 180 / Math.PI, lon * 180 / Math.PI];
}
/* ponto do projeto (x, y em metros) → [lat, lng] */
function geo26LL(x, y) {
  const g = geo26G(); if (g.utm && g.zona) return geo26DeUTM(x, y, +g.zona, g.hem !== 'N');
  const c = geo26Centro(), k = (g.esc || 100) / 100, th = (g.rot || 0) * Math.PI / 180, dx = (x - c[0]) * k, dy = (y - c[1]) * k;
  const e = dx * Math.cos(th) - dy * Math.sin(th), n = dx * Math.sin(th) + dy * Math.cos(th);
  return [g.lat + n / GEO26_M, g.lng + e / (GEO26_M * Math.cos(g.lat * Math.PI / 180))];
}
function geo26Nums(t) { return (String(t).match(/-?\d+(?:[.,]\d+)?/g) || []).map(v => parseFloat(v.replace(',', '.'))); }
/* pontos de controle: PV com coordenada medida → giro + deslocamento (mínimos quadrados, escala 100 %) */
function geo26Ajustar() {
  const g = geo26G(), G = geoRuas();
  const Q = g.ctrl.map(q => { const pv = pvById(q.pv), p = pv && posPV(G, pv); return p && q.lat != null ? {p: [p.x, p.y], lat: +q.lat, lng: +q.lng} : null; }).filter(Boolean);
  if (!Q.length) return null;
  const c = geo26Centro(), la0 = Q.reduce((a, q) => a + q.lat, 0) / Q.length, ln0 = Q.reduce((a, q) => a + q.lng, 0) / Q.length, kx = GEO26_M * Math.cos(la0 * Math.PI / 180);
  const E = Q.map(q => [(q.lng - ln0) * kx, (q.lat - la0) * GEO26_M]), pm = [0, 0]; Q.forEach(q => { pm[0] += q.p[0] / Q.length; pm[1] += q.p[1] / Q.length; });
  let th = (g.rot || 0) * Math.PI / 180;
  if (Q.length >= 2) { let a = 0, b = 0; Q.forEach((q, i) => { const px = q.p[0] - pm[0], py = q.p[1] - pm[1]; a += px * E[i][1] - py * E[i][0]; b += px * E[i][0] + py * E[i][1]; }); th = Math.atan2(a, b); }
  const Rr = v => [v[0] * Math.cos(th) - v[1] * Math.sin(th), v[0] * Math.sin(th) + v[1] * Math.cos(th)], cc = Rr([c[0] - pm[0], c[1] - pm[1]]);
  const res = Q.map((q, i) => { const w = Rr([q.p[0] - pm[0], q.p[1] - pm[1]]); return Math.hypot(w[0] - E[i][0], w[1] - E[i][1]); });
  Object.assign(g, {lat: la0 + cc[1] / GEO26_M, lng: ln0 + cc[0] / kx, rot: Math.round(th * 18000 / Math.PI) / 100, esc: 100, utm: false});
  return {n: Q.length, rms: Math.sqrt(res.reduce((a, x) => a + x * x, 0) / res.length), max: Math.max(...res)};
}
/* feições do projeto (coordenadas do projeto, metros) */
function geo26Feicoes() {
  const out = {pista: [], pass: [], eixo: [], rede: [], pvs: [], bls: [], ramais: [], des: []};
  const G = geoRuas();
  P.ruas.forEach(r => { const g = G[r.id]; if (!g) return; let e = [g.sMin, g.sMax]; try { e = extRua(G, g); } catch (er) {}
    const a = (+r.larg || 7) / 2, w = a + (+r.passeio || 0), P4 = (o1, o2) => [g.at(e[0], o1), g.at(e[1], o1), g.at(e[1], o2), g.at(e[0], o2)].map(p => [p.x, p.y]);
    if (w > a) { out.pass.push(P4(w, a)); out.pass.push(P4(-a, -w)); }
    out.pista.push(P4(a, -a)); out.eixo.push({p: [[g.at(e[0]).x, g.at(e[0]).y], [g.at(e[1]).x, g.at(e[1]).y]], nome: r.nome || r.id}); });
  P.trechos.forEach(t => { const a = posPV(G, pvById(t.m)), b = posPV(G, pvById(t.j)); if (!a || !b) return; out.rede.push({p: [[a.x, a.y], [b.x, b.y]], t, r: R && R.tr ? R.tr[t.id] : null}); });
  P.pvs.forEach(pv => { const p = posPV(G, pv); if (p) out.pvs.push({p: [p.x, p.y], pv, r: R && R.pv ? R.pv[pv.id] : null}); });
  P.bls.forEach(b => { const p = posBL(G, b); if (p) out.bls.push({p: [p.x, p.y], b}); const rp = ramalPts(G, b); if (rp) out.ramais.push(rp.map(q => [q.x, q.y])); });
  ((R && R.outlets) || []).forEach(id => { const p = posPV(G, pvById(id)); if (p) out.des.push({p: [p.x, p.y], id}); });
  return out;
}
const GEO26_CSS = `.geo26-ov{position:fixed;inset:0;z-index:9000;display:flex;background:#0f1620}
.geo26-map{flex:1;position:relative;min-width:0;overflow:hidden}.geo26-carr{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;text-align:center;padding:1rem}.geo26-carr.er{color:#fca5a5}
.geo26-pan{width:350px;max-width:46vw;overflow:auto;background:#fff;color:#14202e;padding:10px 12px;font-size:.8rem}
.geo26-pan .t{font-weight:700;margin:10px 0 4px;color:#0b3a66}.geo26-pan .g{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:3px 0}
.geo26-pan .s{color:#475569;font-size:.74rem;margin:4px 0}.geo26-pan label.c{display:flex;gap:6px;align-items:center;margin:2px 0;cursor:pointer}
.geo26-pan input{font-size:.8rem;padding:2px 4px}.geo26-pan .b{border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:.78rem;color:#14202e;text-decoration:none}
.geo26-pan .b.on{background:#0b6bcb;color:#fff;border-color:#0b6bcb}.geo26-pan .b.pri{background:#16a34a;color:#fff;border-color:#16a34a}
.geo26-res{max-height:150px;overflow:auto;font-size:.74rem;margin:3px 0}.geo26-res div{margin:2px 0}
.geo26-h{font-size:20px;line-height:22px;text-align:center;text-shadow:0 0 3px #fff;cursor:grab}.geo26-hm{color:#dc2626}.geo26-hr{color:#2563eb}
.geo26-tt{font-size:.66rem;padding:1px 4px}
body.ov27 #tc-fab,body.ov27 #tc-aa,body.ov27 #tc-pg{display:none!important}
body.cel .geo26-ov,body.dev-android .geo26-ov,body.dev-iphone .geo26-ov{flex-direction:column}
body.cel .geo26-pan,body.dev-android .geo26-pan,body.dev-iphone .geo26-pan{width:auto;max-width:none;height:42vh}
@media (max-width:760px){.geo26-ov{flex-direction:column}.geo26-pan{width:auto;max-width:none;height:44vh}}`;
(function () { const s = document.createElement('style'); s.textContent = GEO26_CSS; document.head.appendChild(s); })();
async function geo26Abrir() {
  if (document.getElementById('geo26-ov')) return;
  if (!P.ruas.length && !(P.lev27 && P.lev27.pts && P.lev27.pts.length)) return toast('Cadastre as ruas (aba 3) ou importe o levantamento da bacia antes de georreferenciar.');
  try { calc(); } catch (e) {}
  const g = geo26G(); if (P.ruas.length) geo26Centro();
  const ov = document.createElement('div'); ov.id = 'geo26-ov'; ov.className = 'geo26-ov';
  ov.innerHTML = '<div class="geo26-map" id="geo26-map"><div class="geo26-carr">Carregando o mapa…</div></div><div class="geo26-pan" id="geo26-pan"></div>';
  document.body.appendChild(ov); document.body.classList.add('ov27');
  try {
    if (!window.L) { const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = GEO26_L + 'css'; document.head.appendChild(css); await loadScript(GEO26_L + 'js'); }
  } catch (e) { $('geo26-map').innerHTML = '<div class="geo26-carr er">Não foi possível carregar o mapa (Leaflet). Verifique a internet.</div>'; geo26Painel(); return; }
  if (!document.getElementById('geo26-ov')) return;
  if (!geo26Pronto()) {
    if (geo26EhUTM()) Object.assign(g, {utm: true, zona: g.zona || 23, hem: g.hem || 'S', fix: true});
    else if (P.lev27 && P.lev27.road && P.lev27.road.length) { const m = P.lev27.road[Math.floor(P.lev27.road.length / 2)]; Object.assign(g, {lat: m[1], lng: m[0]}); }
    else Object.assign(g, {lat: -22.5266, lng: -41.9450});
  }
  const L = window.L, map = L.map('geo26-map', {zoomControl: true, maxZoom: 21, zoomSnap: 0.25});
  const sat = L.tileLayer(GEO26_SAT, {maxZoom: 21, maxNativeZoom: 19, attribution: 'Imagem © Esri, Maxar, Earthstar'});
  const rot = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {maxZoom: 21, maxNativeZoom: 19});
  const rua = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 21, maxNativeZoom: 19, attribution: '© OpenStreetMap'});
  GM26 = {map, sat, rot, rua, dese: L.layerGroup().addTo(map), lev: L.layerGroup().addTo(map), F: geo26Feicoes()};
  const ca = $('geo26-map').querySelector('.geo26-carr'); if (ca) ca.remove();
  geo26Base(g.base || 'sat'); geo26Lev(); geo26Desenha(true); geo26Painel();
  let arr = null;
  map.on('mousedown', e => { if (g.fix || g.utm || !e.originalEvent.shiftKey) return; arr = {ll: e.latlng, lat: g.lat, lng: g.lng}; map.dragging.disable(); });
  map.on('mousemove', e => { if (!arr) return; g.lat = arr.lat + (e.latlng.lat - arr.ll.lat); g.lng = arr.lng + (e.latlng.lng - arr.ll.lng); geo26Desenha(); });
  map.on('mouseup', () => { if (!arr) return; arr = null; map.dragging.enable(); save(); geo26Campos(); });
  map.getContainer().addEventListener('wheel', e => { if (!e.shiftKey || g.fix || g.utm) return; e.preventDefault(); e.stopPropagation();
    g.rot = +(((g.rot || 0) + (e.deltaY > 0 ? 1 : -1) * (e.altKey ? 0.1 : 1)) % 360).toFixed(2); geo26Desenha(); geo26Campos(); save(); }, {capture: true, passive: false});
}
function geo26Fechar() { if (GM26) { try { GM26.map.remove(); } catch (e) {} GM26 = null; } const o = document.getElementById('geo26-ov'); if (o) o.remove(); if (!document.getElementById('lev27-ov')) document.body.classList.remove('ov27'); save(); }
function geo26Base(b) {
  const g = geo26G(); g.base = b; if (!GM26) return; const m = GM26.map;
  [GM26.sat, GM26.rot, GM26.rua].forEach(t => { if (m.hasLayer(t)) m.removeLayer(t); });
  if (b === 'rua') GM26.rua.addTo(m); else { GM26.sat.addTo(m); if (b === 'hib') GM26.rot.addTo(m); }
  [GM26.sat, GM26.rot, GM26.rua].forEach(t => t.setOpacity((g.opS == null ? 100 : g.opS) / 100));
}
/* cor por cota (azul baixo → marrom alto) */
function geo26CorZ(z, z0, z1) { const t = Math.max(0, Math.min(1, (z - z0) / Math.max(1, z1 - z0))); const c = [[37, 99, 235], [22, 163, 74], [234, 179, 8], [180, 83, 9], [120, 53, 15]]; const k = Math.min(3, Math.floor(t * 4)), u = t * 4 - k, a = c[k], b = c[k + 1]; return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(',') + ')'; }
/* levantamento da bacia (DR-27) — sempre em lat/lon */
function geo26Lev() {
  if (!GM26) return; const L = window.L, D = GM26.lev, g = geo26G(), nv = g.niv; D.clearLayers();
  const lv = P.lev27; if (!lv || !nv.lev) return; const E = typeof lev27Estudo === 'function' ? lev27Estudo() : null;
  if (lv.poly && lv.poly.length > 2) L.polygon(lv.poly.map(p => [p[1], p[0]]), {color: '#facc15', weight: 2, fill: true, fillOpacity: 0.04, interactive: false}).addTo(D);
  if (nv.malha && lv.pts && lv.pts.length) { const zs = lv.pts.map(p => p[2]), z0 = Math.min(...zs), z1 = Math.max(...zs), mx = 6000, st = Math.max(1, Math.ceil(lv.pts.length / mx));
    for (let i = 0; i < lv.pts.length; i += st) { const p = lv.pts[i]; L.circleMarker([p[1], p[0]], {radius: 2.5, weight: 0, fillOpacity: 0.9, fillColor: geo26CorZ(p[2], z0, z1)}).bindTooltip('z = ' + fmt(p[2], 1) + ' m', {sticky: true}).addTo(D); } }
  if (nv.talv && E && E.talv) E.talv.forEach(s => L.polyline(s.p.map(q => [q[1], q[0]]), {color: '#38bdf8', weight: Math.min(6, 1 + Math.log10(1 + s.A * 10) * 2.2), opacity: 0.9}).bindTooltip('Talvegue · área ' + fmt(s.A, 2) + ' km²', {sticky: true}).addTo(D));
  if (lv.road && lv.road.length > 1) L.polyline(lv.road.map(p => [p[1], p[0]]), {color: '#f8fafc', weight: 2, dashArray: '8 6', interactive: false}).addTo(D);
  if (nv.baixos && E && E.pools) E.pools.forEach((q, i) => L.circleMarker([q.lat, q.lon], {radius: 6, color: '#7f1d1d', weight: 1, fillColor: '#ef4444', fillOpacity: 0.95})
    .bindPopup(`<b>Ponto baixo ${i + 1}</b> — estaca ${estLabel(q.s)}<br>Fundo ${fmt(q.zf, 2)} m · cheia ${fmt(q.nivel, 2)} m · greide ${fmt(q.greide, 2)} m<br>Bacia local ${fmt(q.A, 2)} km² · Tc ${fmt(q.tc, 0)} min<br>Q${lev27Par('trTrav')} = ${fmt(q.Q, 2)} m³/s · ${esc(q.secTxt || '')}`).addTo(D));
  if (E && E.out) { const o = E.out; L.marker([o.lat, o.lon], {title: 'Deságue da bacia'}).bindPopup(`<b>${esc(lev27Par('ponteNome'))}</b><br>Área ${fmt(E.bac.A, 2)} km² · Tc ${fmt(E.bac.tc, 0)} min<br>Q${lev27Par('trPonte')} = ${fmt(E.bac.Q[lev27Par('trPonte')], 1)} m³/s<br>Capacidade (folga ${fmt(E.ponte.folga, 2)} m): ${fmt(E.ponte.Qf, 1)} m³/s — <b>${E.ponte.ok ? 'atende' : 'NÃO atende'}</b>`).addTo(D); }
}
function geo26Desenha(enquadra) {
  if (!GM26) return; const L = window.L, g = geo26G(), F = GM26.F, op = (g.opD == null ? 85 : g.opD) / 100, nv = g.niv, D = GM26.dese; D.clearLayers();
  if (!P.ruas.length) { if (enquadra && P.lev27 && P.lev27.poly && P.lev27.poly.length) GM26.map.fitBounds(L.latLngBounds(P.lev27.poly.map(p => [p[1], p[0]])).pad(0.05)); return; }
  const ll = p => geo26LL(p[0], p[1]), pol = (pts, st) => L.polygon(pts.map(ll), Object.assign({weight: 0, fillOpacity: op, interactive: false}, st)).addTo(D);
  if (nv.ruas) { F.pass.forEach(q => pol(q, {fillColor: '#d6d2c8'})); F.pista.forEach(q => pol(q, {fillColor: '#4b4d50'}));
    F.eixo.forEach(e => L.polyline(e.p.map(ll), {color: '#f8fafc', weight: 1, dashArray: '6 6', opacity: op}).bindTooltip(esc(e.nome), {sticky: true}).addTo(D)); }
  if (nv.rede) F.rede.forEach(x => { const r = x.r, gal = galOf(x.t), cor = r && r.st === 'err' ? '#dc2626' : gal ? '#7c3aed' : '#0ea5e9';
    L.polyline(x.p.map(ll), {color: cor, weight: gal ? 5 : 3, opacity: Math.min(1, op + 0.15)})
      .bindTooltip(`${esc(x.t.id)} · ${esc(secLbl(x.t))}${r ? ' · Q ' + fmt(r.Q, 3) + ' m³/s · V ' + fmt(r.h && r.h.V, 2) + ' m/s · y/D ' + fmt(r.h && r.h.yD, 2) : ''}`, {sticky: true}).addTo(D); });
  if (nv.bls) { F.ramais.forEach(q => L.polyline(q.map(ll), {color: '#22d3ee', weight: 1.5, opacity: op, interactive: false}).addTo(D));
    F.bls.forEach(q => L.circleMarker(ll(q.p), {radius: 3, color: '#0e7490', weight: 1, fillColor: '#cffafe', fillOpacity: 1}).bindTooltip(esc(q.b.id), {sticky: true}).addTo(D)); }
  if (nv.pvs) F.pvs.forEach(q => { const r = q.r, m = L.circleMarker(ll(q.p), {radius: 4, color: '#0f172a', weight: 1, fillColor: r && r.exut ? '#f97316' : '#e2e8f0', fillOpacity: 1}).addTo(D);
    m.bindPopup(`<b>${esc(q.pv.id)}</b><br>Tampa ${fmt(r && r.tp, 3)} · Fundo ${fmt(r && r.fundo, 3)}<br>Profundidade ${fmt(r && r.prof, 2)} m${r && r.exut ? '<br><b>Deságue</b>' : ''}`);
    if (nv.rot) m.bindTooltip(esc(q.pv.id), {permanent: F.pvs.length < 30, direction: 'top', className: 'geo26-tt', offset: [0, -4]}); });
  if (!g.fix && !g.utm) {
    const Lm = geo26Limites(), raio = Math.hypot(Lm.w, Lm.h) / 2 * 0.6 * (g.esc || 100) / 100, th = (g.rot || 0) * Math.PI / 180, cl = [g.lat, g.lng];
    const pr = [g.lat + raio * Math.sin(th) / GEO26_M, g.lng + raio * Math.cos(th) / (GEO26_M * Math.cos(g.lat * Math.PI / 180))];
    L.polyline([cl, pr], {color: '#2563eb', weight: 2, dashArray: '4 4', interactive: false}).addTo(D);
    const mk = L.marker(cl, {draggable: true, icon: L.divIcon({className: 'geo26-h geo26-hm', html: '●', iconSize: [22, 22]}), title: 'Arraste para mover o desenho'}).addTo(D);
    mk.on('drag', e => { const p = e.target.getLatLng(); g.lat = p.lat; g.lng = p.lng; }); mk.on('dragend', () => { geo26Desenha(); geo26Campos(); save(); });
    const mr = L.marker(pr, {draggable: true, icon: L.divIcon({className: 'geo26-h geo26-hr', html: '◎', iconSize: [22, 22]}), title: 'Arraste para girar o desenho'}).addTo(D);
    mr.on('drag', e => { const p = e.target.getLatLng(), dx = (p.lng - g.lng) * GEO26_M * Math.cos(g.lat * Math.PI / 180), dy = (p.lat - g.lat) * GEO26_M; g.rot = Math.round(Math.atan2(dy, dx) * 18000 / Math.PI) / 100; });
    mr.on('dragend', () => { geo26Desenha(); geo26Campos(); save(); });
  }
  if (enquadra) { const pts = []; F.pista.forEach(q => q.forEach(p => pts.push(ll(p)))); F.pvs.forEach(q => pts.push(ll(q.p)));
    if (P.lev27 && P.lev27.poly && P.lev27.poly.length && g.niv.lev) P.lev27.poly.forEach(p => pts.push([p[1], p[0]]));
    if (pts.length) GM26.map.fitBounds(L.latLngBounds(pts).pad(0.08), {maxZoom: 19}); else GM26.map.setView([g.lat, g.lng], 17); }
  geo26Links();
}
function geo26Links() { const a = document.getElementById('geo26-gm'); if (!a || !geo26Pronto() || !P.ruas.length) return; const c = geo26Centro(), p = geo26LL(c[0], c[1]); a.href = 'https://www.google.com/maps/@' + p[0].toFixed(6) + ',' + p[1].toFixed(6) + ',17z/data=!3m1!1e3'; }
function geo26Campos() {
  const g = geo26G(), q = id => document.getElementById(id); if (!q('geo26-a') || g.utm) return;
  if (g.modo === 'utm') { const u = geo26ParaUTM(g.lat, g.lng); q('geo26-a').value = u.e.toFixed(2); q('geo26-b').value = u.n.toFixed(2); q('geo26-z').value = u.z; }
  else { q('geo26-a').value = (+g.lat).toFixed(7); q('geo26-b').value = (+g.lng).toFixed(7); }
  q('geo26-rot').value = (+g.rot || 0).toFixed(2); q('geo26-esc').value = (+g.esc || 100).toFixed(1);
}
function geo26Painel() {
  const p = document.getElementById('geo26-pan'); if (!p) return; const g = geo26G(), u = g.modo === 'utm', utmP = geo26EhUTM(), nv = g.niv;
  const ck = (k, t) => `<label class="c"><input type="checkbox" data-geo26niv="${k}"${nv[k] ? ' checked' : ''}/> ${t}</label>`;
  const pvs = P.pvs.map(v => `<option value="${esc(v.id)}">${esc(v.id)}</option>`).join('');
  const temLev = P.lev27 && P.lev27.pts && P.lev27.pts.length;
  p.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b>🛰 Georreferenciar</b><button class="b" data-geo26="fechar" title="Fechar e voltar (Esc)">✕</button></div>
  <div class="s">Posicione o projeto sobre o satélite. A posição fica salva no projeto (abre no mesmo lugar e vai para o KMZ).</div>
  <div class="t">Procurar o local</div><div class="g"><input id="geo26-q" placeholder="Rua, bairro, cidade…" style="flex:1;min-width:120px"/><button class="b" data-geo26="busca">🔍</button></div><div id="geo26-res" class="geo26-res"></div>
  <div class="t">Tipo do mapa</div><div class="g">${[['sat', 'Satélite'], ['hib', 'Satélite + nomes'], ['rua', 'Mapa']].map(([k, t]) => `<button class="b${(g.base || 'sat') === k ? ' on' : ''}" data-geo26b="${k}">${t}</button>`).join('')}</div>
  <div class="t">Mostrar</div>
  ${ck('ruas', 'Ruas (pista e passeio)')}${ck('rede', 'Rede (tubos e galerias)')}${ck('pvs', 'PVs e deságues')}${ck('rot', 'Nome dos PVs')}${ck('bls', 'Caixas e ramais')}
  ${temLev ? ck('lev', 'Levantamento da bacia (poligonal, estrada, ponte)') + ck('malha', 'Malha de pontos (cor pela cota)') + ck('talv', 'Talvegues (caminho da água)') + ck('baixos', 'Pontos baixos da estrada') : ''}
  ${P.ruas.length ? `<div class="t">Posição</div>
  ${utmP ? `<label class="c"><input type="checkbox" data-geo26="utm"${g.utm ? ' checked' : ''}/> As coordenadas do projeto já são <b>UTM SIRGAS 2000</b> (locação exata)</label>
    ${g.utm ? `<div class="g"><label>Zona <input id="geo26-zona" value="${g.zona || 23}" style="width:44px"/></label><label>Hemisfério <select id="geo26-hem"><option value="S"${g.hem !== 'N' ? ' selected' : ''}>Sul</option><option value="N"${g.hem === 'N' ? ' selected' : ''}>Norte</option></select></label><button class="b" data-geo26="aplUtm">Aplicar</button></div>` : ''}` : ''}
  ${g.utm ? '' : `<div class="g"><button class="b${!u ? ' on' : ''}" data-geo26m="dec">Lat/Lon</button><button class="b${u ? ' on' : ''}" data-geo26m="utm">UTM</button><button class="b" data-geo26="colar">📋 Colar</button><button class="b" data-geo26="centro" title="Coloca o centro do desenho no centro do mapa">⌖ Centro do mapa</button></div>
    <div class="g"><label>${u ? 'E (m)' : 'Lat'} <input id="geo26-a" style="width:118px"/></label><label>${u ? 'N (m)' : 'Lon'} <input id="geo26-b" style="width:118px"/></label>${u ? '<label>Zona <input id="geo26-z" style="width:40px"/></label>' : ''}<button class="b" data-geo26="ir">Ir</button></div>
    <div class="g"><label>Giro (°) <input id="geo26-rot" style="width:64px"/></label><label>Escala (%) <input id="geo26-esc" style="width:60px"/></label></div>
    <div class="s">Arraste o ● vermelho (ou Shift + arrastar o mapa) para mover; o ◎ azul (ou Shift + roda do mouse) para girar.</div>`}
  <div class="g"><label>Desenho <input type="range" min="10" max="100" value="${g.opD == null ? 85 : g.opD}" data-geo26r="opD"/></label><label>Imagem <input type="range" min="10" max="100" value="${g.opS == null ? 100 : g.opS}" data-geo26r="opS"/></label></div>
  ${g.utm ? '' : `<div class="t">Pontos de controle (PV com coordenada medida)</div>
    <div class="g"><select id="geo26-pv">${pvs}</select><input id="geo26-pc" placeholder="lat, lon  ou  E N zona" style="flex:1;min-width:110px"/><button class="b" data-geo26="pcAdd">+</button></div>
    ${g.ctrl.length ? '<div class="geo26-res">' + g.ctrl.map((q, i) => `<div>${esc(q.pv)}: ${(+q.lat).toFixed(6)}, ${(+q.lng).toFixed(6)} <button class="b" data-geo26pc="${i}">✕</button></div>`).join('') + '</div><div class="g"><button class="b pri" data-geo26="ajustar">📍 Locar pelos pontos</button></div>' : '<div class="s">Com 2 ou mais pontos o desenho é girado e deslocado sozinho (mínimos quadrados) e o erro aparece aqui.</div>'}
    <div id="geo26-info" class="s"></div>`}
  <div class="t">Salvar e exportar</div>
  <div class="g">${g.utm ? '' : `<button class="b pri" data-geo26="fix">${g.fix ? '✎ Reposicionar' : '✔ Salvar posição'}</button>`}<button class="b" data-geo26="kmz">⬇ KMZ (Google Earth)</button><button class="b" data-geo26="kml">KML</button><a class="b" id="geo26-gm" target="_blank" rel="noopener">🌎 Google Maps</a></div>` : '<div class="s">Sem ruas no projeto: só o levantamento é mostrado. Use <b>🏔 Levantamento da bacia</b> → “Criar o projeto pela estrada”.</div>'}`;
  geo26Campos(); geo26Links();
}
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-geo26],[data-geo26b],[data-geo26m],[data-geo26pc]'); if (!b || !document.getElementById('geo26-ov')) return;
  const g = geo26G(), d = b.dataset;
  if (d.geo26b) { geo26Base(d.geo26b); save(); return geo26Painel(); }
  if (d.geo26m) { g.modo = d.geo26m; return geo26Painel(); }
  if (d.geo26pc != null) { g.ctrl.splice(+d.geo26pc, 1); save(); return geo26Painel(); }
  const a = d.geo26;
  if (a === 'fechar') return geo26Fechar();
  if (a === 'busca') { const q = $('geo26-q').value.trim(); if (!q) return; const out = $('geo26-res'); out.textContent = 'Procurando…';
    try { const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=br&q=' + encodeURIComponent(q)); const js = await r.json();
      out.innerHTML = js.length ? js.map(x => `<div><a href="#" data-geo26ir="${x.lat},${x.lon}">${esc(x.display_name)}</a></div>`).join('') : 'Nada encontrado.'; }
    catch (er) { out.textContent = 'Sem resposta do serviço de busca (internet?).'; } return; }
  if (a === 'centro') { if (g.utm || !GM26) return; const c = GM26.map.getCenter(); g.lat = c.lat; g.lng = c.lng; geo26Desenha(); geo26Campos(); return save(); }
  if (a === 'colar') { const t = prompt('Cole as coordenadas do centro do desenho: Lat, Lon em graus (ex.: -22.4800, -42.2900) ou UTM (E N zona):'); if (!t) return; const v = geo26Nums(t);
    if (v.length >= 2 && Math.abs(v[0]) <= 90 && Math.abs(v[1]) <= 180) { g.lat = v[0]; g.lng = v[1]; }
    else if (v.length >= 2) { const ll = geo26DeUTM(v[0], v[1], v[2] || 23, true); g.lat = ll[0]; g.lng = ll[1]; } else return toast('Não reconheci as coordenadas.');
    geo26Desenha(true); geo26Campos(); return save(); }
  if (a === 'ir') { const A = geo26Nums($('geo26-a').value)[0], B = geo26Nums($('geo26-b').value)[0]; if (!isFinite(A) || !isFinite(B)) return toast('Coordenada inválida.');
    if (g.modo === 'utm') { const ll = geo26DeUTM(A, B, +($('geo26-z').value || 23), true); g.lat = ll[0]; g.lng = ll[1]; } else { g.lat = A; g.lng = B; }
    const r = geo26Nums($('geo26-rot').value)[0], s = geo26Nums($('geo26-esc').value)[0]; if (isFinite(r)) g.rot = r; if (isFinite(s) && s > 1) g.esc = s; geo26Desenha(true); return save(); }
  if (a === 'utm') { g.utm = b.checked; if (g.utm) { g.zona = g.zona || 23; g.hem = g.hem || 'S'; g.fix = true; }
    else if (g.lat == null) { const c = geo26Centro(), ll = geo26DeUTM(c[0], c[1], g.zona || 23, true); g.lat = ll[0]; g.lng = ll[1]; g.fix = false; }
    save(); geo26Desenha(true); return geo26Painel(); }
  if (a === 'aplUtm') { g.zona = +($('geo26-zona').value) || 23; g.hem = $('geo26-hem').value; save(); geo26Desenha(true); return; }
  if (a === 'pcAdd') { const v = geo26Nums($('geo26-pc').value); if (v.length < 2) return toast('Digite a coordenada do PV: lat, lon (graus) ou E N zona (UTM).'); let lat = v[0], lng = v[1];
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) { const ll = geo26DeUTM(v[0], v[1], v[2] || 23, true); lat = ll[0]; lng = ll[1]; }
    const id = $('geo26-pv').value; g.ctrl = g.ctrl.filter(q => q.pv !== id); g.ctrl.push({pv: id, lat, lng}); save(); return geo26Painel(); }
  if (a === 'ajustar') { const r = geo26Ajustar(); if (!r) return; g.fix = false; save(); geo26Desenha(true); geo26Painel(); const i = $('geo26-info');
    if (i) i.innerHTML = r.n < 2 ? 'Com 1 ponto o desenho só é deslocado (o giro fica o digitado). Use 2 ou mais para girar.' : `Locado por ${r.n} pontos: erro médio <b>${fmt(r.rms, 2)} m</b>, maior <b>${fmt(r.max, 2)} m</b>${r.max > 2 ? ' — confira as coordenadas ou a escala do desenho.' : '.'}`; return; }
  if (a === 'fix') { g.fix = !g.fix; save(); geo26Desenha(); geo26Painel(); return toast(g.fix ? 'Posição salva no projeto. ✎ Reposicionar para mexer de novo.' : 'Pode mover e girar o desenho.'); }
  if (a === 'kmz' || a === 'kml') return geo26Exporta(a);
});
document.addEventListener('click', e => { const x = e.target.closest && e.target.closest('[data-geo26ir]'); if (!x) return; e.preventDefault(); const v = x.dataset.geo26ir.split(',').map(Number);
  if (GM26) GM26.map.setView(v, 17); const g = geo26G(); if (!g.utm && !g.fix) { g.lat = v[0]; g.lng = v[1]; geo26Desenha(); geo26Campos(); save(); } $('geo26-res').innerHTML = ''; });
document.addEventListener('change', e => { const el = e.target; if (!el || !document.getElementById('geo26-ov')) return; const g = geo26G();
  if (el.dataset && el.dataset.geo26niv) { g.niv[el.dataset.geo26niv] = el.checked ? 1 : 0; save(); geo26Lev(); return geo26Desenha(); }
  if (el.id === 'geo26-rot' || el.id === 'geo26-esc') { const v = geo26Nums(el.value)[0]; if (!isFinite(v)) return; if (el.id === 'geo26-rot') g.rot = v; else if (v > 1) g.esc = v; save(); geo26Desenha(); } });
document.addEventListener('input', e => { const el = e.target; if (!el || !el.dataset || !el.dataset.geo26r || !GM26) return; const g = geo26G(); g[el.dataset.geo26r] = +el.value; if (el.dataset.geo26r === 'opS') geo26Base(g.base || 'sat'); else geo26Desenha(); save(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('geo26-ov')) { geo26Fechar(); e.stopPropagation(); } }, true);
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'geo26-q') { const b = document.querySelector('[data-geo26="busca"]'); if (b) b.click(); } });
/* ── KMZ / KML para o Google Earth (ZIP sem compressão) ── */
function geo26Crc(u) { if (!geo26Crc.t) { geo26Crc.t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; geo26Crc.t[n] = c >>> 0; } } let r = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) r = geo26Crc.t[(r ^ u[i]) & 255] ^ (r >>> 8); return (r ^ 0xFFFFFFFF) >>> 0; }
function geo26Zip1(nome, texto) {
  const en = new TextEncoder(), nm = en.encode(nome), d = en.encode(texto), crc = geo26Crc(d), n = nm.length, sz = d.length;
  const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, n, true);
  const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, n, true);
  const ec = new DataView(new ArrayBuffer(22)); ec.setUint32(0, 0x06054b50, true); ec.setUint16(8, 1, true); ec.setUint16(10, 1, true); ec.setUint32(12, 46 + n, true); ec.setUint32(16, 30 + n + sz, true);
  return new Blob([lh, nm, d, ch, nm, ec], {type: 'application/vnd.google-earth.kmz'});
}
function geo26KmlTexto() {
  const F = geo26Feicoes(), x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), ll = p => geo26LL(p[0], p[1]);
  const co = pts => pts.map(p => { const l = ll(p); return l[1].toFixed(8) + ',' + l[0].toFixed(8) + ',0'; }).join(' ');
  const coG = pts => pts.map(p => (+p[0]).toFixed(8) + ',' + (+p[1]).toFixed(8) + ',0').join(' ');
  const pol = (c, st) => `<Placemark><styleUrl>#${st}</styleUrl><Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>${c}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
  const lin = (c, st, nome, desc) => `<Placemark>${nome ? '<name>' + x(nome) + '</name>' : ''}${desc ? '<description>' + x(desc) + '</description>' : ''}<styleUrl>#${st}</styleUrl><LineString><tessellate>1</tessellate><coordinates>${c}</coordinates></LineString></Placemark>`;
  const pt = (l, nome, desc, st) => `<Placemark><name>${x(nome)}</name>${desc ? '<description>' + x(desc) + '</description>' : ''}<styleUrl>#${st}</styleUrl><Point><coordinates>${l[1].toFixed(8)},${l[0].toFixed(8)},0</coordinates></Point></Placemark>`;
  const sty = (id, lc, lw, pc) => `<Style id="${id}"><LineStyle><color>${lc}</color><width>${lw}</width></LineStyle><PolyStyle><color>${pc || '00000000'}</color>${pc ? '' : '<fill>0</fill>'}</PolyStyle></Style>`;
  let k = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(P.proj.nome || 'Drenagem')}</name>
${sty('pista', 'ff504d4b', 0, 'e6504d4b')}${sty('pass', 'ffc8d2d6', 0, 'e6c8d2d6')}${sty('eixo', 'ffffffff', 1)}${sty('rede', 'fff9a50e', 4)}${sty('gal', 'ffed3a7c', 6)}${sty('bac', 'ff15ccfa', 2, '1015ccfa')}${sty('estr', 'ffffffff', 2)}${sty('talv', 'fff8bd38', 2)}
<Style id="pv"><IconStyle><scale>0.6</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0.7</scale></LabelStyle></Style>
<Style id="baixo"><IconStyle><color>ff4444ef</color><scale>0.8</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/caution.png</href></Icon></IconStyle></Style>`;
  if (P.ruas.length && geo26Pronto()) {
    k += '<Folder><name>Ruas</name>' + F.pass.map(q => pol(co(q.concat([q[0]])), 'pass')).join('') + F.pista.map(q => pol(co(q.concat([q[0]])), 'pista')).join('') + F.eixo.map(e => lin(co(e.p), 'eixo', e.nome)).join('') + '</Folder>';
    k += '<Folder><name>Rede de drenagem</name>' + F.rede.map(q => { const r = q.r; return lin(co(q.p), galOf(q.t) ? 'gal' : 'rede', q.t.id + ' ' + secLbl(q.t), r ? `Q ${fmt(r.Q, 3)} m³/s · V ${fmt(r.h && r.h.V, 2)} m/s · y/D ${fmt(r.h && r.h.yD, 2)} · L ${fmt(r.L, 1)} m` : ''); }).join('') + '</Folder>';
    k += '<Folder><name>PVs</name>' + F.pvs.map(q => pt(ll(q.p), q.pv.id, q.r ? `Tampa ${fmt(q.r.tp, 3)} · Fundo ${fmt(q.r.fundo, 3)} · Prof. ${fmt(q.r.prof, 2)} m${q.r.exut ? ' · DESÁGUE' : ''}` : '', 'pv')).join('') + '</Folder>';
  }
  const lv = P.lev27; if (lv && lv.poly && lv.poly.length) {
    const E = typeof lev27Estudo === 'function' ? lev27Estudo() : null;
    k += '<Folder><name>Levantamento da bacia</name>' + pol(coG(lv.poly.concat([lv.poly[0]])), 'bac') + (lv.road && lv.road.length ? lin(coG(lv.road), 'estr', 'Estrada (eixo do levantamento)') : '');
    if (E) { k += (E.talv || []).map(s => lin(coG(s.p), 'talv', 'Talvegue', 'Área ' + fmt(s.A, 2) + ' km²')).join('');
      k += E.pools.map((q, i) => pt([q.lat, q.lon], 'Ponto baixo ' + (i + 1), `Estaca ${estLabel(q.s)} · fundo ${fmt(q.zf, 2)} · greide ${fmt(q.greide, 2)} · Q ${fmt(q.Q, 2)} m³/s · ${q.secTxt || ''}`, 'baixo')).join('');
      if (E.out) k += pt([E.out.lat, E.out.lon], lev27Par('ponteNome'), `Área ${fmt(E.bac.A, 2)} km² · Q${lev27Par('trPonte')} ${fmt(E.bac.Q[lev27Par('trPonte')], 1)} m³/s · capacidade ${fmt(E.ponte.Qf, 1)} m³/s`, 'pv'); }
    k += '</Folder>';
  }
  return k + '</Document></kml>';
}
function geo26Exporta(tipo) {
  if (P.ruas.length && !geo26Pronto()) return toast('Posicione o desenho no mapa antes de exportar.');
  const t = geo26KmlTexto(), base = (P.proj.nome || 'drenagem').replace(/[^\w\-]+/g, '_');
  const blob = tipo === 'kmz' ? geo26Zip1('doc.kml', t) : new Blob([t], {type: 'application/vnd.google-earth.kml+xml'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = base + '.' + tipo; document.body.appendChild(a); a.click(); a.remove();
  toast((tipo === 'kmz' ? 'KMZ' : 'KML') + ' baixado: abra no Google Earth.');
}
/* botões na aba 11 (3D): 🛰 Georreferenciar e 🏔 Levantamento da bacia, na barra de cima do desenho */
(function () {
  const v0 = vTresD;
  vTresD = function () {
    const h = v0.apply(this, arguments), g = P.georef;
    const info = geo26Pronto() ? (g.utm ? 'UTM SIRGAS 2000 zona ' + (g.zona || 23) + (g.hem === 'N' ? 'N' : 'S') : 'Lat ' + (+g.lat).toFixed(5) + ', Lon ' + (+g.lng).toFixed(5) + ' · giro ' + fmt(+g.rot || 0, 1) + '°') : 'ainda não posicionado';
    const bar = `<div class="bar-btns" id="geo26-bar" style="margin-bottom:.5rem;flex-wrap:wrap;gap:.5rem;align-items:center">
      <button class="btn btn-primary btn-sm" onclick="geo26Abrir()" title="Abre o mapa de satélite para posicionar o projeto: pesquisa, coordenadas, arrastar e girar">🛰 Georreferenciar</button>
      <button class="btn btn-secondary btn-sm" onclick="lev27Abrir()" title="Malha de pontos do terreno, poligonal da bacia e linha da estrada: estudo completo da bacia e projeto da estrada">🏔 Levantamento da bacia</button>
      <span style="font-size:.8rem;color:var(--muted)">Posição: ${esc(info)}</span></div>`;
    const k = h.indexOf('<div id="t3-box"');
    return k > 0 ? h.slice(0, k) + bar + h.slice(k) : h + bar;
  };
})();
