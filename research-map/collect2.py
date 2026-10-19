"""キーワード検索で、DNA integrity の流れにある文献を集める (直接引用していないものも含む)。

出力 (data/):
  keyword_raw.json   検索で見つかった文献 (書誌・抄録・MeSH・どの検索式に当たったか・起点を引用しているか)
"""
import json, time, urllib.request, urllib.parse, xml.etree.ElementTree as ET, os

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, 'data')
QUERIES = {
    'integrity': '("DNA integrity"[tiab] OR "cfDNA integrity"[tiab] OR "integrity index"[tiab]) AND (cell-free[tiab] OR circulating[tiab] OR plasma[tiab] OR serum[tiab])',
    'alu': '(ALU247[tiab] OR "ALU 247"[tiab] OR "ALU-247"[tiab] OR ALU115[tiab] OR "ALU 115"[tiab] OR "ALU-115"[tiab] OR "ALU-qPCR"[tiab])',
    'fragmentomics': '(fragmentomics[tiab] OR "fragment size"[tiab] OR "fragment length"[tiab] OR "fragmentation pattern"[tiab] OR "fragmentation profile"[tiab]) AND ("cell-free DNA"[tiab] OR cfDNA[tiab] OR ctDNA[tiab])',
}


def get(url, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                return r.read()
        except Exception:
            time.sleep(3 + 3 * i)
    raise RuntimeError(url)


citing = {r['pmid'] for r in json.load(open(os.path.join(D, 'citing_raw.json'), encoding='utf-8')) if r.get('pmid')}
hits = {}
for name, q in QUERIES.items():
    u = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?' + urllib.parse.urlencode({'db': 'pubmed', 'term': q, 'retmax': 5000, 'retmode': 'json'})
    ids = json.loads(get(u))['esearchresult']['idlist']
    for i in ids:
        hits.setdefault(i, set()).add(name)
    print(name, len(ids))
    time.sleep(0.5)

recs = {}
ids = list(hits)
for i in range(0, len(ids), 200):
    chunk = ids[i:i + 200]
    root = ET.fromstring(get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=' + ','.join(chunk)))
    for a in root.findall('PubmedArticle'):
        mc = a.find('MedlineCitation')
        pm = mc.findtext('PMID')
        art = mc.find('Article')
        y = art.findtext('Journal/JournalIssue/PubDate/Year') or (art.findtext('Journal/JournalIssue/PubDate/MedlineDate') or '')[:4]
        aff = [x.text for x in art.findall('AuthorList/Author/AffiliationInfo/Affiliation') if x.text]
        doi = ''
        for e in a.findall('PubmedData/ArticleIdList/ArticleId'):
            if e.get('IdType') == 'doi':
                doi = e.text
        recs[pm] = {
            'pmid': pm, 'doi': doi or None,
            'title': ''.join(art.find('ArticleTitle').itertext()),
            'year': int(y) if y.isdigit() else None,
            'journal': art.find('Journal').findtext('ISOAbbreviation'),
            'authors': [f"{x.findtext('LastName') or ''} {x.findtext('Initials') or ''}".strip() for x in art.findall('AuthorList/Author')],
            'abstract': '\n'.join(((t.get('Label') + ': ') if t.get('Label') else '') + ''.join(t.itertext()) for t in art.findall('Abstract/AbstractText')),
            'pubtypes': [p.text for p in art.findall('PublicationTypeList/PublicationType')],
            'mesh': [m.findtext('DescriptorName') for m in mc.findall('MeshHeadingList/MeshHeading')],
            'keywords': [k.text for k in mc.findall('KeywordList/Keyword') if k.text],
            'affiliation_first': aff[0] if aff else None,
            'queries': sorted(hits[pm]),
            'cites_seed': pm in citing,
        }
    print('fetched', min(i + 200, len(ids)), '/', len(ids))
    time.sleep(0.5)
out = sorted(recs.values(), key=lambda r: (r.get('year') or 0, r['title']))
json.dump(out, open(os.path.join(D, 'keyword_raw.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('total', len(out), 'of which cite a seed', sum(r['cites_seed'] for r in out))
