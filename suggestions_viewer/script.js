const state = {
    questions: [],
    subjects: new Set(),
    subjectChapters: {}, 
    years: new Set(),
    filters: {
        subject: 'all',
        chapter: 'all',
        search: '',
        years: new Set(),
        suggestedOnly: false
    },
    loading: true
};

const els = {
    container: document.getElementById('questions-container'),
    subjectSelect: document.getElementById('subject-select'),
    chapterSelect: document.getElementById('chapter-select'),
    yearFilters: document.getElementById('year-filters'),
    search: document.getElementById('search-input'),
    suggestedToggle: document.getElementById('suggested-toggle'),
    resultCount: document.getElementById('result-count')
};

// Initialization
async function init() {
    await loadData();
    setupEventListeners();
}

// Fetch all 10 JSON files
async function loadData() {
    try {
        const fetchPromises = [];
        for (let i = 1; i <= 10; i++) {
            const url = `../suggestions/Suggestions Database Pt${i}.json`;
            fetchPromises.push(
                fetch(url).then(r => {
                    if (r.ok) return r.json();
                    return null;
                }).catch(() => null)
            );
        }

        const results = await Promise.all(fetchPromises);
        const validResults = results.filter(Boolean);
        
        if (validResults.length === 0) {
            throw new Error("No data loaded");
        }

        processRawData(validResults);
        state.loading = false;
        
        populateFilters();
        render();

    } catch (e) {
        console.error("Data loading failed", e);
        els.container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <h3>Error Loading Database</h3>
                <p style="margin-top: 8px;">Please ensure you are loading this through a web server (like GitHub Pages or localhost) to avoid CORS issues.</p>
            </div>
        `;
    }
}

function processRawData(dataArrays) {
    dataArrays.forEach(subjectData => {
        if (!subjectData || !subjectData.subject) return;
        
        const subject = subjectData.subject;
        state.subjects.add(subject);
        if (!state.subjectChapters[subject]) {
            state.subjectChapters[subject] = new Set();
        }
        
        if (Array.isArray(subjectData.chapters)) {
            subjectData.chapters.forEach(chapter => {
                const chapterName = chapter.chapter_name;
                state.subjectChapters[subject].add(chapterName);
                
                if (Array.isArray(chapter.questions)) {
                    chapter.questions.forEach(q => {
                        const qObj = {
                            subject: subject,
                            chapter: chapterName,
                            id: q.q_id,
                            text: q.text,
                            years: q.years || [],
                            suggested: q.is_suggested || false
                        };
                        
                        qObj.years.forEach(y => {
                            if (y && y.trim() !== '') state.years.add(y.trim());
                        });
                        
                        state.questions.push(qObj);
                    });
                }
            });
        }
    });

    // Sort years alphabetically for badges
    state.years = Array.from(state.years).sort();
}

function populateFilters() {
    // Subject Dropdown
    state.subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject;
        option.textContent = subject;
        els.subjectSelect.appendChild(option);
    });

    // Year Badges (limiting to top 30 to not overwhelm UI if too many variations exist)
    // Actually, showing all unique could be large. Let's just create badges for everything.
    els.yearFilters.innerHTML = '';
    state.years.forEach(year => {
        const badge = document.createElement('span');
        badge.className = 'filter-badge';
        badge.textContent = year;
        badge.dataset.year = year;
        
        badge.addEventListener('click', () => {
            if (state.filters.years.has(year)) {
                state.filters.years.delete(year);
                badge.classList.remove('active');
            } else {
                state.filters.years.add(year);
                badge.classList.add('active');
            }
            render();
        });
        
        els.yearFilters.appendChild(badge);
    });
}

function updateChapterDropdown() {
    els.chapterSelect.innerHTML = '<option value="all">All Chapters</option>';
    const selectedSubject = state.filters.subject;
    
    if (selectedSubject === 'all') {
        els.chapterSelect.disabled = true;
    } else {
        els.chapterSelect.disabled = false;
        const chapters = Array.from(state.subjectChapters[selectedSubject] || []);
        chapters.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter;
            option.textContent = chapter;
            els.chapterSelect.appendChild(option);
        });
    }
    
    // Reset chapter filter
    state.filters.chapter = 'all';
    els.chapterSelect.value = 'all';
}

function setupEventListeners() {
    els.subjectSelect.addEventListener('change', (e) => {
        state.filters.subject = e.target.value;
        updateChapterDropdown();
        render();
    });

    els.chapterSelect.addEventListener('change', (e) => {
        state.filters.chapter = e.target.value;
        render();
    });

    els.search.addEventListener('input', (e) => {
        state.filters.search = e.target.value.toLowerCase();
        render();
    });

    els.suggestedToggle.addEventListener('change', (e) => {
        state.filters.suggestedOnly = e.target.checked;
        render();
    });
}

function getFilteredQuestions() {
    return state.questions.filter(q => {
        // Subject match
        if (state.filters.subject !== 'all' && q.subject !== state.filters.subject) return false;
        
        // Chapter match
        if (state.filters.chapter !== 'all' && q.chapter !== state.filters.chapter) return false;
        
        // Suggested match
        if (state.filters.suggestedOnly && !q.suggested) return false;
        
        // Years match (if any year filters selected, question must have AT LEAST ONE of selected years)
        if (state.filters.years.size > 0) {
            const hasMatchingYear = q.years.some(y => state.filters.years.has(y.trim()));
            if (!hasMatchingYear) return false;
        }

        // Search match
        if (state.filters.search) {
            const searchStr = state.filters.search;
            const matchText = q.text.toLowerCase().includes(searchStr);
            const matchId = q.id.toLowerCase().includes(searchStr);
            if (!matchText && !matchId) return false;
        }

        return true;
    });
}

function render() {
    const filtered = getFilteredQuestions();
    els.resultCount.textContent = filtered.length;
    
    if (filtered.length === 0) {
        els.container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <h3>No Questions Found</h3>
                <p>Try adjusting your search or filters.</p>
            </div>
        `;
        return;
    }

    // Use fragment for performance
    const fragment = document.createDocumentFragment();
    
    // We limit rendering to 200 items max to avoid browser freeze with heavy MathJax
    // since some queries might match 1000s of items.
    const renderLimit = Math.min(filtered.length, 250);
    
    for (let i = 0; i < renderLimit; i++) {
        const q = filtered[i];
        
        const card = document.createElement('div');
        card.className = `question-card ${q.suggested ? 'suggested' : ''}`;
        
        // Years html
        const yearsHtml = q.years.map(y => `<span class="year-tag">${y}</span>`).join('');
        
        card.innerHTML = `
            <div class="card-header">
                <span class="qid">${q.id}</span>
                ${q.suggested ? '<span class="suggested-badge"><i class="fa-solid fa-star"></i> Suggested</span>' : ''}
            </div>
            <div class="question-text">${q.text}</div>
            <div class="card-footer">
                <div class="breadcrumb">
                    <span title="Subject"><i class="fa-solid fa-book"></i> ${q.subject}</span>
                    <span title="Chapter"><i class="fa-solid fa-bookmark"></i> ${q.chapter}</span>
                </div>
                <div class="years-list">
                    ${yearsHtml}
                </div>
            </div>
        `;
        
        fragment.appendChild(card);
    }
    
    if (filtered.length > 250) {
        const warning = document.createElement('div');
        warning.style.textAlign = 'center';
        warning.style.color = 'var(--text-secondary)';
        warning.style.padding = '20px';
        warning.innerHTML = `<em>Showing first 250 results. Please narrow your search for more specific results.</em>`;
        fragment.appendChild(warning);
    }

    els.container.innerHTML = '';
    els.container.appendChild(fragment);

    // Trigger MathJax re-render for the newly inserted elements
    if (window.MathJax) {
        MathJax.typesetPromise([els.container]).catch((err) => console.log('MathJax typeset error:', err));
    }
}

// Start
init();
