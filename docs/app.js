// ========== tiny dom helpers ==========
const $ = (id)=>document.getElementById(id);
const logEl = $('log'), caseIdEl = $('case-id'), merkleEl = $('merkle');
const dhEl = $('dh'), txAEl = $('tx-anchor'), txEEl = $('tx-exec');
const badge = $('badge'), toastEl = $('toast');

const btnOpen=$('btn-open'), btnProof=$('btn-proof'), btnDelib=$('btn-delib');
const btnAnchor=$('btn-anchor'), btnExec=$('btn-exec');
const btnReset=$('btn-reset'), btnExport=$('btn-export'), btnCopyDH=$('copy-dh'), btnTheme=$('btn-theme');
const caseSelect=$('case-select'), caseNotes=$('case-notes'), fileInput=$('file-input'), eList=$('e-list');

// ========== state ==========
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

// ========== utils ==========
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
  logEl.scrollTop = logEl.scrollHeight; // auto-scroll
  state.audit.push(line);
}
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=>toastEl.classList.remove('show'), 1600);
}
function setBadge(text, ok=false){
  badge.textContent = text;
  badge.style.color = ok ? 'var(--good)' : 'var(--muted)';
}
function reset(){
  state={caseId:0,files:[],merkle:null,decisionHash:null,anchorTx:null,execTx:null,signatures:[],audit:[]};
  logEl.textContent='';
  caseIdEl.textContent='–'; dhEl.textContent='–'; txAEl.textContent='–'; txEEl.textContent='–';
  eList.textContent=''; merkleEl.textContent='Merkle root: –';
  [btnOpen,btnProof,btnDelib,btnAnchor,btnExec].forEach(b=>b.disabled=false);
  setBadge('Idle');
}

// simple Merkle (demo only)
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

// ========== PRESETS (conference-friendly) ==========
const PRESETS = {
  construction: {
    label: "Construction delay (Owner vs Contractor)",
    currency: "KRW",
    escrow: "₩3,000,000,000",
    quorum: "2 of 3",
    notes: `Owner claims liquidated damages for 3-month delay; contractor invokes force majeure (heavy rain & overseas material supply). Panel quorum: 2 of 3.`,
    claim: `ZK claim (optional): total weather suspension days ≥ 20 without fully approved extensions.`,
    awardHint: "Release 60% of escrow to Owner; return 40% to Contractor."
  },
  saas: {
    label: "SaaS outage SLA (Customer vs Provider)",
    currency: "USD",
    escrow: "$200,000",
    quorum: "2 of 3",
    notes: `Customer alleges monthly downtime ≥ 4h per SLA; provider reports 3h50m. Evidence: monitoring CSV, incident emails.`,
    claim: `ZK claim: aggregated downtime minutes ≥ 240 (without exposing minute-level logs).`,
    awardHint: "Release pro-rated service credit to Customer; remainder to Provider."
  },
  ipRoyalty: {
    label: "Cross-border IP licensing (Royalty underreporting)",
    currency: "USD",
    escrow: "$500,000",
    quorum: "3 of 5",
    notes: `Licensor alleges underreported sales in APAC; licensee submits audited statements; disagreement over exclusions.`,
    claim: `ZK claim: Δ = audited_revenue − reported_revenue ≥ 0 without disclosing per-SKU sales.`,
    awardHint: "Release delta + interest to Licensor."
  },
  supplyDefect: {
    label: "Supply-chain quality defect (OEM vs Supplier)",
    currency: "EUR",
    escrow: "€350,000",
    quorum: "2 of 3",
    notes: `OEM claims defect rate exceeded 1.5%; Supplier submits QC reports and rework logs.`,
    claim: `ZK claim: defect_count / samples ≥ 0.015`,
    awardHint: "Release remedy cost + LD to OEM if threshold exceeded."
  },
  milestone: {
    label: "Freelance milestone non-payment",
    currency: "USD",
    escrow: "$30,000",
    quorum: "1 of 1 (sole arb)",
    notes: `Client refuses to pay final milestone. Contractor submits delivery hashes & acceptance emails.`,
    claim: `ZK claim: delivered artifacts match hashed SOW bundle.`,
    awardHint: "Release final milestone to Contractor."
  },
  breachNotice: {
    label: "Data-breach notification SLA",
    currency: "USD",
    escrow: "$150,000",
    quorum: "2 of 3",
    notes: `Processor allegedly notified Controller after 72h window. Logs & ticket timelines submitted.`,
    claim: `ZK claim: notice_time − detect_time ≤ 72h`,
    awardHint: "Release SLA penalty to Controller if breach proven."
  }
};

function bootstrapPresets() {
  caseSelect.innerHTML = "";
  Object.entries(PRESETS).forEach(([key, v]) => {
    const opt = document.createElement("option");
    opt.value = key; opt.textContent = v.label;
    caseSelect.appendChild(opt);
  });
  caseSelect.value = "construction";
  applyPreset(caseSelect.value);
}
function applyPreset(key) {
  const p = PRESETS[key]; if(!p) return;
  caseNotes.value = p.notes;
  push(`Preset loaded: ${p.label} • Escrow: ${p.escrow} • Quorum: ${p.quorum}`);
}
function logPresetHints(stage) {
  const p = PRESETS[caseSelect.value]; if(!p) return;
  if (stage === "proof" && p.claim) push(`Claim: ${p.claim}`);
  if (stage === "exec"  && p.awardHint) push(`Award (simulated): ${p.awardHint}`);
}
caseSelect?.addEventListener("change", (e)=> applyPreset(e.target.value));

// ========== handlers ==========
btnTheme.onclick = ()=>{
  const html = document.documentElement;
  html.setAttribute('data-theme', html.getAttribute('data-theme')==='dark' ? 'light' : 'dark');
};

btnReset.onclick = ()=>{ reset(); toast('State cleared'); };

btnExport.onclick = ()=>{
  const blob = new Blob([JSON.stringify({meta:{
      preset: caseSelect.value, notes: caseNotes.value.trim()
    }, state}, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `adr-audit-${Date.now()}.json`;
  a.click();
  toast('Audit JSON exported');
};

btnCopyDH.onclick = async ()=>{
  if(!state.decisionHash) return;
  await navigator.clipboard?.writeText(state.decisionHash);
  btnCopyDH.textContent='Copied';
  setTimeout(()=>btnCopyDH.textContent='Copy',1200);
  toast('Decision hash copied');
};

btnOpen.onclick = ()=>{
  state.caseId++;
  caseIdEl.textContent=String(state.caseId);
  push('Opening case and locking escrow (static)…');
  push(`Case #${state.caseId} opened (tx: ${rnd(32)})`);
  push(`Preset: ${caseSelect.options[caseSelect.selectedIndex].text}`);
  push(`Notes: ${caseNotes.value.trim()}`);
  setBadge('Open');
  btnOpen.disabled = true;
};

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
    setBadge('Evidence ✓', true);
  }
};

btnProof.onclick = ()=>{
  if(!state.merkle){ push('(!) Add at least one evidence file first.'); toast('Add evidence first'); return; }
  push('Generating mock ZK proof from Merkle root…');
  state.decisionHash = rnd(32);
  dhEl.textContent = state.decisionHash;
  push(`Proof verified. Decision hash: ${state.decisionHash}`);
  setBadge('Proved ✓', true);
  logPresetHints("proof");
  btnProof.disabled = true;
};

btnDelib.onclick = ()=>{
  push('Starting MPC-like deliberation (simulated)…');
  const s1={signer:rnd(20), sig:rnd(65)}, s2={signer:rnd(20), sig:rnd(65)};
  state.signatures=[s1,s2];
  push(`Collected 2/3 arbitrator signatures:\n - ${s1.signer}\n - ${s2.signer}`);
  setBadge('2/3 Signatures ✓', true);
  btnDelib.disabled = true;
};

btnAnchor.onclick = ()=>{
  if(!state.decisionHash){ push('(!) Generate proof first.'); toast('Generate proof first'); return; }
  push('Anchoring decision hash on-chain (static)…');
  state.anchorTx = rnd(32);
  txAEl.textContent = state.anchorTx;
  push(`Decision anchored (tx: ${state.anchorTx})`);
  setBadge('Anchored ✓', true);
  btnAnchor.disabled = true;
};

btnExec.onclick = ()=>{
  push('Executing award (escrow release)…');
  state.execTx = rnd(32);
  txEEl.textContent = state.execTx;
  push(`Escrow released (tx: ${state.execTx})`);
  setBadge('Executed ✓', true);
  logPresetHints("exec");
  btnExec.disabled = true;
};

// ========== init ==========
function boot(){
  reset();
  bootstrapPresets();
}
document.addEventListener('DOMContentLoaded', boot);
