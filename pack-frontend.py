from pathlib import Path
import re, hashlib, base64
root=Path(__file__).resolve().parent
output=root/'frontend/dist'
html=(output/'index.html').read_text()
script=re.search(r'<script[^>]+src="([^"]+)"[^>]*></script>',html)
style=re.search(r'<link[^>]+href="([^"]+\.css)"[^>]*>',html)
js=(output/script.group(1).lstrip('/')).read_text().replace('</script','<\\/script')
css=(output/style.group(1).lstrip('/')).read_text()
hash_js=base64.b64encode(hashlib.sha256(js.encode()).digest()).decode()
hash_css=base64.b64encode(hashlib.sha256(css.encode()).digest()).decode()
csp=f"default-src 'none'; script-src 'sha256-{hash_js}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
html=html[:script.start()]+f'<script type="module">{js}</script>'+html[script.end():]
html=re.sub(r'<link[^>]+href="[^"]+\.css"[^>]*>',lambda _:f'<style>{css}</style>',html)
html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+csp+'">')
assert 'chatgpt.site' not in html and '/api/workspace' in html
(root/'assets/index.html').write_text(html)
print('Local UI packaged:',len(html.encode()),'bytes')
