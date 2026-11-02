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

### Known limit: monthly columns

`MONTH_LABELS` and the Master Roster monthly columns stop at **Aug-26**. Observations from Sep-26 onward still count toward total OJT hours and %, but they don't appear in a monthly OJT column, and **Generate This Month's Wage Report** will refuse to run for those months. Extending this means inserting Sep-26 → Aug-27 columns into the Master Roster and updating `MONTH_LABELS`, `MR_RTI_MONTHLY_START` and `MR_PROGRAM_TRACK`. That is a separate change.
