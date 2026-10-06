#!/usr/bin/env python3
"""Fetch pinned Microsoft SDK build inputs; no secrets or runtime user data."""
from pathlib import Path
import hashlib,io,urllib.request,zipfile
ROOT=Path(__file__).resolve().parents[1]
VERSION="1.0.3537.50"
EXPECTED={'WebView2.h': '387a0524c1a4498db32756a6d3b1f4d43a90ac80cb921527f15d3dbf4a857459', 'WebView2Loader.dll': '2f965e10aed3b356a408978a0e6d74eb86e3e722dd008fa9ad39f68884479e85'}
def download(url):
    with urllib.request.urlopen(url,timeout=90) as response:return response.read()
folder=ROOT/'vendor';folder.mkdir(exist_ok=True)
if not all((folder/name).is_file() and hashlib.sha256((folder/name).read_bytes()).hexdigest()==digest for name,digest in EXPECTED.items()):
    archive=zipfile.ZipFile(io.BytesIO(download(f"https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/{VERSION}/microsoft.web.webview2.{VERSION}.nupkg")))
    for name,path in {'WebView2.h':'build/native/include/WebView2.h','WebView2Loader.dll':'build/native/x64/WebView2Loader.dll'}.items():
        data=archive.read(path)
        if hashlib.sha256(data).hexdigest()!=EXPECTED[name]:raise SystemExit(f"SDK checksum mismatch: {name}")
        (folder/name).write_bytes(data)
installer=folder/'MicrosoftEdgeWebview2Setup.exe'
if not installer.is_file():
    data=download('https://go.microsoft.com/fwlink/p/?LinkId=2124703')
    if not data.startswith(b'MZ'):raise SystemExit('Invalid Microsoft bootstrapper download')
    installer.write_bytes(data)
print('Microsoft WebView2 build inputs ready.')
