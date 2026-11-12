#!/usr/bin/env python3
"""Guarda DENTRO do index.html (sem aparecer na tela) a skill e o guia de cálculos da drenagem:
  .claude/skills/drenagem/SKILL.md   e   .claude/skills/drenagem/CALCULOS.md
Ficam em <script type="text/markdown"> (o navegador não executa nem mostra) e o programa os lê em window.TC_GUIA_IA.
Serve para outra IA (ou pessoa) entender o raciocínio, as fórmulas, as normas e as decisões do dono só com o arquivo.
Uso, na raiz do repositório, sempre que mudar os .md:   python3 scripts/embutir_guia.py"""
import re, pathlib, html
raiz = pathlib.Path(__file__).resolve().parent.parent
pasta = raiz / '.claude/skills/drenagem'
def bloco(id_, arq):
    t = (pasta / arq).read_text(encoding='utf-8')
    t = t.replace('</script', '<\\/script').replace('<!--', '<\\!--').replace('<script', '<\\script')   # dentro de <script> esses textos confundem o navegador
    return f'<script type="text/markdown" id="{id_}" data-origem=".claude/skills/drenagem/{arq}">\n{t}</script>'
novo = ('<!-- GUIA-IA:INICIO — skill e guia de cálculos da Drenagem Pluvial 2 guardados no programa (não aparecem na tela).\n'
        '     Para IAs e projetistas: leia #guia-ia-skill (como trabalhar no programa) e #guia-ia-calculos (fórmulas, critérios, normas, decisões).\n'
        '     Gerado por scripts/embutir_guia.py a partir de .claude/skills/drenagem/. -->\n'
        + bloco('guia-ia-skill', 'SKILL.md') + '\n' + bloco('guia-ia-calculos', 'CALCULOS.md') + '\n'
        + '<script>(function () { const ler = id => ((document.getElementById(id) || {}).textContent || "").replace(/<\\\\(\\/?script|!--)/gi, "<$1"); window.TC_GUIA_IA = {skill: ler("guia-ia-skill"), calculos: ler("guia-ia-calculos")}; })();</script>\n'
        + '<!-- GUIA-IA:FIM -->')
idx = raiz / 'index.html'; s = idx.read_text(encoding='utf-8')
if '<!-- GUIA-IA:INICIO' in s:
    s = re.sub(r'<!-- GUIA-IA:INICIO.*?<!-- GUIA-IA:FIM -->', lambda _: novo, s, flags=re.S)
else:
    i = s.rstrip().rfind('</body>'); assert i > 0, 'sem </body>'
    s = s[:i] + novo + '\n' + s[i:]
idx.write_text(s, encoding='utf-8'); print('Guia e skill embutidos no index.html (%d caracteres).' % len(novo))
