"""Validate the research artifact, not Funcy runtime or third-party plugins."""
import collections,csv,hashlib,json,pathlib,re,sys

ROOT=pathlib.Path(__file__).resolve().parent.parent
REPO=ROOT.parents[2]
failures=[];checks=0
def check(condition,message):
    global checks
    checks+=1
    if not condition:failures.append(message)
def read(name):return json.loads((ROOT/name).read_text(encoding='utf-8'))

rows=read('catalog.json');summary=read('summary.json');sources=read('sources.json');evidence=read('evidence.json')
source_rows=[r for r in rows if r['kind']=='source_family']
ids=[r['id'] for r in rows]
check(len(ids)==len(set(ids)),'Duplicate catalog IDs')
check(len(rows)==summary['all_cards'],'Catalog row count mismatch')
check(len(source_rows)==summary['source_families'],'Source family count mismatch')
check(dict(collections.Counter(r['verdict'] for r in source_rows))==summary['source_verdicts'],'Source verdict counts mismatch')
check(dict(collections.Counter(r['verdict'] for r in rows))==summary['all_verdicts'],'All verdict counts mismatch')
check(len(evidence)==summary['python_texts_analyzed'],'Python evidence count mismatch')
check(len(sources['repositories'])==summary['repository_trees_screened'],'Repository count mismatch')
check(sum(c['posts'] for c in sources['channels'])==summary['public_posts'],'Telegram post count mismatch')
check(len(sources['channels'])==summary['public_channels'],'Telegram channel count mismatch')
check(all(c['stop_reason']=='history_exhausted' for c in sources['channels']),'A channel stopped before public history was exhausted')
check(sum(bool(e['parse_error']) for e in evidence)==summary['parse_errors'],'Parse error count mismatch')
check(sum(not e['content_sha_matches'] for e in evidence)==summary['hash_mismatches']==0,'A source blob hash mismatch exists')
doc_ids={d['id'] for d in sources['documents']}
valid_verdicts={'полный перенос','перенос с потерями','нужен помощник/сервер','недостаточно данных'}
required=['id','name','kind','flow','source','verdict','reason','losses','overlap','effort','confidence','license','checked_date']
for r in rows:
    for f in required:check(bool(r.get(f)),f"{r['id']}: missing {f}")
    check(r['verdict'] in valid_verdicts,f"{r['id']}: invalid verdict")
    check(r['checked_date']=='2026-11-03',f"{r['id']}: wrong date")
    check(r['source'].startswith('https://'),f"{r['id']}: invalid source URL")
    check(set(r['documentation'])<=doc_ids,f"{r['id']}: unknown documentation ID")
    check('Нет законченного' not in r['reason'],f"{r['id']}: uncurated fallback")
    if r['verdict']=='полный перенос':
        check(r['code_available'] and r['kind']=='source_family',f"{r['id']}: full verdict without inspected code")
        check(bool(r['symbols']),f"{r['id']}: full verdict without source symbols")
        check({'chrome-life','chrome-http'}<=set(r['documentation']),f"{r['id']}: missing runtime documentation")
    if r['kind']=='source_family':
        check(bool(re.fullmatch('[a-f0-9]{40}',r['blob_sha'] or '')),f"{r['id']}: invalid Git blob hash")
        check(bool(re.fullmatch('[a-f0-9]{40}',r['commit'] or '')),f"{r['id']}: no immutable commit")
        check(bool(r['variants']),f"{r['id']}: no version record")
    check(all('@' not in d and '://' not in d for d in r['domains']),f"{r['id']}: domain includes credentials/URL")

with (ROOT/'catalog.csv').open(encoding='utf-8-sig',newline='') as f:csv_rows=list(csv.DictReader(f,delimiter=';'))
check(len(csv_rows)==len(rows),'CSV row count mismatch')
for a,b in zip(rows,csv_rows):
    for key in ['id','name','source','verdict','reason','overlap','confidence','license']:
        check(a[key]==b[key],f"{a['id']}: CSV mismatch for {key}")
    for key,value in b.items():check(not value.startswith(('=','+','-','@')),f"{a['id']}: spreadsheet formula cell in {key}")

cards=(ROOT/'cards.md').read_text(encoding='utf-8');catalog=(ROOT/'catalog.md').read_text(encoding='utf-8')
anchors=set(re.findall(r'<a id="([^"]+)"></a>',cards))
for r in rows:
    check(r['id'].lower() in anchors,f"{r['id']}: card anchor missing")
    check(f"cards.md#{r['id'].lower()}" in catalog,f"{r['id']}: not in Markdown catalog")

for md in ROOT.glob('*.md'):
    text=md.read_text(encoding='utf-8')
    for target in re.findall(r'\]\(([^)]+)\)',text):
        if target.startswith(('https://','http://','#','mailto:')):continue
        target=target.split('#')[0].strip('<>')
        check((md.parent/target).resolve().is_file(),f'{md.name}: broken local link {target}')
    check('turn0search' not in text and 'cite' not in text,f'{md.name}: internal browser reference leaked')

for f in read('funcy-evidence.json'):
    path=REPO/f['path']
    check(path.is_file(),f"Missing Funcy baseline file {f['path']}")
    if path.is_file():
        check(hashlib.sha256(path.read_bytes()).hexdigest()==f['sha256'],f"Funcy baseline changed: {f['path']}")
        lines=path.read_text(encoding='utf-8-sig').splitlines()
        check(0<f['line']<=len(lines),f"Invalid local line {f['path']}")
        check(f['symbol'].lower() in lines[f['line']-1].lower(),f"Unverified local symbol {f['path']}")

details=read('scenario-details.json')
check({d['id'] for d in details}=={r['id'] for r in source_rows},'Scenario coverage mismatch')
evidence_index={(e['path'],e['blob_sha']):e for e in evidence}
scenario_md=(ROOT/'scenario-details.md').read_text(encoding='utf-8')
for d in details:
    check(bool(d['buyer_entry']),f"{d['id']}: missing scenario entry")
    check(f'<a id="{d["id"].lower()}"></a>' in scenario_md,f"{d['id']}: scenario anchor missing")
    local_files={f['path']:evidence_index.get((f['path'],f['blob_sha'])) for f in d['files_in_scope']}
    check(all(local_files.values()),f"{d['id']}: scenario file not in evidence index")
    for field in ['settings_evidence','automatic_entry','business_operations','network_and_funpay_calls','state_functions','exception_sites','timers']:
        for item in d[field]:
            match=local_files.get(item['path'])
            check(bool(match) and 0<item['line']<=match['line_count'],f"{d['id']}: invalid scenario line")
            check(item['url'].endswith('#L'+str(item['line'])),f"{d['id']}: scenario URL/line mismatch")
    check(d['exception_count']==len(d['exception_sites']),f"{d['id']}: exception count mismatch")

archives=read('release-archives.json')
check(len(archives)==19,'Protected archive coverage mismatch')
for archive in archives:
    check(archive['sha_matches'] and archive['sha256']==archive['expected_sha256'],f"{archive['plugin_id']}: archive hash mismatch")
    check(bool(re.fullmatch('[a-f0-9]{64}',archive['sha256'])),f"{archive['plugin_id']}: malformed SHA-256")
    check(archive['status']==200 and archive['bytes']>0,f"{archive['plugin_id']}: archive not retrieved")
    check(any('pyarmor_runtime' in f['path'] and f['path'].endswith('.pyd') for f in archive['files']),f"{archive['plugin_id']}: protected-layout evidence absent")
    check(any(f['path'].endswith('_pkg/__init__.py') for f in archive['files']),f"{archive['plugin_id']}: core package not inventoried")

probe=read('checks/probe-results.json');runtime=probe.get('runtime',{})
check(probe.get('pass') is True,'Isolated MV3 probe did not pass')
check(probe.get('workerObservedStopped') is True,'Worker stop was not observed')
check(probe.get('workerRestarted') is True,'A new worker instance was not observed')
check(runtime.get('instanceId')!=probe.get('afterWorkerRestart',{}).get('instanceId'),'Worker nonce did not change')
check(probe.get('afterWorkerRestart',{}).get('checkpoint',{}).get('providerOrder')=='synthetic-123','Checkpoint was not recovered')
check(runtime.get('rfc6238at59')=='94287082','RFC 6238 vector mismatch')
check(runtime.get('steamCodeAt59')=='PV9M4','Steam alphabet vector mismatch')
check(runtime.get('manualCookieHeader') is None,'Forbidden Cookie header unexpectedly accepted')
check(runtime.get('cookieJar')=='synthetic=jar','Cookie jar test mismatch')
check(runtime.get('dnrUserAgent')=='CardinalPortabilityProbe/1.0','DNR UA test mismatch')
check(runtime.get('sockets')=='undefined','TCP namespace expectation mismatch')
check(runtime.get('process')=='undefined' and runtime.get('require')=='undefined','Unexpected native environment')

result={'checked_date':'2026-11-03','checks':checks,'passed':checks-len(failures),'failed':len(failures),'failures':failures,'scope':'research data, immutable evidence links, baseline hashes and synthetic MV3 result; no live trading validation'}
(ROOT/'checks/validation-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(bool(failures))
