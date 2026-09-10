/**
 * Howl Ecosystem Shared Client Script - HowlBoard
 * Features: Interactive deterministic state machine board demo, telemetry console,
 * code snippet copy, light/dark theme toggle, ecosystem drawer.
 */

// Static, read-only mission-control showcase.
//
// Driven by missions.json, which is a copy of the same data/fixtures/missions.json
// the real application loads through POST /api/seed. There is no server behind
// this page: state changes, approvals and transitions are not available here.
// Reading the fixture rather than a second hardcoded copy is deliberate - the
// previous demo drifted from the backend it claimed to illustrate.

const SPINE = [
  ['01', 'Mission'], ['02', 'Evidence'], ['03', 'Decision'], ['04', 'Authority'],
  ['05', 'Plan'], ['06', 'Executor'], ['07', 'Execution'], ['08', 'Verification'],
  ['09', 'Outcome'], ['10', 'Audit timeline'],
];

let demoMissions = [];
let demoEvents = [];

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function ago(ts) {
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - Number(ts || 0));
  if (delta < 60) return 'just now';
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

// Authority is derived here exactly as the server derives it, so a lapsed
// approval reads as expired on this page too.
function envelopeStatus(m) {
  const auth = m.authority;
  if (!auth) return 'ENVELOPE_ABSENT';
  const approval = auth.approval;
  if (!approval) {
    if (auth.decision === 'ALLOW') return 'DELEGATED_AUTHORITY_ALLOW';
    if (auth.decision === 'DENY') return 'DENIED_BY_ENVELOPE';
    return 'ENVELOPE_ABSENT';
  }
  // Fixtures declare approval lifetimes relative to load time, exactly as the
  // server's seed route resolves them, so the expiry demonstration stays
  // truthful as the file ages instead of decaying into a fixed timestamp.
  const expiresAt = approval.expires_at !== undefined
    ? Number(approval.expires_at)
    : Math.floor(Date.now() / 1000) + Number(approval.expires_in || 0);
  if (expiresAt < Math.floor(Date.now() / 1000)) return 'ENVELOPE_EXPIRED';
  if (auth.decision === 'DENY') return 'DENIED_BY_ENVELOPE';
  return 'DELEGATED_AUTHORITY_ALLOW';
}

function stage(step, title, inner) {
  return `<div class="demo-stage"><h4 data-step="${step}">${esc(title)}</h4>${inner}</div>`;
}

function kv(rows) {
  return `<dl class="demo-kv">${rows
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

function renderDetail(m) {
  const env = envelopeStatus(m);
  const out = [];

  out.push(stage('01', 'Mission',
    `<p class="demo-title">${esc(m.title)}</p><p class="demo-desc">${esc(m.description)}</p>` +
    kv([['Identifier', esc(m.id)], ['Workstream', esc(m.project)],
        ['State', `<span class="demo-state s-${esc(m.state)}">${esc(m.state)}</span>`],
        ['Priority', esc(m.priority)], ['Risk', esc(m.risk_level)],
        ['Class', esc(m.task_class)], ['Updated', ago(m.updated_at)],
        ['Provenance', `<span class="demo-badge">${esc(m.provenance)}</span>`]])));

  out.push(stage('02', 'Evidence', (m.evidence || []).length
    ? m.evidence.map(e => `<div class="demo-item"><span class="demo-tag">${esc(e.type)}</span>
        <strong>${esc(e.ref)}</strong><span class="demo-sub">${esc(e.description)}</span>
        <span class="demo-sub">source ${esc(e.source)} &middot; ${esc(e.fingerprint)}</span></div>`).join('')
    : '<p class="demo-sub">No evidence recorded.</p>'));

  const r = m.reasoning || {};
  out.push(stage('03', 'Decision', kv([
    ['Problem', esc(r.problem)],
    ['Observations', (r.observations || []).map(o => `<div class="demo-sub">&bull; ${esc(o)}</div>`).join('')],
    ['Options', (r.options || []).map(o =>
      `<div class="demo-item"><strong>${esc(o.option)}</strong><span class="demo-sub">${esc(o.assessment)}</span></div>`).join('')],
    ['Selected', `<strong>${esc(r.selected)}</strong>`],
    ['Rationale', esc(r.rationale)],
    ['Confidence', esc(r.confidence)],
    ['Decided by', esc(r.decided_by)],
  ])));

  const a = m.authority || {};
  const ap = a.approval;
  out.push(stage('04', 'Authority',
    `<p class="demo-banner env-${esc(env)}">${esc(env)}</p>` + kv([
      ['Decision', esc(a.decision)], ['Reason', esc(a.reason)], ['Digest', esc(a.digest)],
      ['Gates', (a.gates || []).map(g =>
        `<div class="demo-gate"><span>${esc(g.name)}</span><span class="demo-status st-${esc(g.status)}">${esc(g.status)}</span></div>`).join('')],
      ['Approver', ap ? esc(ap.approver) : ''],
      ['Expiry', ap ? (env === 'ENVELOPE_EXPIRED'
        ? `<span class="demo-status st-EXPIRED">Approval has lapsed</span>`
        : 'Valid') : ''],
    ])));

  out.push(stage('05', 'Plan', (m.plan || []).map(s => {
    const marker = { complete: '[x]', active: '[>]', failed: '[!]', skipped: '[-]' }[s.state] || '[ ]';
    return `<div class="demo-step p-${esc(s.state)}"><span class="demo-marker">${marker}</span>
      <span>${esc(s.action)}<span class="demo-sub">${esc(s.owner)} &middot; ${esc(s.state)}</span></span></div>`;
  }).join('') || '<p class="demo-sub">No plan recorded.</p>'));

  out.push(stage('06', 'Executor', kv([
    ['Assigned', esc(m.executor) || '<span class="demo-sub">None; work was never dispatched.</span>'],
    ['Recommended', esc(m.recommended_executor)],
    ['Override', m.is_override ? `<span class="demo-status st-PENDING">Yes &mdash; ${esc(m.override_reason)}</span>` : 'No'],
  ])));

  const x = m.execution || {};
  const d = x.delta || {};
  out.push(stage('07', 'Execution', kv([
    ['Started', Number(x.started_at) ? ago(x.started_at) : '<span class="demo-sub">Never started.</span>'],
    ['Current', esc(x.current_operation)],
    ['Retries', String(x.retries ?? 0)],
    ['Files changed', (d.files_modified || []).map(f => `<div class="demo-sub">${esc(f)}</div>`).join('') || '<span class="demo-sub">none</span>'],
    ['Diff', `+${d.insertions ?? 0} / -${d.deletions ?? 0}`],
    ['Unexpected changes', (d.unexpected || []).length
      ? `<span class="demo-status st-failed">${d.unexpected.map(esc).join(', ')}</span>`
      : '<span class="demo-status st-passed">None detected</span>'],
    ['Error', x.receipt && x.receipt.error_message ? `<span class="demo-status st-failed">${esc(x.receipt.error_message)}</span>` : ''],
    ['Recovery', (x.recovery_actions || []).map(v => `<div class="demo-sub">&bull; ${esc(v)}</div>`).join('')],
  ])));

  // "claimed" is never folded into "passed": it means the agent asserted a
  // result that nothing independently confirmed.
  out.push(stage('08', 'Verification', (m.verification || []).length
    ? m.verification.map(v => `<div class="demo-verify v-${esc(v.status)}">
        <span>${esc(v.name)}${v.status === 'claimed'
          ? '<span class="demo-claim">Claimed by the agent; not independently verified.</span>' : ''}
        <span class="demo-sub">${esc(v.output_digest)}</span></span>
        <span class="demo-status st-${esc(v.status)}">${esc(v.status)} (exit ${esc(v.exit_code)})</span></div>`).join('')
    : '<p class="demo-sub">No verification has run.</p>'));

  out.push(stage('09', 'Outcome', m.outcome
    ? `<p class="demo-outcome o-${esc(m.outcome)}">${esc(m.outcome)}</p>`
    : '<p class="demo-outcome o-pending">Not yet reached</p>'));

  const mine = demoEvents.filter(e => e.mission_id === m.id);
  out.push(stage('10', 'Audit timeline', `<div class="demo-timeline">${mine.map(e =>
    `<div class="demo-event"><span class="demo-at">${ago(e.timestamp)}</span>
     <span><span class="demo-what">${esc(e.action)}</span>
     <span class="demo-who">${esc(e.actor)}</span>
     ${e.detail ? `<span class="demo-sub">${esc(e.detail)}</span>` : ''}</span></div>`).join('')}</div>`));

  return out.join('');
}

function selectMission(id) {
  const m = demoMissions.find(x => x.id === id);
  if (!m) return;
  document.querySelectorAll('.demo-row').forEach(row => {
    row.setAttribute('aria-current', row.dataset.id === id ? 'true' : 'false');
  });
  const detail = document.getElementById('demo-detail');
  if (detail) detail.innerHTML = renderDetail(m);
}

function renderList() {
  const list = document.getElementById('demo-list');
  if (!list) return;
  list.innerHTML = demoMissions.map(m => {
    const env = envelopeStatus(m);
    return `<button type="button" class="demo-row s-${esc(m.state)}" data-id="${esc(m.id)}" aria-current="false">
      <span class="demo-row-top"><span class="demo-id">${esc(m.id)}</span>
      <span class="demo-state s-${esc(m.state)}">${esc(m.state)}</span></span>
      <span class="demo-row-title">${esc(m.title)}</span>
      <span class="demo-row-meta"><span class="demo-tag">${esc(m.project)}</span>
      <span class="demo-status st-${esc(env)}">${esc(env)}</span>
      <span class="demo-badge">${esc(m.provenance)}</span></span></button>`;
  }).join('');
  list.querySelectorAll('.demo-row').forEach(row => {
    row.addEventListener('click', () => selectMission(row.dataset.id));
  });
}

async function loadDemo() {
  const list = document.getElementById('demo-list');
  if (!list) return;
  try {
    const response = await fetch('missions.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const doc = await response.json();
    demoMissions = doc.missions || [];
    demoEvents = doc.events || [];
  } catch (err) {
    list.innerHTML = `<p class="demo-sub">Demo data could not be loaded (${esc(err.message)}).</p>`;
    return;
  }
  renderList();
  if (demoMissions.length) selectMission(demoMissions[0].id);
}

document.addEventListener('DOMContentLoaded', () => {
  loadDemo();

  // Theme Management
  const themeToggleBtn = document.getElementById('theme-toggle');
  const root = document.documentElement;

  const getPreferredTheme = () => {
    const saved = localStorage.getItem('howl-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const applyTheme = (theme) => {
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      document.body.classList.remove('light-mode');
    } else {
      root.removeAttribute('data-theme');
      document.body.classList.add('light-mode');
    }

    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('aria-pressed', String(theme === 'dark'));
      themeToggleBtn.innerHTML = theme === 'dark'
        ? '<span aria-hidden="true">☼</span> [LIGHT_MODE]'
        : '<span aria-hidden="true">☾</span> [DARK_MODE]';
    }
  };

  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem('howl-theme', next);
      applyTheme(next);
    });
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('howl-theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Hamburger / Ecosystem Drawer
  const drawerToggle = document.getElementById('eco-menu-toggle');
  const drawer = document.getElementById('eco-drawer');
  const drawerOverlay = document.getElementById('eco-drawer-overlay');
  const drawerCloseBtn = document.getElementById('eco-drawer-close');

  const openDrawer = () => {
    if (drawer && drawerOverlay) {
      drawer.classList.add('active');
      drawerOverlay.classList.add('active');
      if (drawerToggle) drawerToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      if (drawerCloseBtn) drawerCloseBtn.focus();
    }
  };

  const closeDrawer = () => {
    if (drawer && drawerOverlay) {
      drawer.classList.remove('active');
      drawerOverlay.classList.remove('active');
      if (drawerToggle) {
        drawerToggle.setAttribute('aria-expanded', 'false');
        drawerToggle.focus();
      }
      document.body.style.overflow = '';
    }
  };

  if (drawerToggle) {
    drawerToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = drawer && drawer.classList.contains('active');
      if (isActive) closeDrawer();
      else openDrawer();
    });
  }

  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener('click', closeDrawer);
  }

  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', closeDrawer);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('active')) {
      closeDrawer();
    }
  });

  // Code Copy Buttons
  document.querySelectorAll('.code-container').forEach((container) => {
    const copyBtn = container.querySelector('.btn-copy');
    const codeEl = container.querySelector('pre code') || container.querySelector('pre');
    
    if (copyBtn && codeEl) {
      copyBtn.addEventListener('click', async () => {
        try {
          const text = codeEl.innerText.trim();
          await navigator.clipboard.writeText(text);
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '[COPIED!]';
          copyBtn.style.borderColor = 'var(--color-cyan)';
          copyBtn.style.color = 'var(--color-cyan)';
          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.borderColor = '';
            copyBtn.style.color = '';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy code snippet:', err);
        }
      });
    }
  });
});
