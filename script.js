// exams are assumed to be a global variable imported from exams.js
const grid = document.getElementById('routine-grid');
const mainCountdown = {
    days: document.getElementById('days'),
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds')
};
const nextExamElements = {
    code: document.getElementById('next-code'),
    name: document.getElementById('next-name')
};

// Parse exam dates into Date objects
window.exams.forEach(exam => {
    exam.dateObj = new Date(exam.datetime);
});

// Calculate current and next exams
function getExamStatus() {
    const now = new Date();
    let nextExam = null;
    let nextExamIndex = -1;

    for (let i = 0; i < window.exams.length; i++) {
        // If the exam is in the future
        if (window.exams[i].dateObj > now) {
            nextExam = window.exams[i];
            nextExamIndex = i;
            break;
        }
    }
    
    return { nextExam, nextExamIndex, now };
}

// Create Cards
function renderCards() {
    grid.innerHTML = '';
    const { now } = getExamStatus();

    window.exams.forEach((exam, index) => {
        const card = document.createElement('div');
        card.className = 'exam-card';
        card.style.animationDelay = `${index * 0.1}s`;

        const examDate = exam.dateObj;
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = examDate.toLocaleDateString('en-US', options);

        let statusClass = 'status-upcoming';
        let statusText = 'Upcoming';
        const diff = examDate - now;

        if (diff < 0) {
            // Check if it's currently running (assuming 4 hour exam duration)
            if (diff > -4 * 60 * 60 * 1000) {
                statusClass = 'status-today';
                statusText = 'Running';
            } else {
                statusClass = 'status-past';
                statusText = 'Completed';
            }
        } else if (diff < 24 * 60 * 60 * 1000 && now.getDate() === examDate.getDate()) {
            statusClass = 'status-today';
            statusText = 'Today';
        }

        card.innerHTML = `
            <div class="card-header">
                <div class="card-date">${dateStr}</div>
                <div class="card-code">${exam.code}</div>
            </div>
            <div class="card-name">${exam.name}</div>
            <div class="card-footer">
                <div class="card-time">01:30 PM</div>
                <div class="card-status ${statusClass}">${statusText}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function updateCountdown() {
    const { nextExam, now } = getExamStatus();

    if (nextExam) {
        const diff = nextExam.dateObj - now;

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);

        mainCountdown.days.innerText = d.toString().padStart(2, '0');
        mainCountdown.hours.innerText = h.toString().padStart(2, '0');
        mainCountdown.minutes.innerText = m.toString().padStart(2, '0');
        mainCountdown.seconds.innerText = s.toString().padStart(2, '0');

        if(nextExamElements.code.innerText !== nextExam.code) {
             nextExamElements.code.innerText = nextExam.code;
             nextExamElements.name.innerText = nextExam.name;
        }
    } else {
        // All exams finished
        mainCountdown.days.innerText = '00';
        mainCountdown.hours.innerText = '00';
        mainCountdown.minutes.innerText = '00';
        mainCountdown.seconds.innerText = '00';
        nextExamElements.code.innerText = "DONE";
        nextExamElements.name.innerText = "All exams completed!";
        
        // Hide the "Next Exam In" text
        const h3 = document.querySelector('.upcoming-exam h3');
        if (h3) h3.innerText = "Status";
    }
}

// Initial render
renderCards();
updateCountdown();

// Update every second
let secondsElapsed = 0;
setInterval(() => {
    updateCountdown();
    secondsElapsed++;
    // Re-render cards every 60 seconds to update status smoothly without flickering
    if (secondsElapsed % 60 === 0) {
        renderCards();
    }
}, 1000);
