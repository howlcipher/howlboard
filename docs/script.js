/**
 * Howl Ecosystem Shared Client Script - HowlBoard
 * Features: Interactive deterministic state machine board demo, telemetry console,
 * code snippet copy, light/dark theme toggle, ecosystem drawer.
 */

const demoTasks = [
  { id: 1, title: "Initialize Full-Stack Architecture", description: "Bootstrap frontend web_app and backend http_server under HowlFrame.", priority: "HIGH", tags: "setup,hfbc", status: "DONE" },
  { id: 2, title: "Enforce State Invariant Policy", description: "Ensure status transitions are strictly validated in server.howl.", priority: "CRITICAL", tags: "policy,state", status: "DONE" },
  { id: 3, title: "HTML DOM Mutation (set_html)", description: "Added set_html and toggle_class primitives to HowlFrame JS backend.", priority: "HIGH", tags: "compiler,fix", status: "DONE" },
  { id: 4, title: "CORS & HTTP Request Method", description: "Added req_method and res_header capabilities to bytecode server.", priority: "MED", tags: "runtime,net", status: "IN_PROGRESS" },
  { id: 5, title: "AI-Assisted Task Proposer", description: "Allow AI agents to propose task additions subject to deterministic gate.", priority: "LOW", tags: "agent,ai", status: "READY" },
  { id: 6, title: "List Parsing in Bytecode Payload", description: "Improve AST walker loop ergonomics for deserializing JSON lists.", priority: "HIGH", tags: "parser,eval", status: "BLOCKED" },
  { id: 7, title: "Telemetry Heartbeat Aggregation", description: "Stream real-time VM instruction counts to dashboard console.", priority: "LOW", tags: "telemetry", status: "BACKLOG" }
];

const validTransitions = {
  "BACKLOG": ["READY"],
  "READY": ["IN_PROGRESS", "BACKLOG"],
  "IN_PROGRESS": ["BLOCKED", "DONE", "READY"],
  "BLOCKED": ["IN_PROGRESS", "READY"],
  "DONE": ["IN_PROGRESS"]
};

function logTelemetry(msg, isError = false) {
  const readout = document.getElementById("telemetry-readout");
  if (readout) {
    const time = new Date().toISOString().substring(11, 19);
    readout.innerHTML = `<span style="color: ${isError ? 'var(--color-red)' : 'var(--color-cyan)'};">[${time}]</span> ${msg}`;
  }
}

function transitionTask(taskId, targetStatus) {
  const task = demoTasks.find(t => t.id === taskId);
  if (!task) return;

  const allowed = validTransitions[task.status] || [];
  if (allowed.includes(targetStatus)) {
    const oldStatus = task.status;
    task.status = targetStatus;
    loadDemo();
    logTelemetry(`STATE TRANSITION: ALLOWED // Task #${task.id} (${task.title.substring(0, 24)}...): ${oldStatus} &rarr; ${targetStatus}`);
  } else {
    logTelemetry(`STATE TRANSITION: DENIED // Invariant policy violation: Cannot jump directly from ${task.status} to ${targetStatus}`, true);
  }
}

function renderCard(task) {
  let actionButtons = "";
  const allowed = validTransitions[task.status] || [];

  allowed.forEach(nextState => {
    actionButtons += `<button class="btn-card-action" onclick="transitionTask(${task.id}, '${nextState}')">&rarr; ${nextState}</button>`;
  });

  return `
    <div class="task-card" id="task-${task.id}">
      <div class="task-id">TASK_#${task.id} [${task.status}]</div>
      <div class="task-title">${task.title}</div>
      <div class="task-desc">${task.description}</div>
      <div class="task-meta">
        <span>PRIORITY: ${task.priority}</span>
        <span>TAGS: ${task.tags}</span>
      </div>
      <div class="task-actions">
        ${actionButtons}
      </div>
    </div>`;
}

function loadDemo() {
  let backlog = "", ready = "", inprogress = "", blocked = "", done = "";

  demoTasks.forEach(task => {
    const card = renderCard(task);
    if (task.status === "BACKLOG") backlog += card;
    if (task.status === "READY") ready += card;
    if (task.status === "IN_PROGRESS") inprogress += card;
    if (task.status === "BLOCKED") blocked += card;
    if (task.status === "DONE") done += card;
  });

  const bEl = document.getElementById("demo-backlog");
  const rEl = document.getElementById("demo-ready");
  const pEl = document.getElementById("demo-inprogress");
  const blEl = document.getElementById("demo-blocked");
  const dEl = document.getElementById("demo-done");

  if (bEl) bEl.innerHTML = backlog || '<div style="font-size:0.75rem;color:var(--text-dim);text-align:center;padding:1rem;">EMPTY</div>';
  if (rEl) rEl.innerHTML = ready || '<div style="font-size:0.75rem;color:var(--text-dim);text-align:center;padding:1rem;">EMPTY</div>';
  if (pEl) pEl.innerHTML = inprogress || '<div style="font-size:0.75rem;color:var(--text-dim);text-align:center;padding:1rem;">EMPTY</div>';
  if (blEl) blEl.innerHTML = blocked || '<div style="font-size:0.75rem;color:var(--text-dim);text-align:center;padding:1rem;">EMPTY</div>';
  if (dEl) dEl.innerHTML = done || '<div style="font-size:0.75rem;color:var(--text-dim);text-align:center;padding:1rem;">EMPTY</div>';
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
