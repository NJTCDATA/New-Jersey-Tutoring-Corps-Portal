/**
 * NJTC Central Portal Route Guard
 * Placed in central/index.html AFTER ../auth/auth.js
 *
 * Validates CT session and exposes window.NJTC_SESSION = { dept, exp }
 * Bounces non-CT or expired sessions back to the root gate.
 */
(async () => {
  const session = await NJTCAuth.currentSession();
  const CT_DEPTS = ['hr', 'finance', 'programming', 'data', 'training', 'leadership'];

  if (!session || !CT_DEPTS.includes(session.dept)) {
    window.location.replace('/New-Jersey-Tutoring-Corps-Portal/index.html');
    return;
  }

  // Expose to page scripts
  window.NJTC_SESSION = session;
})();
