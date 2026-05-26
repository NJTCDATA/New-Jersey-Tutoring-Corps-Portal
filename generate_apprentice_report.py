#!/usr/bin/env python3
"""
NJTC Apprentice Impact Report Generator
Combines Pearl Operations Data + iReady MOY Academic Data for all TAP apprentices.

Usage:
  python3 generate_apprentice_report.py

Outputs:
  njtc_apprentice_impact_<date>.csv  (two-section report)
"""

import csv
import sys
import re
import urllib.request
import urllib.error
from datetime import datetime
from collections import defaultdict
from io import StringIO

# ══════════════════════════════════════════════════════════════
#  TAP TRACKER — Master Apprentice Roster (SY 25-26)
#  (display_name, nj_id, school_raw, region, survey_name_in_pearl)
# ══════════════════════════════════════════════════════════════

TAP_APPRENTICES = [
    ('Alexandra Cristescu',    'NJ2026000468', 'Penns Grove',                   'SW', 'Alexandra Cristescu'),
    ('Aliviyah Goodson',       'NJ2025004253', 'iLearn Bergen MS',              'NE', 'Aliviyah Goodson'),
    ('Apollo Monroy-Polanco',  'NJ2025004827', 'Middlesex STEM',                'NE', 'Apollo Monroy-Polanco'),
    ('Arelis Rodriguez',       'NJ2025003378', 'iLearn Bergen MS',              'NE', 'Arelis Rodriguez'),
    ('Avani Jimenez',          'NJ2026001278', 'Middlesex STEM',                'NE', 'Avani Jimenez'),
    ('Caitlin Evgeniadis',     'NJ2025001715', 'Hamilton Township',             'SW', 'Caitlin Evgeniadis'),
    ('Carla Borbon',           'NJ2026000857', 'Middlesex STEM',                'NE', 'Carla Borbon'),
    ('Carlos Jacho',           'NJ2025004966', 'iLearn Paterson',               'NE', 'Carlos Jacho'),
    ('Ian Anderson',           'NJ2025004964', 'iLearn Hudson MS',              'NE', 'Ian Anderson'),
    ('Jasmine Ramsey-Copeland','NJ2025001829', 'iLearn Passaic MS',             'NE', 'Jasmine Ramsey'),
    ('Jazmin Garcia',          'NJ2026001279', 'iLearn Bergen MS',              'NE', 'Jazmin Garcia'),
    ('Jessica Flores',         'NJ2025001718', 'iLearn Passaic MS',             'NE', 'Jessica Flores'),
    ('Katherine R. Davis',     'NJ2025005330', 'Hamilton Township',             'SW', 'Katie Rose Davis'),
    ('Katrina Valentin',       'NJ2025001719', 'Gloucester',                    'SW', 'Katrina Valentin'),
    ('Keisha Lopez',           'NJ2026000470', 'iLearn Clifton',                'NE', 'Keisha Lopez'),
    ('Lilia Quintero',         'NJ2026000471', 'Hamilton-Kuser',                'SW', 'Lilia Quintero'),
    ('Linda Fenty',            'NJ2026000858', 'iLearn Paterson MS',            'NE', 'Linda Fenty'),
    ('Maria Del Carmen',       'NJ2025005329', 'iLearn Passaic ES',             'NE', 'Maria (Mary Carmen) Gutierrez'),
    ('Melissa Mazza',          'NJ2026001277', 'iLearn Bergen MS',              'NE', 'Melissa Mazza'),
    ('Micaela Wilkerson',      'NJ2025004825', 'Haddon Township',               'SW', 'Caela Wilkerson'),
    ('Mushana Dunham',         'NJ2025005331', 'iLearn Clifton MS',             'NE', 'Mushana Dunham'),
    ('Naima Boutira',          'NJ2025005328', 'Central Jersey College Prep',   'NE', 'Naima Boutira'),
    ('Nicholas Hoover',        'NJ2025001712', 'Haddon Township',               'SW', 'Nicholas Hoover'),
    ('Norelis Ramirez',        'NJ2026000265', 'iLearn Paterson -ES',           'NE', 'Norelis Ramirez'),
    ('Pooja Tyagi',            'NJ2025001716', 'Central Jersey College Prep',   'NE', 'Pooja Tyagi'),
    ('Dr. Renee Davis',        'NJ2025004829', 'iLearn Clifton MS',             'NE', 'Renee Davis'),
    ('Shahzeeb Ahmad',         'NJ2025004822', 'iLearn Bergen',                 'NE', 'Shahzeeb Ahmad'),
    ('Sharon K Kessel',        'NJ2025001707', 'iLearn Paterson Silk City',     'NE', 'Sharon K Kessel'),
    ('Subul Sadiq',            'NJ2026000469', 'iLearn Hudson',                 'NE', 'Subul Sadiq'),
    ('Theodore Mills',         'NJ2025004828', 'Long Term Sub',                 'NE', 'Theodore Mills'),
]

# Schools using Standards Mastery (not iReady) — no academic data in MOY CSV
STANDARDS_MASTERY_SCHOOLS = {'Middlesex STEM'}

# Schools whose iReady data is pending as of June 5
PENDING_IREADY_SCHOOLS = {'Central Jersey College Prep', 'Hamilton Township', 'Hamilton-Kuser', 'Gloucester'}

# Schools with NO iReady data available
NO_DATA_SCHOOLS = {'Long Term Sub'}

# ── School name mapping: TAP raw name → list of iReady school names in MOY CSV
SCHOOL_MAP = {
    'iLearn Bergen MS':           ['Bergen Middle School'],
    'iLearn Bergen':              ['Bergen Middle School', 'Bergen ASCS Elementary'],
    'iLearn Passaic MS':          ['Passaic Middle'],
    'iLearn Passaic ES':          ['Passaic Elementary', 'Passaic Clifton Elementary'],
    'iLearn Paterson':            ['Paterson Arts and Science Charter School Middle',
                                   'Paterson Arts and Science Charter School Elementary'],
    'iLearn Paterson MS':         ['Paterson Arts and Science Charter School Middle'],
    'iLearn Paterson -ES':        ['Paterson Arts and Science Charter School Elementary'],
    'iLearn Paterson Silk City':  ['Paterson Silk City Primary'],
    'iLearn Hudson MS':           ['Hudson Middle School'],
    'iLearn Hudson':              ['Hudson ASCS Elementary', 'Hudson Middle School'],
    'iLearn Clifton':             ['Clifton High', 'Passaic Clifton Middle', 'Passaic Clifton Elementary'],
    'iLearn Clifton MS':          ['Passaic Clifton Middle', 'Clifton High'],
    'Hamilton Township':          ['Greenwood Elementary School', 'Kuser Elementary School',
                                   'Crockett Middle School', 'Wilson Elementary School'],
    'Hamilton-Kuser':             ['Kuser Elementary School'],
    'Haddon Township':            ['VAN SCIVER ELEMENTARY SCHOOL', 'STRAWBRIDGE ELEMENTARY SCHOOL',
                                   'CLYDE S JENNINGS ELEM SCHOOL', 'STOY ELEMENTARY SCHOOL',
                                   'THOMAS A EDISON ELEM SCHOOL'],
    'Penns Grove':                ['FIELD STREET ELEMENTARY SCHOOL', 'PAUL W CARLETON ELEM SCHOOL'],
    'Gloucester':                 [],
    'Central Jersey College Prep':['Central Jersey College Prep'],
    'Middlesex STEM':             [],
    'Long Term Sub':              [],
}

# ── Multi-apprentice schools where school-level attribution is ambiguous
MULTI_APPRENTICE_SCHOOLS = set()
school_apprentice_count = defaultdict(list)
for appr in TAP_APPRENTICES:
    school_raw = appr[2]
    school_apprentice_count[school_raw].append(appr[0])
for school, names in school_apprentice_count.items():
    if len(names) > 1:
        MULTI_APPRENTICE_SCHOOLS.add(school)

# ── Pearl Operations Data (live published CSV)
PEARL_BASE_ID = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K'
PEARL_ATT_URL = f'https://docs.google.com/spreadsheets/d/e/{PEARL_BASE_ID}/pub?output=csv&gid=702726038'
PEARL_STU_URL = f'https://docs.google.com/spreadsheets/d/e/{PEARL_BASE_ID}/pub?output=csv&gid=1245403832'

# ── ATT column indices (0-indexed, skip header)
ATT_USER     = 0
ATT_ROLE     = 1
ATT_SESSION  = 2
ATT_STATUS   = 6
ATT_MISS_RSN = 7
ATT_SCHOOL   = 11
ATT_DISTRICT = 12
ATT_USER_ID  = 13

# ── Placement levels
PLACEMENT_ORDER = [
    '3 or More Grade Levels Below',
    '2 Grade Levels Below',
    '1 Grade Level Below',
    'Early On Grade Level',
    'Mid or Above Grade Level',
]
PLACEMENT_INDEX = {p: i for i, p in enumerate(PLACEMENT_ORDER)}


# ══════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════

def norm_name(name):
    """Normalize a name for comparison: lowercase, strip titles & extra spaces."""
    if not name:
        return ''
    n = name.strip().lower()
    n = re.sub(r'^dr\.?\s+', '', n)
    n = re.sub(r'\s+', ' ', n)
    return n


def build_apprentice_lookup():
    """Build survey_name → display_name mapping for fast lookup."""
    lookup = {}
    for display, nj_id, school, region, survey_name in TAP_APPRENTICES:
        survey_norm = norm_name(survey_name)
        lookup[survey_norm] = display
        # Also add display name itself
        lookup[norm_name(display)] = display
    return lookup


def resolve_apprentice(raw_name, lookup):
    """Resolve a raw name from Pearl surveys to the canonical display name."""
    if not raw_name:
        return None
    n = norm_name(raw_name)
    if n in lookup:
        return lookup[n]
    # Partial first-last match
    for key, canonical in lookup.items():
        key_parts = key.split()
        n_parts = n.split()
        if len(key_parts) >= 2 and len(n_parts) >= 2:
            if key_parts[0] == n_parts[0] and key_parts[-1] == n_parts[-1]:
                return canonical
    return None


def safe_float(val):
    """Parse a float, returning None on failure."""
    try:
        v = float(val)
        return v if not (v != v) else None  # NaN check
    except (TypeError, ValueError):
        return None


def avg(values):
    """Average of a list, ignoring None. Returns None if empty."""
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    return sum(vals) / len(vals)


def fmt_float(val, decimals=1):
    """Format a float for CSV, empty string if None."""
    if val is None:
        return ''
    return f'{val:.{decimals}f}'


def fmt_pct(val, decimals=1):
    """Format a ratio (0-1 or >1) as a percentage string."""
    if val is None:
        return ''
    return f'{val * 100:.{decimals}f}%'


def placement_diff(base_p, moy_p):
    """Return numeric change in placement levels (positive = improved)."""
    bi = PLACEMENT_INDEX.get(base_p)
    mi = PLACEMENT_INDEX.get(moy_p)
    if bi is None or mi is None:
        return None
    return mi - bi


def normalize_placement(raw):
    """Normalize iReady placement strings to canonical form."""
    if not raw:
        return ''
    mapping = {
        '3+ grade levels below':           '3 or More Grade Levels Below',
        '3 or more grade levels below':    '3 or More Grade Levels Below',
        '2 grade levels below':            '2 Grade Levels Below',
        '1 grade level below':             '1 Grade Level Below',
        'early on grade level':            'Early On Grade Level',
        'mid or above grade level':        'Mid or Above Grade Level',
        'on or above grade level':         'Mid or Above Grade Level',
        'at or above grade level':         'Mid or Above Grade Level',
    }
    return mapping.get(raw.strip().lower(), raw.strip())


def escape_csv(val):
    """Escape a value for RFC-4180 CSV."""
    s = str(val) if val is not None else ''
    if ',' in s or '"' in s or '\n' in s:
        return '"' + s.replace('"', '""') + '"'
    return s


def fetch_url(url, label=''):
    """Fetch a URL and return text content, with redirect handling."""
    print(f'  → Fetching {label or url[:80]}…', end=' ', flush=True)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode('utf-8-sig')
            print(f'OK ({len(text):,} chars)')
            return text
    except Exception as e:
        print(f'FAILED: {e}')
        return None


def parse_csv_text(text):
    """Parse CSV text into list of dicts (using header row)."""
    if not text:
        return []
    reader = csv.DictReader(StringIO(text))
    return list(reader)


# ══════════════════════════════════════════════════════════════
#  DATA LOADING
# ══════════════════════════════════════════════════════════════

def load_moy_csv(filepath, subject):
    """Load a MOY iReady CSV. Each row = one scholar (wide: BOY + Winter on same row)."""
    print(f'  → Loading {subject} MOY CSV from {filepath}…', end=' ', flush=True)
    rows = []
    try:
        with open(filepath, encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                # Skip Middlesex (Standards Mastery)
                school = row.get('school', '').strip()
                if 'middlesex' in school.lower():
                    continue
                rows.append({
                    'subject':             subject,
                    'full_name':           row.get('full name', '').strip(),
                    'last_name':           row.get('last_name', '').strip(),
                    'first_name':          row.get('first_name', '').strip(),
                    'student_id':          row.get('student_id', '').strip(),
                    'external_account_id': row.get('external_account_id', '').strip(),
                    'school':              school,
                    'grade':               row.get('student_grade', '').strip(),
                    'academic_year':       row.get('academic_year', '').strip(),
                    # BOY (Fall / Base diagnostic)
                    'boy_scale_score':     safe_float(row.get('base_overall_scale_score', '')),
                    # boy_placement = relative placement (canonical: "1 Grade Level Below" etc.)
                    'boy_placement':       normalize_placement(row.get('base_overall_relative_placement', '')),
                    # boy_iready_level = iReady-specific label ("Level 2", "Early 3", etc.)
                    'boy_iready_level':    row.get('base_overall_placement', '').strip(),
                    'boy_rush_flag':       row.get('base_rush_flag', '').strip(),
                    # MOY (Winter diagnostic)
                    'moy_scale_score':     safe_float(row.get('winter_overall_scale_score', '')),
                    # moy_placement = relative placement (canonical)
                    'moy_placement':       normalize_placement(row.get('winter_overall_relative_placement', '')),
                    # moy_iready_level = iReady-specific label
                    'moy_iready_level':    row.get('winter_overall_placement', '').strip(),
                    'moy_rush_flag':       row.get('winter_rush_flag', '').strip(),
                    'moy_gain':            safe_float(row.get('winter_diagnostic_gain', '')),
                    'moy_weeks':           safe_float(row.get('winter_weeks_between_diagnostics', '')),
                    'moy_pct_typical':     safe_float(row.get('winter_pct_progress_typical_growth', '')),
                    'moy_pct_stretch':     safe_float(row.get('winter_pct_progress_stretch_growth', '')),
                    'annual_typical':      safe_float(row.get('annual_typical_growth_measure', '')),
                    'annual_stretch':      safe_float(row.get('annual_stretch_growth_measure', '')),
                })
        print(f'OK ({len(rows)} scholars)')
    except FileNotFoundError:
        print(f'FILE NOT FOUND')
    return rows


def load_student_surveys(filepath, appr_lookup):
    """
    Load student surveys. Returns dict: canonical_appr_name → list of survey dicts.
    Each survey dict: {scholar_name, school, confidence, enjoyment, learning, overall, session_date}
    """
    print(f'  → Loading student surveys…', end=' ', flush=True)
    by_appr = defaultdict(list)
    total = 0
    matched = 0
    try:
        with open(filepath, encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                total += 1
                filled_for = row.get('Filled For', '').strip()
                canonical = resolve_apprentice(filled_for, appr_lookup)
                if not canonical:
                    continue
                matched += 1
                by_appr[canonical].append({
                    'scholar_name': row.get('Filled By', '').strip(),
                    'school':       row.get('School', '').strip(),
                    'district':     row.get('District', '').strip(),
                    'session_id':   row.get('Pearl Session ID', '').strip(),
                    'date':         row.get('Date Responded', '').strip(),
                    'confidence':   safe_float(row.get('How confident are you that you understood the material in this tutoring session?', '')),
                    'enjoyment':    safe_float(row.get('How much did you enjoy this session with <aboutName>?', '') or
                                               row.get('How much did you enjoy this session with &lt;aboutName&gt;?', '')),
                    'learning':     safe_float(row.get('How much do you think you learned this session?', '')),
                    'overall':      safe_float(row.get('Overall, how did this tutoring session go?', '')),
                })
        print(f'OK ({matched:,} / {total:,} rows matched to apprentices)')
    except FileNotFoundError:
        print('FILE NOT FOUND')
    return dict(by_appr)


def fetch_pearl_att(appr_lookup):
    """
    Fetch Pearl ATT data live and extract:
      - Per-apprentice session IDs
      - Per-apprentice attendance (attended/missed)
      - Per-session scholars (for session-based attribution)
    Returns dict: canonical_name → {sessions, att_attended, att_missed, att_si, schools, districts}
    Also returns scholar_by_session: session_id → set of scholar names
    """
    print('\n  Fetching Pearl Attendance data…')
    text = fetch_url(PEARL_ATT_URL, 'Pearl ATT')
    if not text:
        print('  ⚠ Could not fetch Pearl ATT — attendance data will be unavailable')
        return {}, {}

    SI_MISS_REASONS = {
        'njtc internal issue/error', 'tutor vacancy',
        'scholar archived - removed from sessions',
        'unscheduled school closure/delay/dismissal',
        'njtc diagnostic testing', 'school-administered testing', 'school event',
        'scheduled/unscheduled school drill', 'haddon twp only -- program redevelopment',
        'half day', 'holiday - scheduled',
    }
    SCHOLAR_MISS_REASONS = {
        'absent', 'scholar declined attending tutoring session',
        'classroom teacher requested to keep scholar in class',
        'haddon twp only -- teacher requested whole group support',
        'scholar left early',
    }

    appr_data = {}
    session_scholars = defaultdict(set)   # session_id → set of scholar names
    session_appr     = {}                 # session_id → canonical apprentice name

    reader = csv.reader(StringIO(text))
    next(reader, None)  # skip header

    for row in reader:
        if len(row) < 14:
            continue
        role      = row[ATT_ROLE].strip()
        user_name = row[ATT_USER].strip()
        sess_id   = row[ATT_SESSION].strip()
        att_status= row[ATT_STATUS].strip().lower()
        miss_rsn  = row[ATT_MISS_RSN].strip().lower()
        school    = row[ATT_SCHOOL].strip()
        district  = row[ATT_DISTRICT].strip()

        if role == 'Instructor':
            canonical = resolve_apprentice(user_name, appr_lookup)
            if not canonical:
                continue
            if canonical not in appr_data:
                appr_data[canonical] = {
                    'sessions': set(), 'schools': set(), 'districts': set(),
                    'att_attended': 0, 'att_missed': 0, 'att_si': 0,
                }
            d = appr_data[canonical]
            if sess_id:
                d['sessions'].add(sess_id)
                session_appr[sess_id] = canonical
            if school:    d['schools'].add(school)
            if district:  d['districts'].add(district)
            if att_status in ('attended', 'late'):
                d['att_attended'] += 1
            elif miss_rsn in SI_MISS_REASONS:
                d['att_si'] += 1
            else:
                d['att_missed'] += 1

        elif role == 'Student':
            scholar_name = user_name
            if sess_id and scholar_name:
                session_scholars[sess_id].add(scholar_name)

    print(f'  ✓ Pearl ATT: {len(appr_data)} apprentices found in attendance data')
    return appr_data, dict(session_scholars)


# ══════════════════════════════════════════════════════════════
#  SCHOLAR ATTRIBUTION
# ══════════════════════════════════════════════════════════════

def build_scholar_attribution(appr_data, session_scholars, student_surveys, moy_by_school):
    """
    For each apprentice, determine their scholars using:
      1. Session-based: scholars who appeared in the same Pearl session (most accurate)
      2. Survey-based: scholars who filled out a survey about the apprentice
      3. School-based: all scholars at the apprentice's school (for single-apprentice schools only)

    Returns dict: canonical_appr_name → set of scholar_names with attribution method
    """
    attribution = defaultdict(dict)  # appr_name → {scholar_name: {'method': str, 'school': str}}

    # Pass 1: Session-based attribution (most accurate)
    for appr_name, d in appr_data.items():
        for sess_id in d['sessions']:
            scholars = session_scholars.get(sess_id, set())
            for s in scholars:
                if s not in attribution[appr_name]:
                    attribution[appr_name][s] = {'method': 'session', 'school': '', 'sessions': 0}
                attribution[appr_name][s]['sessions'] = attribution[appr_name][s].get('sessions', 0) + 1

    # Pass 2: Survey-based attribution (confirms relationship)
    for appr_name, surveys in student_surveys.items():
        for sv in surveys:
            s = sv['scholar_name']
            if not s:
                continue
            if s not in attribution[appr_name]:
                attribution[appr_name][s] = {'method': 'survey', 'school': sv['school'], 'sessions': 0}
            elif attribution[appr_name][s]['method'] == 'session':
                attribution[appr_name][s]['method'] = 'session+survey'
                if not attribution[appr_name][s]['school']:
                    attribution[appr_name][s]['school'] = sv['school']

    # Pass 3: School-based attribution for single-apprentice schools
    for display, nj_id, school_raw, region, survey_name in TAP_APPRENTICES:
        if school_raw in MULTI_APPRENTICE_SCHOOLS:
            continue  # Skip ambiguous multi-apprentice schools for school-based attribution
        if school_raw in STANDARDS_MASTERY_SCHOOLS or school_raw in NO_DATA_SCHOOLS:
            continue
        iready_schools = SCHOOL_MAP.get(school_raw, [])
        for iready_school in iready_schools:
            school_lower = iready_school.lower()
            for subj_key in ('ELA', 'Math'):
                scholars_at_school = moy_by_school.get(subj_key, {}).get(iready_school, [])
                for scholar_row in scholars_at_school:
                    s = scholar_row['full_name']
                    if not s:
                        continue
                    if s not in attribution[display]:
                        attribution[display][s] = {
                            'method':  'school',
                            'school':  iready_school,
                            'sessions': 0,
                        }

    return dict(attribution)


# ══════════════════════════════════════════════════════════════
#  ACADEMIC DATA MATCHING
# ══════════════════════════════════════════════════════════════

def build_moy_indices(ela_rows, math_rows):
    """Build lookup indices for MOY data."""
    ela_by_id   = {}   # student_id → row
    ela_by_name = {}   # norm_name → row
    ela_by_school = defaultdict(list)  # school → [row]

    math_by_id   = {}
    math_by_name = {}
    math_by_school = defaultdict(list)

    for row in ela_rows:
        if row['student_id']:
            ela_by_id[row['student_id']] = row
        if row['full_name']:
            ela_by_name[norm_name(row['full_name'])] = row
        ela_by_school[row['school']].append(row)

    for row in math_rows:
        if row['student_id']:
            math_by_id[row['student_id']] = row
        if row['full_name']:
            math_by_name[norm_name(row['full_name'])] = row
        math_by_school[row['school']].append(row)

    return {
        'ELA':  {'by_id': ela_by_id,  'by_name': ela_by_name,  'by_school': ela_by_school},
        'Math': {'by_id': math_by_id, 'by_name': math_by_name, 'by_school': math_by_school},
    }


def find_iready_record(scholar_name, subj_idx, hint_school=''):
    """Find iReady record for a scholar by name (and optionally school hint)."""
    by_id   = subj_idx['by_id']
    by_name = subj_idx['by_name']
    by_school = subj_idx['by_school']

    n = norm_name(scholar_name)

    # Exact name match
    if n in by_name:
        return by_name[n]

    # School-filtered name match (handle slight name variations)
    if hint_school:
        school_records = by_school.get(hint_school, [])
        for r in school_records:
            rn = norm_name(r['full_name'])
            # Last name + first initial match
            rparts = rn.split()
            nparts = n.split()
            if rparts and nparts and rparts[-1] == nparts[-1] and rparts[0][0] == nparts[0][0]:
                return r

    # Fuzzy: last name + first initial across all records
    nparts = n.split()
    if len(nparts) >= 2:
        for key, row in by_name.items():
            kparts = key.split()
            if kparts and kparts[-1] == nparts[-1] and kparts[0][0] == nparts[0][0]:
                return row

    return None


# ══════════════════════════════════════════════════════════════
#  PER-SCHOLAR ATTENDANCE FROM PEARL ATT
# ══════════════════════════════════════════════════════════════

def build_scholar_att_from_pearl(appr_data, session_scholars, pearl_att_text):
    """
    For each apprentice, build per-scholar attendance stats.
    Returns: appr_name → {scholar_name → {attended, missed, si}}
    """
    if not pearl_att_text:
        return {}

    SI_MISS = {
        'njtc internal issue/error', 'tutor vacancy',
        'scholar archived - removed from sessions',
        'unscheduled school closure/delay/dismissal',
        'njtc diagnostic testing', 'school-administered testing', 'school event',
        'scheduled/unscheduled school drill', 'haddon twp only -- program redevelopment',
        'half day', 'holiday - scheduled',
    }
    SCHOLAR_MISS = {
        'absent', 'scholar declined attending tutoring session',
        'classroom teacher requested to keep scholar in class',
        'haddon twp only -- teacher requested whole group support',
        'scholar left early',
    }

    # Build session → apprentice mapping from appr_data
    sess_to_appr = {}
    for appr_name, d in appr_data.items():
        for sess_id in d['sessions']:
            sess_to_appr[sess_id] = appr_name

    scholar_att = defaultdict(lambda: defaultdict(lambda: {'attended': 0, 'missed': 0, 'si': 0}))

    reader = csv.reader(StringIO(pearl_att_text))
    next(reader, None)

    for row in reader:
        if len(row) < 14:
            continue
        role       = row[ATT_ROLE].strip()
        user_name  = row[ATT_USER].strip()
        sess_id    = row[ATT_SESSION].strip()
        att_status = row[ATT_STATUS].strip().lower()
        miss_rsn   = row[ATT_MISS_RSN].strip().lower()

        if role != 'Student':
            continue
        appr_name = sess_to_appr.get(sess_id)
        if not appr_name:
            continue

        d = scholar_att[appr_name][user_name]
        if att_status in ('attended', 'late'):
            d['attended'] += 1
        elif miss_rsn in SI_MISS:
            d['si'] += 1
        else:
            d['missed'] += 1

    return {k: dict(v) for k, v in scholar_att.items()}


# ══════════════════════════════════════════════════════════════
#  REPORT BUILDING
# ══════════════════════════════════════════════════════════════

def build_report(
    appr_data,
    attribution,
    student_surveys,
    scholar_att,
    moy_indices,
):
    """Build summary and detail rows for the report."""

    # Build survey aggregates per apprentice → scholar
    survey_by_appr_scholar = defaultdict(lambda: defaultdict(list))
    for appr_name, surveys in student_surveys.items():
        for sv in surveys:
            sn = sv['scholar_name']
            survey_by_appr_scholar[appr_name][sn].append(sv)

    summary_rows = []
    detail_rows  = []

    for display, nj_id, school_raw, region, survey_name in TAP_APPRENTICES:

        note_academic = ''
        if school_raw in STANDARDS_MASTERY_SCHOOLS:
            note_academic = 'Standards Mastery (not iReady)'
        elif school_raw in PENDING_IREADY_SCHOOLS:
            note_academic = 'iReady data pending as of June 5'
        elif school_raw in NO_DATA_SCHOOLS:
            note_academic = 'No iReady data available'

        att_d = appr_data.get(display, {})
        appr_sessions = len(att_d.get('sessions', set()))
        appr_attended = att_d.get('att_attended', 0)
        appr_missed   = att_d.get('att_missed', 0)
        appr_si       = att_d.get('att_si', 0)
        appr_total    = appr_attended + appr_missed
        appr_att_rate = (appr_attended / appr_total * 100) if appr_total > 0 else None

        iready_schools = SCHOOL_MAP.get(school_raw, [])
        # Use Pearl schools if available, otherwise TAP schools
        pearl_schools  = att_d.get('schools', set())
        display_schools   = '; '.join(sorted(pearl_schools)) if pearl_schools else '; '.join(iready_schools)
        display_districts = '; '.join(sorted(att_d.get('districts', set())))

        scholars = attribution.get(display, {})

        for subj in ('Math', 'ELA'):
            subj_idx = moy_indices[subj]

            # Build scholar academic + survey records
            acad_records = []
            for scholar_name, attr_info in scholars.items():
                attr_method = attr_info.get('method', 'unknown')
                hint_school = attr_info.get('school', '')

                # Get iReady record
                ir = None
                if note_academic == '':
                    # Try to find the right school hint
                    if not hint_school and iready_schools:
                        hint_school = iready_schools[0]
                    ir = find_iready_record(scholar_name, subj_idx, hint_school)

                # Scholar attendance
                s_att = scholar_att.get(display, {}).get(scholar_name, {})
                s_attended = s_att.get('attended', None)
                s_missed   = s_att.get('missed', None)
                s_si       = s_att.get('si', None)
                s_total    = (s_attended or 0) + (s_missed or 0)
                s_att_rate = (s_attended / s_total * 100) if s_total > 0 and s_attended is not None else None

                # Scholar surveys
                scholar_surveys = survey_by_appr_scholar[display][scholar_name]
                sv_count = len(scholar_surveys)
                sv_conf  = avg([s['confidence'] for s in scholar_surveys])
                sv_enj   = avg([s['enjoyment']  for s in scholar_surveys])
                sv_lrn   = avg([s['learning']   for s in scholar_surveys])
                sv_ovr   = avg([s['overall']    for s in scholar_surveys])

                # Build detail row
                detail_rows.append({
                    'Apprentice Name':         display,
                    'NJ ID (TAP)':             nj_id,
                    'Region':                  region,
                    'School Assignment':        school_raw,
                    'Subject':                 subj,
                    'Scholar Name':            scholar_name,
                    'Attribution Method':      attr_method,
                    'Scholar School (iReady)': ir['school']  if ir else (hint_school or ''),
                    'Scholar Grade':           ir['grade']   if ir else '',
                    # Academic — BOY
                    'BOY Scale Score':          fmt_float(ir['boy_scale_score'], 0) if ir else '',
                    'BOY Placement (Relative)': ir['boy_placement']     if ir else '',
                    'BOY iReady Level':         ir['boy_iready_level']  if ir else '',
                    # Academic — MOY
                    'MOY Scale Score':          fmt_float(ir['moy_scale_score'], 0) if ir else '',
                    'MOY Placement (Relative)': ir['moy_placement']     if ir else '',
                    'MOY iReady Level':         ir['moy_iready_level']  if ir else '',
                    'Scale Score Gain (BOY→MOY)': fmt_float(ir['moy_gain'], 0) if ir else '',
                    'Placement Change (levels)': (
                        str(placement_diff(ir['boy_placement'], ir['moy_placement']))
                        if ir and ir['boy_placement'] and ir['moy_placement'] else ''
                    ),
                    '% of Typical Growth (MOY)': (
                        fmt_pct(ir['moy_pct_typical']) if ir and ir['moy_pct_typical'] is not None else ''
                    ),
                    'MOY Weeks Between Diagnostics': fmt_float(ir['moy_weeks'], 0) if ir else '',
                    'Rush Flag (BOY)':         ir['boy_rush_flag'] if ir else '',
                    'Rush Flag (MOY)':         ir['moy_rush_flag'] if ir else '',
                    # Scholar attendance
                    'Scholar Sessions Attended': s_attended if s_attended is not None else '',
                    'Scholar Sessions Missed':   s_missed   if s_missed   is not None else '',
                    'Scholar SI':                s_si       if s_si       is not None else '',
                    'Scholar Attendance Rate':   f'{s_att_rate:.1f}%' if s_att_rate is not None else '',
                    # Surveys
                    'Scholar Survey Count':    sv_count if sv_count > 0 else '',
                    'Avg Confidence (1-5)':    fmt_float(sv_conf, 2),
                    'Avg Enjoyment (1-5)':     fmt_float(sv_enj,  2),
                    'Avg Learning (1-5)':      fmt_float(sv_lrn,  2),
                    'Avg Overall (1-5)':       fmt_float(sv_ovr,  2),
                    # Data note
                    'Academic Data Note':       note_academic if note_academic else (
                        'iReady match found' if ir else 'No iReady match'
                    ),
                })

                acad_records.append({
                    'scholar_name': scholar_name,
                    'ir':           ir,
                    'sv_count':     sv_count,
                    'sv_conf':      sv_conf,
                    'sv_enj':       sv_enj,
                    'sv_lrn':       sv_lrn,
                    'sv_ovr':       sv_ovr,
                    's_attended':   s_attended,
                    's_missed':     s_missed,
                    's_att_rate':   s_att_rate,
                })

            # Aggregate academic metrics
            ir_records = [r['ir'] for r in acad_records if r['ir']]
            boy_scores = [r['boy_scale_score'] for r in ir_records if r['boy_scale_score'] is not None]
            moy_scores = [r['moy_scale_score'] for r in ir_records if r['moy_scale_score'] is not None]
            gains      = [r['moy_gain']        for r in ir_records if r['moy_gain']        is not None]
            pct_typicals=[r['moy_pct_typical']  for r in ir_records if r['moy_pct_typical'] is not None]

            # Placement distributions
            boy_dist = defaultdict(int)
            moy_dist = defaultdict(int)
            for r in ir_records:
                if r['boy_placement']:
                    boy_dist[r['boy_placement']] += 1
                if r['moy_placement']:
                    moy_dist[r['moy_placement']] += 1

            boy_total = sum(boy_dist.values())
            moy_total = sum(moy_dist.values())

            improved = sum(
                1 for r in ir_records
                if r['boy_placement'] and r['moy_placement']
                and placement_diff(r['boy_placement'], r['moy_placement']) is not None
                and placement_diff(r['boy_placement'], r['moy_placement']) > 0
            )
            maintained = sum(
                1 for r in ir_records
                if r['boy_placement'] and r['moy_placement']
                and placement_diff(r['boy_placement'], r['moy_placement']) == 0
            )
            declined = sum(
                1 for r in ir_records
                if r['boy_placement'] and r['moy_placement']
                and placement_diff(r['boy_placement'], r['moy_placement']) is not None
                and placement_diff(r['boy_placement'], r['moy_placement']) < 0
            )
            plc_total = improved + maintained + declined

            # Survey aggregates across all scholars
            all_sv_counts = [r['sv_count'] for r in acad_records]
            total_surveys = sum(all_sv_counts)
            all_sv_conf   = [r['sv_conf'] for r in acad_records if r['sv_conf'] is not None]
            all_sv_enj    = [r['sv_enj']  for r in acad_records if r['sv_enj']  is not None]
            all_sv_lrn    = [r['sv_lrn']  for r in acad_records if r['sv_lrn']  is not None]
            all_sv_ovr    = [r['sv_ovr']  for r in acad_records if r['sv_ovr']  is not None]

            def pct_dist(dist, total, label):
                cnt = dist.get(label, 0)
                return f'{cnt/total*100:.1f}%' if total > 0 else ''

            summary_rows.append({
                'Apprentice Name':            display,
                'NJ ID (TAP)':               nj_id,
                'Region':                    region,
                'School Assignment (TAP)':   school_raw,
                'Schools (Pearl)':           display_schools,
                'Districts (Pearl)':         display_districts,
                'Subject':                   subj,
                # Scholars
                'Total Scholars (Pearl sessions)': len(scholars) if scholars else 0,
                'Scholars w/ iReady Data':   len(ir_records),
                # Scale Scores
                'Avg BOY Scale Score':       fmt_float(avg(boy_scores)),
                'Avg MOY Scale Score':       fmt_float(avg(moy_scores)),
                'Avg Scale Score Gain (BOY→MOY)': fmt_float(avg(gains)),
                'Avg Annual Typical Growth': fmt_float(avg([r['annual_typical'] for r in ir_records if r.get('annual_typical')])),
                # Placement — BOY
                'BOY: 3+ Below %':           pct_dist(boy_dist, boy_total, '3 or More Grade Levels Below'),
                'BOY: 2 Below %':            pct_dist(boy_dist, boy_total, '2 Grade Levels Below'),
                'BOY: 1 Below %':            pct_dist(boy_dist, boy_total, '1 Grade Level Below'),
                'BOY: Early GL %':           pct_dist(boy_dist, boy_total, 'Early On Grade Level'),
                'BOY: At/Above GL %':        pct_dist(boy_dist, boy_total, 'Mid or Above Grade Level'),
                # Placement — MOY
                'MOY: 3+ Below %':           pct_dist(moy_dist, moy_total, '3 or More Grade Levels Below'),
                'MOY: 2 Below %':            pct_dist(moy_dist, moy_total, '2 Grade Levels Below'),
                'MOY: 1 Below %':            pct_dist(moy_dist, moy_total, '1 Grade Level Below'),
                'MOY: Early GL %':           pct_dist(moy_dist, moy_total, 'Early On Grade Level'),
                'MOY: At/Above GL %':        pct_dist(moy_dist, moy_total, 'Mid or Above Grade Level'),
                # Progress
                'Scholars Improved Placement': improved if plc_total > 0 else '',
                'Scholars Maintained Placement': maintained if plc_total > 0 else '',
                'Scholars Declined Placement': declined if plc_total > 0 else '',
                '% Improved Placement':      f'{improved/plc_total*100:.1f}%' if plc_total > 0 else '',
                'Avg % of Typical Growth (MOY)': fmt_pct(avg(pct_typicals)) if pct_typicals else '',
                # Surveys
                'Total Scholar Surveys':     total_surveys,
                'Avg Confidence (1-5)':      fmt_float(avg(all_sv_conf), 2),
                'Avg Enjoyment (1-5)':       fmt_float(avg(all_sv_enj),  2),
                'Avg Learning (1-5)':        fmt_float(avg(all_sv_lrn),  2),
                'Avg Overall (1-5)':         fmt_float(avg(all_sv_ovr),  2),
                # Apprentice Attendance
                'Appr Sessions Attended':    appr_attended if appr_attended else '',
                'Appr Sessions Missed':      appr_missed if appr_missed else '',
                'Appr Service Interruptions':appr_si if appr_si else '',
                'Appr Attendance Rate':      f'{appr_att_rate:.1f}%' if appr_att_rate is not None else '',
                'Academic Data Note':        note_academic,
            })

    return summary_rows, detail_rows


# ══════════════════════════════════════════════════════════════
#  CSV OUTPUT
# ══════════════════════════════════════════════════════════════

def write_csv(summary_rows, detail_rows, output_path):
    date_str = datetime.now().strftime('%Y-%m-%d %H:%M')

    lines = []
    lines.append('NJTC APPRENTICE IMPACT REPORT — SY 2025-2026')
    lines.append(f'Generated: {date_str}')
    lines.append('Academic data: iReady MOY (Winter 2026) — EOY incomplete as of June 5')
    lines.append('Sources: Pearl Operations (live) · iReady 25-26 Academic Report · TAP Tracker')
    lines.append('')

    # ── SECTION 1: Summary ────────────────────────────────────
    lines.append('SECTION 1: APPRENTICE SUMMARY (one row per apprentice × subject)')
    lines.append('Note: % of Typical Growth > 100% indicates scholar exceeded expected annual progress in the winter window')
    lines.append('')

    if summary_rows:
        headers = list(summary_rows[0].keys())
        lines.append(','.join(escape_csv(h) for h in headers))
        for row in summary_rows:
            lines.append(','.join(escape_csv(row.get(h, '')) for h in headers))

    lines.append('')
    lines.append('')

    # ── SECTION 2: Scholar Detail ─────────────────────────────
    lines.append('SECTION 2: INDIVIDUAL SCHOLAR DETAIL')
    lines.append('Attribution methods: session=Pearl session join (most accurate), session+survey=confirmed by both,')
    lines.append('survey=scholar completed a survey for this tutor, school=school-level attribution (single-apprentice school only)')
    lines.append('')

    if detail_rows:
        headers = list(detail_rows[0].keys())
        lines.append(','.join(escape_csv(h) for h in headers))
        for row in detail_rows:
            lines.append(','.join(escape_csv(row.get(h, '')) for h in headers))

    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        f.write('\n'.join(lines))

    print(f'\n✅ Report written to: {output_path}')
    print(f'   Section 1: {len(summary_rows)} summary rows (apprentice × subject)')
    print(f'   Section 2: {len(detail_rows)} scholar detail rows')


# ══════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════

def main():
    print('=' * 60)
    print('NJTC Apprentice Impact Report Generator')
    print('=' * 60)

    # ── File paths ───────────────────────────────────────────
    UPLOAD_DIR = '/root/.claude/uploads/ea8ebbca-cdd6-4790-986f-e4b2a1275217'
    ELA_MOY_CSV   = f'{UPLOAD_DIR}/00c47c00-Mid_Year_Academic_Reporting__ELA_MOY3.csv'
    MATH_MOY_CSV  = f'{UPLOAD_DIR}/832f679e-Mid_Year_Academic_Reporting__Math_MOY2.csv'
    STU_SURVEY_CSV= f'{UPLOAD_DIR}/95de3498-2526__Pearl_Attendance_and_Surveys__Student_Surveys.csv'
    OUTPUT_PATH   = '/home/user/New-Jersey-Tutoring-Corps-Portal/njtc_apprentice_impact_report.csv'

    # ── Build name lookup ────────────────────────────────────
    appr_lookup = build_apprentice_lookup()

    # ── Load MOY data ────────────────────────────────────────
    print('\n[1/5] Loading academic data…')
    ela_rows  = load_moy_csv(ELA_MOY_CSV,  'ELA')
    math_rows = load_moy_csv(MATH_MOY_CSV, 'Math')
    moy_indices = build_moy_indices(ela_rows, math_rows)

    # Build school → scholars mapping (for school-based attribution)
    moy_by_school = {
        'ELA':  moy_indices['ELA']['by_school'],
        'Math': moy_indices['Math']['by_school'],
    }

    # ── Load student surveys ─────────────────────────────────
    print('\n[2/5] Loading Pearl student surveys…')
    student_surveys = load_student_surveys(STU_SURVEY_CSV, appr_lookup)
    print(f'       Apprentices with surveys: {len(student_surveys)}')
    for name, svs in sorted(student_surveys.items(), key=lambda x: -len(x[1])):
        unique_scholars = len(set(s['scholar_name'] for s in svs))
        print(f'         {name}: {len(svs)} surveys from {unique_scholars} scholars')

    # ── Fetch Pearl ATT data ─────────────────────────────────
    print('\n[3/5] Fetching Pearl attendance data (live)…')
    pearl_att_text = fetch_url(PEARL_ATT_URL, 'Pearl ATT (attendance)')
    appr_data, session_scholars = ({}, {})
    if pearl_att_text:
        appr_data, session_scholars = fetch_pearl_att(appr_lookup)
        scholar_att = build_scholar_att_from_pearl(appr_data, session_scholars, pearl_att_text)
    else:
        scholar_att = {}
        print('  ⚠ Pearl ATT unavailable — attendance will be blank')

    # ── Build scholar attribution ────────────────────────────
    print('\n[4/5] Building scholar attribution…')
    attribution = build_scholar_attribution(appr_data, session_scholars, student_surveys, moy_by_school)

    total_scholars = sum(len(v) for v in attribution.values())
    print(f'   Total attributed scholars: {total_scholars}')
    for display, _, school_raw, region, _ in TAP_APPRENTICES:
        scholars = attribution.get(display, {})
        session_ct = sum(1 for v in scholars.values() if 'session' in v.get('method', ''))
        survey_ct  = sum(1 for v in scholars.values() if 'survey' in v.get('method', ''))
        school_ct  = sum(1 for v in scholars.values() if v.get('method') == 'school')
        if scholars:
            print(f'   {display}: {len(scholars)} scholars '
                  f'(session:{session_ct} survey:{survey_ct} school:{school_ct})')

    # ── Build report ─────────────────────────────────────────
    print('\n[5/5] Building report…')
    summary_rows, detail_rows = build_report(
        appr_data, attribution, student_surveys, scholar_att, moy_indices
    )

    # ── Write output ─────────────────────────────────────────
    write_csv(summary_rows, detail_rows, OUTPUT_PATH)

    # ── Coverage summary ─────────────────────────────────────
    print('\n── Academic Coverage Summary ──')
    matched    = sum(1 for r in detail_rows if 'iReady match found' in r.get('Academic Data Note', ''))
    no_match   = sum(1 for r in detail_rows if 'No iReady match'    in r.get('Academic Data Note', ''))
    pending    = sum(1 for r in detail_rows if 'pending'             in r.get('Academic Data Note', '').lower())
    std_mastery= sum(1 for r in detail_rows if 'Standards Mastery'   in r.get('Academic Data Note', ''))
    print(f'   iReady matched:    {matched}')
    print(f'   No iReady match:   {no_match}')
    print(f'   Pending data:      {pending}')
    print(f'   Standards Mastery: {std_mastery}')


if __name__ == '__main__':
    main()
