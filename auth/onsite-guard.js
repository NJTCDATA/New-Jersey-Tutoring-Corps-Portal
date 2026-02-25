/**
 * NJTC Onsite Portal Route Guard
 * Add <script src="/auth/auth.js"></script> BEFORE this file in onsite/index.html.
 * Drop this script as <script src="/auth/onsite-guard.js"></script>
 * immediately after auth.js — before ack-gate.js and script.js.
 *
 * Effect: if user has no valid session OR session is not 'onsite' dept,
 * bounce them to the root login gate.
 */
(async () => {
  const session = await NJTCAuth.currentSession();
  if (!session || session.dept !== 'onsite') {
    // No valid onsite session — back to gate
    window.location.replace('/index.html');
  }
  // Valid session: allow ack-gate.js and script.js to run normally (unchanged)
})();
