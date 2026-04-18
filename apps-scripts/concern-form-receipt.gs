/**
 * NJTC Performance Concern Form — Apps Script Receipt
 *
 * HOW TO USE:
 * 1. Open the Google Sheet linked to the Performance Concern Form.
 * 2. Go to Extensions → Apps Script.
 * 3. Replace all code in Code.gs with this file.
 * 4. Save, then go to Triggers → Add Trigger:
 *      - Function: onFormSubmit
 *      - Event source: From spreadsheet
 *      - Event type: On form submit
 * 5. Authorize the script when prompted.
 *
 * NOTE: The Google Form must have "Collect email addresses" enabled
 * (Form Settings → Responses → Collect email addresses) so the
 * respondent's email is captured and available to this script.
 */

function onFormSubmit(e) {
  try {
    var nv = e.namedValues; // maps question title → [answer]

    // Helper: read a named value or return empty string
    function v(title) {
      return (nv[title] && nv[title][0]) ? nv[title][0].trim() : '';
    }

    var timestamp     = e.values[0] || '';

    // ── Respondent email (set automatically by Google when "Collect email addresses" is on) ──
    var submitterEmail = '';
    try { submitterEmail = e.response.getRespondentEmail() || ''; } catch (_) {}
    if (!submitterEmail) submitterEmail = v('Email Address');

    // ── Step 1: Submitter ──────────────────────────────────────────────────
    var submitter  = v('NJTC Employee Completing Form (Name/Title)');
    var onBehalf   = v('Are you completing this form on behalf of someone else?');
    var onBehalfOf = v('Please provide the name (and role) of the person you are completing this form on behalf of.');

    // ── Step 2: Employee ───────────────────────────────────────────────────
    var empName        = v('Employee Name');
    var empRole        = v('Employee Role');
    var empSite        = v('Employee Site/Location');
    var todayDate      = v("Today's Date");
    var convDate       = v('Date Conversation Occurred');
    var firstOccurrence = v('Is this the first time you have documented an occurrence for this employee?');

    // ── Step 3: Concern Details ────────────────────────────────────────────
    var supportType  = v('What type of support are you documenting?');
    var supportOther = v('If you chose "other", please describe:');
    var delivery     = v('How was this conversation delivered?');
    var concernType  = v('Please indicate the type of concern that led you to have this conversation.');
    var concernOther = v('Explain context of concern if "Other" was chosen above');
    var history      = v('Please provide any relevant historical details regarding the context for this conversation, important details from the conversation and/or support offered.');

    // ── Step 4: Next Steps ─────────────────────────────────────────────────
    var hrNextSteps   = v('Next Steps Requested From HR');
    var nextStepsDesc = v('Please describe any relevant next steps');

    // ── Build readable concern label ───────────────────────────────────────
    var concernLabel = concernType;
    if (concernType === 'Other' && concernOther) {
      concernLabel = 'Other – ' + concernOther;
    } else if (concernOther) {
      concernLabel = concernType + ' (' + concernOther + ')';
    }

    var supportLabel = supportType;
    if (supportType === 'Other' && supportOther) {
      supportLabel = 'Other – ' + supportOther;
    }

    // ── Submitter receipt email ────────────────────────────────────────────
    if (submitterEmail) {
      var subject = 'Performance Concern Submitted – NJTC';

      var body = 'Hi ' + submitter + ',\n\n'
        + 'Your performance concern form has been successfully submitted and HR has been notified.\n\n'
        + 'Summary of your submission:\n'
        + '• Employee: ' + empName + ' (' + empRole + ') at ' + empSite + '\n'
        + '• Date Conversation Occurred: ' + convDate + '\n'
        + '• First Documented Occurrence: ' + firstOccurrence + '\n'
        + '• Support Type: ' + supportLabel + '\n'
        + '• Delivery Method: ' + delivery + '\n'
        + '• Concern Type: ' + concernLabel + '\n'
        + '• Relevant Details: ' + (history || '(none provided)') + '\n'
        + '• HR Next Steps Requested: ' + hrNextSteps + '\n'
        + (nextStepsDesc ? '• Additional Context for HR: ' + nextStepsDesc + '\n' : '')
        + (onBehalf === 'Yes' ? '• Submitted on behalf of: ' + onBehalfOf + '\n' : '')
        + '• Submitted: ' + timestamp + '\n\n'
        + 'HR will follow up with you regarding next steps. If this concern requires immediate '
        + 'attention or escalation, please contact the Executive Director of Programming (EDP) directly.\n\n'
        + 'Thank you,\n'
        + 'NJTC Program Administration';

      GmailApp.sendEmail(submitterEmail, subject, body);
    }

  } catch (err) {
    Logger.log('onFormSubmit error: ' + err.toString());
  }
}
