#!/usr/bin/env python3
# Прогрев nginx-кэша /f1media/ фото пилотов (герой полной страницы = Cloudinary
# w_720,h_1000 генерится на лету 2.7с; после прогрева отдаётся из кэша мгновенно).
import httpx, sys
BASE='https://f1.lead-seek.ru'
def to_cache(u):
    return u.replace('https://media.formula1.com/', BASE+'/f1media/') if u and u.startswith('https://media.formula1.com/') else None
def variants(pu):
    out=[]
    if pu and 'c_fill,g_north,ar_1:1,w_200' in pu:
        out.append(pu.replace('c_fill,g_north,ar_1:1,w_200','c_fill,g_north,w_720,h_1000'))  # герой
        out.append(pu.replace('w_200','w_400'))  # карточка/аватар
    if pu: out.append(pu)
    return out
seasons=[2026,2025]
urls=set()
with httpx.Client(timeout=30) as c:
    for s in seasons:
        try:
            d=c.get(f'http://localhost:8002/api/standings/drivers?season={s}').json()
            for row in (d.get('standings') or []):
                for k in ('photo_url','card_photo_url','photo_url_large'):
                    for v in variants(row.get(k)):
                        cu=to_cache(v)
                        if cu: urls.add(cu)
        except Exception as e: print('skip',s,e)
    ok=0
    for u in sorted(urls):
        try:
            r=c.get(u); ok+= r.status_code==200
        except Exception: pass
    print(f'warmed {ok}/{len(urls)} driver photo URLs')
