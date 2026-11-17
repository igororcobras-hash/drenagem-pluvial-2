/* ---------- DR-27: janela 🏔 Levantamento da bacia ---------- */
const LEV27_CAMPOS = [
  ['cel', 'Espaçamento da grade (m) — 0 = o da malha', 5], ['copa', 'Redução de copa nos topos (m)', 0.5], ['copaLim', 'Topo é copa se ficar acima do mínimo local (m)', 0.5], ['copaJan', 'Janela do mínimo local (± m)', 25],
  ['prof', 'Água acumulada hoje nos pontos baixos (m)', 0.1], ['folga', 'Folga do greide acima da cheia (m)', 0.05],
  ['Cbac', 'C — bacia / rio principal', 0.05], ['Cloc', 'C — bacias locais (encostas)', 0.05], ['trTrav', 'TR das travessias (anos)', 1], ['trPonte', 'TR da ponte (anos)', 1], ['rioA', 'Rio principal a partir de (km²)', 0.5],
  ['passo', 'Estacas do perfil a cada (m)', 5], ['Strav', 'Declividade das travessias (m/m)', 0.001], ['recob', 'Recobrimento sobre a travessia (m)', 0.05], ['rampa', 'Rampa do greide junto à travessia (m/m)', 0.01],
  ['larg', 'Largura da pista (m)', 0.5], ['talude', 'Talude do aterro (H : 1V)', 0.5], ['dp', 'Tolerância dos trechos retos da estrada (m)', 1],
  ['ponteNome', 'Nome do deságue', null], ['ponteB', 'Ponte — largura do vão (m)', 0.5], ['ponteH', 'Ponte — altura livre (m)', 0.5], ['ponteN', 'Ponte — n de Manning do canal', 0.005], ['ponteS', 'Ponte — declividade do canal (m/m, 0 = do talvegue)', 0.0001], ['ponteFolga', 'Ponte — folga sob a viga (m)', 0.1]];
function lev27G() { if (!P.lev27) P.lev27 = {nome: '', pts: [], poly: [], road: [], out: null, par: {}}; if (!P.lev27.par) P.lev27.par = {}; return P.lev27; }
const LEV27_CSS = `.lev27-ov{position:fixed;inset:0;z-index:8500;background:var(--bg,#f1f5f9);overflow:auto}
.lev27-top{position:sticky;top:0;z-index:2;background:#0b3a66;color:#fff;display:flex;gap:.5rem;align-items:center;padding:.55rem .9rem;flex-wrap:wrap}
.lev27-top b{font-size:1.05rem}.lev27-top .sp{flex:1}.lev27-pg{max-width:1200px;margin:0 auto;padding:.8rem}
.lev27-ov .card{margin-bottom:.8rem}.lev27-k{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:.5rem}
.lev27-k div{background:var(--surface,#fff);border:1px solid var(--line,#cbd5e1);border-radius:8px;padding:.45rem .6rem}.lev27-k small{display:block;color:var(--muted,#64748b);font-size:.72rem}.lev27-k b{font-size:1.02rem}
.lev27-t{width:100%;border-collapse:collapse;font-size:.8rem}.lev27-t th{background:#1a3a5c;color:#fff;padding:4px 6px;text-align:left;position:sticky;top:0}.lev27-t td{border-bottom:1px solid #e2e8f0;padding:3px 6px}
.lev27-t tr.err td{background:#fee2e2}.lev27-t tr.warn td{background:#fef3c7}.lev27-tw{overflow:auto;max-height:420px}
.lev27-f{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.35rem .8rem;font-size:.8rem}.lev27-f label{display:flex;justify-content:space-between;gap:.4rem;align-items:center}.lev27-f input{width:90px}
.lev27-ok{color:#166534;font-weight:700}.lev27-no{color:#b91c1c;font-weight:700}`;
(function () { const s = document.createElement('style'); s.textContent = LEV27_CSS; document.head.appendChild(s); })();
function lev27Abrir() {
  let ov = document.getElementById('lev27-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'lev27-ov'; ov.className = 'lev27-ov'; document.body.appendChild(ov); }
  document.body.classList.add('ov27');
  lev27Render();
}
function lev27Fechar() { const o = document.getElementById('lev27-ov'); if (o) o.remove(); document.body.classList.remove('ov27'); save(); try { calc(); renderTab(); } catch (e) {} }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('lev27-ov') && !document.getElementById('geo26-ov')) { lev27Fechar(); e.stopPropagation(); } }, true);
function lev27Render() {
  const ov = document.getElementById('lev27-ov'); if (!ov) return; const lv = lev27G(), E = lev27Estudo();
  const Lr = (() => { if (!lv.road || lv.road.length < 2) return 0; let s = 0; for (let k = 1; k < lv.road.length; k++) { const a = lv.road[k - 1], b = lv.road[k]; s += Math.hypot((b[0] - a[0]) * 111320 * Math.cos(a[1] * Math.PI / 180), (b[1] - a[1]) * 110574); } return s; })();
  const campo = ([k, t, st]) => `<label>${t}<input ${st == null ? 'type="text" style="width:150px"' : 'type="number" step="' + st + '"'} value="${esc(lev27Par(k))}" onchange="lev27Set('${k}', this.value)"></label>`;
  let h = `<div class="lev27-top"><b>🏔 Levantamento da bacia</b><span style="font-size:.8rem;opacity:.85">${esc(lv.nome || P.proj.nome || '')}</span><span class="sp"></span>
    <button class="btn btn-secondary btn-sm" onclick="geo26Abrir()">🛰 Ver no mapa</button><button class="btn btn-secondary btn-sm" onclick="lev27Fechar()">✕ Fechar</button></div><div class="lev27-pg">
  <div class="card"><h4>1. Dados do levantamento</h4>
    <p style="font-size:.82rem;margin:.2rem 0 .6rem">Malha de pontos do terreno (lon, lat, cota — ou E, N, cota em UTM) dentro da poligonal da bacia, a poligonal e a linha da estrada (KML do Google Earth). O deságue é o ponto por onde sai toda a água da bacia (ex.: a ponte).</p>
    <div class="lev27-k"><div><small>Pontos da malha</small><b>${(lv.pts || []).length.toLocaleString('pt-BR')}</b></div><div><small>Vértices da poligonal</small><b>${(lv.poly || []).length}</b></div>
      <div><small>Estrada</small><b>${Lr ? fmt(Lr, 0) + ' m' : '—'}</b></div><div><small>Deságue (lat, lon)</small><b style="font-size:.85rem">${lv.out ? (+lv.out[1]).toFixed(5) + ', ' + (+lv.out[0]).toFixed(5) : 'automático (mais baixo da borda)'}</b></div></div>
    <div class="bar-btns" style="margin-top:.6rem;flex-wrap:wrap;gap:.4rem">
      <button class="btn btn-primary btn-sm" onclick="lev27Importar('malha')">📂 Importar malha (CSV, TXT ou KML)</button>
      <button class="btn btn-primary btn-sm" onclick="lev27Importar('kml')">📂 Importar poligonal e estrada (KML)</button>
      <button class="btn btn-secondary btn-sm" onclick="lev27Desague()">📍 Deságue</button>
      <button class="btn btn-secondary btn-sm" onclick="lev27PaginaMalha()" title="Gera uma página que baixa as altitudes (SRTM 30 m) numa malha dentro da poligonal e ao longo da estrada, e devolve o CSV para importar aqui">⬇ Página para baixar a malha (SRTM)</button>
      <button class="btn btn-secondary btn-sm" onclick="lev27Exemplo()">🗂 Exemplo: Estrada de Aldeia Velha</button>
      <button class="btn btn-secondary btn-sm" onclick="lev27Limpar()">🗑 Limpar</button></div>
    <div style="margin-top:.4rem"><label style="font-size:.82rem">Nome do levantamento <input type="text" value="${esc(lv.nome || '')}" onchange="lev27G().nome=this.value;save()" style="width:240px"></label> &nbsp; <label style="font-size:.82rem">Nome da estrada <input type="text" value="${esc(lv.estrada || '')}" onchange="lev27G().estrada=this.value;save()" style="width:240px"></label></div></div>
  <div class="card"><h4>2. Parâmetros</h4><div class="lev27-f">${LEV27_CAMPOS.map(campo).join('')}</div>
    <p style="font-size:.76rem;color:var(--muted);margin:.5rem 0 0">Chuva: IDF da aba 2 (${esc(P.idf.fonte || '')}: i = ${fmt(+P.idf.a, 1)}·TR^${fmt(+P.idf.b, 4)}/(t + ${fmt(+P.idf.c, 1)})^${fmt(+P.idf.d, 4)}). Para a Região Serrana / Macaé use a equação da CPRM de Macaé.
      <button class="btn btn-secondary btn-sm" onclick="lev27IdfMacae()">Usar IDF de Macaé (CPRM)</button></p></div>`;
  if (!E) h += `<div class="card"><p>Importe a malha e a poligonal para calcular o estudo (ou abra o exemplo de Aldeia Velha).</p></div>`;
  else if (E.erro) h += `<div class="card"><p class="msg err">Não foi possível calcular: ${esc(E.erro)}</p></div>`;
  else h += lev27Resultados(E);
  h += '</div>';
  ov.innerHTML = h;
}
function lev27Set(k, v) { const lv = lev27G(); lv.par[k] = LEV27_PAR[k] != null && typeof LEV27_PAR[k] === 'number' ? (v === '' ? '' : +String(v).replace(',', '.')) : v; save(); lev27Render(); }
function lev27IdfMacae() { Object.assign(P.idf, {a: 1270, b: 0.2477, c: 18.9, d: 0.8277, fonte: 'Macaé / RJ — CPRM (Davis & Naghettini, 2001)'}); save(); lev27Render(); toast('IDF de Macaé aplicada ao projeto (aba 2).'); }
function lev27Limpar() { if (!confirm('Apagar a malha, a poligonal e a estrada do levantamento deste projeto? (as ruas e a rede continuam)')) return; delete P.lev27; save(); lev27Render(); }
function lev27Desague() {
  const lv = lev27G(), t = prompt('Coordenada do deságue (ponte), em graus: lat, lon — ex.: -22.4998, -42.2693. Deixe vazio para automático.', lv.out ? lv.out[1] + ', ' + lv.out[0] : ''); if (t === null) return;
  const v = geo26Nums(t); if (v.length < 2) { lv.out = null; } else if (Math.abs(v[0]) <= 90 && Math.abs(v[1]) <= 180) lv.out = [v[1], v[0]]; else { const z = v[2] || (LEV27_CACHE.E && LEV27_CACHE.E.zona) || 23, ll = geo26DeUTM(v[0], v[1], z, true); lv.out = [ll[1], ll[0]]; }
  save(); lev27Render();
}
function lev27Resultados(E) {
  const b = E.bac, p = E.ponte, r = E.road, trP = lev27Par('trPonte'), trT = lev27Par('trTrav');
  let h = `<div class="card"><h4>3. Bacia até o deságue — ${esc(lev27Par('ponteNome'))}</h4><div class="lev27-k">
    <div><small>Área da poligonal</small><b>${fmt(b.A, 2)} km²</b></div><div><small>Área drenada (grade)</small><b>${fmt(b.Agrade, 2)} km²</b></div>
    <div><small>Talvegue mais longo L</small><b>${fmt(b.L / 1000, 2)} km</b></div><div><small>Desnível H</small><b>${fmt(b.H, 0)} m</b></div>
    <div><small>Declividade média do talvegue</small><b>${fmt(b.S * 100, 2)} %</b></div><div><small>Declividade 10–85 %</small><b>${fmt(b.S1085 * 100, 2)} %</b></div>
    <div><small>Declividade média do terreno</small><b>${fmt(b.decl * 100, 1)} %</b></div><div><small>Cotas (mín. / média / máx.)</small><b>${fmt(b.zmin, 0)} / ${fmt(b.zmed, 0)} / ${fmt(b.zmax, 0)} m</b></div>
    <div><small>Grade de cálculo</small><b>${fmt(b.cel, 0)} m · ${b.nCel} células</b></div><div><small>Pontos da malha</small><b>${b.nPts.toLocaleString('pt-BR')}</b></div>
    <div><small>Projeção</small><b>UTM SIRGAS 2000 ${b.zona}S</b></div><div><small>Coef. de distribuição φ</small><b>${fmt(b.phi, 3)}</b></div></div>
    <h5 style="margin:.8rem 0 .3rem">Tempo de concentração</h5><table class="lev27-t"><tr><th>Método</th><th>Tc (min)</th><th>Tc (h)</th></tr>
      <tr><td>Kirpich</td><td>${fmt(b.tcK, 0)}</td><td>${fmt(b.tcK / 60, 2)}</td></tr><tr><td>Ventura</td><td>${fmt(b.tcV, 0)}</td><td>${fmt(b.tcV / 60, 2)}</td></tr>
      <tr><td>Pasini</td><td>${fmt(b.tcP, 0)}</td><td>${fmt(b.tcP / 60, 2)}</td></tr><tr><td><b>Adotado (média)</b></td><td><b>${fmt(b.tc, 0)}</b></td><td><b>${fmt(b.tc / 60, 2)}</b></td></tr></table>
    <h5 style="margin:.8rem 0 .3rem">Vazões no deságue — racional modificado Q = 0,278·C·φ·i·A</h5><table class="lev27-t"><tr><th>TR (anos)</th><th>i (mm/h)</th>${[0.30, 0.40, 0.50].map(c => `<th>Q com C = ${fmt(c, 2)} (m³/s)</th>`).join('')}</tr>
      ${[10, 25, 50, 100].map(T => `<tr${T === trP ? ' style="font-weight:700"' : ''}><td>${T}</td><td>${fmt(b.i[T], 1)}</td>${[0.30, 0.40, 0.50].map(c => `<td>${fmt(b.QC[c][T], 1)}</td>`).join('')}</tr>`).join('')}</table>
    <p style="font-size:.78rem;color:var(--muted)">C adotado para a bacia: ${fmt(b.C, 2)} (mata, pasto e relevo forte). Bacia grande (> 2 km²): o racional é estimativa — para o projeto executivo da ponte use hidrograma unitário (SCS) e confirme com o DNIT.</p></div>
  <div class="card"><h4>4. ${esc(lev27Par('ponteNome'))} — verificação hidráulica</h4><div class="lev27-k">
    <div><small>Vão × altura livre</small><b>${fmt(p.B, 2)} × ${fmt(p.H, 2)} m</b></div><div><small>Q de projeto (TR ${p.tr})</small><b>${fmt(p.Qd, 1)} m³/s</b></div>
    <div><small>Capacidade com folga ${fmt(p.folga, 2)} m</small><b>${fmt(p.Qf, 1)} m³/s</b></div><div><small>Capacidade cheia (sem folga)</small><b>${fmt(p.Qc, 1)} m³/s</b></div>
    <div><small>Lâmina para a cheia de projeto</small><b>${fmt(p.yN, 2)} m</b></div><div><small>Velocidade</small><b>${fmt(p.VN, 2)} m/s</b></div>
    <div><small>Canal: n · S</small><b>${fmt(p.n, 3)} · ${fmt(p.S * 100, 3)} %</b></div><div><small>Vão necessário (mesma altura, com folga)</small><b>${fmt(p.Bn, 1)} m</b></div></div>
    <p style="margin:.5rem 0" class="${p.ok ? 'lev27-ok' : 'lev27-no'}">${p.ok ? '✔ A ponte passa a cheia de TR ' + p.tr + ' com a folga sob a viga.' : '✖ A ponte NÃO passa a cheia de TR ' + p.tr + ' com folga de ' + fmt(p.folga, 2) + ' m' + (p.okCheia ? ' (passa só trabalhando cheia, sem folga).' : ' (nem trabalhando cheia: a água sobe ' + fmt(p.yN - p.H, 2) + ' m acima da altura livre e represa a montante).')}</p>
    <table class="lev27-t"><tr><th>TR (anos)</th><th>Q (m³/s)</th><th>Lâmina na ponte (m)</th><th>Velocidade (m/s)</th><th>Situação</th></tr>${p.tab.map(x => `<tr class="${x.y > p.H ? 'err' : x.y > p.H - p.folga ? 'warn' : ''}"><td>${x.T}</td><td>${fmt(x.Q, 1)}</td><td>${fmt(x.y, 2)}</td><td>${fmt(x.V, 2)}</td><td>${x.y > p.H ? 'acima da viga' : x.y > p.H - p.folga ? 'sem folga' : 'ok'}</td></tr>`).join('')}</table>
    <p style="font-size:.78rem;color:var(--muted)">Escoamento uniforme (Manning) em seção retangular com a largura do vão; não considera remanso da BR-101, pilares nem o canal a jusante. Para decidir, faça levantamento topobatimétrico do canal e modelagem (HEC-RAS).</p></div>`;
  if (r) {
    h += `<div class="card"><h4>5. Estrada — perfil, pontos baixos e greide</h4><div class="lev27-k">
      <div><small>Extensão</small><b>${fmt(r.L, 0)} m</b></div><div><small>Pontos baixos (alagam)</small><b>${E.pools.length}</b></div><div><small>Extensão alagada hoje</small><b>${fmt(r.extAlag, 0)} m</b></div>
      <div><small>Aterro máx. (só cheia)</small><b>${fmt(Math.max(...r.alt), 2)} m</b></div><div><small>Aterro máx. (com travessias)</small><b>${fmt(r.altMax, 2)} m</b></div>
      <div><small>Volume de aterro (só cheia)</small><b>${fmt(r.volEst, 0)} m³</b></div><div><small>Volume com as travessias</small><b>${fmt(r.vol, 0)} m³</b></div>
      <div><small>Topos de copa corrigidos</small><b>${E.canopy.length}</b></div></div>
      <div style="overflow-x:auto;margin-top:.6rem">${lev27SvgPerfil(E)}</div>
      <h5 style="margin:.8rem 0 .3rem">Pontos baixos — bacia local, vazão (TR ${trT}) e travessia</h5><div class="lev27-tw"><table class="lev27-t"><tr><th>Nº</th><th>Estaca</th><th>Fundo (m)</th><th>Cheia (m)</th><th>Greide (m)</th><th>Aterro (m)</th><th>A local (km²)</th><th>L (m)</th><th>H (m)</th><th>Tc (min)</th><th>Q${trT} (m³/s)</th><th>Travessia</th><th>Rio junto (Q${trP})</th></tr>
      ${E.pools.map((q, i) => `<tr class="${!q.sec ? 'err' : q.rio ? 'warn' : ''}"><td>${i + 1}</td><td>${estLabel(q.s)}</td><td>${fmt(q.zf, 2)}</td><td>${fmt(q.nivel, 2)}</td><td>${fmt(q.greide, 2)}</td><td>${fmt(q.aterro, 2)}</td><td>${fmt(q.A, 3)}${q.comp ? ' *' : ''}</td><td>${fmt(q.Lloc, 0)}</td><td>${fmt(q.Hloc, 0)}</td><td>${fmt(q.tc, 0)}</td><td>${fmt(q.Q, 2)}</td><td>${esc(q.secTxt)}</td><td>${q.rio ? fmt(q.Am, 1) + ' km² · ' + fmt(q.QR, 0) + ' m³/s' : '—'}</td></tr>`).join('')}</table></div>
      <p style="font-size:.76rem;color:var(--muted)">* trecho entre cristas já contado em outro ponto baixo (a mesma área local; não somar). Linhas amarelas: o rio principal (&gt; ${fmt(lev27Par('rioA'), 1)} km²) passa junto da estrada — além do bueiro da encosta, confira se o rio cruza a estrada (ponte ou galeria). Linhas vermelhas: a vazão passa de 4 células 3,00 × 3,00 m — ponte.</p>
      ${E.canopy.length ? `<h5 style="margin:.8rem 0 .3rem">Topos de copa corrigidos (−${fmt(lev27Par('copa'), 1)} m)</h5><p style="font-size:.8rem">${E.canopy.map(c => estLabel(c.s0) + ' a ' + estLabel(c.s1) + ' (máx. ' + fmt(c.zmax, 1) + ' m)').join(' · ')}</p>` : ''}
      <h5 style="margin:.8rem 0 .3rem">Trechos entre cristas — área que chega à estrada</h5><div class="lev27-tw" style="max-height:220px"><table class="lev27-t"><tr><th>De</th><th>Até</th><th>Área (km²)</th><th>L (m)</th><th>H (m)</th></tr>${E.along.map(a => `<tr><td>${estLabel(a.s0)}</td><td>${estLabel(a.s1)}</td><td>${fmt(a.A, 2)}</td><td>${fmt(a.L, 0)}</td><td>${fmt(a.H, 0)}</td></tr>`).join('')}</table></div></div>`;
  }
  h += `<div class="card"><h4>6. Usar no projeto</h4><div class="bar-btns" style="flex-wrap:wrap;gap:.4rem">
    ${r ? '<button class="btn btn-primary btn-sm" onclick="lev27Projeto();lev27Render()">🛣 Criar o projeto pela estrada (ruas, greide, travessias, bacias)</button>' : ''}
    <button class="btn btn-secondary btn-sm" onclick="lev27Xlsx()">📊 Planilha do estudo (.xlsx)</button>
    ${r ? '<button class="btn btn-secondary btn-sm" onclick="lev27EstradaCSV()">⬇ Estrada: estacas, terreno e greide (.csv)</button><button class="btn btn-secondary btn-sm" onclick="lev27Intertravado()">⬇ Estrada para o Pavimento Intertravado (.json)</button>' : ''}
    <button class="btn btn-secondary btn-sm" onclick="geo26Abrir()">🛰 Ver no mapa</button></div>
    <p style="font-size:.78rem;color:var(--muted);margin:.5rem 0 0">“Criar o projeto” substitui ruas, estacas, PVs, trechos e bacias pelos da estrada: cada ponto baixo vira uma travessia (caixa de entrada → bueiro → saída), com a bacia local ligada a ela. Depois confira as abas 7 (Rede), 12 (Custos) e 13 (Verificação). O arquivo do Intertravado leva a estrada com ${fmt(lev27Par('larg'), 1)} m de pista, terreno, greide e caimento de 2 % do eixo para as bordas, com as coordenadas de cada estaca (abre georreferenciado).</p></div>`;
  return h;
}
function lev27SvgPerfil(E) {
  const r = E.road, W = 1150, H = 330, m = {l: 52, r: 14, t: 14, b: 34}, n = r.ds.length;
  const z0 = Math.floor(Math.min(...r.zc, ...r.zraw) - 2), z1 = Math.ceil(Math.max(...r.zraw, ...r.greide) + 2), X = s => m.l + (W - m.l - m.r) * s / r.L, Y = z => H - m.b - (H - m.t - m.b) * (z - z0) / ((z1 - z0) || 1);
  const pl = (arr, cor, w, dash) => `<polyline fill="none" stroke="${cor}" stroke-width="${w}"${dash ? ' stroke-dasharray="' + dash + '"' : ''} points="${arr.map((z, k) => X(r.ds[k]).toFixed(1) + ',' + Y(z).toFixed(1)).join(' ')}"/>`;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:6px;font-family:Arial;font-size:10px">`;
  for (let z = Math.ceil(z0 / 10) * 10; z <= z1; z += (z1 - z0 > 120 ? 20 : 10)) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(z)}" y2="${Y(z)}" stroke="#eef2f7"/><text x="${m.l - 4}" y="${Y(z) + 3}" text-anchor="end" fill="#64748b">${z}</text>`;
  for (let d = 0; d <= r.L; d += 500) s += `<line x1="${X(d)}" x2="${X(d)}" y1="${m.t}" y2="${H - m.b}" stroke="#eef2f7"/><text x="${X(d)}" y="${H - m.b + 13}" text-anchor="middle" fill="#64748b">${fmt(d / 1000, 1)}</text>`;
  /* água acumulada */
  for (let k = 0; k < n - 1; k++) if (isFinite(r.level[k]) && isFinite(r.level[k + 1])) s += `<polygon fill="#93c5fd" fill-opacity=".7" points="${X(r.ds[k])},${Y(r.level[k])} ${X(r.ds[k + 1])},${Y(r.level[k + 1])} ${X(r.ds[k + 1])},${Y(r.zc[k + 1])} ${X(r.ds[k])},${Y(r.zc[k])}"/>`;
  s += pl(r.zraw, '#94a3b8', 1, '3 3') + pl(r.zc, '#92400e', 1.6) + pl(r.greide, '#dc2626', 1.6);
  E.pools.forEach((q, i) => { s += `<circle cx="${X(q.s)}" cy="${Y(q.zf)}" r="3" fill="#1d4ed8"/><text x="${X(q.s)}" y="${Y(q.greide) - 6}" text-anchor="middle" fill="#1d4ed8" font-weight="700">${i + 1}</text>`; });
  s += `<text x="${m.l}" y="${H - 6}" fill="#334155">km</text><text x="12" y="${m.t + 8}" fill="#334155">m</text>
    <g transform="translate(${W - 430},${m.t + 4})"><rect width="416" height="18" fill="#fff" stroke="#e2e8f0"/><line x1="8" x2="28" y1="9" y2="9" stroke="#94a3b8" stroke-dasharray="3 3"/><text x="32" y="12">terreno (com copas)</text>
    <line x1="128" x2="148" y1="9" y2="9" stroke="#92400e" stroke-width="1.6"/><text x="152" y="12">terreno corrigido</text><rect x="240" y="4" width="16" height="10" fill="#93c5fd"/><text x="260" y="12">água hoje</text>
    <line x1="318" x2="338" y1="9" y2="9" stroke="#dc2626" stroke-width="1.6"/><text x="342" y="12">greide proposto</text></g></svg>`;
  return s;
}
/* ---------- importação ---------- */
function lev27Importar(tipo) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = tipo === 'kml' ? '.kml,.xml' : '.csv,.txt,.tsv,.xyz,.kml,.xml';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { lev27Ler(f.name, String(rd.result), tipo); } catch (e) { toast('Não consegui ler o arquivo: ' + e.message); } }; rd.readAsText(f); };
  inp.click();
}
function lev27Ler(nome, txt, tipo) {
  const lv = lev27G(); let msg = [];
  if (/\.(kml|xml)$/i.test(nome) || /<kml/i.test(txt)) {
    const doc = new DOMParser().parseFromString(txt, 'text/xml'), pms = [...doc.getElementsByTagName('Placemark')], pts = [], polys = [], lines = [];
    const co = el => (el ? el.textContent.trim().split(/\s+/) : []).map(c => c.split(',').map(Number)).filter(c => c.length >= 2 && isFinite(c[0]) && isFinite(c[1]));
    pms.forEach(pm => { const nm = (pm.getElementsByTagName('name')[0] || {}).textContent || '';
      [...pm.getElementsByTagName('Point')].forEach(p => co(p.getElementsByTagName('coordinates')[0]).forEach(c => { if (c.length > 2 && c[2] !== 0) pts.push([c[0], c[1], c[2]]); }));
      [...pm.getElementsByTagName('Polygon')].forEach(p => { const ob = p.getElementsByTagName('outerBoundaryIs')[0] || p; polys.push({nm, c: co(ob.getElementsByTagName('coordinates')[0])}); });
      [...pm.getElementsByTagName('LineString')].forEach(p => lines.push({nm, c: co(p.getElementsByTagName('coordinates')[0])})); });
    if (pts.length) { lv.pts = (tipo === 'malha' ? [] : (lv.pts || [])).concat(pts); msg.push(pts.length + ' pontos com cota'); }
    if (polys.length) { const big = polys.sort((a, b) => b.c.length - a.c.length)[0]; lv.poly = big.c.map(c => [c[0], c[1]]); if (lv.poly.length > 2 && lv.poly[0][0] === lv.poly[lv.poly.length - 1][0] && lv.poly[0][1] === lv.poly[lv.poly.length - 1][1]) lv.poly.pop(); msg.push('poligonal com ' + lv.poly.length + ' vértices'); if (!lv.nome) lv.nome = big.nm; }
    if (lines.length) { const est = lines.find(l => /estrada|rua|eixo|road|via/i.test(l.nm)) || lines.sort((a, b) => b.c.length - a.c.length)[0]; lv.road = est.c.map(c => [c[0], c[1]]); if (!lv.estrada && est.nm) lv.estrada = est.nm; msg.push('estrada “' + (est.nm || 'linha') + '” com ' + lv.road.length + ' pontos'); }
    if (!msg.length) throw new Error('o KML não tem pontos com cota, polígono nem linha.');
  } else {
    const L = txt.split(/\r?\n/).filter(l => l.trim()), sep = L.slice(0, 5).some(l => l.includes(';')) ? ';' : L.slice(0, 5).some(l => l.includes('\t')) ? '\t' : L.slice(0, 5).every(l => l.split(',').length >= 3) ? ',' : /\s+/;
    const cab = /[a-zA-Z]/.test(L[0]) ? L[0].toLowerCase().split(sep).map(s => s.trim()) : null, rows = (cab ? L.slice(1) : L).map(l => l.split(sep).map(s => +s.trim().replace(sep === ';' ? ',' : /$^/, '.')));
    let ix = 0, iy = 1, iz = 2;
    if (cab) { const f = re => cab.findIndex(c => re.test(c)); const a = f(/^(lon|lng|long|longitude|x|e|este|leste)$/), b = f(/^(lat|latitude|y|n|norte)$/), c = f(/^(z|cota|alt|altitude|elev|elevacao|elevação|h|cota \(m\))$/);
      if (a >= 0) ix = a; if (b >= 0) iy = b; if (c >= 0) iz = c; }
    let pts = rows.filter(r => isFinite(r[ix]) && isFinite(r[iy]) && isFinite(r[iz])).map(r => [r[ix], r[iy], r[iz]]); if (!pts.length) throw new Error('nenhuma linha com 3 números (x, y, cota).');
    const geo = pts.every(p => Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 180);
    if (geo) { if (!cab && pts.every(p => Math.abs(p[0]) <= 90) && pts[0] && Math.abs(pts[0][0]) < Math.abs(pts[0][1])) pts = pts.map(p => [p[1], p[0], p[2]]); }
    else { const z = +prompt('As coordenadas estão em UTM (E, N). Qual a zona UTM (SIRGAS 2000, hemisfério sul)? Aldeia Velha / Casimiro: 23 · Rio das Ostras litoral: 24', '23') || 23; pts = pts.map(p => { const l = geo26DeUTM(p[0], p[1], z, true); return [l[1], l[0], p[2]]; }); }
    lv.pts = pts; msg.push(pts.length.toLocaleString('pt-BR') + ' pontos da malha');
  }
  if (lv.pts && lv.pts.length > 40000) { const st = Math.ceil(lv.pts.length / 40000); lv.pts = lv.pts.filter((p, k) => k % st === 0); msg.push('malha reduzida para ' + lv.pts.length + ' pontos (limite do navegador)'); }
  lv.pts = (lv.pts || []).map(p => [+(+p[0]).toFixed(6), +(+p[1]).toFixed(6), +(+p[2]).toFixed(2)]);
  save(); lev27Render(); toast('Importado: ' + msg.join(', ') + '.');
}
/* página que baixa a malha (SRTM 30 m / Open-Meteo) dentro da poligonal e ao longo da estrada */
function lev27PaginaMalha() {
  const lv = lev27G(); if (!lv.poly || lv.poly.length < 3) return toast('Importe a poligonal (KML) antes.');
  const esp = +prompt('Espaçamento da malha em metros (30 a 250). Menor = mais pontos e mais tempo (80 m ≈ 8 mil pontos numa bacia de 50 km²):', '80') || 80;
  const S = '<' + 'script>', Se = '</' + 'script>';
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Malha de altitudes — ${esc(lv.nome || P.proj.nome || '')}</title>
<style>body{font-family:Arial,sans-serif;max-width:640px;margin:20px auto;padding:0 14px;color:#14202e}button{padding:12px 16px;font-size:1rem;border-radius:8px;border:0;background:#0b6bcb;color:#fff;margin:6px 6px 6px 0}button:disabled{background:#9aa}#bar{height:16px;background:#dde;border-radius:8px;overflow:hidden}#bi{height:100%;width:0;background:#16a34a}#log{font-size:.85rem;color:#445;white-space:pre-wrap;margin-top:8px}</style></head><body>
<h2>Malha de altitudes dentro da poligonal</h2><p>${esc(lv.nome || P.proj.nome || '')}. Esta página baixa as altitudes (SRTM 30 m) numa malha dentro da poligonal e ao longo da estrada. No fim baixe o CSV e importe no Drenagem Pluvial 2 (🏔 Levantamento da bacia › Importar malha).</p>
<label>Espaçamento (m): <input id="esp" type="number" value="${esp}" min="30" max="250" style="width:70px;font-size:1rem"></label><br><button id="go">▶ Baixar altitudes</button><button id="dl" disabled>⬇ Baixar CSV</button><div id="bar"><div id="bi"></div></div><div id="log">Pronto.</div>
${S}const POLY=${JSON.stringify(lv.poly)},ROAD=${JSON.stringify(lv.road || [])};const $=i=>document.getElementById(i);let OUT=[],ft=0;
function pip(x,y){let c=false;for(let i=0,j=POLY.length-1;i<POLY.length;j=i++){const a=POLY[i],b=POLY[j];if((a[1]>y)!=(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
function rs(){const o=[];for(let k=1;k<ROAD.length;k++){const a=ROAD[k-1],b=ROAD[k],d=Math.hypot((b[0]-a[0])*111320*Math.cos(a[1]*Math.PI/180),(b[1]-a[1])*110574),n=Math.max(1,Math.ceil(d/25));for(let j=0;j<n;j++)o.push([+(a[0]+(b[0]-a[0])*j/n).toFixed(6),+(a[1]+(b[1]-a[1])*j/n).toFixed(6)])}if(ROAD.length)o.push(ROAD[ROAD.length-1]);return o}
function malha(esp){const la=POLY.map(p=>p[1]),lo=POLY.map(p=>p[0]),c=Math.cos(la.reduce((a,b)=>a+b,0)/la.length*Math.PI/180),dla=esp/110574,dlo=esp/(111320*c),p=[];for(let y=Math.min(...la);y<=Math.max(...la);y+=dla)for(let x=Math.min(...lo);x<=Math.max(...lo);x+=dlo)if(pip(x,y))p.push([+x.toFixed(6),+y.toFixed(6)]);return p}
async function pega(l){try{const r=await fetch('https://api.opentopodata.org/v1/srtm30m?locations='+l.map(p=>p[1]+','+p[0]).join('|'));const j=await r.json();if(j.status==='OK')return j.results.map(x=>x.elevation)}catch(e){}
try{const r=await fetch('https://api.open-meteo.com/v1/elevation?latitude='+l.map(p=>p[1]).join(',')+'&longitude='+l.map(p=>p[0]).join(','));const j=await r.json();if(j.elevation){ft=1;return j.elevation}}catch(e){}return null}
$('go').onclick=async()=>{$('go').disabled=true;OUT=[];const t=malha(+$('esp').value||80).concat(rs());$('log').textContent='Pontos: '+t.length;
for(let i=0;i<t.length;i+=100){const l=t.slice(i,i+100);let z=null;for(let k=0;k<4&&!z;k++){z=await pega(l);if(!z)await new Promise(r=>setTimeout(r,2500))}
if(!z){$('log').textContent+='\\nFalhou no lote '+(i/100+1)+'. Clique em Baixar de novo.';$('go').disabled=false;return}
l.forEach((p,k)=>OUT.push([p[0],p[1],z[k]]));$('bi').style.width=(100*Math.min(1,(i+100)/t.length))+'%';await new Promise(r=>setTimeout(r,1100))}
$('log').textContent+='\\nConcluído: '+OUT.length+' pontos'+(ft?' (fonte: Open-Meteo 90 m)':' (fonte: SRTM 30 m)');$('dl').disabled=false;$('go').disabled=false};
$('dl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['lon,lat,z\\n'+OUT.map(p=>p.join(',')).join('\\n')],{type:'text/csv'}));a.download='malha_levantamento.csv';document.body.appendChild(a);a.click();a.remove()};${Se}</body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], {type: 'text/html'})); a.download = 'baixar_malha_' + (lv.nome || 'bacia').replace(/[^\w\-]+/g, '_') + '.html'; document.body.appendChild(a); a.click(); a.remove();
  toast('Página baixada: abra no navegador, toque em “Baixar altitudes” e depois importe o CSV aqui.');
}
/* ---------- saídas ---------- */
function lev27Baixa(nome, txt, tipo) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], {type: tipo})); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); }
function lev27LinhasEstrada(E) {
  const r = E.road, larg = lev27Par('larg'), cai = 0.02;
  return r.ds.map((d, k) => ({est: d, estaca: estLabel(d), lon: r.ll[k][0], lat: r.ll[k][1], tBruto: r.zraw[k], tn: r.zc[k], cheia: isFinite(r.level[k]) ? r.level[k] : null, greide: r.greide[k], bordaE: r.greide[k] - cai * larg / 2, bordaD: r.greide[k] - cai * larg / 2, aterro: r.aterro[k]}));
}
function lev27EstradaCSV() {
  const E = lev27Estudo(); if (!E || !E.road) return; const f = (x, d) => isNum(x) ? x.toFixed(d).replace('.', ',') : '';
  const t = 'Estaca;Distância (m);Latitude;Longitude;Terreno levantado (m);Terreno corrigido (m);Nível de cheia hoje (m);Greide no eixo (m);Borda esquerda 2% (m);Borda direita 2% (m);Aterro no eixo (m)\n' +
    lev27LinhasEstrada(E).map(x => [x.estaca, f(x.est, 2), f(x.lat, 7), f(x.lon, 7), f(x.tBruto, 2), f(x.tn, 2), f(x.cheia, 2), f(x.greide, 3), f(x.bordaE, 3), f(x.bordaD, 3), f(x.aterro, 2)].join(';')).join('\n');
  lev27Baixa('estrada_' + (lev27G().estrada || lev27G().nome || 'levantamento').replace(/[^\w\-]+/g, '_') + '.csv', '\ufeff' + t, 'text/csv');
}
/* arquivo de projeto do Pavimento Intertravado (📂 Abrir): uma rua com terreno nas bordas e no eixo, greide, largura e coordenadas */
function lev27Intertravado() {
  const E = lev27Estudo(); if (!E || !E.road) return; const r = E.road, larg = lev27Par('larg'), nome = lev27G().estrada || 'Estrada';
  const nx = k => { const a = r.xy[Math.max(0, k - 1)], b = r.xy[Math.min(r.xy.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; };
  /* terreno nas bordas = terreno corrigido do eixo + variação lateral da malha (IDW) até a borda — só com malha densa (≤ 30 m); com malha mais aberta a variação lateral seria inventada pela interpolação, então usa o terreno do eixo */
  const tB = (k, sg) => { if (!(E.cel <= 30)) return +r.zc[k].toFixed(3); const n = nx(k), x = r.xy[k][0] + sg * n[0] * larg / 2, y = r.xy[k][1] + sg * n[1] * larg / 2, d = E.zAt(x, y) - E.zAt(r.xy[k][0], r.xy[k][1]); return +(r.zc[k] + (isFinite(d) ? d : 0)).toFixed(3); };
  const rows = r.ds.map((d, k) => ({est: +d.toFixed(3), tEsq: tB(k, 1), tEixo: +r.zc[k].toFixed(3), tDir: tB(k, -1), greide: +r.greide[k].toFixed(3), larg, lat: +r.ll[k][1].toFixed(7), lng: +r.ll[k][0].toFixed(7)}));
  const proj = {v: 1, ident: {logradouro: nome, responsavel: ''}, topo: {caiEsq: '2', caiDir: '2', largPad: String(larg), rows, ruas: [{id: 'r1', nome: nome, paralela: null, geo: null, rows, obj: []}], ruaAtiva: 0},
    secoes: {talCorte: '1', talAterro: String(lev27Par('talude')), berma: '0.5', ev: ''},
    georef: {lat: r.ll[Math.floor(r.ll.length / 2)][1], lng: r.ll[Math.floor(r.ll.length / 2)][0], rot: 0, esc: 100, opD: 70, opS: 100, base: 'sat', modo: 'dec'},
    _meta: {formato: 'pint-projeto-completo', versao: 1, programa: 'Drenagem Pluvial 2 · 🏔 Levantamento da bacia (DR-27)', exportadoEm: new Date().toISOString(),
      obs: 'Estrada com ' + fmt(larg, 1) + ' m de pista (sugestão: 6,00 m de blocos + 2 × 1,00 m de piso-grama junto ao meio-fio), caimento de 2 % do eixo para as bordas, greide do estudo de drenagem (cheia + folga e cobertura das travessias). Terreno = terreno levantado com correção de copa.'}};
  lev27Baixa('intertravado_' + nome.replace(/[^\w\-]+/g, '_') + '.json', JSON.stringify(proj, null, 1), 'application/json');
  toast('Arquivo baixado: no Pavimento Intertravado use 📂 Abrir e escolha este .json.');
}
async function lev27Xlsx() {
  const E = lev27Estudo(); if (!E || E.erro) return toast('Calcule o estudo antes.');
  try { await loadScript(LIB_XLSX); } catch (e) { return toast('Sem internet para gerar o .xlsx.'); }
  const wb = XLSX.utils.book_new(), b = E.bac, p = E.ponte, add = (nome, aoa, w) => { const s = XLSX.utils.aoa_to_sheet(aoa); if (w) s['!cols'] = w.map(x => ({wch: x})); XLSX.utils.book_append_sheet(wb, s, nome); };
  const r2 = (x, d) => isNum(x) ? +x.toFixed(d) : '';
  add('Bacia', [['Estudo da bacia — ' + (lev27G().nome || P.proj.nome)], [], ['Área da poligonal (km²)', r2(b.A, 3)], ['Área drenada na grade (km²)', r2(b.Agrade, 3)], ['Talvegue L (m)', r2(b.L, 0)], ['Desnível H (m)', r2(b.H, 1)], ['Declividade média (m/m)', r2(b.S, 5)], ['Declividade 10–85 % (m/m)', r2(b.S1085, 5)],
    ['Cota mínima (m)', r2(b.zmin, 1)], ['Cota média (m)', r2(b.zmed, 1)], ['Cota máxima (m)', r2(b.zmax, 1)], ['Grade (m)', r2(b.cel, 0)], ['Pontos da malha', b.nPts], [], ['Tc Kirpich (min)', r2(b.tcK, 1)], ['Tc Ventura (min)', r2(b.tcV, 1)], ['Tc Pasini (min)', r2(b.tcP, 1)], ['Tc adotado (min)', r2(b.tc, 1)], [],
    ['IDF', P.idf.fonte, 'a', +P.idf.a, 'b', +P.idf.b, 'c', +P.idf.c, 'd', +P.idf.d], ['φ = A^-0,15', r2(b.phi, 4)], [], ['TR (anos)', 'i (mm/h)', 'Q C=0,30', 'Q C=0,40', 'Q C=0,50']].concat([10, 25, 50, 100].map(T => [T, r2(b.i[T], 2), r2(b.QC[0.3][T], 2), r2(b.QC[0.4][T], 2), r2(b.QC[0.5][T], 2)])), [34, 30, 12, 12, 12]);
  add('Ponte', [[lev27Par('ponteNome')], ['Vão (m)', p.B], ['Altura livre (m)', p.H], ['n', p.n], ['S (m/m)', r2(p.S, 5)], ['Folga (m)', p.folga], ['TR', p.tr], ['Q de projeto (m³/s)', r2(p.Qd, 2)], ['Capacidade com folga (m³/s)', r2(p.Qf, 2)], ['Capacidade cheia (m³/s)', r2(p.Qc, 2)], ['Lâmina necessária (m)', r2(p.yN, 2)], ['Vão necessário com folga (m)', r2(p.Bn, 1)], ['Situação', p.ok ? 'atende' : 'NÃO atende'], [], ['TR', 'Q (m³/s)', 'Lâmina (m)', 'V (m/s)']].concat(p.tab.map(x => [x.T, r2(x.Q, 2), r2(x.y, 2), r2(x.V, 2)])), [30, 14, 12, 12]);
  if (E.road) {
    add('Pontos baixos', [['Nº', 'Estaca', 'Distância (m)', 'Lat', 'Lon', 'Fundo (m)', 'Cheia (m)', 'Greide (m)', 'Aterro (m)', 'A local (km²)', 'L (m)', 'H (m)', 'Tc (min)', 'C', 'φ', 'Q TR trav. (m³/s)', 'Q25 (m³/s)', 'Travessia', 'V (m/s)', 'y/D ou y/H', 'Comprimento (m)', 'Cota montante', 'Cota jusante', 'Rio junto (km²)', 'Q rio TR ponte (m³/s)']]
      .concat(E.pools.map((q, i) => [i + 1, estLabel(q.s), r2(q.s, 1), r2(q.lat, 6), r2(q.lon, 6), r2(q.zf, 2), r2(q.nivel, 2), r2(q.greide, 2), r2(q.aterro, 2), r2(q.A, 3), r2(q.Lloc, 0), r2(q.Hloc, 1), r2(q.tc, 1), q.C, r2(q.phi, 3), r2(q.Q, 2), r2(q.Q25, 2), q.secTxt, q.sec ? r2(q.sec.V, 2) : '', q.sec ? r2(q.sec.yD, 2) : '', q.Lb || '', q.cm || '', q.cj || '', q.rio ? r2(q.Am, 2) : '', q.rio ? r2(q.QR, 1) : ''])));
    add('Perfil da estrada', [['Estaca', 'Distância (m)', 'Lat', 'Lon', 'Terreno levantado', 'Terreno corrigido', 'Cheia hoje', 'Greide eixo', 'Borda esq. 2%', 'Borda dir. 2%', 'Aterro']].concat(lev27LinhasEstrada(E).map(x => [x.estaca, r2(x.est, 2), r2(x.lat, 7), r2(x.lon, 7), r2(x.tBruto, 2), r2(x.tn, 2), x.cheia == null ? '' : r2(x.cheia, 2), r2(x.greide, 3), r2(x.bordaE, 3), r2(x.bordaD, 3), r2(x.aterro, 2)])));
  }
  add('Malha', [['Lon', 'Lat', 'Cota (m)']].concat(lev27G().pts));
  XLSX.writeFile(wb, 'estudo_bacia_' + (lev27G().nome || 'levantamento').replace(/[^\w\-]+/g, '_') + '.xlsx');
}
/* ---------- exemplo: Estrada de Aldeia Velha (16/11/2026) ---------- */
function lev27Exemplo() {
  if (!(P.ruas.length || P.pvs.length) || confirm('Abrir o exemplo da Estrada de Aldeia Velha como um PROJETO NOVO? (o projeto atual fica salvo na lista)')) {
    saveNow(); const id = uid(); P = migrate(blankProject('Estrada de Aldeia Velha — bacia, travessias e ponte da BR-101'));
    Object.assign(P.proj, {municipio: 'Rio das Ostras / RJ', local: 'Aldeia Velha — estrada até a BR-101'});
    P.lev27 = JSON.parse(JSON.stringify(LEV27_ALDEIA)); lev27IdfMacae(); DB.cur = id;
    lev27Projeto(true); saveNow(); afterLoad(); lev27Abrir();
    toast('Exemplo de Aldeia Velha criado como projeto novo (malha SRTM de ~250 m; importe a malha densa para refinar).');
  }
}
/* aba 4 (Bacias) e lista de projetos: acesso ao levantamento */
(function () {
  const v0 = vBacias;
  vBacias = function () { const h = v0.apply(this, arguments), E = P.lev27 ? lev27Estudo() : null;
    return `<div class="card" style="margin-bottom:.8rem;border-left:4px solid #0b6bcb"><h4 style="margin-top:0">🏔 Estudo da bacia pelo levantamento (malha de pontos)</h4>
      <p style="font-size:.85rem;margin:.2rem 0 .5rem">${E && !E.erro ? 'Bacia de ' + fmt(E.bac.A, 2) + ' km² · Tc ' + fmt(E.bac.tc, 0) + ' min · Q' + lev27Par('trPonte') + ' = ' + fmt(E.ponte.Qd, 1) + ' m³/s no deságue (' + esc(lev27Par('ponteNome')) + ': ' + (E.ponte.ok ? 'atende' : 'NÃO atende') + ')' + (E.road ? ' · ' + E.pools.length + ' pontos baixos na estrada' : '') : 'Importe a malha de pontos do terreno, a poligonal e a linha da estrada para o estudo completo da bacia (talvegues, Tc, vazões, pontos baixos, travessias e ponte).'}</p>
      <div class="bar-btns"><button class="btn btn-primary btn-sm" onclick="lev27Abrir()">🏔 Abrir o levantamento da bacia</button><button class="btn btn-secondary btn-sm" onclick="geo26Abrir()">🛰 Ver no mapa</button></div></div>` + h; };
  const add = () => { const bb = document.querySelector('#modal-projetos .bar-btns'); if (!bb || document.getElementById('lev27-ex-btn')) return; const b = document.createElement('button'); b.id = 'lev27-ex-btn'; b.className = 'btn btn-secondary btn-sm'; b.textContent = '＋ Exemplo — Estrada de Aldeia Velha (bacia e ponte)'; b.onclick = () => { closeModal('modal-projetos'); lev27Exemplo(); }; bb.appendChild(b); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
