# TAP Tracker — OJT Workbook Sync (Summer 2026 → SY 26-27)

## What the Summer 2026 import did

The Summer Import menu items in the TAP Tracker 26-27 Apps Script connected each tutor's own OJT workbook to the TAP Tracker:

| Step | Function | What it did |
|---|---|---|
| 0 | `synthesizeAndProcessRegistrationRows` | Created a fake Apprentice Registration Form row for each summer person with no real form, then ran it through the normal registration mapper. This added them to the Master Roster as Pending, with no emails sent. |
| 1 | `importSummerOJTParticipants` | Read the Onsite Database tab **Summer 26 OJT** (Name / Role / OJT Link / Site Leader). Fuzzy-matched each name to the staffing tracker to get email, phone, site and county. Then created or updated the person's Master Roster row: SY = 2026-2027, Program Track = "Apprentice / Pre-apprentice / Tutor — Summer 2026 Start", and the prior-year USDOL ID if it was blank. |
| 2 | `importSummerOJTHours` | Pulled the Google Sheet ID out of each OJT Link cell, opened that workbook and read the "On The Job Training Checklist" tab. Every activity marked **Y** was matched to the canonical 80-activity `OJT_SCHEMA` by its **text**, because the letter codes in the workbooks don't line up with the schema. Each match was written as a row in the **OTJ** log, and then `recalculateTotals()` ran. |

`recalculateTotals()` produces all of the Master Roster numbers: OJT hours (50 per Y), OJT %, Y / Possible, Beg/Mid/End %, wage tier and Completion Summary. Only people whose Program Track starts with "Apprentice" get wage-tier emails.

## What's different for SY 26-27

| | Summer | SY 26-27 |
|---|---|---|
| Directory tab | `Summer 26 OJT` (header row 3) | `SY 26-27 OJT` (header row 2, plus a Notes column, then a **Site Leaders** section underneath) |
| Staffing tab | `Onsite Tracker` (summer staff list, fixed column positions) | `Onsite Tracker` again, but it now holds the **SY 26-27** staff list (IMPORTRANGE of `Staffing SY 2026-2027`) with different columns (Phone is M, not N). Read by header name. |
| Roles | Apprentice / Pre-apprentice / Non GAINS/PACE Tutor | Adds **Completed Program**. These people have a **duplicated** checklist tab for the new year. |
| People | Summer people were new | Many are already on the Master Roster from summer, so they must **not** be duplicated or renamed. |

## The SY 26-27 sync (`apps-scripts/tap-sy2627-ojt-sync.gs`)

Add this as a new file in the same Apps Script project as the TAP Tracker script. It runs one pass that does Summer Steps 1 and 2 together, and it is safe to run every night:

1. Reads `SY 26-27 OJT` and finds the header row by its contents. It stops reading at the Site Leaders section.
2. Matches each person to the `Onsite Tracker` tab of the Automated Onsite 26-27 Tracker (`1x3dWZQhx9XWqB8YASInOMTr0JDjSRMqv3w7PmcruuMU`) by header name, not column position.
3. Finds their Master Roster row by email first, then by a strict name match. A summer person keeps their existing roster name, because renaming them would detach their summer OTJ rows. A new row is created only when the person isn't found and has an email.
4. Updates SY, SY site, Program Track and the prior-year USDOL ID. A summer person's Track becomes, for example, `Apprentice — Summer 2026 Start, SY 26-27`. If someone's track class changes (for example Pre-apprentice → Apprentice), that is logged for review.
5. Opens their workbook and picks the checklist tab. If there is more than one, it takes the tab named "26-27", then a copy ("Copy of…", "(2)"), then the right-most tab.
6. Matches Y activities to the schema by text, using the same matcher as the summer import. It appends **only activities not already in the OTJ log** for that person, so it can run every day without creating duplicate rows.
7. Runs `recalculateTotals()` when something changed.
8. Writes one row per person to **SY 26-27 Workbook Progress**: Beg/Mid/End Y counts, total Y, N/A, the Workbook % read directly from the workbook, the latest observation date, the number of activities imported, the Master Roster OJT hours and %, and any issues.
9. Writes anything it would not guess at to **SY 26-27 Import — Needs Review**.

If a run gets close to the 6-minute Apps Script limit, it saves its place and continues one minute later.

### Setup (one time)

1. Apps Script editor → **+ → Script** → name it `tap-sy2627-ojt-sync` → paste the file → Save.
2. In the main script's `onOpen()`, add these lines just before `.addToUi()`:
   ```js
   .addSeparator()
   .addItem('SY 26-27: Sync OJT Workbooks Now',   'menuSyncSY2627OJT')
   .addItem('SY 26-27: Sync ONE Person',          'debugSY2627OnePerson')
   .addItem('SY 26-27: View Workbook Progress',   'viewSY2627Progress')
   .addItem('SY 26-27: Install Daily Auto-Sync',  'installSY2627DailySync')
   ```
3. Reload the sheet. Run **SY 26-27: Sync ONE Person** on 2–3 people (a summer returner, a new apprentice and a completer) and check the results.
4. Run **SY 26-27: Sync OJT Workbooks Now**.
5. Run **SY 26-27: Install Daily Auto-Sync**. Run it again whenever **Install Triggers** is used, because that menu item deletes every trigger.

### Monthly columns and automation

This limit is fixed by `apps-scripts/tap-automation.gs`, together with six small edits to the main script (listed in that file's install notes).

- **Months:** `MONTH_LABELS` is now generated from Mar-25 through August of the current school year, and it rolls forward every September.
- **Where new months go:** each month after Aug-26 is added at the end of the Master Roster, after Role Type (column CV). Each month gets two columns, `Sep-26 OJT` and `Sep-26 RTI`, and they are created automatically.
- **Existing columns don't move**, so the portal's header-name lookups keep working.
- **Schedule:**
  - nightly workbook sync
  - full resync every Sunday and on the 1st of each month
  - last month's wage report generated and emailed as a PDF on the 1st
  - weekly status digest emailed every Monday

### Accuracy fixes (v11, after the first live run on 11/2/26)

1. **Workbook links.** Apps Script's `RichTextValue` can't see links stored as Google Drive file chips. Because of that, 41 of 78 workbooks were read as "no link." The sync now reads that column through the Sheets API, which returns plain hyperlinks, links on part of a cell's text, and chips.
2. **Activity matching (80/80).** Two activities were never imported correctly:
   - Beginning/Professionalism/H: the workbook text adds "…complete all literacy training," so it scored below the match threshold.
   - Middle/Instruction/AB: it has the same wording as R, so it was counted as R and dropped.

   Ties are now broken by domain, then by the checklist section's phase, then by the letter prefix. The matcher was tested on 240 cases with none wrong. The summer workbooks are re-read once with **Summer 2026: Top-up Missed Activities**.
3. **Dates.** Y marks with no date, or an impossible date (before Mar-25 or more than 31 days in the future), still count toward total hours and %. They are not placed in any month, so they no longer inflate the import month's wage report. They are counted on the progress sheet and listed on Needs Review.
4. **Wage emails (v12).** Milestone emails are fully automatic. The main script keeps a ledger (Script Property `MILESTONE_SENT`, seeded from the Notifications Log) of the highest milestone already emailed for each person. Whenever someone is at a milestone that hasn't been emailed yet, the email goes out on the next recalculation, whether the hours came from the portal, the nightly sync or a resync. No milestone is emailed twice.
5. **Portal.** Leader Team's monthly OJT table now reads the month columns from the sheet headers, so Aug-26 and every month from Sep-26 on show up. The LMS/RTI hours card now reads the actual header, `RTI Hours - LMS (Total)`, so it no longer shows 0.

## RTI / training hours from Knowtion (`apps-scripts/tap-rti-knowtion.gs`)

- **Source:** the Knowtion workbook `1a4FTtODGfvO1FsQUp_MpQbePAjTF3Ire6uAHhL-EXFI`. The script reads three tabs by GID: tutors 267261099, site leaders 172053344, and site leader preparation 713859468. It opens the workbook directly, so no published link is needed.
- **Output tab "RTI — Knowtion":** one row per learner, with Estimated hours, Time Spent hours, the share of estimate, Course 3 (RTI) only (the "(Master)" staff copies are excluded), items completed, items missing an estimate and the last completion date. Both numbers are also shown for every program and every SY month.
- **Linking names:** "RTI Name Map" is checked first, then an exact roster name, then a strict first-and-last-name match. Tutors who can't be linked are listed on "RTI — Needs Name Match". Site leaders are listed by their Knowtion name.
- **Rules:** each learner + program + assignment counts once, using the latest completion. "<1 min" counts as 0 minutes, and a blank estimate counts as 0 and is listed under Items Missing Estimate.
- **Not changed:** the Master Roster's official RTI total and the 288-hour completion check stay as they are until NJTC decides which number counts.
- **Schedule and access:** the sync runs nightly at about 4am through Automation and can be run anytime from **RTI: Sync Knowtion Hours Now**. The portal reads it through `doGet?tab=rti_knowtion`.
- **Portal:**
  - The main dashboard shows "My Training Hours" to tutors and site leaders.
  - Leader Team shows a compact version on each tutor's card and tutor profile.
  - Fixed header names that were reading as 0 or blank: RTI Hours - LMS (Total), Current Wage Rate ($), Wage Milestone and OJT Hours (Total).
- **Verified offline:** 106 learners, 2,163 items, 0 differences from an independent recalculation. Program and month columns add up to each person's totals.

## Portal: two pages — TAP · Apprentices and Training & Development (Nov 2026)

The SY 26-27 T&D Hub was split so TAP and training are no longer mixed. No new sidebar pages were added: both live in existing panels, and the old `td-hub` link redirects to TAP · Apprentices.

| Page (panel) | What it covers | Who sees it |
|---|---|---|
| **TAP · Apprentices** (`tap-standalone`) | Apprentices, pre-apprentices and TAP completers only. The role comes from the Onsite DB "SY 26-27 OJT" list → Master Roster Program Track. Non-GAINS/PACE tutors are never shown or counted. OJT progress, RTI (Knowtion Course 3), follow-ups, wage milestones, compliance, Log OJT, SY 25-26 cohort and returners. | Programming, Training, HR, Finance, Data, Leadership, KB |
| **Training & Development** (`training-analytics`) | SY 26-27 Knowtion training for every tutor and site leader (by program and month, with a name-match list). PD Sessions, Training Intake and Program Support are kept as the **SY 25-26 archive** until T&D's new collection method is connected. Field Intel is not shown to Programming, who use Pearl Ops directly. | Training, Programming, Data, Leadership, KB |

**Views on TAP · Apprentices** (`modules/tap-insights.js`):

| View | Departments | Tabs |
|---|---|---|
| Program (plain) | Programming | At a glance · Our apprentices · By site leader · Log OJT Activity · How to read this |
| Full | Training, Data, Leadership, KB | Overview · Apprentices · Follow-Up · By Site Leader · OJT Activity Detail · Wage Milestones · GAINS Compliance* · Log OJT* · SY 25-26 & Returners · About |
| HR | HR | Overview · Apprentices · Follow-Up · Pay & Status · Wage Milestones · GAINS Compliance · SY 25-26 & Returners · About |
| Finance | Finance | Overview · Pay & Status · Wage Milestones · GAINS Compliance · About |

\* These tabs keep their existing department rules: Log OJT for Programming, Training and Data; GAINS Compliance for Finance, HR, Leadership, KB and Data. Training, Data, Leadership, KB and Programming can switch between the full and plain views.

**Accuracy fixes in this pass:**

- **Old TAP Dashboard tabs.** Active Roster, OJT Progress and Wage Milestones listed every active Master Roster row, including about 50 non-TAP tutors. They now show TAP participants only.
  - Wage Milestones lists Apprentices only.
  - Pre-apprentices and completers show "Not on wage scale". Before this fix they were given a computed tier wage.
- **PIE.** The TAP roster answer read `trackType`, which nothing set, so every active person counted as an Apprentice and was included in the payout estimate. It now uses the same role rule as the Apps Script.
- **PIE answers about apprentices.**
  - "Apprentice OJT progress" questions now answer from the TAP Tracker 26-27. Before, they used the SY 25-26 Program Database checklist.
  - New "where do I find" answers point to TAP · Apprentices and Training & Development.
  - All old page names were updated.
- **Finance → Partnership Risk.** The TAP wage card estimated milestones from last year's 17-item checklist at 25/50/75%. It now uses TAP Tracker OJT hours against the real thresholds (1,100 / 2,200 / 3,300 / 3,800 / 4,000), Apprentices only. It flags any apprentice whose Master Roster milestone label doesn't match their hours.
- **Section Guide, Definitions and Data Compass.**
  - Rewritten for both pages. The old T&D definitions described a 17-item checklist and 144 RI hours.
  - Data Compass entries added for both pages.
  - The portal tour and Home shortcuts were renamed to match.

### TAP tag

- On any Central page, a staff member's full name (in Pearl tables, rosters or profiles) gets a TAP · Apprentice, TAP · Pre-App or TAP · TAP Completed tag.
  - A red or amber dot means there's a follow-up flag.
  - Clicking the tag opens the person's card.
  - Matching is exact or first-and-last name. A name that's ambiguous is never tagged, and Tutors (non-TAP) are never tagged.
- **Flag rules:**
  - Workbook can't be read.
  - Not observed in 30+ days.
  - On the SY 26-27 OJT list but not on the Master Roster.
  - No OJT logged in the month. During the first 10 days of a month, this checks the previous full month.
  - Date fixes needed.
  - Knowtion: nothing on record, or no training in 21+ days.
  - Within 100 hours of the next wage milestone (T&D view only).
- **Sources:** the TAP web app feeds `sy2627_progress`, `sy2627_review`, `rti_knowtion` and `rti_needs_match`, with the sheet's gviz export as a backup. The Master Roster comes from the gviz export using fixed column positions.
- **Fixes:** Central's role categories now include "Completed Program", which was being counted as Tutor. The TAP Dashboard header now says SY 2026–2027.
