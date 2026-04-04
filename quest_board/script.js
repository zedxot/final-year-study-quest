/* =============== STUDY QUEST 4.0: CHAPTER-LOGIC =============== */

const STATE_KEY = 'studyQuest_savedProgress';
let questState = {
    exp: 0,
    level: 1,
    completedQuestions: [] // Still stores IDs, but now they represent generic chapter synthetic tasks
};

let activeData = [];

const els = {
    expFill: document.getElementById('hudExpFill'),
    levelBadge: document.getElementById('hudLevelBadge'),
    expText: document.getElementById('hudExpText'),
    globalBar: document.getElementById('hudGlobalBar'),
    globalStats: document.getElementById('hudGlobalStats'),
    statActive: document.getElementById('statActive'),
    statCleared: document.getElementById('statCleared'),
    grid: document.getElementById('bountyGrid')
};

async function bootSystem() {
    loadState();
    
    try {
        const fetchPromises = [];
        for (let i = 1; i <= 10; i++) {
            fetchPromises.push(
                fetch(`../suggestions/Suggestions Database Pt${i}.json`).then(r => r.ok ? r.json() : null).catch(() => null)
            );
        }
        const results = await Promise.all(fetchPromises);
        const validResults = results.filter(Boolean);
        
        if (validResults.length === 0) throw new Error("No database connected.");
        
        bindExamsToData(validResults);
        compileSyllabus();
        
    } catch (e) {
        console.error(e);
        els.grid.innerHTML = `<div class="loading-state"><h2>Database Link Failed</h2><p>Are you running the local port mapping?</p></div>`;
    }
}

function loadState() {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
        questState = JSON.parse(saved);
        while (questState.exp >= questState.level * 100) {
            questState.exp -= questState.level * 100;
            questState.level += 1;
        }
    }
}

function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(questState));
}

// 2. Chapter Extraction Engine
function bindExamsToData(jsonList) {
    const now = new Date();
    // Reset time perfectly to midnight to prevent timezone/hour shifting mid-day logic bugs
    now.setHours(0,0,0,0); 
    
    activeData = [];
    
    window.exams.forEach(examConfig => {
        const examDate = new Date(examConfig.datetime);
        examDate.setHours(0,0,0,0);
        
        const diffDays = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
        
        // Critical: Purges subjects after the exam date has passed
        if (diffDays >= 0) {
            const cleanConfig = examConfig.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
            const targetFiles = jsonList.filter(j => 
                j.subject && j.subject.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '').includes(cleanConfig)
            );
            
            if (targetFiles.length > 0) {
                let subjectChapters = [];
                
                targetFiles.forEach(target => {
                    if (target.chapters) {
                        target.chapters.forEach(c => {
                            // Validate the chapter has content to defend against empty JSON blocks
                            if (c.questions && c.questions.length > 0) {
                                if (!subjectChapters.includes(c.chapter_name)) {
                                    subjectChapters.push(c.chapter_name);
                                }
                            }
                        });
                    }
                });
                
                if (subjectChapters.length > 0) {
                    activeData.push({
                        id: examConfig.code,
                        name: examConfig.name,
                        daysLeft: diffDays === 0 ? 1 : diffDays,
                        totalChapters: subjectChapters
                    });
                }
            }
        }
    });
}

// 3. UI Generation (Chapter Quotas)
window.activeBounties = {};

function compileSyllabus() {
    window.activeBounties = {};
    let htmlContent = '';
    let progressionHTML = '';
    
    let totalAssigned = 0;
    let totalCleared = 0;
    
    let globalTotal = 0;
    let globalCompleted = 0;

    activeData.forEach(data => {
        const prefix = `${data.id}_`;
        
        let studyPipeline = [];
        let revisionPipeline = [];
        let subjCompletedTasks = 0;
        let subjTotalTasks = data.totalChapters.length * 3;
        
        // Step A: Calculate which chapters still require work and tally global stats
        data.totalChapters.forEach(chap => {
            const chapSafe = btoa(unescape(encodeURIComponent(chap))).substring(0, 20);
            const qA = `${prefix}${chapSafe}_A`;
            const qB = `${prefix}${chapSafe}_B`;
            const qR = `${prefix}${chapSafe}_R`;
            
            const isAComplete = questState.completedQuestions.includes(qA);
            const isBComplete = questState.completedQuestions.includes(qB);
            const isRComplete = questState.completedQuestions.includes(qR);
            
            globalTotal += 3;
            if (isAComplete) { globalCompleted++; subjCompletedTasks++; }
            if (isBComplete) { globalCompleted++; subjCompletedTasks++; }
            if (isRComplete) { globalCompleted++; subjCompletedTasks++; }
            
            const studyDone = isAComplete && isBComplete;
            
            if (!studyDone) {
                studyPipeline.push({ name: chap, qA, qB, qR, isAComplete, isBComplete, isRComplete, type: 'study' });
            } else if (!isRComplete) {
                revisionPipeline.push({ name: chap, qA, qB, qR, isAComplete, isBComplete, isRComplete, type: 'revise' });
            }
        });
        
        // Build Progression UI
        const subProgPercent = subjTotalTasks > 0 ? (subjCompletedTasks / subjTotalTasks) * 100 : 0;
        progressionHTML += `
            <div class="progression-item">
                <div class="pi-header">
                    <span class="pi-name">${data.name}</span>
                    <span>${Math.round(subProgPercent)}%</span>
                </div>
                <div class="pi-bar-wrapper">
                    <div class="pi-bar-fill" style="width: ${subProgPercent}%"></div>
                </div>
            </div>
        `;

        if (studyPipeline.length === 0 && revisionPipeline.length === 0) return; // Mastered
        
        // Step B: 2-Phase Decoupling Engine
        let todayAssigned = [];
        
        if (data.daysLeft > 3) {
            // STUDY PHASE
            if (studyPipeline.length > 0) {
                const q = Math.ceil(studyPipeline.length / (data.daysLeft - 3));
                todayAssigned = studyPipeline.slice(0, Math.max(1, q));
            } else {
                // Ahead of schedule -> Early Revision Phase
                const q = Math.ceil(revisionPipeline.length / data.daysLeft);
                todayAssigned = revisionPipeline.slice(0, Math.max(1, q));
            }
        } else {
            // CONSTRICTED REVISION PHASE
            const sQ = Math.ceil(studyPipeline.length / Math.max(1, data.daysLeft));
            const rQ = Math.ceil(revisionPipeline.length / Math.max(1, data.daysLeft));
            todayAssigned = [
                ...studyPipeline.slice(0, Math.max(0, sQ)),
                ...revisionPipeline.slice(0, Math.max(0, rQ)) // changed 1 to 0 to prevent forced if array is empty
            ];
            if (todayAssigned.length === 0 && revisionPipeline.length > 0) {
                 todayAssigned = [revisionPipeline[0]];
            }
        }
        
        // Render Context Layer
        htmlContent += `
            <div class="subject-block">
                <div class="subject-header">
                    ${data.name} <span class="badge">${data.daysLeft} Days Left</span>
                </div>
        `;

        // Render Assigned Chapter Blocks
        todayAssigned.forEach(chapObj => {
            htmlContent += `<div class="chapter-block"><div class="chapter-title"><i class="fa-solid fa-layer-group"></i> ${chapObj.name}</div>`;
            
            // Study Assignments
            if (!chapObj.isAComplete) {
                totalAssigned++;
                window.activeBounties[chapObj.qA] = { exp: 20 };
                htmlContent += buildQuestRow(chapObj.qA, `Book Study: <strong>Complete Part A (Brief Questions)</strong>`, "Required", "p-g", 20, "generic");
            } else {
                totalCleared++;
            }
            
            if (!chapObj.isBComplete) {
                totalAssigned++;
                window.activeBounties[chapObj.qB] = { exp: 50 };
                htmlContent += buildQuestRow(chapObj.qB, `Important Questions: <strong>Complete Part B & C (2020, 2022, Suggested)</strong>`, "Priority 1-2", "p-1", 50, "1");
            } else {
                totalCleared++;
            }
            
            // Revision Assignments (Only if in revision phase OR already past study phase)
            if (data.daysLeft <= 3 || chapObj.type === 'revise') {
                if (!chapObj.isRComplete) {
                    totalAssigned++;
                    window.activeBounties[chapObj.qR] = { exp: 30 };
                    htmlContent += buildQuestRow(chapObj.qR, `Final Review: <strong>Revise all chapter questions</strong>`, "Revision", "p-2", 30, "2");
                } else {
                    totalCleared++;
                }
            } else {
                // If we forcefully skip rendering it today, we don't count it towards totalCleared *for today's session readout*
            }
            
            htmlContent += `</div>`; // Close Chapter Div
        });
        
        htmlContent += `</div>`; // Close Subject Div
    });

    els.statActive.innerText = totalAssigned;
    els.statCleared.innerText = parseInt(els.statCleared.innerText) || 0; 
    
    // Global Readout
    const progContainer = document.getElementById('subjectProgressionList');
    if (progContainer) progContainer.innerHTML = progressionHTML;
    const gPct = globalTotal > 0 ? (globalCompleted / globalTotal) * 100 : 0;
    els.globalBar.style.width = `${gPct}%`;
    els.globalStats.innerText = `${gPct.toFixed(1)}%`;
    
    if (htmlContent === '') htmlContent = `<div class="loading-state"><h2>Syllabus Mastered</h2><p>Preparation algorithm complete. Ready for exam.</p></div>`;
    els.grid.innerHTML = htmlContent;
    
    updateHud();
}

function buildQuestRow(id, content, badgeText, badgeClass, expReward, dataPrio) {
    return `
        <div class="quest-row" data-prio="${dataPrio}" id="row_${id}">
            <div class="quest-content">
                <div class="quest-meta">
                    <span class="tag-prio ${badgeClass}">${badgeText}</span>
                    <span class="q-exp">+${expReward} EXP</span>
                </div>
                ${content}
            </div>
            <button class="quest-btn" onclick="window.claimBounty('${id}')">
                <i class="fa-solid fa-check"></i>
            </button>
        </div>
    `;
}

// 4. Invulnerable State Mutations
window.claimBounty = function(uniqueId) {
    const bounty = window.activeBounties[uniqueId];
    if (!bounty) return; // Prevent double trigger
    
    // UI Updates
    const row = document.getElementById(`row_${uniqueId}`);
    if (row) {
        row.classList.add('claimed');
        row.querySelector('.quest-btn').innerHTML = `<i class="fa-solid fa-check-double"></i>`;
        row.removeAttribute('onclick');
    }
    
    // Mechanics
    questState.completedQuestions.push(uniqueId);
    questState.exp += bounty.exp;
    delete window.activeBounties[uniqueId];
    
    // Live Stats
    els.statActive.innerText = Math.max(0, parseInt(els.statActive.innerText) - 1);
    els.statCleared.innerText = parseInt(els.statCleared.innerText) + 1;
    
    // Global Bar Live Update Override
    const gbarValueStr = els.globalStats.innerText.replace('%', '');
    let theoreticalPercent = (parseFloat(gbarValueStr) || 0) + 0.1; // small optical bump just for visual feedback
    els.globalBar.style.width = `${Math.min(100, theoreticalPercent)}%`;
    
    const required = questState.level * 100;
    if (questState.exp >= required) {
        questState.exp -= required;
        questState.level += 1;
        triggerLevelUp();
    }
    
    saveState();
    updateHud();
};

function updateHud() {
    els.levelBadge.innerText = `LVL ${questState.level}`;
    const required = questState.level * 100;
    els.expText.innerText = `${questState.exp} / ${required} EXP`;
    
    const percent = Math.min(100, Math.max(0, (questState.exp / required) * 100));
    els.expFill.style.width = `${percent}%`;
}

function triggerLevelUp() {
    const overlay = document.getElementById('levelUpOverlay');
    const badge = document.getElementById('levelUpNumber');
    badge.innerText = `LVL ${questState.level}`;
    overlay.classList.add('active');
    setTimeout(() => overlay.classList.remove('active'), 2000);
}

// Admin Utils
window.clearCacheAndReset = function() {
    if (confirm("WARNING: Wipe all campaign data? This cannot be undone.")) {
        localStorage.removeItem(STATE_KEY);
        location.reload();
    }
};

window.onload = bootSystem;
