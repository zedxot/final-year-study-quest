/* =============== STUDY QUEST 4.0 LOGIC & FILTERING =============== */

const STATE_KEY = 'studyQuest_savedProgress';
let questState = {
    exp: 0,
    level: 1,
    completedQuestions: []
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

// 2. Strict Filtering Engine
function bindExamsToData(jsonList) {
    const now = new Date();
    activeData = [];
    
    window.exams.forEach(examConfig => {
        const examDate = new Date(examConfig.datetime);
        const diffDays = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0) {
            const cleanConfig = examConfig.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
            const targetFiles = jsonList.filter(j => 
                j.subject && j.subject.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '').includes(cleanConfig)
            );
            
            if (targetFiles.length > 0) {
                let filteredQ = [];
                
                targetFiles.forEach(target => {
                    if (target.chapters) {
                        target.chapters.forEach(c => {
                            if (c.questions) {
                                // Array for sorting strictly within the chapter
                                const chapterQuestions = [];
                                
                                c.questions.forEach(q => {
                                    const yList = q.years || [];
                                    
                                    // RULE 1: BAN
                                    const has2023 = yList.some(y => typeof y === 'string' && (y.includes('২০২৩') || y.includes('2023')));
                                    if (has2023) return; // Immediate skip
                                    
                                    // RULE 2: PRIORITY
                                    const isHot = yList.some(y => typeof y === 'string' && (y.includes('২০২০') || y.includes('2020') || y.includes('২০২২') || y.includes('2022')));
                                    const isSug = q.is_suggested === true || q.is_suggested === "true";
                                    
                                    if (isHot) {
                                        chapterQuestions.push({...q, chapter: c.chapter_name, prio: 1});
                                    } else if (isSug) {
                                        chapterQuestions.push({...q, chapter: c.chapter_name, prio: 2});
                                    }
                                });
                                
                                // Push highest priority first, ensuring they are at the top of the chapter slice!
                                chapterQuestions.sort((a,b) => a.prio - b.prio);
                                filteredQ.push(...chapterQuestions);
                            }
                        });
                    }
                });
                
                activeData.push({
                    id: examConfig.code,
                    name: examConfig.name,
                    daysLeft: diffDays === 0 ? 1 : diffDays,
                    totalQuestions: filteredQ
                });
            }
        }
    });
}

// 3. UI Generation (Hierarchical)
window.activeBounties = {};

function compileSyllabus() {
    window.activeBounties = {};
    let htmlContent = '';
    
    let totalAssigned = 0;
    let totalCleared = 0;
    
    let globalTotal = 0;
    let globalCompleted = 0;

    activeData.forEach(data => {
        const prefix = `${data.id}_`;
        
        const uncompleted = data.totalQuestions.filter(q => !questState.completedQuestions.includes(prefix + q.q_id));
        const completedCount = data.totalQuestions.length - uncompleted.length;
        
        globalTotal += data.totalQuestions.length;
        globalCompleted += completedCount;
        
        if (uncompleted.length === 0) return; // Mastered
        
        // Exact Quota slice
        const dailyQuota = Math.ceil(uncompleted.length / data.daysLeft);
        const todayAssigned = uncompleted.slice(0, Math.max(1, dailyQuota)); // Always minimum 1 if not mastered
        
        // Group extracted quests rigidly by Chapter
        const groupedByChapter = {};
        
        // Before allocating JSON questions, inject a Generic Book Task for each unique chapter in the Slice!
        const todayChapters = [...new Set(todayAssigned.map(q => q.chapter))];
        todayChapters.forEach(chap => {
            const bId = `PartA-${btoa(unescape(encodeURIComponent(chap))).substring(0,8)}`;
            groupedByChapter[chap] = [{
                q_id: bId,
                text: `Book Study: <strong>Complete Part A (Brief Questions)</strong>`,
                expReward: 20,
                isGeneric: true,
                prio: 'generic'
            }];
        });

        // Push actual JSON questions into groups
        todayAssigned.forEach(q => {
            if (!groupedByChapter[q.chapter]) groupedByChapter[q.chapter] = [];
            q.expReward = (q.prio === 1) ? 50 : 30; // Priority 1 are worth more!
            groupedByChapter[q.chapter].push(q);
        });

        // Render Subject Block
        htmlContent += `
            <div class="subject-block">
                <div class="subject-header">
                    ${data.name} <span class="badge">${data.daysLeft} Days Left</span>
                </div>
        `;

        // Render Chapter Blocks
        for (const [chapName, qs] of Object.entries(groupedByChapter)) {
            htmlContent += `<div class="chapter-block"><div class="chapter-title"><i class="fa-solid fa-layer-group"></i> ${chapName}</div>`;
            
            qs.forEach(q => {
                const uniqueId = prefix + q.q_id;
                const isCompleted = questState.completedQuestions.includes(uniqueId);
                
                totalAssigned++;
                if (isCompleted) totalCleared++;
                else {
                    window.activeBounties[uniqueId] = { exp: q.expReward };
                    
                    const prioText = (q.prio === 1) ? 'P-1 / 2020|22' : (q.prio === 2) ? 'P-2 / Suggested' : 'Required';
                    const tagClass = (q.prio === 1) ? 'p-1' : (q.prio === 2) ? 'p-2' : 'p-g';
                    
                    htmlContent += `
                        <div class="quest-row" data-prio="${q.prio}" id="row_${uniqueId}">
                            <div class="quest-content">
                                <div class="quest-meta">
                                    <span class="tag-prio ${tagClass}">${prioText}</span>
                                    <span class="q-exp">+${q.expReward} EXP</span>
                                </div>
                                ${q.text}
                            </div>
                            <button class="quest-btn" onclick="window.claimBounty('${uniqueId}')">
                                <i class="fa-solid fa-check"></i>
                            </button>
                        </div>
                    `;
                }
            });
            htmlContent += `</div>`; // Close Chapter
        }
        
        htmlContent += `</div>`; // Close Subject
    });

    els.statActive.innerText = totalAssigned - totalCleared;
    els.statCleared.innerText = totalCleared;
    
    // Global Readout
    const gPct = globalTotal > 0 ? (globalCompleted / globalTotal) * 100 : 0;
    els.globalBar.style.width = `${gPct}%`;
    els.globalStats.innerText = `${gPct.toFixed(1)}%`;
    
    if (htmlContent === '') htmlContent = `<div class="loading-state"><h2>Syllabus Mastered</h2><p>All filtered nodes cleared.</p></div>`;
    els.grid.innerHTML = htmlContent;
    
    // MATHJAX BOOTSTRAP: Absolutely guarantee execution AFTER injection!
    if (window.MathJax) {
        if (window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([els.grid]).catch(err => console.log('MathJax error', err));
        } else {
            setTimeout(() => {
                if (window.MathJax.typesetPromise) window.MathJax.typesetPromise([els.grid]).catch(e => console.error(e));
            }, 500);
        }
    }
    
    updateHud();
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
