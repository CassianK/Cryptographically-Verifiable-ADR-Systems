
// fallback-preset.js — fills Case preset if app.js failed or loaded too late
(function(){
  function fill(){
    var sel = document.getElementById('case-select');
    if(!sel) return;
    if(sel.options && sel.options.length > 0) return; // already populated
    var PRESETS = {
      construction:{ label:"Construction delay (Owner vs Contractor)", icon:"🏗️", currency:"KRW", escrow:"₩3,000,000,000", quorum:"2 of 3",
        notes:"Owner claims LD for 3-month delay; contractor invokes force majeure." },
      saas:{ label:"SaaS outage SLA (Customer vs Provider)", icon:"🖥️", currency:"USD", escrow:"$200,000", quorum:"2 of 3",
        notes:"Customer alleges downtime ≥ 4h; provider reports 3h50m." },
      ipRoyalty:{ label:"Cross-border IP licensing (Royalty underreporting)", icon:"📄", currency:"USD", escrow:"$500,000", quorum:"3 of 5",
        notes:"Underreported APAC sales; audited deltas disputed." },
      supplyDefect:{ label:"Supply-chain quality defect (OEM vs Supplier)", icon:"🔧", currency:"EUR", escrow:"€350,000", quorum:"2 of 3",
        notes:"OEM claims defect rate exceeded 1.5%; Supplier submits QC reports and rework logs." },
      milestone:{ label:"Freelance milestone non-payment", icon:"🧾", currency:"USD", escrow:"$30,000", quorum:"1 of 1 (sole arb)",
        notes:"Client refuses to pay final milestone. Contractor submits delivery hashes & acceptance emails." }
    };
    sel.innerHTML = "";
    Object.entries(PRESETS).forEach(function(kv){
      var o = document.createElement('option'); o.value = kv[0]; o.text = kv[1].label; sel.appendChild(o);
    });
    sel.value = "construction";
    var meta = document.getElementById('preset-meta');
    var notes = document.getElementById('case-notes');
    var icon = document.getElementById('case-icon');
    if(meta) meta.textContent = "Escrow: " + PRESETS.construction.escrow + " • Quorum: " + PRESETS.construction.quorum + " • Currency: " + PRESETS.construction.currency;
    if(notes) notes.value = PRESETS.construction.notes;
    if(icon) icon.textContent = PRESETS.construction.icon;
  }
  window.addEventListener('load', fill);
  document.addEventListener('DOMContentLoaded', fill);
})();
