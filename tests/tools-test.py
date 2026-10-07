"""Exercise the actual PowerShell folder operations in an isolated temporary tree."""
import json, subprocess, tempfile, pathlib, sys
pwsh=sys.argv[1];script=str(pathlib.Path('src/assistant-tools.ps1').resolve())
with tempfile.TemporaryDirectory() as directory:
 p=pathlib.Path(directory);store=p/'store';root=p/'files';store.mkdir();root.mkdir()
 (root/'hello.txt').write_text('Hello Dante — テスト',encoding='utf-8');(root/'occupied.txt').write_text('keep');(root/'binary.txt').write_bytes(b'\0binary');(p/'outside.txt').write_text('private')
 def call(action,**data):
  r=subprocess.run([pwsh,'-NoProfile','-File',script,'-Store',str(store)],input=json.dumps(dict(action=action,**data)),text=True,capture_output=True,timeout=10)
  assert r.returncode==0,(r.stdout,r.stderr)
  return json.loads(r.stdout)
 result=call('status');assert result['data']=={'accounts':[],'roots':[]}
 result=call('folderAdd',path=str(root));assert result['ok'],result
 rid=result['data']['roots'][0]['id'];assert isinstance(result['data']['roots'],list)
 assert len(call('fileList',id=rid)['data']['files'])==3
 assert call('fileRead',id=rid,path='hello.txt')['data']['content']=='Hello Dante — テスト'
 assert not call('fileRead',id=rid,path='binary.txt')['ok']
 assert not call('fileRead',id=rid,path='../outside.txt')['ok']
 assert not call('fileMove',id=rid,path='hello.txt',destination='../escape.txt')['ok']
 assert not call('fileMove',id=rid,path='hello.txt',destination='occupied.txt')['ok']
 assert (root/'occupied.txt').read_text()=='keep'
 link=root/'link';link.symlink_to(p,target_is_directory=True)
 assert not call('fileRead',id=rid,path='link/outside.txt')['ok']
 assert all(not f['path'].startswith('link') for f in call('fileList',id=rid)['data']['files'])
 result=call('fileMove',id=rid,path='hello.txt',destination='Documents/new-name.txt');assert result['ok'],result
 assert not (root/'hello.txt').exists();assert (root/'Documents/new-name.txt').read_text()=='Hello Dante — テスト'
 removed=call('folderRemove',id=rid);assert removed.get('ok'),removed;assert removed['data']['roots']==[]
 assert not call('fileRead',id=rid,path='Documents/new-name.txt')['ok']
 assert (root/'Documents/new-name.txt').exists()
 print('Passed: real file inventory/read/move, Unicode, traversal/junction rejection, overwrite protection, folder revocation, empty/list JSON shape.')
