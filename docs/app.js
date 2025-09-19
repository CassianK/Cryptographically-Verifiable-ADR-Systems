// ---------- tiny dom helpers ----------
const $ = (id)=>document.getElementById(id);
const logEl = $('log'), caseIdEl = $('case-id'), merkleEl = $('merkle');
const dhEl = $('dh'), txAEl = $('tx-anchor'), txEEl = $('tx-exec');
const badge = $('badge'), toastEl = $('toast');
const caseIcon = $('case-icon');

const btnOpen=$('btn-open'), btnProof=$('btn-proof'), btnDelib=$('btn-delib');
const btnAnchor=$('btn-anchor'), btnExec=$('btn-exec');
const btnReset=$('btn-reset'), btnExport=$('btn-export'), btnCopyDH=$('copy-dh'), btnTheme=$('btn-theme');
const btnAbout=$('btn-about'), about=$('about'), backdrop=$('about-backdrop');
const qr=$('qr'), qrBox=$('qr-box'), qrBackdrop=$('qr-backdrop');
const caseSelect=$('case-select'), caseNotes=$('case-notes'), fileInput=$('file-input'), eList=$('e-list'), presetMeta=$('preset-meta');
const slaInput=$('sla-input'), slaResult=$('sla-result');

// ---------- state ----------
let state = {
  caseId: 0,
  files: [],           // {name,size,hash,index}
  merkle: null,
  decisionHash: null,
  anchorTx: null,
  execTx: null,
  signatures: [],      // [{signer, sig}]
  audit: []            // log entries for export
};

// ---------- utils ----------
const enc = new TextEncoder();
async function sha256Hex(buf){
  const ab = await crypto.subtle.digest('SHA-256', buf);
  return '0x' + [...new Uint8Array(ab)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashFile(file){ const buf = await file.arrayBuffer(); return await sha256Hex(buf); }
function now(){ return new Date().toLocaleTimeString([], {hour12:false}); }
function rnd(bytes=32){ const a=new Uint8Array(bytes); crypto.getRandomValues(a); return '0x'+[...a].map(b=>b.toString(16).padStart(2,'0')).join(''); }
function push(msg){ const line=`[${now()}] ${msg}`; logEl.textContent+=line+'\n'; logEl.scrollTop=logEl.scrollHeight; state.audit.push(line); }
function toast(msg){ toastEl.textContent=msg; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'),1600); }
function setBadge(text,ok=false){ badge.textContent=text; badge.style.color=ok?'var(--good)':'var(--muted)'; }
function reset(){
  state={caseId:0,files:[],merkle:null,decisionHash:null,anchorTx:null,execTx:null,signatures:[],audit:[]};
  logEl.textContent=''; caseIdEl.textContent='–'; dhEl.textContent='–'; txAEl.textContent='–'; txEEl.textContent='–';
  eList.textContent='(no files)'; merkleEl.textContent='Merkle root: –';
  [btnOpen,btnProof,btnDelib,btnAnchor,btnExec].forEach(b=>b.disabled=false); setBadge('Idle');
}

// Merkle (demo)
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
function merkleProofFor(index, hexes){
  if(hexes.length===0) return [];
  let layer=[...hexes], path=[], idx=index;
  while(layer.length>1){
    if(layer.length%2===1) layer.push(layer[layer.length-1]);
    const isRight=(idx%2===1), pairIdx=isRight?idx-1:idx+1;
    path.push({side:isRight?'left':'right', hash:layer[pairIdx]});
    idx=Math.floor(idx/2);
    const next=new Array(Math.ceil(layer.length/2)).fill('0x?'); // 경로 시각화용
    layer=next;
  }
  return path;
}

// ---------- PRESETS ----------
const PRESETS = {
  construction:{label:"Construction delay (Owner vs Contractor)",icon:"🏗️",currency:"KRW",escrow:"₩3,000,000,000",quorum:"2 of 3",
    notes:`Owner claims liquidated damages for 3-month delay; contractor invokes force majeure (heavy rain & overseas material supply). Panel quorum: 2 of 3.`,
    claim:`ZK claim (optional): total weather suspension days ≥ 20 without fully approved extensions.`,
    awardHint:"Release 60% of escrow to Owner; return 40% to Contractor."},
  saas:{label:"SaaS outage SLA (Customer vs Provider)",icon:"🖥️",currency:"USD",escrow:"$200,000",quorum:"2 of 3",
    notes:`Customer alleges monthly downtime ≥ 4h per SLA; provider reports 3h50m. Evidence: monitoring CSV, incident emails.`,
    claim:`ZK claim: aggregated downtime minutes ≥ 240 (without exposing minute-level logs).`,
    awardHint:"Release pro-rated service credit to Customer; remainder to Provider."},
  ipRoyalty:{label:"Cross-border IP licensing (Royalty underreporting)",icon:"📄",currency:"USD",escrow:"$500,000",quorum:"3 of 5",
    notes:`Licensor alleges underreported sales in APAC; licensee submits audited statements; disagreement over exclusions.`,
    claim:`ZK claim: Δ = audited_revenue − reported_revenue ≥ 0 without disclosing per-SKU sales.`,
    awardHint:"Release delta + interest to Licensor."},
  supplyDefect:{label:"Supply-chain quality defect (OEM vs Supplier)",icon:"🔧",currency:"EUR",escrow:"€350,000",quorum:"2 of 3",
    notes:`OEM claims defect rate exceeded 1.5%; Supplier submits QC reports and rework logs.`,
    claim:`ZK claim: defect_count / samples ≥ 0.015`,
    awardHint:"Release remedy cost + LD to OEM if threshold exceeded."},
  milestone:{label:"Freelance milestone non-payment",icon:"🧾",currency:"USD",escrow:"$30,000",quorum:"1 of 1 (sole arb)",
    notes:`Client refuses to pay final milestone. Contractor submits delivery hashes & acceptance emails.`,
    claim:`ZK claim: delivered artifacts match hashed SOW bundle.`,
    awardHint:"Release final milestone to Contractor."},
  breachNotice:{label:"Data-breach notification SLA",icon:"🔐",currency:"USD",escrow:"$150,000",quorum:"2 of 3",
    notes:`Processor allegedly notified Controller after 72h window. Logs & ticket timelines submitted.`,
    claim:`ZK claim: notice_time − detect_time ≤ 72h`,
    awardHint:"Release SLA penalty to Controller if breach proven."}
};
function bootstrapPresets(){
  caseSelect.innerHTML="";
  Object.entries(PRESETS).forEach(([k,v])=>{ const o=document.createElement('option'); o.value=k;o.textContent=v.label; caseSelect.appendChild(o); });
  caseSelect.value="construction"; applyPreset(caseSelect.value);
}
function applyPreset(key){
  const p=PRESETS[key]; if(!p) return;
  caseNotes.value=p.notes; caseIcon.textContent=p.icon||'⚖️';
  presetMeta.textContent=`Escrow: ${p.escrow} • Quorum: ${p.quorum} • Currency: ${p.currency}`;
  push(`Preset loaded: ${p.label} • Escrow: ${p.escrow} • Quorum: ${p.quorum}`);
}
function logPresetHints(stage){
  const p=PRESETS[caseSelect.value]; if(!p) return;
  if(stage==="proof" && p.claim) push(`Claim: ${p.claim}`);
  if(stage==="exec"  && p.awardHint) push(`Award (simulated): ${p.awardHint}`);
}
caseSelect?.addEventListener('change',(e)=>applyPreset(e.target.value));

// ---------- About & QR ----------
function openAbout(){ backdrop.hidden=false; about.showModal(); }
function closeAbout(){ about.close(); backdrop.hidden=true; }
btnAbout.onclick=openAbout; backdrop.onclick=closeAbout; about.addEventListener('close',()=>{ backdrop.hidden=true; });

function openQR(){ qrBackdrop.hidden=false; qr.showModal(); }
function closeQR(){ qr.close(); qrBackdrop.hidden=true; qrBox.innerHTML=''; }
qrBackdrop?.addEventListener('click', closeQR); qr?.addEventListener('close', ()=>{ qrBackdrop.hidden=true; qrBox.innerHTML=''; });

// ---------- Handlers ----------
btnTheme.onclick=()=>{ const html=document.documentElement; html.setAttribute('data-theme', html.getAttribute('data-theme')==='dark'?'light':'dark'); };
btnReset.onclick=()=>{ reset(); toast('State cleared'); };

btnExport.onclick=()=>{
  const payload=JSON.stringify({meta:{preset:caseSelect.value,notes:caseNotes.value.trim()},state},null,2);
  const blob=new Blob([payload],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`adr-audit-${Date.now()}.json`; a.click();
  openQR(); new QRCode(qrBox,{text:url,width:180,height:180}); toast('Audit JSON exported (QR ready)');
};

btnCopyDH.onclick=async()=>{ if(!state.decisionHash) return; await navigator.clipboard?.writeText(state.decisionHash);
  btnCopyDH.textContent='Copied'; setTimeout(()=>btnCopyDH.textContent='Copy',1200); toast('Decision hash copied'); };

btnOpen.onclick=()=>{
  state.caseId++; caseIdEl.textContent=String(state.caseId);
  push('Opening case and locking escrow (static)…');
  push(`Case #${state.caseId} opened (tx: ${rnd(32)})`);
  push(`Preset: ${caseSelect.options[caseSelect.selectedIndex].text}`);
  push(`Notes: ${caseNotes.value.trim()}`);
  setBadge('Open'); btnOpen.disabled=true;
};

fileInput.onchange=async(e)=>{
  state.files=[]; eList.textContent='Hashing files…';
  const items=await Promise.all([...e.target.files].map(async(f,i)=>({name:f.name,size:f.size,hash:await hashFile(f),index:i})));
  state.files=items;

  if(items.length){
    const root=await merkleRoot(items.map(x=>x.hash)); state.merkle=root; merkleEl.textContent=`Merkle root: ${root}`;
    push(`Evidence uploaded: ${items.length} file(s). Merkle root computed.`); setBadge('Evidence ✓',true);

    // clickable list with Merkle proof
    eList.innerHTML = items.map(x=>`<button class="file" data-idx="${x.index}">${x.name} • ${x.size}B • ${x.hash.slice(0,18)}…</button>`).join('');
    eList.querySelectorAll('button.file').forEach(btn=>{
      btn.onclick=()=>{
        const idx=Number(btn.dataset.idx);
        const path=merkleProofFor(idx, items.map(x=>x.hash));
        push(`Merkle proof for "${items[idx].name}" (index ${idx}):`);
        path.forEach(sib=>push(` • sibling (${sib.side}): ${sib.hash}`));
      };
    });
  } else { eList.textContent='(no files)'; }
};

btnProof.onclick=()=>{
  if(!state.merkle){ push('(!) Add at least one evidence file first.'); toast('Add evidence first'); return; }
  push('Generating mock ZK proof from Merkle root…');
  state.decisionHash=rnd(32); dhEl.textContent=state.decisionHash;
  push(`Proof verified. Decision hash: ${state.decisionHash}`); setBadge('Proved ✓',true); logPresetHints("proof"); btnProof.disabled=true;
};

btnDelib.onclick=()=>{
  push('Starting MPC-like deliberation (simulated)…');
  const s1={signer:rnd(20),sig:rnd(65)}, s2={signer:rnd(20),sig:rnd(65)};
  state.signatures=[s1,s2];
  push(`Collected 2/3 arbitrator signatures:\n - ${s1.signer}\n - ${s2.signer}`);
  setBadge('2/3 Signatures ✓',true); btnDelib.disabled=true;
};

btnAnchor.onclick=()=>{
  if(!state.decisionHash){ push('(!) Generate proof first.'); toast('Generate proof first'); return; }
  push('Anchoring decision hash on-chain (static)…'); state.anchorTx=rnd(32); txAEl.textContent=state.anchorTx;
  push(`Decision anchored (tx: ${state.anchorTx})`); setBadge('Anchored ✓',true); btnAnchor.disabled=true;
};

btnExec.onclick=()=>{
  push('Executing award (escrow release)…'); state.execTx=rnd(32); txEEl.textContent=state.execTx;
  push(`Escrow released (tx: ${state.execTx})`); setBadge('Executed ✓',true); logPresetHints("exec"); btnExec.disabled=true;
};

// SLA CSV helper
function parseCSV(text){ const rows=text.trim().split(/\r?\n/).slice(1); return rows.map(r=>{ const [ts,up]=r.split(','); return {ts,up:Number(up)}; }); }
slaInput?.addEventListener('change', async (e)=>{
  const f=e.target.files?.[0]; if(!f){ slaResult.textContent='No CSV loaded.'; return; }
  const text=await f.text(); const data=parseCSV(text);
  const down=data.filter(d=>d.up===0).length, total=data.length;
  const pct=total?((down/total)*100).toFixed(2):'0.00', minutes=down;
  const passed=minutes>=240;
  slaResult.innerHTML=`Downtime: <b>${minutes} min</b> (${pct}% of ${total}) — `+(passed?`<span style="color:var(--good)">Claim satisfied: ≥ 240 min</span>`:`<span style="color:var(--warn)">Claim not met</span>`);
  push(`SLA CSV parsed: downtime=${minutes} min (${pct}%). Threshold 240 min → ${passed?'met ✅':'not met'}.`);
});

// init
function boot(){ reset(); bootstrapPresets(); }
document.addEventListener('DOMContentLoaded', boot);
