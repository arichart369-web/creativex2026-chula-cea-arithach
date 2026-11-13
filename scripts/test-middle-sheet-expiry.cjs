const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, '..', 'middle-agent-hq.html'), 'utf8');
const elements = new Map();
const el = id => {
  if (!elements.has(id)) elements.set(id, {textContent:'',innerHTML:'',hidden:false,classList:{toggle(){}},append(){}});
  return elements.get(id);
};
let oauth, expire;
const context = {
  console, Date, encodeURIComponent, AbortSignal,
  setTimeout(fn, ms) { if (ms === 3570000) expire = fn; return ms; }, clearTimeout(){},
  USE_DEMO:false, sheetStatusMessage:'', SHEET:{id:'test'}, webReader:null, LIVE:null, mcp:null,
  TASKS:Array.from({length:22}, () => ({stage:'new'})), STAGES:[['new','ลีดใหม่']],
  $:el, esc:s=>s, hhmm:()=> '12:00',sheetUrl:()=> 'https://example.test',renderKpis(){},
  cardHTML:c=>c.id,liveCards:()=>[{stage:'new',id:'REAL-1'}],
  document:{createElement:()=>({})},
  fetch:async()=>({ok:true,status:200,json:async()=>({values:[['รหัสลีด','ขั้น'],['REAL-1','ลีดใหม่']]})}),
};
context.window=context;
context.google={accounts:{oauth2:{initTokenClient(o){oauth=o;return {requestAccessToken(){oauth.callback({access_token:'test',expires_in:3600})}}},hasGrantedAllScopes:()=>true,revoke(){}}}};
vm.createContext(context);
for (const name of ['renderBoard','setSheet']) {
  const fn=source.match(new RegExp('function '+name+'\\([^]*?\\n}'))?.[0];
  assert(fn, name);vm.runInContext(fn,context);
}
context.rerenderAll=()=>context.renderBoard();
vm.runInContext(readFileSync(join(__dirname,'..','middle-sheets.js'),'utf8'),context);
context.webReader=context.createLeadSheetReader({clientId:'test',spreadsheetId:'test',range:'A1:X1000',
  onData(values,at){context.LIVE={leads:[{id:values[1][0]}],k:{lost:0},at};context.setSheet('live');},
  onClear(){context.LIVE=null;context.renderBoard();},
  onStatus(message,reconnect){context.setSheet(context.LIVE?'stale':'error',message,reconnect?{label:'เชื่อม Google',run:()=>context.webReader.connect()}:null);},
});
(async()=>{
 context.webReader.connect();await new Promise(setImmediate);
 assert(el('board').innerHTML.includes('REAL-1'));
 expire();
 assert.equal(context.LIVE,null);
 assert.equal(el('taskCount2').textContent,'–');
 assert(!el('board').innerHTML.includes('REAL-1'));
 assert(!el('board').innerHTML.includes('22'));
 assert(el('sheetMsg').innerHTML.includes('หมดเวลาเชื่อมต่อ'));
 assert(!el('demoText').textContent.includes('ตัวอย่าง'));
 assert.equal(el('demoAct').textContent,'เชื่อม Google');
 context.webReader.connect();await new Promise(setImmediate);
 assert(el('board').innerHTML.includes('REAL-1'));
 context.setSheet('stale','อ่านชีตไม่สำเร็จ');
 assert(el('board').innerHTML.includes('REAL-1'));
 assert(el('demoText').textContent.includes('แสดงข้อมูลล่าสุดเมื่อ'));
 context.webReader.disconnect();
 assert.equal(context.LIVE,null);
 assert.equal(el('taskCount2').textContent,'–');
 console.log('PASS: expiry hides live/demo cards, reconnect restores live board, temporary errors retain labelled data, disconnect stays empty');
})().catch(e=>{console.error(e);process.exitCode=1});
