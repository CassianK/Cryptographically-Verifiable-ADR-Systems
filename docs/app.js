// app.js — MVP with watermark PDF & QR JSON
const $ = (id) => document.getElementById(id);
const logEl = $("log"), caseIdEl = $("case-id"), merkleEl = $("merkle");
const dhEl = $("dh"), txAEl = $("tx-anchor"), txEEl = $("tx-exec");
const badge = $("badge"), toastEl = $("toast"), caseIcon = $("case-icon");
const btnOpen = $("btn-open"), btnProof = $("btn-proof"), btnDelib = $("btn-delib");
const btnAnchor = $("btn-anchor"), btnExec = $("btn-exec");
const btnReset = $("btn-reset"), btnExport = $("btn-export"), btnCopyDH = $("copy-dh"), btnTheme = $("btn-theme");
const btnAbout = $("btn-about"), about = $("about"), backdrop = $("about-backdrop");
const qr = $("qr"), qrBox = $("qr-box"), qrBackdrop = $("qr-backdrop");
const caseSelect = $("case-select"), caseNotes = $("case-notes"), fileInput = $("file-input"), eList = $("e-list"), presetMeta = $("preset-meta");
const slaInput = $("sla-input"), slaResult = $("sla-result"); const btnPdf = $("btn-pdf");

let state = { caseId: 0, files: [], merkle: null, decisionHash: null, anchorTx: null, execTx: null, signatures: [], audit: [] };

const enc = new TextEncoder();
async function sha256Hex(buf){ const ab = await crypto.subtle.digest("SHA-256", buf); return "0x"+[...new Uint8Array(ab)].map(b=>b.toString(16).padStart(2,"0")).join(""); }
async function hashFile(file){ const buf = await file.arrayBuffer(); return await sha256Hex(buf); }
function now(){ return new Date().toLocaleTimeString([], {hour12:false}); }
function rnd(bytes=32){ const a=new Uint8Array(bytes); crypto.getRandomValues(a); return "0x"+[...a].map(b=>b.toString(16).padStart(2,"0")).join(""); }
function push(msg){ const line=`[${now()}] ${msg}`; logEl.textContent+=line+"\n"; logEl.scrollTop=logEl.scrollHeight; state.audit.push(line); }
function toast(msg){ toastEl.textContent=msg; toastEl.classList.add("show"); setTimeout(()=>toastEl.classList.remove("show"),1600); }
function setBadge(text, ok=false){ badge.textContent=text; badge.style.color= ok?"var(--good)":"var(--muted)"; }
function short(hex, head=10, tail=8){ if(!hex||typeof hex!=="string") return String(hex); if(hex.length<=head+tail+3) return hex; return hex.slice(0,head)+"…"+hex.slice(-tail); }
function fmtDate(d=new Date()){ return d.toISOString().replace("T"," ").replace(/\..+/," UTC"); }
function reset(){ state={ caseId:0, files:[], merkle:null, decisionHash:null, anchorTx:null, execTx:null, signatures:[], audit:[] };
  logEl.textContent=""; caseIdEl.textContent="–"; dhEl.textContent="–"; txAEl.textContent="–"; txEEl.textContent="–";
  eList.textContent="(no files)"; merkleEl.textContent="Merkle root: –"; [btnOpen,btnProof,btnDelib,btnAnchor,btnExec].forEach(b=>b.disabled=false); setBadge("Idle"); }

async function merkleRoot(hexes){ if(!hexes.length) return null; let layer=[...hexes];
  while(layer.length>1){ if(layer.length%2===1) layer.push(layer[layer.length-1]); const next=[];
    for(let i=0;i<layer.length;i+=2){ const a=layer[i].slice(2), b=layer[i+1].slice(2); const buf=new TextEncoder().encode(a+b); next.push(await sha256Hex(buf)); } layer=next; } return layer[0]; }
function merkleProofFor(index, hexes){ if(hexes.length===0) return []; let layer=[...hexes], path=[], idx=index;
  while(layer.length>1){ if(layer.length%2===1) layer.push(layer[layer.length-1]); const isRight=idx%2===1, pairIdx=isRight?idx-1:idx+1;
    path.push({ side:isRight?"left":"right", hash:layer[pairIdx] }); idx=Math.floor(idx/2); const next=new Array(Math.ceil(layer.length/2)).fill("0x?"); layer=next; } return path; }

const PRESETS = {
  construction:{ label:"Construction delay (Owner vs Contractor)", icon:"🏗️", currency:"KRW", escrow:"₩3,000,000,000", quorum:"2 of 3",
    notes:`Owner claims LD for 3-month delay; contractor invokes force majeure.`, claim:`ZK claim: weather suspension ≥ 20 days.`, awardHint:"Release 60% to Owner; 40% to Contractor." },
  saas:{ label:"SaaS outage SLA (Customer vs Provider)", icon:"🖥️", currency:"USD", escrow:"$200,000", quorum:"2 of 3",
    notes:`Customer alleges downtime ≥ 4h; provider reports 3h50m. Evidence: monitoring CSV, incident emails.`, claim:`ZK: downtime minutes ≥ 240`, awardHint:"Pro-rate service credit." },
  ipRoyalty:{ label:"Cross-border IP licensing (Royalty underreporting)", icon:"📄", currency:"USD", escrow:"$500,000", quorum:"3 of 5",
    notes:`Underreported APAC sales; audited deltas disputed.`, claim:`ZK: audited_revenue − reported ≥ 0`, awardHint:"Release delta + interest." },
  supplyDefect:{ label:"Supply-chain quality defect (OEM vs Supplier)", icon:"🔧", currency:"EUR", escrow:"€350,000", quorum:"2 of 3",
    notes:`OEM claims defect rate exceeded 1.5%; Supplier submits QC reports and rework logs.`, claim:`ZK: defect_count / samples ≥ 0.015`, awardHint:"Release remedy cost + LD to OEM." },
  milestone:{ label:"Freelance milestone non-payment", icon:"🧾", currency:"USD", escrow:"$30,000", quorum:"1 of 1 (sole arb)",
    notes:`Client refuses to pay final milestone. Contractor submits delivery hashes & acceptance emails.`, claim:`ZK: delivered artifacts match hashed SOW bundle.`, awardHint:"Release final milestone to Contractor." }
};
function bootstrapPresets(){ caseSelect.innerHTML=""; Object.entries(PRESETS).forEach(([k,v])=>{ const o=document.createElement("option"); o.value=k; o.textContent=v.label; caseSelect.appendChild(o); });
  caseSelect.value="construction"; applyPreset(caseSelect.value); }
function applyPreset(key){ const p=PRESETS[key]; if(!p) return; caseNotes.value=p.notes; caseIcon.textContent=p.icon||"⚖️";
  presetMeta.textContent=`Escrow: ${p.escrow} • Quorum: ${p.quorum} • Currency: ${p.currency}`; push(`Preset loaded: ${p.label} • Escrow: ${p.escrow} • Quorum: ${p.quorum}`); }
function logPresetHints(stage){ const p=PRESETS[caseSelect.value]; if(!p) return; if(stage==="proof" && p.claim) push(`Claim: ${p.claim}`); if(stage==="exec" && p.awardHint) push(`Award (simulated): ${p.awardHint}`); }
caseSelect?.addEventListener("change", e=>applyPreset(e.target.value));

function openAbout(){ backdrop.hidden=false; about.showModal(); } function closeAbout(){ about.close(); backdrop.hidden=true; }
btnAbout?.addEventListener("click", openAbout); backdrop?.addEventListener("click", closeAbout); about?.addEventListener("close", ()=>{ backdrop.hidden=true; });

function openQR(){ qrBackdrop.hidden=false; qr.showModal(); } function closeQR(){ qr.close(); qrBackdrop.hidden=true; qrBox.innerHTML=""; }
qrBackdrop?.addEventListener("click", closeQR); qr?.addEventListener("close", ()=>{ qrBackdrop.hidden=true; qrBox.innerHTML=""; });

async function generateAwardPDF(){
  if(!state.decisionHash){ push("(!) Generate proof first to include a decision hash in the PDF."); toast("Generate proof first"); return; }
  const preset = PRESETS[caseSelect.value] || {};
  const evidenceRows = state.files.length ? state.files.map((f,i)=>`<tr><td>${i+1}</td><td>${f.name}</td><td style="text-align:right">${f.size.toLocaleString()} B</td><td>${short(f.hash)}</td></tr>`).join("") : `<tr><td colspan="4" style="text-align:center;color:#777">No files were uploaded.</td></tr>`;
  const signRows = state.signatures.length ? state.signatures.map((s,i)=>`<tr><td>${i+1}</td><td>${s.signer}</td><td>${short(s.sig)}</td></tr>`).join("") : `<tr><td colspan="3" style="text-align:center;color:#777">No signatures (demo not completed)</td></tr>`;
  const node=document.createElement("div"); node.style.position="relative"; node.style.padding="16px"; node.style.background="#ffffff"; node.style.color="#111111";
  node.innerHTML = `
  <style>
    *{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial}
    html,body,div,p,small,li,td,th,code,span,h1,h2,h3{ color:#111 !important; background:#fff !important }
    a{ color:#004080 !important; text-decoration:none !important }
    h1,h2{margin:0 0 8px} .muted{color:#555 !important}
    table{width:100%;border-collapse:collapse;margin:6px 0 12px}
    th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;vertical-align:top}
    th{background:#f3f3f3;text-align:left}
    .kv{display:grid;grid-template-columns:160px 1fr;gap:6px 12px;margin:10px 0 14px}
    .kv div{font-size:13px}
    .box{border:1px solid #e5e5e5;border-radius:6px;padding:10px;margin:10px 0 12px}
    .small{font-size:12px}
    .header{border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:12px}
    .logo{font-size:20px;font-weight:bold;color:#004080 !important}
    .wm{ position:absolute; inset:0; display:grid; place-items:center; pointer-events:none; }
    .wm span{ font-size:64px; font-weight:800; opacity:.08; transform:rotate(-22deg); letter-spacing:.2em }
  </style>
  <div class="wm"><span>DEMO • PRE-PUBLICATION • NOT LEGAL ADVICE</span></div>
  <div class="header">
    <div class="logo"><a href="https://computersciencelaw.org/2026/" target="_blank" rel="noopener">ACM Symposium on Computer Science and Law (2026)</a></div>
    <div class="muted small">Bridge the Divide Between Computer Science and Law</div>
    <div class="small"><b>Paper:</b> A Theoretical Framework for Cryptographically Verifiable ADR Systems in Cross-Border Token Security Disputes</div>
    <div class="small"><b>Authors:</b> Dokyung (DK) Kim, Sangwoo Han &nbsp; | &nbsp; <b>ORCID:</b> <a href="https://orcid.org/0009-0009-4182-4974">0009-0009-4182-4974</a></div>
  </div>
  <h1>Arbitration Award (Demo)</h1>
  <div class="muted small">Generated: ${fmtDate()}</div>
  <div class="kv">
    <div><b>Case ID</b></div><div>#${state.caseId || "—"}</div>
    <div><b>Preset</b></div><div>${preset.label || caseSelect.value}</div>
    <div><b>Quorum</b></div><div>${preset.quorum || "—"}</div>
    <div><b>Escrow</b></div><div>${preset.escrow || "—"}</div>
    <div><b>Currency</b></div><div>${preset.currency || "—"}</div>
  </div>
  <div class="box">
    <b>Case Notes</b>
    <div class="small">${(caseNotes.value || "").replace(/\\n/g, "<br/>")}</div>
  </div>
  <h2>Evidence Summary</h2>
  <div class="small muted">Merkle root: ${state.merkle ? state.merkle : "—"}</div>
  <table><thead><tr><th>#</th><th>File</th><th>Size</th><th>SHA-256</th></tr></thead><tbody>${evidenceRows}</tbody></table>
  <h2>Decision</h2>
  <div class="kv">
    <div><b>Decision Hash</b></div><div>${state.decisionHash}</div>
    <div><b>Anchoring Tx</b></div><div>${state.anchorTx ? state.anchorTx : "—"}</div>
    <div><b>Execution Tx</b></div><div>${state.execTx ? state.execTx : "—"}</div>
  </div>
  <h2>Arbitrator Signatures (2/3)</h2>
  <table><thead><tr><th>#</th><th>Signer</th><th>Signature</th></tr></thead><tbody>${signRows}</tbody></table>
  <div class="muted small">This award PDF is generated client-side for demo purposes. Hashes and tx IDs are simulation artifacts unless otherwise indicated.</div>`;
  const opt = { margin: 10, filename: `adr-award-${state.caseId || "demo"}.pdf`,
    image: { type:"jpeg", quality:0.98 }, html2canvas: { scale: 2.5, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, };
  document.body.appendChild(node); await html2pdf().from(node).set(opt).save(); document.body.removeChild(node); toast("Award PDF downloaded");
}

btnTheme.onclick = ()=>{ const html=document.documentElement;
  html.setAttribute("data-theme", html.getAttribute("data-theme")==="dark" ? "light" : "dark"); };
btnReset.onclick = ()=>{ reset(); toast("State cleared"); };
btnExport.onclick = ()=>{ const payload = JSON.stringify({ meta: { preset: caseSelect.value, notes: caseNotes.value.trim() }, state }, null, 2);
  const blob = new Blob([payload], { type:"application/json" }); const url = URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=`adr-audit-${Date.now()}.json`; a.click(); openQR(); new QRCode(qrBox, { text:url, width:180, height:180 }); toast("Audit JSON exported (QR ready)"); };
btnCopyDH.onclick = async ()=>{ if(!state.decisionHash) return; await navigator.clipboard?.writeText(state.decisionHash);
  btnCopyDH.textContent="Copied"; setTimeout(()=>btnCopyDH.textContent="Copy", 1200); toast("Decision hash copied"); };
btnOpen.onclick = ()=>{ state.caseId++; caseIdEl.textContent=String(state.caseId); push("Opening case and locking escrow (static)…");
  push(`Case #${state.caseId} opened (tx: ${rnd(32)})`); push(`Preset: ${caseSelect.options[caseSelect.selectedIndex].text}`);
  push(`Notes: ${caseNotes.value.trim()}`); setBadge("Open"); btnOpen.disabled=true; };
fileInput.onchange = async (e)=>{ state.files=[]; eList.textContent="Hashing files…";
  const items = await Promise.all([...e.target.files].map(async (f,i)=>({ name:f.name, size:f.size, hash:await hashFile(f), index:i })));
  state.files = items; if(items.length){ const root = await merkleRoot(items.map(x=>x.hash)); state.merkle=root; merkleEl.textContent=`Merkle root: ${root}`;
    push(`Evidence uploaded: ${items.length} file(s). Merkle root computed.`); setBadge("Evidence ✓", true);
    eList.innerHTML = items.map(x=>`<button class="file" data-idx="${x.index}">${x.name} • ${x.size}B • ${x.hash.slice(0,18)}…</button>`).join("");
    eList.querySelectorAll("button.file").forEach(btn=>{ btn.onclick=()=>{ const idx=Number(btn.dataset.idx); const path=merkleProofFor(idx, items.map(x=>x.hash));
      push(\`Merkle proof for "\${items[idx].name}" (index \${idx}):\`); path.forEach(sib=>push(\` • sibling (\${sib.side}): \${sib.hash}\`)); }; });
  }else{ eList.textContent="(no files)"; } };
btnProof.onclick = ()=>{ if(!state.merkle){ push("(!) Add at least one evidence file first."); toast("Add evidence first"); return; }
  push("Generating mock ZK proof from Merkle root…"); state.decisionHash=rnd(32); dhEl.textContent=state.decisionHash;
  push(\`Proof verified. Decision hash: \${state.decisionHash}\`); setBadge("Proved ✓", true); logPresetHints("proof"); btnProof.disabled=true; };
btnDelib.onclick = ()=>{ push("Starting MPC-like deliberation (simulated)…"); const s1={ signer:rnd(20), sig:rnd(65) }, s2={ signer:rnd(20), sig:rnd(65) };
  state.signatures=[s1,s2]; push(\`Collected 2/3 arbitrator signatures:\n - \${s1.signer}\n - \${s2.signer}\`); setBadge("2/3 Signatures ✓", true); btnDelib.disabled=true; };
btnAnchor.onclick = ()=>{ if(!state.decisionHash){ push("(!) Generate proof first."); toast("Generate proof first"); return; }
  push("Anchoring decision hash on-chain (static)…"); state.anchorTx=rnd(32); txAEl.textContent=state.anchorTx; push(\`Decision anchored (tx: \${state.anchorTx})\`);
  setBadge("Anchored ✓", true); btnAnchor.disabled=true; };
btnExec.onclick = ()=>{ push("Executing award (escrow release)…"); state.execTx=rnd(32); txEEl.textContent=state.execTx; push(\`Escrow released (tx: \${state.execTx})\`);
  setBadge("Executed ✓", true); logPresetHints("exec"); btnExec.disabled=true; };
btnPdf && (btnPdf.onclick = generateAwardPDF);
function parseCSV(text){ const rows=text.trim().split(/\\r?\\n/).slice(1); return rows.map(r=>{ const [ts,up]=r.split(","); return { ts, up:Number(up) }; }); }
slaInput?.addEventListener("change", async (e)=>{ const f=e.target.files?.[0]; if(!f){ slaResult.textContent="No CSV loaded."; return; }
  const text=await f.text(); const data=parseCSV(text); const down=data.filter(d=>d.up===0).length, total=data.length; const pct= total? ((down/total)*100).toFixed(2):"0.00", minutes=down; const passed=minutes>=240;
  slaResult.innerHTML = \`Downtime: <b>\${minutes} min</b> (\${pct}% of \${total}) — \` + (passed? `<span style="color:var(--good)">Claim satisfied: ≥ 240 min</span>` : `<span style="color:var(--warn)">Claim not met</span>`);
  push(\`SLA CSV parsed: downtime=\${minutes} min (\${pct}%). Threshold 240 min → \${passed ? "met ✅" : "not met"}.\`); });
function boot(){ reset(); bootstrapPresets(); } document.addEventListener("DOMContentLoaded", boot);
