const DEBUG = false;
const FORM_ACTION_URL = "https://docs.google.com/forms/d/e/1FAIpQLSchJy1w0NtOztPnzbgdpmt7zMmO_Z9RFBu-WGEPbz7Drej_lg/formResponse";
const ENTRY_DECISION = "entry.994385786";
const ENTRY_SITE = "entry.1171332303";
const ENTRY_SIGNATURE = "entry.1154443602";
const UID_KEY = "NJTC_UID";
function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function init() {
    if (DEBUG) console.log('🚀 NJTC Acknowledgement Gate Initializing...');
    let uid = localStorage.getItem(UID_KEY);
    if (!uid || uid.trim().length < 3) {
        showUIDModal();
    } else {
        checkDailyAcknowledgement(uid);
    }
}
function showUIDModal() {
    const modal = document.createElement('div');
    modal.id = 'njtc-uid-modal';
    modal.className = 'njtc-modal-overlay';
    modal.innerHTML = `
        <div class="njtc-modal-content njtc-modal-small">
            <div class="njtc-modal-header">
                <h2>Welcome to NJTC Portal</h2>
            </div>
            <div class="njtc-modal-body">
                <p class="uid-instruction">Please enter your NJTC Tutor ID to continue.</p>
                <input type="text" id="uid-input" class="njtc-input" placeholder="e.g., T12345" required autocomplete="off"/>
                <p class="uid-note">This will only be asked once per device.</p>
                <button id="uid-save-btn" class="njtc-btn njtc-btn-primary">Save & Continue</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const input = document.getElementById('uid-input');
    const saveBtn = document.getElementById('uid-save-btn');
    input.focus();
    saveBtn.addEventListener('click', () => {
        const uid = input.value.trim();
        if (uid.length < 3) {
            alert('Please enter a valid Tutor ID (at least 3 characters)');
            input.focus();
            return;
        }
        localStorage.setItem(UID_KEY, uid);
        if (DEBUG) console.log('✅ UID saved:', uid);
        modal.remove();
        checkDailyAcknowledgement(uid);
    });
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveBtn.click();
    });
}
function checkDailyAcknowledgement(uid) {
    const todayKey = getTodayKey();
    const dayKey = `NJTC_ACK_${uid}_${todayKey}`;
    const status = localStorage.getItem(dayKey);
    if (DEBUG) console.log('Checking acknowledgement:', { uid, todayKey, dayKey, status });
    if (status === 'agree') {
        if (DEBUG) console.log('✅ Already acknowledged today');
        return;
    }
    if (status === 'decline') {
        showLockedMessage();
        return;
    }
    showAcknowledgementModal(uid, dayKey);
}
function showAcknowledgementModal(uid, dayKey) {
    const modal = document.createElement('div');
    modal.id = 'njtc-ack-modal';
    modal.className = 'njtc-modal-overlay';
    modal.innerHTML = `
        <div class="njtc-modal-content njtc-modal-large">
            <div class="njtc-responsibilities-container">
                <div class="responsibilities-header">
                    <h2>Daily On-Site Responsibilities</h2>
                    <p class="mission-statement">Our tutors are entrusted with scholar growth, safety, and instructional continuity. These responsibilities ensure every session reflects NJTC's standards of care and excellence.</p>
                </div>
                <details class="responsibilities-details" open>
                    <summary class="responsibilities-toggle">
                        <span class="toggle-icon">▶</span>
                        <span class="toggle-text">View Complete Responsibilities</span>
                    </summary>
                    <div class="responsibilities-content">
                        <section class="responsibility-section">
                            <h3><span class="section-number">1</span>On-Site Professionalism</h3>
                            <ul>
                                <li>Arrive 5-10 minutes before each scheduled session and maintain 95%+ attendance</li>
                                <li>Notify your Site Coordinator immediately if you will be late or absent</li>
                                <li>Communicate professionally with scholars, colleagues, and school staff at all times</li>
                                <li>Model the positive behavior and academic engagement you expect from scholars</li>
                            </ul>
                        </section>
                        <section class="responsibility-section">
                            <h3><span class="section-number">2</span>Instructional Responsibilities</h3>
                            <ul>
                                <li>Deliver high-quality, data-driven instruction aligned to i-Ready diagnostic results</li>
                                <li>Follow approved lesson plans using the gradual release model (I do, We do, You do)</li>
                                <li>Implement exit tickets and formative assessments to check for understanding</li>
                                <li>Differentiate instruction to meet individual scholar needs within your tutoring group</li>
                                <li>Prepare all materials and technology before each session begins</li>
                            </ul>
                        </section>
                        <section class="responsibility-section">
                            <h3><span class="section-number">3</span>Student Safety & Conduct</h3>
                            <ul>
                                <li>Maintain appropriate professional boundaries with scholars at all times</li>
                                <li>Never share personal contact information or connect with scholars on social media</li>
                                <li>Report any safeguarding concerns immediately to your Site Coordinator and Program Management</li>
                                <li>Use positive classroom management strategies; never use negative or punitive language</li>
                                <li>Supervise scholars appropriately throughout the entire session duration</li>
                            </ul>
                        </section>
                        <section class="responsibility-section">
                            <h3><span class="section-number">4</span>Attendance & Punctuality</h3>
                            <ul>
                                <li>Log scholar attendance in Pearl at the start of each session</li>
                                <li>Complete post-session surveys in Pearl with session notes and scholar observations</li>
                                <li>Maintain 90%+ Pearl completion rate for attendance and surveys</li>
                                <li>Follow up on absent scholars as directed by your Site Coordinator</li>
                            </ul>
                        </section>
                        <section class="responsibility-section">
                            <h3><span class="section-number">5</span>Communication & Reporting</h3>
                            <ul>
                                <li>Check your professional Gmail account daily and respond within 24-48 hours</li>
                                <li>Submit lesson plans by the deadline set by your Site Coordinator (typically Friday for the following week)</li>
                                <li>Participate actively in weekly coaching sessions with your Site Coordinator</li>
                                <li>Communicate scholar concerns or wins immediately to classroom teachers and leadership</li>
                                <li>CC your Site Coordinator and Program Management on all relevant communications</li>
                            </ul>
                        </section>
                        <section class="responsibility-section">
                            <h3><span class="section-number">6</span>Compliance & Ethics</h3>
                            <ul>
                                <li>Adhere to all NJTC policies outlined in the Employee Handbook</li>
                                <li>Submit accurate timecards in ADP by payroll deadlines (15th and last day of month)</li>
                                <li>Participate in 100% of required professional development and training sessions</li>
                                <li>Use only approved curriculum materials and resources (i-Ready and Knowtion-approved content)</li>
                                <li>Maintain confidentiality of all scholar data and information</li>
                            </ul>
                        </section>
                    </div>
                </details>
                <div class="acknowledgement-statement">
                    <p><strong>By selecting "Agree," I acknowledge and commit to upholding these responsibilities during my on-site work today.</strong></p>
                    <p class="acknowledgement-note">If you have questions about any responsibility, contact your Site Coordinator before proceeding.</p>
                </div>
            </div>
            <div class="njtc-ack-form">
                <div class="form-section">
                    <label class="form-label required">Your Decision</label>
                    <div class="decision-buttons">
                        <button type="button" class="decision-btn decision-agree" data-decision="agree">
                            <span class="decision-icon">✓</span>
                            <span class="decision-text">I Agree</span>
                        </button>
                        <button type="button" class="decision-btn decision-decline" data-decision="decline">
                            <span class="decision-icon">✗</span>
                            <span class="decision-text">I Decline</span>
                        </button>
                    </div>
                    <input type="hidden" id="ack-decision" required />
                </div>
                <div class="form-section">
                    <label for="ack-site" class="form-label required">School / Site Name</label>
                    <input 
                        type="text" 
                        id="ack-site" 
                        class="njtc-input" 
                        placeholder="e.g., Lincoln Elementary School"
                        required 
                        autocomplete="off"
                    />
                    <p class="field-helper-text">Enter the full name of your school or site location</p>
                </div>
                <div class="form-section">
                    <label for="ack-signature" class="form-label required">Your Signature (Full Name)</label>
                    <input type="text" id="ack-signature" class="njtc-input" placeholder="Type your full name" required autocomplete="off"/>
                </div>
                <div class="form-actions">
                    <button id="ack-submit-btn" class="njtc-btn njtc-btn-primary" disabled>Submit Acknowledgement</button>
                    <button id="ack-change-uid-btn" class="njtc-btn njtc-btn-text">Change Tutor ID</button>
                </div>
                <p class="form-note">Note: We cannot reliably detect submission success due to browser security. If you experience issues, please refresh and try again.</p>
            </div>
        </div>
        <iframe name="njtc_hidden_iframe" style="display:none;"></iframe>
    `;
    document.body.appendChild(modal);
    setupAcknowledgementForm(uid, dayKey, modal);
}
function setupAcknowledgementForm(uid, dayKey, modal) {
    const decisionButtons = modal.querySelectorAll('.decision-btn');
    const decisionInput = modal.querySelector('#ack-decision');
    const siteInput = modal.querySelector('#ack-site');
    const signatureInput = modal.querySelector('#ack-signature');
    const submitBtn = modal.querySelector('#ack-submit-btn');
    const changeUIDBtn = modal.querySelector('#ack-change-uid-btn');
    let selectedDecision = null;
    decisionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            decisionButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedDecision = btn.dataset.decision;
            decisionInput.value = selectedDecision;
            validateForm();
        });
    });
    siteInput.addEventListener('input', validateForm);
    signatureInput.addEventListener('input', validateForm);
    function validateForm() {
        const hasDecision = !!selectedDecision;
        const hasSite = siteInput.value.trim().length >= 3;
        const hasSignature = signatureInput.value.trim().length >= 3;
        submitBtn.disabled = !(hasDecision && hasSite && hasSignature);
    }
    submitBtn.addEventListener('click', () => {
        const decision = selectedDecision;
        const site = siteInput.value.trim();
        const signature = signatureInput.value.trim();
        const signatureWithUID = `${signature} | UID:${uid}`;
        if (DEBUG) {
            console.log('Submitting acknowledgement:', { uid, decision, site, signature: signatureWithUID, dayKey });
        }
        submitToGoogleForm(decision, site, signatureWithUID, dayKey, modal);
    });
    changeUIDBtn.addEventListener('click', () => {
        if (confirm('This will clear your Tutor ID and reload the page. Continue?')) {
            localStorage.removeItem(UID_KEY);
            location.reload();
        }
    });
}
function submitToGoogleForm(decision, site, signatureWithUID, dayKey, modal) {
    const submitBtn = modal.querySelector('#ack-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = FORM_ACTION_URL;
    form.target = 'njtc_hidden_iframe';
    const fields = [
        { name: ENTRY_DECISION, value: decision === 'agree' ? 'Agree' : 'Decline' },
        { name: ENTRY_SITE, value: site },
        { name: ENTRY_SIGNATURE, value: signatureWithUID }
    ];
    fields.forEach(field => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = field.name;
        input.value = field.value;
        form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    setTimeout(() => {
        document.body.removeChild(form);
        localStorage.setItem(dayKey, decision);
        if (decision === 'agree') {
            modal.remove();
            if (DEBUG) console.log('✅ Acknowledged - portal access granted');
        } else {
            modal.remove();
            showLockedMessage();
        }
    }, 800);
}
function showLockedMessage() {
    const modal = document.createElement('div');
    modal.id = 'njtc-locked-modal';
    modal.className = 'njtc-modal-overlay';
    modal.innerHTML = `
        <div class="njtc-modal-content njtc-modal-small njtc-modal-locked">
            <div class="njtc-modal-header njtc-header-error">
                <h2>Portal Access Locked</h2>
            </div>
            <div class="njtc-modal-body">
                <div class="locked-icon">🔒</div>
                <p class="locked-message">You declined to acknowledge your daily responsibilities. Access to the portal is locked for today.</p>
                <p class="locked-instruction">Please contact your Site Coordinator or Program Manager if you have questions.</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
console.log('✅ NJTC Acknowledgement Gate Loaded');
