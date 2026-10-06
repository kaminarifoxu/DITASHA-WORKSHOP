#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
root=Path(__file__).resolve().parents[1]
if len(sys.argv)!=2 or not re.fullmatch(r'\d+\.\d+\.\d+',sys.argv[1]):raise SystemExit('Usage: python3 scripts/set-version.py MAJOR.MINOR.PATCH')
v=sys.argv[1]
p=root/'src/version.h';s=p.read_text();s=re.sub(r'#define APP_VERSION "[^"]+"',f'#define APP_VERSION "{v}"',s);s=re.sub(r'#define APP_VERSION_W L"[^"]+"',f'#define APP_VERSION_W L"{v}"',s);s=re.sub(r'#define APP_VERSION_TUPLE [^\n]+','#define APP_VERSION_TUPLE '+v.replace('.',',')+',0',s);p.write_text(s)
p=root/'assets/app.manifest';p.write_text(re.sub(r'assemblyIdentity version="[^"]+"',f'assemblyIdentity version="{v}.0"',p.read_text()))
p=root/'frontend/package.json';data=json.loads(p.read_text());data['version']=v;p.write_text(json.dumps(data,indent=2)+'\n')
p=root/'frontend/package-lock.json'
if p.exists():
 data=json.loads(p.read_text());data['version']=v;data['packages']['']['version']=v;p.write_text(json.dumps(data,indent=2)+'\n')
print('Version set to',v)
