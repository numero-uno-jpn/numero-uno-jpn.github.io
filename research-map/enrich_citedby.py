"""被引用数が欠けている文献について、OpenAlex から PMID で被引用数と国を補う。

出力: data/citedby_extra.json  {pmid: {"cited_by": n, "countries": [...]}}
"""
import json, os, time, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, 'data')
lin = json.load(open(os.path.join(D, 'lineage.json'), encoding='utf-8'))
need = [n['pmid'] for n in lin['nodes'] if n.get('pmid') and n.get('cited_by') is None]
need += [a['pmid'] for a in lin['anchors']['prior']]
out = {}
for i in range(0, len(need), 50):
    chunk = need[i:i + 50]
    q = urllib.parse.urlencode({'filter': 'pmid:' + '|'.join(chunk), 'per-page': 50, 'select': 'ids,cited_by_count,authorships'})
    with urllib.request.urlopen('https://api.openalex.org/works?' + q, timeout=90) as r:
        d = json.load(r)
    for w in d['results']:
        pm = ((w.get('ids') or {}).get('pmid') or '').rsplit('/', 1)[-1]
        if pm:
            out[pm] = {'cited_by': w.get('cited_by_count'),
                       'countries': sorted({c for a in w.get('authorships', []) for c in (a.get('countries') or [])})}
    time.sleep(0.3)
json.dump(out, open(os.path.join(D, 'citedby_extra.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('needed', len(need), 'found', len(out))
