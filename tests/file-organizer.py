"""Real native organizer: collisions, restart undo, recovery and access boundaries."""
import json, pathlib, subprocess, tempfile, sys
script=str(pathlib.Path('src/assistant-tools.ps1').resolve())
with tempfile.TemporaryDirectory() as tmp:
 base=pathlib.Path(tmp);store=base/'store';root=base/'files';store.mkdir();root.mkdir()
 def call(action,**data):
  r=subprocess.run([sys.argv[1],'-NoProfile','-File',script,'-Store',str(store)],input=json.dumps({'action':action,**data}),capture_output=True,text=True,timeout=30)
  assert r.returncode==0,(r.stdout,r.stderr)
  return json.loads(r.stdout)
 rid=call('folderAdd',path=str(root))['data']['roots'][0]['id']
 (root/'note.txt').write_text('original');(root/'Dokumen').mkdir();(root/'Dokumen'/'note.txt').write_text('existing')
 (root/'ped.ydd').write_bytes(b'model');(root/'ped.ytd').write_bytes(b'texture');(root/'ped.ymt').write_bytes(b'metadata')
 (root/'nested').mkdir();(root/'nested'/'stay.png').write_bytes(b'keep');(root/'.hidden').write_text('keep')
 result=call('fileOrganize',id=rid);assert result['ok'],result;assert result['data']['moved']==4,result
 assert (root/'Dokumen'/'note.txt').read_text()=='existing';assert (root/'Dokumen'/'note (1).txt').read_text()=='original'
 for ext in ('ydd','ytd','ymt'):assert (root/'Aset FiveM'/('ped.'+ext)).exists()
 assert (root/'nested'/'stay.png').exists() and (root/'.hidden').exists()
 assert not call('fileOrganize',id=rid)['ok'],'pending undo history must not be overwritten'
 assert call('fileHistory',id=rid)['data']['undoAvailable'],'history survives a new process'
 (root/'Aset FiveM'/'ped.ytd').write_bytes(b'edited')
 result=call('fileUndo',id=rid);assert result['data']['moved']==3 and len(result['data']['errors'])==1,result
 assert (root/'Aset FiveM'/'ped.ytd').read_bytes()==b'edited','edited file remains in place'
 (root/'Aset FiveM'/'ped.ytd').write_bytes(b'texture');assert call('fileUndo',id=rid)['data']['moved']==1
 assert not call('fileHistory',id=rid)['data']['undoAvailable']
 # Crash after the actual move but before the journal status update.
 call('fileOrganize',id=rid);journal=next(store.glob('dante-*.json'));j=json.loads(journal.read_text());j['entries'][0]['status']='moving';journal.write_text(json.dumps(j))
 assert call('fileUndo',id=rid)['data']['moved']==4
 # Crash after undo before journal update: reconciled without an extra move.
 call('fileOrganize',id=rid);j=json.loads(journal.read_text());e=j['entries'][0];(root/e['destination']).rename(root/e['source'])
 result=call('fileUndo',id=rid);assert result['data']['errors']==[] and not result['data']['undoAvailable'],result
 (root/'package.json').write_text('{}');assert not call('fileOrganize',id=rid)['ok'];(root/'package.json').unlink()
 outside=base/'outside';outside.mkdir();
 try:(root/'Gambar').symlink_to(outside,target_is_directory=True)
 except OSError:
  # Windows CI may lack symbolic-link privilege; create a directory junction instead.
  r=subprocess.run(['cmd','/c','mklink','/J',str(root/'Gambar'),str(outside)],capture_output=True,text=True);assert r.returncode==0,r.stderr
 (root/'photo.png').write_bytes(b'image')
 result=call('fileOrganize',id=rid);assert result['data']['errors'] and (root/'photo.png').exists();assert list(outside.iterdir())==[]
 call('folderRemove',id=rid);assert not call('fileUndo',id=rid)['ok'];assert not call('fileOrganize',id=rid)['ok']
 print('Passed: organize, FiveM companions, collisions, subfolder preservation, durable undo, crash recovery, modified-file protection, project and symlink protection, access revocation.')
