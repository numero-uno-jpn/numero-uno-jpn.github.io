"""集めた文献を規則ベースで分類し、可視化用のコーパスを作る。

入力: data/citing_raw.json, data/keyword_raw.json, data/seeds.json
出力: data/corpus.json (1 文献 1 レコード。抄録は含めない)
      data/summary.json (集計)
"""
import json, os, re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, 'data')
seeds = json.load(open(os.path.join(D, 'seeds.json'), encoding='utf-8'))
citing = json.load(open(os.path.join(D, 'citing_raw.json'), encoding='utf-8'))
kw = json.load(open(os.path.join(D, 'keyword_raw.json'), encoding='utf-8'))

CANCER = {
    'breast': r'breast', 'colorectal': r'colorectal|colon|rectal|rectum|crc\b', 'lung': r'lung|nsclc|pulmonary (?:nodule|neoplasm)',
    'prostate': r'prostat', 'liver': r'hepatocellular|\bhcc\b|liver cancer|hepatic (?:cancer|tumou?r)', 'pancreas': r'pancrea',
    'gastric': r'gastric|stomach', 'esophagus': r'oesophag|esophag', 'ovary': r'ovar', 'cervix': r'cervical cancer|cervix',
    'endometrium': r'endometri', 'head & neck': r'head and neck|oral (?:cancer|squamous)|nasopharyn|laryn|hnscc',
    'thyroid': r'thyroid', 'melanoma': r'melanoma', 'bladder/urothelial': r'bladder|urothel', 'kidney': r'renal cell|kidney cancer|\brcc\b',
    'hematologic': r'lymphoma|leukemia|leukaemia|myeloma', 'brain': r'glioma|glioblastoma|brain tumou?r', 'biliary/periampullary': r'periampullary|biliary|cholangio|gallbladder',
    'testis': r'testicular|germ cell', 'sarcoma': r'sarcoma', 'neuroblastoma': r'neuroblastoma',
}
NONCANCER = {
    'trauma/critical care': r'trauma|injur|sepsis|septic|intensive care|critically ill', 'cardiovascular': r'myocardial|stroke|cardiac|coronary',
    'pregnancy/fetal': r'pregnan|fetal|foetal|prenatal|preeclampsia|placent', 'autoimmune/inflammatory': r'lupus|rheumat|inflammatory bowel|crohn|ulcerative colitis',
    'transplant': r'transplant', 'exercise': r'exercise|athlet', 'infection': r'covid|sars-cov|hiv|hepatitis|tubercul',
}
SPECIMEN = {'serum': r'\bserum\b|\bsera\b', 'plasma': r'plasma', 'urine': r'urin', 'csf': r'cerebrospinal|\bcsf\b', 'saliva': r'saliva',
            'effusion': r'pleural|ascit|effusion', 'tissue': r'tissue|biops'}
TARGET = {'ALU': r'\balu\b|alu\d|alu-|alu repeat|alu sequence', 'LINE-1': r'line-?1|\bline\b repeat|long interspersed', 'ACTB': r'actin|actb',
          'GAPDH': r'gapdh', 'mtDNA': r'mitochondrial dna|mtdna', 'APP/other gene': r'\bapp\b|amyloid precursor|hTERT|\bpgk1\b'}
METHOD = {'qPCR': r'qpcr|real-time|real time|quantitative pcr|quantitative polymerase', 'ddPCR': r'digital pcr|ddpcr|droplet',
          'electrophoresis': r'electrophore|bioanalyzer|tapestation|capillary', 'sequencing': r'sequencing|\bngs\b|whole-genome|whole genome|low-pass|shallow'}
PURPOSE = {'diagnosis': r'diagnos|detect|discriminat|distinguish|screen|biomarker', 'prognosis': r'prognos|surviv|recurren|outcome|mortality',
           'treatment monitoring': r'monitor|response|chemotherap|radiotherap|neoadjuvant|follow-up|treatment',
           'pre-analytics/method': r'pre-?analytic|processing|storage|extraction|standardi|method comparison|centrifug'}


def flags(text, table):
    return [k for k, p in table.items() if re.search(p, text, re.I)]


CF = r'cell-free|cfdna|circulating (?:cell-free |free )?dna|plasma dna|serum dna|free dna|ctdna|circulating tumou?r dna|liquid biops|cell free dna'


def relevance(text):
    t = text.lower()
    if not re.search(CF, t):
        return 'other'
    if re.search(r'integrity|alu ?-?247|alu ?-?115|alu247|alu115|long(?:er)?[- ]to[- ]short|ratio of (?:long|large)|fragment(?:ation)? index', t):
        return 'integrity'
    if re.search(r'fragmentom|fragment size|fragment length|fragmentation (?:pattern|profile)|size (?:profile|distribution|selection)|end motif|nucleosom', t):
        return 'fragmentomics'
    if re.search(r'cell-free dna|cfdna|circulating dna|ctdna|circulating tumou?r dna|free dna|liquid biops', t):
        return 'cfDNA (general)'
    return 'other'


def ptype(r):
    pts = ' '.join(r.get('pubtypes') or []) + ' ' + (r.get('type_openalex') or '')
    tl = (r.get('title') or '').lower()
    if 'Meta-Analysis' in pts or 'meta-analys' in tl:
        return 'meta-analysis'
    if 'Systematic Review' in pts or 'systematic review' in tl:
        return 'systematic review'
    if 'Review' in pts or re.search(r'\breview\b', tl) or (r.get('type_openalex') == 'review'):
        return 'review'
    if 'Case Reports' in pts:
        return 'case report'
    return 'original'


def is_noise(text):
    return bool(re.search(r'sperm|semen|oocyte|embryo quality|dna fragmentation index', text, re.I))


recs = {}
for r in citing:
    key = r.get('pmid') or r.get('openalex')
    recs[key] = dict(r, relation='direct')
for r in kw:
    if r['pmid'] in recs:
        recs[r['pmid']]['queries'] = r['queries']
        for k in ('abstract', 'mesh', 'pubtypes', 'keywords', 'affiliation_first', 'doi'):
            if not recs[r['pmid']].get(k):
                recs[r['pmid']][k] = r.get(k)
    else:
        recs[r['pmid']] = dict(r, relation='keyword', seeds=[])

out = []
for key, r in recs.items():
    text = ' '.join([r.get('title') or '', r.get('abstract') or '', ' '.join(r.get('mesh') or []), ' '.join(r.get('keywords') or [])])
    if r['relation'] == 'keyword' and is_noise(text):
        continue
    rel = relevance(text)
    if r['relation'] == 'keyword' and rel == 'other':
        continue
    animal = bool(re.search(r'\bdogs?\b|canine|bitch|\bmice\b|murine|\brats?\b|feline|\bcats?\b|equine|bovine', text, re.I)) and not re.search(r'\bpatients?\b', text, re.I)
    cancers = flags(text, CANCER)
    au = r.get('authors') or []
    out.append({
        'id': key, 'pmid': r.get('pmid'), 'doi': r.get('doi'), 'openalex': r.get('openalex'),
        'title': r.get('title_pubmed') or r.get('title'), 'year': r.get('year'), 'journal': r.get('journal'),
        'first_author': au[0] if au else None, 'last_author': au[-1] if len(au) > 1 else None, 'n_authors': len(au),
        'countries': r.get('countries') or [], 'affiliation_first': r.get('affiliation_first'),
        'relation': r['relation'], 'cites': r.get('seeds') or [], 'queries': r.get('queries') or [],
        'cited_by_count': r.get('cited_by_count'),
        'pubtype': ptype(r), 'relevance': rel, 'animal': animal,
        'cancers': cancers, 'non_cancer': flags(text, NONCANCER) if not cancers or rel != 'integrity' else flags(text, NONCANCER),
        'specimen': flags(text, SPECIMEN), 'targets': flags(text, TARGET), 'methods': flags(text, METHOD), 'purposes': flags(text, PURPOSE),
        'has_abstract': bool(r.get('abstract')),
    })
out.sort(key=lambda x: (x['year'] or 0, x['title'] or ''))
json.dump(out, open(os.path.join(D, 'corpus.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

direct = [x for x in out if x['relation'] == 'direct']
integ = [x for x in out if x['relevance'] == 'integrity']
summary = {
    'n_total': len(out), 'n_direct': len(direct), 'n_keyword_only': len(out) - len(direct),
    'relevance': Counter(x['relevance'] for x in out), 'relevance_direct': Counter(x['relevance'] for x in direct),
    'pubtype_integrity': Counter(x['pubtype'] for x in integ),
    'year_integrity': dict(sorted(Counter(x['year'] for x in integ).items(), key=lambda kv: kv[0] or 0)),
    'year_direct': dict(sorted(Counter(x['year'] for x in direct).items(), key=lambda kv: kv[0] or 0)),
    'cancers_integrity': Counter(c for x in integ for c in x['cancers']).most_common(),
    'noncancer_integrity': Counter(c for x in integ for c in x['non_cancer']).most_common(),
    'specimen_integrity': Counter(c for x in integ for c in x['specimen']).most_common(),
    'targets_integrity': Counter(c for x in integ for c in x['targets']).most_common(),
    'methods_integrity': Counter(c for x in integ for c in x['methods']).most_common(),
    'purposes_integrity': Counter(c for x in integ for c in x['purposes']).most_common(),
    'countries_direct': Counter(c for x in direct for c in x['countries']).most_common(20),
    'animal_integrity': sum(x['animal'] for x in integ),
}
json.dump(summary, open(os.path.join(D, 'summary.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=dict)
print(json.dumps(summary, ensure_ascii=False, indent=1, default=dict))
