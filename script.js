
const $ = id => document.getElementById(id);

let tasks = [
  {id:1,name:"User authentication API",owner:"Aarav",progress:85,due:11,status:"In Progress",dep:null,blocked:false,points:5},
  {id:2,name:"Analytics dashboard UI",owner:"Varshini",progress:45,due:12,status:"In Progress",dep:1,blocked:false,points:8},
  {id:3,name:"Payment integration",owner:"Ishita",progress:25,due:10,status:"Blocked",dep:1,blocked:true,points:8},
  {id:4,name:"Database optimization",owner:"Rohan",progress:65,due:13,status:"In Progress",dep:null,blocked:false,points:5},
  {id:5,name:"Automated test suite",owner:"Aarav",progress:30,due:11,status:"In Progress",dep:3,blocked:false,points:5},
  {id:6,name:"API documentation",owner:"Meera",progress:90,due:12,status:"In Progress",dep:1,blocked:false,points:3},
  {id:7,name:"Mobile responsiveness",owner:"Varshini",progress:20,due:13,status:"To Do",dep:2,blocked:false,points:5},
  {id:8,name:"Deployment pipeline",owner:"Rohan",progress:100,due:9,status:"Done",dep:null,blocked:false,points:3}
];

const capacities = {Aarav:13,Varshini:15,Ishita:13,Rohan:15,Meera:12};
let chart = null;
let toastTimer;

function riskScore(t, source=tasks) {
  const ai = window.aiPredictions?.find(p => p.id === t.id);
  if (t.status === "Done" || t.progress >= 100) return 0;
  let score = 0;
  if (t.blocked || t.status === "Blocked") score += 30;
  if (t.due < 10) score += 30;
  if (t.progress < 50 && t.due <= 12) score += 25;
  if (t.dep) {
    const dependency = source.find(x => x.id === t.dep);
    if (dependency && dependency.progress < 100) score += 15;
  }
  if (ai) return ai.risk_score;
  return Math.min(100, score);
}

function riskName(score) {
  return score >= 50 ? "High" : score >= 25 ? "Medium" : "Low";
}

function riskClass(score) {
  return "risk-" + riskName(score).toLowerCase();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;",
    '"':"&quot;", "'":"&#39;"
  }[c]));
}

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function ownerAvatar(owner) {
  const initials = owner.trim().split(/\s+/).map(x => x[0]).join("").slice(0,2);
  return `<span class="owner-avatar">${escapeHTML(initials.toUpperCase())}</span>`;
}

function progressHTML(value) {
  const color = value >= 80 ? "var(--green)" : value >= 40 ? "var(--purple)" : "var(--orange)";
  return `<div class="progress-cell"><div class="progress-label"><span>${value}%</span></div><div class="progress"><div class="progress-fill" style="width:${value}%;background:${color}"></div></div></div>`;
}

function riskBadge(score) {
  return `<span class="risk-badge ${riskClass(score)}">${riskName(score)} · ${score}</span>`;
}

function statusBadge(status) {
  return `<span class="status-badge status-${status.replace(/\s+/g,"-")}">${escapeHTML(status)}</span>`;
}

function dependencyName(t) {
  const d = tasks.find(x => x.id === t.dep);
  return d ? d.name : "None";
}

function renderDashboard() {
  const total = tasks.length;
  const completed = total ? Math.round(tasks.reduce((sum,t) => sum+t.progress,0)/total) : 0;
  const high = tasks.filter(t => riskScore(t) >= 50).length;
  const blocked = tasks.filter(t => t.blocked || t.status === "Blocked").length;

  $("totalTasks").textContent = total;
  $("completion").textContent = completed + "%";
  $("completionBar").style.width = completed + "%";
  $("highRisk").textContent = high;
  $("blocked").textContent = blocked;

  const counts = {Low:0,Medium:0,High:0};
  tasks.forEach(t => counts[riskName(riskScore(t))]++);
  if (chart) chart.destroy();

  const ctx = $("riskChart").getContext("2d");
  chart = new Chart(ctx, {
    type:"doughnut",
    data:{
      labels:["Low risk","Medium risk","High risk"],
      datasets:[{
        data:[counts.Low,counts.Medium,counts.High],
        backgroundColor:["#4ee0a1","#ffba68","#ff6c9f"],
        borderColor:["#111629","#111629","#111629"],
        borderWidth:5,
        hoverOffset:8
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      cutout:"72%",
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:"#171b30",padding:12}
      }
    }
  });

  const risky = tasks.filter(t => riskScore(t) >= 25)
    .sort((a,b) => riskScore(b)-riskScore(a)).slice(0,4);

  $("alerts").innerHTML = risky.length ? risky.map(t => {
    const score = riskScore(t);
    let message = t.blocked || t.status === "Blocked"
      ? "Blocked work may delay dependent tasks."
      : t.dep && tasks.find(x => x.id === t.dep)?.progress < 100
      ? "An unfinished dependency could slow this task."
      : "Progress and deadline indicate possible delivery risk.";

    return `<div class="alert-item">
      <div class="alert-icon">${score >= 50 ? "⚠" : "↗"}</div>
      <div><h4>${escapeHTML(t.name)}</h4><p>${message}</p></div>
      <span class="alert-score">${score}/100</span>
    </div>`;
  }).join("") : `<div class="empty-note">✦ No medium or high-risk tasks detected. Keep monitoring your sprint.</div>`;

  const attention = [...tasks].sort((a,b) => riskScore(b)-riskScore(a)).slice(0,5);
  $("attentionTable").innerHTML = attention.map(t => `
    <tr>
      <td><span class="task-title">${escapeHTML(t.name)}</span><span class="task-id">SP-${String(t.id).padStart(3,"0")}</span></td>
      <td><div class="owner-cell">${ownerAvatar(t.owner)}${escapeHTML(t.owner)}</div></td>
      <td>${progressHTML(t.progress)}</td>
      <td>${riskBadge(riskScore(t))}</td>
      <td>${statusBadge(t.status)}</td>
    </tr>`).join("");
}

function renderTasks() {
  const search = $("taskSearch").value.toLowerCase();
  const rf = $("riskFilter").value;
  const sf = $("statusFilter").value;

  const filtered = tasks.filter(t =>
    (t.name.toLowerCase().includes(search) || t.owner.toLowerCase().includes(search)) &&
    (rf === "all" || riskName(riskScore(t)) === rf) &&
    (sf === "all" || t.status === sf)
  );

  $("taskCountLabel").textContent = `${filtered.length} of ${tasks.length} tasks`;
  $("tasksTable").innerHTML = filtered.length ? filtered.map(t => `
    <tr>
      <td><span class="task-title">${escapeHTML(t.name)}</span><span class="task-id">SP-${String(t.id).padStart(3,"0")} · Depends on: ${escapeHTML(dependencyName(t))}</span></td>
      <td><div class="owner-cell">${ownerAvatar(t.owner)}${escapeHTML(t.owner)}</div></td>
      <td>${progressHTML(t.progress)}</td>
      <td>Day ${t.due}</td>
      <td>${riskBadge(riskScore(t))}</td>
      <td>${statusBadge(t.status)}</td>
      <td><button class="secondary-btn edit-task" data-id="${t.id}">Edit</button> <button class="icon-btn delete-task" data-id="${t.id}" title="Delete task">×</button></td>
    </tr>`).join("") : `<tr><td colspan="7">No matching tasks found.</td></tr>`;

  fillSelects();
}

function fillSelects() {
  const currentScenario = $("scenarioTask").value;
  const currentDomino = $("dominoTask").value;
  const currentDependency = $("taskDependency").value;

  const options = tasks.map(t =>
    `<option value="${t.id}">${escapeHTML(t.name)}</option>`
  ).join("");

  $("scenarioTask").innerHTML = options;
  $("dominoTask").innerHTML = options;
  $("taskDependency").innerHTML =
    `<option value="">No dependency</option>` +
    tasks.filter(t => String(t.id) !== $("editId").value).map(t =>
      `<option value="${t.id}">${escapeHTML(t.name)}</option>`
    ).join("");

  if (tasks.some(t => String(t.id) === currentScenario)) $("scenarioTask").value = currentScenario;
  if (tasks.some(t => String(t.id) === currentDomino)) $("dominoTask").value = currentDomino;
  if ([...$("taskDependency").options].some(o => o.value === currentDependency)) {
    $("taskDependency").value = currentDependency;
  }
}

function descendants(id) {
  const found = [];
  const seen = new Set([Number(id)]);
  const queue = [Number(id)];

  while (queue.length) {
    const current = queue.shift();
    tasks.filter(t => t.dep === current && !seen.has(t.id)).forEach(t => {
      seen.add(t.id);
      found.push(t);
      queue.push(t.id);
    });
  }
  return found;
}

function renderDomino() {
  if (!tasks.length) {
    $("dominoMap").innerHTML = `<div class="empty-note">Add tasks to explore dependencies.</div>`;
    $("dominoSummary").textContent = "";
    return;
  }

  const root = tasks.find(t => t.id === Number($("dominoTask").value)) || tasks[0];
  const affected = descendants(root.id);

  $("dominoSummary").innerHTML =
    `<b>${escapeHTML(root.name)}</b> connects to ${affected.length} downstream task(s). ` +
    (affected.length ? "A delay here could affect the tasks below." : "No downstream tasks are currently linked.");

  const nodes = [root,...affected];
  $("dominoMap").innerHTML = nodes.map((t,i) => `
    <div class="domino-node ${i===0?"root":riskScore(t)>=50?"risky":""}">
      <div class="node-symbol">${i===0?"✦":i}</div>
      <div class="node-info"><b>${escapeHTML(t.name)}</b><small>${i===0?"Selected task":"Downstream dependency"} · ${escapeHTML(t.owner)} · ${t.progress}% complete</small></div>
      ${riskBadge(riskScore(t))}
    </div>`).join("");
}

function renderRecovery() {
  const risky = [...tasks].filter(t => t.progress < 100)
    .sort((a,b) => riskScore(b)-riskScore(a));

  const plans = [
    {
      type:"01 · UNBLOCK",
      title:"Clear the critical blocker",
      description:"Resolve blocked work first so dependent tasks can move forward.",
      actions:["Confirm the blocker and its owner","Ask for the specific decision or resource needed","Recalculate dependent-task risks"],
      impact:"Prioritizes blocked tasks"
    },
    {
      type:"02 · REBALANCE",
      title:"Redistribute remaining work",
      description:"Consider moving suitable tasks from overloaded teammates to available capacity.",
      actions:["Review remaining effort and deadlines","Check skills and ownership before reassignment","Agree on the handoff with both teammates"],
      impact:"Targets workload imbalance"
    },
    {
      type:"03 · PROTECT DELIVERY",
      title:"Reduce sprint scope carefully",
      description:"If recovery is not realistic, discuss moving lower-priority work out of the sprint.",
      actions:["Identify unfinished lower-priority work","Confirm priorities with the product owner","Update the sprint commitment transparently"],
      impact:"Protects essential deliverables"
    },
    {
      type:"04 · SPEED UP FEEDBACK",
      title:"Shorten the review loop",
      description:"Late reviews can leave completed work waiting and increase end-of-sprint risk.",
      actions:["Identify pending pull requests","Assign a reviewer and target time","Run relevant tests before merging"],
      impact:"Improves feedback flow"
    }
  ];

  $("recoveryPlans").innerHTML = plans.map((p,i) => `
    <article class="recovery-card">
      <div class="recovery-type">${p.type}</div>
      <h3>${p.title}</h3><p>${p.description}</p>
      <ul>${p.actions.map(a => `<li>${a}</li>`).join("")}</ul>
      <span class="impact">${p.impact}</span>
    </article>`).join("");

  const top = risky[0];
  $("balanceSuggestion").innerHTML = top
    ? `Start by reviewing <b>${escapeHTML(top.name)}</b>, currently owned by <b>${escapeHTML(top.owner)}</b> with a risk score of <b>${riskScore(top)}/100</b>. Confirm the cause with the team before choosing a recovery action.`
    : "All tasks are complete. Review the next sprint's dependencies and workload before committing.";
}

function renderTimeline() {
  const day = Number($("timelineSlider").value);
  $("timelineDay").textContent = `DAY ${day}`;

  const progress = Math.min(100,Math.round((day/14)*100));
  const risk = Math.min(100,Math.max(5,Math.round(15 + day*4.5)));
  const events = [
    {day:2,title:"Sprint planning",desc:"Tasks and dependencies are agreed."},
    {day:5,title:"Dependency delay",desc:"A prerequisite starts taking longer than expected."},
    {day:8,title:"Blocked work",desc:"The team identifies a blocked task."},
    {day:10,title:"Risk escalation",desc:"Unfinished dependent work needs attention."},
    {day:12,title:"Recovery window",desc:"The team reviews scope and reassignments."},
    {day:14,title:"Sprint review",desc:"Compare delivery against the sprint goal."}
  ];
  const current = events.filter(e => e.day <= day);

  $("timelineResult").innerHTML = `
    <h3>Day ${day}: ${day < 5 ? "Sprint in motion" : day < 9 ? "Dependencies under pressure" : day < 13 ? "Recovery decisions matter" : "Delivery checkpoint"}</h3>
    <p>Illustrative timeline only. Day progress: ${progress}%. Simulated risk trend: ${risk}/100. These figures are not reconstructed from historical sprint data.</p>`;

  $("timelineEvents").innerHTML = (current.length ? current.slice(-3) : [
    {day:1,title:"Sprint kickoff",desc:"The sprint begins."}
  ]).map(e => `
    <div class="event-card"><b>Day ${e.day} · ${e.title}</b><p>${e.desc}</p></div>
  `).join("");
}

function renderTeam() {
  const members = [...new Set(tasks.map(t => t.owner))];

  $("teamGrid").innerHTML = members.map(owner => {
    const owned = tasks.filter(t => t.owner === owner);
    const remaining = owned.reduce((s,t) => s + t.points*(1-t.progress/100),0);
    const capacity = capacities[owner] || 12;
    const load = Math.round(remaining/capacity*100);
    const score = Math.min(100,load);
    const label = load > 100 ? "Over capacity" : load > 75 ? "High workload" : load < 30 ? "More capacity" : "Balanced estimate";

    return `<article class="team-card">
      <div class="team-header">${ownerAvatar(owner)}<div><b>${escapeHTML(owner)}</b><small>${owned.length} assigned task(s)</small></div></div>
      <div class="team-load">${remaining.toFixed(1)} <span style="font-size:11px;color:var(--muted)">points left</span></div>
      <div class="team-load-label">${label}</div>
      <div class="progress"><div class="progress-fill" style="width:${score}%;background:${load>100?"var(--pink)":load>75?"var(--orange)":"var(--cyan)"}"></div></div>
      <div class="team-detail"><span>Assumed capacity: ${capacity}</span><span>${load}% load</span></div>
    </article>`;
  }).join("");

  const available = members.map(owner => ({
    owner,
    remaining:tasks.filter(t => t.owner===owner).reduce((s,t) => s+t.points*(1-t.progress/100),0),
    capacity:capacities[owner]||12
  })).sort((a,b) => a.remaining/b.capacity-b.remaining/a.capacity);

  $("balanceSuggestion").innerHTML = available.length > 1
    ? `Compare <b>${escapeHTML(available[0].owner)}</b> (estimated lower remaining workload) with <b>${escapeHTML(available[available.length-1].owner)}</b> (estimated higher remaining workload). Consider a skill-appropriate handoff only after discussing capacity and context with the team.`
    : "Add tasks and owners to compare estimated workloads.";
}

function renderAll() {
  renderDashboard();
  renderTasks();
  renderDomino();
  renderRecovery();
  renderTimeline();
  renderTeam();
}

function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = $("page-" + page);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(b =>
    b.classList.toggle("active",b.dataset.page === page)
  );

  const labels = {
    dashboard:"Overview",tasks:"Task Intelligence",simulator:"What-if Simulator",
    domino:"Domino Map",recovery:"Recovery Lab",timeline:"Sprint Time Machine",
    team:"Team Fairness"
  };
  $("crumb").textContent = labels[page] || "Overview";
  if (page === "dashboard" && chart) chart.resize();
}

function openTask(task=null) {
  $("taskForm").reset();
  $("editId").value = task ? task.id : "";
  $("dialogTitle").textContent = task ? "Edit sprint task" : "Add sprint task";

  fillSelects();

  $("taskName").value = task ? task.name : "";
  $("taskOwner").value = task ? task.owner : "";
  $("taskDue").value = task ? task.due : 12;
  $("taskProgress").value = task ? task.progress : 0;
  $("taskStatus").value = task ? task.status : "To Do";
  $("taskBlocked").checked = task ? task.blocked : false;
  $("taskDependency").value = task && task.dep ? String(task.dep) : "";

  $("taskDialog").showModal();
}

function exportCSV() {
  const headers = ["ID","Task","Owner","Progress","Due Day","Status","Blocked","Dependency","Risk"];
  const rows = tasks.map(t => [
    t.id,t.name,t.owner,t.progress,t.due,t.status,t.blocked,
    dependencyName(t),riskScore(t)
  ]);

  const csv = [headers,...rows].map(row =>
    row.map(value => `"${String(value).replace(/"/g,'""')}"`).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "SprintPulse-tasks.csv";
  a.click();
  URL.revokeObjectURL(url);
  notify("Task report exported.");
}

function runScenario() {
  const id = Number($("scenarioTask").value);
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const type = $("scenarioType").value;
  const value = Number($("scenarioValue").value);
  const baseline = riskScore(task);
  let simulated = {...task};
  let title = "";
  let explanation = "";
  let days = 0;

  if (type === "delay") {
    days = value;
    simulated.due += value;
    title = `Delay "${task.name}" by ${value} day(s)`;
    explanation = "This simple scenario shifts the task's due day. It does not automatically calculate the project's actual critical path.";
  } else if (type === "reassign") {
    const candidates = [...new Set(tasks.map(t => t.owner))].filter(x => x !== task.owner);
    simulated.owner = candidates[0] || task.owner;
    title = `Reassign "${task.name}"`;
    explanation = `Illustrative reassignment to ${simulated.owner}. Real capacity, skills, and onboarding time must be checked separately.`;
  } else if (type === "unblock") {
    simulated.blocked = false;
    if (simulated.status === "Blocked") simulated.status = "In Progress";
    title = `Resolve blocker for "${task.name}"`;
    explanation = "The task's blocker signal is removed for this scenario. Confirm that the underlying issue is actually resolved before applying this change.";
  } else {
    simulated.progress = Math.min(100,simulated.progress + value*10);
    if (simulated.progress === 100) simulated.status = "Done";
    title = `Increase progress on "${task.name}"`;
    explanation = `Simulated progress increases by ${value*10} percentage points. Actual delivery still depends on reviews, tests, and outstanding work.`;
  }

  const trial = tasks.map(t => t.id === id ? simulated : t);
  const newRisk = riskScore(simulated,trial);
  const average = list => list.length
    ? Math.round(list.reduce((s,t)=>s+riskScore(t,list),0)/list.length)
    : 0;

  const oldAverage = average(tasks);
  const newAverage = average(trial);
  const delta = newAverage-oldAverage;

  $("scenarioResult").innerHTML = `
    <div class="result-metrics">
      <div class="result-metric"><span>Task risk · baseline</span><b>${baseline}/100</b></div>
      <div class="result-metric"><span>Task risk · scenario</span><b style="color:${newRisk>baseline?"var(--pink)":newRisk<baseline?"var(--green)":"var(--cyan)"}">${newRisk}/100</b></div>
      <div class="result-metric"><span>Average sprint risk · baseline</span><b>${oldAverage}/100</b></div>
      <div class="result-metric"><span>Average sprint risk · scenario</span><b>${newAverage}/100</b></div>
    </div>
    <div class="result-explanation"><b>${escapeHTML(title)}</b><br>${escapeHTML(explanation)}<br><br>Estimated average risk change: <b>${delta>0?"+":""}${delta}</b> points. ${type==="delay"?`The due day changes from Day ${task.due} to Day ${simulated.due}.`:""} This is a rule-based demo, not a validated delivery forecast.</div>`;

  if (type === "delay") {
    $("scenarioValueText").textContent = value + " days";
  }
}

$("navigation").addEventListener("click",e => {
  const btn = e.target.closest("[data-page]");
  if (btn) navigate(btn.dataset.page);
});

document.querySelectorAll("[data-goto]").forEach(btn =>
  btn.addEventListener("click",() => navigate(btn.dataset.goto))
);


$("addTask").addEventListener("click",() => openTask());
$("addTaskTop").addEventListener("click",() => openTask());
$("closeDialog").addEventListener("click",() => $("taskDialog").close());
$("cancelDialog").addEventListener("click",() => $("taskDialog").close());

$("taskForm").addEventListener("submit", async e => {
  e.preventDefault();

  const oldId = $("editId").value;
  const id = oldId ? Number(oldId) : null;
  const dep = $("taskDependency").value
    ? Number($("taskDependency").value)
    : null;

  if (id !== null && dep === id) {
    notify("A task cannot depend on itself.");
    return;
  }

  const old = tasks.find(t => t.id === id);
  const progress = Number($("taskProgress").value);
  const status = progress >= 100 ? "Done" : $("taskStatus").value;

  const task = {
    ...(old || {}),
    id: id || 0,
    name: $("taskName").value.trim(),
    owner: $("taskOwner").value.trim(),
    due: Number($("taskDue").value),
    progress,
    status,
    dep,
    blocked: $("taskBlocked").checked || status === "Blocked",
    points: old ? old.points : 5
  };

  if (!task.name || !task.owner) return;

  try {
    await saveTaskToBackend(task, Boolean(old));
    $("taskDialog").close();
    await loadTasksFromBackend();
    notify(old ? "Task updated and saved!" : "Task added and saved!");
  } catch (error) {
    console.error(error);
    notify("Could not save task: " + error.message);
  }
});


$("tasksTable").addEventListener("click", async e => {
  const edit = e.target.closest(".edit-task");
  const del = e.target.closest(".delete-task");

  if (edit) {
    const task = tasks.find(t => t.id === Number(edit.dataset.id));
    if (task) openTask(task);
  }

  if (del) {
    const id = Number(del.dataset.id);

    if (tasks.some(t => t.dep === id)) {
      notify("Remove dependent links before deleting this task.");
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/tasks/${id}`,
        { method: "DELETE" }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not delete task");
      }

      await loadTasksFromBackend();
      notify("Task deleted and saved!");
    } catch (error) {
      console.error(error);
      notify("Could not delete task: " + error.message);
    }
  }
});

["taskSearch","riskFilter","statusFilter"].forEach(id =>
  $(id).addEventListener(id==="taskSearch"?"input":"change",renderTasks)
);

$("scenarioType").addEventListener("change",() => {
  const type = $("scenarioType").value;
  const labels = {
    delay:["Delay duration","2 days"],
    reassign:["Reassignment","Illustrative"],
    unblock:["Blocker resolution","Yes"],
    progress:["Progress increase","20%"]
  };
  $("scenarioValueLabel").firstChild.textContent = labels[type][0] + " ";
  $("scenarioValueText").textContent = labels[type][1];
});

$("scenarioValue").addEventListener("input",() => {
  const type = $("scenarioType").value;
  const value = Number($("scenarioValue").value);
  $("scenarioValueText").textContent = type==="delay" ? `${value} days` :
    type==="progress" ? `${value*10}%` : `${value}`;
});

$("runScenario").addEventListener("click",runScenario);
$("dominoTask").addEventListener("change",renderDomino);
$("refreshRecovery").addEventListener("click",() => {
  renderRecovery();
  notify("Recovery plans refreshed.");
});
$("timelineSlider").addEventListener("input",renderTimeline);
$("exportBtn").addEventListener("click",exportCSV);
$("exportTasks").addEventListener("click",exportCSV);

renderAll();

async function checkPythonBackend() {
  try {
    const response = await fetch("http://127.0.0.1:5000/api/tasks");

    if (!response.ok) {
      throw new Error("Backend request failed");
    }

    const data = await response.json();
    console.log("Python backend connected!", data);
    notify("Python backend connected successfully!");
  } catch (error) {
    console.error("Backend connection failed:", error);
    notify("Could not connect to Python backend.");
  }
}


async function loadTasksFromBackend(showMessage = false) {
  try {
    const response = await fetch("http://127.0.0.1:5000/api/tasks");
    if (!response.ok) throw new Error("Could not load tasks");

    tasks = await response.json();
    renderAll();

    if (showMessage) notify("Tasks loaded from Python backend.");
  } catch (error) {
    console.error("Backend error:", error);
    notify("Backend connection failed. Check that app.py is running.");
  }
}

async function saveTaskToBackend(task, isUpdate) {
  const url = isUpdate
    ? `http://127.0.0.1:5000/api/tasks/${task.id}`
    : "http://127.0.0.1:5000/api/tasks";

  const response = await fetch(url, {
    method: isUpdate ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task)
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Could not save task");
  }

  return result;
}

loadTasksFromBackend();

async function loadAIPredictions() {
  try {
    const response = await fetch(
    `/api/tasks/${id}`,
    );

    if (!response.ok) {
      throw new Error("Could not load AI predictions");
    }

    const predictions = await response.json();

    window.aiPredictions = predictions;
renderAll();
console.log("AI Predictions loaded:", predictions.length, "tasks");

  } catch (error) {
    console.error("AI prediction error:", error);
  }
}

loadAIPredictions();

