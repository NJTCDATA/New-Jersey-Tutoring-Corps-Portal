/* ============================================================================
   NJTC PORTAL - PREMIUM JAVASCRIPT
   New Jersey Tutoring Corps - Hub for Onsite Staff
   ============================================================================ */

// INSPIRATIONAL QUOTES FOR EDUCATORS
const inspirationalQuotes = [
    { quote: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    { quote: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
    { quote: "Every child deserves a champion—an adult who will never give up on them.", author: "Rita Pierson" },
    { quote: "Teaching is not a lost art, but the regard for it is a lost tradition.", author: "Jacques Barzun" },
    { quote: "The mediocre teacher tells. The good teacher explains. The superior teacher demonstrates. The great teacher inspires.", author: "William Arthur Ward" },
    { quote: "Education is not the filling of a pail, but the lighting of a fire.", author: "William Butler Yeats" },
    { quote: "What we learn with pleasure, we never forget.", author: "Alfred Mercier" },
    { quote: "The best teachers are those who show you where to look but don't tell you what to see.", author: "Alexandra K. Trenfor" },
    { quote: "Every student can learn, just not on the same day, or in the same way.", author: "George Evans" },
    { quote: "A teacher affects eternity; they can never tell where their influence stops.", author: "Henry Adams" },
    { quote: "High expectations are the key to everything.", author: "Sam Walton" },
    { quote: "I never teach my pupils. I only attempt to provide conditions in which they can learn.", author: "Albert Einstein" },
    { quote: "The art of teaching is the art of assisting discovery.", author: "Mark Van Doren" },
    { quote: "It is the supreme art of the teacher to awaken joy in creative expression and knowledge.", author: "Albert Einstein" },
    { quote: "Education is not preparation for life; education is life itself.", author: "John Dewey" }
];

// PLATFORM GUIDES
const platformGuides = {
    connor: {
        title: "Ask Connor Guide",
        content: `
            <div class="guide-section">
                <h3>🎯 What is Ask Connor?</h3>
                <p>Your 24/7 knowledge base assistant. Connor helps you find instant answers to program questions, best practices, and support resources.</p>
            </div>
            
            <div class="guide-section">
                <h3>📚 How to Use</h3>
                <ol>
                    <li><strong>Select Your Role:</strong> Choose Tutor, Coach, or Site Lead to see relevant content</li>
                    <li><strong>Browse Categories:</strong> Explore topics like i-Ready, PEARL, Attendance, Behavior Management</li>
                    <li><strong>Search Questions:</strong> Use the search bar to find specific answers quickly</li>
                    <li><strong>Request Assistance:</strong> Click the gold button if you need immediate onsite support</li>
                </ol>
            </div>
            
            <div class="guide-section">
                <h3>✨ Best Practices</h3>
                <ul>
                    <li><strong>Start Here:</strong> Check Connor before reaching out to leadership</li>
                    <li><strong>Bookmark Favorites:</strong> Save frequently-used questions for quick access</li>
                    <li><strong>Provide Feedback:</strong> Let us know if answers are helpful or need improvement</li>
                    <li><strong>Submit Requests:</strong> Use the feedback form for urgent support needs</li>
                </ul>
            </div>
            
            <div class="guide-section guide-highlight">
                <h3>🚨 When to Use</h3>
                <p><strong>Before your session:</strong> Review best practices and program expectations</p>
                <p><strong>During challenges:</strong> Quick answers for behavior management or engagement strategies</p>
                <p><strong>For data questions:</strong> Understanding i-Ready color bands and progress monitoring</p>
            </div>
        `
    },
    
    progress: {
        title: "Progress Monitoring Guide",
        content: `
            <div class="guide-section">
                <h3>🎯 What is Progress Monitoring?</h3>
                <p>Your data dashboard for tracking student growth, attendance, and program impact. Data drives high-impact tutoring.</p>
            </div>
            
            <div class="guide-section">
                <h3>📊 Key Features</h3>
                <ol>
                    <li><strong>Student Progress:</strong> View individual growth trajectories and achievement data</li>
                    <li><strong>Attendance Tracking:</strong> Monitor participation rates and identify trends</li>
                    <li><strong>Impact Visualizations:</strong> See program effectiveness through charts and graphs</li>
                    <li><strong>Weekly Snapshots:</strong> Track progress week-over-week for data-driven decisions</li>
                </ol>
            </div>
            
            <div class="guide-section">
                <h3>✨ Best Practices</h3>
                <ul>
                    <li><strong>Weekly Review:</strong> Check data every Monday to plan your week</li>
                    <li><strong>Celebrate Wins:</strong> Share student progress with them and celebrate growth</li>
                    <li><strong>Identify Gaps:</strong> Use data to spot students who need additional support</li>
                    <li><strong>Document Patterns:</strong> Note trends to inform instructional adjustments</li>
                </ul>
            </div>
            
            <div class="guide-section guide-highlight">
                <h3>📈 Data-Driven Tutoring</h3>
                <p><strong>Goal:</strong> ≥90% attendance + 30-45 min sessions = Maximum impact</p>
                <p><strong>Strategy:</strong> Use i-Ready color bands + weekly progress data to differentiate instruction</p>
                <p><strong>Action:</strong> Review data → Adjust instruction → Monitor impact → Repeat</p>
            </div>
        `
    },
    
    pearl: {
        title: "PEARL Guide - Operations Hub",
        content: `
            <div class="guide-section">
                <h3>🎯 What is PEARL?</h3>
                <p>Your operational headquarters. Log attendance, submit surveys, track hours, and manage all program operations.</p>
            </div>
            
            <div class="guide-section">
                <h3>📅 Daily Tasks</h3>
                <ol>
                    <li><strong>Log In Daily:</strong> Access PEARL at the start of each session</li>
                    <li><strong>Mark Attendance:</strong> Record student attendance within 24 hours (REQUIRED)</li>
                    <li><strong>Submit Exit Surveys:</strong> Complete session surveys before leaving (REQUIRED)</li>
                    <li><strong>Track Hours:</strong> Ensure your hours are accurately recorded for payroll</li>
                </ol>
            </div>
            
            <div class="guide-section">
                <h3>✨ PEARL Best Practices</h3>
                <ul>
                    <li><strong>Attendance = Critical:</strong> ≥90% attendance drives program success</li>
                    <li><strong>Same-Day Logging:</strong> Log attendance immediately after each session</li>
                    <li><strong>Accurate Data:</strong> Double-check student names and dates</li>
                    <li><strong>Survey Completion:</strong> Your feedback improves program quality</li>
                    <li><strong>Technical Issues:</strong> Contact onsite leader immediately if PEARL is down</li>
                </ul>
            </div>
            
            <div class="guide-section guide-highlight">
                <h3>⚠️ Critical Reminders</h3>
                <p><strong>Attendance Deadline:</strong> Within 24 hours of session completion</p>
                <p><strong>Survey Deadline:</strong> Before leaving site each day</p>
                <p><strong>Data Accuracy:</strong> Errors affect student support and program funding</p>
                <p><strong>Support Available:</strong> Onsite leader for immediate help, Program Manager for technical issues</p>
            </div>
            
            <div class="guide-section">
                <h3>🚨 Common Issues & Solutions</h3>
                <ul>
                    <li><strong>Can't find student:</strong> Verify spelling, check with onsite leader</li>
                    <li><strong>Attendance already logged:</strong> Contact onsite leader to update</li>
                    <li><strong>System error:</strong> Screenshot error, notify onsite leader immediately</li>
                    <li><strong>Forgot to log:</strong> Log ASAP, note in comments if late</li>
                </ul>
            </div>
        `
    },
    
    iready: {
        title: "i-Ready Guide - Academic Platform",
        content: `
            <div class="guide-section">
                <h3>🎯 What is i-Ready?</h3>
                <p>Your academic data platform. Access student diagnostic data, color bands, and personalized learning paths. Data drives instruction.</p>
            </div>
            
            <div class="guide-section">
                <h3>📊 Understanding Color Bands</h3>
                <div class="color-bands">
                    <div class="band-item band-red">
                        <strong>🔴 Red (3+ grades behind):</strong> Focus on foundational skills, concrete examples, frequent check-ins
                    </div>
                    <div class="band-item band-yellow">
                        <strong>🟡 Yellow (1-2 grades behind):</strong> Build confidence, fill specific gaps, connect to grade-level content
                    </div>
                    <div class="band-item band-green">
                        <strong>🟢 Green (On grade level):</strong> Challenge with enrichment, maintain growth, encourage deeper thinking
                    </div>
                    <div class="band-item band-blue">
                        <strong>🔵 Blue (Above grade level):</strong> Advanced challenges, independent projects, mentor opportunities
                    </div>
                </div>
            </div>
            
            <div class="guide-section">
                <h3>✨ Best Practices by Color Band</h3>
                <ul>
                    <li><strong>Red Band Strategy:</strong> 80% foundational skills + 20% grade-level exposure. Use manipulatives, visuals, and multiple representations</li>
                    <li><strong>Yellow Band Strategy:</strong> 60% skill building + 40% grade-level content. Bridge gaps while building confidence</li>
                    <li><strong>Green Band Strategy:</strong> 80% grade-level + 20% enrichment. Maintain momentum and prevent regression</li>
                    <li><strong>Blue Band Strategy:</strong> Advanced problem-solving, real-world applications, leadership opportunities</li>
                </ul>
            </div>
            
            <div class="guide-section">
                <h3>📚 How to Use i-Ready Data</h3>
                <ol>
                    <li><strong>Review Reports:</strong> Check student diagnostic data weekly</li>
                    <li><strong>Identify Patterns:</strong> Look for skill gaps and areas of strength</li>
                    <li><strong>Differentiate Instruction:</strong> Tailor your tutoring to each student's color band</li>
                    <li><strong>Track Growth:</strong> Monitor progress between diagnostic windows</li>
                    <li><strong>Adjust Strategies:</strong> Use data to inform instructional decisions</li>
                </ol>
            </div>
            
            <div class="guide-section guide-highlight">
                <h3>🎯 Data-Driven Tutoring Cycle</h3>
                <p><strong>Step 1:</strong> Review i-Ready diagnostic data (color band, specific skill gaps)</p>
                <p><strong>Step 2:</strong> Plan instruction based on data (differentiation by color band)</p>
                <p><strong>Step 3:</strong> Deliver targeted tutoring (foundational skills → grade-level content)</p>
                <p><strong>Step 4:</strong> Monitor progress weekly (adjust based on student performance)</p>
                <p><strong>Step 5:</strong> Document and celebrate growth (share wins with students)</p>
            </div>
            
            <div class="guide-section">
                <h3>🚨 Common Questions</h3>
                <ul>
                    <li><strong>Q: Student moved color bands?</strong> A: Celebrate growth! Adjust instruction to new level</li>
                    <li><strong>Q: No progress in weeks?</strong> A: Review engagement strategies, check for missed skills, consult onsite leader</li>
                    <li><strong>Q: Can't access i-Ready?</strong> A: Contact onsite leader immediately for login support</li>
                    <li><strong>Q: Data doesn't match observation?</strong> A: Trust the data but note your observations; discuss with coach</li>
                </ul>
            </div>
        `
    },
    
    knowtion: {
        title: "Knowtion Guide - Your Community Platform",
        content: `
            <div class="guide-section">
                <h3>🎯 What is Knowtion?</h3>
                <p>Your community hub for celebrating wins, sharing concerns, and documenting your tutoring journey. This is YOUR space to connect, reflect, and grow together as a team.</p>
            </div>
            
            <div class="guide-section">
                <h3>🌟 Core Features</h3>
                <ol>
                    <li><strong>Team Shoutouts:</strong> Celebrate teammates who went above and beyond</li>
                    <li><strong>Think Tanks:</strong> Raise concerns, ask questions, brainstorm solutions together</li>
                    <li><strong>Scholar Growth Artifacts:</strong> Document student progress and celebrate wins</li>
                    <li><strong>Daily Reflections:</strong> Share your tutoring journey and experiences</li>
                </ol>
            </div>
            
            <div class="guide-section">
                <h3>✨ How to Use Knowtion</h3>
                <ul>
                    <li><strong>Shoutout a Teammate:</strong> Recognize great work! "Shoutout to J.M. for amazing engagement strategies today!"</li>
                    <li><strong>Raise a Think Tank:</strong> Share challenges. "How do you handle off-task behavior with multiple students?"</li>
                    <li><strong>Post Scholar Growth:</strong> Celebrate student wins! "A.R. (3rd grade, Site A) mastered double-digit addition today! 🎉"</li>
                    <li><strong>Share Your Day:</strong> Reflect on your session. "Today was challenging but rewarding. Students were engaged!"</li>
                </ul>
            </div>
            
            <div class="guide-section guide-highlight">
                <h3>⚠️ CRITICAL: Privacy & Confidentiality</h3>
                <p><strong>ALWAYS use initials only, never full names!</strong></p>
                <p><strong>Format:</strong> "A.R. (Grade 3, Site Name)" or "J.M. (Coach)"</p>
                <p><strong>Never share:</strong> Full student names, personal information, or identifying details</p>
                <p><strong>Keep it positive:</strong> Focus on growth, strategies, and celebrations</p>
            </div>
            
            <div class="guide-section">
                <h3>📝 Best Practices</h3>
                <ul>
                    <li><strong>Post Daily:</strong> Share at least one reflection, win, or question each day</li>
                    <li><strong>Be Specific:</strong> "Student showed 20% growth in fluency" vs "Student did well"</li>
                    <li><strong>Celebrate Often:</strong> Recognize teammates and student progress frequently</li>
                    <li><strong>Ask Questions:</strong> Use think tanks to learn from experienced tutors</li>
                    <li><strong>Share Strategies:</strong> What worked for you today? Help others succeed!</li>
                    <li><strong>Stay Professional:</strong> Keep posts constructive, supportive, and appropriate</li>
                </ul>
            </div>
            
            <div class="guide-section">
                <h3>🎯 Sample Posts</h3>
                <div class="sample-posts">
                    <div class="sample-post">
                        <strong>Team Shoutout:</strong>
                        <p>"Huge shoutout to K.W. (Site Lead) for setting up the perfect tutoring space today! Materials organized, students ready to learn. You're amazing! 🌟"</p>
                    </div>
                    <div class="sample-post">
                        <strong>Think Tank:</strong>
                        <p>"Question for experienced tutors: How do you differentiate when you have a red band and green band student in the same small group? Looking for strategies!"</p>
                    </div>
                    <div class="sample-post">
                        <strong>Scholar Growth:</strong>
                        <p>"M.J. (4th grade, Washington Elementary) finally mastered fractions today! After 3 weeks of work, she got 9/10 on the exit ticket. So proud! 🎉📊"</p>
                    </div>
                    <div class="sample-post">
                        <strong>Daily Reflection:</strong>
                        <p>"Today's session was powerful. Used games to teach multiplication - engagement was 100%! Students were begging to stay longer. This is why we do this work. 💪"</p>
                    </div>
                </div>
            </div>
            
            <div class="guide-section">
                <h3>🚨 When to Use Knowtion</h3>
                <ul>
                    <li><strong>After a great session:</strong> Share what worked!</li>
                    <li><strong>When you're stuck:</strong> Ask the community for help</li>
                    <li><strong>Student breakthrough:</strong> Celebrate growth immediately</li>
                    <li><strong>Need encouragement:</strong> Tough day? The team has your back</li>
                    <li><strong>See great work:</strong> Shoutout teammates doing amazing things</li>
                    <li><strong>End of day reflection:</strong> Process your tutoring journey</li>
                </ul>
            </div>
            
            <div class="guide-section guide-highlight">
                <h3>💙 Building Community</h3>
                <p>Knowtion is more than a platform—it's YOUR community. When you share wins, ask questions, and support teammates, you make NJTC stronger.</p>
                <p><strong>Your voice matters.</strong> Your experiences help others. Your reflections improve the program.</p>
                <p><strong>Express your day. Document your journey. Celebrate together.</strong></p>
            </div>
            
            <div class="guide-section">
                <h3>📞 Need Help?</h3>
                <p><strong>Technical issues:</strong> Contact your onsite leader</p>
                <p><strong>Content questions:</strong> Ask in a think tank post!</p>
                <p><strong>Privacy concerns:</strong> Speak with Program Manager immediately</p>
            </div>
        `
    }
};

// ROLE-SPECIFIC CONTENT
const roleContent = {
    tutor: {
        title: "Tutor Resources",
        sections: [
            {
                icon: "📚",
                title: "Your Daily Checklist",
                items: [
                    "Review i-Ready color bands before sessions",
                    "Log attendance in PEARL immediately after session",
                    "Complete exit survey before leaving",
                    "Check Ask Connor for any questions or challenges",
                    "Track student progress in Progress Monitoring",
                    "Share your wins on Knowtion!"
                ]
            },
            {
                icon: "🎯",
                title: "Session Best Practices",
                items: [
                    "1:3 tutor-to-student ratio maximum",
                    "30-45 minute focused sessions",
                    "Start with warm-up activity (5 min)",
                    "Targeted instruction based on i-Ready data (25-35 min)",
                    "Close with exit ticket or reflection (5 min)",
                    "Celebrate growth and effort!"
                ]
            },
            {
                icon: "⚠️",
                title: "When to Escalate",
                items: [
                    "Student behavior concerns → Onsite Leader immediately",
                    "Technical issues (PEARL, i-Ready) → Onsite Leader",
                    "Questions about curriculum → Onsite Leader or Coach",
                    "Policy questions → Program Manager via Ask Connor"
                ]
            }
        ]
    },
    
    coach: {
        title: "Coach Resources",
        sections: [
            {
                icon: "🎯",
                title: "Your Leadership Role",
                items: [
                    "Support tutors with instructional strategies",
                    "Conduct weekly data reviews with team",
                    "Model high-impact tutoring sessions",
                    "Provide real-time coaching and feedback",
                    "Monitor program quality and fidelity",
                    "Foster community through Knowtion engagement"
                ]
            },
            {
                icon: "📊",
                title: "Weekly Priorities",
                items: [
                    "Review Progress Monitoring data every Monday",
                    "Check tutor attendance logging in PEARL",
                    "Identify tutors needing additional support",
                    "Share best practices and celebrate wins",
                    "Communicate trends to Program Manager",
                    "Amplify tutor voices on Knowtion"
                ]
            },
            {
                icon: "🌟",
                title: "Coaching Best Practices",
                items: [
                    "Observe tutoring sessions weekly",
                    "Provide specific, actionable feedback",
                    "Share successful strategies across team",
                    "Address challenges proactively",
                    "Celebrate tutor growth and impact"
                ]
            }
        ]
    },
    
    "site-lead": {
        title: "Site Lead Resources",
        sections: [
            {
                icon: "⭐",
                title: "Your Leadership Scope",
                items: [
                    "Overall program quality and operations",
                    "First point of contact for all onsite issues",
                    "Data integrity and accuracy (PEARL, i-Ready)",
                    "Team coordination and communication",
                    "Escalation pathway to Program Manager",
                    "Community building through Knowtion"
                ]
            },
            {
                icon: "📋",
                title: "Daily Operations",
                items: [
                    "Ensure all tutors log attendance in PEARL daily",
                    "Verify session schedules and coverage",
                    "Address immediate behavior or technical issues",
                    "Monitor materials and resource availability",
                    "Communicate urgent issues to Program Manager",
                    "Encourage daily Knowtion engagement"
                ]
            },
            {
                icon: "📈",
                title: "Weekly Data Review",
                items: [
                    "Check Progress Monitoring dashboard",
                    "Verify ≥90% attendance goal progress",
                    "Identify students needing additional support",
                    "Review tutor performance and engagement",
                    "Prepare weekly update for Program Manager"
                ]
            },
            {
                icon: "🚨",
                title: "Escalation Protocol",
                items: [
                    "Immediate safety concerns → Program Manager + Admin",
                    "Serious behavior issues → Program Manager",
                    "Technical system failures → Program Manager",
                    "Policy violations → Program Manager",
                    "Staff concerns → Program Manager (confidential)"
                ]
            }
        ]
    }
};

// INITIALIZE
let currentRole = null;

function init() {
    console.log('🚀 NJTC Portal Initializing...');
    loadDailyQuote();
    updateTime();
    setInterval(updateTime, 1000);
    
    // Check if role is saved
    const savedRole = localStorage.getItem('njtc_user_role');
    if (savedRole) {
        selectRole(savedRole);
    }
    
    // Add sample posts styling
    const samplePostsStyle = document.createElement('style');
    samplePostsStyle.textContent = `
    .sample-posts {
        display: grid;
        gap: 1.25rem;
        margin-top: 1rem;
    }
    
    .sample-post {
        background: linear-gradient(135deg, rgba(232, 62, 140, 0.08), rgba(253, 126, 20, 0.05));
        border-left: 4px solid #e83e8c;
        border-radius: 12px;
        padding: 1.25rem;
        transition: all 0.3s ease;
    }
    
    .sample-post:hover {
        transform: translateX(8px);
        box-shadow: 0 4px 16px rgba(232, 62, 140, 0.15);
    }
    
    .sample-post strong {
        display: block;
        font-family: var(--font-display);
        font-size: 0.875rem;
        font-weight: 700;
        color: #e83e8c;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.5rem;
    }
    
    .sample-post p {
        font-family: var(--font-body);
        font-size: 1rem;
        line-height: 1.7;
        color: var(--gray-800);
        margin: 0;
        font-style: italic;
    }
    `;
    document.head.appendChild(samplePostsStyle);
}

function loadDailyQuote() {
    const today = new Date().toDateString();
    const savedQuote = localStorage.getItem('njtc_daily_quote');
    const savedDate = localStorage.getItem('njtc_quote_date');
    
    let quote;
    if (savedDate === today && savedQuote) {
        quote = JSON.parse(savedQuote);
    } else {
        quote = inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];
        localStorage.setItem('njtc_daily_quote', JSON.stringify(quote));
        localStorage.setItem('njtc_quote_date', today);
    }
    
    document.getElementById('dailyQuote').textContent = `"${quote.quote}"`;
    document.getElementById('quoteAuthor').textContent = `— ${quote.author}`;
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    const dateString = now.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    });
    
    const timeEl = document.getElementById('currentTime');
    if (timeEl) {
        timeEl.innerHTML = `${dateString}<br>${timeString}`;
    }
}

function selectRole(role) {
    currentRole = role;
    localStorage.setItem('njtc_user_role', role);
    
    // Hide hero, show dashboard
    document.querySelector('.hero-section').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    
    // Update header
    const roleNames = {
        'tutor': 'Tutor',
        'coach': 'Coach',
        'site-lead': 'Site Lead',
        'all': 'All Access'
    };
    document.getElementById('userRoleDisplay').textContent = roleNames[role] || 'Portal User';
    
    // Load role-specific content
    if (role !== 'all') {
        loadRoleContent(role);
    } else {
        document.getElementById('roleContent').innerHTML = '';
    }
    
    // Animate platform cards
    setTimeout(() => {
        document.querySelectorAll('.platform-card').forEach((card, i) => {
            card.style.animation = `fadeInUp 0.6s ease ${i * 0.1}s both`;
        });
    }, 100);
}

function loadRoleContent(role) {
    const content = roleContent[role];
    if (!content) return;
    
    const html = `
        <h2 class="section-title">${content.title}</h2>
        <div class="role-content-grid">
            ${content.sections.map(section => `
                <div class="role-content-card">
                    <div class="role-content-icon">${section.icon}</div>
                    <h3>${section.title}</h3>
                    <ul>
                        ${section.items.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('roleContent').innerHTML = html;
}

function changeRole() {
    if (confirm('Change your role? You will return to the role selection screen.')) {
        localStorage.removeItem('njtc_user_role');
        location.reload();
    }
}

function openPlatform(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

function openGuide(platform) {
    const guide = platformGuides[platform];
    if (!guide) return;
    
    document.getElementById('guideTitle').textContent = guide.title;
    document.getElementById('guideBody').innerHTML = guide.content;
    document.getElementById('guideModal').style.display = 'flex';
}

function closeGuide() {
    document.getElementById('guideModal').style.display = 'none';
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('guideModal');
    if (event.target === modal) {
        closeGuide();
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('✅ NJTC Portal Loaded Successfully!');
