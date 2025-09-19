const logEl = document.getElementById('log');
const btnOpen = document.getElementById('btn-open');
const btnProof = document.getElementById('btn-proof');
const btnDelib = document.getElementById('btn-delib');
const btnAnchor = document.getElementById('btn-anchor');
const btnExec = document.getElementById('btn-exec');

// 데모 상태
let caseId = 0;
let decisionHash = null;
let anchoredTx = null;
let executedTx = null;

function now() {
  return new Date().toLocaleTimeString([], {hour12:false});
}
function randHex(bytes=32){
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return '0x'+[...a].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function push(msg){ logEl.textContent += `[${now()}] ${msg}\n`; }

btnOpen.onclick = () => {
  caseId++;
  push('Opening case and funding escrow...');
  const tx = randHex(32);
  push(`Case #${caseId} opened (tx: ${tx})`);
  btnOpen.disabled = true;
};

btnProof.onclick = () => {
  push('Generating mock ZK proof...');
  decisionHash = randHex(32);
  push(`Proof verified. Decision hash: ${decisionHash}`);
  btnProof.disabled = true;
};

btnDelib.onclick = () => {
  push('Starting MPC deliberation...');
  push('Collected 2/2 signatures from arbitrators.');
  push(` - signer 1: ${randHex(20)}`);
  push(` - signer 2: ${randHex(20)}`);
  btnDelib.disabled = true;
};

btnAnchor.onclick = () => {
  if(!decisionHash){ push('(!) Generate proof first.'); return; }
  push('Anchoring decision on-chain (static demo)...');
  anchoredTx = randHex(32);
  push(`Decision anchored (tx: ${anchoredTx})`);
  btnAnchor.disabled = true;
};

btnExec.onclick = () => {
  push('Executing award...');
  executedTx = randHex(32);
  push(`Escrow released (tx: ${executedTx})`);
  btnExec.disabled = true;
};
