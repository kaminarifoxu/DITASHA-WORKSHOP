#!/usr/bin/env python3
"""Package only deployment inputs; exclude local data and credentials."""
import argparse, pathlib, zipfile
root = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
args = parser.parse_args()
output = pathlib.Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
names = ['server.mjs', 'store.mjs', 'admin.mjs', 'Dockerfile', 'compose.yaml',
         'Caddyfile', '.env.example', 'setup-owner.sh', 'README.md', 'nginx.conf.example']
files = [root/'sync-server'/name for name in names]
files += sorted((root/'sync-server/public').glob('*'))
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for file in files:
        assert file.is_file(), file
        archive.write(file, str(pathlib.Path('ditasha-sync')/file.relative_to(root/'sync-server')))
print(output)
