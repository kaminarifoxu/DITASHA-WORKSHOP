import {openStore,passwordHash} from './store.mjs';
import {createInterface} from 'node:readline/promises';
const directory=process.env.DATA_DIR||'/data';const db=openStore(directory);
try{
 const command=process.argv[2];if(!['init','reset-password','backup'].includes(command))throw new Error('Use: node admin.mjs init | reset-password | backup');
 if(command==='backup'){const path=process.argv[3];if(!path||!/^\/data\/[a-zA-Z0-9._-]+\.sqlite$/.test(path))throw new Error('Backup path must be /data/name.sqlite');db.prepare('VACUUM INTO ?').run(path);console.log('Database backup saved.');}
 else {if(command==='init'&&db.prepare('SELECT id FROM owner').get())throw new Error('Owner already exists. Use reset-password.');const lines=[];for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity}))lines.push(line);const [username,password]=lines;if(!username||!/^[-a-zA-Z0-9_]{3,60}$/.test(username)||!password||password.length<12||password.length>128)throw new Error('Username: 3–60 letters/numbers. Password: 12–128 characters. Supply username and password on separate stdin lines.');const encoded=await passwordHash(password);db.prepare('INSERT INTO owner VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,password=excluded.password').run(username,encoded);db.prepare('DELETE FROM sessions').run();console.log('Owner account saved; existing phone sessions logged out.');}
}catch(e){console.error(e.message);process.exitCode=1;}finally{db.close();}
