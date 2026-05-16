// NorthStar UI Logic
const API_BASE = '/api';

// Track the currently selected project
let selectedProject = localStorage.getItem('northstar_selected_project') || '';

// DOM Elements
const visionText = document.getElementById('vision-text');
const successCriteriaList = document.getElementById('success-criteria-list');
const phaseBadge = document.getElementById('phase-badge');
const phaseName = document.getElementById('phase-name');
const phaseObjective = document.getElementById('phase-objective');
const progressBar = document.getElementById('progress-bar');
const progressPercentage = document.getElementById('progress-percentage');
const milestonesList = document.getElementById('milestones-list');
const phasesList = document.getElementById('phases-list');

const rulesCount = document.getElementById('rules-count');
const rulesList = document.getElementById('rules-list');

const decisionsCount = document.getElementById('decisions-count');
const decisionsList = document.getElementById('decisions-list');

const handoffContent = document.getElementById('handoff-content');

const scratchpadList = document.getElementById('scratchpad-list');
const constraintsList = document.getElementById('constraints-list');

// Fetch utility — appends ?project= if a project is selected
async function fetchAPI(endpoint) {
    try {
        let url = `${API_BASE}/${endpoint}`;
        if (selectedProject) {
            url += `?project=${encodeURIComponent(selectedProject)}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error('API Error');
        return await res.json();
    } catch (e) {
        console.error(`Failed to fetch ${endpoint}:`, e);
        return null;
    }
}


// Render Master Plan & Progress
function renderPlan(plan) {
    if (!plan || !plan.id) {
        visionText.innerHTML = '<span class="placeholder-text">No Master Plan initialized yet.</span>';
        successCriteriaList.innerHTML = '';
        phaseName.innerText = 'Waiting for plan...';
        phaseObjective.innerText = '';
        progressBar.style.width = '0%';
        progressPercentage.innerText = '0%';
        milestonesList.innerHTML = '';
        constraintsList.innerHTML = '<p class="placeholder-text">No constraints active.</p>';
        return;
    }

    // Vision
    visionText.innerText = plan.vision;
    
    // Success Criteria
    successCriteriaList.innerHTML = plan.successCriteria.map(c => 
        `<li><i class="ph ph-check-circle" style="color: var(--status-success)"></i> <span>${escapeHTML(c)}</span></li>`
    ).join('');

    // Phase & Milestones
    const activePhase = plan.phases.find(p => p.status === 'active') || plan.phases[0];
    
    if (activePhase) {
        phaseName.innerText = activePhase.name;
        phaseObjective.innerText = activePhase.objective;
        phaseBadge.innerText = activePhase.status.toUpperCase();
        phaseBadge.style.borderColor = activePhase.status === 'completed' ? 'var(--status-success)' : 'var(--accent-primary)';
        phaseBadge.style.color = activePhase.status === 'completed' ? 'var(--status-success)' : 'var(--accent-primary)';

        // Calculate progress for this phase
        const total = activePhase.milestones.length;
        const completed = activePhase.milestones.filter(m => m.status === 'completed').length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        progressBar.style.width = `${pct}%`;
        progressPercentage.innerText = `${pct}%`;

        // Milestones
        milestonesList.innerHTML = activePhase.milestones.map(m => {
            const isCompleted = m.status === 'completed';
            const icon = isCompleted ? 'ph-check-circle' : (m.status === 'in_progress' ? 'ph-spinner gap' : 'ph-circle');
            return `
                <li class="${m.status}">
                    <i class="ph ${icon}"></i>
                    <div>
                        <div style="font-weight: 500">${escapeHTML(m.description)}</div>
                    </div>
                </li>
            `;
        }).join('');
    }

    // Constraints
    if (plan.constraints && plan.constraints.length > 0) {
        constraintsList.innerHTML = plan.constraints.map(c => `
            <li>
                <div class="c-type">${escapeHTML(c.type)}</div>
                <div style="font-weight: 500; margin-top: 4px;">${escapeHTML(c.description)}</div>
                <div class="rule-rationale">${escapeHTML(c.rationale)}</div>
            </li>
        `).join('');
    } else {
        constraintsList.innerHTML = '<p class="placeholder-text">No constraints active.</p>';
    }
}

// Render Rules
function renderRules(rules) {
    if (!rules || rules.length === 0) {
        rulesCount.innerText = '0 Active';
        rulesList.innerHTML = '<p class="placeholder-text">No rules defined.</p>';
        return;
    }

    rulesCount.innerText = `${rules.length} Active`;
    
    rulesList.innerHTML = rules.map(r => `
        <div class="rule-card">
            <div class="rule-header">
                <span class="rule-desc">${escapeHTML(r.description)}</span>
                <span class="severity-${r.severity}">${r.severity}</span>
            </div>
            <div class="rule-rationale">${escapeHTML(r.rationale)}</div>
        </div>
    `).join('');
}

// Render Scratchpad
function renderScratchpad(entries) {
    if (!entries || entries.length === 0) {
        scratchpadList.innerHTML = '<p class="placeholder-text">Scratchpad is empty.</p>';
        return;
    }

    // Sort newest first
    const sorted = [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    scratchpadList.innerHTML = sorted.map(e => {
        const date = new Date(e.timestamp);
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
        
        return `
            <div class="timeline-entry">
                <div class="timeline-meta">
                    <span class="timeline-tag">${escapeHTML(e.tag)}</span>
                    <span class="timeline-time">${timeStr}</span>
                </div>
                <div class="timeline-content">${escapeHTML(e.content)}</div>
            </div>
        `;
    }).join('');
}

// Render All Phases (roadmap)
function renderPhases(plan) {
    if (!plan || !plan.phases || plan.phases.length === 0) {
        phasesList.innerHTML = '<p class="placeholder-text">No phases defined.</p>';
        return;
    }

    phasesList.innerHTML = plan.phases.map((phase, i) => {
        const total = phase.milestones.length;
        const done = phase.milestones.filter(m => m.status === 'completed').length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        const statusIcon = phase.status === 'completed' ? 'ph-check-circle'
            : phase.status === 'active' ? 'ph-play-circle' : 'ph-circle';
        const statusColor = phase.status === 'completed' ? 'var(--status-success)'
            : phase.status === 'active' ? 'var(--accent-primary)' : 'var(--text-muted)';

        return `
            <div class="phase-card ${phase.status}">
                <div class="phase-card-header">
                    <i class="ph ${statusIcon}" style="color: ${statusColor}; font-size: 1.2em;"></i>
                    <span class="phase-card-name">${escapeHTML(phase.name)}</span>
                    <span class="phase-card-pct">${pct}%</span>
                </div>
                <p class="phase-card-obj">${escapeHTML(phase.objective)}</p>
                <div class="phase-card-bar">
                    <div class="phase-card-fill" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Render Decisions Log
function renderDecisions(decisions) {
    if (!decisions || decisions.length === 0) {
        decisionsCount.innerText = '0';
        decisionsList.innerHTML = '<p class="placeholder-text">No decisions logged yet.</p>';
        return;
    }

    decisionsCount.innerText = String(decisions.length);

    // Sort newest first
    const sorted = [...decisions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    decisionsList.innerHTML = sorted.map(d => {
        const date = new Date(d.timestamp);
        const dateStr = `${date.toLocaleDateString()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        const impactClass = d.impact === 'high' ? 'impact-high' : d.impact === 'medium' ? 'impact-medium' : 'impact-low';

        return `
            <div class="decision-card">
                <div class="decision-header">
                    <span class="decision-question">${escapeHTML(d.question)}</span>
                    <span class="impact-badge ${impactClass}">${d.impact}</span>
                </div>
                <div class="decision-answer">
                    <i class="ph ph-arrow-bend-down-right"></i>
                    ${escapeHTML(d.decision)}
                </div>
                <div class="decision-rationale">${escapeHTML(d.rationale)}</div>
                <div class="decision-meta">${dateStr}</div>
            </div>
        `;
    }).join('');
}

// Render Handoff
function renderHandoff(handoff) {
    if (!handoff || !handoff.summary) {
        handoffContent.innerHTML = '<p class="placeholder-text">No handoff context available.</p>';
        return;
    }

    const date = new Date(handoff.timestamp);
    const dateStr = `${date.toLocaleDateString()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    let html = `<div class="handoff-summary">${escapeHTML(handoff.summary)}</div>`;

    if (handoff.brokenFeatures && handoff.brokenFeatures.length > 0) {
        html += `<div class="handoff-section">
            <h4><i class="ph ph-warning" style="color: var(--status-error)"></i> Broken Features</h4>
            <ul>${handoff.brokenFeatures.map(f => `<li>${escapeHTML(f)}</li>`).join('')}</ul>
        </div>`;
    }

    if (handoff.nextSteps && handoff.nextSteps.length > 0) {
        html += `<div class="handoff-section">
            <h4><i class="ph ph-arrow-right" style="color: var(--accent-primary)"></i> Next Steps</h4>
            <ul>${handoff.nextSteps.map(s => `<li>${escapeHTML(s)}</li>`).join('')}</ul>
        </div>`;
    }

    html += `<div class="handoff-meta">Last updated: ${dateStr}</div>`;
    handoffContent.innerHTML = html;
}

// Helper
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Main Connection Loop (SSE) — project-aware
let activeSSE = null;

function connectSSE() {
    if (activeSSE) {
        activeSSE.close();
    }

    let streamUrl = `${API_BASE}/stream`;
    if (selectedProject) {
        streamUrl += `?project=${encodeURIComponent(selectedProject)}`;
    }

    const evtSource = new EventSource(streamUrl);
    activeSSE = evtSource;

    evtSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') {
                document.body.classList.remove('offline');
            } else if (data.type === 'update' && data.state) {
                renderPlan(data.state.plan);
                renderPhases(data.state.plan);
                renderRules(data.state.rules);
                renderScratchpad(data.state.scratchpad);
                renderDecisions(data.state.decisions);
                renderHandoff(data.state.handoff);
            }
        } catch (e) {
            console.error('Error parsing SSE data:', e);
        }
    };

    evtSource.onerror = (err) => {
        console.error('SSE connection lost, reconnecting...');
        document.body.classList.add('offline');
        evtSource.close();
        setTimeout(connectSSE, 2000);
    };
}

// Project Discovery & Switcher
async function initProjects() {
    const projects = await fetch(`${API_BASE}/projects`).then(r => r.json()).catch(() => []);
    const select = document.getElementById('project-switcher');

    if (projects && projects.length > 0) {
        select.innerHTML = '';

        projects.forEach(proj => {
            const option = document.createElement('option');
            option.value = proj.path;
            option.innerText = proj.name;
            if (proj.path === selectedProject) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // If no project was previously selected, select the first one
        if (!selectedProject || !projects.find(p => p.path === selectedProject)) {
            selectedProject = projects[0].path;
            localStorage.setItem('northstar_selected_project', selectedProject);
            select.value = selectedProject;
        }

        select.addEventListener('change', (e) => {
            selectedProject = e.target.value;
            localStorage.setItem('northstar_selected_project', selectedProject);
            // Reconnect SSE and reload data for the new project
            connectSSE();
        });
    } else {
        select.innerHTML = '<option value="">No projects found</option>';
    }

    // Shutdown button
    document.getElementById('shutdown-btn').addEventListener('click', async () => {
        if (confirm("Are you sure you want to power off the NorthStar server?")) {
            document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0f172a; color:#fff; font-family:Inter, sans-serif;">
                    <i class="ph ph-power" style="font-size: 64px; color: #ef4444; margin-bottom: 20px;"></i>
                    <h2>Server Offline</h2>
                    <p style="color:#94a3b8; margin-top:10px;">NorthStar has been gracefully terminated.</p>
                </div>
            `;
            await fetch(`${API_BASE}/shutdown`, { method: 'POST' });
        }
    });
}

// Start
initProjects().then(() => connectSSE());

