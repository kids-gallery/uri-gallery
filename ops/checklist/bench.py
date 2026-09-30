"""API 점검 측정 자(2026-09-30, 점검 가이드 C1~C4·C6·C8) — 경로마다 warmup 5회(첫 요청·2~5번째 평균), 100회 p50·p95·최대, 동시 10건 × ROUNDS.
사용: python3 ops/checklist/bench.py [ROUNDS=4] name=url ...  → JSON. 새 연결로 잰다(curl과 같게, 외부는 TLS 포함).
"""
import time, urllib.request, urllib.error, statistics, concurrent.futures as cf, sys, json, os
def one(u):
    t=time.perf_counter()
    try:
        with urllib.request.urlopen(u, timeout=15) as r: r.read(); c=r.status
    except urllib.error.HTTPError as e: c=e.code
    except Exception: c=0
    return (time.perf_counter()-t)*1000, c
def pct(xs,p): xs=sorted(xs); return xs[min(len(xs)-1,int(round(p/100*len(xs)+0.5))-1)]
res={}
for name,u in [(a,b) for a,b in (x.split('=',1) for x in sys.argv[1:])]:
    first=[one(u) for _ in range(5)]            # 첫 요청 + 2~5번째 (= warmup 5회)
    ms=[one(u) for _ in range(100)]
    lat=[m for m,_ in ms]
    rounds=int(os.environ.get('ROUNDS','4'))
    conc=[]
    for _ in range(rounds):
        with cf.ThreadPoolExecutor(10) as ex: conc+=list(ex.map(one,[u]*10))
    res[name]=dict(status=ms[0][1], first=round(first[0][0],1), avg2_5=round(statistics.mean(m for m,_ in first[1:]),1),
        p50=round(pct(lat,50),1), p95=round(pct(lat,95),1), max=round(max(lat),1),
        fail=sum(1 for _,c in ms if c>=500 or c==0), conc_fail=sum(1 for _,c in conc if c!=ms[0][1]), conc_p95=round(pct([m for m,_ in conc],95),1))
print(json.dumps(res,ensure_ascii=False,indent=1))
