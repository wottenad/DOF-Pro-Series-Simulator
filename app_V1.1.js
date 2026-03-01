/*
    ==================================================================================
    DOF PRO-SERIES SIMULATOR v13.11.54 - COLOR TABLE EXPANSION + ANIM SIM MSG FIX
    ==================================================================================
    v13.11.32 CHANGES:

    FIX 1: Dark_violet (and 20 other DOF colors) missing from extractColor() fallback
    table. Dark_violet → null → '#FFFFFF' fallback → white pixels on matrix.
    Root cause: DOF uses color names from the CSS/HTML standard set, but our fallback
    table was incomplete. Any unrecognised color silently became white.
    Fix: Added full purple/violet family plus other common DOF palette entries:
         Dark_violet, Blue_violet, Dark_orchid, Orchid, Dark_slate_blue, Slate_blue,
         Medium_purple, Lavender, Rebecca_purple, Medium_violet_red, Hot_pink, Deep_pink,
         Crimson, Chartreuse, Spring_green, Medium_spring_green, Sky_blue, Steel_blue,
         Cornflower_blue, Midnight_blue, Dark_gray, Gray, Light_gray, Wheat, Tan,
         Sienna, Brown, Firebrick.
    Fallback table now 64 entries (was 36). Table is last resort — ini-loaded colors
    from the loaded cabinet file still take priority and are checked first.

    INVESTIGATION: Multi-color appearance in 4-layer AFDEN effect explained (no code bug)
    Effect: S1 Indigo/Dark_violet/Purple/Blue each with AFDEN10, layers L1-L4.
    Finding: The rendering method is NOT doing additive RGB blending. It is:
    (a) Layer sort: L1 drawn first → L4 drawn last. L4 always wins on any pixel
        that ALL layers agree to light (checkSparkle is deterministic per pixelId+now,
        so all layers share same pass/fail decision for any pixel in any frame).
    (b) DOM pixel persistence: pixels NOT selected this frame retain their previous
        frame's color — the DOM does not auto-clear between frames. This creates the
        appearance of multiple colors coexisting: they exist spatially on different
        pixels, reflecting the last time each pixel was selected by any active layer.
    (c) The white pixels were 100% caused by Dark_violet → white fallback (fix above).
    Architecture verdict: layer sort (ascending), pixel persistence, and overwrite
    semantics are all correct DOF hardware-equivalent behavior. No code changes needed
    to the rendering engine.

    FIX 2: Anim Sim empty-state message collapsed to one line to prevent the line-break
    misalignment visible when the panel is narrow. No CSS changes needed.

    ==================================================================================
    v13.11.31 CHANGES:

    FIX: Matrix coordinate calculation — double-floor rounding gap in drawColorFill
         and drawShapeScaled.

    Root cause: Two independent Math.floor() calls on AL and AW were applied separately:
        startX  = floor(AL/100 * mW)
        targetW = floor(AW/100 * mW)
    This means AL=90, AW=10 on a 114-column matrix gives:
        startX=102, targetW=11 → last painted column = 112
    But column 113 (the true right edge at 100%) is never lit.
    The rounding error is at most 1 column, but it creates a permanent gap at the
    right (or bottom) whenever AL+AW = 100% or AT+AH = 100%.

    Fix: Compute a floored END position from (AL+AW) as a single expression, then
    derive targetW from the difference:
        startX  = floor(AL/100 * mW)          [unchanged]
        endX    = floor((AL+AW)/100 * mW)     [NEW — single floor, no double-rounding]
        targetW = max(1, endX - startX)        [derived]
    For AL=90 AW=10: endX = floor(114.0) = 114, targetW = 12 → last column = 113 ✓
    For AL=0  AW=100: endX = floor(114.0) = 114, targetW = 114 → fills all columns ✓

    Fix applied to BOTH axes (X and Y) in BOTH functions:
    - drawColorFill: color fill for effects without SHP
    - drawShapeScaled: sprite rendering for SHP effects

    This was confirmed correct by the Pinscape Build Guide Appendix 6 (DOF Event Codes),
    which also validated that:
    - Bare numbers in DOF code are ALWAYS durations in ms (confirms v13.11.30 dur fix)
    - I{n} (with I prefix) is intensity on 0-48 scale — never a bare number
    - All other parameters (M, MAX, W, Blink, FU, FD, BPW, AL/AW/AT/AH, AS, AD,
      AFDEN/AFMIN/AFMAX, SHP, L layer) match our implementation exactly

    ==================================================================================
    v13.11.30 CHANGES:

    1. FIX: Sub-frame dur clamp (min one rAF frame).
       Any effect with a bare-numeric duration < 17ms is clamped UP to 17ms.
       DOF hardware evaluates at ~1ms; the simulator runs at 60fps (16.67ms/frame).
       A "Blue 10" effect (dur=10ms) was mathematically dead before requestAnimationFrame
       fired — the effect was invisible. Now it is guaranteed at least one visible frame.
       Old v13.11.29 fix (clamp <= 48 → 0) was wrong: it discarded real short durations.
       New fix (clamp < 17 → 17) is correct: preserves semantics, fixes visibility.

    2. FIX: Latch re-fire for short-dur effects.
       When all dur-based matrix effects expire while activeTriggers is non-empty
       (momentary held OR latched), parseActiveEffects() is called automatically
       to push fresh effects with a new startTime. This makes a 17ms-dur effect
       pulse continuously while the trigger is held, exactly as DOF hardware does.
       Guard: only re-fires when no infinite (dur=0) effects are present, so normal
       always-on effects (S1 Red AL0 AW100...) are not affected.

    3. FIX: extractColor() fallback table — hex values + Dark_green added.
       The old fallback returned CSS strings like 'Forest_green' (underscore) which
       browsers reject as invalid color names → effects rendered transparent.
       All fallback entries now return CSS hex values (#rrggbb).
       Added: Dark_green, Dark_red, Dark_blue, Dark_cyan, Dark_magenta, Navy,
              Maroon, Olive, Turquoise, Violet, Coral, Salmon, Khaki, Indigo,
              Plum, Light_blue.

    ==================================================================================
    v13.11.29 CHANGES:
    - ANIM SIM SPREADSHEET GRID VIEW in Code Monitor toolbar
    - FIX: Sub-frame dur clamp (see v13.11.30 for corrected version)
    ==================================================================================
    v13.11.28 CHANGES:
    - FIX T7: Remove dead AnimSim KV scan from parseActiveEffects (ran when activeEcode=null)
    - FIX T7: _animSimRenderEntry Step 4 split into two direct paths:
        · LED strips (KV cols 0-5): keyword-fuzzy match against cabinet.strips names
          → finds correct output number → registerEffect routes to strip visual
        · RGB toys (KV cols 6-11): writes toyEffects directly (bypasses registerEffect)
          → uses keyword match against Config2 display names → lamps light correctly
    - NOTE: L layer param confirmed absent in this CSV; all effects layer=0 by default;
            bitmap is ground layer by bitmapPixels[] architecture; no layer bug present
    v13.11.25 CHANGES:
    - FIX: Bitmap stored in as.bitmapPixels[] and re-applied every gameLoop frame — was
           wiped by clearAllVisuals() on every frame (16ms after first paint → all black)
    - FIX: Dropdown value restored to ecode after _animSimClear() resets it to ''
    - FIX: RGB toy name matching uses keyword-based fuzzy match (KV col names and Config2
           display names are entirely different name systems — direct lookup always missed)
    v13.11.24 CHANGES:
    - FIX: ABF segment no longer injected through registerEffect — was flooding matrix white
    - FIX: Proper RFC 4180 CSV parser replaces naive split — fixes 16 blank/wrong names
    - FIX: Sub-selector and status use separate DOM elements — sub-selector persists after pick
    - FIX: Dropdown reset on clear so re-selecting same entry re-fires onchange
    - FIX: _renderRgbToyPanel called from animSimConfirm — panel builds without table load
    - FIX: AnimSim KV scan path in parseActiveEffects — RGB toys light from AnimSim effects
    - FIX: RGB toy items restyled to match Physical toy row layout (12px lamp, horizontal)
    - CHG: Notes field removed from status line display
    v13.11.23 CHANGES:
    - FIX: GIF LZW decoder bitwise sign overflow — all pixels decoded correctly now
    - FIX: Column mapping off-by-2 in _animSimParseEffectsFile (colH→row[7], colsKV→row[8-19])
    - FIX: animFlag read from wrong column (Notes/G) — now reads col F correctly
    - FIX: Sparkle layer uses verbatim col H segment — preserves color (was hardcoded White)
    - FIX: nameXlsx embedded \\n stripped — E2048/E2054 titles now display correctly
    - FIX: Multi-row E-codes (E2025 etc) grouped with per-effect sub-selector buttons
    - FIX: (+x more) label replaced with cleaner "(shared by N PUP tables)" tooltip text
    - UI:  [Anim Sim] removed from code toolbar; dual toggle [Table View|Anim Sim] added
           to the top of the left panel, always visible after session confirm
    v13.11.22 CHANGES:

    1. FILE BADGE FIX: _restoreFileBadges() removed from init(). Green checkmarks
       only appear when files are actually uploaded in the current session.
       No more stale badges on fresh page load.

    2. CONFIRM SESSION GATE: "✓ Confirm Files & Continue" button beneath file inputs.
       Hard-validates Config30.ini is loaded. SELECT TABLE section hidden until
       button is clicked and validation passes.

    3. HEADER CSS FIX: header { } selector was missing in the CSS — theme selector,
       System Ready badge, and Help & Glossary were left-docking instead of right.
       Added explicit header { display:flex; justify-content:space-between } selector.

    4. ANIMATION SIMULATOR TAB: New "Anim Sim" tab in Code Reference modal (open via
       "Help & Glossary" button in header).
       - Upload effects XLSX/CSV, GIF sprite, and optional PUPDatabase.db
       - Parses 571 E-code entries; resolves display names from PUP DB
       - Type filter (Tables / Playlists / Both), sort (E code / A–Z), text search
       - Selects entry → renders GIF bitmap frame on LED matrix + sparkle overlay
       - Per-table K-V effects (PF strips, toys, RGB) routed through existing engine
       - Base programming ON effects injected for always-active toys
       - Data quality warning: E4053/E4054 use ABW244/ABH44 (spreadsheet error);
         renderer silently clamps to 232×32 and shows non-blocking yellow toast

    5. MOMENTARY TRIGGER FIX (trig/latch): M-param effects (minDur) were persisting
       after button release because heldEffects[] wasn't cleared. Fixed by flushing
       heldEffects[] on trig(false) and latch() toggle-off paths. parseActiveEffects()
       immediately re-registers held effects for any still-active/latched triggers,
       so minDur still works correctly for triggers that remain on.

    6. INSPECTOR MULTI-TRIGGER FIX (activateInspector/parseActiveEffects): Switching
       triggers in the layer inspector caused the previous trigger's M-param effect to
       persist alongside the new one (both rendered simultaneously). Fixed two ways:
       a) activateInspector() flushes heldEffects[] before parseActiveEffects().
       b) parseActiveEffects() heldEffects re-injection block is now guarded by
          !inspector.active — inspector mode always shows exactly one trigger.

    ==================================================================================
    v13.11.21 CHANGES:
    
    PARAMETER ENGINE — corrected against official DOF INI documentation:

    1. M{ms} — MINIMUM DURATION (was silently ignored)
       Effect stays visible for at least M ms after trigger fires, even if trigger
       releases early. Implemented via heldEffects[] — snapshots effects with minDur
       on each trigger change and re-injects them into matrixEffects until expiry.
       data.heldEffects[] added to App.data.

    2. Max{ms} — MAXIMUM DURATION (new)
       Hard cutoff: calculateOpacity returns 0 once elapsed >= maxDur ms.

    3. BPW{%} — BLINK PULSE WIDTH (was parsed but never applied)
       Controls the on/off ratio within a blink cycle. BPW20 on a 1000ms blink =
       200ms ON, 800ms OFF. Default remains 50 (equal on/off).
       Applied in calculateOpacity for both standard blink and blink+fade cases.

    4. BARE NUMERIC DURATION — "Red 500" (was silently ignored)
       A pure-digit token (no letter prefix) defines effect duration in ms.
       "Red 500" → ON for 500ms then off. "Red 500 FD200" → ON 500ms, fade out 200ms.
       Parsed via token-split: any token matching /^\d+$/ that isn't the Blink interval.

    5. BLINK COUNT — "Red 2500 5" (new)
       Two bare numerics: first = total duration, second = number of blinks.
       Effective blink interval = dur / blinkCount. "W32 Red 2500 5 F200" = blink 5×
       over 2500ms with 200ms fade.

    6. Blink N + FU/FD — COMBINED FADE WITHIN BLINK CYCLE (was broken)
       Previously: blink > 0 + fu/fd was falling into the simple blink branch, ignoring
       fade params. Now: if blink > 0 AND (fu > 0 OR fd > 0), the fade is applied
       WITHIN each blink cycle phase (FU during ON phase, FD during OFF phase).
       Fixes: Continuous fast pulse, Continuous slow pulse, all BPW+fade effects.

    ==================================================================================
    v13.11.3 CHANGES:

    - FIXED: Column→output mapping now uses HYBRID rule (reverts v13.11.1 regression).
             Rule: if numCols === numAssignedWS2811Outputs (6) → SPARSE mapping
                         (col N → sortedOutputs[N] = outputs 1,4,7,10,13,16)
                   else → SEQUENTIAL mapping (col N → output N+1)
             6-col rows: 172 tables use sparse (WS2811 direct assignment). These were
             broken by v13.11.1's universal sequential rule — col 4 (Matrix effects)
             was routing to output 5 (UNASSIGNED) instead of output 13 (Matrix).
             8,10,12,14,16,18-col rows: sequential still correct (diner col 9 → out 10).
             _getOutputNum(colIdx, numCols) centralises this logic for all 5 call sites.

    - FIXED: Format view legend now shows correct output numbers (1,4,7,10,13,16 for
             6-col tables) instead of 1,2,3,4,5,6 — automatic result of hybrid mapping.

    - NEW: Config1 INI file input (f-ini2) — loads directoutputconfig.ini for LedWiz
           physical toys. Triggers parsed into data.config1. loadTable() merges Config1
           triggers into the Active Toys / trigger list alongside Config30 triggers.
           This restores strobes, flashers, solenoids (S4, S9-S12 etc.) in acd_168hc.

    - NEW: Color-coded Code Monitor editor (backdrop technique). The textarea is kept
           for editing but its text color is made transparent. A <pre id="code-backdrop">
           sits behind it with colored <span> elements per CSV column. Synced on scroll.
           Colors match the Format view legend. caret-color:white preserved for editing.
           _setMonitorText(code) sets both layers. _updateBackdrop() re-syncs on input.

    v13.11.2: Color format view, L-trigger fix, variable wiring (had syntax error)
    v13.11.1: Column mapping + drawColorFill DOM fix (introduced sequential regression)
    v13.11.0: Variable/combo parsing foundation
    ==================================================================================

    - FIXED: L trigger false positives (L4, L6, L7, L8, L10 appearing as fake triggers).
             Root cause: AB-family params (ABF, ABT, ABL, ABW, ABH, AAC, AABO, BNP, etc.)
             before a trailing Lxx were not in the layer-parameter filter regex.
             New rule: if Lxx appears at the VERY END of a layer string (after trimming)
             and the string is not solely "Lxx" (which would make it a standalone lamp
             trigger), it is always a layer parameter — regardless of what precedes it.
             Applied in: loadTable trigger enumeration and openToyInspector.

    - FIXED: Variable @substitution@ now wired to rendering.
             loadTable() now expands @variable@ tokens before setting code-monitor value.
             Table-specific overrides (from [TableVariables]) applied per-ROM first.
             All rendering (parseActiveEffects, inspector, format view) now sees
             fully-resolved effect strings automatically. This fixes "diner" showing
             nothing — its Backglass Rear effects were @strblft@ / @strbrgt@ tokens
             that never expanded to their actual SHP/color/area parameters.

    - NEW: Color-coded output mapping in Formatted Code View.
           Each CSV column is shown with a distinct hue matching its output assignment.
           Unassigned outputs (no hardware in toyMap) displayed in dim gray.
           The strip rack and matrix display now show a matching color label/border
           so you can instantly correlate "this code → this hardware."
           getOutputColor(n) — deterministic hue based on output number.
           renderOutputLegend() — shows full output→hardware→color mapping.

    v13.11.1: Column mapping fix (colIdx+1), drawColorFill DOM path fix
    v13.11.0: Variable/combo parsing foundation
    ==================================================================================

    - FIXED: CSV column→output mapping was wrong everywhere (sortedOutputs[colIdx]).
             Correct mapping is always outputNum = colIdx + 1 (sequential output
             numbering). This fixes tables like "diner" whose effects sit at columns
             9+ and were being silently dropped because the sparse array had no entry
             past index 5.  Affected: loadTable, parseActiveEffects,
             renderFormattedCode.

    - FIXED: drawColorFill used document.getElementById('matrix-canvas') which does
             not exist in the HTML (only helper-canvas / sprite-canvas exist).
             All non-AFDEN matrix fills (solid fills, scrolling areas, ADL/ADR/ADU/ADD
             motion effects) silently returned without drawing anything.
             Fixed by replacing the dead canvas path with the same DOM-pixel loop
             already used by the AFDEN path — consistent, correct, and always works.

    v13.11.0: Foundation — variable/combo parsing (no rendering changes)
    v13.10.3: Configuration collapse, legend fixes, strip index labels
    ==================================================================================
    - NEW: data.variables     — Global @variable@ macro map from [Variables DOF]
    - NEW: data.tableVariables — Per-ROM variable overrides from [TableVariables]
    - NEW: data.combos         — Combo definitions from Cabinet JSON
    - NEW: parseVariablesDOF() — Parses [Variables DOF] section (all INI files)
    - NEW: parseTableVariables()— Parses [TableVariables] section (all INI files)
    - NEW: loadCabinetJSON()   — Loads Cabinet JSON for combo definitions
    - NEW: parseComboDefinitions() — Extracts combo name → toy array map
    - NEW: substituteVariables()   — Resolves @var@ tokens (built but NOT yet called
                                    in rendering — activates in v13.11.1)
    - NEW: f-json file input in UI (optional Cabinet JSON upload)
    - CONSOLE LOGGING: All parsed structures logged on load for verification

    v13.10.3: Configuration collapse, legend fixes, strip index labels
    v13.10.1: 3-column layout, collapsible config panel
    ==================================================================================
*/

const App = {
    data: {
        cabinet: { matrix: null, strips: [], toyMap: new Map(), stripNames: new Set() },
        config30: {},
        config30Header: null, // v13.12.0: parsed column names from Config30 header comment
        config1:  {},   // v13.11.3: LedWiz / Config1 physical toys
        config2:  {},   // v13.11.8: LedWiz 2 RGB toys (optional)
        config2Header: null, // v13.11.15: parsed column names from Config2 header comment
        config1ToyMap: new Map(), // v13.11.8: outNum → toy name for Config1
        config2ToyMap: new Map(), // v13.11.8: outNum → toy name for Config2
        enabledPhysicalToys: new Set(), // v13.11.9: which Config1 toys are checked active
        colors: new Map(),
        shapes: new Map(),
        shapeAtlas: null,
        activeTriggers: new Set(),
        latchedTriggers: new Set(),
        defaultActiveToyIds: new Set(),  // v13.11.20: baseline toyIds when no triggers active
        defaultMatrixCount: 0,           // v13.11.20: baseline matrix effect count at table load
        matrixEffects: [], 
        stripEffects: new Map(),
        toyEffects: new Map(),
        lastFrameTime: 0,
        
        inspector: { active: false, trigger: null, toyName: null, layerFilter: null },

        // ── v13.11.0: New parsing structures ─────────────────────────────────────
        // Global @variable@ macros from [Variables DOF] section.
        // Map<string, string>  e.g.  "flshemulo" → "AH100 AL0 AT0 AW19 SHPCircle3"
        variables: new Map(),

        // Per-ROM variable overrides from [TableVariables] section.
        // Map<romName, Map<varName, value>>
        // e.g. tableVariables.get("diner").get("flshemulo") → "AH100 AL0 AT0 AW19 SHPLetterD"
        tableVariables: new Map(),

        // Combo definitions from Cabinet JSON.
        // Map<comboName, { id, name, toyIds[] }>
        // e.g. combos.get("Combo4-Custom MX1") → { id:1004, name:"...", toyIds:[110,83,87] }
        combos: new Map(),

        // v13.11.21: heldEffects — matrix effects with minDur (M param) that should
        // remain visible after their trigger deactivates, until minDur expires.
        // Each entry: standard effect object + heldUntil (absolute timestamp ms).
        heldEffects: [],

        // v13.11.22: Animation Simulator state ─────────────────────────────────
        animSim: {
            entries: [],           // Parsed AnimEntry objects from XLSX/CSV
            baseProgramming: [],   // K-V effects from row 1 (ON-keyword only)
            gifFrames: [],         // Extracted GIF frames as ImageData[], indexed by frame number
            bitmapPixels: [],      // v13.11.25: current frame's painted pixels {domIdx,r,g,b} — re-applied each gameLoop
            kvMap: {},             // v13.11.27: persistent KV column → cabinet output mapping (saved to localStorage)
            gifWidth: 232,         // Actual GIF canvas width (px)
            gifHeight: 32,         // Actual GIF canvas height (px)
            gifFilename: null,     // Uploaded GIF filename (normalised)
            gifVersionsReferenced: [], // Unique values from XLSX col D
            pupMap: new Map(),     // ecode → GameDisplay[]
            activeEcode: null,     // Currently selected E code string
            sessionActive: false,  // True once confirm button passed
            typeFilter: 'both',    // 'table' | 'playlist' | 'both'
            sortMode: 'ecode',     // 'ecode' | 'alpha'
            searchStr: '',         // Live search filter text
        },
    },

    // ── v13.11.3: Output color palette ───────────────────────────────────────────
    // Returns a CSS color string for a given 1-based output number.
    // Assigned outputs (present in toyMap) get vivid hues; unassigned get gray.
    // Hues are spaced to be visually distinct and chosen to avoid red/green-only.
    _OUTPUT_HUES: [210, 30, 140, 300, 55, 185, 345, 95, 255, 15, 170, 330, 75, 220, 0, 125, 270, 45],

    // ── v13.11.29: Anim Sim spreadsheet column definitions ───────────────────────
    // Fixed per-column color and label for the live spreadsheet view.
    // Metadata cols (A-G): muted tones. Matrix col (H): bright cyan. KV cols (I-T): vivid distinct hues.
    _ANIMSIM_COL_DEFS: [
        { key: 'nameXlsx', label: 'Name',              color: '#7a8a9a', width: 120 },
        { key: 'type',     label: 'Type',              color: '#5a7a9a', width: 68  },
        { key: 'ecode',    label: 'E-Code',            color: '#c8d8e8', width: 60  },
        { key: 'gifVer',   label: 'GIF Version',       color: '#6a8a6a', width: 110 },
        { key: 'desc',     label: 'Description',       color: '#7a6a9a', width: 140 },
        { key: 'animFlag', label: 'Frame Type',        color: '#8a7a5a', width: 90  },
        { key: 'notes',    label: 'Notes',             color: '#4a5a5a', width: 90  },
        { key: 'colH',     label: 'Custom MX 1',       color: '#00e5ff', width: 260 },
        { key: 'kv0',      label: 'PF Left MX HD',     color: 'hsl(210,65%,55%)', width: 200 },
        { key: 'kv1',      label: 'PF Right MX HD',    color: 'hsl(30,65%,55%)',  width: 200 },
        { key: 'kv2',      label: 'Flipper Button MX', color: 'hsl(140,65%,48%)', width: 180 },
        { key: 'kv3',      label: 'Magnasave Left MX', color: 'hsl(300,65%,58%)', width: 180 },
        { key: 'kv4',      label: 'Magnasave Right MX',color: 'hsl(55,70%,50%)',  width: 180 },
        { key: 'kv5',      label: 'Fire MX',           color: 'hsl(185,65%,50%)', width: 160 },
        { key: 'kv6',      label: 'RGB Undercab Cmplx',color: 'hsl(345,65%,58%)', width: 190 },
        { key: 'kv7',      label: 'RGB Undercab Smart', color: 'hsl(95,60%,48%)',  width: 180 },
        { key: 'kv8',      label: 'RGB Flipper',        color: 'hsl(255,65%,62%)', width: 150 },
        { key: 'kv9',      label: 'RGB Left Magnasave', color: 'hsl(15,65%,56%)',  width: 180 },
        { key: 'kv10',     label: 'RGB Right Magnasave',color: 'hsl(170,65%,48%)', width: 190 },
        { key: 'kv11',     label: 'RGB Fire Button',    color: 'hsl(330,65%,58%)', width: 170 },
    ],

    getOutputColor(outputNum) {
        const hwName = this.data.cabinet.toyMap.get(outputNum);
        if (!hwName) return '#444'; // unassigned output — dark gray
        const hue = this._OUTPUT_HUES[(outputNum - 1) % this._OUTPUT_HUES.length];
        return `hsl(${hue}, 65%, 52%)`;
    },

    // ── v13.11.3: Hybrid column→output mapping ────────────────────────────────
    // WS2811 has 6 outputs at non-contiguous positions [1,4,7,10,13,16].
    // 6-column rows (172 tables): SPARSE — each col maps to the Nth assigned output.
    // All other column counts: SEQUENTIAL — col N → output N+1.
    _getOutputNum(colIdx, numCols) {
        const sortedOutputs = Array.from(this.data.cabinet.toyMap.keys()).sort((a, b) => a - b);
        if (numCols === sortedOutputs.length && sortedOutputs.length > 0) {
            // SPARSE: exact column count matches assigned output count
            return sortedOutputs[colIdx] ?? null;
        }
        // SEQUENTIAL: covers 8,10,12,14,16,18-col rows (diner, etc.)
        return colIdx + 1;
    },

    // ── v13.11.11: Code monitor — contenteditable <div> (replaces textarea+backdrop) ─
    // A single <div id="code-monitor" contenteditable="true"> does both display and
    // editing. Colored <span> children show column colors; the browser renders
    // selection highlight directly on the visible text, so there is no shift.
    // Caret position is saved/restored around every innerHTML rebuild.

    _getMonitorText() {
        const el = document.getElementById('code-monitor');
        if (!el) return '';
        // innerText includes linebreaks from <br>/block elements.
        // DOF code is a single logical line — collapse any linebreaks.
        return (el.innerText || el.textContent || '').replace(/\r?\n/g, '');
    },

    _setMonitorText(code) {
        const el = document.getElementById('code-monitor');
        if (!el) return;
        el.innerHTML = this._buildColoredHTML(code);
    },

    // Build the colored-span innerHTML for a given plain-text DOF code string.
    _buildColoredHTML(text) {
        const cols = text.split(/,(?![^(]*\))/);
        let html = '';
        cols.forEach((colStr, colIdx) => {
            const outputNum = this._getOutputNum(colIdx, cols.length);
            const color = outputNum ? this.getOutputColor(outputNum) : '#555';
            const hwName = outputNum ? (this.data.cabinet.toyMap.get(outputNum) || '') : '';
            const safe = colStr.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            const title = outputNum ? `OUT ${outputNum}${hwName ? ' → ' + hwName : ''}` : 'UNASSIGNED';
            html += `<span class="cm-col" style="--col-color:${color};" title="${title}">${safe}</span>`;
            if (colIdx < cols.length - 1) {
                html += `<span class="cm-comma" style="color:${color};">,</span>`;
            }
        });
        return html;
    },

    // Rebuild colored spans in-place, preserving the caret position.
    _updateBackdrop(code) {
        const el = document.getElementById('code-monitor');
        if (!el) return;
        const text = (code !== undefined) ? code : this._getMonitorText();
        const offset = this._saveCaretOffset(el);
        el.innerHTML = this._buildColoredHTML(text);
        this._restoreCaretOffset(el, offset);
    },

    // Returns the character offset of the cursor from the start of the element.
    _saveCaretOffset(el) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return 0;
        const range = sel.getRangeAt(0).cloneRange();
        range.selectNodeContents(el);
        range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
        return range.toString().length;
    },

    // Restores cursor to a given character offset after innerHTML rebuild.
    _restoreCaretOffset(el, offset) {
        if (offset === 0 && el.childNodes.length === 0) return;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        let remaining = offset;
        let node;
        while ((node = walker.nextNode())) {
            if (remaining <= node.textContent.length) {
                try {
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.setStart(node, remaining);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                } catch(e) { /* ignore edge cases */ }
                return;
            }
            remaining -= node.textContent.length;
        }
        // Fallback: caret at end
        try {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(el);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        } catch(e) {}
    },

    init() {
        // v13.11.22 FIX: _restoreFileBadges() removed from init().
        // Stale localStorage badges caused green checkmarks to appear on fresh page
        // load even though no files were actually loaded in the current session.
        // Badges are now rendered ONLY inside the file load handlers after
        // successful file validation. _saveFileBadge() still writes to localStorage
        // for reference, but _renderFileBadge() is not called here.

        document.getElementById('f-cab').onchange = e => {
            const file = e.target.files[0]; if (!file) return;
            this.loadCabinet(file);
            this._saveFileBadge('f-cab', file.name);
        };
        document.getElementById('f-ini').onchange = e => {
            this.loadConfig(e.target.files[0]);
            this._saveFileBadge('f-ini', e.target.files[0]?.name);
        };
        // v13.11.3: Config1 (LedWiz physical toys — directoutputconfig.ini)
        const fIni2 = document.getElementById('f-ini2');
        if (fIni2) fIni2.onchange = e => {
            this.loadConfig1(e.target.files[0]);
            this._saveFileBadge('f-ini2', e.target.files[0]?.name);
        };
        const fIni3 = document.getElementById('f-ini3');
        if (fIni3) fIni3.onchange = e => {
            this.loadConfig2(e.target.files[0]);
            this._saveFileBadge('f-ini3', e.target.files[0]?.name);
        };
        document.getElementById('f-sxml').onchange = e => {
            this.loadShapesXML(e.target.files[0]);
            this._saveFileBadge('f-sxml', e.target.files[0]?.name);
        };
        document.getElementById('f-spng').onchange = e => {
            this.loadShapesPNG(e.target.files[0]);
            this._saveFileBadge('f-spng', e.target.files[0]?.name);
        };
        // v13.11.0: Cabinet JSON for combo definitions (optional)
        const fJson = document.getElementById('f-json');
        if(fJson) fJson.onchange = e => {
            this.loadCabinetJSON(e.target.files[0]);
            this._saveFileBadge('f-json', e.target.files[0]?.name);
        };
        // v13.11.22: Anim Sim file inputs — wired in init() so badges update on selection.
        // Actual parsing is deferred until animSimConfirm() is pressed.
        const asEffects = document.getElementById('as-f-effects');
        if (asEffects) asEffects.onchange = e => {
            const f = e.target.files[0]; if (!f) return;
            const ext = f.name.toLowerCase().split('.').pop();
            if (!['xlsx','csv'].includes(ext)) {
                alert('Effects file must be .xlsx or .csv'); e.target.value = ''; return;
            }
            this._saveFileBadge('as-f-effects', f.name);
        };
        const asGif = document.getElementById('as-f-gif');
        if (asGif) asGif.onchange = e => {
            const f = e.target.files[0]; if (!f) return;
            if (!f.name.toLowerCase().endsWith('.gif')) {
                alert('GIF file must be .gif'); e.target.value = ''; return;
            }
            this._saveFileBadge('as-f-gif', f.name);
        };
        const asDb = document.getElementById('as-f-db');
        if (asDb) asDb.onchange = e => {
            const f = e.target.files[0]; if (!f) return;
            if (!f.name.toLowerCase().endsWith('.db')) {
                alert('Database file must be .db'); e.target.value = ''; return;
            }
            this._saveFileBadge('as-f-db', f.name);
        };
        document.getElementById('rom-select').onchange = e => this.loadTable(e.target.value);

        // v13.11.11: contenteditable div events (replaces textarea oninput + scroll sync)
        const monitor = document.getElementById('code-monitor');
        if (monitor) {
            // Rebuild colored spans on every edit, preserving caret
            monitor.addEventListener('input', () => {
                this._updateBackdrop();
                this.parseActiveEffects();
            });
            // Intercept paste: strip HTML, insert plain text only
            monitor.addEventListener('paste', e => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text/plain');
                // Insert at current selection
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(text));
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                // Rebuild colors after paste
                this._updateBackdrop();
                this.parseActiveEffects();
            });
            // Prevent Enter from creating block elements (DOF code is one logical line)
            monitor.addEventListener('keydown', e => {
                if (e.key === 'Enter') e.preventDefault();
            });
        }
        
        // Init Drag for Inspector
        this.dragElement(document.getElementById("draggable-inspector"));
        this.dragElement(document.getElementById("code-ref-panel")); // v13.11.20: Code Reference modal
        
        requestAnimationFrame(this.gameLoop.bind(this));
        
    },

    setTheme(name) {
        document.body.setAttribute('data-theme', name);
        // v13.13.0: Sync the single theme selector
        const sel = document.getElementById('theme-selector');
        if (sel) sel.value = name;
    },

    toggleSection(id, btn) {
        const el = document.getElementById(id);
        // v13.11.12: Use lastElementChild (direct child accessor) NOT querySelector.
        // querySelector('span:last-child') does depth-first traversal and finds the
        // nested sec-desc span first, overwriting the legend text permanently.
        const span = btn.lastElementChild;
        if(el.classList.contains('collapsed')) {
            el.classList.remove('collapsed');
            span.innerText = '[-]';
        } else {
            el.classList.add('collapsed');
            span.innerText = '[+]';
        }
        // v13.11.20: Removed the manual codeSec.style.flex hack — .section-content-code
        // now uses flex:1 in CSS so it fills available space automatically.
    },

    toggleHelp() {
        const el = document.getElementById('help-modal');
        if(el.classList.contains('open')) { el.classList.remove('open'); } else { el.classList.add('open'); }
    },

    // ── v13.11.42: Matrix display controls ───────────────────────────────────
    // Brightness: CSS filter:brightness() on #led-matrix — boosts apparent LED glow
    // without touching any per-pixel color logic. Scale: 0.5 (dim) → 3.0 (very bright).
    // Gap: CSS gap on the matrix grid — widens spacing between pixels to simulate
    // different LED panel pitches. Each pixel stays its computed size; the gap adds
    // dead space between them, like real panels with larger pitch.

    setMatrixBrightness(val) {
        const n = parseFloat(val);
        const matrix = document.getElementById('led-matrix');
        if (matrix) matrix.style.filter = n === 1 ? '' : `brightness(${n})`;
        const label = document.getElementById('matrix-brightness-val');
        if (label) label.textContent = n.toFixed(2).replace(/\.?0+$/, '') + '×';
        this.data.matrixBrightness = n;
    },

    setMatrixGap(val) {
        const n = parseFloat(val);
        const matrix = document.getElementById('led-matrix');
        if (matrix) matrix.style.gap = n === 0 ? '' : `${n}px`;
        const label = document.getElementById('matrix-gap-val');
        if (label) label.textContent = n % 1 === 0 ? `${n}px` : `${n}px`;
        this.data.matrixGap = n;
    },

    // ── v13.11.40: CODE SIM ───────────────────────────────────────────────────
    // Floating panel that fires any pasted DOF effect string on selected outputs
    // without needing a valid trigger code. Supports momentary (M) and latch (L).

    toggleCodeSim() {
        const panel = document.getElementById('code-sim-panel');
        if (!panel) return;
        const isVisible = panel.style.display !== 'none';
        if (isVisible) {
            // Close — clear any live effect and hide
            this._codeSimRelease();
            panel.style.display = 'none';
            document.getElementById('btn-code-sim')?.classList.remove('active');
        } else {
            panel.style.display = 'flex';
            document.getElementById('btn-code-sim')?.classList.add('active');
            this._codeSimBuildOutputs();
            if (!this._codeSimDragInit) {
                this.dragElement(panel); // register drag once only
                this._codeSimDragInit = true;
            }
        }
    },

    // v13.12.0: Toggle strip display between equal-width and realistic 1px mode
    toggleStripWidth() {
        const rack = document.getElementById('strip-rack');
        const btn  = document.getElementById('strip-width-btn');
        if (!rack) return;
        rack.classList.toggle('strip-1px');
        if (btn) btn.classList.toggle('active', rack.classList.contains('strip-1px'));
    },

    // Build the output checkboxes from currently loaded cabinet data.
    // Called each time the panel opens so it reflects the current session.
    _codeSimBuildOutputs() {
        const container = document.getElementById('code-sim-outputs');
        if (!container) return;

        let html = `<label class="code-sim-out-label code-sim-out-matrix">
            <input type="checkbox" class="code-sim-cb" data-target="matrix" checked> Matrix
        </label>`;

        // Named LED strips
        if (this.data.cabinet?.strips?.length) {
            this.data.cabinet.strips.forEach((strip, idx) => {
                html += `<label class="code-sim-out-label code-sim-out-strip">
                    <input type="checkbox" class="code-sim-cb" data-target="strip" data-idx="${idx}" data-name="${strip.name}"> ${strip.name}
                </label>`;
            });
        }

        // RGB toys
        const rgbToys = this._buildRgbToyMap?.() || [];
        rgbToys.forEach(toy => {
            html += `<label class="code-sim-out-label code-sim-out-rgb">
                <input type="checkbox" class="code-sim-cb" data-target="rgb" data-name="${toy.displayName}"> ${toy.displayName}
            </label>`;
        });

        container.innerHTML = html;
    },

    // Fire the pasted effect string on all checked output targets.
    // Splits on '/' so multi-segment strings (Blue.../Red W50.../Yellow W100...) each register independently.
    // v13.11.44: Shared segment parameter parser for all strip/RGB bypass push paths.
    // registerEffect() parses all params via the same logic but is tightly coupled to
    // hardware routing. Code Sim and AnimSim KV fallback paths that push directly to
    // stripEffects / toyEffects were only extracting color/at/ah/as/afden/layer — all
    // timing, fade, and blink fields were hardcoded to zero, breaking FD/FU/Blink/dur
    // for any effect routed to strips or RGB toys through those paths.
    //
    // Returns an object with every field needed by calculateOpacity, drawColorFill,
    // and the strip/toy render loops.
    _parseSegParams(seg) {
        const color  = this.extractColor(seg) || '#ffffff';
        const layerM = seg.match(/(?<![A-Za-z])L(-?\d+)\b/);
        const layer  = layerM ? parseInt(layerM[1]) : 0;
        const waitM  = seg.match(/(?<![A-Za-z])W(\d+)\b/);
        const wait   = waitM  ? parseInt(waitM[1])  : 0;
        const at     = parseInt(this.extractParam(seg, 'AT')    ?? 0);
        const ah     = parseInt(this.extractParam(seg, 'AH')    ?? 100);
        const as_    = parseInt(this.extractParam(seg, 'AS')    ?? 0);
        const afden  = parseInt(this.extractParam(seg, 'AFDEN') ?? 0);
        const afmin  = parseInt(this.extractParam(seg, 'AFMIN') ?? 0);
        const afmax  = parseInt(this.extractParam(seg, 'AFMAX') ?? 0);
        const fu     = parseInt(this.extractParam(seg, 'fu')    ?? 0);  // FU case-insensitive
        const fd     = parseInt(this.extractParam(seg, 'fd')    ?? 0);  // FD case-insensitive
        const fade   = parseInt(this.extractParam(seg, 'F')     ?? 0);  // F alone (not FU/FD)
        const bpwRaw = this.extractParam(seg, 'BPW');
        const bpw    = bpwRaw !== null ? Math.max(1, Math.min(99, parseInt(bpwRaw))) : 50;
        const maxDurM= seg.match(/\bMax(\d+)\b/i);
        const maxDur = maxDurM ? parseInt(maxDurM[1]) : 0;
        const minDurM= seg.match(/(?<![A-Za-z])M(\d+)\b/);
        const minDur = minDurM ? parseInt(minDurM[1]) : 0;
        // Blink keyword + optional interval
        let blink = 0;
        const blinkMatch = seg.match(/Blink\s*(\d+)/i);
        if (blinkMatch) { blink = parseInt(blinkMatch[1]); }
        else if (/Blink/i.test(seg)) { blink = -1; }
        // Bare numeric duration (first pure-digit token not immediately after Blink)
        const tokens = seg.split(/\s+/);
        const blinkTokIdx = tokens.findIndex(t => /^blink$/i.test(t));
        const pureNums = tokens
            .filter((t, i) => /^\d+$/.test(t) && !(blinkTokIdx >= 0 && i === blinkTokIdx + 1))
            .map(Number);
        const rawDur = pureNums[0] || 0;
        const dur    = (rawDur > 0 && rawDur < 17) ? 17 : rawDur;
        let effectBlink = blink;
        if (dur > 0 && (pureNums[1] || 0) > 0 && blink === 0) {
            effectBlink = Math.max(1, Math.round(dur / pureNums[1]));
        }
        return { color, layer, wait, at, ah, as: as_, afden, afmin, afmax,
                 fu, fd, fade, bpw, blink: effectBlink, dur, maxDur, minDur };
    },

    _codeSimFire() {
        const input = document.getElementById('code-sim-input');
        const raw = input?.value?.trim();
        if (!raw) return;

        const segments = raw.split('/').map(s => s.trim()).filter(Boolean);
        const checkboxes = document.querySelectorAll('#code-sim-outputs .code-sim-cb:checked');

        checkboxes.forEach(cb => {
            const target = cb.dataset.target;
            segments.forEach(seg => {
                if (target === 'matrix') {
                    const outNum = this._animSimGetMatrixOutputNum?.() ?? null;
                    if (outNum !== null) {
                        this.registerEffect(seg, outNum);
                    } else {
                        // v13.13.22 FIX: No matrix output mapped — check if seg has a shape.
                        // Shapes route fine through registerEffect, but plain color fills
                        // (no SHP, no AH/AW params) get silently dropped because
                        // registerEffect's fallback requires explicit AH/AW or a named output.
                        // Parse and push color fills directly to matrixEffects.
                        const hasShape = /\bSHP\w/i.test(seg) || /@\w+@/.test(seg);
                        if (hasShape) {
                            this.registerEffect(seg, -1);
                        } else {
                            const p = this._parseSegParams(seg);
                            const al = parseInt(this.extractParam(seg, 'AL') || 0);
                            const aw = parseInt(this.extractParam(seg, 'AW') || 100);
                            let adDirX = 0, adDirY = 0;
                            if (/\b(ADL|ASDL)\b/i.test(seg)) { adDirX = -1; }
                            else if (/\b(ADR|ASDR)\b/i.test(seg)) { adDirX = 1; }
                            else if (/\b(ADU|ASDU)\b/i.test(seg)) { adDirY = -1; }
                            else if (/\b(ADD|ASDD)\b/i.test(seg)) { adDirY = 1; }
                            this.data.matrixEffects.push({
                                shapeName: null, color: p.color,
                                al, at: p.at, aw, ah: p.ah,
                                as: p.as, adDirX, adDirY,
                                blink: p.blink, bpw: p.bpw, fu: p.fu, fd: p.fd,
                                dur: p.dur, maxDur: p.maxDur, minDur: p.minDur,
                                blinkCount: 0, afden: p.afden, afmin: p.afmin, afmax: p.afmax,
                                layer: p.layer, fade: p.fade,
                                startTime: Date.now() + (p.wait || 0)
                            });
                        }
                    }
                } else if (target === 'strip') {
                    const stripIdx = parseInt(cb.dataset.idx);
                    if (!isNaN(stripIdx) && this.data.stripEffects.has(stripIdx)) {
                        // v13.11.44: _parseSegParams extracts ALL timing/fade/blink params —
                        // previously only color/at/ah/as/afden were parsed; fu/fd/blink etc. were
                        // hardcoded to zero, making FD/FU comet gradients and blink effects silent.
                        const p = this._parseSegParams(seg);
                        this.data.stripEffects.get(stripIdx).push({
                            color: p.color, at: p.at, ah: p.ah, as: p.as,
                            blink: p.blink, bpw: p.bpw, fu: p.fu, fd: p.fd,
                            dur: p.dur, maxDur: p.maxDur, minDur: p.minDur,
                            afden: p.afden, afmin: p.afmin, afmax: p.afmax,
                            layer: p.layer, fade: p.fade,
                            startTime: Date.now() + p.wait
                        });
                    }
                } else if (target === 'rgb') {
                    const p = this._parseSegParams(seg);
                    const toyId = 'rgb_' + cb.dataset.name.replace(/[^a-zA-Z0-9]/g, '_');
                    // v13.11.44: include all timing/fade params so blink/FU/FD work on RGB toys
                    this.data.toyEffects.set(toyId, {
                        color: p.color, blink: p.blink, bpw: p.bpw,
                        fu: p.fu, fd: p.fd, fade: p.fade,
                        dur: p.dur, maxDur: p.maxDur, minDur: p.minDur,
                        startTime: Date.now() + p.wait
                    });
                }
            });
        });
    },

    // Clear all Code Sim effects from live rendering arrays.
    _codeSimRelease() {
        this.data.matrixEffects = this.data.matrixEffects.filter(e => !e._codeSimOwned);
        this.data.stripEffects.forEach(arr => {
            const filtered = arr.filter(e => !e._codeSimOwned);
            arr.length = 0;
            filtered.forEach(e => arr.push(e));
        });
        this.data.toyEffects.forEach((v, k) => { if (v._codeSimOwned) this.data.toyEffects.delete(k); });
        // Unlatch + stop loop
        this._codeSimLatched = false;
        this._codeSimStopLoop();
        const lBtn = document.getElementById('code-sim-latch-btn');
        if (lBtn) lBtn.classList.remove('active');
    },

    // Code Sim M button — click fires, releases on mouseup anywhere (same fix as trigStart)
    codeSimMomentaryStart() {
        if (this._codeSimLatched) return; // latch takes precedence
        this._codeSimActive = true;
        this._codeSimFire();

        const onRelease = () => {
            this._codeSimActive = false;
            // Clear code-sim-owned effects on release
            this.data.matrixEffects = [];
            this.data.stripEffects.forEach(arr => arr.length = 0);
            this.data.toyEffects.clear();
            this.parseActiveEffects();
            document.removeEventListener('mouseup',       onRelease);
            document.removeEventListener('pointercancel', onRelease);
        };
        document.addEventListener('mouseup',       onRelease, { once: true });
        document.addEventListener('pointercancel', onRelease, { once: true });
    },

    codeSimMomentaryEnd() { /* handled by document listener in codeSimMomentaryStart */ },

    // Code Sim L button toggle
    codeSimLatch(btn) {
        if (this._codeSimLatched) {
            // Unlatch — clear effects
            this._codeSimLatched = false;
            btn.classList.remove('active');
            this._codeSimStopLoop();
            this.data.matrixEffects = [];
            this.data.stripEffects.forEach(arr => arr.length = 0);
            this.data.toyEffects.clear();
            this.parseActiveEffects();
        } else {
            this._codeSimLatched = true;
            btn.classList.add('active');
            this._codeSimFire();
        }
    },

    // Code Sim explicit Clear button
    codeSimClear() {
        this._codeSimLatched = false;
        this._codeSimStopLoop();
        const lBtn = document.getElementById('code-sim-latch-btn');
        if (lBtn) lBtn.classList.remove('active');
        this.data.matrixEffects = [];
        this.data.stripEffects.forEach(arr => arr.length = 0);
        this.data.toyEffects.clear();
        this.parseActiveEffects();
    },

    // v13.13.0: Code Sim Loop — auto-replay timed effects when they expire
    codeSimLoopToggle(btn) {
        if (this._codeSimLoopInterval) {
            this._codeSimStopLoop();
            return;
        }
        // Must be latched to loop
        if (!this._codeSimLatched) {
            // Auto-latch first
            const lBtn = document.getElementById('code-sim-latch-btn');
            if (lBtn) { this.codeSimLatch(lBtn); }
        }
        btn.classList.add('active');
        this._codeSimLoopInterval = setInterval(() => this._codeSimLoopCheck(), 100);
    },

    _codeSimStopLoop() {
        if (this._codeSimLoopInterval) {
            clearInterval(this._codeSimLoopInterval);
            this._codeSimLoopInterval = null;
        }
        const loopBtn = document.getElementById('code-sim-loop-btn');
        if (loopBtn) loopBtn.classList.remove('active');
    },

    _codeSimLoopCheck() {
        if (!this._codeSimLatched) { this._codeSimStopLoop(); return; }
        const now = Date.now();
        // v13.13.23 FIX: Only timed effects determine loop cycle.
        // Untimed (permanent) effects like "Blue L-4" must NOT block re-fire.
        const isAlive = (eff) => {
            const elapsed = now - eff.startTime;
            if (eff.maxDur > 0) return elapsed < eff.maxDur;
            if (eff.dur > 0) return elapsed < eff.dur + Math.max(eff.fd || 0, 0);
            if (eff.fu > 0 || eff.fd > 0) return elapsed < (eff.fu || 0) + (eff.fd || 0);
            return false; // No timing = permanent = doesn't count for loop expiry
        };
        const timedMatrix = this.data.matrixEffects.filter(e => e.dur || e.maxDur || e.fu || e.fd);
        const matrixAlive = timedMatrix.length > 0 && timedMatrix.some(isAlive);
        let timedStripCount = 0, stripsAlive = false;
        this.data.stripEffects.forEach(arr => {
            arr.forEach(eff => {
                if (eff.dur || eff.maxDur || eff.fu || eff.fd) {
                    timedStripCount++;
                    if (isAlive(eff)) stripsAlive = true;
                }
            });
        });
        // If no timed effects exist at all, nothing to cycle — don't re-fire
        if (timedMatrix.length === 0 && timedStripCount === 0) return;
        if (!matrixAlive && !stripsAlive) {
            // All timed effects expired → re-fire
            this.data.matrixEffects = [];
            this.data.stripEffects.forEach(arr => arr.length = 0);
            this.data.toyEffects.clear();
            this._codeSimFire();
        }
    },

    // v13.11.46: Compute natural lifetime (ms) of a code-sim-owned effect.
    // Returns Infinity for effects that run indefinitely without re-fire.
    // Used by the Code Sim latch re-fire loop in the game loop.
    //
    // Effect lifetime rules (matching calculateOpacity case map):
    //   FU+FD, no blink, no dur, AS=0  → fu + fd  (one-shot pulse)
    //   FD alone, no blink, no dur, AS=0 → fd       (one-shot fade-out)
    //   dur > 0                          → dur       (timed effect, with or without FU/FD)
    //   Blink + no dur                   → Infinity  (continuous blink)
    //   AS > 0 (scrolling)               → Infinity  (scrolls until cleared)
    //   F + no dur                       → Infinity  (fades in then holds)
    //   Solid color, no dur, no blink    → Infinity  (static, stays on)
    _csEffectEndTime(e) {
        if (e.dur > 0) return e.dur;
        if (e.blink && !e.dur) return Infinity;
        if (e.as > 0) return Infinity;
        if (e.fu > 0 && e.fd > 0 && !e.blink) return e.fu + e.fd;
        if (e.fd > 0 && !e.fu && !e.blink) return e.fd;
        return Infinity; // static solid, fade-in hold, or unrecognised — treat as infinite
    },


    // v13.11.22a: [ Code Ref ] opens the floating panel to the Triggers tab.
    // v13.11.22: [ Code Ref ] opens the floating panel to a specific tab.
    //            [ Anim Sim ] swaps ONLY the left panel — floating panel is unaffected.
    toggleCodeRef(paneId) {
        if (paneId === 'cref-anim-sim') {
            // Anim Sim is now inline in the left panel — do not open the floating window
            this._openAnimSimPanel();
            return;
        }
        // All other tabs: show the floating Code Ref panel
        const panel = document.getElementById('code-ref-panel');
        if (!panel) return;
        panel.style.display = 'flex';
        if (paneId) {
            const btn = panel.querySelector(`.cref-tab[onclick*="${paneId}"]`);
            if (btn) this.crefTab(btn, paneId);
        }
    },

    // Dedicated close — called by the ✕ button only
    closeCodeRef() {
        const panel = document.getElementById('code-ref-panel');
        if (panel) panel.style.display = 'none';
    },

    // Show the inline Anim Sim section, hide the table select section
    _openAnimSimPanel() {
        const tableSection = document.getElementById('select-table-section');
        const animSection  = document.getElementById('anim-sim-section');
        if (tableSection) tableSection.style.display = 'none';
        if (animSection)  animSection.style.display  = 'flex'; // v13.11.39 FIX: flex not block — .left-panel-body requires display:flex for scroll chain
        // Sync toggle buttons
        document.getElementById('btn-mode-table')?.classList.remove('active');
        document.getElementById('btn-mode-anim')?.classList.add('active');
        // Clear triggers
        this.data.activeTriggers.clear();
        this.data.latchedTriggers.clear();
        this.data.heldEffects = [];
        this.parseActiveEffects();
    },

    // Restore table select section, hide Anim Sim section
    animSimClose() {
        this._closeAnimSimPanel();
    },

    _closeAnimSimPanel() {
        const tableSection = document.getElementById('select-table-section');
        const animSection  = document.getElementById('anim-sim-section');
        const wasConfirmed = tableSection && tableSection.dataset.confirmed === 'true';
        if (tableSection) tableSection.style.display = wasConfirmed ? 'flex' : 'none'; // v13.11.39 FIX: flex not block
        if (animSection)  animSection.style.display  = 'none';
        document.getElementById('btn-mode-table')?.classList.add('active');
        document.getElementById('btn-mode-anim')?.classList.remove('active');
        // v13.11.27 FIX: _animSimClear() empties bitmapPixels[] so gameLoop stops
        // re-painting the GIF bitmap every frame after returning to Table View.
        // Previous code only cleared activeEcode/activeTriggers but never touched bitmapPixels.
        this._animSimClear();
    },

    // v13.11.20: Switch active tab in Code Reference modal
    crefTab(btn, paneId) {
        // Deactivate all tabs and panes within the modal
        const panel = document.getElementById('code-ref-panel');
        panel.querySelectorAll('.cref-tab').forEach(t => t.classList.remove('active'));
        panel.querySelectorAll('.cref-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const pane = document.getElementById(paneId);
        if (pane) pane.classList.add('active');
        // v13.11.45: Lazy-build examples grid on first visit
        if (paneId === 'cref-examples') this._crefExamplesBuild();
    },


    // ── v13.11.45: EXAMPLES LIBRARY GRID ──────────────────────────────────────────
    // Lazy-built on first tab open. Data comes from window.EXAMPLE_LIBRARY defined
    // in a <script> block inside index.html (WALT-UPDATEABLE section).
    // Compact mode: Name col 200px, Code col truncated with ellipsis.
    // Expanded mode: Code wraps and shows in full.
    // Double-click on any cell copies its text to clipboard with green flash.
    _crefExamplesBuild() {
        const grid = document.getElementById('cref-examples-grid');
        if (!grid || grid._built) return;
        grid._built = true;
        const lib = window.EXAMPLE_LIBRARY || [];
        if (!lib.length) {
            grid.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.8rem;">No examples loaded.</div>';
            return;
        }
        // Count badge
        const countEl = document.getElementById('cref-examples-count');
        if (countEl) countEl.textContent = `${lib.length} effects`;

        let rows = '';
        lib.forEach(([name, code], i) => {
            const safeName = String(name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            const safeCode = String(code).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            rows += `<tr class="cref-ex-row">
                <td class="cref-ex-name" title="${safeName}" data-copy="${safeName}"
                    ondblclick="event.stopPropagation();App._gridCellCopy(this)">${safeName}</td>
                <td class="cref-ex-code" title="${safeCode}" data-copy="${safeCode}"
                    ondblclick="event.stopPropagation();App._gridCellCopy(this)">${safeCode}</td>
            </tr>`;
        });
        grid.innerHTML = `<table class="cref-ex-table" id="cref-ex-table">
            <thead><tr>
                <th class="cref-ex-hdr-name">Effect Name</th>
                <th class="cref-ex-hdr-code">DOF Code <span style="font-weight:normal;font-size:0.65rem;color:var(--text-muted)">(double-click any cell to copy)</span></th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    },

    _crefExamplesToggle() {
        const table = document.getElementById('cref-ex-table');
        const btn   = document.getElementById('cref-ex-toggle');
        if (!table || !btn) return;
        const isExp = table.classList.toggle('cref-ex-expanded');
        btn.textContent = isExp ? '[ Compact ]' : '[ Expanded ]';
    },

    openToyInspector(toyName) {
        const code = this._getMonitorText();
        const cols = code.split(/,(?![^(]*\))/);
        
        // v13.11.1 FIX: CSV columns use sequential output numbering: col index N → output N+1.
        // The old sparse sortedOutputs[colIdx] approach silently dropped every column beyond
        // the 6th slot, causing tables like "diner" (effects at cols 9+) to show nothing.
        
        // Step 1: Find all triggers and which layers they appear on
        const triggerLayerMap = new Map(); // trigger -> Set of layer numbers
        
        cols.forEach((colStr, colIdx) => {
            const outputNum = this._getOutputNum(colIdx, cols.length); // v13.11.3: hybrid
            if(!outputNum) return;
            
            const hwName = this.data.cabinet.toyMap.get(outputNum);
            let isDirectMap = (hwName === toyName);

            const layers = colStr.split('/');
            
            layers.forEach(layer => {
                let isMatch = false;
                
                if (isDirectMap) {
                    if (layer.trim().length > 1 && layer.trim() !== "0") isMatch = true;
                } else {
                    const macroRegex = new RegExp(`@${toyName}@|SHP${toyName}\\b`);
                    if(macroRegex.test(layer)) isMatch = true;
                }

                if(isMatch) {
                    // Extract layer number
                    const lm = layer.match(/\bL(-?\d+)\b/i);
                    const layerNum = lm ? parseInt(lm[1]) : 0;
                    
                    // Extract triggers
                    const found = layer.match(/\b([WSEL]\d+)\b/g);
                    if(found) {
                        found.forEach(trig => {
                            // v13.11.2: Robust L-trigger vs layer-parameter detection.
                            // Rule 1 — Layer MARKER: L is the very first token → skip.
                            // Rule 2 — Layer PARAMETER: L is at the very END of the string
                            //   (after ABF/BNP/AAC/numbers/etc.) → skip.
                            // Rule 3 — Lamp TRIGGER: L appears before a color or effect param
                            //   (middle of string, not first, not last) → keep.
                            if (trig.startsWith('L')) {
                                const trimmed = layer.trim();
                                // Rule 1: layer marker at start
                                if (/^L-?\d+\b/i.test(trimmed)) return;
                                // Rule 2: layer parameter at end
                                if (new RegExp(`\\b${trig}\\s*$`, 'i').test(trimmed) &&
                                    !new RegExp(`^${trig}\\s*$`, 'i').test(trimmed) &&
                                    !new RegExp(`^${trig}\\b`, 'i').test(trimmed)) return;
                            }
                            
                            if(!triggerLayerMap.has(trig)) {
                                triggerLayerMap.set(trig, new Set());
                            }
                            triggerLayerMap.get(trig).add(layerNum);
                        });
                    }
                }
            });
        });
        
        // Step 2: Detect distinct layers
        const layersFound = new Set();
        triggerLayerMap.forEach((layers) => {
            layers.forEach(l => layersFound.add(l));
        });
        
        // Step 3: Set up the inspector panel
        const panel = document.getElementById('draggable-inspector');
        document.getElementById('inspect-toy-title').innerText = `Inspect: ${toyName}`;
        
        // Step 4: Setup layer filter (v13.7: Now at TOP, primary control)
        const layerSection = document.getElementById('inspect-layer-section');
        const layerGrid = document.getElementById('inspect-layer-grid');
        const layerStatus = document.getElementById('layer-status');
        
        if (layerSection && layerGrid) {
            // v13.7: Hide layer filter if only 1 layer
            if (layersFound.size > 1) {
                layerGrid.innerHTML = '';
                
                // Default to ALL if no filter set
                if (this.data.inspector.layerFilter === null || this.data.inspector.toyName !== toyName) {
                    this.data.inspector.layerFilter = null;
                }
                
                // ALL button
                const allBtn = document.createElement('div');
                allBtn.className = 'insp-trig-btn' + (this.data.inspector.layerFilter === null ? ' active-filter' : '');
                allBtn.innerText = 'ALL';
                allBtn.onclick = () => {
                    this.data.inspector.layerFilter = null;
                    this.filterAndDisplayTriggers(toyName, triggerLayerMap, null);
                };
                layerGrid.appendChild(allBtn);
                
                // Individual layer buttons
                Array.from(layersFound).sort((a,b)=>a-b).forEach(lnum => {
                    const lb = document.createElement('div');
                    lb.className = 'insp-trig-btn' + (this.data.inspector.layerFilter === lnum ? ' active-filter' : '');
                    lb.innerText = `L${lnum}`;
                    lb.onclick = () => {
                        this.data.inspector.layerFilter = lnum;
                        this.filterAndDisplayTriggers(toyName, triggerLayerMap, lnum);
                    };
                    layerGrid.appendChild(lb);
                });
                
                layerSection.style.display = 'block';
            } else {
                // v13.7: Single layer - hide filter
                layerSection.style.display = 'none';
                this.data.inspector.layerFilter = null;
            }
        }
        
        // Step 5: Display triggers (filtered by current layer selection)
        this.filterAndDisplayTriggers(toyName, triggerLayerMap, this.data.inspector.layerFilter);
        
        panel.style.display = 'flex';
    },
    
    // v13.7: NEW function to filter and display triggers based on layer
    filterAndDisplayTriggers(toyName, triggerLayerMap, layerFilter) {
        const list = document.getElementById('inspect-list');
        const layerStatus = document.getElementById('layer-status');
        
        list.innerHTML = '';
        
        // Filter triggers by selected layer
        let triggersToShow = [];
        triggerLayerMap.forEach((layers, trig) => {
            if (layerFilter === null) {
                // Show all triggers
                triggersToShow.push(trig);
            } else {
                // Only show triggers that exist on this layer
                if (layers.has(layerFilter)) {
                    triggersToShow.push(trig);
                }
            }
        });
        
        // Update status text (v13.7: "Lx Triggers" format)
        if (layerStatus) {
            if (layerFilter === null) {
                layerStatus.innerText = 'All triggers';
            } else {
                layerStatus.innerText = `L${layerFilter} triggers`;
            }
        }
        
        // Display trigger buttons
        if (triggersToShow.length === 0) {
            list.innerHTML = '<div style="color:#aaa; font-size:0.7rem;">No triggers on this layer.</div>';
        } else {
            triggersToShow.sort((a, b) => a.localeCompare(b, undefined, {numeric: true})).forEach(trig => {
                const btn = document.createElement('div');
                btn.className = 'insp-trig-btn';
                if(this.data.inspector.trigger === trig && this.data.inspector.toyName === toyName) {
                    btn.classList.add('active-filter');
                }
                btn.innerText = trig;
                btn.onclick = () => this.activateInspector(trig, toyName);
                list.appendChild(btn);
            });
        }
    },

    activateInspector(trigger, toyName) {
        // v13.7.1 FIX: Update properties individually to preserve layerFilter
        this.data.inspector.active = true;
        this.data.inspector.trigger = trigger;
        this.data.inspector.toyName = toyName;
        // layerFilter is preserved from layer selection
        document.getElementById('inspector-active-indicator').style.display = 'flex';
        // v13.11.22 FIX: Clear heldEffects when switching inspector triggers.
        // Without this, an M-param effect from the previous trigger stays alive
        // in heldEffects and re-injects itself alongside the new trigger's effects,
        // causing two trigger effects to render simultaneously in the inspector.
        this.data.heldEffects = [];
        this.openToyInspector(toyName);
        this.parseActiveEffects();
    },

    closeInspector() {
        this.data.inspector = { active: false, trigger: null, toyName: null, layerFilter: null, mode: null };
        document.getElementById('draggable-inspector').style.display = 'none';
        document.getElementById('inspector-active-indicator').style.display = 'none';
        this.parseActiveEffects();
    },

    // v13.11.15: File status badge helpers ─────────────────────────────────────
    // Browsers cannot store File objects in localStorage (security restriction).
    // We store the filename as a reminder badge. Files must be re-uploaded each
    // session — the badge simply shows what was last used.
    _saveFileBadge(inputId, filename) {
        if (!filename) return;
        try {
            localStorage.setItem('dof_file_' + inputId, filename);
            this._renderFileBadge(inputId, filename);
        } catch(e) {}
    },

    _restoreFileBadges() {
        ['f-cab','f-ini','f-ini2','f-ini3','f-sxml','f-spng','f-json'].forEach(id => {
            try {
                const name = localStorage.getItem('dof_file_' + id);
                if (name) this._renderFileBadge(id, name);
            } catch(e) {}
        });
    },

    _renderFileBadge(inputId, filename) {
        const input = document.getElementById(inputId);
        if (!input) return;
        // v13.11.22: green border on the input instead of an extra badge div.
        // No height change — the file picker just glows green.
        input.classList.add('file-loaded');
        input.title = '✓ Loaded: ' + filename;
    },

    // v13.10.1: Toggle Configuration panel collapse (only enabled after files loaded)
    // v13.11.22 FIX: Use data-collapsed attribute instead of checking style.display string.
    // The old check (content.style.display === 'none') could fail if the browser had
    // not normalised the value, or if another code path set display to 'flex' instead
    // of '' when expanding. data-collapsed is set/read exclusively here — no ambiguity.
    toggleConfigPanel() {
        const content = document.getElementById('config-panel-content');
        const toggle = document.getElementById('config-toggle');
        const hint = document.getElementById('config-collapse-hint');
        if (!content || !toggle) return;
        const isCollapsed = content.dataset.collapsed === 'true';
        if (isCollapsed) {
            content.style.display = '';
            content.dataset.collapsed = 'false';
            toggle.innerText = '[-]';
            localStorage.setItem('dof_config_panel_open', 'true');
            // v13.13.0: Collapse Table View / Anim Sim sections so Config has full height
            const tableView = document.getElementById('select-table-section');
            const animSim = document.getElementById('anim-sim-section');
            if (tableView) tableView.style.display = 'none';
            if (animSim) animSim.style.display = 'none';
        } else {
            content.style.display = 'none';
            content.dataset.collapsed = 'true';
            toggle.innerText = '[+]';
            if (hint) hint.style.display = 'none';
            localStorage.setItem('dof_config_panel_open', 'false');
            // v13.13.0: Restore Table View when Config is collapsed
            const tableView = document.getElementById('select-table-section');
            const modeToggle = document.getElementById('left-mode-toggle');
            if (tableView && modeToggle && modeToggle.style.display !== 'none') {
                // Restore whichever mode was active
                const animBtn = document.getElementById('btn-mode-anim');
                if (animBtn?.classList.contains('active')) {
                    const animSim = document.getElementById('anim-sim-section');
                    if (animSim) animSim.style.display = '';
                } else {
                    tableView.style.display = '';
                }
            }
        }
    },
    
    // v13.10.1: Enable config collapse after all files loaded
    enableConfigCollapse() {
        const header = document.getElementById('config-header');
        const toggle = document.getElementById('config-toggle');
        if(!header || !toggle) return;
        
        // Make header collapsible
        header.classList.add('collapsible');
        header.onclick = () => this.toggleConfigPanel();
        
        // Show toggle indicator - use inline to override display:none
        toggle.style.display = 'inline';
        toggle.innerText = '[-]';
    },
    
    // v13.11.19: Check if enough files are loaded to enable collapsing.
    // No longer auto-collapses — instead shows a gentle pulsing hint so users
    // know they CAN collapse and understand the panel is now optional.
    checkFilesLoaded() {
        const hasConfig = this.data.config30 && Object.keys(this.data.config30).length > 0;
        if (hasConfig) {
            this.enableConfigCollapse();
            // Show "collapse when ready" hint — only if panel is still open
            const content = document.getElementById('config-panel-content');
            const hint = document.getElementById('config-collapse-hint');
            if (hint && content && content.style.display !== 'none') {
                hint.style.display = 'inline';
            }
        }
    },

    // v13.9.4 PORT: Trigger inspector mode
    openTriggerInspector(trigger) {
        const code = this._getMonitorText();
        const cols = code.split(/,(?![^(]*\))/);
        // v13.11.1: sequential mapping used below (colIdx + 1 = outputNum)
        
        // Find all layers this trigger appears on
        const layers = code.split(',').flatMap(col => col.split('/'));
        const triggerLayers = new Set();
        const affectedToys = new Set();
        
        layers.forEach(layer => {
            const triggerPattern = new RegExp('\\b' + trigger + '\\b');
            if (triggerPattern.test(layer)) {
                const lm = layer.match(/\bL(-?\d+)\b/i);
                const layerNum = lm ? parseInt(lm[1]) : 0;
                triggerLayers.add(layerNum);
            }
        });
        
        // Find all toys affected by this trigger
        cols.forEach((colStr, colIdx) => {
            const outputNum = this._getOutputNum(colIdx, cols.length); // v13.11.3: hybrid
            if(!outputNum) return;
            const hwName = this.data.cabinet.toyMap.get(outputNum);
            
            const layers = colStr.split('/');
            layers.forEach(layer => {
                if (new RegExp('\\b' + trigger + '\\b').test(layer)) {
                    if(hwName && !this.data.cabinet.stripNames.has(hwName) && hwName !== 'Matrix') {
                        affectedToys.add(hwName);
                    }
                }
                
                // Check @ tags and SHP
                const tagMatch = layer.match(/@(\w+)@/);
                const shpMatch = layer.match(/SHP([a-zA-Z0-9_]+)/);
                if((tagMatch || shpMatch) && new RegExp('\\b' + trigger + '\\b').test(layer)) {
                    const toyName = tagMatch ? tagMatch[1] : shpMatch[1];
                    affectedToys.add(toyName);
                }
            });
        });
        
        // Render inspector in trigger mode
        const panel = document.getElementById('draggable-inspector');
        panel.style.display = 'block';
        document.getElementById('inspect-toy-title').innerText = `Inspect: ${trigger} (Trigger Mode)`;
        
        const layerSection = document.getElementById('inspect-layer-section');
        const layerGrid = document.getElementById('inspect-layer-grid');
        const layerStatus = document.getElementById('layer-status');
        
        if (layerSection && layerGrid) {
            const sortedLayers = Array.from(triggerLayers).sort((a,b) => a-b);
            
            layerSection.style.display = 'block';
            layerGrid.innerHTML = '';
            
            // ALL button
            const allBtn = document.createElement('button');
            allBtn.className = 'layer-btn active';
            allBtn.innerText = 'ALL';
            allBtn.onclick = () => {
                layerGrid.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
                allBtn.classList.add('active');
                this.data.inspector.layerFilter = null;
                if(layerStatus) layerStatus.innerText = 'All layers';
                this.parseActiveEffects();
            };
            layerGrid.appendChild(allBtn);
            
            // Layer buttons
            sortedLayers.forEach(layerNum => {
                const btn = document.createElement('button');
                btn.className = 'layer-btn';
                btn.innerText = `L${layerNum}`;
                btn.onclick = () => {
                    layerGrid.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.data.inspector.layerFilter = layerNum;
                    if(layerStatus) layerStatus.innerText = `L${layerNum} effects`;
                    this.parseActiveEffects();
                };
                layerGrid.appendChild(btn);
            });
        }
        
        // Show affected toys list
        const list = document.getElementById('inspect-list');
        list.innerHTML = '<div class="inspect-sub">AFFECTED TOYS:</div>';
        
        if(affectedToys.size === 0) {
            list.innerHTML += '<div style="padding: 8px; color: #aaa; font-size: 0.75rem;">No toys affected</div>';
        } else {
            const toyArray = Array.from(affectedToys).sort();
            const toyListHTML = '<ul style="margin: 0; padding-left: 20px; list-style-type: disc;">' +
                toyArray.map(toy => `<li style="font-size: 0.75rem; color: var(--text); padding: 2px 0;">${toy}</li>`).join('') +
                '</ul>';
            list.innerHTML += toyListHTML;
        }
        
        // Set inspector state
        this.data.inspector = {
            active: true,
            mode: 'trigger',
            trigger: trigger,
            toyName: null,
            layerFilter: null
        };
        
        document.getElementById('inspector-active-indicator').style.display = 'flex';
        this.parseActiveEffects();
    },
    
    // v13.9.4 PORT: Auto-size inspector (simple version without DOM wait)
    autoSizeInspector() {
        // Simplified for v13.9.4 - no complex sizing
    },

    dragElement(elmnt) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = document.getElementById(elmnt.id + "header") || document.getElementById("inspector-header");
        if (header) {
            header.onmousedown = dragMouseDown;
        } else {
            elmnt.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    },

    // --- CORE LOGIC ---
    async loadCabinet(file) {
        if(!file) return;
        const text = await file.text();
        
        // VALIDATION v13.6: Ensure this is actually a Cabinet.xml file
        if (!text.includes('<Cabinet') && !text.includes('<cabinet')) {
            alert('ERROR: This does not appear to be a Cabinet.xml file.\n\nPlease upload your Cabinet.xml (not DirectOutputShapes.xml).');
            document.getElementById('system-status').innerText = "❌ Invalid Cabinet file";
            return;
        }
        if (text.includes('<DirectOutputShapes') || text.includes('<Shape>')) {
            alert('ERROR: You uploaded DirectOutputShapes.xml instead of Cabinet.xml.\n\nPlease upload Cabinet.xml.');
            document.getElementById('system-status').innerText = "❌ Wrong file (Shapes, not Cabinet)";
            return;
        }

        // Parse XML as plain text with regex - immune to browser DOM/namespace quirks.
        // Handles both <n>Name</n> and <n>Name</n> tag variants used by different DOF cabinet files.
        const getTag = (block, tag) => {
            const m = block.match(new RegExp('<' + tag + '>\\s*([\\s\\S]*?)\\s*<\\/' + tag + '>', 'i'));
            return m ? m[1].trim() : '';
        };
        const getLedStripName = block => getTag(block, 'Name') || getTag(block, 'n');

        // Parse LedStrip blocks
        const stripBlocks = [...text.matchAll(/<LedStrip>([\s\S]*?)<\/LedStrip>/gi)].map(m => m[1]);

        const matrixBlock = stripBlocks.find(b => getLedStripName(b) === 'Matrix');
        if(matrixBlock) {
            this.data.cabinet.matrix = {
                w: parseInt(getTag(matrixBlock, 'Width')),
                h: parseInt(getTag(matrixBlock, 'Height'))
            };
            this.renderMatrixGrid();
        }

        this.data.cabinet.strips = stripBlocks
            .filter(b => getLedStripName(b) !== 'Matrix')
            .map(b => ({
                name: getLedStripName(b),
                // FIXED v13.6: Try NumberOfLedsStrip first (most common tag), then Height, then Width
                leds: parseInt(getTag(b, 'NumberOfLedsStrip')) || 
                      parseInt(getTag(b, 'Height')) || 
                      parseInt(getTag(b, 'Width')) || 1
            }));

        this.data.cabinet.stripNames.clear();
        this.data.cabinet.strips.forEach(s => this.data.cabinet.stripNames.add(s.name));
        this.renderStripRack();
        
        // DEBUG v13.6: Log strip names and LED counts to verify parsing
        console.log('=== STRIPS LOADED ===');
        this.data.cabinet.strips.forEach((s, idx) => {
            console.log(`Strip ${idx}: "${s.name}" with ${s.leds} LEDs`);
        });
        console.log('Strip Names Set:', Array.from(this.data.cabinet.stripNames));

        // Parse LedWizEquivalentOutput blocks
        const outputBlocks = [...text.matchAll(/<LedWizEquivalentOutput>([\s\S]*?)<\/LedWizEquivalentOutput>/gi)].map(m => m[1]);
        for(const block of outputBlocks) {
            const num = parseInt(getTag(block, 'LedWizEquivalentOutputNumber'));
            const name = getTag(block, 'OutputName');
            if(!isNaN(num) && name) this.data.cabinet.toyMap.set(num, name);
        }
        
        // DEBUG v13.6: Log toyMap to verify output mappings and find name mismatches
        console.log('=== TOY MAP (Output# → Name) ===');
        Array.from(this.data.cabinet.toyMap.entries())
            .sort((a, b) => a[0] - b[0])
            .forEach(([num, name]) => {
                const isStrip = this.data.cabinet.stripNames.has(name);
                console.log(`Output ${num}: "${name}" ${isStrip ? '[STRIP]' : '[TOY]'}`);
            });
        
        // v13.8.1 VALIDATION: Warn if LED strip names don't match output names
        const mismatches = [];
        this.data.cabinet.strips.forEach(strip => {
            const hasMatch = Array.from(this.data.cabinet.toyMap.values()).includes(strip.name);
            if (!hasMatch) {
                mismatches.push(strip.name);
            }
        });
        
        if (mismatches.length > 0) {
            console.warn('⚠️ CABINET CONFIGURATION WARNING:');
            console.warn('The following LED strips are defined but have NO MATCHING OUTPUT:');
            mismatches.forEach(name => console.warn(`  ❌ "${name}"`));
            console.warn('');
            console.warn('PROBLEM: In your Cabinet.xml file:');
            console.warn('  <LedStrip><n>StripName</n></LedStrip>');
            console.warn('  MUST MATCH:');
            console.warn('  <LedWizEquivalentOutput><OutputName>StripName</OutputName></LedWizEquivalentOutput>');
            console.warn('');
            console.warn('SOLUTION: Edit Cabinet.xml and make sure strip names match output names exactly.');
            console.warn('Without matching names, these strips will NOT receive effects!');
            
            // Also show alert to user
            alert(`⚠️ CABINET CONFIGURATION WARNING\n\n` +
                  `${mismatches.length} LED strip(s) have no matching output:\n` +
                  mismatches.map(n => `  • ${n}`).join('\n') + '\n\n' +
                  `These strips will NOT display effects!\n\n` +
                  `In Cabinet.xml, the <LedStrip><n>Name</n> must EXACTLY match\n` +
                  `the <LedWizEquivalentOutput><OutputName>Name</OutputName>\n\n` +
                  `Check the browser console for details.`);
        }
        
        document.getElementById('system-status').innerText = "Cabinet Hardware Loaded.";
        this.checkFilesLoaded(); // v13.10.1: Check if all files loaded
    },

    async loadConfig(file) {
        if(!file) return;
        // v13.13.25: Extension-only validation (filename may vary, but must be .ini)
        if(!file.name.toLowerCase().endsWith('.ini')) {
            alert(`File Validation Error\n\nExpected: an .ini file\nReceived: ${file.name}\n\nThis input only accepts INI files.`);
            return;
        }
        const text = await file.text();
        
        // VALIDATION v13.6: Ensure this is actually a config INI file
        if (!text.includes('[Config DOF]') && !text.includes('[config dof]')) {
            alert('ERROR: This does not appear to be a DirectOutputConfig INI file.\n\nPlease upload DirectOutputConfig30.ini (or similar).');
            document.getElementById('system-status').innerText = "❌ Invalid Config file";
            return;
        }
        const sel = document.getElementById('rom-select');
        sel.innerHTML = '<option value="">Select Table...</option>';
        sel.disabled = false;
        
        this.data.colors.clear();
        let inColors = false;

        // v13.12.0: Parse Config30 header comment to get column names.
        // Format: # "Rom","PF Left Effects MX HD","","","PF Left Flashers MX",...
        // Same approach as Config2 header parsing.
        this.data.config30Header = null;
        const c30HeaderMatch = text.match(/\[Config DOF\][^\n]*\n#\s*(.*)/i);
        if (c30HeaderMatch) {
            const raw = c30HeaderMatch[1].replace(/^"|"$/g, '');
            this.data.config30Header = raw.split(/","?|"?,|,/).map(s => s.replace(/^"|"$/g,'').trim());
        }

        const lines = text.split('\n');
        lines.forEach(line => {
            const clean = line.trim();
            if(clean.startsWith('[')) {
                inColors = (clean.toLowerCase() === '[colors dof]');
            } else if(inColors && clean.includes('=')) {
                const [name, hex] = clean.split('=');
                if(name && hex) {
                    let hexVal = hex.trim();
                    // Config30.ini colors use 8-char RGBA hex (e.g. #FF6347FF). Strip alpha for CSS.
                    if(hexVal.startsWith('#') && hexVal.length === 9) hexVal = hexVal.slice(0, 7);
                    this.data.colors.set(name.trim().toLowerCase(), hexVal);
                }
            } else if(!clean.startsWith('[') && clean.includes(',')) {
                const parts = clean.split(',');
                const rom = parts[0].trim();
                if(rom) {
                    this.data.config30[rom] = parts.slice(1);
                    sel.add(new Option(rom, rom));
                }
            }
        });
        document.getElementById('system-status').innerText = `Config Loaded. ${this.data.colors.size} Custom Colors Found.`;
        
        // v13.11.0: Parse variable and table-variable sections from this INI file
        this.parseVariablesDOF(text);
        this.parseTableVariables(text);
        
        this.checkFilesLoaded(); // v13.10.1: Check if all files loaded
    },

    // v13.11.3: Load directoutputconfig.ini (Config1) for LedWiz physical toys
    // Triggers from Config1 are stored in data.config1 and merged into the
    // Active Toys / trigger list in loadTable() so users can fire physical devices.
    async loadConfig1(file) {
        if (!file) return;
        // v13.13.25: Extension-only validation (filename may vary, but must be .ini)
        if(!file.name.toLowerCase().endsWith('.ini')) {
            alert(`File Validation Error\n\nExpected: an .ini file\nReceived: ${file.name}\n\nThis input only accepts INI files.`);
            return;
        }
        const text = await file.text();
        if (!text.includes('[Config DOF]') && !text.includes('[config dof]')) {
            alert('ERROR: This does not appear to be a DirectOutputConfig INI file.');
            return;
        }
        this.data.config1 = {};
        const configStart = text.toLowerCase().indexOf('[config dof]');
        const lines = text.slice(configStart).split('\n');
        let count = 0;
        lines.forEach(line => {
            const clean = line.trim();
            if (clean.startsWith('[') && count > 0) return; // end of section
            if (clean.includes(',') && !clean.startsWith('[')) {
                const parts = clean.split(',');
                const rom = parts[0].trim();
                if (rom) {
                    this.data.config1[rom] = parts.slice(1);
                    count++;
                }
            }
        });
        // Update status
        const statusEl = document.getElementById('system-status');
        if (statusEl) {
            const existing = statusEl.innerText;
            statusEl.innerText = existing + ` | Config1: ${count} tables (physical toys)`;
        }
        // Reload current table to merge new triggers
        const sel = document.getElementById('rom-select');
        if (sel && sel.value) this.loadTable(sel.value);
        console.log(`%c[CONFIG1] Loaded ${count} table rows for physical toy triggers`, 'color:#8fbc8f;font-weight:bold;');
    },

    async loadConfig2(file) {
        if (!file) return;
        // v13.13.25: Extension-only validation (filename may vary, but must be .ini)
        if(!file.name.toLowerCase().endsWith('.ini')) {
            alert(`File Validation Error\n\nExpected: an .ini file\nReceived: ${file.name}\n\nThis input only accepts INI files.`);
            return;
        }
        const text = await file.text();
        if (!text.includes('[Config DOF]') && !text.includes('[config dof]')) {
            alert('ERROR: This does not appear to be a DirectOutputConfig INI file.');
            return;
        }
        this.data.config2 = {};
        this.data.config2Header = null; // v13.11.15: will be populated from header comment

        // v13.11.15: Parse Config2 header comment to build dynamic toy map.
        // Format: # "Rom","RGB Flippers","","","RGB Flippers","","","RGB Left Magnasave",...
        const headerMatch = text.match(/\[Config DOF\][^\n]*\n#\s*(.*)/i);
        if (headerMatch) {
            // Simple CSV split (header values may be quoted)
            const raw = headerMatch[1].replace(/^"|"$/g, '');
            this.data.config2Header = raw.split(/","?|"?,|,/).map(s => s.replace(/^"|"$/g,'').trim());
        }

        // v13.11.13: Parse [Colors DOF] from Config2.ini — it contains the full
        // 140-color DOF palette (Brown, Steel_blue, Medium_violet_red, Royal_blue, etc.)
        // that Cabinet.xml may not include. Merge into this.data.colors without
        // overwriting any colors already loaded from Cabinet.xml.
        const colorSectionMatch = text.match(/\[Colors DOF\]([\s\S]*?)(?=\[|$)/i);
        if (colorSectionMatch) {
            colorSectionMatch[1].split('\n').forEach(line => {
                const clean = line.trim();
                if (!clean || clean.startsWith('#') || clean.startsWith(';')) return;
                const eqIdx = clean.indexOf('=');
                if (eqIdx < 1) return;
                const name = clean.slice(0, eqIdx).trim().toLowerCase();
                let hexVal = clean.slice(eqIdx + 1).trim();
                // DOF colors may be 8-digit RGBA (#RRGGBBAA) — strip alpha
                if (hexVal.length === 9 && hexVal.startsWith('#')) hexVal = hexVal.slice(0, 7);
                if (!this.data.colors.has(name)) {
                    this.data.colors.set(name, hexVal);
                }
            });
        }

        const configStart = text.toLowerCase().indexOf('[config dof]');
        const lines = text.slice(configStart).split('\n');
        let count = 0;
        lines.forEach(line => {
            const clean = line.trim();
            if (clean.startsWith('[') && count > 0) return;
            if (clean.includes(',') && !clean.startsWith('[') && !clean.startsWith('#')) {
                const parts = clean.split(',');
                const rom = parts[0].trim();
                if (rom) {
                    this.data.config2[rom] = parts.slice(1);
                    count++;
                }
            }
        });
        const statusEl = document.getElementById('system-status');
        if (statusEl) statusEl.innerText = statusEl.innerText + ` | Config2: ${count} tables (RGB toys)`;
        const sel = document.getElementById('rom-select');
        if (sel && sel.value) this.loadTable(sel.value);
        console.log(`%c[CONFIG2] Loaded ${count} table rows for RGB toy triggers`, 'color:#9de2ff;font-weight:bold;');
    },

    // ══════════════════════════════════════════════════════════════════════════════
    // v13.11.0: NEW PARSERS — pure data extraction, no rendering impact
    // ══════════════════════════════════════════════════════════════════════════════

    /**
     * parseVariablesDOF(text)
     * Parses the [Variables DOF] section of any DirectOutputConfig*.ini file.
     * Populates data.variables — a Map<varName(lowercase), expandedValue>.
     *
     * Format in INI:
     *   flshemulo = AH100 AL0 AT0 AW19 SHPCircle3
     *   LetterA = SHPLetterA
     *
     * Note: variable names are stored lowercase for case-insensitive lookup,
     * but the values are stored verbatim as they appear in the INI file.
     */
    parseVariablesDOF(text) {
        const m = text.match(/\[Variables DOF\]([\s\S]*?)(?=\[|\s*$)/i);
        if(!m) return;

        let added = 0;
        for(const line of m[1].split('\n')) {
            const clean = line.trim();
            if(!clean || clean.startsWith('#') || clean.startsWith(';')) continue;
            const eqIdx = clean.indexOf('=');
            if(eqIdx < 1) continue;
            const name = clean.slice(0, eqIdx).trim().toLowerCase();
            const val  = clean.slice(eqIdx + 1).trim();
            if(name && val) {
                this.data.variables.set(name, val);
                added++;
            }
        }

        console.log(`%c[v13.11.0] Variables DOF parsed: ${added} variables`, 'color:#00e5ff;font-weight:bold');
        if(added > 0) {
            // Log first 10 as a sanity check
            let i = 0;
            for(const [k, v] of this.data.variables) {
                console.log(`  @${k}@ → "${v.slice(0,80)}${v.length>80?'…':''}"`);
                if(++i >= 10) { console.log(`  ... (${this.data.variables.size - 10} more)`); break; }
            }
        }
    },

    /**
     * parseTableVariables(text)
     * Parses the [TableVariables] section of any DirectOutputConfig*.ini file.
     * Populates data.tableVariables — a Map<romName, Map<varName(lowercase), value>>.
     *
     * Format in INI (each row is ONE line):
     *   diner,flshemulo=AH100 AL0 AT0 AW19 SHPLetterD/flshemuli=AH100 AL20...
     *
     * The overrides use "/" as separator between var=value pairs.
     * An override in this section REPLACES the global variable for that ROM.
     */
    parseTableVariables(text) {
        const m = text.match(/\[TableVariables\]([\s\S]*?)(?=\[|\s*$)/i);
        if(!m) return;

        let romCount = 0;
        for(const line of m[1].split('\n')) {
            const clean = line.trim();
            if(!clean || clean.startsWith('#') || clean.startsWith(';')) continue;
            const commaIdx = clean.indexOf(',');
            if(commaIdx < 1) continue;

            const romName = clean.slice(0, commaIdx).trim().toLowerCase();
            const rest    = clean.slice(commaIdx + 1).trim();
            if(!romName || !rest) continue;

            // Each "/"-separated segment is a "varName=value" override
            const overrideMap = new Map();
            for(const segment of rest.split('/')) {
                const eqIdx = segment.indexOf('=');
                if(eqIdx < 1) continue;
                const varName = segment.slice(0, eqIdx).trim().toLowerCase();
                const varVal  = segment.slice(eqIdx + 1).trim();
                if(varName && varVal) overrideMap.set(varName, varVal);
            }

            if(overrideMap.size > 0) {
                this.data.tableVariables.set(romName, overrideMap);
                romCount++;
            }
        }

        console.log(`%c[v13.11.0] TableVariables parsed: ${romCount} ROMs with overrides`, 'color:#00e5ff;font-weight:bold');
        for(const [rom, map] of this.data.tableVariables) {
            const preview = Array.from(map.entries()).slice(0,3).map(([k,v])=>`${k}→${v.slice(0,25)}`).join(', ');
            console.log(`  ${rom}: ${map.size} overrides  [${preview}${map.size>3?', …':''}]`);
        }
    },

    /**
     * loadCabinetJSON(file)
     * Loads the Cabinet JSON file (e.g. "waltadc_s_Pinball_Cabinet.json")
     * and calls parseComboDefinitions() to populate data.combos.
     */
    async loadCabinetJSON(file) {
        if(!file) return;
        // v13.11.14: Extension-only validation
        if(!file.name.toLowerCase().endsWith('.json')) {
            alert(`File Validation Error\n\nExpected: a .json file\nReceived: ${file.name}\n\nThis input only accepts JSON files.`);
            return;
        }
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            this.parseComboDefinitions(json);
            document.getElementById('system-status').innerText = `Cabinet JSON loaded. ${this.data.combos.size} combos found.`;
        } catch(e) {
            console.error('[v13.11.0] Failed to parse Cabinet JSON:', e);
            document.getElementById('system-status').innerText = `❌ Cabinet JSON parse error.`;
        }
    },

    /**
     * parseComboDefinitions(json)
     * Extracts combo definitions from the parsed Cabinet JSON object.
     * Populates data.combos — a Map<comboName, { id, name, toyIds[] }>.
     *
     * JSON structure:
     *   { "combos": { "1003": { "combo":1003, "name":"Combo3-Back Strobe", "toys":[76,82,84] } } }
     *
     * Also extracts the device→output→toy assignment map and logs it for
     * verification. Full combo expansion (routing effects to multiple toys)
     * is deferred to v13.11.2.
     */
    parseComboDefinitions(json) {
        this.data.combos.clear();

        const combosObj = json.combos || {};
        for(const [id, def] of Object.entries(combosObj)) {
            const comboName = (def.name || '').trim();
            if(!comboName) continue;
            this.data.combos.set(comboName, {
                id: def.combo || parseInt(id),
                name: comboName,
                toyIds: Array.isArray(def.toys) ? def.toys : []
            });
        }

        console.log(`%c[v13.11.0] Combo definitions parsed: ${this.data.combos.size} combos`, 'color:#00e5ff;font-weight:bold');
        for(const [name, def] of this.data.combos) {
            console.log(`  [${def.id}] "${name}" → toy IDs: [${def.toyIds.join(', ')}]`);
        }

        // Also log the device assignment table (output# → toy/combo ID) for reference
        if(Array.isArray(json.devices)) {
            console.log('%c[v13.11.0] Device Assignments:', 'color:#00e5ff');
            for(const dev of json.devices) {
                if(dev.controller_id !== 30) continue; // Focus on WS2811/LED controller
                console.log(`  Controller ${dev.controller_id} ("${dev.name}")`);
                for(const [out, toyId] of Object.entries(dev.assignments || {})) {
                    const isCombo = toyId >= 1000;
                    const comboEntry = isCombo
                        ? [...this.data.combos.values()].find(c => c.id === toyId)
                        : null;
                    const label = comboEntry ? `COMBO → "${comboEntry.name}"` : `toy ID ${toyId}`;
                    console.log(`    Output ${out} → ${label}`);
                }
            }
        }

        // v13.11.8: Build Config1 (LedWiz 1) and Config2 (LedWiz 2) toy maps.
        // Maps output number → toy name so parseActiveEffects can light the right indicator.
        const DOF_TOYS_BY_ID = {
            1:'Start Button', 2:'Launch Button', 3:'Extra Ball', 4:'Coin',
            8:'Flipper Left', 9:'Flipper Right', 10:'8 Bumper Center',
            11:'8 Bumper Left', 12:'8 Bumper Right', 13:'8 Bumper Back',
            14:'Knocker', 15:'Shaker', 16:'Gear', 17:'Slingshot Left',
            18:'Slingshot Right', 19:'Strobe', 20:'3 Flasher Left',
            21:'3 Flasher Center', 22:'3 Flasher Right',
            23:'5 Flasher Outside Left', 24:'5 Flasher Left', 25:'5 Flasher Center',
            26:'5 Flasher Right', 27:'5 Flasher Outside Right',
            28:'RGB Flippers', 29:'Exit', 30:'Beacon', 31:'RGB Undercab Smart',
            32:'Fan', 33:'10 Bumper Middle Left', 34:'10 Bumper Middle Center',
            35:'10 Bumper Middle Right', 36:'10 Bumper Back Left',
            37:'10 Bumper Back Center', 38:'10 Bumper Back Right',
            43:'Authentic Launch Ball', 73:'RGB Left Magnasave',
            90:'RGB Right Magnasave', 106:'RGB Fire Button',
        };
        this.data.config1ToyMap.clear();
        this.data.config2ToyMap.clear();
        if(Array.isArray(json.devices)) {
            for(const dev of json.devices) {
                const targetMap = dev.controller_id === 1 ? this.data.config1ToyMap
                                : dev.controller_id === 2 ? this.data.config2ToyMap
                                : null;
                if(!targetMap) continue;
                for(const [outStr, toyId] of Object.entries(dev.assignments || {})) {
                    const outNum = parseInt(outStr);
                    const comboEntry = toyId >= 1000
                        ? [...this.data.combos.values()].find(c => c.id === toyId) : null;
                    const toyName = comboEntry ? comboEntry.name
                                  : (DOF_TOYS_BY_ID[toyId] || `Toy ${toyId}`);
                    targetMap.set(outNum, toyName);
                }
            }
        }
        console.log(`%c[v13.11.8] Config1 toy map: ${this.data.config1ToyMap.size} outputs, Config2: ${this.data.config2ToyMap.size} outputs`, 'color:#9de2ff');
    },

    /**
     * substituteVariables(effectStr, romName)
     * Resolves all @varName@ tokens in an effect string, applying:
     *   1. Table-specific overrides (from tableVariables for this ROM), then
     *   2. Global variables (from the variables map).
     *
     * NOTE (v13.11.0): This function is built and tested via console logging
     * in loadTable(), but is NOT yet called in parseActiveEffects() or
     * registerEffect(). That integration happens in v13.11.1.
     *
     * @param {string} effectStr  — raw effect string, e.g. "S5 @flshemulo@ L2"
     * @param {string} romName    — lowercase ROM name for table-variable lookup
     * @returns {string}          — expanded effect string
     */
    substituteVariables(effectStr, romName) {
        if(!effectStr || !effectStr.includes('@')) return effectStr;

        // v13.11.10: Flasher/strobe variables are NOT substituted here.
        // They are handled by registerEffect directly so they route to toy
        // indicators instead of being rendered as generic SHPCircle3 matrix shapes.
        const SKIP_SUBSTITUTION = new Set([
            'flasherclo','flashercli','flashercc','flashercri','flashercro',
            'flshemulo','flshemuli','flshemuc','flshemuri','flshemuro',
            'strblft','strbrgt',
        ]);

        const tableOverrides = this.data.tableVariables.get(romName) || new Map();

        return effectStr.replace(/@(\w+)@/g, (match, varName) => {
            const key = varName.toLowerCase();
            if(SKIP_SUBSTITUTION.has(key)) return match; // leave as @token@
            // Table-specific override takes priority over global
            if(tableOverrides.has(key)) return tableOverrides.get(key);
            if(this.data.variables.has(key)) return this.data.variables.get(key);
            // Unknown variable — leave as-is and warn
            console.warn(`[v13.11.0] Unknown @variable@: @${varName}@ (ROM: ${romName})`);
            return match;
        });
    },

    async loadShapesXML(file) {
        if(!file) return;
        // v13.11.14: Extension-only validation (filename may vary, but must be .xml)
        if(!file.name.toLowerCase().endsWith('.xml')) {
            alert(`File Validation Error\n\nExpected: a .xml file\nReceived: ${file.name}\n\nThis input only accepts XML files.`);
            return;
        }
        const text = await file.text();
        
        // VALIDATION v13.6: Ensure this is actually DirectOutputShapes.xml
        if (!text.includes('<DirectOutputShapes') && !text.includes('<Shape>')) {
            alert('ERROR: This does not appear to be DirectOutputShapes.xml.\n\nPlease upload the correct shapes XML file.');
            document.getElementById('system-status').innerText = "❌ Invalid Shapes XML";
            return;
        }
        if (text.includes('<Cabinet') || text.includes('<LedStrip>')) {
            alert('ERROR: You uploaded Cabinet.xml instead of DirectOutputShapes.xml.\n\nPlease upload DirectOutputShapes.xml.');
            document.getElementById('system-status').innerText = "❌ Wrong file (Cabinet, not Shapes)";
            return;
        }
        
        const getTag = (block, tag) => {
            const m = block.match(new RegExp('<' + tag + '>\\s*([\\s\\S]*?)\\s*<\\/' + tag + '>', 'i'));
            return m ? m[1].trim() : '';
        };
        const parseBlock = (block, isAnimated) => {
            const name = (getTag(block, 'Name') || getTag(block, 'n')).toLowerCase();
            if (!name) return;
            this.data.shapes.set(name, {
                x: parseInt(getTag(block, 'BitmapLeft')) || 0,
                y: parseInt(getTag(block, 'BitmapTop')) || 0,
                w: parseInt(getTag(block, 'BitmapWidth')) || 16,
                h: parseInt(getTag(block, 'BitmapHeight')) || 16,
                animated: isAnimated,
                stepSize: parseInt(getTag(block, 'AnimationStepSize')) || 0,
                frameCount: parseInt(getTag(block, 'AnimationFrameCount')) || 1,
                frameDur: parseInt(getTag(block, 'AnimationFrameDurationMs')) || 40,
                stepDir: getTag(block, 'AnimationStepDirection') || 'Right'
            });
        };
        for (const m of text.matchAll(/<Shape>([\s\S]*?)<\/Shape>/gi)) parseBlock(m[1], false);
        for (const m of text.matchAll(/<ShapeAnimated>([\s\S]*?)<\/ShapeAnimated>/gi)) parseBlock(m[1], true);
        document.getElementById('system-status').innerText = `Shapes: ${this.data.shapes.size} loaded.`;
        this.checkFilesLoaded(); // v13.10.1: Check if all files loaded
    },

    loadShapesPNG(file) {
        if(!file) return;
        // v13.11.14: Extension-only validation (filename may vary, but must be .png)
        if(!file.name.toLowerCase().endsWith('.png')) {
            alert(`File Validation Error\n\nExpected: a .png file\nReceived: ${file.name}\n\nThis input only accepts PNG image files.`);
            return;
        }
        const img = new Image();
        img.onload = () => {
            const cvs = document.getElementById('sprite-canvas');
            cvs.width = img.width; cvs.height = img.height;
            const ctx = cvs.getContext('2d');
            ctx.drawImage(img, 0, 0);
            this.data.shapeAtlas = ctx;
            this.checkFilesLoaded(); // v13.10.1: Check if all files loaded
        };
        img.src = URL.createObjectURL(file);
    },

    renderMatrixGrid() {
        const m = this.data.cabinet.matrix;
        const el = document.getElementById('led-matrix');
        // v13.11.19: width:'100%' (set in CSS) + aspect-ratio:1 on .pix cells fills
        // the viewport horizontally and keeps cells square — correct intrinsic scale.
        el.style.gridTemplateColumns = `repeat(${m.w}, 1fr)`;
        el.innerHTML = '';
        for(let i=0; i<m.w*m.h; i++) {
            const d = document.createElement('div');
            d.className = 'pix'; d.id = `mx-${i}`;
            el.appendChild(d);
        }
    },

    renderStripRack() {
        const el = document.getElementById('strip-rack');
        el.innerHTML = '';
        this.data.cabinet.strips.forEach((s, idx) => {
            let h = '';
            for(let i=0; i<s.leds; i++) h += `<div class="s-led" id="str-${idx}-${i}"></div>`;
            const div = document.createElement('div');
            div.className = 'strip-col';
            
            // v13.9.4 USER REQUEST #2: LED count at TOP, centered
            const ledCount = `<div style="text-align:center;font-size:0.6rem;color:var(--text-muted);margin-bottom:4px;">(${s.leds})</div>`;
            
            div.innerHTML = `${ledCount}<div class="strip-body">${h}</div><div class="strip-name">${s.name}</div>`;
            el.appendChild(div);
            this.data.stripEffects.set(idx, []);
        });
    },

    loadTable(rom) {
        if(!rom) return;
        const cols = this.data.config30[rom];
        if (!cols) return;  // v13.11.55: guard — ROM may exist in config1/config2 but not config30
        const rawCode = cols.join(', ');

        // v13.11.2: Apply @variable@ substitution before the code enters the monitor.
        const code = this.data.variables.size > 0
            ? this.substituteVariables(rawCode, rom.toLowerCase())
            : rawCode;

        // v13.11.3: _setMonitorText sets textarea.value AND updates the color backdrop
        this._setMonitorText(code);
        // Reset formatted view when table changes
        const _fmtDiv = document.getElementById('code-formatted');
        const _fmtBtn = document.getElementById('btn-format-code');
        if (_fmtDiv && _fmtDiv.style.display !== 'none') {
            _fmtDiv.style.display = 'none';
            const wrap = document.querySelector('.code-monitor-wrap');
            if (wrap) wrap.style.display = '';
            if (_fmtBtn) _fmtBtn.innerText = '[ Format ]';
        }
        
        const tCont = document.getElementById('triggers-list');
        tCont.innerHTML = '';
        // Triggers are W (solenoid), S (switch/score), E (event), L (lamp).
        // L\d+ can be: layer markers (at start of layer), layer parameters (at end),
        // or genuine lamp triggers (in middle, before a color/effect param).
        const allMatches = rawCode.match(/\b([WSEL]\d+)\b/g) || [];
        
        const found = new Set();
        const layers = rawCode.split(',').flatMap(col => col.split('/'));
        
        allMatches.forEach(trig => {
            if (trig.startsWith('L')) {
                // Rule 1 — Layer MARKER: Lxx is the very first token of the layer string.
                //   e.g. "L95 E115 Blue" → L95 is the layer, E115 is the real trigger.
                const isLayerMarker = layers.some(layer => /^L-?\d+\b/i.test(layer.trim()));
                if (isLayerMarker && layers.some(layer => {
                    const t = layer.trim();
                    return /^L-?\d+\b/i.test(t) && t.startsWith(trig);
                })) {
                    return; // skip layer markers
                }

                // Rule 2 — Layer PARAMETER: Lxx is at the very END of the layer string.
                //   e.g. "S26 WHITE 750 ABT1091 ABL0 ABW640 ABH128 ABF26 L6"
                //        "W19 WHITE 2000 BNP100 ABT1091 ABL0 ABH128 ABF19 L10"
                //   Regardless of what parameter precedes it (including AB-family, BNP, AAC,
                //   plain numbers, etc.), if Lxx is at the tail it is always a layer param.
                //   Exception: a string that is ONLY "Lxx" may itself be a standalone lamp trigger.
                const isLayerParam = layers.some(layer => {
                    const t = layer.trim();
                    // Must end with this exact Lxx token
                    if (!new RegExp(`\\b${trig}\\s*$`, 'i').test(t)) return false;
                    // Must not be ONLY this Lxx (standalone lamp trigger like "L47")
                    if (new RegExp(`^${trig}\\s*$`, 'i').test(t)) return false;
                    // Must not start with this Lxx (that's a layer marker, handled above)
                    if (new RegExp(`^${trig}\\b`, 'i').test(t)) return false;
                    return true;
                });
                if (isLayerParam) {
                    return; // skip layer parameters
                }
            }
            found.add(trig);
        });
        
        // v13.11.3: Merge Config1 (LedWiz physical toys) triggers into the found set.
        // Config30 only covers WS2811 LED strips/matrix. Config1 covers strobes, flashers,
        // solenoids etc. that fire on the same ROM events (S/W triggers) but drive
        // physical LedWiz outputs. We extract their triggers and add them to the list
        // so the user can fire physical toy events alongside LED effects.
        if (this.data.config1 && this.data.config1[rom]) {
            const c1cols = this.data.config1[rom];
            const c1code = c1cols.join(',');
            const c1layers = c1code.split(',').flatMap(col => col.split('/'));
            const c1matches = c1code.match(/\b([WSEL]\d+)\b/g) || [];
            c1matches.forEach(trig => {
                if (found.has(trig)) return; // already in Config30 set
                if (trig.startsWith('L')) {
                    // Same L-filter rules apply
                    const isLayerParam = c1layers.some(layer => {
                        const t = layer.trim();
                        if (!new RegExp(`\\b${trig}\\s*$`, 'i').test(t)) return false;
                        if (new RegExp(`^${trig}\\s*$`, 'i').test(t)) return false;
                        if (new RegExp(`^${trig}\\b`, 'i').test(t)) return false;
                        return true;
                    });
                    const isLayerMarker = c1layers.some(layer => {
                        const t = layer.trim();
                        return /^L-?\d+\b/i.test(t) && t.startsWith(trig);
                    });
                    if (isLayerParam || isLayerMarker) return;
                }
                // Mark Config1-only triggers with a distinct visual tag (⚡ = physical toy)
                found.add('⚡' + trig);
            });
        }

        // v13.9.4 PORT: Count layers per trigger for badge display
        const triggerLayerCount = new Map();
        found.forEach(trig => {
            const layersForTrigger = new Set();
            layers.forEach(layer => {
                if (new RegExp('\\b' + trig + '\\b').test(layer)) {
                    const lm = layer.match(/\bL(-?\d+)\b/i);
                    const layerNum = lm ? parseInt(lm[1]) : 0;
                    layersForTrigger.add(layerNum);
                }
            });
            triggerLayerCount.set(trig, layersForTrigger.size);
        });
        
        Array.from(found).sort((a, b) => {
            // Strip ⚡ prefix for sort comparison
            const ca = a.replace('⚡',''), cb = b.replace('⚡','');
            return ca.localeCompare(cb, undefined, {numeric: true});
        }).forEach(trig => {
            const isPhysical = trig.startsWith('⚡');
            const realTrig = isPhysical ? trig.slice(1) : trig; // strip prefix for DOM/logic
            const d = document.createElement('div');
            d.className = 'trigger-card' + (isPhysical ? ' trigger-physical' : '');
            d.dataset.trig = realTrig; // v13.11.8: for trigger-fired highlight in gameLoop
            
            // v13.9.4 PORT: Add layer count badge (clickable)
            const layerCount = triggerLayerCount.get(trig) || 1;
            const badge = layerCount > 1 
                ? `<span class="trigger-badge" onclick="App.openTriggerInspector('${realTrig}'); event.stopPropagation();" title="Inspect ${layerCount} layers">${layerCount}</span>` 
                : '';
            // v13.11.3: Physical toy indicator (⚡ = Config1 LedWiz only, no LED effect)
            const physTag = isPhysical ? `<span class="trigger-phys-tag" title="LedWiz physical toy (Config1)">⚡</span>` : '';
            
            d.innerHTML = `
                <div class="trigger-head">
                    <span class="trigger-name">${physTag}${realTrig}</span>${badge}
                </div>
                <div class="trigger-actions">
                    <button class="btn-trig" onmousedown="App.trigStart('${realTrig}')" title="Momentary — hold to fire, release anywhere to stop">M</button>
                    <button class="btn-trig" onclick="App.latch('${realTrig}',this)">L</button>
                </div>`;
            tCont.appendChild(d);
        });

        const toyCont = document.getElementById('toys-container');
        toyCont.innerHTML = '';
        
        const displayToys = new Map();
        const addUniqueToy = (name, type, meta) => {
            if(!displayToys.has(name)) {
                displayToys.set(name, {name, type, meta: meta || null});
            }
        };

        // v13.11.9: DOF_VARIABLE_METADATA — maps @varname@ tokens to human labels.
        // Scanned from RAWCODE so we see flasher/strobe tokens before substitution
        // collapses them into generic 'Circle3' shapes.
        // type:'flasher'/'strobe' → show as named toy indicator with distinct color.
        // type:'shape_alias' → SHP scan already adds it; skip the @token here.
        // type:'internal' → utility param, never a toy.
        const DOF_VARIABLE_METADATA = {
            'flasherclo':  {label:'Flasher Ch. Outside Left',  icon:'◉', color:'#ff8c00', type:'flasher'},
            'flashercli':  {label:'Flasher Ch. Left',          icon:'◉', color:'#ff8c00', type:'flasher'},
            'flashercc':   {label:'Flasher Ch. Center',        icon:'◉', color:'#ff8c00', type:'flasher'},
            'flashercri':  {label:'Flasher Ch. Right',         icon:'◉', color:'#ff8c00', type:'flasher'},
            'flashercro':  {label:'Flasher Ch. Outside Right', icon:'◉', color:'#ff8c00', type:'flasher'},
            'flshemulo':   {label:'Flasher MX Outside Left',   icon:'◉', color:'#ffaa00', type:'flasher'},
            'flshemuli':   {label:'Flasher MX Left',           icon:'◉', color:'#ffaa00', type:'flasher'},
            'flshemuc':    {label:'Flasher MX Center',         icon:'◉', color:'#ffaa00', type:'flasher'},
            'flshemuri':   {label:'Flasher MX Right',          icon:'◉', color:'#ffaa00', type:'flasher'},
            'flshemuro':   {label:'Flasher MX Outside Right',  icon:'◉', color:'#ffaa00', type:'flasher'},
            'strblft':     {label:'Strobe MX Left',            icon:'⚡', color:'#e0e0ff', type:'strobe'},
            'strbrgt':     {label:'Strobe MX Right',           icon:'⚡', color:'#e0e0ff', type:'strobe'},
            // Shape aliases — @token expands to its own SHPxxx; SHP scan handles the toy
            'pointplop':      {type:'shape_alias'},
            'circlepulse':    {type:'shape_alias'},
            'roundpulse':     {type:'shape_alias'},
            'squareplop':     {type:'shape_alias'},
            'diamondboxpulse':{type:'shape_alias'},
            'vlinepulse':     {type:'shape_alias'},
            'updown':         {type:'shape_alias'},
            'leftright':      {type:'shape_alias'},
            // Internal / timing tokens — never a toy
            't': {type:'internal'}, 'dt': {type:'internal'}, 'playon': {type:'internal'},
        };

        // Scan RAWCODE for @variable@ tokens → named flasher/strobe toys.
        // Must use rawCode here (not expanded code) because substitution
        // collapses @strblft@ → 'White AH30 AL0 AT0 AW9 SHPCircle3',
        // making Circle3 indistinguishable from matrix shapes.
        const rawCols = rawCode.split(/,(?![^(]*\))/);
        rawCols.forEach((colStr, colIdx) => {
            const outputNum = this._getOutputNum(colIdx, rawCols.length);
            const hwName = outputNum ? this.data.cabinet.toyMap.get(outputNum) : null;
            const isMatrix = hwName === 'Matrix';
            const isStrip  = hwName && this.data.cabinet.stripNames.has(hwName);
            // Only scan matrix column and non-hardware columns for @var@ toys
            // (flashers on matrix; strips handled separately)
            [...colStr.matchAll(/@(\w+)@/g)].forEach(m => {
                const key = m[1].toLowerCase();
                // @Letter*@ / @Number*@ → shape_alias (SHP scan finds the toy)
                if(/^letter[a-z]$/i.test(key) || /^number\d$/i.test(key)) return;
                const meta = DOF_VARIABLE_METADATA[key];
                if(!meta) return; // unknown variable, skip
                if(meta.type === 'internal') return;
                if(meta.type === 'shape_alias') return; // SHP scan handles it
                // flasher or strobe → add as named toy with metadata
                addUniqueToy(meta.label, meta.type, {varKey: key, ...meta});
            });
        });

        // Scan EXPANDED code for SHP shapes (matrix column only) and @tag@ toys
        [...code.matchAll(/@(\w+)@/g)].forEach(m => {
            const key = m[1].toLowerCase();
            if(/^letter[a-z]$/i.test(key) || /^number\d$/i.test(key)) return; // SHP scan handles
            const meta = DOF_VARIABLE_METADATA[key];
            if(meta && (meta.type === 'internal' || meta.type === 'shape_alias' || meta.type === 'flasher' || meta.type === 'strobe')) return; // rawCode scan handles flasher/strobe
            if(!meta) addUniqueToy(m[1], 'mxvar'); // unknown @token → show as generic mxvar
        });

        [...code.matchAll(/SHP([a-zA-Z0-9_]+)/g)].forEach(m => addUniqueToy(m[1], 'shape'));
        
        // Hardware toys (non-strip, non-matrix columns)
        cols.forEach((val, idx) => {
            const outputNum = this._getOutputNum(idx, cols.length);
            if(!outputNum) return;
            const hwName = this.data.cabinet.toyMap.get(outputNum);
            if(hwName && val.trim() !== "0" && val.trim() !== "" 
               && !this.data.cabinet.stripNames.has(hwName) 
               && hwName !== 'Matrix') {
                addUniqueToy(hwName, 'mech');
            }
        });
        
        // v13.9.4 PORT: Multi-layer detection - scan ALL columns for each toy
        const toyLayerCount = new Map();
        const allToyNames = new Set(displayToys.keys());
        
        allToyNames.forEach(toyName => {
            const layersForToy = new Set();
            
            cols.forEach((colStr, colIdx) => {
                const outputNum = this._getOutputNum(colIdx, cols.length); // v13.11.3: hybrid
                const hwName = this.data.cabinet.toyMap.get(outputNum);
                
                const layers = colStr.split('/');
                layers.forEach(layer => {
                    let foundInLayer = false;
                    
                    // Check direct hardware mapping
                    if(hwName === toyName && layer.trim() && layer.trim() !== '0') {
                        foundInLayer = true;
                    }
                    
                    // Check @ tags
                    const tagMatch = layer.match(/@(\w+)@/);
                    if(tagMatch && tagMatch[1] === toyName) {
                        foundInLayer = true;
                    }
                    
                    // Check SHP shapes
                    const shpMatch = layer.match(/SHP([a-zA-Z0-9_]+)/);
                    if(shpMatch && shpMatch[1] === toyName) {
                        foundInLayer = true;
                    }
                    
                    // If found, extract layer number
                    if(foundInLayer) {
                        const lm = layer.match(/\bL(-?\d+)\b/i);
                        const layerNum = lm ? parseInt(lm[1]) : 0;
                        layersForToy.add(layerNum);
                    }
                });
            });
            
            toyLayerCount.set(toyName, layersForToy);
        });

        // --- SORTING ---
        const sortedToys = Array.from(displayToys.values()).sort((a, b) => {
            const getPriority = (item) => {
                const n = item.name.toLowerCase();
                if(n.includes('flasher')) return 1;
                if(n.includes('strobe')) return 2;
                if(n.startsWith('letter') || item.type === 'shape') return 3;
                return 4;
            };
            const pA = getPriority(a);
            const pB = getPriority(b);
            if (pA !== pB) return pA - pB;
            return a.name.localeCompare(b.name);
        });

        sortedToys.forEach(item => {
            const d = document.createElement('div');
            d.className = 'toy-item';
            d.onclick = () => this.openToyInspector(item.name);
            d.title = `Click to Inspect: ${item.name}`;

            const id = item.name.replace(/\s+/g, '_');
            let lampClass = 'toy-lamp';
            if(item.type === 'shape') lampClass += ' shape-indicator';
            if(item.type === 'flasher') lampClass += ' flasher-indicator';
            if(item.type === 'strobe')  lampClass += ' strobe-indicator';
            
            // Apply indicator color hint from metadata
            const colorStyle = item.meta?.color ? ` style="--toy-accent:${item.meta.color}"` : '';
            
            // v13.9.4 PORT: Apply italic styling if multi-layer
            const layerCount = toyLayerCount.get(item.name)?.size || 1;
            const multiLayerClass = layerCount > 1 ? 'multi-layer' : '';
            const iconHtml = item.meta?.icon ? `<span class="toy-icon">${item.meta.icon}</span>` : '';
            
            d.innerHTML = `<div class="${lampClass}" id="toy-${id}"${colorStyle}></div><div class="toy-label ${multiLayerClass}">${iconHtml}${item.name}</div>`;
            toyCont.appendChild(d);
        });

        // v13.11.9: Config1 Physical Toy Panel
        // Shows all Config1 (LedWiz 1) physical toys for this ROM with checkboxes.
        // User can enable/disable each toy. Enabled toys show a lit amber indicator.
        this._renderPhysicalToyPanel(rom);
        this._renderRgbToyPanel(rom); // v13.11.13: Config2 RGB toy chips

        this.data.activeTriggers.clear();
        this.data.latchedTriggers.clear();
        this.parseActiveEffects();

        // v13.11.20 Item 1: Snapshot the "always-on" default state so activity LEDs
        // only light when triggers add NEW toys beyond what's lit at table load.
        // Store IDs and matrix count captured right now (no triggers active).
        this.data.defaultActiveToyIds = new Set(this.data.toyEffects.keys());
        this.data.defaultMatrixCount  = this.data.matrixEffects.length;

        // v13.13.1: Warn if table uses SHP shapes but shapes files aren't loaded
        this._checkShapeFilesNeeded(code);
        
        // ── v13.11.0: Verify variable substitution for selected ROM ──────────────
        // This logs substitution results to the console for testing.
        // substituteVariables() is NOT yet called in rendering (that's v13.11.1).
        this._logSubstitutionPreview(rom, code);
    },

    // v13.13.1: Check if table code references SHP shapes and warn if files missing
    _checkShapeFilesNeeded(code) {
        if (!code || !(/\bSHP\w/i.test(code))) return;
        const hasXML = this.data.shapes && this.data.shapes.size > 0;
        const hasPNG = !!this.data.shapeAtlas;
        if (hasXML && hasPNG) return;

        const missing = [];
        if (!hasXML) missing.push('DirectOutputShapes.xml');
        if (!hasPNG) missing.push('DirectOutputShapes.png');

        // Only warn once per session per missing combo
        const key = '_shapeWarnShown_' + missing.join('+');
        if (this[key]) return;
        this[key] = true;

        const toast = document.createElement('div');
        toast.className = 'shape-warn-toast';
        toast.innerHTML = `
            <div class="shape-warn-title">\u26A0 Missing Shape File${missing.length > 1 ? 's' : ''}</div>
            <div class="shape-warn-body">
                This table uses <strong>SHP</strong> shape effects, but ${missing.length > 1 ? 'these files are' : 'this file is'} not loaded:
                <ul>${missing.map(f => '<li>' + f + '</li>').join('')}</ul>
                Shapes will not render on the LED matrix until ${missing.length > 1 ? 'both files are' : 'this file is'} loaded in the Configuration panel.
            </div>
            <div class="shape-warn-dismiss" onclick="this.parentElement.remove()">\u2715 Dismiss</div>`;
        document.body.appendChild(toast);
        setTimeout(() => { if (toast.parentElement) toast.remove(); }, 12000);
    },

    /**
     * _logSubstitutionPreview(rom, rawCode)
     * v13.11.0 verification helper: logs what @variable@ tokens exist in this
     * ROM's effect string and what they would expand to after substitution.
     * Called by loadTable() — has NO effect on rendering.
     */
    _logSubstitutionPreview(rom, rawCode) {
        const romLower = rom.toLowerCase();
        const varTokens = [...new Set(rawCode.match(/@(\w+)@/g) || [])];
        if(varTokens.length === 0) {
            console.log(`%c[v13.11.0] ROM "${rom}": No @variable@ tokens found.`, 'color:#888');
            return;
        }
        const tableOverrides = this.data.tableVariables.get(romLower) || new Map();
        console.group(`%c[v13.11.0] ROM "${rom}" — ${varTokens.length} @variable@ token(s)`, 'color:#00e5ff;font-weight:bold');
        for(const token of varTokens) {
            const varName = token.replace(/@/g, '').toLowerCase();
            let resolved, source;
            if(tableOverrides.has(varName)) {
                resolved = tableOverrides.get(varName);
                source = '📌 TableVariables override';
            } else if(this.data.variables.has(varName)) {
                resolved = this.data.variables.get(varName);
                source = '🌐 Global [Variables DOF]';
            } else {
                resolved = token; // unresolved
                source = '❌ UNKNOWN — not in any variable map';
            }
            console.log(`  ${token}  →  "${resolved.slice(0, 80)}${resolved.length > 80 ? '…' : ''}"  [${source}]`);
        }
        // Show what the first column would look like after full substitution
        const firstCol = rawCode.split(/,(?![^(]*\))/)[0];
        const expanded = this.substituteVariables(firstCol, romLower);
        if(expanded !== firstCol) {
            console.log('%c  === FIRST COLUMN AFTER SUBSTITUTION ===', 'color:#aaa;font-size:0.85em');
            console.log(`  BEFORE: ${firstCol.slice(0, 120)}`);
            console.log(`  AFTER:  ${expanded.slice(0, 120)}`);
        }
        console.groupEnd();
    },

    /**
     * _renderPhysicalToyPanel(rom)
     * v13.11.9: Renders the Config1 (LedWiz 1) physical toy panel below Active Toys.
     * Shows each toy from config1ToyMap for this ROM with a checkbox to enable it
     * and an amber indicator that lights up when the toy fires.
     */
    _renderPhysicalToyPanel(rom) {
        const panel = document.getElementById('physical-toys-panel');
        if(!panel) return;

        // Collect unique toy names for this ROM from Config1
        const romKey = rom.toLowerCase();
        const physToys = new Map(); // toyName → Set of output nums
        if(this.data.config1 && this.data.config1[romKey]) {
            this.data.config1[romKey].forEach((colStr, colIdx) => {
                const outNum = colIdx + 1;
                const toyName = this.data.config1ToyMap.get(outNum);
                if(!toyName || !colStr.trim() || colStr.trim() === '0') return;
                if(!physToys.has(toyName)) physToys.set(toyName, new Set());
                physToys.get(toyName).add(outNum);
            });
        }

        if(physToys.size === 0) {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = 'block';

        // v13.11.19: populate toy count tip in the section-toggler header
        const countTip = document.getElementById('phys-toy-count-tip');
        if (countTip) countTip.textContent = `${physToys.size} toy${physToys.size !== 1 ? 's' : ''} present`;

        const cont = document.getElementById('physical-toys-container');
        cont.innerHTML = '';

        // Preserve existing enabledPhysicalToys selections across table switches
        // New toys default to enabled
        physToys.forEach((outNums, toyName) => {
            if(!this.data.enabledPhysicalToys.has(toyName) && 
               !Array.from(this.data.enabledPhysicalToys).some(n => n === '~disabled~' + toyName)) {
                this.data.enabledPhysicalToys.add(toyName);
            }
        });

        Array.from(physToys.keys()).sort().forEach(toyName => {
            const isEnabled = this.data.enabledPhysicalToys.has(toyName);
            const id = 'phys_' + toyName.replace(/[^a-zA-Z0-9]/g, '_');
            const d = document.createElement('div');
            d.className = 'phys-toy-item' + (isEnabled ? ' phys-enabled' : '');
            d.innerHTML = `
                <input type="checkbox" id="chk-${id}" ${isEnabled ? 'checked' : ''}
                    onchange="App.togglePhysicalToy('${toyName}', this.checked)">
                <div class="phys-toy-lamp" id="toy-${id}"></div>
                <label for="chk-${id}" class="phys-toy-label">${toyName}</label>`;
            cont.appendChild(d);
        });
    },

    // v13.11.13 ── Config2 RGB Toy Panel ─────────────────────────────────────
    // Maps output column indices (0-based from config2[rom] array) to RGB toy groups.
    // OUT_N → array index N-1.  Col 16 (index 15) is the 4th Fire Button channel (RGBW)
    // but rarely used; we model R=13, G=14, B=15 only.
    // Undercab Right starts at OUT20 but Config2 rows rarely exceed 22 cols.
    // v13.11.15 ── Config2 RGB Toy Engine ─────────────────────────────────────
    //
    // DYNAMIC TOY MAP: Parsed from the Config2.ini header comment line.
    // Format: # "Rom","RGB Flippers","","","RGB Flippers","","","RGB Left Magnasave",...
    // Named column = first channel (R) of a new toy group.
    // Empty strings = continuation channels (G, B, W) of the same toy.
    //
    // NAMING: If the same raw name appears multiple times, differentiate:
    //   "RGB Flippers" x2 → "Left Flipper" / "Right Flipper"  (special case)
    //   "RGB Undercab Smart" x2 → "Undercab Smart L" / "Undercab Smart R"
    //   Any other duplicate → append " L" / " R" / " 3" etc.
    //
    // LAST TOY CHANNEL EXTENSION: The header comment is often truncated (stops at
    // the R channel of the last toy). The last toy always gets 3 channels minimum
    // so G/B data beyond the header are included.
    //
    // COLOR MODEL — HYBRID LOGIC:
    //   Each column drives one physical diode of the RGB toy LED.
    //   RULE: If all active non-nobool channels have the SAME named color → use
    //         that color directly (designer's intent). Otherwise → channel-position
    //         blend: ch0=#ff0000 (R), ch1=#00ff00 (G), ch2=#0000ff (B), ch3=#ffffff (W).
    //   nobool channels (e.g. "L59 nobool") → contribute their diode color
    //   because the lamp drives that physical LED element.

    _buildRgbToyMap() {
        const header = this.data.config2Header;
        if (!header || !header.length) return this._defaultRgbToyMap();

        const toys = [];
        let current = null;
        header.forEach((name, i) => {
            const stripped = name.trim();
            if (i === 0) return; // Skip 'Rom'
            if (stripped) {
                if (current) toys.push(current);
                current = { rawName: stripped, dataIndices: [i - 1] }; // i-1: data array is 0-based
            } else if (current) {
                current.dataIndices.push(i - 1);
            }
        });
        if (current) toys.push(current);
        if (!toys.length) return this._defaultRgbToyMap();

        // Extend last toy to 3 channels minimum (header truncation guard)
        const last = toys[toys.length - 1];
        while (last.dataIndices.length < 3) {
            last.dataIndices.push(last.dataIndices[last.dataIndices.length - 1] + 1);
        }

        // v13.11.16: Enforce 3-channel maximum per toy (RGB only — no alpha/RGBW).
        // If any toy has 4+ channels in the header, the Config2 file likely has a
        // misconfigured extra blank column. Trim to 3 and log a warning.
        toys.forEach(t => {
            if (t.dataIndices.length > 3) {
                console.warn(
                    `[DOF Simulator] Config2 header issue detected: toy "${t.rawName}" ` +
                    `has ${t.dataIndices.length} channels defined (expected 3 for RGB). ` +
                    `Extra channels trimmed. Check your DirectOutputConfig2.ini header comment ` +
                    `for extra blank columns near this toy group.`
                );
                t.dataIndices = t.dataIndices.slice(0, 3);
            }
        });

        // Apply display names — resolve duplicates
        const nameCounts = {};
        toys.forEach(t => { nameCounts[t.rawName] = (nameCounts[t.rawName] || 0) + 1; });
        const nameSeen = {};
        return toys.map(t => {
            nameSeen[t.rawName] = (nameSeen[t.rawName] || 0) + 1;
            const nth = nameSeen[t.rawName];
            const total = nameCounts[t.rawName];
            let displayName;
            if (total === 1) {
                displayName = t.rawName;
            } else if (t.rawName === 'RGB Flippers') {
                displayName = nth === 1 ? 'Left Flipper' : 'Right Flipper';
            } else {
                const suffix = total === 2 ? (nth === 1 ? ' L' : ' R') : ` ${nth}`;
                displayName = t.rawName + suffix;
            }
            return { displayName, dataIndices: t.dataIndices };
        });
    },

    _defaultRgbToyMap() {
        return [
            { displayName: 'Left Flipper',       dataIndices: [0,1,2] },
            { displayName: 'Right Flipper',       dataIndices: [3,4,5] },
            { displayName: 'RGB Left Magnasave',  dataIndices: [6,7,8] },
            { displayName: 'RGB Right Magnasave', dataIndices: [9,10,11] },
            { displayName: 'RGB Fire Button',     dataIndices: [12,13,14,15] },
            { displayName: 'Undercab Smart L',    dataIndices: [16,17,18] },
            { displayName: 'Undercab Smart R',    dataIndices: [19,20,21] },
        ];
    },

    _renderRgbToyPanel(rom) {
        const panel = document.getElementById('rgb-toys-panel');
        if (!panel) return;
        // v13.11.19: Only show if Config2 loaded AND at least one toy parsed from header.
        if (!this.data.config2) {
            panel.style.display = 'none';
            return;
        }
        const toyMap = this._buildRgbToyMap();
        // v13.11.19 Item 6: hide entirely if no valid RGB toys resolved
        if (!toyMap || toyMap.length === 0) {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = 'block';

        // v13.11.19 Item 7: populate toy names tip in section-toggler header
        const countTip = document.getElementById('rgb-toy-count-tip');
        if (countTip) {
            const names = toyMap.map(t => t.displayName).join(' · ');
            countTip.textContent = names;
        }

        const cont = document.getElementById('rgb-toys-container');
        cont.innerHTML = '';
        toyMap.forEach(toy => {
            const id = 'rgb_' + toy.displayName.replace(/[^a-zA-Z0-9]/g, '_');
            const d = document.createElement('div');
            d.className = 'rgb-toy-item';
            d.innerHTML = `
                <div class="rgb-toy-lamp" id="toy-${id}"></div>
                <div class="rgb-toy-label">${toy.displayName}</div>`;
            cont.appendChild(d);
        });
    },

    // Resolve one channel's named color to hex via the loaded colors map.
    _extractNamedColorHex(effectStr) {
        const t = effectStr.trim();
        if (!t || t === '0') return null;
        for (const [name, hex] of this.data.colors) {
            if (new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(t)) {
                return (hex && hex.startsWith('#')) ? hex.slice(0, 7) : null;
            }
        }
        return null;
    },

    // Determine the display color for one RGB toy given its channel effect strings.
    // Returns hex color or null if all channels are dark.
    _resolveRgbToyColor(channels) {
        const DIODE = ['#ff0000', '#00ff00', '#0000ff', '#ffffff'];
        const active = [];
        channels.forEach((eff, pos) => {
            const t = (eff || '').trim();
            if (!t || t === '0') return;
            if (/^nobool$/i.test(t)) return; // bare nobool = wired but no trigger
            const isNobool = /nobool/i.test(t) && /[SWEL]\d+/i.test(t);
            const namedColor = isNobool ? null : this._extractNamedColorHex(t);
            active.push({ pos, isNobool, namedColor });
        });
        if (!active.length) return null;

        // Hybrid rule: all active channels non-nobool with same named color → use it
        const nonNobool = active.filter(a => !a.isNobool);
        if (nonNobool.length === active.length && nonNobool.length > 0) {
            const namedSet = new Set(nonNobool.map(a => a.namedColor).filter(Boolean));
            if (namedSet.size === 1) return [...namedSet][0];
        }

        // Channel-position additive blend
        let r = 0, g = 0, b = 0;
        active.forEach(a => {
            const d = DIODE[Math.min(a.pos, 3)];
            r += parseInt(d.slice(1,3), 16);
            g += parseInt(d.slice(3,5), 16);
            b += parseInt(d.slice(5,7), 16);
        });
        r = Math.min(255,r); g = Math.min(255,g); b = Math.min(255,b);
        return (r||g||b) ? `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}` : null;
    },
    togglePhysicalToy(toyName, enabled) {
        if(enabled) {
            this.data.enabledPhysicalToys.add(toyName);
        } else {
            this.data.enabledPhysicalToys.delete(toyName);
        }
        const item = document.querySelector(`.phys-toy-item [id="chk-phys_${toyName.replace(/[^a-zA-Z0-9]/g,'_')}"]`)?.closest('.phys-toy-item');
        if(item) item.className = 'phys-toy-item' + (enabled ? ' phys-enabled' : '');
    },

    trig(state, id) {
        if(state) {
            this.data.activeTriggers.add(id);
        } else if(!this.data.latchedTriggers.has(id)) {
            this.data.activeTriggers.delete(id);
            // v13.11.22 FIX: Flush any heldEffects registered for this trigger so
            // momentary-button release immediately clears the effect.
            // heldEffects from OTHER still-active/latched triggers are not affected —
            // parseActiveEffects() below will immediately re-register them.
            this.data.heldEffects = [];
        }
        this.parseActiveEffects();
    },

    // v13.11.40 FIX: M button drag-release bug.
    // onmouseup on the button element never fires if the pointer has moved outside
    // the button boundary before release — the trigger stays in activeTriggers forever,
    // acting like an accidental latch. Fix: attach the release handler to document on
    // mousedown so it catches the pointer wherever it lands on release.
    // Also handles pointercancel (OS interrupt, sleep, notification) for clean cleanup.
    trigStart(id) {
        this.trig(1, id);

        const onRelease = () => {
            this.trig(0, id);
            document.removeEventListener('mouseup',      onRelease);
            document.removeEventListener('pointercancel', onRelease);
        };
        document.addEventListener('mouseup',      onRelease, { once: true });
        document.addEventListener('pointercancel', onRelease, { once: true });
    },

    latch(id, btn) {
        if(this.data.latchedTriggers.has(id)) {
            this.data.latchedTriggers.delete(id);
            this.data.activeTriggers.delete(id);
            btn.classList.remove('active');
            // v13.11.22 FIX: flush held effects on unlatch — same reason as trig() release.
            // parseActiveEffects() below will immediately re-register held effects
            // from any OTHER still-active triggers.
            this.data.heldEffects = [];
        } else {
            this.data.latchedTriggers.add(id);
            this.data.activeTriggers.add(id);
            btn.classList.add('active');
        }
        this.parseActiveEffects();
    },

    // --- NEW: HELPER FOR UNIFIED OPACITY ---
    calculateOpacity(eff, now) {
        // v13.11.18: W wait support — effect is invisible until startTime is reached.
        if(now < eff.startTime) return 0;

        const elapsed = now - eff.startTime;
        const bpw = (eff.bpw !== undefined) ? eff.bpw : 50; // default 50% duty cycle

        // v13.11.21: Max duration hard cutoff — effect ends after maxDur ms regardless of trigger
        if(eff.maxDur > 0 && elapsed >= eff.maxDur) return 0;

        // v13.11.44: FU+FD one-shot pulse on static non-moving effects.
        // "Red FU200 FD500" (no blink, no dur, AS=0): ramp 0→1 over FU ms,
        // then ramp 1→0 over FD ms, then off permanently.
        // This is the only DOF way to write a single-trigger pulse without Blink.
        // Must be checked BEFORE the FD-standalone case below.
        if(eff.fu > 0 && eff.fd > 0 && !eff.blink && !eff.dur && !(eff.as > 0)) {
            const total = eff.fu + eff.fd;
            if(elapsed >= total) return 0;
            if(elapsed < eff.fu) return elapsed / eff.fu;
            return 1 - (elapsed - eff.fu) / eff.fd;
        }

        // v13.11.43: FD standalone on static effects — one-shot fade-out from full brightness.
        // "Red FD500" on a static (AS=0), no-blink, no-dur effect: effect starts at opacity 1
        // and linearly fades to 0 over FD ms. After FD ms the effect is fully off.
        // Distinguished from the moving-effect case (AS>0) where FD is a spatial comet-trail
        // gradient handled per-pixel in drawColorFill/drawShapeScaled/strip loop.
        if(eff.fd > 0 && !eff.dur && !eff.blink && !(eff.as > 0) && !eff.fu) {
            if(elapsed >= eff.fd) return 0;
            return 1 - elapsed / eff.fd;
        }

        // v13.11.21: Bare numeric duration timeout (no blink keyword)
        // "Red 500" → on for 500ms then off. "Red 500 FD200" → fade out over 200ms after 500ms.
        if(eff.dur > 0 && eff.blink === 0) {
            if(elapsed >= eff.dur + (eff.fd || 0)) return 0;
            if(elapsed >= eff.dur) {
                if(eff.fd > 0) return 1 - (elapsed - eff.dur) / eff.fd;
                return 0;
            }
            // Within dur: apply FU if specified
            if(eff.fu > 0 && elapsed < eff.fu) return elapsed / eff.fu;
            return 1;
        }

// Case 1: Blink with per-cycle FU/FD fade — seamless breathing cycle.
        // When BOTH FU and FD are present, they define the complete waveform:
        //   period = FU+FD (e.g. 250+500=750ms), no dead gap, no black frame.
        // When only one is present, BPW gates the on/off split within the blink interval.
        if(eff.blink > 0 && (eff.fu > 0 || eff.fd > 0)) {
            const interval = (eff.fu > 0 && eff.fd > 0) ? eff.fu + eff.fd : eff.blink;
            const onTime   = (eff.fu > 0 && eff.fd > 0) ? eff.fu : Math.round(interval * bpw / 100);
            const offTime = interval - onTime;
            const cyclePos = elapsed % interval;
            if(cyclePos < onTime) {
                // ON phase — apply FU fade within the on window
                if(eff.fu > 0) return Math.min(1, cyclePos / eff.fu);
                return 1;
            } else {
                // OFF phase — apply FD fade within the off window
                if(eff.fd > 0) {
                    const offElapsed = cyclePos - onTime;
                    return Math.max(0, 1 - offElapsed / eff.fd);
                }
                return 0;
            }
        }

        // Case 2: Blink keyword only (no number) + FU/FD — continuous fade cycle
        // "Blink FU100 FD200" → 300ms cycle: 100ms up, 200ms down
        if(eff.blink === -1 && (eff.fu > 0 || eff.fd > 0)) {
            const duration = eff.fu + eff.fd;
            const cycleTime = elapsed % duration;
            if(cycleTime < eff.fu) return cycleTime / eff.fu;
            else return 1 - ((cycleTime - eff.fu) / eff.fd);
        }

        // Case 3: Standard Blink with BPW (v13.11.21: BPW now applied)
        // "Blink 500 BPW20" → 100ms on, 400ms off
        if(eff.blink > 0) {
            const onTime = Math.round(eff.blink * bpw / 100);
            const cyclePos = elapsed % eff.blink;
            if(cyclePos >= onTime) return 0;
        }

        // Case 4: Simple Fade Up (F or FU, no blink)
        // Guard: FU on a moving effect (as>0) is a spatial comet-head gradient, NOT temporal —
        // the per-pixel gradient is applied in drawColorFill/drawShapeScaled/strip loop.
        // Only apply temporal FU here for static (as=0) effects.
        if(eff.fu > 0 && elapsed < eff.fu && !(eff.as > 0)) return elapsed / eff.fu;
        if(eff.fade > 0 && elapsed < eff.fade) return elapsed / eff.fade;

        return 1.0;
    },

    gameLoop(timestamp) {
        const dt = timestamp - this.data.lastFrameTime;
        this.data.lastFrameTime = timestamp;
        this.clearAllVisuals();

        // v13.11.25 FIX: Re-apply AnimSim GIF bitmap pixels on every frame.
        // clearAllVisuals() resets all .pix backgroundColor, wiping any direct DOM paint.
        // Stored bitmapPixels[] are the ground layer — repainted before matrixEffects
        // so that sparkle/color overlays render on top of the bitmap correctly.
        const asBmp = this.data.animSim?.bitmapPixels;
        if (asBmp?.length) {
            asBmp.forEach(({ domIdx, r, g, b }) => {
                const el = document.getElementById(`mx-${domIdx}`);
                if (el) { el.style.backgroundColor = `rgb(${r},${g},${b})`; el.style.opacity = '1'; }
            });
        }

        const now = Date.now();

        // 1. Matrix Effects - sort by layer so higher layers paint on top
        this.data.matrixEffects.sort((a, b) => a.layer - b.layer);
        this.data.matrixEffects.forEach(eff => {
            const opacity = this.calculateOpacity(eff, now);
            if(opacity <= 0) return;

            // v13.9.6: Removed early AFDEN check - now done per-pixel in drawColorFill

            // Apply Analog Direction vector (DOF Bible §2.2)
            // ADL=(-1,0) ADR=(1,0) ADU=(0,-1) ADD=(0,1)
            // Shift X (AL) for horizontal motion, shift Y (AT) for vertical motion.
            // v13.11.18: clamp to 0 so W-delayed effects don't animate backward before start
            const elapsedSec = Math.max(0, (now - eff.startTime) / 1000);
            const adDirX = eff.adDirX || 0;
            const adDirY = eff.adDirY || 0;
            let currentAL = eff.al;
            let currentAT = eff.at;
            if(eff.as !== 0) {
                const speed = eff.as * 0.1; // speed units → % per second
                if(adDirX !== 0) currentAL = ((eff.al + adDirX * speed * elapsedSec) % 100 + 100) % 100;
                if(adDirY !== 0) currentAT = ((eff.at + adDirY * speed * elapsedSec) % 100 + 100) % 100;
                // If no direction set but speed exists, default to scrolling X right
                if(adDirX === 0 && adDirY === 0) currentAL = (eff.al + speed * elapsedSec) % 100;
            }

            if(eff.shapeName) {
                // Shape/sprite effect
                this.drawShapeScaled(eff.shapeName, eff.color, currentAL, currentAT, eff.aw, eff.ah, eff, opacity);
                // Sync Toy Indicator
                const ind = document.getElementById(`toy-${eff.shapeName}`);
                if(ind) { ind.style.backgroundColor = eff.color; ind.style.opacity = opacity; }
            } else {
                // Plain color fill effect (no shape): fill the AT/AL/AH/AW area with solid color.
                // DOF Bible §6.1: Area fills are a fundamental matrix operation.
                // v13.9.6: Pass full effect object for AFDEN support
                this.drawColorFill(eff.color, currentAL, currentAT, eff.aw, eff.ah, opacity, eff);
            }
        });

        // 2. Strip Effects — sort by layer ascending (lower layers first, higher on top)
        // v13.11.41 FIX: Previously had no layer sort — effects painted in insertion order,
        // so the last-inserted segment always won on overlapping pixels regardless of L value.
        // Matrix rendering already sorts this way (line above). Strips must match.
        this.data.stripEffects.forEach((effects, stripIdx) => {
            const stripDef = this.data.cabinet.strips[stripIdx];
            if(!stripDef) return;
            effects.sort((a, b) => (a.layer || 0) - (b.layer || 0));
            effects.forEach(eff => {
                const opacity = this.calculateOpacity(eff, now);
                if(opacity <= 0) return;

                let startPct = eff.at; 
                if(eff.as !== 0) {
                    const elapsedSec = Math.max(0, (now - eff.startTime) / 1000); // v13.11.18: clamp for W wait
                    const shift = (eff.as * 0.1) * elapsedSec; 
                    startPct = (startPct + shift) % 100;
                }
                const totalLeds = stripDef.leds;
                const startIdx = Math.floor((startPct / 100) * totalLeds);
                const len = Math.max(1, Math.floor((eff.ah / 100) * totalLeds));

                // v13.11.43: Spatial gradient for strip comets.
                // Strips scroll forward (startIdx increases), so the leading edge is
                // always at the high end of the bar (offset i = len-1).
                // distFromLeading = len - 1 - i
                // speedLedPerSec = (AS × 0.1 / 100) × totalLeds
                const hasStripGrad = (eff.as > 0 && (eff.fd > 0 || eff.fu > 0));
                const stripSpeedLedPerSec = hasStripGrad
                    ? (eff.as * 0.1 / 100) * totalLeds
                    : 0;

                for(let i = 0; i < len; i++) {
                    const target = startIdx + i;
                    if(eff.afden > 0 && !this.checkSparkle(eff.afden, eff.afmin, eff.afmax, target, now, eff.startTime)) continue;

                    if(target >= 0 && target < totalLeds) {
                        let pixOpacity = opacity;
                        if (hasStripGrad && stripSpeedLedPerSec > 0) {
                            const distPx = len - 1 - i; // 0 = leading, len-1 = trailing
                            const tMs = (distPx / stripSpeedLedPerSec) * 1000;
                            if (eff.fd > 0) pixOpacity *= Math.max(0, 1 - tMs / eff.fd);
                            if (eff.fu > 0) pixOpacity *= Math.min(1, tMs / eff.fu);
                        }
                        if (pixOpacity <= 0.005) continue;

                        const el = document.getElementById(`str-${stripIdx}-${target}`);
                        if(el) {
                            el.style.backgroundColor = eff.color;
                            el.style.opacity = pixOpacity;
                        }
                    }
                }
            });
        });

        // 3. Toy Effects (Flashers/Mechs)
        this.data.toyEffects.forEach((eff, toyId) => {
             const opacity = this.calculateOpacity(eff, now);
             const el = document.getElementById(`toy-${toyId}`);
             if(el) {
                 if(opacity > 0) {
                     el.style.backgroundColor = eff.color;
                     el.style.boxShadow = `0 0 10px ${eff.color}`;
                     el.style.opacity = opacity; // Apply Pulse to Toy Icon
                 } else {
                     el.style.backgroundColor = '#222';
                     el.style.boxShadow = 'none';
                     el.style.opacity = 1;
                 }
             }
        });

        // v13.11.8/9: Highlight active/latched trigger cards and physical toy lamps.
        const allFired = new Set([...this.data.activeTriggers, ...this.data.latchedTriggers]);
        document.querySelectorAll('.trigger-card').forEach(card => {
            const trig = card.dataset.trig;
            if(trig && allFired.has(trig)) card.classList.add('trigger-fired');
            else card.classList.remove('trigger-fired');
        });

        // Physical toy lamps (phys_ prefix) are in toyEffects and rendered
        // by the existing Toy Effects loop above (toy-${toyId} → id=toy-phys_xxx).
        // When no effect fires, reset the lamp to dim amber (enabled) or dark (disabled).
        document.querySelectorAll('.phys-toy-lamp').forEach(lamp => {
            if(!this.data.toyEffects.has(lamp.id.replace('toy-', ''))) {
                const isEnabled = lamp.closest('.phys-toy-item')?.classList.contains('phys-enabled');
                lamp.style.backgroundColor = isEnabled ? '#3a2800' : '#1a1a1a';
                lamp.style.boxShadow = 'none';
                lamp.style.opacity = 1;
            }
        });

        // v13.11.13: RGB toy lamps — dim to near-black when inactive, glow when firing
        document.querySelectorAll('.rgb-toy-lamp').forEach(lamp => {
            if(!this.data.toyEffects.has(lamp.id.replace('toy-', ''))) {
                lamp.style.backgroundColor = '#111';
                lamp.style.border = '1px solid #2a2060';
                lamp.style.boxShadow = 'none';
            } else {
                const color = this.data.toyEffects.get(lamp.id.replace('toy-', ''))?.color || '#ffffff';
                lamp.style.border = `1px solid ${color}`;
                lamp.style.boxShadow = `0 0 6px 2px ${color}88`;
            }
        });

        // v13.11.20: Activity LEDs — only light for toys that are NEW vs. the
        // default state at table load (ON tokens always active don't count).
        const defaultIds     = this.data.defaultActiveToyIds;
        const defaultMxCount = this.data.defaultMatrixCount;
        [
            {
                ledId: 'sal-toys-sec', sectionId: 'toys-sec',
                getColors: () => {
                    const cols = [];
                    // Matrix effects beyond the default baseline count = new activity
                    const activeMx = this.data.matrixEffects.filter(e => this.calculateOpacity(e, now) > 0);
                    if (activeMx.length > defaultMxCount) {
                        activeMx.slice(defaultMxCount).forEach(e => cols.push(e.color));
                    }
                    this.data.toyEffects.forEach((e, id) => {
                        if (!id.startsWith('phys_') && !id.startsWith('rgb_')
                            && !defaultIds.has(id)
                            && this.calculateOpacity(e, now) > 0) cols.push(e.color);
                    });
                    return cols;
                }
            },
            {
                ledId: 'sal-phys-sec', sectionId: 'phys-toys-sec',
                getColors: () => {
                    const cols = [];
                    this.data.toyEffects.forEach((e, id) => {
                        if (id.startsWith('phys_') && !defaultIds.has(id) && this.calculateOpacity(e, now) > 0) cols.push(e.color);
                    });
                    return cols;
                }
            },
            {
                ledId: 'sal-rgb-sec', sectionId: 'rgb-toys-sec',
                getColors: () => {
                    const cols = [];
                    this.data.toyEffects.forEach((e, id) => {
                        if (id.startsWith('rgb_') && !defaultIds.has(id) && this.calculateOpacity(e, now) > 0) cols.push(e.color);
                    });
                    return cols;
                }
            }
        ].forEach(({ ledId, sectionId, getColors }) => {
            const led = document.getElementById(ledId);
            if (!led) return;
            const colors = getColors();
            if (colors.length === 0) {
                led.style.background = 'transparent';
                led.style.boxShadow = 'none';
                led.classList.remove('active');
            } else {
                const unique = [...new Set(colors.map(c => c.toLowerCase()))];
                const dotColor = unique.length === 1 ? unique[0] : '#ffffff';
                const section = document.getElementById(sectionId);
                const isCollapsed = section?.classList.contains('collapsed');
                led.style.background = dotColor;
                led.style.boxShadow = isCollapsed
                    ? `0 0 6px 2px ${dotColor}`
                    : `0 0 3px 1px ${dotColor}`;
                led.classList.add('active');
            }
        });

        // v13.11.30 FIX: Latch re-fire for short-dur effects.
        // When all dur-based matrix effects have expired but at least one trigger is still
        // active (momentary held or latched), re-call parseActiveEffects() to push fresh
        // effects with a new startTime. This makes short-dur effects (e.g., 17ms after
        // clamping) behave as continuous output while the trigger is held, matching real
        // DOF hardware which continuously polls trigger state and re-fires on each tick.
        //
        // Conditions: trigger(s) still active AND there are dur>0 effects AND they have
        // ALL expired AND no infinite (dur=0) effect exists in the current set.
        // The dur=0 guard prevents re-fire when a mix of timed and untimed effects are
        // registered — the untimed ones stay visible naturally without re-firing.
        if(this.data.activeTriggers.size > 0) {
            const _rfNow = Date.now();
            const _durEffs = this.data.matrixEffects.filter(e => e.dur > 0);
            const _hasInfinite = this.data.matrixEffects.some(e => e.dur === 0);
            if(!_hasInfinite && _durEffs.length > 0 &&
               _durEffs.every(e => (_rfNow - e.startTime) >= e.dur)) {
                this.parseActiveEffects();
            }
        }

        // v13.11.46: Code Sim latch re-fire for one-shot / timed effects.
        // When the L button is latched, one-shot effects (FD standalone, FU+FD pulse,
        // dur-based effects) play once then go dark. This block detects when ALL
        // code-sim-owned effects across matrix, strips, and toys have naturally expired
        // and re-fires them so they loop continuously while the latch is active.
        // Effects that are inherently infinite (solid color, moving scroll, continuous
        // blink) are detected via _csEffectEndTime() → Infinity and suppressed — they
        // never need re-firing and will render correctly on their own.
        if (this._codeSimLatched) {
            const _csNow = Date.now();
            // Collect all code-sim-owned effects from every target type
            const _csEffs = [
                ...this.data.matrixEffects.filter(e => e._codeSimOwned),
                ...[...this.data.stripEffects.values()].flat().filter(e => e._codeSimOwned),
                ...[...this.data.toyEffects.values()].filter(e => e._codeSimOwned)
            ];
            if (_csEffs.length > 0) {
                const _csAnyInfinite = _csEffs.some(e => this._csEffectEndTime(e) === Infinity);
                if (!_csAnyInfinite) {
                    const _csAllExpired = _csEffs.every(e => {
                        const life = this._csEffectEndTime(e);
                        return (_csNow - e.startTime) >= life;
                    });
                    if (_csAllExpired) this._codeSimFire();
                }
            }
        }

        requestAnimationFrame(this.gameLoop.bind(this));
    },

    // v13.11.39 FIX: Added effectSeed parameter (default 0 for backward compat).
    // Previously checkSparkle(density,min,max,pixelId,now) had no knowledge of which
    // effect was calling it. For multi-segment strip effects (e.g. Blue/Red/Yellow sparkle
    // layers), all three calls produced identical TRUE/FALSE per pixel — last writer always
    // won, rendering only the final color. effectSeed (typically startTime, unique per
    // segment due to W wait offsets) is XORed into the hash so each effect lights a
    // statistically independent set of pixels, making all colors simultaneously visible.
    checkSparkle(density, min, max, pixelId, now, effectSeed = 0) {
        const densityThreshold = density / 100;
        
        const minCycle = (min > 0) ? min : 50;
        const maxCycle = (max > min) ? max : minCycle + 50;
        
        const pixelSeed = pixelId * 7919;
        const pixelRand = Math.abs(Math.sin(pixelSeed));
        const cycleDuration = minCycle + (pixelRand * (maxCycle - minCycle));
        
        const currentCycle = Math.floor(now / cycleDuration);

        // v13.12.0 FIX: xorshift32 PRNG with ONLY bitwise seed mixing.
        // CRITICAL: JavaScript's `*` operator uses float64. When operands exceed
        // Number.MAX_SAFE_INTEGER (9e15), the low bits — which drive the PRNG —
        // become zero. Date.now() ≈ 1.77e12, so `seed * constant` easily overflows.
        // Solution: use Math.imul for ALL multiplications (returns true low-32-bits),
        // and combine seeds with XOR (pure bitwise, no overflow).
        let seed = Math.imul(pixelId, 73856093)
                 ^ Math.imul(currentCycle | 0, 19349663)
                 ^ Math.imul(effectSeed | 0, 83492791);
        if (seed === 0) seed = 1;
        // xorshift32 — three shifts guarantee full-period output
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const rand = (seed >>> 0) / 0xFFFFFFFF;
        
        return rand < densityThreshold;
    },

    clearAllVisuals() {
        document.querySelectorAll('.pix').forEach(p => { p.style.backgroundColor = ''; p.style.opacity = ''; });
        document.querySelectorAll('.s-led[style*="background-color"]').forEach(p => { p.style.backgroundColor = ''; p.style.opacity = ''; });
    },

    parseActiveEffects() {
        // v13.11.21: Prune expired heldEffects BEFORE clearing matrixEffects.
        // This ensures effects whose minDur has passed are not re-injected below.
        const _now = Date.now();
        this.data.heldEffects = this.data.heldEffects.filter(e => _now < e.heldUntil);

        this.data.matrixEffects = [];
        this.data.stripEffects.forEach(arr => arr.length = 0);
        this.data.toyEffects.clear();
        document.querySelectorAll('.toy-lamp').forEach(t => { t.style.backgroundColor = '#222'; t.style.boxShadow='none'; t.style.opacity = ''; });

        const code = this._getMonitorText();
        const cols = code.split(/,(?![^(]*\))/); 
        
        // v13.11.1 FIX: Sequential column mapping. Config DOF CSV uses output number = col index + 1.
        // The old sortedOutputs[colIdx] sparse approach caused all columns beyond index 5 to map to
        // undefined, silently dropping effects for tables like "diner" (effects at cols 9+).

        cols.forEach((colStr, colIdx) => {
            // v13.11.1: sequential mapping — column index 0 → output 1, index 9 → output 10, etc.
            const outputNum = this._getOutputNum(colIdx, cols.length); // v13.11.3: hybrid
            
            const layers = colStr.split('/');
            layers.forEach(layer => {
                let isActive = false;
                
                if(this.data.inspector.active) {
                    let isRelevant = false;
                    
                    // v13.9.4 PORT: Handle two inspector modes
                    if (this.data.inspector.mode === 'trigger') {
                        // Trigger mode: Show all toys affected by this trigger
                        if(new RegExp('\\b' + this.data.inspector.trigger + '\\b').test(layer)) {
                            isRelevant = true;
                        }
                    } else {
                        // Toy mode: Show all triggers affecting this toy
                        const hwName = this.data.cabinet.toyMap.get(outputNum);
                        const target = this.data.inspector.toyName;
                        
                        if(hwName === target) isRelevant = true;
                        if(!isRelevant) {
                             const macroRegex = new RegExp(`@${target}@|SHP${target}\\b`);
                             if(macroRegex.test(layer)) isRelevant = true;
                        }

                        // Word-boundary match prevents L1 matching 'Layer1' or S5 matching 'AS500'
                        if(isRelevant && this.data.inspector.trigger) {
                            if(!new RegExp('\\b' + this.data.inspector.trigger + '\\b').test(layer)) {
                                isRelevant = false;
                            }
                        }
                    }
                    
                    // Apply layer filter if set
                    if(isRelevant) {
                        if(this.data.inspector.layerFilter !== null) {
                            const lm = layer.match(/\bL(-?\d+)\b/i);
                            const effLayer = lm ? parseInt(lm[1]) : 0;
                            if(effLayer === this.data.inspector.layerFilter) isActive = true;
                        } else {
                            isActive = true;
                        }
                    }
                } else {
                    if(layer.toUpperCase().includes('ON')) isActive = true;
                    // Use word-boundary match to avoid false positives (e.g. 'S5' inside 'AS500')
                    this.data.activeTriggers.forEach(t => { if(new RegExp('\\b' + t + '\\b').test(layer)) isActive = true; });
                }

                if(isActive) this.registerEffect(layer, outputNum);
            });
        });

        // v13.11.8/9: Scan Config1 (LedWiz 1) and Config2 (LedWiz 2) rows.
        // Only fire toy effects for Config1 toys that are enabled in the panel.
        const currentRomKey = (document.getElementById('rom-select')?.value || '').toLowerCase();
        const scanPhysicalConfig = (configData, toyMap, requireEnabled) => {
            if(!configData || !configData[currentRomKey]) return;
            configData[currentRomKey].forEach((colStr, colIdx) => {
                const outNum = colIdx + 1;
                const toyName = toyMap.get(outNum);
                if(!toyName) return;
                // For Config1, respect the user's enabled checkbox
                if(requireEnabled && !this.data.enabledPhysicalToys.has(toyName)) return;
                colStr.split('/').forEach(layer => {
                    const trimmed = layer.trim();
                    if(!trimmed || trimmed === '0') return;
                    let fires = false;
                    if(trimmed.toUpperCase().includes('ON')) fires = true;
                    this.data.activeTriggers.forEach(t => {
                        if(new RegExp('\\b' + t + '\\b').test(trimmed)) fires = true;
                    });
                    if(fires) {
                        const color = this.extractColor(trimmed) || '#ffaa44';
                        const toyId = 'phys_' + toyName.replace(/[^a-zA-Z0-9]/g, '_');
                        this.data.toyEffects.set(toyId, { color, blink: false, fu: 0, fd: 0, startTime: Date.now() });
                    }
                });
            });
        };
        scanPhysicalConfig(this.data.config1, this.data.config1ToyMap, true);
        scanPhysicalConfig(this.data.config2, this.data.config2ToyMap, false);

        // v13.11.15: Scan Config2 RGB toys ─────────────────────────────────────
        // Uses _buildRgbToyMap() for dynamic toy definitions and _resolveRgbToyColor()
        // for hybrid named-color / channel-position blending.
        // v13.11.42 FIX: Skip Config2 RGB toy ON-token scan when AnimSim is active.
        // parseActiveEffects() runs every frame. In AnimSim mode with no entry selected,
        // channels containing 'ON' were always treated as firing (correct for Table View
        // where ON means "always lit while table runs"), producing wrong default colors
        // via channel-position diode blending. In AnimSim, RGB toy state is handled
        // exclusively by _animSimRenderEntry → _animSimRouteKvEffect after the user
        // picks an entry. Skip the scan entirely here so toys stay dark until then.
        if (this.data.config2 && this.data.config2[currentRomKey] && !this.data.animSim?.sessionActive) {
            const cols = this.data.config2[currentRomKey];
            const toyMap = this._buildRgbToyMap();
            toyMap.forEach(toy => {
                // Determine which channels are active given current triggers
                const channelEffects = toy.dataIndices.map(idx => {
                    const eff = (cols[idx] || '').trim();
                    if (!eff || eff === '0') return '';
                    // Check if this effect fires: 'ON ...' always fires.
                    // Trigger refs (S/W/E/L + number) fire when trigger is active.
                    // 'Lxx nobool' fires when lamp Lxx is active — we treat as always
                    // active for display since we don't track individual lamp states.
                    if (/\bON\b/i.test(eff)) return eff;
                    if (/nobool/i.test(eff) && /[SWEL]\d+/i.test(eff)) return eff;
                    // Trigger-based: check active triggers
                    let fires = false;
                    this.data.activeTriggers.forEach(t => {
                        if (new RegExp('\\b' + t + '\\b').test(eff)) fires = true;
                    });
                    return fires ? eff : '';
                });

                const color = this._resolveRgbToyColor(channelEffects);
                if (color) {
                    const toyId = 'rgb_' + toy.displayName.replace(/[^a-zA-Z0-9]/g, '_');
                    this.data.toyEffects.set(toyId, { color, blink: 0, bpw: 50, fu: 0, fd: 0, dur: 0, maxDur: 0, minDur: 0, startTime: Date.now() });
                }
            });
        }

        // v13.11.26: AnimSim direct KV scan removed from here.
        // It ran inside _animSimClear() → parseActiveEffects(), at which point
        // activeEcode had already been set to null — the scan was always dead.
        // RGB toy / LED strip lighting from AnimSim KV data is now handled
        // directly inside _animSimRenderEntry() after activeEcode is set.

        // v13.11.21: Re-inject unexpired heldEffects (minDur effects whose trigger has
        // since gone inactive but M ms has not yet elapsed). Skip if an equivalent
        // active effect already covers the same slot (same color + layer + area + shape).
        // v13.11.22 FIX: Skip entirely when inspector is active — the inspector shows
        // exactly one trigger's effects; stale heldEffects from a prior selection
        // bleed through and make it look like two triggers are on simultaneously.
        if (!this.data.inspector.active) {
            this.data.heldEffects.forEach(heldEff => {
                const dup = this.data.matrixEffects.some(e =>
                    e.color === heldEff.color && e.layer === heldEff.layer &&
                    e.al === heldEff.al && e.at === heldEff.at &&
                    e.shapeName === heldEff.shapeName);
                if (!dup) this.data.matrixEffects.push(heldEff);
            });
        }
    },

        registerEffect(effectStr, outputNum) {
        const color = this.extractColor(effectStr) || '#FFFFFF';
        
        // v13.11.18 FIX: use lookbehind so "AL0" doesn't match as layer 0.
        // extractParam('L') regex L(\d+) was matching inside "AL0", forcing every
        // layer to 0 and breaking the gameLoop sort — last-pushed effect always painted
        // on top regardless of its L value. Now requires L not preceded by any letter.
        const layerM = effectStr.match(/(?<![A-Za-z])L(-?\d+)\b/);
        const layer = layerM ? parseInt(layerM[1]) : 0;
        const al = parseInt(this.extractParam(effectStr, 'AL') || 0); 
        const at = parseInt(this.extractParam(effectStr, 'AT') || 0);
        const ah = parseInt(this.extractParam(effectStr, 'AH') || 100);
        const aw = parseInt(this.extractParam(effectStr, 'AW') || 100);
        const as = parseInt(this.extractParam(effectStr, 'AS') || this.extractParam(effectStr, 'ASS') || 0);
        
        // Extract Analog Direction vector (DOF Bible §2.2)
        // ADL=Left(-1,0) ADR=Right(1,0) ADU=Up(0,-1) ADD=Down(0,1)
        // v13.10.3: Added ASDL/ASDR/ASDU aliases
        let adDirX = 0, adDirY = 0;
        if (/\b(ADL|ASDL)\b/i.test(effectStr)) { adDirX = -1; adDirY =  0; }
        else if(/\b(ADR|ASDR)\b/i.test(effectStr)) { adDirX =  1; adDirY =  0; }
        else if(/\b(ADU|ASDU)\b/i.test(effectStr)) { adDirX =  0; adDirY = -1; }
        else if(/\b(ADD|ASDD)\b/i.test(effectStr)) { adDirX =  0; adDirY =  1; }
        else if(/\bASDU\b/i.test(effectStr)) { adDirX = 0; adDirY = 1; } // ASDU alias
        
        const fade = parseInt(this.extractParam(effectStr, 'F') || 0); 
        
        // --- NEW: BLINK/FADE EXTRACT (Case Insensitive) ---
        const fu = parseInt(this.extractParam(effectStr, 'fu') || 0);
        const fd = parseInt(this.extractParam(effectStr, 'fd') || 0);

        // v13.11.18: W = wait-before-start delay (ms). Lookbehind prevents AW20 matching.
        // Staggered multi-layer effects like comets use W50/W100/W150 to offset start times.
        // startTime is set to Date.now() + wait so calculateOpacity and motion math
        // both naturally return 0/still during the wait period without extra logic.
        const waitM = effectStr.match(/(?<![A-Za-z])W(\d+)\b/);
        const wait = waitM ? parseInt(waitM[1]) : 0;
        
        let blink = 0;
        const blinkMatch = effectStr.match(/Blink\s*(\d+)/i);
        if(blinkMatch) {
            blink = parseInt(blinkMatch[1]);
        } 
        else if(/Blink/i.test(effectStr)) {
            blink = -1; 
        }

        // v13.11.21: BPW — blink pulse width % (default 50 = equal on/off)
        const bpwRaw = this.extractParam(effectStr, 'BPW');
        const bpw = bpwRaw !== null ? Math.max(1, Math.min(99, parseInt(bpwRaw))) : 50;

        // v13.11.21: M{ms} — minimum duration (effect holds for at least M ms after trigger fires)
        const minDurM = effectStr.match(/(?<![A-Za-z])M(\d+)\b/);
        const minDur = minDurM ? parseInt(minDurM[1]) : 0;

        // v13.11.21: Max{ms} — maximum duration (hard cutoff, even if trigger stays active)
        const maxDurM = effectStr.match(/\bMax(\d+)\b/i);
        const maxDur = maxDurM ? parseInt(maxDurM[1]) : 0;

        // v13.11.21: Bare numeric duration and blink count
        // Pure digit tokens (no letter prefix) = duration / blink-count values.
        // "Red 500" → dur=500ms (effect timeout). "W32 Red 2500 5" → dur=2500, blinkCount=5.
        // Algorithm: split on whitespace, take tokens that are purely digits,
        // but exclude the number immediately after "Blink" keyword (that's the blink interval).
        //
        // v13.11.21: Bare numeric duration and blink count
        // Pure digit tokens (no letter prefix) = duration / blink-count values.
        // "Red 500" → dur=500ms (effect timeout). "W32 Red 2500 5" → dur=2500, blinkCount=5.
        // Algorithm: split on whitespace, take tokens that are purely digits,
        // but exclude the number immediately after "Blink" keyword (that's the blink interval).
        //
        // v13.11.30 FIX: Clamp any dur value below one rAF frame (16.67ms at 60fps) up to 17ms.
        // The DOF framework evaluates triggers at ~1ms resolution on real hardware. The simulator
        // runs at 60fps (~16.67ms/frame). A duration like "Blue 10" (10ms) expires before
        // requestAnimationFrame ever fires — the effect is mathematically dead before the first
        // pixel is painted. Clamping to 17ms guarantees at least one visible frame.
        // Combined with the latch re-fire mechanism below, short-dur effects pulse continuously
        // while the trigger is held, matching real DOF hardware behavior.
        // Values of 0 (no timeout) and values >= 17ms pass through unchanged.
        const _tokens = effectStr.split(/\s+/);
        const _blinkTokIdx = _tokens.findIndex(t => /^blink$/i.test(t));
        const _pureNums = _tokens
            .filter((t, i) => /^\d+$/.test(t) && !(_blinkTokIdx >= 0 && i === _blinkTokIdx + 1))
            .map(Number);
        const _rawDur = _pureNums[0] || 0;
        const dur = (_rawDur > 0 && _rawDur < 17) ? 17 : _rawDur;  // v13.11.30: min one rAF frame
        const blinkCount = _pureNums[1] || 0;
        // If two bare numerics with no Blink keyword: derive blink interval from dur/blinkCount
        let effectBlink = blink;
        if(dur > 0 && blinkCount > 0 && blink === 0) {
            effectBlink = Math.max(1, Math.round(dur / blinkCount));
        }

        const afden = parseInt(this.extractParam(effectStr, 'AFDEN') || 0);
        const afmin = parseInt(this.extractParam(effectStr, 'AFMIN') || 0);
        const afmax = parseInt(this.extractParam(effectStr, 'AFMAX') || 0);

        const shapeName = this.extractParam(effectStr, 'SHP');

        // v13.11.10: Detect unexpanded flasher/strobe @tokens@ that substituteVariables
        // intentionally left in place. Route them to toyEffects with the correct human
        // label so they appear as named toy indicators instead of drawing SHPCircle3
        // on the matrix. This is the correct DOF behavior — flashers are physical toys,
        // not matrix shapes.
        // v13.11.18: Added al/at/aw/ah positional defaults from DOF_CABINET_REFERENCE.
        // These are used when a @token@ and SHPxxx coexist in the same layer — the
        // @token@'s area parameters were blocked by SKIP_SUBSTITUTION so the effect
        // string never gets explicit AL/AW/AH/AT tokens, and drawShapeScaled would
        // default to AW=100/AH=100 (full matrix), stretching letters to wrong size.
        const VAR_TOYS = {
            'flasherclo': {label:'Flasher Ch. Outside Left',  color:'#ff8c00', kind:'flasher', al:0,  at:0, aw:14, ah:100},
            'flashercli': {label:'Flasher Ch. Left',          color:'#ff8c00', kind:'flasher', al:20, at:0, aw:14, ah:100},
            'flashercc':  {label:'Flasher Ch. Center',        color:'#ff8c00', kind:'flasher', al:40, at:0, aw:14, ah:100},
            'flashercri': {label:'Flasher Ch. Right',         color:'#ff8c00', kind:'flasher', al:60, at:0, aw:14, ah:100},
            'flashercro': {label:'Flasher Ch. Outside Right', color:'#ff8c00', kind:'flasher', al:80, at:0, aw:14, ah:100},
            'flshemulo':  {label:'Flasher MX Outside Left',   color:'#ffaa00', kind:'flasher', al:0,  at:0, aw:19, ah:100},
            'flshemuli':  {label:'Flasher MX Left',           color:'#ffaa00', kind:'flasher', al:20, at:0, aw:19, ah:100},
            'flshemuc':   {label:'Flasher MX Center',         color:'#ffaa00', kind:'flasher', al:40, at:0, aw:19, ah:100},
            'flshemuri':  {label:'Flasher MX Right',          color:'#ffaa00', kind:'flasher', al:60, at:0, aw:19, ah:100},
            'flshemuro':  {label:'Flasher MX Outside Right',  color:'#ffaa00', kind:'flasher', al:80, at:0, aw:19, ah:100},
            'strblft':    {label:'Strobe MX Left',            color:'#e0e0ff', kind:'strobe',  al:0,  at:0, aw:9,  ah:30},
            'strbrgt':    {label:'Strobe MX Right',           color:'#e0e0ff', kind:'strobe',  al:91, at:0, aw:9,  ah:30},
        };
        // v13.11.18: hoist varToy so the SHP branch below can read positional defaults
        let varToy = null;
        // v13.11.14: Default blink rates applied ONLY when the table code specifies none.
        // Flashers default to 200ms (slower, visible flash).
        // Strobes default to 80ms (rapid strobe effect).
        const DEFAULT_BLINK = { flasher: 200, strobe: 80 };

        const varTokenMatch = effectStr.match(/@(\w+)@/);
        if(varTokenMatch) {
            const key = varTokenMatch[1].toLowerCase();
            varToy = VAR_TOYS[key];  // assign to hoisted let
            if(varToy) {
                const toyId = varToy.label.replace(/\s+/g, '_');
                const effectColor = (color !== '#FFFFFF' && color !== '#ffffff') ? color : varToy.color;
                // v13.11.14: Strobes always default to bright white unless table code
                // specifies a color. Flashers use the table color or their amber default.
                const displayColor = (varToy.kind === 'strobe' && (color === '#FFFFFF' || color === '#ffffff'))
                    ? '#ffffff'
                    : effectColor;
                // Apply default blink only when table code provides no blink/flash timing
                const effectBlink2 = (blink !== 0 || fu !== 0 || fd !== 0)
                    ? blink
                    : DEFAULT_BLINK[varToy.kind] || -1;
                this.data.toyEffects.set(toyId, { color: displayColor, blink: effectBlink2, bpw, fu, fd, dur, maxDur, minDur, startTime: Date.now() + wait });
                // v13.11.11 Issue 1: Do NOT return if a SHP is also in this layer.
                // A layer like "@flasherclo@ SHPPointPlop" must fire the toy indicator
                // AND draw the shape on the matrix. Fall through to SHP branch below.
                if(!shapeName) return;
            }
        }

        if(shapeName) {
            // v13.11.18: When a @varToken@ and SHPxxx coexist, the effect string has no
            // explicit AL/AT/AW/AH (those are inside the blocked @token@). Use the
            // varToy's hardcoded positional defaults unless the effect string provides
            // explicit overrides. This fixes stretched/full-width letter shapes.
            const effAL = (varToy?.al !== undefined && !/\bAL\d/i.test(effectStr)) ? varToy.al : al;
            const effAT = (varToy?.at !== undefined && !/\bAT\d/i.test(effectStr)) ? varToy.at : at;
            const effAW = (varToy?.aw !== undefined && !/\bAW\d/i.test(effectStr)) ? varToy.aw : aw;
            const effAH = (varToy?.ah !== undefined && !/\bAH\d/i.test(effectStr)) ? varToy.ah : ah;
            this.data.matrixEffects.push({ shapeName: shapeName.toLowerCase(), color, al: effAL, at: effAT, aw: effAW, ah: effAH, as, adDirX, adDirY, blink: effectBlink, bpw, fu, fd, dur, maxDur, minDur, blinkCount, afden, afmin, afmax, layer, fade, startTime: Date.now() + wait });
            // v13.11.21: heldEffects — keep minDur effects alive after trigger release
            if(minDur > 0) {
                const heldUntil = Date.now() + wait + minDur;
                this.data.heldEffects.push({ shapeName: shapeName.toLowerCase(), color, al: effAL, at: effAT, aw: effAW, ah: effAH, as, adDirX, adDirY, blink: effectBlink, bpw, fu, fd, dur, maxDur, minDur, blinkCount, afden, afmin, afmax, layer, fade, startTime: Date.now() + wait, heldUntil });
            }
            
            // v13.8 FIX #3: Also light up toy indicator if shape matches a toy name
            // This makes SHPLetterT behave like @LetterT@ for toy indicators
            const toyId = shapeName.replace(/\s+/g, '_');
            const toyElement = document.getElementById(`toy-${toyId}`);
            if(toyElement) {
                // Light up the toy indicator with same color and blink as matrix effect
                this.data.toyEffects.set(toyId, { color, blink: effectBlink, bpw, fu, fd, dur, maxDur, minDur, startTime: Date.now() + wait });
            }
            
            return;
        }

        const tag = this.extractParam(effectStr, '@', '@');
        if(tag) {
            const id = tag.replace(/\s+/g, '_');
            const lowerTag = id.toLowerCase();
            this.data.toyEffects.set(id, { color, blink: effectBlink, bpw, fu, fd, dur, maxDur, minDur, startTime: Date.now() + wait });
            
            if(this.data.shapes.has(lowerTag)) {
                this.data.matrixEffects.push({ shapeName: lowerTag, color, al, at, aw, ah, as, adDirX, adDirY, blink: effectBlink, bpw, fu, fd, dur, maxDur, minDur, blinkCount, afden, afmin, afmax, layer, fade, startTime: Date.now() + wait });
                if(minDur > 0) {
                    const heldUntil = Date.now() + wait + minDur;
                    this.data.heldEffects.push({ shapeName: lowerTag, color, al, at, aw, ah, as, adDirX, adDirY, blink: effectBlink, bpw, fu, fd, dur, maxDur, minDur, blinkCount, afden, afmin, afmax, layer, fade, startTime: Date.now() + wait, heldUntil });
                }
            }
            return;
        }

        const hwName = this.data.cabinet.toyMap.get(outputNum);
        if(hwName && this.data.cabinet.stripNames.has(hwName)) {
            // Named LED strip (1D addressable) → stripEffects
            const stripIdx = this.data.cabinet.strips.findIndex(s => s.name === hwName);
            if(stripIdx >= 0) this.data.stripEffects.get(stripIdx).push({ color, at, ah, as, blink: effectBlink, bpw, fu, fd, dur, maxDur, minDur, afden, afmin, afmax, layer, fade, startTime: Date.now() + wait });
        } else if(hwName === 'Matrix') {
            // Explicitly named Matrix output → color fill on matrix
            const eff = { shapeName: null, color, al, at, aw, ah, as, adDirX, adDirY, blink: effectBlink, bpw, fu, fd, dur, maxDur, minDur, blinkCount, afden, afmin, afmax, layer, fade, startTime: Date.now() + wait };
            this.data.matrixEffects.push(eff);
            if(minDur > 0) this.data.heldEffects.push({ ...eff, heldUntil: Date.now() + wait + minDur });
        } else if(!hwName && (this.extractParam(effectStr, 'AH') !== null || this.extractParam(effectStr, 'AW') !== null)) {
            // Unmapped output with area params (AT/AH/AW) → treat as matrix color fill.
            // DOF tables often route matrix effects through non-standard output columns.
            const eff = { shapeName: null, color, al, at, aw, ah, as, adDirX, adDirY, blink: effectBlink, bpw, fu, fd, dur, maxDur, minDur, blinkCount, afden, afmin, afmax, layer, fade, startTime: Date.now() + wait };
            this.data.matrixEffects.push(eff);
            if(minDur > 0) this.data.heldEffects.push({ ...eff, heldUntil: Date.now() + wait + minDur });
        } else if(hwName) {
            // Named non-strip toy → toy indicator
            const id = hwName.replace(/\s+/g, '_');
            this.data.toyEffects.set(id, { color, blink: effectBlink, bpw, fu, fd, dur, maxDur, minDur, startTime: Date.now() + wait });
        }
        // Note: the old strips[outputNum-1] fallback has been removed.
        // It incorrectly mapped output 5 to strips[4]=Sideboard Right.
    },


    // Draw a plain color fill (no shape/sprite) on the LED matrix canvas.
    // Used for DOF effects that specify AT/AL/AH/AW area params without SHP.
    // v13.11.43: Unified per-pixel loop. Handles three rendering modes:
    //   1. Fast uniform fill   — no gradient, no sparkle (most effects)
    //   2. Sparkle fill        — AFDEN/AFMIN/AFMAX per-pixel probability check
    //   3. Spatial gradient    — FD/FU + AS + AD direction: comet trail or ramp-in
    //      Modes 2+3 can combine (sparkle with comet gradient).
    //
    // FD spatial gradient (AS > 0 + FD):
    //   Leading edge = brightest pixel, trail fades to black behind it.
    //   pixelOpacity = max(0, 1 - distFromLeading_ms / FD)   where
    //   distFromLeading_ms = (distInPixels / speedPxPerSec) × 1000
    //
    // FU spatial gradient (AS > 0 + FU):
    //   Leading edge = darkest pixel, brightness builds toward trailing edge.
    //   pixelOpacity = min(1, distFromLeading_ms / FU)
    //
    // Both can coexist — opacity is the product of both gradients × global opacity.
    drawColorFill(color, al, at, aw, ah, opacity, eff = null) {
        const m = this.data.cabinet.matrix;
        if(!m) return;
        
        const mW = m.w;
        const mH = m.h;

        // v13.11.31 FIX: single-floor combined pct avoids double-rounding gap
        const startX  = Math.floor((al         / 100) * mW);
        const startY  = Math.floor((at         / 100) * mH);
        const endX    = Math.floor(((al + aw)  / 100) * mW);
        const endY    = Math.floor(((at + ah)  / 100) * mH);
        const targetW = Math.max(1, endX - startX);
        const targetH = Math.max(1, endY - startY);

        const hasSparkle  = !!(eff && eff.afden > 0);
        // Spatial gradient only applies when the bar is moving AND FD or FU is set
        const hasGradient = !!(eff && eff.as > 0 && (eff.fd > 0 || eff.fu > 0));

        // ── Fast path: uniform fill with no per-pixel logic ─────────────────────
        if (!hasSparkle && !hasGradient) {
            for(let y = 0; y < targetH; y++) {
                const finalY = startY + y;
                // v13.11.18: wrap-around so scrolling bars re-enter at opposite edge
                const wrappedY = finalY >= mH ? finalY - mH : (finalY < 0 ? finalY + mH : finalY);
                if(wrappedY < 0 || wrappedY >= mH) continue;
                for(let x = 0; x < targetW; x++) {
                    const finalX = startX + x;
                    const wrappedX = finalX >= mW ? finalX - mW : (finalX < 0 ? finalX + mW : finalX);
                    if(wrappedX < 0 || wrappedX >= mW) continue;
                    const p = document.getElementById(`mx-${(wrappedY * mW) + wrappedX}`);
                    if(p) { p.style.backgroundColor = color; p.style.opacity = opacity; }
                }
            }
            return;
        }

        // ── Gradient setup ───────────────────────────────────────────────────────
        // Determine leading-edge direction and speed in pixels/sec.
        // ADR (→): rightmost col is leading  → distFromLeading = targetW - 1 - x
        // ADL (←): leftmost col is leading   → distFromLeading = x
        // ADD (↓): bottom row is leading     → distFromLeading = targetH - 1 - y
        // ADU (↑): top row is leading        → distFromLeading = y
        // No AD but AS>0: default right       → same as ADR
        let speedPxPerSec = 0;
        let adX = 0, adY = 0;
        if (hasGradient) {
            adX = (eff.adDirX || 0);
            adY = (eff.adDirY || 0);
            const speedPctPerSec = eff.as * 0.1; // AS200 → 20%/sec
            if (adX !== 0) {
                speedPxPerSec = (speedPctPerSec / 100) * mW;
            } else if (adY !== 0) {
                speedPxPerSec = (speedPctPerSec / 100) * mH;
            } else {
                // No explicit AD direction — default to right scroll
                adX = 1;
                speedPxPerSec = (speedPctPerSec / 100) * mW;
            }
        }

        // ── Per-pixel loop: gradient and/or sparkle ──────────────────────────────
        const nowPx = (hasSparkle) ? Date.now() : 0;

        for(let y = 0; y < targetH; y++) {
            const finalY = startY + y;
            const wrappedY = finalY >= mH ? finalY - mH : (finalY < 0 ? finalY + mH : finalY);
            if(wrappedY < 0 || wrappedY >= mH) continue;

            for(let x = 0; x < targetW; x++) {

                // Spatial gradient multiplier
                let pixOpacity = opacity;
                if (hasGradient && speedPxPerSec > 0) {
                    // Distance from leading edge in pixels (bar-local coords, pre-wrap)
                    let distPx;
                    if      (adX ===  1) distPx = targetW - 1 - x;  // ADR: right leads
                    else if (adX === -1) distPx = x;                  // ADL: left leads
                    else if (adY ===  1) distPx = targetH - 1 - y;  // ADD: bottom leads
                    else                 distPx = y;                   // ADU: top leads

                    // Convert pixel distance to equivalent time in ms
                    const tMs = (distPx / speedPxPerSec) * 1000;

                    if (eff.fd > 0) pixOpacity *= Math.max(0, 1 - tMs / eff.fd);
                    if (eff.fu > 0) pixOpacity *= Math.min(1, tMs / eff.fu);
                }

                if (pixOpacity <= 0.005) continue; // skip fully transparent pixels

                const finalX = startX + x;
                const wrappedX = finalX >= mW ? finalX - mW : (finalX < 0 ? finalX + mW : finalX);
                if(wrappedX < 0 || wrappedX >= mW) continue;

                const domIdx = (wrappedY * mW) + wrappedX;

                // Sparkle check (AFDEN) — skip non-lit pixels
                if(hasSparkle && !this.checkSparkle(eff.afden, eff.afmin, eff.afmax, domIdx, nowPx, eff.startTime)) continue;

                const p = document.getElementById(`mx-${domIdx}`);
                if(p) { p.style.backgroundColor = color; p.style.opacity = pixOpacity; }
            }
        }
    },

    drawShapeScaled(name, color, al, at, aw, ah, eff, opacity) {
        const s = this.data.shapes.get(name);
        if(!s || !this.data.shapeAtlas || !this.data.cabinet.matrix) return;

        const ctx = this.data.shapeAtlas;
        const helper = document.getElementById('helper-canvas');
        const hCtx = helper.getContext('2d');
        // v13.11.36 FIX: imageSmoothingEnabled is set AFTER the resize block.
        // Assigning canvas.width or .height resets the 2D context to browser defaults,
        // including setting imageSmoothingEnabled back to true. Setting it before the
        // resize block (as done in v13.11.30–v13.11.35) means any call that triggers
        // a canvas resize silently undoes the setting, and drawImage runs with smoothing
        // on. The v13.11.31 double-floor fix changed targetW to vary per letter AL
        // position (21 and 22 alternate), causing almost every letter to trigger a
        // resize and therefore draw with smoothing — producing anti-aliased halo pixels
        // that pass the > 20 RGB threshold and paint as rectangular box artifacts.

        const mW = this.data.cabinet.matrix.w;
        const mH = this.data.cabinet.matrix.h;

        // v13.11.31 FIX: derive dimensions from single floor of combined pct
        const startX  = Math.floor((al         / 100) * mW);
        const startY  = Math.floor((at         / 100) * mH);
        const endX    = Math.floor(((al + aw)  / 100) * mW);
        const endY    = Math.floor(((at + ah)  / 100) * mH);
        const targetW = Math.max(1, endX - startX);
        const targetH = Math.max(1, endY - startY);

        // For animated shapes, advance frame based on elapsed time
        let srcX = s.x, srcY = s.y;
        if (s.animated && s.frameCount > 1 && s.frameDur > 0) {
            const elapsed = Date.now() - eff.startTime;
            const frameNum = Math.floor(elapsed / s.frameDur) % s.frameCount;
            if (s.stepDir === 'Down') { srcY = s.y + frameNum * Math.abs(s.stepSize); }
            else { srcX = s.x + frameNum * Math.abs(s.stepSize); }
        }

        if(helper.width !== targetW || helper.height !== targetH) {
            helper.width = targetW;   // ← resets 2D context state to browser defaults
            helper.height = targetH;
        }
        // Set AFTER resize so context reset cannot undo it. Nearest-neighbour is
        // mandatory: smoothing blends transparent background pixels at sprite edges,
        // giving them non-zero premultiplied RGB that passes the > 20 threshold.
        hCtx.imageSmoothingEnabled = false;
        hCtx.clearRect(0, 0, targetW, targetH);
        hCtx.drawImage(ctx.canvas, srcX, srcY, s.w, s.h, 0, 0, targetW, targetH);

        const frame = hCtx.getImageData(0, 0, targetW, targetH);
        const now = Date.now();

        // v13.11.43: Spatial gradient for shapes in motion — same formula as drawColorFill.
        // Shapes used as comets (SHPLetterX with AS + FD) need per-pixel gradient.
        const hasGradient = !!(eff && eff.as > 0 && (eff.fd > 0 || eff.fu > 0));
        let adX_s = 0, adY_s = 0, speedPx_s = 0;
        if (hasGradient) {
            adX_s = (eff.adDirX || 0);
            adY_s = (eff.adDirY || 0);
            const spdPct = eff.as * 0.1;
            if (adX_s !== 0) { speedPx_s = (spdPct / 100) * mW; }
            else if (adY_s !== 0) { speedPx_s = (spdPct / 100) * mH; }
            else { adX_s = 1; speedPx_s = (spdPct / 100) * mW; } // default right
        }

        for(let y=0; y<targetH; y++) {
            for(let x=0; x<targetW; x++) {
                const idx = (y * targetW + x) * 4;
                if((frame.data[idx] + frame.data[idx+1] + frame.data[idx+2]) > 20) {
                    const finalX = startX + x;
                    const finalY = startY + y;
                    if(finalX >= 0 && finalX < mW && finalY >= 0 && finalY < mH) {
                        const domIdx = (finalY * mW) + finalX;
                        if(eff.afden > 0 && !this.checkSparkle(eff.afden, eff.afmin, eff.afmax, domIdx, now, eff.startTime)) continue;

                        // Spatial gradient multiplier
                        let pixOpacity = opacity;
                        if (hasGradient && speedPx_s > 0) {
                            let distPx;
                            if      (adX_s ===  1) distPx = targetW - 1 - x;
                            else if (adX_s === -1) distPx = x;
                            else if (adY_s ===  1) distPx = targetH - 1 - y;
                            else                   distPx = y;
                            const tMs = (distPx / speedPx_s) * 1000;
                            if (eff.fd > 0) pixOpacity *= Math.max(0, 1 - tMs / eff.fd);
                            if (eff.fu > 0) pixOpacity *= Math.min(1, tMs / eff.fu);
                        }
                        if (pixOpacity <= 0.005) continue;

                        const p = document.getElementById(`mx-${domIdx}`);
                        if(p) {
                            p.style.backgroundColor = color;
                            p.style.opacity = pixOpacity;
                        }
                    }
                }
            }
        }
    },

    extractColor(str) {
        for (let [name, hex] of this.data.colors) {
            if(new RegExp(`\\b${name}\\b`, 'i').test(str)) return hex;
        }
        // v13.11.30: Fallback color table for DOF named colors not defined in the loaded ini.
        // Returns CSS hex values. The old approach returned strings like 'Forest_green' directly
        // to style.backgroundColor — CSS rejects underscore-names, so those colors rendered as
        // transparent. All entries here map to valid hex. Dark_green was missing entirely before.
        // v13.11.32: Added Dark_violet, Blue_violet, Dark_orchid, Orchid, Dark_slate_blue,
        //            Slate_blue, Medium_purple, Lavender, Rebecca_purple, Hot_pink, Deep_pink,
        //            Crimson, Chartreuse, Spring_green, Medium_spring_green, Sky_blue, Steel_blue.
        const DOF_COLORS = [
            ['Red','#FF0000'],       ['Blue','#0000FF'],      ['Green','#008000'],
            ['Yellow','#FFFF00'],    ['White','#FFFFFF'],     ['Cyan','#00FFFF'],
            ['Magenta','#FF00FF'],   ['Purple','#800080'],    ['Orange','#FFA500'],
            ['Lime','#00FF00'],      ['Silver','#C0C0C0'],    ['Gold','#FFD700'],
            ['Pink','#FFC0CB'],      ['Teal','#008080'],
            ['Dodger_blue','#1E90FF'],   ['Medium_orchid','#BA55D3'],
            ['Forest_green','#228B22'],  ['Dark_green','#006400'],
            ['Dark_orange','#FF8C00'],   ['Dark_red','#8B0000'],
            ['Dark_blue','#00008B'],     ['Dark_cyan','#008B8B'],
            ['Dark_magenta','#8B008B'],  ['Dim_gray','#696969'],
            ['Orange_red','#FF4500'],    ['Navy','#000080'],
            ['Maroon','#800000'],        ['Olive','#808000'],
            ['Turquoise','#40E0D0'],     ['Violet','#EE82EE'],
            ['Coral','#FF7F50'],         ['Salmon','#FA8072'],
            ['Khaki','#F0E68C'],         ['Indigo','#4B0082'],
            ['Plum','#DDA0DD'],          ['Light_blue','#ADD8E6'],
            // v13.11.32 additions — purple/violet family + common DOF palette colors
            ['Dark_violet','#9400D3'],   ['Blue_violet','#8A2BE2'],
            ['Dark_orchid','#9932CC'],   ['Orchid','#DA70D6'],
            ['Dark_slate_blue','#483D8B'],['Slate_blue','#6A5ACD'],
            ['Medium_purple','#9370DB'], ['Lavender','#E6E6FA'],
            ['Rebecca_purple','#663399'],['Medium_violet_red','#C71585'],
            ['Hot_pink','#FF69B4'],      ['Deep_pink','#FF1493'],
            ['Crimson','#DC143C'],       ['Chartreuse','#7FFF00'],
            ['Spring_green','#00FF7F'],  ['Medium_spring_green','#00FA9A'],
            ['Sky_blue','#87CEEB'],      ['Steel_blue','#4682B4'],
            ['Cornflower_blue','#6495ED'],['Midnight_blue','#191970'],
            ['Dark_gray','#A9A9A9'],     ['Gray','#808080'],
            ['Light_gray','#D3D3D3'],    ['Wheat','#F5DEB3'],
            ['Tan','#D2B48C'],           ['Sienna','#A0522D'],
            ['Brown','#A52A2A'],         ['Firebrick','#B22222'],
        ];
        for(const [name, hex] of DOF_COLORS) {
            if(new RegExp(`\\b${name}\\b`, 'i').test(str)) return hex;
        }
        const hexMatch = str.match(/#[0-9a-fA-F]{6}/);
        return hexMatch ? hexMatch[0] : null;
    },

    extractParam(str, prefix, suffix='') {
        if(suffix) {
            const re = new RegExp(`${prefix}(\\w+)${suffix}`);
            const m = str.match(re);
            return m ? m[1] : null;
        } else {
            if(prefix === 'SHP') {
                const m = str.match(/SHP([a-zA-Z0-9_]+)/);
                return m ? m[1] : null;
            }
            // FIX: Added 'i' flag for case-insensitive matching of fu/fd/blink
            const m = str.match(new RegExp(`${prefix}(\\d+)`, 'i'));
            return m ? m[1] : null;
        }
    },

    // ── FORMATTED CODE VIEW (v13.11.2: color-coded output mapping) ───────────────
    renderFormattedCode() {
        const raw = this._getMonitorText();
        const container = document.getElementById('code-formatted');
        if (!container) return;
        if (!raw.trim()) {
            container.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;padding:8px;">Load a table to see formatted code.</div>';
            return;
        }
        const cols = raw.split(/,(?![^(]*\))/);
        
        // v13.11.2: Build the color-coded legend first.
        // Shows every output in this CSV: output# → color → hardware name.
        const legendEntries = [];
        const assignedCols = []; // tracks which colIdxs have real hw for legend

        let html = '';
        cols.forEach((colStr, colIdx) => {
            const outputNum = this._getOutputNum(colIdx, cols.length); // v13.11.3: hybrid
            const color = this.getOutputColor(outputNum); // v13.11.2
            const toyName = this.data.cabinet.toyMap.get(outputNum);

            // Always build legend entry for any non-zero column
            const colHasContent = colStr.trim() && colStr.trim() !== '0';
            if (colHasContent && !legendEntries.find(e => e.outputNum === outputNum)) {
                legendEntries.push({ outputNum, toyName, color, hasHW: !!toyName });
            }

            // Only render columns that have real hardware in toyMap
            if (!toyName) return;

            const isMatrix = toyName === 'Matrix';
            const isStrip = this.data.cabinet.stripNames.has(toyName);
            const tagLabel = isMatrix ? '▪' : isStrip ? '│' : '○';

            let displayName;
            if (isMatrix) {
                displayName = 'MATRIX';
            } else if (isStrip) {
                const stripNamesArray = Array.from(this.data.cabinet.stripNames);
                const stripIndex = stripNamesArray.indexOf(toyName) + 1;
                displayName = `STRIP #${stripIndex} — ${toyName}`;
            } else {
                displayName = toyName;
            }

            const layers = colStr.split('/');
            const layerLines = layers.map(layer => {
                const trimmed = layer.trim();
                if (!trimmed || trimmed === '0') return '';
                // Highlight trigger token at start
                const trigMatch = trimmed.match(/^([WSEL]\d+(?:\|[WSEL]\d+)*)/i);
                const trigHtml = trigMatch
                    ? `<span style="color:${color};font-weight:bold;">${trigMatch[1]}</span>${trimmed.slice(trigMatch[1].length)}`
                    : trimmed;
                return `<div class="fmt-layer">${trigHtml}</div>`;
            }).filter(Boolean);

            if (layerLines.length === 0) return;

            // Column block: left border + faint background tint in the output color
            html += `<div class="fmt-col" style="border-left:3px solid ${color};">` +
                `<div class="fmt-col-header" style="border-left:none;background:${color}22;">` +
                `<span style="color:${color};font-size:0.65rem;margin-right:3px;">${tagLabel}</span>` +
                `<span class="fmt-col-name" style="color:${color};">OUT ${outputNum}</span>` +
                `<span style="color:#999;font-size:0.65rem;margin-left:4px;">→ ${displayName}</span>` +
                `</div>${layerLines.join('')}</div>`;
        });

        // Legend block: one row of color swatches with output→hardware mapping
        let legendHtml = '<div class="fmt-legend">';
        legendEntries.forEach(e => {
            const hwLabel = e.toyName || 'UNASSIGNED';
            const style = e.hasHW
                ? `background:${e.color};color:#111;`
                : `background:#444;color:#888;border:1px solid #666;`;
            legendHtml += `<span class="fmt-legend-item" style="${style}" title="Output ${e.outputNum} → ${hwLabel}">` +
                `OUT ${e.outputNum}<br><span style="font-size:0.6rem;">${hwLabel}</span></span>`;
        });
        legendHtml += '</div>';

        container.innerHTML = legendHtml + (html || '<div style="color:var(--text-muted);padding:8px;font-size:0.8rem;">No active effects for hardware in this cabinet.</div>');

        // v13.11.2: Apply matching color borders to strip rack and matrix display
        this._applyHardwareColorHighlights(cols);
    },

    /**
     * v13.11.2: Apply color-coded borders to strip columns and the matrix container
     * so the hardware display visually matches the formatted code view column colors.
     */
    _applyHardwareColorHighlights(cols) {
        // Build outputNum → strip/matrix index map from toyMap
        const stripNamesArray = Array.from(this.data.cabinet.stripNames);

        // Reset all strip borders first
        const stripCols = document.querySelectorAll('#strip-rack .strip-col');
        stripCols.forEach(el => el.style.removeProperty('border-top'));

        // Color each strip column by matching its hardware name to an output color
        this.data.cabinet.strips.forEach((strip, stripIdx) => {
            // Find which output maps to this strip
            let matchedOutputNum = null;
            for(const [outNum, hwName] of this.data.cabinet.toyMap.entries()) {
                if(hwName === strip.name) { matchedOutputNum = outNum; break; }
            }
            if(matchedOutputNum === null) return;

            const color = this.getOutputColor(matchedOutputNum);
            // Find the matching strip-col DOM element
            const el = document.querySelectorAll('#strip-rack .strip-col')[stripIdx];
            if(el) el.style.borderTop = `3px solid ${color}`;
        });

        // Color the matrix container
        const matrixEl = document.getElementById('led-matrix');
        if(matrixEl) {
            let matrixOutputNum = null;
            for(const [outNum, hwName] of this.data.cabinet.toyMap.entries()) {
                if(hwName === 'Matrix') { matrixOutputNum = outNum; break; }
            }
            if(matrixOutputNum) {
                matrixEl.style.outline = `3px solid ${this.getOutputColor(matrixOutputNum)}`;
                matrixEl.style.outlineOffset = '2px';
            }
        }
    },

    // ── v13.11.29: Anim Sim spreadsheet grid in Code Monitor area ────────────────

    // Toggle the Anim Sim grid view on/off from the code toolbar [Anim Sim] button.
    // The grid overlays the same #code-sec space as the monitor and formatted view.
    // All three views are mutually exclusive: showing one hides the other two.
    toggleAnimSimGrid(btn) {
        const monitorWrap  = document.querySelector('.code-monitor-wrap');
        const formatted    = document.getElementById('code-formatted');
        const gridView     = document.getElementById('as-grid-view');
        const formatBtn    = document.getElementById('btn-format-code');
        if (!gridView) return;

        const isGridActive = gridView.style.display !== 'none';

        if (isGridActive) {
            // Close grid → restore raw monitor
            gridView.style.display = 'none';
            if (monitorWrap) monitorWrap.style.display = '';
            btn.innerText = '[ Anim Sim ]';
            btn.classList.remove('code-tool-btn-active');
        } else {
            // Open grid → hide monitor and formatted view
            if (monitorWrap) monitorWrap.style.display = 'none';
            if (formatted)   formatted.style.display   = 'none';
            if (formatBtn)   formatBtn.innerText        = '[ Format ]';
            gridView.style.display = 'flex';
            btn.innerText = '[ Table Code ]';
            btn.classList.add('code-tool-btn-active');
            this._animSimBuildGrid();
        }
    },

    // v13.11.34: Build (or rebuild) the full Anim Sim spreadsheet inside #as-grid-view.
    // Compact mode (default): columns fixed to defined widths, cells truncated.
    // Expanded mode: cells grow to fit contents (toggle via toolbar button).
    // Resize handles: drag to resize column, dbl-click to reset to default width.
    _animSimBuildGrid() {
        const container = document.getElementById('as-grid-view');
        if (!container) return;

        const as = this.data.animSim;
        if (!as?.sessionActive || !as.entries?.length) {
            container.innerHTML = `<div class="as-grid-empty">No Anim Sim data loaded — open the <strong>Animation Simulator</strong> panel and click <strong>✓ Load Effects &amp; Enable Selector</strong>.</div>`;
            return;
        }

        const defs = this._ANIMSIM_COL_DEFS;
        const colWidths  = as._colWidths  || {};
        const isExpanded = as._gridExpanded || false;

        // ── Legend + compact/expanded toggle ────────────────────────────────────
        let legendHtml = '<div class="as-grid-legend">';
        defs.forEach(d => {
            const isDim = ['nameXlsx','type','gifVer','desc','animFlag','notes'].includes(d.key);
            legendHtml += `<span class="as-grid-legend-item${isDim?' as-grid-legend-dim':''}"
                style="background:${d.color}22;border:1px solid ${d.color}55;color:${d.color};"
                title="${d.label}">${d.label}</span>`;
        });
        legendHtml += `<button class="as-grid-view-toggle" title="${isExpanded ? 'Switch to compact view' : 'Switch to expanded view'}"
            onclick="App._animSimToggleGridExpanded()">${isExpanded ? '⊡ Compact' : '⊞ Expand'}</button>`;
        legendHtml += '</div>';

        // ── Colgroup — controls widths in table-layout:fixed ───────────────────
        let colgroupHtml = '<colgroup>';
        defs.forEach(d => {
            const w = colWidths[d.key] ?? d.width;
            colgroupHtml += `<col data-col-key="${d.key}" style="width:${w}px;">`;
        });
        colgroupHtml += '</colgroup>';

        // ── Header row (sticky) with resize handles ──────────────────────────
        let headerHtml = '<thead><tr>';
        defs.forEach(d => {
            const w = colWidths[d.key] ?? d.width;
            const wStyle = isExpanded ? '' : `width:${w}px;min-width:${w}px;max-width:${w}px;`;
            headerHtml += `<th class="as-grid-th" data-col-key="${d.key}"
                style="color:${d.color};border-bottom:2px solid ${d.color};${wStyle}"
                title="${d.label} — drag edge to resize, dbl-click to reset">
                <span class="as-grid-th-label">${d.label}</span>
                <div class="as-grid-resizer" data-col="${d.key}"></div>
            </th>`;
        });
        headerHtml += '</tr></thead>';

        // ── Data rows ────────────────────────────────────────────────────────────
        let bodyHtml = '<tbody>';
        as.entries.forEach(entry => {
            const isActive = entry.ecode === as.activeEcode;
            const rowClass = isActive ? ' class="as-grid-row as-grid-row-active"' : ' class="as-grid-row"';
            bodyHtml += `<tr${rowClass} data-ecode="${entry.ecode}" onclick="App._animSimGridRowClick('${entry.ecode}')">`;

            defs.forEach(d => {
                let cellVal = '';
                if (d.key.startsWith('kv')) {
                    const kvIdx = parseInt(d.key.slice(2), 10);
                    cellVal = entry.colsKV[kvIdx] || '';
                } else if (d.key === 'desc') {
                    cellVal = entry.desc || '';
                } else {
                    cellVal = entry[d.key] || '';
                }
                const safe = String(cellVal).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
                const isEffect = d.key === 'colH' || d.key.startsWith('kv');
                const cellClass = isEffect ? 'as-grid-td as-grid-td-code' : 'as-grid-td';
                const w = colWidths[d.key] ?? d.width;
                const wStyle = isExpanded ? '' : `min-width:${w}px;max-width:${w}px;`;
                // v13.11.42: dblclick copies full cell text via data-copy attr — avoids
                // quote-escaping hazards of embedding raw strings inside onclick attributes
                bodyHtml += `<td class="${cellClass}" style="color:${d.color};${wStyle}"
                    title="${safe}" data-copy="${safe}"
                    ondblclick="event.stopPropagation();App._gridCellCopy(this)">${safe}</td>`;
            });
            bodyHtml += '</tr>';
        });
        bodyHtml += '</tbody>';

        container.innerHTML = legendHtml +
            `<div class="as-grid-scroll"><table class="as-grid-table${isExpanded ? ' as-grid-expanded' : ''}">${colgroupHtml}${headerHtml}${bodyHtml}</table></div>`;

        // Wire up column resize handles
        this._animSimInitColResize(container);
    },

    // v13.11.42: Copy full cell text to clipboard on double-click.
    // Text is stored in data-copy attribute (HTML-entity-encoded) to avoid
    // quote-escaping hazards of embedding raw strings in onclick attributes.
    // Brief green flash confirms the copy succeeded.
    _gridCellCopy(td) {
        // Decode HTML entities back to plain text for clipboard
        const txt = td.dataset.copy || td.textContent.trim();
        const plain = txt.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
        navigator.clipboard.writeText(plain).then(() => {
            const prev = td.style.background;
            td.style.background = 'rgba(0,180,100,0.35)';
            td.style.transition = 'background 0.4s';
            setTimeout(() => { td.style.background = prev; td.style.transition = ''; }, 500);
        }).catch(() => {
            // Clipboard API unavailable — select visible text as fallback
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(td);
            sel.removeAllRanges();
            sel.addRange(range);
            try { document.execCommand('copy'); } catch(e) {}
            sel.removeAllRanges();
        });
    },

    // Toggle compact ↔ expanded view for the grid
    _animSimToggleGridExpanded() {
        const as = this.data.animSim;
        as._gridExpanded = !as._gridExpanded;
        this._animSimBuildGrid();
        this._animSimRefreshGridHighlight();
    },

    // v13.11.34: Column resize for the Anim Sim grid.
    // Updates BOTH <col> and <th> inline widths — necessary because table-layout:fixed
    // caches initial layout and does not reflow on <col> change alone in Chrome.
    _animSimInitColResize(container) {
        const as = this.data.animSim;
        if (!as._colWidths) as._colWidths = {};

        container.querySelectorAll('.as-grid-resizer').forEach(handle => {
            const colKey = handle.dataset.col;
            const col    = container.querySelector(`col[data-col-key="${colKey}"]`);
            const th     = handle.closest('th');
            const def    = this._ANIMSIM_COL_DEFS.find(d => d.key === colKey);
            if (!col || !th || !def) return;

            // Drag to resize
            handle.addEventListener('mousedown', e => {
                e.preventDefault();
                e.stopPropagation();
                const startX = e.clientX;
                const startW = th.offsetWidth || (as._colWidths[colKey] ?? def.width);

                const onMove = mv => {
                    const newW = Math.max(40, startW + mv.clientX - startX);
                    // Update <col> for colgroup tracking
                    col.style.width = newW + 'px';
                    // Update <th> inline styles — required for table-layout:fixed reflow in Chrome
                    th.style.width    = newW + 'px';
                    th.style.minWidth = newW + 'px';
                    th.style.maxWidth = newW + 'px';
                    // Update all <td> cells in this column by index
                    const colIdx = Array.from(col.parentElement.children).indexOf(col);
                    const table  = container.querySelector('.as-grid-table');
                    if (table && colIdx >= 0) {
                        table.querySelectorAll(`tbody tr`).forEach(row => {
                            const td = row.cells[colIdx];
                            if (td) { td.style.minWidth = newW + 'px'; td.style.maxWidth = newW + 'px'; }
                        });
                    }
                    as._colWidths[colKey] = newW;
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup',   onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup',   onUp);
            });

            // Double-click to reset column to default width
            handle.addEventListener('dblclick', e => {
                e.stopPropagation();
                const defW = def.width;
                col.style.width    = defW + 'px';
                th.style.width     = defW + 'px';
                th.style.minWidth  = defW + 'px';
                th.style.maxWidth  = defW + 'px';
                const colIdx = Array.from(col.parentElement.children).indexOf(col);
                const table  = container.querySelector('.as-grid-table');
                if (table && colIdx >= 0) {
                    table.querySelectorAll('tbody tr').forEach(row => {
                        const td = row.cells[colIdx];
                        if (td) { td.style.minWidth = defW + 'px'; td.style.maxWidth = defW + 'px'; }
                    });
                }
                delete as._colWidths[colKey];
            });
        });
    },

    // Called when user clicks a row in the grid.
    // Fires the entry (same as picking from the Anim Sim dropdown) and highlights the row.
    _animSimGridRowClick(ecode) {
        this.animSimSelectEntry(ecode);
        this._animSimRefreshGridHighlight();
    },

    // Update which row in the live grid has the active highlight.
    // v13.11.34: Custom scroll to avoid the sticky thead covering the active row.
    _animSimRefreshGridHighlight() {
        const grid = document.getElementById('as-grid-view');
        if (!grid || grid.style.display === 'none') return;
        const activeEcode = this.data.animSim?.activeEcode;
        const scrollEl = grid.querySelector('.as-grid-scroll');
        let activeRow = null;

        grid.querySelectorAll('.as-grid-row').forEach(row => {
            const isActive = row.dataset.ecode === activeEcode;
            row.classList.toggle('as-grid-row-active', isActive);
            if (isActive) activeRow = row;
        });

        if (activeRow && scrollEl) {
            const theadH = grid.querySelector('thead')?.offsetHeight || 28;
            const rowTop = activeRow.offsetTop;
            const rowBot = rowTop + activeRow.offsetHeight;
            const visTop = scrollEl.scrollTop + theadH;  // below sticky header
            const visBot = scrollEl.scrollTop + scrollEl.clientHeight;

            if (rowTop < visTop) {
                // Row hidden above sticky header — dock against bottom of header
                scrollEl.scrollTop = rowTop - theadH;
            } else if (rowBot > visBot) {
                // Row below visible area — scroll into view
                scrollEl.scrollTop = rowBot - scrollEl.clientHeight;
            }
        }
    },

    toggleCodeView(btn) {
        const monitorWrap = document.querySelector('.code-monitor-wrap');
        const formatted = document.getElementById('code-formatted');
        const gridView  = document.getElementById('as-grid-view');
        const gridBtn   = document.getElementById('btn-animsim-grid');
        if (!monitorWrap || !formatted) return;

        // If grid is open, close it first
        if (gridView && gridView.style.display !== 'none') {
            gridView.style.display = 'none';
            if (gridBtn) { gridBtn.innerText = '[ Anim Sim ]'; gridBtn.classList.remove('code-tool-btn-active'); }
        }

        const isFormatted = formatted.style.display !== 'none';
        if (isFormatted) {
            monitorWrap.style.display = '';
            formatted.style.display = 'none';
            btn.innerText = '[ Format ]';
        } else {
            this.renderFormattedCode();
            monitorWrap.style.display = 'none';
            formatted.style.display = '';
            btn.innerText = '[ Edit ]';
        }
    },

    // ── v13.11.22: CONFIRM SESSION GATE ──────────────────────────────────────────
    // Hard-validates Config30.ini is loaded before revealing the SELECT TABLE
    // section. Config30 is the authoritative ROM table — without it the simulator
    // has nothing to drive. All other files are optional (cabinet, shapes, configs).
    confirmSession() {
        const errEl = document.getElementById('confirm-error');
        const hasConfig30 = this.data.config30 && Object.keys(this.data.config30).length > 0;
        if (!hasConfig30) {
            if (errEl) { errEl.style.display = 'block'; }
            return;
        }
        if (errEl) { errEl.style.display = 'none'; }
        const sec = document.getElementById('select-table-section');
        if (sec) {
            sec.style.display = 'flex';   // left-panel-body is display:flex in CSS
            sec.dataset.confirmed = 'true';
        }
        // v13.11.23: show the dual mode toggle once session is confirmed
        const toggle = document.getElementById('left-mode-toggle');
        if (toggle) toggle.style.display = 'flex';

        // v13.11.35: Auto-collapse the config panel so the table/anim section
        // fills the full column height. enableConfigCollapse first so the header
        // is clickable and the toggle indicator is visible.
        this.enableConfigCollapse();
        const content = document.getElementById('config-panel-content');
        if (content && content.dataset.collapsed !== 'true') {
            this.toggleConfigPanel();
        }
    },

    // ── v13.11.22: ANIMATION SIMULATOR ───────────────────────────────────────────
    //
    // animSimConfirm() — validate + parse all three uploaded files, then unlock
    // the controls and populate the entry dropdown.
    //
    // Entry object shape:
    // {
    //   ecode:    'E2004',
    //   type:     'Table',          // 'Table' | 'Playlist'
    //   displayName: 'Deadpool (Stern 2018)',
    //   nameXlsx: 'Deadpool',       // raw XLSX col A
    //   animFlag: 'Single Frame',   // 'Animated' | 'Single Frame'
    //   gifVer:   'pinupmenu3.6_Single_Frames.gif',
    //   colH:     '...',            // raw col H string (Custom MX 1 — bitmap + sparkle)
    //   abf: 399, abw: 232, abh: 32, aac: 1,
    //   outOfRange: false,          // ABF > total GIF frames
    //   dimMismatch: false,         // ABW/ABH exceeds GIF canvas (data error)
    //   colsKV: ['...', '...'],     // 12 strings, cols K-V
    // }

    async animSimConfirm() {
        // v13.11.22: file inputs live in the main config panel (as-f-effects, as-f-gif, as-f-db)
        // The confirm button and error div can be in either the inline section or the cref modal.
        // We normalise by always targeting the inline section's IDs (which are always in DOM).
        const errEl  = document.getElementById('as-confirm-error-inline')
                    || document.getElementById('as-confirm-error');
        const effFile = document.getElementById('as-f-effects')?.files[0];
        const gifFile = document.getElementById('as-f-gif')?.files[0];
        const dbFile  = document.getElementById('as-f-db')?.files[0];

        const showErr = (msg) => {
            if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
        };
        const clearErr = () => { if (errEl) errEl.style.display = 'none'; };
        clearErr();

        if (!effFile) { showErr('Effects file (.xlsx or .csv) is required.'); return; }

        // ── 1. Parse effects file ──────────────────────────────────────────────
        let entries = [];
        let baseProgramming = [];
        try {
            ({ entries, baseProgramming } = await this._animSimParseEffectsFile(effFile));
        } catch(e) {
            showErr('Could not parse effects file: ' + e.message);
            return;
        }
        if (!entries.length) { showErr('No valid entries found in effects file.'); return; }

        // ── 2. Parse GIF (optional but recommended) ────────────────────────────
        let gifFrames = [], gifWidth = 232, gifHeight = 32, gifFilename = null;
        if (gifFile) {
            try {
                ({ gifFrames, gifWidth, gifHeight } = await this._animSimParseGif(gifFile));
                gifFilename = gifFile.name;
                // Warn if filename matches none of the referenced GIF versions
                const referencedNorms = [...new Set(entries.map(e => this._normaliseGifName(e.gifVer)))];
                const uploadedNorm = this._normaliseGifName(gifFile.name);
                if (!referencedNorms.includes(uploadedNorm)) {
                    console.warn('[AnimSim] GIF filename "' + gifFile.name + '" does not match any referenced GIF version in the effects file. Proceeding anyway.');
                }
            } catch(e) {
                showErr('Could not parse GIF file: ' + e.message);
                return;
            }
        }

        // ── 3. Parse PUPDatabase (optional) ───────────────────────────────────
        const pupMap = new Map();
        if (dbFile) {
            try {
                await this._animSimParsePupDb(dbFile, pupMap);
            } catch(e) {
                console.warn('[AnimSim] PUPDatabase parse failed:', e);
                // Non-fatal — continue without PUP names
            }
        }

        // ── 4. Enrich entries with PUP display names + flag dim mismatches ─────
        entries.forEach(entry => {
            const pup = pupMap.get(entry.ecode.toLowerCase());
            entry.pupNames = pup || [];
            entry.displayName = entry.pupNames.length > 0 ? entry.pupNames[0] : entry.nameXlsx;
            // Flag data quality issues
            entry.outOfRange = (gifFrames.length > 0) && (entry.abf >= gifFrames.length);
            entry.dimMismatch = (entry.abw > gifWidth) || (entry.abh > gifHeight);
        });

        // ── 5. Store state ─────────────────────────────────────────────────────
        const as = this.data.animSim;
        as.entries = entries;
        as.baseProgramming = baseProgramming;
        as.gifFrames = gifFrames;
        as.gifWidth = gifWidth;
        as.gifHeight = gifHeight;
        as.gifFilename = gifFilename;
        as.pupMap = pupMap;
        as.sessionActive = true;
        as.typeFilter = 'both';
        as.sortMode = 'ecode';
        as.searchStr = '';
        as.activeEcode = null;

        // ── 6. Unlock controls + populate dropdown ───────────────────────────────
        // Target inline section controls (always in DOM when Anim Sim panel open)
        const ctrlsInline = document.getElementById('as-controls-inline');
        if (ctrlsInline) {
            ctrlsInline.classList.remove('as-controls-disabled');
            ctrlsInline.classList.add('enabled');
        }

        this.animSimPopulateDropdown();

        // v13.11.24 FIX T10-A: Build the RGB toy panel from config data now.
        // _renderRgbToyPanel was previously only called from loadTable(), so in AnimSim
        // mode without a table selected the panel container was never populated.
        // Calling it here ensures the DOM toy elements exist before parseActiveEffects runs.
        this._renderRgbToyPanel(null);

        // v13.11.27: Load persistent kvMap from localStorage, then build the mapping panel
        this._animSimLoadKvMap();
        this._animSimBuildMappingPanel();

        // v13.11.29: Rebuild the spreadsheet grid if it is currently open
        if (document.getElementById('as-grid-view')?.style.display !== 'none') {
            this._animSimBuildGrid();
        }

        // v13.11.34: Auto-hide the load bar and show the compact re-open strip
        const loadBar  = document.getElementById('as-inline-confirm-bar');
        const reopenBar = document.getElementById('as-reopen-bar');
        if (loadBar)   loadBar.style.display  = 'none';
        if (reopenBar) {
            const effName = effFile.name.length > 28 ? effFile.name.slice(0, 26) + '…' : effFile.name;
            reopenBar.querySelector('.as-reopen-label').textContent = `✓ ${effName}`;
            reopenBar.style.display = 'flex';
        }

        clearErr();
        console.log(`%c[AnimSim] Loaded ${entries.length} entries, ${gifFrames.length} GIF frames, ${pupMap.size} PUP matches`, 'color:#00e5ff;font-weight:bold;');
    },

    // v13.11.34: Toggle the load effects bar back open (called from re-open strip)
    animSimToggleLoadBar() {
        const loadBar   = document.getElementById('as-inline-confirm-bar');
        const reopenBar = document.getElementById('as-reopen-bar');
        if (!loadBar || !reopenBar) return;
        const isHidden = loadBar.style.display === 'none';
        loadBar.style.display   = isHidden ? '' : 'none';
        reopenBar.style.display = isHidden ? 'none' : 'flex';
    },

    // Normalise a GIF version string for comparison:
    //   "pinupmenu3.7_Single_Frames.gif"  →  "pinupmenu37_single_frames.gif"
    _normaliseGifName(name) {
        if (!name) return '';
        return name.toLowerCase().replace(/\./g, (m, i, s) => {
            // Keep the final ".gif" extension dot; remove version dots elsewhere
            return (i === s.lastIndexOf('.')) ? '.' : '';
        });
    },

    // Parse effects XLSX or CSV → { entries[], baseProgramming[] }
    // RFC 4180 CSV parser — handles quoted fields with embedded commas and newlines.
    // Returns array of arrays (same shape as XLSX.utils.sheet_to_json with header:1).
    // v13.11.24: Replaces naive split('\n').map(split(',')) which broke on multi-line cells.
    _parseCSV(text) {
        const rows = [];
        let row = [], field = '', inQuote = false;
        // Normalise line endings
        const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (inQuote) {
                if (ch === '"') {
                    if (s[i + 1] === '"') { field += '"'; i++; } // escaped quote
                    else inQuote = false;                          // closing quote
                } else {
                    field += ch; // includes embedded newlines
                }
            } else {
                if      (ch === '"')  { inQuote = true; }
                else if (ch === ',')  { row.push(field.trim()); field = ''; }
                else if (ch === '\n') {
                    row.push(field.trim());
                    if (row.some(c => c !== '')) rows.push(row); // skip blank lines
                    row = []; field = '';
                } else {
                    field += ch;
                }
            }
        }
        // Final field/row after EOF
        if (field.trim() || row.length) {
            row.push(field.trim());
            if (row.some(c => c !== '')) rows.push(row);
        }
        return rows;
    },

    async _animSimParseEffectsFile(file) {
        const ext = file.name.toLowerCase().split('.').pop();
        let rows; // array of arrays

        if (ext === 'xlsx' || ext === 'xls') {
            if (typeof XLSX === 'undefined') throw new Error('SheetJS (XLSX) library not loaded.');
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        } else if (ext === 'csv') {
            const text = await file.text();
            // v13.11.24 FIX: Proper RFC 4180 CSV parser.
            // The naive split('\n').map(split(',')) breaks on cells that contain
            // embedded newlines (e.g. "Harry Potter\n" in column A for E2048 etc.)
            // — 16 entries had blank names because the name was on the line before
            // the E-code. This parser handles quoted fields and embedded newlines.
            rows = this._parseCSV(text);
        } else {
            throw new Error('Unsupported file type. Please upload .xlsx or .csv.');
        }

        if (rows.length < 3) throw new Error('Effects file has too few rows (need header + base + at least one data row).');

        // Validate expected column structure (col C = ecode, col H = colH, col I = first KV)
        // Column letters: A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8 … T=19
        // v13.11.23 FIX: was reading animFlag from row[6] (Notes/G) → should be row[5] (F)
        //                was reading colH from row[9] (PF Right/J) → should be row[7] (H)
        //                was reading colsKV from row[10-21]         → should be row[8-19]
        const entries = [];
        let baseProgramming = [];

        rows.forEach((row, rowIdx) => {
            if (rowIdx === 0) return; // Header row — skip

            const ecode    = String(row[2] || '').trim();
            // v13.11.23 FIX: strip embedded \n from Name cells (affects E2048, E2054, etc.)
            const nameXlsx = String(row[0] || '').replace(/[\r\n]/g, '').trim();
            const type     = String(row[1] || '').trim();
            const gifVer   = String(row[3] || '').trim();
            const desc     = String(row[4] || '').trim();  // v13.11.29: col E "Description of Effect"
            // v13.11.23 FIX: col F (index 5) = "Animated or Single Frame", not col G (Notes)
            const animFlag = String(row[5] || '').trim();
            const notes    = String(row[6] || '').trim();
            // v13.11.23 FIX: col H (index 7) = "Custom MX 1" = primary bitmap+sparkle effect
            const colH     = String(row[7] || '').trim();
            // v13.11.23 FIX: cols I–T (indices 8–19) = per-toy KV effects (12 columns)
            const colsKV   = [];
            for (let c = 8; c <= 19; c++) colsKV.push(String(row[c] || '').trim());

            if (rowIdx === 1) {
                // Base programming row — extract ON-keyword effects from I-T columns
                baseProgramming = colsKV.map(kv => /\bON\b/i.test(kv) ? kv : '');
                return;
            }

            // Data rows — must have a valid E code
            if (!/^E\d+$/i.test(ecode)) return;

            // Parse ABF/ABW/ABH/AAC from col H (Custom MX 1)
            const abfM = colH.match(/ABF(\d+)/i);
            const abwM = colH.match(/ABW(\d+)/i);
            const abhM = colH.match(/ABH(\d+)/i);
            const aacM = colH.match(/AAC(\d+)/i);
            const abf = abfM ? parseInt(abfM[1]) : 0;
            const abw = abwM ? parseInt(abwM[1]) : 232;
            const abh = abhM ? parseInt(abhM[1]) : 32;
            const aac = aacM ? parseInt(aacM[1]) : 1;

            entries.push({
                ecode: ecode.toUpperCase(),
                type, nameXlsx, gifVer, desc, animFlag, notes, colH, colsKV,
                abf, abw, abh, aac,
                displayName: nameXlsx, // enriched later with PUP names
                pupNames: [],
                outOfRange: false,
                dimMismatch: false,
            });
        });

        return { entries, baseProgramming };
    },

    // Decode all frames from a GIF file — self-contained decoder, no external CDN.
    // Returns { gifFrames: ImageData[], gifWidth: number, gifHeight: number }
    async _animSimParseGif(file) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);

        // ── Minimal GIF89a parser ───────────────────────────────────────────────
        // Reads LSD, global color table, and all image frames with LZW decompression.
        const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
        if (sig !== 'GIF') throw new Error('Not a valid GIF file (bad signature).');

        const gifWidth  = bytes[6] | (bytes[7] << 8);
        const gifHeight = bytes[8] | (bytes[9] << 8);
        const gctFlag   = (bytes[10] >> 7) & 1;
        const gctSize   = 3 * (1 << ((bytes[10] & 0x07) + 1));
        let gct = null;
        let pos = 13;
        if (gctFlag) { gct = bytes.slice(13, 13 + gctSize); pos = 13 + gctSize; }

        // LZW decoder
        const lzwDecode = (minCodeSize, data) => {
            const clearCode = 1 << minCodeSize;
            const eoi = clearCode + 1;
            let tableSize, codeSize, prevCode;
            const table = [];
            const reset = () => {
                table.length = 0;
                for (let i = 0; i < clearCode; i++) table[i] = [i];
                table[clearCode] = [];
                table[eoi] = [];
                tableSize = eoi + 1;
                codeSize = minCodeSize + 1;
                prevCode = -1;
            };
            reset();
            const out = [];
            let bitBuf = 0, bitCount = 0, dataPos = 0;
            const readCode = () => {
                while (bitCount < codeSize) {
                    if (dataPos >= data.length) return -1;
                    // v13.11.23 FIX: >>> 0 forces unsigned 32-bit — prevents sign overflow
                    // when bytes accumulate into bits 24+, which made all indices wrong.
                    bitBuf = (bitBuf | (data[dataPos++] << bitCount)) >>> 0;
                    bitCount += 8;
                }
                const code = bitBuf & ((1 << codeSize) - 1);
                bitBuf = (bitBuf >>> codeSize) >>> 0;
                bitCount -= codeSize;
                return code;
            };
            for (;;) {
                const code = readCode();
                if (code < 0 || code === eoi) break;
                if (code === clearCode) { reset(); continue; }
                let entry;
                if (code < tableSize) {
                    entry = table[code];
                } else if (code === tableSize && prevCode >= 0) {
                    entry = [...table[prevCode], table[prevCode][0]];
                } else { break; }
                out.push(...entry);
                if (prevCode >= 0 && tableSize < 4096) {
                    table[tableSize++] = [...table[prevCode], entry[0]];
                    if (tableSize === (1 << codeSize) && codeSize < 12) codeSize++;
                }
                prevCode = code;
            }
            return out;
        };

        // ── Walk extension/image blocks ─────────────────────────────────────────
        const canvas = document.getElementById('as-gif-canvas');
        canvas.width  = gifWidth;
        canvas.height = gifHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, gifWidth, gifHeight);

        const gifFrames = [];
        let gce = null; // graphic control extension

        while (pos < bytes.length) {
            const block = bytes[pos++];

            if (block === 0x3B) break; // Trailer

            if (block === 0x21) { // Extension
                const label = bytes[pos++];
                if (label === 0xF9) { // Graphic Control Extension
                    pos++; // block size (always 4)
                    const flags      = bytes[pos++];
                    const delay      = bytes[pos++] | (bytes[pos++] << 8);
                    const transpIdx  = bytes[pos++];
                    pos++; // block terminator
                    gce = { disposalMethod: (flags >> 2) & 0x07, transparent: (flags & 1) ? transpIdx : -1, delay };
                } else {
                    // Skip all sub-blocks
                    while (pos < bytes.length) {
                        const sz = bytes[pos++]; if (!sz) break;
                        pos += sz;
                    }
                }
                continue;
            }

            if (block === 0x2C) { // Image Descriptor
                const imgLeft   = bytes[pos++] | (bytes[pos++] << 8);
                const imgTop    = bytes[pos++] | (bytes[pos++] << 8);
                const imgWidth  = bytes[pos++] | (bytes[pos++] << 8);
                const imgHeight = bytes[pos++] | (bytes[pos++] << 8);
                const imgFlags  = bytes[pos++];
                const lctFlag   = (imgFlags >> 7) & 1;
                const interlace = (imgFlags >> 6) & 1;
                let ct = gct; // default: global color table
                if (lctFlag) {
                    const lctSize = 3 * (1 << ((imgFlags & 0x07) + 1));
                    ct = bytes.slice(pos, pos + lctSize);
                    pos += lctSize;
                }
                const minCode = bytes[pos++];
                // Collect sub-blocks into flat data array
                const lzwData = [];
                while (pos < bytes.length) {
                    const sz = bytes[pos++]; if (!sz) break;
                    for (let i = 0; i < sz; i++) lzwData.push(bytes[pos++]);
                }
                const pixels = lzwDecode(minCode, lzwData);

                // Handle disposal
                const disposal = gce ? gce.disposalMethod : 0;
                if (disposal === 2) ctx.clearRect(imgLeft, imgTop, imgWidth, imgHeight);

                // Paint pixels
                const imgData = ctx.createImageData(imgWidth, imgHeight);
                const transpIdx = gce ? gce.transparent : -1;

                // Interlace pass ordering
                const rows = [];
                if (interlace) {
                    for (let r = 0; r < imgHeight; r += 8) rows.push(r);
                    for (let r = 4; r < imgHeight; r += 8) rows.push(r);
                    for (let r = 2; r < imgHeight; r += 4) rows.push(r);
                    for (let r = 1; r < imgHeight; r += 2) rows.push(r);
                } else {
                    for (let r = 0; r < imgHeight; r++) rows.push(r);
                }

                rows.forEach((row, pRow) => {
                    for (let col = 0; col < imgWidth; col++) {
                        const pixIdx = pRow * imgWidth + col;
                        const ctIdx  = pixels[pixIdx];
                        if (ctIdx === undefined || ctIdx === transpIdx) continue;
                        const base = ctIdx * 3;
                        const iBase = (row * imgWidth + col) * 4;
                        if (ct) { imgData.data[iBase] = ct[base]; imgData.data[iBase+1] = ct[base+1]; imgData.data[iBase+2] = ct[base+2]; }
                        imgData.data[iBase+3] = 255;
                    }
                });

                ctx.putImageData(imgData, imgLeft, imgTop);
                gifFrames.push(ctx.getImageData(0, 0, gifWidth, gifHeight));
                gce = null;
                continue;
            }
            // Unknown block — skip
            const sz = bytes[pos]; if (sz) pos += sz + 1; else pos++;
        }

        if (!gifFrames.length) throw new Error('GIF decoded but contained no image frames.');
        return { gifFrames, gifWidth, gifHeight };
    },

    // Parse PUPDatabase.db via sql.js → populate pupMap: ecode.lower → GameDisplay[]
    async _animSimParsePupDb(file, pupMap) {
        if (typeof initSqlJs === 'undefined') {
            throw new Error('sql.js library not loaded.');
        }
        const SQL = await initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}` });
        const buf = await file.arrayBuffer();
        const db = new SQL.Database(new Uint8Array(buf));

        try {
            const res = db.exec("SELECT GameDisplay, DOFStuff FROM Games WHERE DOFStuff IS NOT NULL AND DOFStuff != ''");
            if (res.length && res[0].values) {
                res[0].values.forEach(([displayName, dofStuff]) => {
                    if (!displayName || !dofStuff) return;
                    // DOFStuff may contain the E code directly (e.g. "E2004")
                    const eMatch = String(dofStuff).match(/E\d+/i);
                    if (!eMatch) return;
                    const key = eMatch[0].toLowerCase();
                    if (!pupMap.has(key)) pupMap.set(key, []);
                    pupMap.get(key).push(String(displayName));
                });
            }
        } finally {
            db.close();
        }
    },

    // v13.11.33: Replaced dropdown with a scrollable inline list that fills the
    // available left-panel height. Filter/sort/search controls still govern what rows appear.
    // Multi-row E-codes (same E code, multiple effects) are grouped into a single row entry;
    // a sub-selector appears beneath the list when selected.
    animSimPopulateDropdown() {
        const as = this.data.animSim;
        const list = document.getElementById('as-entry-list-inline');
        if (!list) return;

        const search = (as.searchStr || '').toLowerCase();

        // Group entries by ecode — multi-row entries get multiple abf variants
        const grouped = new Map(); // ecode → [entry, ...]
        as.entries.forEach(e => {
            if (!grouped.has(e.ecode)) grouped.set(e.ecode, []);
            grouped.get(e.ecode).push(e);
        });

        // Apply filter/search on the first entry in each group (representative)
        const visible = [];
        grouped.forEach((group, ecode) => {
            const rep = group[0];
            if (as.typeFilter === 'table'    && rep.type.toLowerCase() !== 'table')    return;
            if (as.typeFilter === 'playlist' && rep.type.toLowerCase() !== 'playlist') return;
            if (search && !rep.displayName.toLowerCase().includes(search) && !ecode.toLowerCase().includes(search)) return;
            visible.push({ ecode, group });
        });

        visible.sort((a, b) => {
            if (as.sortMode === 'ecode') {
                return parseInt(a.ecode.slice(1)) - parseInt(b.ecode.slice(1));
            }
            return a.group[0].displayName.localeCompare(b.group[0].displayName, undefined, { sensitivity: 'base' });
        });

        // Store the grouped map for sub-selector use
        as._grouped = grouped;

        // Build list rows
        if (!visible.length) {
            list.innerHTML = `<div class="as-entry-list-empty">${as.entries.length ? 'No matches' : '— Load effects file first —'}</div>`;
        } else {
            const frag = document.createDocumentFragment();
            const expanded = as._expandedEcodes || (as._expandedEcodes = new Set());

            visible.forEach(({ ecode, group }) => {
                const rep = group[0];
                const isActive   = ecode === as.activeEcode;
                const isWarn     = rep.dimMismatch || rep.outOfRange;
                const isMulti    = group.length > 1;
                const hasAnim    = group.some(e => e.animFlag === 'Animated');
                const isExpanded = isMulti && expanded.has(ecode);

                // ── Main row ──────────────────────────────────────────────────
                const row = document.createElement('div');
                row.className = 'as-entry-list-item' + (isActive ? ' as-entry-list-active' : '');
                row.dataset.ecode = ecode;
                row.title = rep.displayName + (rep.dimMismatch ? ' [dim mismatch]' : '') + (rep.outOfRange ? ' [out of range]' : '');

                // E-code badge
                const ecodeEl = document.createElement('span');
                ecodeEl.className = 'as-entry-list-ecode' + (isWarn ? ' as-entry-list-ecode-warn' : '');
                ecodeEl.textContent = ecode;

                // Name
                const nameEl = document.createElement('span');
                nameEl.className = 'as-entry-list-name';
                nameEl.textContent = rep.displayName;

                // Badges (right-aligned)
                const badgesEl = document.createElement('span');
                badgesEl.className = 'as-entry-list-badges';

                // Type badge — informational only
                const typeLabel = rep.type.toLowerCase() === 'playlist' ? 'PL' : 'T';
                const typeBadge = document.createElement('span');
                typeBadge.className = 'as-entry-list-badge as-entry-list-badge-type';
                typeBadge.textContent = typeLabel;
                badgesEl.appendChild(typeBadge);

                // ANIM badge — passive indicator only. Variants are activated via ×N expansion.
                if (hasAnim) {
                    const animBadge = document.createElement('span');
                    animBadge.className = 'as-entry-list-badge as-entry-list-badge-anim';
                    animBadge.textContent = 'ANIM';
                    animBadge.title = isMulti
                        ? 'Animated variant available — click ×' + group.length + ' to select'
                        : 'Animated (multi-frame GIF)';
                    badgesEl.appendChild(animBadge);
                }

                // ×N badge — click toggles inline expansion of variant sub-buttons
                if (isMulti) {
                    const multiBadge = document.createElement('span');
                    multiBadge.className = 'as-entry-list-badge as-entry-list-badge-multi' + (isExpanded ? ' active' : '');
                    multiBadge.textContent = `×${group.length}`;
                    multiBadge.title = isExpanded ? 'Click to collapse variants' : 'Click to show all variants';
                    multiBadge.style.cursor = 'pointer';
                    multiBadge.addEventListener('click', e => {
                        e.stopPropagation();
                        if (expanded.has(ecode)) expanded.delete(ecode);
                        else expanded.add(ecode);
                        this.animSimPopulateDropdown();
                    });
                    badgesEl.appendChild(multiBadge);
                }

                // Warning badge
                if (isWarn) {
                    const warnBadge = document.createElement('span');
                    warnBadge.className = 'as-entry-list-badge as-entry-list-badge-warn';
                    warnBadge.textContent = rep.dimMismatch ? '†' : '*';
                    badgesEl.appendChild(warnBadge);
                }

                row.appendChild(ecodeEl);
                row.appendChild(nameEl);
                row.appendChild(badgesEl);

                // Row click (body) — for multi-effect: fires first variant; sub-buttons handle specifics
                row.addEventListener('click', () => App.animSimSelectEntry(ecode));
                frag.appendChild(row);

                // ── Inline variant expansion (when ×N badge is toggled) ──────
                if (isExpanded) {
                    const expandWrap = document.createElement('div');
                    expandWrap.className = 'as-entry-list-expand';
                    group.forEach((entry, idx) => {
                        const vBtn = document.createElement('button');
                        vBtn.className = 'as-entry-list-variant-btn';
                        const vLabel = entry.animFlag || `Effect ${idx + 1}`;
                        vBtn.textContent = `${idx + 1}: ${vLabel}`;
                        if (entry.animFlag === 'Animated') vBtn.classList.add('anim');
                        vBtn.addEventListener('click', e => {
                            e.stopPropagation();
                            // v13.11.35 FIX: clear engine BEFORE setting activeEcode.
                            // _animSimClearEngine deletes as.activeEcode from activeTriggers —
                            // must happen while it still holds the OLD ecode, not the new one.
                            // Setting activeEcode first caused stale timer guards to fire on
                            // the new entry, allowing two simultaneous frame-cycle timers.
                            this._animSimClearEngine();
                            as.activeEcode = ecode;
                            as._subGroup = group;
                            list.querySelectorAll('.as-entry-list-item').forEach(el =>
                                el.classList.toggle('as-entry-list-active', el.dataset.ecode === ecode));
                            this._animSimRenderEntry(entry);
                            // Highlight the chosen sub-button
                            expandWrap.querySelectorAll('.as-entry-list-variant-btn').forEach((b, i) =>
                                b.classList.toggle('active', i === idx));
                        });
                        expandWrap.appendChild(vBtn);
                    });
                    frag.appendChild(expandWrap);
                }
            });
            list.innerHTML = '';
            list.appendChild(frag);
        }

        const countEl = document.getElementById('as-status-line-inline');
        if (countEl && !as.activeEcode) {
            countEl.innerHTML = `<span style="color:var(--text-muted)">${visible.length} entries (${as.entries.length} effects total)</span>`;
        }
    },

    animSimSetFilter(type) {
        const as = this.data.animSim;
        as.typeFilter = type;
        ['both','table','playlist'].forEach(t => {
            // Update both inline and cref-modal buttons (whichever are present)
            document.getElementById('as-btn-' + t)?.classList.toggle('active', t === type);
            document.getElementById('as-btn-' + t + '-inline')?.classList.toggle('active', t === type);
        });
        this.animSimPopulateDropdown();
    },

    animSimToggleSort() {
        const as = this.data.animSim;
        as.sortMode = as.sortMode === 'ecode' ? 'alpha' : 'ecode';
        const label = as.sortMode === 'ecode' ? 'Sort: E# \u2191' : 'Sort: A\u2013Z';
        const btn1 = document.getElementById('as-btn-sort');
        const btn2 = document.getElementById('as-btn-sort-inline');
        if (btn1) btn1.textContent = label;
        if (btn2) btn2.textContent = label;
        this.animSimPopulateDropdown();
    },

    animSimSearch(val) {
        this.data.animSim.searchStr = val;
        this.animSimPopulateDropdown();
    },

    // Main entry renderer — called when user picks a dropdown item
    // Called when user picks from the main dropdown (value = ecode string)
    // v13.11.23: if the ecode has multiple effect rows, show a sub-selector
    animSimSelectEntry(ecode) {
        this._animSimClear();
        if (!ecode) return;

        // v13.11.33: list-based selector — clear old active row, highlight new one, scroll into view
        // v13.11.34: custom scroll to account for sticky header height
        const list = document.getElementById('as-entry-list-inline');
        if (list) {
            list.querySelectorAll('.as-entry-list-item').forEach(el => {
                el.classList.toggle('as-entry-list-active', el.dataset.ecode === ecode);
            });
            const activeRow = list.querySelector(`.as-entry-list-item[data-ecode="${ecode}"]`);
            if (activeRow) {
                const rowTop = activeRow.offsetTop;
                const rowBot = rowTop + activeRow.offsetHeight;
                const visTop = list.scrollTop;
                const visBot = list.scrollTop + list.clientHeight;
                if (rowTop < visTop)        list.scrollTop = rowTop;
                else if (rowBot > visBot)   list.scrollTop = rowBot - list.clientHeight;
            }
        }

        const as = this.data.animSim;
        const group = as._grouped?.get(ecode);
        if (!group || !group.length) return;

        as.activeEcode = ecode;

        if (group.length === 1) {
            this._animSimRenderEntry(group[0]);
        } else {
            this._animSimShowEffectSubSelector(group);
        }

        // v13.11.29: Sync the spreadsheet grid row highlight if grid is open
        this._animSimRefreshGridHighlight();
    },

    // Render a single entry object onto the matrix and toys
    _animSimRenderEntry(entry) {
        const as = this.data.animSim;
        const ecode = entry.ecode;

        this._animSimUpdateStatus(entry);
        if (entry.dimMismatch) this._animSimShowDimWarnToast(entry);

        // Step 1: Render GIF bitmap frame
        if (as.gifFrames.length > 0) {
            if (entry.outOfRange) {
                console.warn(`[AnimSim] ${ecode} ABF${entry.abf} out of range (${as.gifFrames.length} frames).`);
            } else {
                const renderW = Math.min(entry.abw, as.gifWidth);
                const renderH = Math.min(entry.abh, as.gifHeight);
                this._animSimRenderBitmapFrame(entry.abf, renderW, renderH);
                if (entry.aac > 1) this._animSimStartFrameCycle(entry);
            }
        }

        // Step 2: Inject non-bitmap segments from col H verbatim.
        // v13.11.24 FIX: Skip any segment containing ABF — that segment is the bitmap
        // positioning instruction (frame index, area size). Passing it through registerEffect
        // causes the engine to see ABW232/ABH32 as a full-coverage white area fill, which
        // floods the entire matrix white and buries the GIF bitmap rendered in Step 1.
        const matrixOutputNum = this._animSimGetMatrixOutputNum();
        if (matrixOutputNum !== null && entry.colH) {
            entry.colH.split('/').forEach(seg => {
                seg = seg.trim();
                if (!seg) return;
                if (/\bABF\d/i.test(seg)) return; // bitmap frame ref — rendered in Step 1, skip here
                this.registerEffect(seg, matrixOutputNum);
            });
        }

        // Steps 3 + 4: Route base programming and per-table KV effects via user's kvMap.
        // v13.11.27: All keyword/fuzzy-matching approaches replaced by explicit user mapping.
        // The KV Mapping panel lets the user connect each spreadsheet column to a real
        // cabinet strip or RGB toy. Mapping saved to localStorage and re-used each session.
        as.baseProgramming.forEach((kvStr, colIdx) => {
            if (!kvStr || !kvStr.trim()) return;
            this._animSimRouteKvEffect(colIdx, kvStr);
        });

        this.data.activeTriggers.add(ecode);

        entry.colsKV.forEach((kvStr, colIdx) => {
            if (!kvStr || !kvStr.trim() || kvStr === '0') return;
            this._animSimRouteKvEffect(colIdx, kvStr);
        });
    },

    // Show inline effect-variant sub-selector for multi-row E-codes.
    // v13.11.24: Writes to #as-subselector-inline (dedicated element) so that
    // _animSimUpdateStatus writing to #as-status-line-inline does NOT wipe the buttons.
    _animSimShowEffectSubSelector(group) {
        const el = document.getElementById('as-subselector-inline');
        if (!el) return;
        this.data.animSim._subGroup = group;
        let html = `<div class="as-subselector-label">${group[0].ecode} — ${group[0].displayName}:</div>`;
        html += '<div class="as-subselector-row">';
        group.forEach((entry, i) => {
            const desc = entry.animFlag || ('Effect ' + (i + 1));
            html += `<button class="as-subselector-btn" onclick="App._animSimPickVariant(${i})" data-idx="${i}">${i + 1}: ${desc}</button>`;
        });
        html += '</div>';
        el.innerHTML = html;
    },

    // v13.11.34: Clear rendering engine state only — does NOT touch DOM sub-selector or list.
    // Shared by _animSimPickVariant, ANIM badge click, and inline variant buttons.
    _animSimClearEngine() {
        const as = this.data.animSim;
        if (as.activeEcode) this.data.activeTriggers.delete(as.activeEcode);
        if (as._frameCycleTimer) { clearInterval(as._frameCycleTimer); as._frameCycleTimer = null; }
        as.bitmapPixels = [];
        as.heldEffects  = [];
        this.data.matrixEffects = [];
        this.data.stripEffects.forEach(arr => arr.length = 0);
        this.data.toyEffects.clear();
        document.querySelectorAll('.toy-lamp').forEach(t => {
            t.style.backgroundColor = '#222'; t.style.boxShadow = 'none'; t.style.opacity = '';
        });
    },

    // Called when user picks a variant from the sub-selector.
    // v13.11.24: Does NOT call _animSimClear() first (which would wipe the sub-selector
    // via parseActiveEffects → DOM reset). Instead clears only the engine state and
    // re-renders, leaving #as-subselector-inline untouched.
    _animSimPickVariant(idx) {
        const as = this.data.animSim;
        const group = as._subGroup;
        if (!group || !group[idx]) return;
        // Highlight the chosen button
        document.querySelectorAll('#as-subselector-inline .as-subselector-btn').forEach((b, i) => {
            b.classList.toggle('active', i === idx);
        });
        // Clear engine state without touching the sub-selector DOM
        this._animSimClearEngine();
        as.activeEcode = group[idx].ecode;
        this._animSimRenderEntry(group[idx]);
    },


    // Clear all Animation Simulator injected state
    _animSimClear() {
        const as = this.data.animSim;
        if (as.activeEcode) {
            this.data.activeTriggers.delete(as.activeEcode);
        }
        as.activeEcode = null;
        as._subGroup = null;
        as.bitmapPixels = []; // v13.11.25: stop re-painting stale bitmap on next frame
        if (as._frameCycleTimer) {
            clearInterval(as._frameCycleTimer);
            as._frameCycleTimer = null;
        }
        // v13.11.33: list selector — remove active class from all rows (no select to reset)
        const list = document.getElementById('as-entry-list-inline');
        if (list) list.querySelectorAll('.as-entry-list-item').forEach(el => el.classList.remove('as-entry-list-active'));
        // v13.11.24: Clear sub-selector element (separate from status line)
        const sub = document.getElementById('as-subselector-inline');
        if (sub) sub.innerHTML = '';
        // v13.11.24: Clear status line
        const stat = document.getElementById('as-status-line-inline');
        if (stat) stat.innerHTML = '';
        this.parseActiveEffects();
    },

    // Paint a single GIF frame onto the LED matrix pixel grid.
    // v13.11.25 FIX: Stores pixels in as.bitmapPixels[] instead of painting to DOM directly.
    // clearAllVisuals() resets all .pix backgroundColor every gameLoop frame (16ms),
    // so any direct DOM paint was immediately wiped before the eye could see it.
    // gameLoop now re-applies bitmapPixels after clearAllVisuals on every frame.
    _animSimRenderBitmapFrame(frameIdx, renderW, renderH) {
        const as = this.data.animSim;
        const m = this.data.cabinet.matrix;
        if (!m || !as.gifFrames[frameIdx]) return;

        const imgData = as.gifFrames[frameIdx];
        const gifW = as.gifWidth;
        const mW = m.w, mH = m.h;

        as.bitmapPixels = []; // clear previous frame

        for (let py = 0; py < renderH; py++) {
            for (let px = 0; px < renderW; px++) {
                const mxCol = Math.floor((px / renderW) * mW);
                const mxRow = Math.floor((py / renderH) * mH);
                if (mxCol >= mW || mxRow >= mH) continue;

                const domIdx = mxRow * mW + mxCol;
                const gifPixIdx = (py * gifW + px) * 4;
                const r = imgData.data[gifPixIdx];
                const g = imgData.data[gifPixIdx + 1];
                const b = imgData.data[gifPixIdx + 2];
                const a = imgData.data[gifPixIdx + 3];

                if (a < 10 || (r + g + b) < 12) continue; // transparent / black

                as.bitmapPixels.push({ domIdx, r, g, b });
            }
        }
    },

    // Start frame cycling for entries with AAC > 1 (e.g. E2025 AAC=32)
    _animSimStartFrameCycle(entry) {
        const as = this.data.animSim;
        let currentOffset = 0;
        as._frameCycleTimer = setInterval(() => {
            if (as.activeEcode !== entry.ecode) {
                clearInterval(as._frameCycleTimer);
                return;
            }
            const frameIdx = entry.abf + currentOffset;
            const renderW = Math.min(entry.abw, as.gifWidth);
            const renderH = Math.min(entry.abh, as.gifHeight);
            this._animSimRenderBitmapFrame(frameIdx, renderW, renderH);
            currentOffset = (currentOffset + 1) % entry.aac;
        }, 100);
    },

    // Extract the sparkle overlay from col J (AFDEN/AFMIN/AFMAX layer only)
    // Returns a synthesised effect string or null
    // (v13.11.23: _animSimExtractSparkleLayer removed — sparkle is now injected verbatim
    //  from all colH segments in animSimSelectEntry Step 2)

    // ── v13.11.27: KV Output Mapping system ──────────────────────────────────────
    // The 12 KV spreadsheet columns cannot be auto-matched to cabinet hardware names
    // because they use completely different naming systems (spreadsheet headers vs
    // cabinet XML output names). Instead the user maps each column once using the
    // KV Mapping panel, and the mapping is persisted to localStorage.
    //
    // Column definitions:
    //   0  PF Left Effects MX HD    → addressable strip
    //   1  PF Right Effects MX HD   → addressable strip
    //   2  Flipper Button MX        → addressable strip
    //   3  Magnasave Left MX        → addressable strip
    //   4  Magnasave Right MX       → addressable strip
    //   5  Fire MX                  → addressable strip
    //   6  RGB Undercab Complex MX  → addressable strip
    //   7  RGB Undercab Smart       → RGB toy
    //   8  RGB Flipper              → RGB toy
    //   9  RGB Left Magnasave       → RGB toy
    //  10  RGB Right Magnasave      → RGB toy
    //  11  RGB Fire Button          → RGB toy

    _animSimKvColDefs() {
        return [
            { colIdx: 0,  label: 'PF Left Effects MX HD',  type: 'strip' },
            { colIdx: 1,  label: 'PF Right Effects MX HD', type: 'strip' },
            { colIdx: 2,  label: 'Flipper Button MX',       type: 'strip' },
            { colIdx: 3,  label: 'Magnasave Left MX',       type: 'strip' },
            { colIdx: 4,  label: 'Magnasave Right MX',      type: 'strip' },
            { colIdx: 5,  label: 'Fire MX',                 type: 'strip' },
            { colIdx: 6,  label: 'RGB Undercab Complex MX', type: 'strip' },
            { colIdx: 7,  label: 'RGB Undercab Smart',      type: 'rgb'   },
            { colIdx: 8,  label: 'RGB Flipper',             type: 'rgb'   },
            { colIdx: 9,  label: 'RGB Left Magnasave',      type: 'rgb'   },
            { colIdx: 10, label: 'RGB Right Magnasave',     type: 'rgb'   },
            { colIdx: 11, label: 'RGB Fire Button',         type: 'rgb'   },
        ];
    },

    // Route a single KV effect string for column colIdx using the user's saved kvMap.
    // kvMap entry: { type:'strip'|'rgb', values:['name1','name2',...] }
    // v13.11.28: values is an array — user can assign multiple targets to one KV output.
    // v13.11.38 FIX: split kvStr on '/' before routing. Multi-segment strings like
    //   "E2000 Blue AH100.../E2000 Red W50.../E2000 Yellow W100..."
    // must be registered as separate effects so each color, W wait, and timing param
    // is parsed independently. Previously the entire unsplit string was passed to
    // registerEffect, which extracted only the first color found — dropping all
    // subsequent segments and their staggered W delays silently.
    _animSimRouteKvEffect(colIdx, kvStr) {
        const mapping = (this.data.animSim.kvMap || {})[colIdx];
        if (!mapping || !mapping.values || !mapping.values.length) return;

        // Split on '/' to get individual effect segments (same as colH matrix path)
        const segments = kvStr.split('/').map(s => s.trim()).filter(Boolean);

        mapping.values.forEach(targetName => {
            if (!targetName || targetName === '__none__') return;

            segments.forEach(seg => {
                if (mapping.type === 'strip') {
                    // Preferred path: find output number via toyMap → registerEffect
                    for (const [outNum, hwName] of this.data.cabinet.toyMap.entries()) {
                        if (hwName === targetName) {
                            this.registerEffect(seg, outNum);
                            return;
                        }
                    }
                    // Fallback: push directly to stripEffects by strip array index
                    const stripIdx = this.data.cabinet.strips.findIndex(s => s.name === targetName);
                    if (stripIdx >= 0 && this.data.stripEffects.has(stripIdx)) {
                        // v13.11.44: _parseSegParams extracts ALL timing/fade/blink params
                        const p = this._parseSegParams(seg);
                        this.data.stripEffects.get(stripIdx).push({
                            color: p.color, at: p.at, ah: p.ah, as: p.as,
                            blink: p.blink, bpw: p.bpw, fu: p.fu, fd: p.fd,
                            dur: p.dur, maxDur: p.maxDur, minDur: p.minDur,
                            afden: p.afden, afmin: p.afmin, afmax: p.afmax,
                            layer: p.layer, fade: p.fade,
                            startTime: Date.now() + p.wait
                        });
                    }
                } else if (mapping.type === 'rgb') {
                    const p = this._parseSegParams(seg);
                    const toyId = 'rgb_' + targetName.replace(/[^a-zA-Z0-9]/g, '_');
                    // v13.11.44: include all timing/fade params
                    this.data.toyEffects.set(toyId, {
                        color: p.color, blink: p.blink, bpw: p.bpw,
                        fu: p.fu, fd: p.fd, fade: p.fade,
                        dur: p.dur, maxDur: p.maxDur, minDur: p.minDur,
                        startTime: Date.now() + p.wait
                    });
                }
            });
        });
    },

    // Load kvMap from localStorage into animSim state. Called at session confirm.
    _animSimLoadKvMap() {
        try {
            const raw = localStorage.getItem('dof-animsim-kv-map');
            this.data.animSim.kvMap = raw ? JSON.parse(raw) : {};
        } catch(e) {
            this.data.animSim.kvMap = {};
        }
    },

    // Persist current kvMap to localStorage.
    _animSimSaveKvMap() {
        try {
            localStorage.setItem('dof-animsim-kv-map', JSON.stringify(this.data.animSim.kvMap || {}));
        } catch(e) { /* quota or private browsing */ }
    },

    // Build the Output Mapping panel UI.
    // v13.11.28: Each KV row now shows a checkbox list instead of a single <select>.
    // User can tick any number of strips or toys — all selected targets receive the effect.
    // Stored as { type, values: [] }. Panel header renamed to "Output Mapping".
    _animSimBuildMappingPanel() {
        const container = document.getElementById('as-kv-map-container');
        if (!container) return;

        const strips  = this.data.cabinet.strips.map(s => s.name);
        const rgbToys = this._buildRgbToyMap().map(t => t.displayName);
        const kvMap   = this.data.animSim.kvMap || {};
        const defs    = this._animSimKvColDefs();

        let html = '';
        let lastType = null;

        defs.forEach(def => {
            if (def.type !== lastType) {
                if (lastType !== null) html += '</div>'; // close group
                const groupLabel = def.type === 'strip' ? 'ADDRESSABLE STRIPS' : 'RGB TOYS';
                const groupColor = def.type === 'strip' ? '#00e5ff' : '#bf80ff';
                html += `<div class="as-kv-group">`;
                html += `<div class="as-kv-group-header" style="color:${groupColor}">${groupLabel}</div>`;
                lastType = def.type;
            }

            const saved      = kvMap[def.colIdx];
            // v13.11.28: values[] replaces single value
            const savedVals  = new Set(saved?.values || (saved?.value ? [saved.value] : []));
            const options    = def.type === 'strip' ? strips : rgbToys;

            html += `<div class="as-kv-row" data-col="${def.colIdx}">`;
            html += `<span class="as-kv-label" title="${def.label}">${def.label}</span>`;
            html += `<div class="as-kv-checklist" data-col="${def.colIdx}" data-type="${def.type}">`;

            if (!options.length) {
                html += `<span class="as-kv-no-options">No ${def.type === 'strip' ? 'strips' : 'RGB toys'} found in cabinet</span>`;
            } else {
                options.forEach((name, i) => {
                    const checked = savedVals.has(name) ? ' checked' : '';
                    const cbId = `kvcb-${def.colIdx}-${i}`;
                    html += `<label class="as-kv-check-label" title="${name}">`;
                    html += `<input type="checkbox" id="${cbId}" class="as-kv-cb"
                                data-col="${def.colIdx}" data-type="${def.type}" data-name="${name}"
                                onchange="App._animSimKvCbChanged(this)"${checked}>`;
                    html += `<span class="as-kv-cb-text">${name}</span>`;
                    html += `</label>`;
                });
            }
            html += `</div></div>`;
        });
        if (lastType !== null) html += '</div>';
        container.innerHTML = html;
    },

    // Called when any mapping checkbox changes. Rebuilds the values[] array for that column.
    _animSimKvCbChanged(cbEl) {
        const colIdx = parseInt(cbEl.dataset.col, 10);
        const type   = cbEl.dataset.type;
        if (!this.data.animSim.kvMap) this.data.animSim.kvMap = {};

        // Collect all checked values for this column
        const checklist = cbEl.closest('.as-kv-checklist');
        const values = [];
        checklist?.querySelectorAll('.as-kv-cb:checked').forEach(cb => values.push(cb.dataset.name));

        this.data.animSim.kvMap[colIdx] = { type, values };
        this._animSimSaveKvMap();

        // Flash the row
        const row = cbEl.closest('.as-kv-row');
        if (row) { row.classList.add('as-kv-saved'); setTimeout(() => row.classList.remove('as-kv-saved'), 500); }
    },

    // Output Mapping panel — cycle through 3 states: expanded → docked → hidden → expanded
    // Docked: body hidden, header floats at bottom of anim-sim-section as a compact bar.
    // Hidden: entire section removed from flow; a tiny ⚙ restore badge appears instead.
    _animSimToggleKvPanel(headerEl) {
        const section  = document.getElementById('as-kv-map-section');
        const body     = document.getElementById('as-kv-map-container');
        const arrow    = headerEl?.querySelector('.as-kv-map-toggle');
        if (!section || !body) return;

        const state = section.dataset.state || 'expanded';

        if (state === 'expanded') {
            // → docked
            section.dataset.state = 'docked';
            body.classList.add('as-kv-map-collapsed');
            section.classList.add('as-kv-docked');
            if (arrow) arrow.textContent = '▶';
        } else if (state === 'docked') {
            // → hidden
            section.dataset.state = 'hidden';
            section.style.display = 'none';
            // Show restore badge
            let badge = document.getElementById('as-kv-restore-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.id = 'as-kv-restore-badge';
                badge.className = 'as-kv-restore-badge';
                badge.title = 'Restore Output Mapping panel';
                badge.innerHTML = '&#9881; Output Mapping';
                badge.onclick = () => App._animSimRestoreKvPanel();
                section.parentNode.appendChild(badge);
            }
            badge.style.display = 'flex';
        } else {
            // → expanded (from docked — shouldn't reach here but handle gracefully)
            section.dataset.state = 'expanded';
            body.classList.remove('as-kv-map-collapsed');
            section.classList.remove('as-kv-docked');
            if (arrow) arrow.textContent = '▼';
        }
    },

    // Restore panel from hidden state
    _animSimRestoreKvPanel() {
        const section = document.getElementById('as-kv-map-section');
        const body    = document.getElementById('as-kv-map-container');
        const badge   = document.getElementById('as-kv-restore-badge');
        if (!section) return;
        section.style.display = '';
        section.dataset.state = 'expanded';
        section.classList.remove('as-kv-docked');
        if (body) body.classList.remove('as-kv-map-collapsed');
        const arrow = section.querySelector('.as-kv-map-toggle');
        if (arrow) arrow.textContent = '▼';
        if (badge) badge.style.display = 'none';
    },

    // Map KV column index (0-based relative to col I) → column label (debug only)
    _animSimKvColToToyName(colIdx) {
        const KV_MAP = [
            'PF Left Effects MX HD',    // 0 → col I
            'PF Right Effects MX HD',   // 1 → col J
            'Flipper Button MX',        // 2 → col K
            'Magnasave Left MX',        // 3 → col L
            'Magnasave Right MX',       // 4 → col M
            'Fire MX',                  // 5 → col N
            'RGB Undercab Complex MX',  // 6 → col O
            'RGB Undercab Smart',       // 7 → col P
            'RGB Flipper',              // 8 → col Q
            'RGB Left Magnasave',       // 9 → col R
            'RGB Right Magnasave',      // 10 → col S
            'RGB Fire Button',          // 11 → col T
        ];
        return KV_MAP[colIdx] || null;
    },

    // Resolve a toy name → output number via the cabinet toyMap (reverse lookup)
    _animSimToyNameToOutputNum(toyName) {
        for (const [outNum, name] of this.data.cabinet.toyMap.entries()) {
            if (name === toyName) return outNum;
        }
        return null;
    },

    // Get the output number for the Matrix hardware (used for sparkle injection)
    _animSimGetMatrixOutputNum() {
        for (const [outNum, name] of this.data.cabinet.toyMap.entries()) {
            if (name === 'Matrix') return outNum;
        }
        return null;
    },

    // Update the status line below the dropdown for the selected entry
    _animSimUpdateStatus(entry) {
        const el = document.getElementById('as-status-line-inline')
                || document.getElementById('as-status-line');
        if (!el) return;
        let html = `<span class="as-ecode-tag">${entry.ecode}</span> `;
        html += `<span class="as-title-tag">${entry.displayName}</span> `;
        if (entry.animFlag) {
            html += `<span style="color:var(--text-muted);font-size:0.6rem;">(${entry.type} · ${entry.animFlag})</span>`;
        } else {
            html += `<span style="color:var(--text-muted);font-size:0.6rem;">(${entry.type})</span>`;
        }
        // v13.11.24: notes field removed per spec — status shows ecode/name/type/animFlag only
        if (entry.outOfRange) {
            html += ` <span class="as-warn-badge" title="ABF${entry.abf} exceeds GIF frame count — bitmap skipped">⚠ out of range</span>`;
        }
        if (entry.dimMismatch) {
            html += ` <span class="as-warn-badge" title="ABW${entry.abw}×ABH${entry.abh} exceeds GIF ${this.data.animSim.gifWidth}×${this.data.animSim.gifHeight} — clamped">† dim</span>`;
        }
        if (entry.pupNames.length > 1) {
            html += ` <span class="as-pup-tag" title="PUP tables sharing this E code: ${entry.pupNames.join(', ')}">(shared by ${entry.pupNames.length} PUP tables)</span>`;
        }
        el.innerHTML = html;
    },

    // Non-blocking yellow toast for data quality warning (dim mismatch)
    _animSimShowDimWarnToast(entry) {
        // Remove any existing toast first
        document.getElementById('as-dim-warn-toast')?.remove();

        const toast = document.createElement('div');
        toast.id = 'as-dim-warn-toast';
        toast.className = 'as-warn-toast';
        const as = this.data.animSim;
        toast.innerHTML = `
            <div class="as-warn-toast-header">
                ⚠ Data Quality Notice
                <span class="as-warn-toast-close" onclick="this.closest('.as-warn-toast').remove()">✕</span>
            </div>
            <div class="as-warn-toast-body">
                <strong>${entry.ecode} — ${entry.nameXlsx}</strong><br>
                Spreadsheet specifies <strong>ABW${entry.abw} × ABH${entry.abh}</strong>, but the GIF canvas is
                <strong>${as.gifWidth} × ${as.gifHeight}px</strong>.<br>
                The extra ${entry.abw - as.gifWidth}px (width) and ${entry.abh - as.gifHeight}px (height)
                fall outside the GIF — they would be black void. The bitmap has been
                <strong>clamped to the correct GIF dimensions</strong>. Full image content is preserved.
            </div>
            <div class="as-warn-toast-footer">This is a known spreadsheet data entry error. Rendering is correct.</div>`;
        document.body.appendChild(toast);

        // Auto-dismiss after 8 seconds
        setTimeout(() => toast.remove(), 8000);
    },

};

App.init();


// ═══════════════════════════════════════════════════════════════════════════════════
// DOF BUILDER — Multi-Layer Edition  |  v13.11.55
// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION CONTRACT:
//   • Zero modifications to App or any code above this block.
//   • All DOM IDs prefixed  dob-  ; all CSS classes prefixed  dob-
//   • localStorage key 'dob_state' (isolated from all simulator keys).
//   • Builder.previewAnimationFrame managed independently of App.gameLoop.
//   • Lazy init: Builder.init() runs only on first toggle — zero page-load overhead.
//   • DOM rendering: div grid for matrix (matches simulator), flex cols for strip.
//   • Cabinet dims: read from App.data.cabinet when toggled; warns if not loaded.
//   • Shapes: uses App.data.shapes + App.data.shapeAtlas when loaded.
//   • 6 layers with Z-order TOP/BOTTOM labels.
// ═══════════════════════════════════════════════════════════════════════════════════

const Builder = {

    // ── Identity ──────────────────────────────────────────────────────────────
    STORAGE_KEY: 'dob_state',
    VERSION    : '13.13.24',
    NUM_LAYERS : 6,

    // ── Cabinet-driven preview dimensions (set on toggle) ─────────────────────
    previewCols : 40,
    previewRows :  8,
    previewStrip: 100,

    // ── Section definitions — static staged output fields ─────────────────
    SECTIONS: [
        'Custom MX 1',
        'PF Left Effects MX HD', 'PF Right Effects MX HD',
        'Flipper Button MX', 'Magnasave Left MX', 'Magnasave Right MX', 'Fire MX',
        'RGB Undercab Complex MX', 'RGB Undercab Smart',
        'RGB Flipper', 'RGB Left Magnasave', 'RGB Right Magnasave', 'RGB Fire Button'
    ],
    SINGLE_SECTIONS: [
        'Flipper Button MX', 'Magnasave Left MX', 'Magnasave Right MX', 'Fire MX',
        'RGB Undercab Smart', 'RGB Flipper', 'RGB Left Magnasave', 'RGB Right Magnasave', 'RGB Fire Button'
    ],

    // ── Runtime state ──────────────────────────────────────────────────────────
    _initialized   : false,
    isVisible      : false,
    currentLayerIdx: 0,
    activeSection  : 'PF Left Effects MX HD',
    sectionConfigs : {},
    previewAnimationFrame: null,
    _matrixVisible : true,
    _stripVisible  : true,
    _stripChecked  : {},   // { stripName: boolean } — which strips are visible
    _matrixBright  : 1,
    _matrixGap     : 1,

    // ── Sparkle state per layer ───────────────────────────────────────────────
    _sparkleState : [],

    // ── Scroll position accumulator per layer [ox,oy per layer → 6×2=12] ─────
    _motionT: [0,0, 0,0, 0,0, 0,0, 0,0, 0,0],

    // ── Layer data — full DOF parameter set ───────────────────────────────────
    _defaultLayer() {
        return {
            active : false,
            color  : '',
            hex    : '#000000',
            effect : '',
            duration: 0, blink: 200, bpw: 50,
            fu: 0, fd: 0, f: 0, wait: 0,
            mhold: 0, maxDur: 0, maxInt: 255,
            al: 0, aw: 100, at: 0, ah: 100,
            as: 0, dir: '',
            afden: 0, afmin: 50, afmax: 150,
            shp: '', zlayer: 0,
        };
    },

    layers: [],

    // ── DOF named color palette (137 colors) ──────────────────────────────────
    allColors: [
        {n:'Black',h:'#000000'},{n:'White',h:'#FFFFFF'},{n:'Red',h:'#FF0000'},{n:'Lime',h:'#00FF00'},
        {n:'Blue',h:'#0000FF'},{n:'Yellow',h:'#FFFF00'},{n:'Cyan',h:'#00FFFF'},{n:'Magenta',h:'#FF00FF'},
        {n:'Silver',h:'#C0C0C0'},{n:'Gray',h:'#808080'},{n:'Maroon',h:'#800000'},{n:'Olive',h:'#808000'},
        {n:'Green',h:'#008000'},{n:'Purple',h:'#800080'},{n:'Teal',h:'#008080'},{n:'Navy',h:'#000080'},
        {n:'Dark_red',h:'#8B0000'},{n:'Firebrick',h:'#B22222'},{n:'Crimson',h:'#DC143C'},{n:'Tomato',h:'#FF6347'},
        {n:'Coral',h:'#FF7F50'},{n:'Indian_red',h:'#CD5C5C'},{n:'Light_coral',h:'#F08080'},{n:'Dark_salmon',h:'#E9967A'},
        {n:'Salmon',h:'#FA8072'},{n:'Light_salmon',h:'#FFA07A'},{n:'Orange_red',h:'#FF4500'},{n:'Dark_orange',h:'#FF8C00'},
        {n:'Orange',h:'#FFA500'},{n:'Gold',h:'#FFD700'},{n:'Dark_golden_rod',h:'#B8860B'},{n:'Golden_rod',h:'#DAA520'},
        {n:'Pale_golden_rod',h:'#EEE8AA'},{n:'Dark_khaki',h:'#BDB76B'},{n:'Khaki',h:'#F0E68C'},{n:'Yellow_green',h:'#9ACD32'},
        {n:'Dark_olive_green',h:'#556B2F'},{n:'Olive_drab',h:'#6B8E23'},{n:'Lawn_green',h:'#7CFC00'},{n:'Chartreuse',h:'#7FFF00'},
        {n:'Green_yellow',h:'#ADFF2F'},{n:'Dark_green',h:'#006400'},{n:'Forest_green',h:'#228B22'},{n:'Lime_green',h:'#32CD32'},
        {n:'Light_green',h:'#90EE90'},{n:'Pale_green',h:'#98FB98'},{n:'Dark_sea_green',h:'#8FBC8F'},{n:'Medium_spring_green',h:'#00FA9A'},
        {n:'Spring_green',h:'#00FF7F'},{n:'Sea_green',h:'#2E8B57'},{n:'Medium_sea_green',h:'#3CB371'},{n:'Light_sea_green',h:'#20B2AA'},
        {n:'Dark_slate_gray',h:'#2F4F4F'},{n:'Dark_cyan',h:'#008B8B'},{n:'Aqua',h:'#00FFFF'},{n:'Light_cyan',h:'#E0FFFF'},
        {n:'Dark_turquoise',h:'#00CED1'},{n:'Turquoise',h:'#40E0D0'},{n:'Medium_turquoise',h:'#48D1CC'},{n:'Pale_turquoise',h:'#AFEEEE'},
        {n:'Aquamarine',h:'#7FFFD4'},{n:'Powder_blue',h:'#B0E0E6'},{n:'Cadet_blue',h:'#5F9EA0'},{n:'Steel_blue',h:'#4682B4'},
        {n:'Cornflower_blue',h:'#6495ED'},{n:'Deep_sky_blue',h:'#00BFFF'},{n:'Dodger_blue',h:'#1E90FF'},{n:'Light_blue',h:'#ADD8E6'},
        {n:'Sky_blue',h:'#87CEEB'},{n:'Light_sky_blue',h:'#87CEFA'},{n:'Midnight_blue',h:'#191970'},{n:'Dark_blue',h:'#00008B'},
        {n:'Medium_blue',h:'#0000CD'},{n:'Royal_blue',h:'#4169E1'},{n:'Blue_violet',h:'#8A2BE2'},{n:'Indigo',h:'#4B0082'},
        {n:'Dark_slate_blue',h:'#483D8B'},{n:'Slate_blue',h:'#6A5ACD'},{n:'Medium_slate_blue',h:'#7B68EE'},{n:'Medium_purple',h:'#9370DB'},
        {n:'Dark_magenta',h:'#8B008B'},{n:'Dark_violet',h:'#9400D3'},{n:'Dark_orchid',h:'#9932CC'},{n:'Medium_orchid',h:'#BA55D3'},
        {n:'Thistle',h:'#D8BFD8'},{n:'Plum',h:'#DDA0DD'},{n:'Violet',h:'#EE82EE'},{n:'Fuchsia',h:'#FF00FF'},
        {n:'Orchid',h:'#DA70D6'},{n:'Medium_violet_red',h:'#C71585'},{n:'Pale_violet_red',h:'#DB7093'},{n:'Deep_pink',h:'#FF1493'},
        {n:'Hot_pink',h:'#FF69B4'},{n:'Light_pink',h:'#FFB6C1'},{n:'Pink',h:'#FFC0CB'},{n:'Antique_white',h:'#FAEBD7'},
        {n:'Beige',h:'#F5F5DC'},{n:'Bisque',h:'#FFE4C4'},{n:'Blanched_almond',h:'#FFEBCD'},{n:'Wheat',h:'#F5DEB3'},
        {n:'Lemon_chiffon',h:'#FFFACD'},{n:'Cornsilk',h:'#FFF8DC'},{n:'Light_yellow',h:'#FFFFE0'},{n:'Peru',h:'#CD853F'},
        {n:'Sandy_brown',h:'#F4A460'},{n:'Burlywood',h:'#DEB887'},{n:'Tan',h:'#D2B48C'},{n:'Rosy_brown',h:'#BC8F8F'},
        {n:'Moccasin',h:'#FFE4B5'},{n:'Navajo_white',h:'#FFDEAD'},{n:'Peach_puff',h:'#FFDAB9'},{n:'Misty_rose',h:'#FFE4E1'},
        {n:'Lavender_blush',h:'#FFF0F5'},{n:'Linen',h:'#FAF0E6'},{n:'Old_lace',h:'#FDF5E6'},{n:'Papaya_whip',h:'#FFEFD5'},
        {n:'Seashell',h:'#FFF5EE'},{n:'Mint_cream',h:'#F5FFFA'},{n:'Slate_gray',h:'#708090'},{n:'Light_slate_gray',h:'#778899'},
        {n:'Light_steel_blue',h:'#B0C4DE'},{n:'Lavender',h:'#E6E6FA'},{n:'Floral_white',h:'#FFFAF0'},{n:'Alice_blue',h:'#F0F8FF'},
        {n:'Ghost_white',h:'#F8F8FF'},{n:'Honeydew',h:'#F0FFF0'},{n:'Ivory',h:'#FFFFF0'},{n:'Azure',h:'#F0FFFF'},
        {n:'Snow',h:'#FFFAFA'},{n:'Dim_gray',h:'#696969'},{n:'Gainsboro',h:'#DCDCDC'},{n:'Light_gray',h:'#D3D3D3'},
        {n:'White_smoke',h:'#F5F5F5'}
    ],

    // ─────────────────────────────────────────────────────────────────────────
    // TOGGLE & LAZY INIT
    // ─────────────────────────────────────────────────────────────────────────
    toggle() {
        const sim = document.querySelector('.workspace');
        const bld = document.getElementById('dob-view');
        const btn = document.getElementById('dob-toggle-btn');
        if (!sim || !bld) return;

        this.isVisible = !this.isVisible;
        sim.style.display = this.isVisible ? 'none' : '';
        bld.style.display = this.isVisible ? 'flex' : 'none';
        btn.classList.toggle('dob-toggle-active', this.isVisible);
        btn.textContent = this.isVisible ? '⬅ Back to Simulator' : '🎨 DOF Builder';

        if (this.isVisible) {
            if (!this._initialized) this._doInit();
            this._syncCabinetDims();
            this._buildShapeDropdown();
            this.startPreviewLoop();
            // v13.13.0: Hide Code Sim panel when entering Builder
            const csPanel = document.getElementById('code-sim-panel');
            if (csPanel && csPanel.style.display !== 'none') {
                csPanel.style.display = 'none';
                document.getElementById('btn-code-sim')?.classList.remove('active');
            }
        } else {
            if (this.previewAnimationFrame) {
                cancelAnimationFrame(this.previewAnimationFrame);
                this.previewAnimationFrame = null;
            }
            // #10: Close Code Sim inspector when switching back to simulator
            const csPanel = document.getElementById('code-sim-panel');
            if (csPanel && csPanel.style.display !== 'none') {
                App.toggleCodeSim();
            }
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION (runs once, lazily)
    // ─────────────────────────────────────────────────────────────────────────
    _doInit() {
        this._initialized = true;
        this.layers = Array.from({length: this.NUM_LAYERS}, () => this._defaultLayer());
        this._buildColorGrid();
        this._buildSectionBtns();
        this._buildShapeDropdown();
        this._loadState();
        this.loadLayerToUI(this.currentLayerIdx);
        this._updateTabIndicators();
        this._updateZLabels();
        this._updateGenStr(); // v13.13.2: populate DOF string from restored state
        this.renderStaging();
        this._checkSingleLock();
        this._updateShapeVisibility();
    },

    _syncCabinetDims() {
        const m = (typeof App !== 'undefined') && App.data && App.data.cabinet && App.data.cabinet.matrix;
        const warn = document.getElementById('dob-dim-warn');

        if (m && m.w && m.h) {
            this.previewCols = m.w;
            this.previewRows = m.h;
            if (warn) warn.style.display = 'none';
        } else {
            this.previewCols = 40;
            this.previewRows = 8;
            if (warn) warn.style.display = 'flex';
        }

        const strips = (typeof App !== 'undefined') && App.data && App.data.cabinet && App.data.cabinet.strips;
        if (strips && strips.length) {
            this.previewStrip = Math.max(...strips.map(s => s.leds || 0), 20);
        } else {
            this.previewStrip = 100;
        }

        // Apply dim inputs
        const cinput = document.getElementById('dob-dim-cols');
        const rinput = document.getElementById('dob-dim-rows');
        const sinput = document.getElementById('dob-dim-strip');
        if (cinput) { cinput.value = this.previewCols; cinput.max = Math.round(this.previewCols * 1.1); cinput.min = Math.round(this.previewCols * 0.9); }
        if (rinput) { rinput.value = this.previewRows; rinput.max = Math.round(this.previewRows * 1.1); rinput.min = Math.round(this.previewRows * 0.9); }
        if (sinput) { sinput.value = this.previewStrip; sinput.max = Math.round(this.previewStrip * 1.1); sinput.min = Math.round(this.previewStrip * 0.9); }

        this._buildMatrixGrid();
        this._buildStripRack();
        this._initSparkleState();
        this._updateShapeVisibility();

        const mxL = document.getElementById('dob-mx-label');
        const stL = document.getElementById('dob-st-label');
        if (mxL) mxL.textContent = `Matrix — ${this.previewCols} × ${this.previewRows}`;
        if (stL) stL.textContent = `Strips — ${strips && strips.length ? strips.length + ' loaded' : this.previewStrip + ' segments'}`;
    },

    // ── Build DOM pixel grid for matrix (matches simulator) ──────────────────
    _buildMatrixGrid() {
        const el = document.getElementById('dob-matrix');
        if (!el) return;
        const c = this.previewCols, r = this.previewRows;
        el.style.gridTemplateColumns = `repeat(${c}, 1fr)`;
        el.style.gap = `${this._matrixGap}px`;
        el.innerHTML = '';
        for (let i = 0; i < c * r; i++) {
            const d = document.createElement('div');
            d.className = 'dob-pix';
            d.id = `dob-mx-${i}`;
            el.appendChild(d);
        }
    },

    // ── Build DOM strip rack — horizontal rows, actual LED count ────────────
    _buildStripRack() {
        const el = document.getElementById('dob-strip-rack');
        const checkEl = document.getElementById('dob-strip-checks');
        if (!el) return;
        el.innerHTML = '';
        if (checkEl) checkEl.innerHTML = '';

        const strips = (typeof App !== 'undefined') && App.data && App.data.cabinet && App.data.cabinet.strips;
        if (strips && strips.length) {
            // Build checkboxes
            strips.forEach((s, idx) => {
                if (this._stripChecked[s.name] === undefined) this._stripChecked[s.name] = true;
                if (checkEl) {
                    const lbl = document.createElement('label');
                    lbl.className = 'dob-strip-check';
                    lbl.innerHTML = `<input type="checkbox" ${this._stripChecked[s.name] ? 'checked' : ''} onchange="Builder._toggleStrip('${s.name.replace(/'/g,"\\'")}',this.checked)">${s.name} (${s.leds})`;
                    checkEl.appendChild(lbl);
                }
            });
            // Build horizontal strip rows
            strips.forEach((s, idx) => {
                const row = document.createElement('div');
                row.className = 'dob-strip-row';
                row.id = `dob-strip-row-${idx}`;
                row.style.display = this._stripChecked[s.name] ? '' : 'none';
                let leds = '';
                for (let i = 0; i < s.leds; i++) leds += `<div class="dob-s-led-h" id="dob-str-${idx}-${i}"></div>`;
                row.innerHTML = `<div class="dob-strip-row-label">${s.name} <span>(${s.leds} LEDs)</span></div><div class="dob-strip-body-h">${leds}</div>`;
                el.appendChild(row);
            });
        } else {
            // Fallback single strip
            let leds = '';
            for (let i = 0; i < this.previewStrip; i++) leds += `<div class="dob-s-led-h" id="dob-str-0-${i}"></div>`;
            const row = document.createElement('div');
            row.className = 'dob-strip-row';
            row.innerHTML = `<div class="dob-strip-row-label">Default Strip <span>(${this.previewStrip} LEDs)</span></div><div class="dob-strip-body-h">${leds}</div>`;
            el.appendChild(row);
        }
    },

    _toggleStrip(name, checked) {
        this._stripChecked[name] = checked;
        const strips = App.data?.cabinet?.strips;
        if (!strips) return;
        strips.forEach((s, idx) => {
            if (s.name === name) {
                const row = document.getElementById(`dob-strip-row-${idx}`);
                if (row) row.style.display = checked ? '' : 'none';
            }
        });
    },

    _initSparkleState() {
        const total = this.previewCols * this.previewRows;
        // MUST use regular Array — Float32Array has only ~7 digits of precision,
        // Date.now() ≈ 1.74×10^12 → timestamps corrupt after a few seconds.
        this._sparkleState = Array.from({length: this.NUM_LAYERS}, () => new Array(total).fill(-1));
        this._motionT = new Array(this.NUM_LAYERS * 2).fill(0);
    },

    // ── Brightness / Gap / Show-Hide controls ────────────────────────────────
    setMatrixBrightness(val) {
        this._matrixBright = parseFloat(val);
        const mx = document.getElementById('dob-matrix');
        if (mx) mx.style.filter = this._matrixBright === 1 ? '' : `brightness(${this._matrixBright})`;
        const lbl = document.getElementById('dob-mx-bright-val');
        if (lbl) lbl.textContent = this._matrixBright.toFixed(1) + '×';
    },

    setMatrixGap(val) {
        this._matrixGap = parseFloat(val);
        const mx = document.getElementById('dob-matrix');
        if (mx) mx.style.gap = `${this._matrixGap}px`;
        const lbl = document.getElementById('dob-mx-gap-val');
        if (lbl) lbl.textContent = `${this._matrixGap}px`;
    },

    toggleMatrixVis() {
        this._matrixVisible = !this._matrixVisible;
        const vp = document.getElementById('dob-mx-viewport');
        const btn = document.getElementById('dob-mx-toggle');
        if (vp) vp.style.display = this._matrixVisible ? '' : 'none';
        if (btn) btn.textContent = this._matrixVisible ? 'Hide' : 'Show';
    },

    toggleStripVis() {
        this._stripVisible = !this._stripVisible;
        const vp = document.getElementById('dob-st-viewport');
        const btn = document.getElementById('dob-st-toggle');
        if (vp) vp.style.display = this._stripVisible ? '' : 'none';
        if (btn) btn.textContent = this._stripVisible ? 'Hide' : 'Show';
    },

    // ── Shape visibility ─────────────────────────────────────────────────────
    _shapesLoaded() {
        return (typeof App !== 'undefined') && App.data &&
               App.data.shapes && App.data.shapes.size > 0 &&
               App.data.shapeAtlas;
    },

    _updateShapeVisibility() {
        const hint = document.getElementById('dob-shp-hint');
        if (!hint) return;
        const hasAtlas = this._shapesLoaded();
        hint.textContent = hasAtlas
            ? `${App.data.shapes.size} shapes loaded from simulator ✓`
            : 'No shapes file loaded — letters, digits & built-in shapes available';
        // Rebuild dropdown when shapes become available
        if (hasAtlas && this._initialized) this._buildShapeDropdown();
    },

    // ── Dynamic shape dropdown from loaded DirectOutputShapes ─────────────────
    _buildShapeDropdown() {
        const sel = document.getElementById('dob-shp');
        if (!sel) return;
        const curVal = sel.value;
        sel.innerHTML = '<option value="">— None —</option>';

        // Built-in: Letters
        const letGrp = document.createElement('optgroup');
        letGrp.label = 'Letters';
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(c => {
            const o = document.createElement('option');
            o.value = 'SHPLetter' + c; o.textContent = 'SHPLetter' + c;
            letGrp.appendChild(o);
        });
        sel.appendChild(letGrp);

        // Built-in: Digits
        const digGrp = document.createElement('optgroup');
        digGrp.label = 'Digits';
        '0123456789'.split('').forEach(c => {
            const o = document.createElement('option');
            o.value = 'SHPDigit' + c; o.textContent = 'SHPDigit' + c;
            digGrp.appendChild(o);
        });
        sel.appendChild(digGrp);

        // From loaded DirectOutputShapes.xml
        if (this._shapesLoaded()) {
            const staticShapes = [];
            const animShapes = [];
            App.data.shapes.forEach((info, key) => {
                const display = 'SHP' + key.charAt(0).toUpperCase() + key.slice(1);
                if (info.animated) animShapes.push({key, display});
                else staticShapes.push({key, display});
            });

            if (staticShapes.length) {
                const grp = document.createElement('optgroup');
                grp.label = `Static Shapes (${staticShapes.length})`;
                staticShapes.sort((a,b) => a.key.localeCompare(b.key)).forEach(s => {
                    const o = document.createElement('option');
                    o.value = 'SHP' + s.key; o.textContent = s.display;
                    grp.appendChild(o);
                });
                sel.appendChild(grp);
            }
            if (animShapes.length) {
                const grp = document.createElement('optgroup');
                grp.label = `Animated Shapes (${animShapes.length})`;
                animShapes.sort((a,b) => a.key.localeCompare(b.key)).forEach(s => {
                    const o = document.createElement('option');
                    o.value = 'SHP' + s.key; o.textContent = s.display + ' ⟳';
                    grp.appendChild(o);
                });
                sel.appendChild(grp);
            }
        }

        // Restore previous selection if still valid
        const opts = Array.from(sel.options).map(o => o.value);
        sel.value = opts.includes(curVal) ? curVal : '';
    },

    // ── Focus handler: warn if shapes files not loaded ────────────────────────
    _checkShapesOnFocus() {
        if (!this._shapesLoaded()) {
            const hint = document.getElementById('dob-shp-hint');
            if (hint) {
                hint.textContent = '⚠ Load DirectOutputShapes.xml and .png in Simulator to access custom shapes';
                hint.style.color = '#f5a623';
                setTimeout(() => { hint.style.color = ''; }, 4000);
            }
        }
    },

    // ── Clear All for accordion sections (#5) ────────────────────────────────
    clearAccordion(section) {
        const d = this.layers[this.currentLayerIdx];
        const def = this._defaultLayer();
        if (section === 'timing') {
            d.effect = def.effect; d.blink = def.blink; d.bpw = def.bpw;
            d.fu = def.fu; d.fd = def.fd; d.f = def.f;
            d.duration = def.duration; d.wait = def.wait;
            d.mhold = def.mhold; d.maxDur = def.maxDur;
            d.maxInt = def.maxInt; d.zlayer = def.zlayer;
        } else if (section === 'area') {
            d.al = def.al; d.aw = def.aw; d.at = def.at; d.ah = def.ah;
            d.as = def.as; d.dir = def.dir;
            this._resetSparkleLayer(this.currentLayerIdx);
        } else if (section === 'spkl') {
            d.afden = def.afden; d.afmin = def.afmin; d.afmax = def.afmax;
            this._resetSparkleLayer(this.currentLayerIdx);
        } else if (section === 'shp') {
            d.shp = '';
        }
        this.loadLayerToUI(this.currentLayerIdx);
        this._updateZLabels();
        this._updateGenStr();
        this._saveState();
    },

    // ── Color grid ───────────────────────────────────────────────────────────
    _buildColorGrid() {
        const grid = document.getElementById('dob-colorGrid');
        if (!grid || grid.childElementCount > 0) return;
        this.allColors.forEach(c => {
            const d = document.createElement('div');
            d.className = 'dob-swatch';
            d.style.background = c.h;
            d.title = c.n;
            d.onclick = () => this._setColor(c.n, c.h, d);
            grid.appendChild(d);
        });
    },

    _setColor(name, hex, el) {
        const l = this.layers[this.currentLayerIdx];
        l.active = true; l.color = name; l.hex = hex;
        const display = document.getElementById('dob-color-name');
        if (display) { display.textContent = name; display.style.color = hex; }
        document.querySelectorAll('.dob-swatch').forEach(s => s.classList.remove('sel'));
        if (el) el.classList.add('sel');
        this._updateTabIndicators();
        this._updateGenStr();
        this._saveState();
    },

    // ── Section buttons ──────────────────────────────────────────────────────
    _buildSectionBtns() {
        const c = document.getElementById('dob-section-btns');
        if (!c || c.childElementCount > 0) return;
        this.SECTIONS.forEach(s => {
            if (!this.sectionConfigs[s]) this.sectionConfigs[s] = '';
            const b = document.createElement('button');
            b.className = 'dob-sec-btn' + (s === this.activeSection ? ' active' : '');
            b.textContent = s;
            b.onclick = () => {
                document.querySelectorAll('.dob-sec-btn').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                this.activeSection = s;
                this._checkSingleLock();
                this._saveState();
            };
            c.appendChild(b);
        });
    },

    // ── Accordion toggle ─────────────────────────────────────────────────────
    toggleAcc(id) {
        const body = document.getElementById('dob-acc-' + id + '-body');
        const icon = document.getElementById('dob-acc-' + id + '-icon');
        if (!body) return;
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : '';
        if (icon) icon.textContent = open ? '▶' : '▼';
    },

    // ── Slider ↔ Number sync (#4) ────────────────────────────────────────────
    sliderSync(sliderId, numId) {
        const s = document.getElementById(sliderId);
        const n = document.getElementById(numId);
        if (s && n) n.value = s.value;
        this.updateLayer();
    },

    numSync(numId, sliderId) {
        const n = document.getElementById(numId);
        const s = document.getElementById(sliderId);
        if (n && s) {
            let v = parseFloat(n.value) || 0;
            // Clamp to slider range
            v = Math.max(parseFloat(s.min), Math.min(parseFloat(s.max), v));
            s.value = v;
        }
        this.updateLayer();
    },

    // ── Layer management ─────────────────────────────────────────────────────
    switchLayer(idx) {
        this.currentLayerIdx = idx;
        document.querySelectorAll('.dob-ltab').forEach((t, i) => t.classList.toggle('active', i === idx));
        this.loadLayerToUI(idx);
        this._saveState();
    },

    loadLayerToUI(idx) {
        const d = this.layers[idx];
        const g = id => document.getElementById(id);
        if (!g('dob-color-name')) return;

        const cn = g('dob-color-name');
        cn.textContent = d.color || 'None';
        cn.style.color = d.active ? d.hex : '#4a6a80';

        document.querySelectorAll('.dob-swatch').forEach(s =>
            s.classList.toggle('sel', d.active && s.title === d.color));

        // Effect
        this._sv('dob-effect', d.effect);
        // Slider+number pairs
        this._svp('dob-blink', d.blink);
        this._svp('dob-bpw', d.bpw);
        this._svp('dob-fu', d.fu);
        this._svp('dob-fd', d.fd);
        this._svp('dob-f', d.f);
        this._svp('dob-dur', d.duration);
        this._svp('dob-wait', d.wait);
        this._svp('dob-mhold', d.mhold);
        this._svp('dob-maxdur', d.maxDur);
        this._svp('dob-maxint', d.maxInt);
        this._svp('dob-al', d.al);
        this._svp('dob-aw', d.aw);
        this._svp('dob-at', d.at);
        this._svp('dob-ah', d.ah);
        this._svp('dob-as', d.as);
        this._svp('dob-afden', d.afden);
        this._svp('dob-afmin', d.afmin);
        this._svp('dob-afmax', d.afmax);
        this._svp('dob-zlayer', d.zlayer);

        // Motion direction
        document.querySelectorAll('.dob-dir-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.dir === d.dir));

        // Shape — set select dropdown (populated dynamically)
        const sel = document.getElementById('dob-shp');
        if (sel) {
            const opts = Array.from(sel.options).map(o => o.value);
            if (opts.includes(d.shp)) {
                sel.value = d.shp;
            } else if (d.shp) {
                // Shape exists in layer data but not in dropdown — add it temporarily
                const o = document.createElement('option');
                o.value = d.shp; o.textContent = d.shp + ' (custom)';
                sel.appendChild(o);
                sel.value = d.shp;
            } else {
                sel.value = '';
            }
        }

        this._updateEffectHints();
    },

    // Set slider + its companion number box
    _svp(baseId, val) {
        const s = document.getElementById(baseId);
        const n = document.getElementById(baseId + '-n');
        if (s) s.value = val;
        if (n) n.value = val;
    },
    _sv(id, val) { const e = document.getElementById(id); if (e) e.value = val; },

    clearLayer() {
        this.layers[this.currentLayerIdx] = this._defaultLayer();
        this.loadLayerToUI(this.currentLayerIdx);
        this._updateTabIndicators();
        this._updateZLabels();
        this._updateGenStr();
        this._saveState();
    },

    updateLayer() {
        const d = this.layers[this.currentLayerIdx];
        const gv = id => { const e = document.getElementById(id); return e ? e.value : ''; };
        const gi = id => parseInt(gv(id)) || 0;

        d.effect   = gv('dob-effect');
        d.blink    = gi('dob-blink');
        d.bpw      = Math.max(1, Math.min(99, gi('dob-bpw')));
        d.fu       = gi('dob-fu');
        d.fd       = gi('dob-fd');
        d.f        = gi('dob-f');
        d.duration = gi('dob-dur');
        d.wait     = gi('dob-wait');
        d.mhold    = gi('dob-mhold');
        d.maxDur   = gi('dob-maxdur');
        d.maxInt   = Math.max(1, Math.min(255, gi('dob-maxint')));
        d.al       = gi('dob-al'); d.aw = gi('dob-aw');
        d.at       = gi('dob-at'); d.ah = gi('dob-ah');
        d.as       = gi('dob-as');
        d.afden    = gi('dob-afden');
        d.afmin    = gi('dob-afmin');
        d.afmax    = gi('dob-afmax');
        d.zlayer   = gi('dob-zlayer');

        // Reset sparkle state when any spatial or sparkle param changes
        this._resetSparkleLayer(this.currentLayerIdx);

        // Shape: from dropdown only (populated dynamically from loaded shapes)
        d.shp = ((document.getElementById('dob-shp') || {}).value || '').trim();

        // SHP auto-prefix
        if (d.shp && !d.shp.toLowerCase().startsWith('shp')) d.shp = 'SHP' + d.shp;

        this._updateEffectHints();
        this._updateZLabels();
        this._updateGenStr();
        this._saveState();
    },

    setDir(dir) {
        const d = this.layers[this.currentLayerIdx];
        d.dir = d.dir === dir ? '' : dir;
        document.querySelectorAll('.dob-dir-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.dir === d.dir));
        this._updateGenStr();
        this._saveState();
    },

    _updateGenStr() {
        const el = document.getElementById('dob-genstr');
        if (!el) return;
        const str = this.generateString();
        el.textContent = str || '— configure a layer below —';
        el.style.color = str ? '#3aaa3a' : '#2a4a30';
    },

    _updateEffectHints() {
        const d = this.layers[this.currentLayerIdx];
        const eff = d.effect;
        const showBlink = eff === 'Blink';
        const showPulse = eff === 'Pulse' || eff === '';
        this._showRow('dob-row-blink', showBlink);
        this._showRow('dob-row-bpw',   showBlink);
        this._showRow('dob-row-fu',    showPulse);
        this._showRow('dob-row-fd',    showPulse);
        this._showRow('dob-row-f',     eff === '' || eff === 'On');
        this._showRow('dob-row-dur',   (eff !== 'On' && eff !== '') || d.duration > 0);
        this._showRow('dob-row-maxdur', true);
    },

    _showRow(id, show) {
        const e = document.getElementById(id);
        if (e) e.style.display = show ? '' : 'none';
    },

    _updateTabIndicators() {
        document.querySelectorAll('.dob-ltab').forEach((t, i) => {
            const layer = this.layers[i];
            const isActive = !!(layer && layer.active);
            t.classList.toggle('dot', isActive);
            // v13.13.2: Color indicator on layer tab — inserted before Z-label
            let indicator = t.querySelector('.dob-layer-color');
            if (isActive && layer.hex) {
                if (!indicator) {
                    indicator = document.createElement('span');
                    indicator.className = 'dob-layer-color';
                    // Insert before z-label if present, otherwise append
                    const zLabel = t.querySelector('.dob-z-label');
                    if (zLabel) t.insertBefore(indicator, zLabel);
                    else t.appendChild(indicator);
                }
                indicator.style.background = layer.hex;
            } else if (indicator) {
                indicator.remove();
            }
        });
    },

    // ── Z-order labels on layer tabs (#7) — shows Z value + TOP/BOT ─────────
    _updateZLabels() {
        const tabs = document.querySelectorAll('.dob-ltab');
        tabs.forEach(t => {
            const old = t.querySelector('.dob-z-label');
            if (old) old.remove();
        });

        const active = [];
        this.layers.forEach((l, i) => { if (l.active) active.push({idx: i, z: l.zlayer}); });

        // Show Z value on all active layer tabs
        tabs.forEach((t, i) => {
            if (!this.layers[i] || !this.layers[i].active) return;
            const s = document.createElement('span');
            s.className = 'dob-z-label';
            const z = this.layers[i].zlayer;

            if (active.length >= 2) {
                active.sort((a, b) => a.z - b.z);
                const topIdx = active[active.length - 1].idx;
                const botIdx = active[0].idx;
                if (i === topIdx) {
                    s.classList.add('dob-z-top');
                    s.textContent = `Z:${z} TOP`;
                } else if (i === botIdx) {
                    s.classList.add('dob-z-bot');
                    s.textContent = `Z:${z} BOT`;
                } else {
                    s.style.color = '#5a7a90';
                    s.textContent = `Z:${z}`;
                }
            } else {
                s.style.color = '#5a7a90';
                s.textContent = `Z:${z}`;
            }
            t.appendChild(s);
        });
    },

    _checkSingleLock() {
        const single = this.SINGLE_SECTIONS.includes(this.activeSection);
        const area   = document.getElementById('dob-acc-area-body');
        const spkl   = document.getElementById('dob-acc-spkl-body');
        if (area) area.classList.toggle('dob-locked', single);
        if (spkl) spkl.classList.toggle('dob-locked', single);
    },

    // ── Dimension controls ───────────────────────────────────────────────────
    updateDims() {
        const c = parseInt((document.getElementById('dob-dim-cols') || {}).value) || 40;
        const r = parseInt((document.getElementById('dob-dim-rows') || {}).value) || 8;
        const s = parseInt((document.getElementById('dob-dim-strip') || {}).value) || 100;
        this.previewCols  = c;
        this.previewRows  = r;
        this.previewStrip = s;
        this._buildMatrixGrid();
        this._buildStripRack();
        this._initSparkleState();
        // Update labels
        const mxL = document.getElementById('dob-mx-label');
        const stL = document.getElementById('dob-st-label');
        if (mxL) mxL.textContent = `Matrix — ${c} × ${r}`;
        if (stL) stL.textContent = `Strips — ${s} segments`;
    },

    // ── State persistence ────────────────────────────────────────────────────
    _saveState() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                layers        : this.layers,
                sectionConfigs: this.sectionConfigs,
                activeSection : this.activeSection,
                currentLayerIdx: this.currentLayerIdx,
                eCode: (document.getElementById('dob-ecode') || {}).value || ''
            }));
        } catch(e) {}
    },

    _loadState() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return;
            const s = JSON.parse(raw);
            const def = this._defaultLayer();
            if (s.layers) {
                this.layers = s.layers.map(l => Object.assign({}, def, l));
                // Pad to NUM_LAYERS if saved state had fewer
                while (this.layers.length < this.NUM_LAYERS) this.layers.push(this._defaultLayer());
            }
            if (s.sectionConfigs) this.sectionConfigs = s.sectionConfigs;
            if (s.activeSection) {
                this.activeSection = s.activeSection;
                document.querySelectorAll('.dob-sec-btn').forEach(b =>
                    b.classList.toggle('active', b.textContent === this.activeSection));
            }
            if (s.currentLayerIdx !== undefined) this.currentLayerIdx = Math.min(s.currentLayerIdx, this.NUM_LAYERS - 1);
            if (s.eCode) { const e = document.getElementById('dob-ecode'); if (e) e.value = s.eCode; }
            document.querySelectorAll('.dob-ltab').forEach((t, i) =>
                t.classList.toggle('active', i === this.currentLayerIdx));
        } catch(e) {}
    },

    factoryReset() {
        if (!confirm('Clear all DOF Builder data?')) return;
        localStorage.removeItem(this.STORAGE_KEY);
        this.layers = Array.from({length: this.NUM_LAYERS}, () => this._defaultLayer());
        this.sectionConfigs = {};
        this.activeSection = this.SECTIONS[0];
        this.currentLayerIdx = 0;
        this.loadLayerToUI(0);
        this._updateTabIndicators();
        this._updateZLabels();
        this.renderStaging();
    },

    // ── Color utils ──────────────────────────────────────────────────────────
    _hexToRgb(hex) {
        const b = parseInt((hex || '#000000').replace('#', '').padStart(6, '0'), 16);
        return [(b >> 16) & 255, (b >> 8) & 255, b & 255];
    },

    // ─────────────────────────────────────────────────────────────────────────
    // PREVIEW LOOP (DOM-based, matches simulator approach)
    // ─────────────────────────────────────────────────────────────────────────
    startPreviewLoop() {
        if (this.previewAnimationFrame) cancelAnimationFrame(this.previewAnimationFrame);
        let lastT = -1;
        const loop = (ts) => {
            const dt = lastT < 0 ? 0 : (ts - lastT);
            lastT = ts;
            this._renderFrame(dt);
            this.previewAnimationFrame = requestAnimationFrame(loop);
        };
        this.previewAnimationFrame = requestAnimationFrame(loop);
    },

    _renderFrame(dtMs) {
        const now  = Date.now();
        const COLS = this.previewCols, ROWS = this.previewRows;
        const TOTAL = COLS * ROWS;

        // Accumulate pixel colors into buffers — PAINTER'S ALGORITHM
        // Higher Z layers fully overwrite lower ones on overlapping pixels,
        // matching how the simulator's gameLoop paints (each layer sets backgroundColor).
        const mxR = new Uint8ClampedArray(TOTAL);
        const mxG = new Uint8ClampedArray(TOTAL);
        const mxB = new Uint8ClampedArray(TOTAL);

        // Sort layers by Z-order for correct compositing
        const sortedLayers = this.layers
            .map((l, i) => ({layer: l, idx: i}))
            .filter(x => x.layer.active && x.layer.color)
            .sort((a, b) => a.layer.zlayer - b.layer.zlayer);

        // v13.13.21 FIX: Preview always renders with full area/motion/sparkle
        // regardless of active section. isSingle only affects generateString() output
        // and the UI lock on area/sparkle controls, NOT the visual preview.

        sortedLayers.forEach(({layer, idx: lIdx}) => {
            const waitMs = layer.wait || 0;
            const effectPeriod = this._cyclePeriod(layer);
            const totalCycle   = effectPeriod + waitMs;
            const tInCycle     = now % totalCycle;
            if (tInCycle < waitMs) return;
            const tInEffect = tInCycle - waitMs;

            let opacity = this._computeOpacity(layer, tInEffect, effectPeriod);
            if (opacity <= 0) return;

            const scale = (layer.maxInt || 255) / 255;
            const rgb0  = this._hexToRgb(layer.hex);
            const baseR = Math.round(rgb0[0] * scale * opacity);
            const baseG = Math.round(rgb0[1] * scale * opacity);
            const baseB = Math.round(rgb0[2] * scale * opacity);

            let aL = Math.floor(layer.al / 100 * COLS);
            let aW = Math.max(1, Math.floor((layer.al + layer.aw) / 100 * COLS) - aL);
            let aT = Math.floor(layer.at / 100 * ROWS);
            let aH = Math.max(1, Math.floor((layer.at + layer.ah) / 100 * ROWS) - aT);

            const { ox, oy } = this._motionOffset(layer, lIdx, dtMs, COLS, ROWS, false);

            // Generate shape mask if needed
            const shapeMask = layer.shp ? this._getShapeMask(layer, aW, aH, now) : null;

            for (let dy = 0; dy < aH; dy++) {
                for (let dx = 0; dx < aW; dx++) {
                    // Shape mask check
                    if (shapeMask && !shapeMask[dy * aW + dx]) continue;

                    // Sparkle check (#5 fix: runs per-pixel independently)
                    if (layer.afden > 0) {
                        const pidx = (aT + dy) * COLS + (aL + dx);
                        if (!this._sparklePixelOn(lIdx, pidx, layer.afden, layer.afmin, layer.afmax, now)) continue;
                    }

                    const px = ((aL + dx + Math.round(ox)) % COLS + COLS) % COLS;
                    const py = ((aT + dy + Math.round(oy)) % ROWS + ROWS) % ROWS;
                    if (px >= COLS || py >= ROWS) continue;

                    const i = py * COLS + px;
                    // Painter's algorithm: higher Z layers overwrite lower ones
                    mxR[i] = baseR;
                    mxG[i] = baseG;
                    mxB[i] = baseB;
                }
            }
        });

        // Apply to DOM pixels (matrix)
        if (this._matrixVisible) {
            for (let i = 0; i < TOTAL; i++) {
                const el = document.getElementById(`dob-mx-${i}`);
                if (!el) continue;
                if (mxR[i] || mxG[i] || mxB[i]) {
                    el.style.backgroundColor = `rgb(${mxR[i]},${mxG[i]},${mxB[i]})`;
                } else {
                    el.style.backgroundColor = '#111';
                }
            }
        }

        // Apply to strip LEDs — horizontal rows, respect checkboxes
        if (this._stripVisible) {
            const strips = (typeof App !== 'undefined') && App.data?.cabinet?.strips;
            if (strips && strips.length) {
                strips.forEach((s, sIdx) => {
                    if (!this._stripChecked[s.name]) return;
                    for (let i = 0; i < s.leds; i++) {
                        const el = document.getElementById(`dob-str-${sIdx}-${i}`);
                        if (!el) continue;
                        const mxCol = Math.floor(i / s.leds * COLS);
                        if (mxR[mxCol] || mxG[mxCol] || mxB[mxCol]) {
                            el.style.backgroundColor = `rgb(${mxR[mxCol]},${mxG[mxCol]},${mxB[mxCol]})`;
                        } else {
                            el.style.backgroundColor = '#111';
                        }
                    }
                });
            } else {
                for (let i = 0; i < this.previewStrip; i++) {
                    const el = document.getElementById(`dob-str-0-${i}`);
                    if (!el) continue;
                    const mxCol = Math.floor(i / this.previewStrip * COLS);
                    if (mxR[mxCol] || mxG[mxCol] || mxB[mxCol]) {
                        el.style.backgroundColor = `rgb(${mxR[mxCol]},${mxG[mxCol]},${mxB[mxCol]})`;
                    } else {
                        el.style.backgroundColor = '#111';
                    }
                }
            }
        }

        // Update legend
        this._updateLegend();
    },

    _updateLegend() {
        const el = document.getElementById('dob-legend');
        if (!el) return;
        let html = '';
        this.layers.forEach((l, i) => {
            if (!l.active || !l.color) return;
            html += `<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.6rem;color:#5a7a90;">` +
                    `<span style="width:7px;height:7px;border-radius:50%;background:${l.hex};display:inline-block;"></span>` +
                    `L${i+1}: ${l.color} (Z:${l.zlayer})</span>`;
        });
        el.innerHTML = html;
    },

    _cyclePeriod(layer) {
        switch (layer.effect) {
            case 'Blink':   return Math.max(50, layer.blink * 2);
            case 'Pulse':   return Math.max(100, (layer.fu + layer.fd) || 1200);
            case 'Flicker': return 200;
            default:        return Math.max(500, (layer.fu + layer.fd) || (layer.duration > 0 ? layer.duration + 200 : 2000));
        }
    },

    _computeOpacity(layer, tInCycle, cyclePeriod) {
        const eff = layer.effect;

        if (eff === 'Blink') {
            const period = Math.max(50, layer.blink);
            const dutyOn = period * (layer.bpw / 100);
            return (tInCycle % period) < dutyOn ? 1.0 : 0.0;
        }
        if (eff === 'Flicker') return Math.random() > 0.4 ? 1.0 : 0.0;
        if (eff === 'Pulse' || eff === '') {
            const fu = layer.fu || 0, fd = layer.fd || 0, f = layer.f || 0;
            if (fu > 0 || fd > 0) {
                const total = fu + fd;
                if (total === 0) return 1.0;
                const phase = tInCycle % total;
                if (phase < fu) return phase / fu;
                if (fd > 0) return 1.0 - (phase - fu) / fd;
                return 1.0;
            }
            if (f > 0 && tInCycle < f) return tInCycle / f;
            return 1.0;
        }
        return 1.0;
    },

    _motionOffset(layer, lIdx, dtMs, COLS, ROWS, isSingle) {
        if (!layer.as || isSingle) return { ox:0, oy:0 };
        const speedPct = layer.as * 0.1;
        const dtSec    = (dtMs || 16) / 1000;

        let ox = this._motionT[lIdx * 2 + 0] || 0;
        let oy = this._motionT[lIdx * 2 + 1] || 0;

        const dxPct = speedPct * dtSec;
        const dxPx  = dxPct / 100 * COLS;
        const dyPx  = dxPct / 100 * ROWS;

        if (layer.dir === 'ADR') ox = (ox + dxPx) % COLS;
        if (layer.dir === 'ADL') ox = ((ox - dxPx) % COLS + COLS) % COLS;
        if (layer.dir === 'ADD') oy = (oy + dyPx) % ROWS;
        if (layer.dir === 'ADU') oy = ((oy - dyPx) % ROWS + ROWS) % ROWS;

        this._motionT[lIdx * 2 + 0] = ox;
        this._motionT[lIdx * 2 + 1] = oy;
        return { ox, oy };
    },

    // ── Shape mask generation (#3 fix) ───────────────────────────────────────
    _getShapeMask(layer, aW, aH, now) {
        const shpRaw = layer.shp.toLowerCase();
        // Simulator stores shapes WITHOUT the SHP prefix (e.g. "roundandround", not "shproundandround")
        const shpLookup = shpRaw.startsWith('shp') ? shpRaw.slice(3) : shpRaw;
        const mask = new Uint8Array(aW * aH);

        // Atlas shapes — look up stripped name
        if (this._shapesLoaded() && App.data.shapes.has(shpLookup)) {
            return this._getAtlasShapeMask(shpLookup, aW, aH, now);
        }

        // Built-in shapes (use original full name for pattern matching)
        const isLetter = /^shpletter[a-z]$/.test(shpRaw);
        const isDigit  = /^shpdigit[0-9]$/.test(shpRaw);
        const isCircle = shpRaw === 'shpcircle3' || shpRaw === 'shpcircle' || shpRaw === 'shproundpulse';
        const isDiamond= shpRaw === 'shpdiamondboxpulse';
        const isArrow  = /^shparrow(left|right|up|down)$/.test(shpRaw);

        if (isLetter || isDigit) {
            const char = isLetter ? shpRaw.slice(-1).toUpperCase() : shpRaw.slice(-1);
            return this._getTextMask(char, aW, aH);
        }
        if (isCircle) {
            const rx = aW / 2, ry = aH / 2;
            for (let dy = 0; dy < aH; dy++)
                for (let dx = 0; dx < aW; dx++) {
                    const nx = (dx - rx) / rx, ny = (dy - ry) / ry;
                    if (nx*nx + ny*ny <= 1.0) mask[dy * aW + dx] = 1;
                }
            return mask;
        }
        if (isDiamond) {
            const cx = aW / 2, cy = aH / 2;
            for (let dy = 0; dy < aH; dy++)
                for (let dx = 0; dx < aW; dx++)
                    if (Math.abs(dx - cx) / cx + Math.abs(dy - cy) / cy <= 1.0) mask[dy * aW + dx] = 1;
            return mask;
        }
        if (isArrow) {
            const dir = shpRaw.replace('shparrow', '');
            const mx = aW / 2, my = aH / 2;
            for (let dy = 0; dy < aH; dy++)
                for (let dx = 0; dx < aW; dx++) {
                    const nx = (dx - mx) / mx, ny = (dy - my) / my;
                    let draw = false;
                    if (dir === 'right') draw = nx > 0 && Math.abs(ny) < (1 - nx);
                    if (dir === 'left')  draw = nx < 0 && Math.abs(ny) < (1 + nx);
                    if (dir === 'up')    draw = ny < 0 && Math.abs(nx) < (1 + ny);
                    if (dir === 'down')  draw = ny > 0 && Math.abs(nx) < (1 - ny);
                    if (draw) mask[dy * aW + dx] = 1;
                }
            return mask;
        }

        // Animated sweeps
        if (shpRaw === 'shpfillleftright' || shpRaw === 'shpupdown') {
            const sweepPos = ((Date.now() % 2000) / 2000) * aW;
            const bw = Math.max(1, Math.round(aW * 0.15));
            for (let dy = 0; dy < aH; dy++)
                for (let dx = Math.floor(sweepPos); dx < sweepPos + bw && dx < aW; dx++)
                    mask[dy * aW + dx] = 1;
            return mask;
        }
        if (shpRaw === 'shpfilltopbottom') {
            const sweepPos = ((Date.now() % 2000) / 2000) * aH;
            const bh = Math.max(1, Math.round(aH * 0.15));
            for (let dy = Math.floor(sweepPos); dy < sweepPos + bh && dy < aH; dy++)
                for (let dx = 0; dx < aW; dx++)
                    mask[dy * aW + dx] = 1;
            return mask;
        }

        // Unknown shape — outlined rectangle
        for (let dx = 0; dx < aW; dx++) { mask[dx] = 1; mask[(aH-1)*aW + dx] = 1; }
        for (let dy = 0; dy < aH; dy++) { mask[dy*aW] = 1; mask[dy*aW + aW-1] = 1; }
        return mask;
    },

    _getAtlasShapeMask(shpName, aW, aH, now) {
        const s = App.data.shapes.get(shpName);
        if (!s || !App.data.shapeAtlas) return new Uint8Array(aW * aH).fill(1);

        const tmpCvs = document.createElement('canvas');
        tmpCvs.width = Math.max(1, aW);
        tmpCvs.height = Math.max(1, aH);
        const tmpCtx = tmpCvs.getContext('2d');
        tmpCtx.imageSmoothingEnabled = false;

        let srcX = s.x, srcY = s.y;
        if (s.animated && s.frameCount > 1 && s.frameDur > 0) {
            const frame = Math.floor((now % (s.frameCount * s.frameDur)) / s.frameDur);
            if (s.stepDir === 'Down') srcY = s.y + frame * Math.abs(s.stepSize);
            else                      srcX = s.x + frame * Math.abs(s.stepSize);
        }
        tmpCtx.drawImage(App.data.shapeAtlas.canvas, srcX, srcY, s.w, s.h, 0, 0, aW, aH);

        const pixels = tmpCtx.getImageData(0, 0, aW, aH);
        const mask = new Uint8Array(aW * aH);
        for (let i = 0; i < aW * aH; i++) {
            const pi = i * 4;
            if ((pixels.data[pi] + pixels.data[pi+1] + pixels.data[pi+2]) >= 20) mask[i] = 1;
        }
        return mask;
    },

    _getTextMask(char, aW, aH) {
        const tmpCvs = document.createElement('canvas');
        tmpCvs.width = Math.max(1, aW);
        tmpCvs.height = Math.max(1, aH);
        const tmpCtx = tmpCvs.getContext('2d');
        tmpCtx.fillStyle = '#fff';
        tmpCtx.font = `bold ${Math.round(aH * 1.1)}px monospace`;
        tmpCtx.textAlign = 'center';
        tmpCtx.textBaseline = 'middle';
        tmpCtx.fillText(char, aW / 2, aH / 2);
        const pixels = tmpCtx.getImageData(0, 0, aW, aH);
        const mask = new Uint8Array(aW * aH);
        for (let i = 0; i < aW * aH; i++) {
            if (pixels.data[i * 4 + 3] > 40) mask[i] = 1;
        }
        return mask;
    },

    // ── Sparkle (#5 fix + Bug 2+8 fix) ─────────────────────────────────────
    _sparklePixelOn(lIdx, pidx, afden, afmin, afmax, now) {
        if (lIdx >= this._sparkleState.length || !this._sparkleState[lIdx]) return true;
        const st = this._sparkleState[lIdx];
        if (pidx >= st.length) return true;
        const val = st[pidx];

        // Positive = ON until this timestamp
        if (val > 0 && now < val) return true;
        // Negative = OFF until abs(this timestamp)
        if (val < 0 && now < -val) return false;

        // Timer expired or uninitialized — re-roll
        if (Math.random() * 100 < afden) {
            // Turn ON for [afmin, afmax] ms
            st[pidx] = now + afmin + Math.random() * (afmax - afmin);
            return true;
        } else {
            // Stay OFF for a brief random period inversely proportional to density
            const offDur = 20 + Math.random() * Math.max(50, 200 - afden * 2);
            st[pidx] = -(now + offDur);
            return false;
        }
    },

    // Reset sparkle state for a single layer (called on area/param changes)
    _resetSparkleLayer(lIdx) {
        if (lIdx >= 0 && lIdx < this._sparkleState.length) {
            const total = this.previewCols * this.previewRows;
            this._sparkleState[lIdx] = new Array(total).fill(-1);
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // DOF STRING GENERATION
    // ─────────────────────────────────────────────────────────────────────────
    generateString() {
        const isSingle = this.SINGLE_SECTIONS.includes(this.activeSection);
        const parts = [];

        this.layers.forEach(l => {
            if (!l.active || !l.color) return;
            const seg = [];
            seg.push(l.color);

            if (l.effect === 'On') seg.push('On');
            else if (l.effect === 'Blink') {
                seg.push('Blink');
                seg.push(l.blink);
                if (l.bpw !== 50) seg.push('BPW' + l.bpw);
            }
            else if (l.effect === 'Pulse') { /* uses FU/FD only */ }
            else if (l.effect === 'Flicker') {
                seg.push('Blink');
                seg.push(Math.min(l.blink, 80));
                seg.push('BPW30');
            }

            // F (simple fade-in): only for Static and On
            if ((l.effect === '' || l.effect === 'On') && l.f > 0) seg.push('F' + l.f);
            // FU/FD (fade up/down): only for Static and Pulse
            if ((l.effect === '' || l.effect === 'Pulse') && l.fu > 0) seg.push('FU' + l.fu);
            if ((l.effect === '' || l.effect === 'Pulse') && l.fd > 0) seg.push('FD' + l.fd);
            if (l.duration > 0) seg.push(l.duration);
            if (l.wait > 0) seg.push('W' + l.wait);
            if (l.mhold > 0) seg.push('M' + l.mhold);
            if (l.maxDur > 0) seg.push('MAX' + l.maxDur);
            if (l.maxInt > 0 && l.maxInt < 255) seg.push('Max' + l.maxInt);

            if (!isSingle) {
                if (l.al !== 0)   seg.push('AL' + l.al);
                if (l.aw !== 100) seg.push('AW' + l.aw);
                if (l.at !== 0)   seg.push('AT' + l.at);
                if (l.ah !== 100) seg.push('AH' + l.ah);
            }

            if (l.as > 0) {
                if (l.dir) seg.push(l.dir);
                seg.push('AS' + l.as);
            }

            if (!isSingle && l.afden > 0) {
                seg.push('AFDEN' + l.afden);
                if (l.afmin !== 50)  seg.push('AFMIN' + l.afmin);
                if (l.afmax !== 150) seg.push('AFMAX' + l.afmax);
            }

            if (l.shp) {
                const shp = l.shp.startsWith('SHP') ? l.shp : 'SHP' + l.shp;
                seg.push(shp);
            }

            if (l.zlayer !== 0) seg.push('L' + l.zlayer);

            parts.push(seg.join(' '));
        });

        return parts.join(' / ');
    },

    applyToSection() {
        const eCode = ((document.getElementById('dob-ecode') || {}).value || '').trim();
        // #11: E code required for Apply
        if (!eCode) { alert('Please enter an E Code to apply layers to a section.'); return; }
        const str = this.generateString();
        if (!str) { alert('No active layers configured.'); return; }

        const isMX = /MX/i.test(this.activeSection);

        if (isMX) {
            // MX sections: full DOF string with E code prepended to each segment
            const segments = str.split(' / ');
            this.sectionConfigs[this.activeSection] = segments.map(s => eCode + ' ' + s).join(' / ');
        } else {
            // RGB-only sections: E code + single color only, no effects/timing
            const colors = [];
            this.layers.forEach(l => {
                if (l.active && l.color) {
                    const c = l.color.trim();
                    if (c && !colors.includes(c)) colors.push(c);
                }
            });
            if (colors.length > 1) {
                alert('⚠ RGB-only toys can display only one color.\n\n' +
                      'Multiple colors detected: ' + colors.join(', ') + '\n\n' +
                      'Only the first color (' + colors[0] + ') will be applied.\n' +
                      'Remove extra layers or match all layer colors for this section.');
            }
            this.sectionConfigs[this.activeSection] = colors.length ? eCode + ' ' + colors[0] : '';
        }

        this._saveState();
        this.renderStaging();
    },

    renderStaging() {
        const tbody = document.getElementById('dob-staging-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.SECTIONS.forEach(s => {
            const val = this.sectionConfigs[s] || '';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="dob-stg-s">${s}</td>
                            <td class="dob-stg-c" style="color:${val?'#f5a623':'#344'}">${val||'—'}</td>`;
            tbody.appendChild(tr);
        });
    },

    generateCSV() {
        const eCode = ((document.getElementById('dob-ecode') || {}).value || '').trim();
        // #11: E code required for CSV
        if (!eCode) { alert('E Code required for CSV generation.'); return; }

        let csv = 'E Code,' + this.SECTIONS.join(',') + '\n';
        const row = [eCode];
        this.SECTIONS.forEach(s => row.push('"' + (this.sectionConfigs[s] || '') + '"'));
        csv += row.join(',');

        const out = document.getElementById('dob-output');
        if (out) { out.value = csv; out.select(); }
    },

    clearSession() {
        if (!confirm('Clear all staged section data?')) return;
        this.SECTIONS.forEach(s => this.sectionConfigs[s] = '');
        this._saveState();
        this.renderStaging();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SEND TO CODE SIM (#11: no E code enforcement)
    // ─────────────────────────────────────────────────────────────────────────
    sendToCodeSim() {
        const str = this.generateString();
        if (!str) { alert('No active layers to send.'); return; }
        this.toggle(); // switch to simulator
        setTimeout(() => {
            const input = document.getElementById('code-sim-input');
            const panel = document.getElementById('code-sim-panel');
            if (panel && panel.style.display === 'none') App.toggleCodeSim();
            if (input) { input.value = str; input.focus(); }
        }, 80);
    },
};
