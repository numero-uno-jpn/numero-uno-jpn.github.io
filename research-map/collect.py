"""DNA integrity 関連 3 論文の引用文献を PubMed と OpenAlex から集める。

出力 (data/):
  seeds.json        起点の 3 論文
  citing_raw.json   引用文献 (書誌情報・抄録・MeSH・どの起点を引用したか)
"""
import json, time, urllib.request, urllib.parse, xml.etree.ElementTree as ET, os

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, 'data')
SEEDS = {
    '17108224': {'doi': '10.1196/annals.1368.040', 'short': 'Serum vs plasma (Ann N Y Acad Sci 2006)'},
    '16963729': {'doi': '10.1200/jco.2006.05.9493', 'short': 'Breast cancer DNA integrity (J Clin Oncol 2006)'},
    '16723681': {'doi': '10.1373/clinchem.2006.068577', 'short': 'ALU qPCR DNA integrity (Clin Chem 2006)'},
}
MAILTO = 'mailto=research-map@example.org'


def get(url, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                return r.read()
        except Exception as e:
            time.sleep(3 + 3 * i)
    raise RuntimeError(url)


def jget(url):
    return json.loads(get(url))


# 1. PubMed の cited-in
pm_cites = {}
for p in SEEDS:
    d = jget(f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&db=pubmed&linkname=pubmed_pubmed_citedin&id={p}&retmode=json')
    ls = d['linksets'][0].get('linksetdbs', [])
    for c in (ls[0]['links'] if ls else []):
        pm_cites.setdefault(c, set()).add(p)
    time.sleep(0.4)
print('pubmed citing', len(pm_cites))

# 2. OpenAlex の cited-by
oa = {}
for p, s in SEEDS.items():
    w = jget(f'https://api.openalex.org/works/doi:{s["doi"]}?{MAILTO}')
    s['openalex'] = w['id']
    s['cited_by_count_openalex'] = w['cited_by_count']
    page = 1
    while True:
        q = urllib.parse.urlencode({'filter': f'cites:{w["id"].rsplit("/", 1)[-1]}', 'per-page': 200, 'page': page,
                                    'select': 'id,doi,title,publication_year,type,ids,primary_location,authorships,cited_by_count,language'})
        d = jget(f'https://api.openalex.org/works?{q}&{MAILTO}')
        for r in d['results']:
            e = oa.setdefault(r['id'], {'oa': r, 'seeds': set()})
            e['seeds'].add(p)
        if page * 200 >= d['meta']['count'] or not d['results']:
            break
        page += 1
        time.sleep(0.2)
    print(p, 'openalex cited_by', s['cited_by_count_openalex'])
print('openalex citing (union)', len(oa))

# 3. 統合: PMID をキーにまとめる (PMID の無いものは OpenAlex ID)
recs = {}
for wid, e in oa.items():
    r = e['oa']
    pmid = ((r.get('ids') or {}).get('pmid') or '').rsplit('/', 1)[-1] or None
    key = pmid or wid
    rec = recs.setdefault(key, {'pmid': pmid, 'openalex': wid, 'seeds': set(), 'src': set()})
    rec['seeds'] |= e['seeds']
    rec['src'].add('openalex')
    rec['doi'] = (r.get('doi') or '').replace('https://doi.org/', '') or None
    rec['title'] = r.get('title')
    rec['year'] = r.get('publication_year')
    rec['type_openalex'] = r.get('type')
    rec['journal'] = ((r.get('primary_location') or {}).get('source') or {}).get('display_name')
    rec['cited_by_count'] = r.get('cited_by_count')
    rec['language'] = r.get('language')
    rec['countries'] = sorted({c for a in r.get('authorships', []) for c in (a.get('countries') or [])})
    rec['authors'] = [a['author']['display_name'] for a in r.get('authorships', [])]
for pm, seeds in pm_cites.items():
    rec = recs.setdefault(pm, {'pmid': pm, 'seeds': set(), 'src': set()})
    rec['seeds'] |= seeds
    rec['src'].add('pubmed')

# 4. PubMed から抄録・MeSH・出版種別を取得
pmids = [k for k, v in recs.items() if v.get('pmid')]
for i in range(0, len(pmids), 150):
    chunk = pmids[i:i + 150]
    x = get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=' + ','.join(chunk))
    root = ET.fromstring(x)
    for a in root.findall('PubmedArticle'):
        mc = a.find('MedlineCitation')
        pm = mc.findtext('PMID')
        art = mc.find('Article')
        rec = recs.get(pm)
        if rec is None:
            continue
        rec['title'] = rec.get('title') or ''.join(art.find('ArticleTitle').itertext())
        rec['title_pubmed'] = ''.join(art.find('ArticleTitle').itertext())
        rec['abstract'] = '\n'.join(((t.get('Label') + ': ') if t.get('Label') else '') + ''.join(t.itertext()) for t in art.findall('Abstract/AbstractText'))
        rec['pubtypes'] = [p.text for p in art.findall('PublicationTypeList/PublicationType')]
        rec['mesh'] = [m.findtext('DescriptorName') for m in mc.findall('MeshHeadingList/MeshHeading')]
        rec['keywords'] = [k.text for k in mc.findall('KeywordList/Keyword') if k.text]
        rec['journal'] = rec.get('journal') or art.find('Journal').findtext('ISOAbbreviation')
        y = art.findtext('Journal/JournalIssue/PubDate/Year') or (art.findtext('Journal/JournalIssue/PubDate/MedlineDate') or '')[:4]
        rec['year'] = rec.get('year') or (int(y) if y.isdigit() else None)
        if not rec.get('authors'):
            rec['authors'] = [f"{x.findtext('LastName') or ''} {x.findtext('Initials') or ''}".strip() for x in art.findall('AuthorList/Author')]
        aff = [x.text for x in art.findall('AuthorList/Author/AffiliationInfo/Affiliation') if x.text]
        rec['affiliation_first'] = aff[0] if aff else None
    time.sleep(0.5)

out = []
for k, v in recs.items():
    v['seeds'] = sorted(v['seeds'])
    v['src'] = sorted(v['src'])
    out.append(v)
out.sort(key=lambda r: (r.get('year') or 0, r.get('title') or ''))
json.dump(SEEDS, open(os.path.join(D, 'seeds.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(out, open(os.path.join(D, 'citing_raw.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('total records', len(out), 'with pmid', sum(1 for r in out if r.get('pmid')), 'with abstract', sum(1 for r in out if r.get('abstract')))
