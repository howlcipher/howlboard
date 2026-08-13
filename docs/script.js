const demoTasks = [
    { id: 1, title: "Initialize repository", description: "Set up the basic HowlBoard repo structure.", priority: "HIGH", tags: "git,setup", status: "DONE" },
    { id: 2, title: "Design deterministic rules", description: "Ensure status transitions are strictly enforced.", priority: "HIGH", tags: "architecture", status: "DONE" },
    { id: 3, title: "Fix missing set_html", description: "Update HowlFrame JS backend to support HTML injection.", priority: "CRITICAL", tags: "howlframe,bug", status: "DONE" },
    { id: 4, title: "Build frontend client", description: "Write app.howl to render task cards.", priority: "MED", tags: "ui", status: "IN_PROGRESS" },
    { id: 5, title: "Add LLM AI proposals", description: "Allow AI agents to suggest task additions and moves.", priority: "LOW", tags: "ai", status: "BACKLOG" },
    { id: 6, title: "Investigate list parsing in body", description: "HowlFrame JSON parser is struggling with array structures.", priority: "HIGH", tags: "backend,bug", status: "BLOCKED" }
];

function renderCard(task) {
    return `
    <div class="task-card" id="task-${task.id}">
        <div class="task-id">ID_${task.id}</div>
        <div class="task-title">${task.title}</div>
        <div class="task-desc">${task.description}</div>
        <div class="task-meta"><span>P: ${task.priority}</span><span>T: ${task.tags}</span></div>
        <div class="task-actions">
            <button disabled title="Read-only static demo">STATIC DEMO</button>
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

    document.getElementById("demo-backlog").innerHTML = backlog;
    document.getElementById("demo-ready").innerHTML = ready;
    document.getElementById("demo-inprogress").innerHTML = inprogress;
    document.getElementById("demo-blocked").innerHTML = blocked;
    document.getElementById("demo-done").innerHTML = done;
}

document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
});

document.addEventListener('DOMContentLoaded', loadDemo);
