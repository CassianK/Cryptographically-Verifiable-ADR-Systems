// ---------- helpers ----------
const $ = (id)=>document.getElementById(id);
const logEl = $('log'), caseIdEl = $('case-id'), merkleEl = $('merkle');
const dhEl = $('dh'), txAEl = $('tx-anchor'), txEEl = $('tx-exec');

const btnOpen=$('btn-open'), btnProof=$('btn-proof'), btnDelib=$('btn-delib');
const btnAnchor=$('btn-anchor'), btnExec=$('btn-exec');
const btnReset=$('btn-reset'), btnExport=$('btn-export'), btnCopyDH=$('copy-dh');
const caseSelect=$('case-select'), caseNotes=$('case-notes'), fileInput=$('file-input'), eList=$('e-list');

let state = {
  caseId: 0,
  files: [],           // {name,size,hash}
  merkle: null,
  decisionHash: null,
  anchorTx: null,
  execTx: null,
  signatures: [],      // [{signer, sig}]
  audit: []            // log entries for export
};

// crypto helpers
const enc = new TextEncoder();
async function sha256Hex(buf){
  const ab = await crypto.subtle.digest('SHA-256', buf);
  return '0x' + [...new Uint8Array(ab)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashFile(file){
  const buf = await file.arrayBuffer();
  return await sha256Hex(buf);
}
function now(){ return new Date().toLocaleTimeString([], {hour12:false}); }
function rnd(bytes=32){
  const a=new Uint8Array(bytes); crypto.getRandomValues(a);
  return '0x'+[...a].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function push(msg){
  const line = `[${now()}] ${msg}`;
  logEl.textContent += line + '\n';
  state.audit.push(line);
}
function reset(){
  state={caseId:0,files:[],merkle:null,decisionHash:null,anchorTx:null,execTx:null,signatures:[],audit:[]};
  logEl.textContent='';
  caseIdEl.textContent='–'; dhEl.textContent='–'; txAEl.textContent='–'; txEEl.textContent='–';
  eList.textContent=''; merkleEl.textContent='Merkle root: –';
  [btnOpen,btnProof,btnDelib,btnAnchor,btnExec].forEach(b=>b.disabled=false);
}

// simple Merkle root: pairwise SHA256 of concat hex (demo only)
async function merkleRoot(hexes){
  if(hexes.length===0) return null;
  let layer=[...hexes];
  while(layer.length>1){
    if(layer.length%2===1) layer.push(layer[layer.length-1]);
    const next=[];
    for(let i=0;i<layer.length;i+=2){
      const a=layer[i].slice(2), b=layer[i+1].slice(2);
      const buf = enc.encode(a+b);
      next.push(await sha256Hex(buf));
    }
    layer=next;
  }
  return layer[0];
}

// ---------- UI logic ----------
btnReset.onclick = reset;
btnExport.onclick = ()=>{
  const blob = new Blob([JSON.stringify({meta:{
      preset: caseSelect.value, notes: caseNotes.value.trim()
    }, state}, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `adr-audit-${Date.now()}.json`;
  a.click();
};
btnCopyDH.onclick = async ()=>{
  if(!state.decisionHash) return;
  await navigator.clipboard?.writeText(state.decisionHash);
  btnCopyDH.textContent='Copied';
  setTimeout(()=>btnCopyDH.textContent='Copy',1200);
};

btnOpen.onclick = ()=>{
  state.caseId++;
  caseIdEl.textContent=String(state.caseId);
  push('Opening case and locking escrow (static demo)…');
  push(`Case #${state.caseId} opened (tx: ${rnd(32)})`);
  // preset narrative
  push(`Preset: ${caseSelect.options[caseSelect.selectedIndex].text}`);
  push(`Notes: ${caseNotes.value.trim()}`);
  btnOpen.disabled = true;
};

// evidence selection → hash list
fileInput.onchange = async (e)=>{
  state.files=[]; eList.textContent='Hashing files…';
  const items = await Promise.all([...e.target.files].map(async f=>{
    const hash = await hashFile(f);
    return {name:f.name,size:f.size,hash};
  }));
  state.files = items;
  eList.textContent = items.length
    ? items.map(x=>`${x.name} • ${x.size}B • ${x.hash.slice(0,18)}…`).join('\n')
    : '(no files)';
  if(items.length){
    const root = await merkleRoot(items.map(x=>x.hash));
    state.merkle = root;
    merkleEl.textContent = `Merkle root: ${root}`;
    push(`Evidence uploaded: ${items.length} file(s). Merkle root computed.`);
  }
};

btnProof.onclick = ()=>{
  if(!state.merkle){
    push('(!) Please add at least one evidence file to compute Merkle root.');
    return;
  }
  push('Generating mock ZK proof from Merkle root…');
  // derive decision hash from merkle + preset (deterministic-ish for demo)
  state.decisionHash = rnd(32);
  dhEl.textContent = state.decisionHash;
  push(`Proof verified. Decision hash: ${state.decisionHash}`);
  btnProof.disabled = true;
};

btnDelib.onclick = ()=>{
  push('Starting MPC-like deliberation (simulated)…');
  // mock 2/3 signatures
  const s1={signer:rnd(20), sig:rnd(65)}, s2={signer:rnd(20), sig:rnd(65)};
  state.signatures=[s1,s2];
  push(`Collected 2/3 arbitrator signatures:\n - ${s1.signer}\n - ${s2.signer}`);
  btnDelib.disabled = true;
};

btnAnchor.onclick = ()=>{
  if(!state.decisionHash){ push('(!) Generate proof first.'); return; }
  push('Anchoring decision hash on-chain (static)…');
  state.anchorTx = rnd(32);
  txAEl.textContent = state.anchorTx;
  push(`Decision anchored (tx: ${state.anchorTx})`);
  btnAnchor.disabled = true;
};

btnExec.onclick = ()=>{
  push('Executing award (escrow release)…');
  state.execTx = rnd(32);
  txEEl.textContent = state.execTx;
  push(`Escrow released (tx: ${state.execTx})`);
  btnExec.disabled = true;
};

// init
reset();
