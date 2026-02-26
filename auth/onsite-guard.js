/**
 * NJTC Onsite Portal Route Guard
 * Placed in onsite/index.html AFTER ../auth/auth.js and BEFORE ack-gate.js
 *
 * If no valid onsite session exists, redirects to the root gate.
 */
(async () => {
  const session = await NJTCAuth.currentSession();
  if (!session || session.dept !== 'onsite') {
    window.location.replace('/New-Jersey-Tutoring-Corps-Portal/index.html');
  }
  // Valid onsite session — allow ack-gate.js and script.js to run normally
})();
