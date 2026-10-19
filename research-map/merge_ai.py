"""AI による抄録分類 (data/ai/out*.json) を corpus.json に統合し、ページ用データを作る。

出力: data/lineage.json  (ページが読み込むデータ。抄録は含めない)
"""
import json, os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, 'data')
corpus = {x['id']: x for x in json.load(open(os.path.join(D, 'corpus.json'), encoding='utf-8'))}
seeds = json.load(open(os.path.join(D, 'seeds.json'), encoding='utf-8'))

ai = {}
for i in range(1, 5):
    b = json.load(open(os.path.join(D, 'ai', f'batch{i}.json'), encoding='utf-8'))
    o = json.load(open(os.path.join(D, 'ai', f'out{i}.json'), encoding='utf-8'))
    assert len(b) == len(o) and all(x['id'] == y['id'] for x, y in zip(b, o)), f'batch{i} mismatch'
    for y in o:
        ai[y['id']] = y
print('ai records', len(ai))

extra_path = os.path.join(D, 'citedby_extra.json')
extra = json.load(open(extra_path, encoding='utf-8')) if os.path.exists(extra_path) else {}

nodes = []
for k, x in corpus.items():
    a = ai.get(k)
    if a is None:
        continue
    if a['lineage'] in ('unrelated', 'background_only'):
        continue
    if k in seeds or k == '12873992':
        continue
    nodes.append({
        'id': k, 'pmid': x.get('pmid'), 'doi': x.get('doi'), 'title': x['title'], 'year': x['year'], 'journal': x['journal'],
        'first_author': x['first_author'], 'n_authors': x['n_authors'], 'countries': x['countries'] or extra.get(x.get('pmid') or '', {}).get('countries', []),
        'cited_by': x.get('cited_by_count') if x.get('cited_by_count') is not None else (extra.get(x.get('pmid') or '', {}).get('cited_by')),
        'direct': x['relation'] == 'direct', 'cites': x['cites'],
        'lineage': a['lineage'], 'review_type': a.get('review_type'),
        'cancers': a.get('cancers') or [], 'non_cancer': a.get('non_cancer'), 'species': a.get('species'),
        'specimen': a.get('specimen') or [], 'targets': a.get('targets') or [], 'methods': a.get('methods') or [],
        'alu': bool(a.get('uses_alu247_115')), 'purposes': a.get('purposes') or [], 'finding': a.get('finding'),
        'n': a.get('n_subjects'), 'summary_ja': a.get('summary_ja'),
    })

# 重複 (同じ論文が二重に登録されているもの) をタイトルで除く
seen, uniq = set(), []
for n in sorted(nodes, key=lambda n: (n['year'] or 0, n['title'] or '')):
    key = (n['title'] or '').lower().strip(' .')
    if key in seen:
        continue
    seen.add(key)
    uniq.append(n)
nodes = uniq

# 起点・先行研究・後継の代表論文
anchors = {
    'prior': [{'pmid': '12873992', 'title': 'Increased plasma DNA integrity in cancer patients.', 'year': 2003, 'journal': 'Cancer Res',
               'first_author': 'Wang BG', 'note_ja': '血漿 DNA の長い断片の割合 (integrity) ががん患者で高いことを最初に報告 (Johns Hopkins)'}],
    'seeds': [
        {'pmid': '16723681', 'year': 2006, 'journal': 'Clin Chem', 'title': 'Increased integrity of free circulating DNA in sera of patients with colorectal or periampullary cancer: direct quantitative PCR for ALU repeats.',
         'role_ja': 'DNA 精製不要の ALU 直接 qPCR (ALU247/115) を開発し、大腸癌・十二指腸乳頭部癌で integrity が高いことを示した'},
        {'pmid': '16963729', 'year': 2006, 'journal': 'J Clin Oncol', 'title': 'Prediction of breast tumor progression by integrity of free circulating DNA in serum.',
         'role_ja': '血清 DNA integrity が乳癌の進行度 (腫瘍径・リンパ管侵襲・リンパ節転移) と相関することを示した'},
        {'pmid': '17108224', 'year': 2006, 'journal': 'Ann N Y Acad Sci', 'title': 'Higher amount of free circulating DNA in serum than in plasma is not mainly caused by contaminated extraneous DNA during separation.',
         'role_ja': '血清の遊離 DNA が多いのは分離時の血球 DNA の混入が主因ではないことを示し、血清を使う根拠を与えた'},
    ],
}
for s in anchors['prior']:
    s['cited_by'] = extra.get(s['pmid'], {}).get('cited_by')
for s in anchors['seeds']:
    s['cited_by'] = seeds[s['pmid']].get('cited_by_count_openalex')
    s['first_author'] = 'Umetani N'

core = [n for n in nodes if n['lineage'] == 'integrity_core']
summary = {
    'n_nodes': len(nodes), 'lineage': Counter(n['lineage'] for n in nodes),
    'core_alu': sum(n['alu'] for n in core), 'core_n': len(core),
    'core_findings': Counter(n['finding'] for n in core),
    'core_cancers': Counter(c for n in core for c in n['cancers']).most_common(),
    'core_specimen': Counter(c for n in core for c in n['specimen']).most_common(),
    'core_targets': Counter(c for n in core for c in n['targets']).most_common(),
    'core_methods': Counter(c for n in core for c in n['methods']).most_common(),
    'core_purposes': Counter(c for n in core for c in n['purposes']).most_common(),
    'core_noncancer': Counter(n['non_cancer'] for n in core if n['non_cancer']).most_common(15),
    'core_species': Counter(n['species'] for n in core),
    'core_year': dict(sorted(Counter(n['year'] for n in core).items())),
    'review_types': Counter(n['review_type'] for n in nodes if n['lineage'] == 'review'),
    'countries_core': Counter(c for n in core for c in n['countries']).most_common(15),
}

allc = list(corpus.values())
trends = {
    'direct_citations': dict(sorted(Counter(x['year'] for x in allc if x['relation'] == 'direct' and x['year']).items())),
    'integrity_core': dict(sorted(Counter(n['year'] for n in core).items())),
    'fragmentomics_pubmed': dict(sorted(Counter(x['year'] for x in allc if x['relevance'] == 'fragmentomics' and x['year']).items())),
}
landmarks = sorted([{'pmid': x.get('pmid'), 'doi': x.get('doi'), 'title': x['title'], 'year': x['year'], 'journal': x['journal'],
                     'first_author': x['first_author'], 'cited_by': x.get('cited_by_count'), 'cites': x['cites']}
                    for x in allc if x['relation'] == 'direct' and x['relevance'] == 'fragmentomics' and (x.get('cited_by_count') or 0) >= 150],
                   key=lambda r: -r['cited_by'])

payload = {'anchors': anchors, 'nodes': nodes, 'summary': summary, 'trends': trends, 'fragmentomics_landmarks': landmarks}
# ページ (file:// でも動くように) は JS として読み込む
open(os.path.join(HERE, 'lineage.js'), 'w', encoding='utf-8').write('window.LINEAGE = ' + json.dumps(payload, ensure_ascii=False, default=dict, separators=(',', ':')) + ';\n')
json.dump(payload, open(os.path.join(D, 'lineage.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=dict)
print(json.dumps(summary, ensure_ascii=False, default=dict))
