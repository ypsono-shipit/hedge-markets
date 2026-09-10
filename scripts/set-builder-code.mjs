import {createInterface} from 'node:readline/promises';
import {stdin as input, stdout as output} from 'node:process';
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const envPath=resolve(root,'.env');
const pattern=/^0x[0-9a-fA-F]{64}$/;

async function readCode(){
  const fromArg=(process.argv[2]||'').trim();
  if(fromArg)return fromArg;
  if(!input.isTTY)throw new Error('Pass the builder code as an argument, or run this in a terminal.');
  const rl=createInterface({input,output});
  try{
    return (await rl.question('Paste your Polymarket builder code (0x + 64 hex): ')).trim();
  }finally{
    rl.close();
  }
}

const code=await readCode();
if(!pattern.test(code)){
  console.error('Expected a builder code: 0x followed by 64 hex characters.');
  console.error('Copy it from polymarket.com → Settings → Builders. Do not paste API secrets or wallet keys.');
  process.exit(1);
}

let text='';
try{text=await readFile(envPath,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}
const lines=text.split(/\r?\n/).filter(line=>line.length>0&&!line.startsWith('POLYMARKET_BUILDER_CODE='));
lines.push('POLYMARKET_BUILDER_CODE='+code);
await writeFile(envPath,lines.join('\n')+'\n',{mode:0o600});
console.log('Saved POLYMARKET_BUILDER_CODE to .env');
console.log('Restart the app if it is already running: npm start');
