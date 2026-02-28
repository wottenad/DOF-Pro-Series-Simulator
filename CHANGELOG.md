# DOF Pro-Series Simulator — Version Changelog

## v1.11 
- FIX: Removed strict filename matching for DirectOutputConfig30.ini, DirectOutputConfig.ini and DirectOutputConfig2.ini files
- Retained extension matching
  
## v1.1 (Initial Release)
- FIX: Code Sim Loop — permanent (untimed) effects no longer block loop cycle detection
- Only timed effects (dur/maxDur/fu/fd) count for "all expired" re-fire check

## v13.13.23
- FIX: Code Sim color fills — plain fills without SHP/AH/AW now push directly to matrixEffects
- FIX: Section buttons — flex: 1 1 0 to fill full width above matrix display
- Font size bumped to 0.55rem for readability

## v13.13.22
- FIX: Strip 1px mode — single CSS rule, keeps columns/titles/layout intact
- Version bump to bust server cache from v13.13.21

## v13.13.21
- ADD: Custom MX 1 as first entry in SECTIONS (13 total)
- ADD: MX vs RGB-only apply logic in applyToSection()
- ADD: RGB-only sections strip to E code + color only, warn on multiple colors
- ADD: RGB Undercab Smart added to SINGLE_SECTIONS
- ADD: Layer tab color indicators (3px × 22px colored bar per active layer)
- FIX: Builder preview no longer affected by isSingle — always renders full effect
- FIX: Section buttons scaled with flex to fit one row
- CSS: Strip 1px mode — narrow LED bar centered, titles retained

## v13.13.2
- ADD: Strip title bottom margin (6px)
- FIX: DOF String populated from localStorage on Builder reload
- CHANGE: Placeholder text "configure a layer below" (was "above")
- ADD: _updateGenStr() called in _doInit() after _loadState()

## v13.13.1
- ADD: Shape file warning toast — warns when table uses SHP but XML/PNG missing
- Function: _checkShapeFilesNeeded() scans substituted code for SHP patterns

## v13.13.0
- REMOVE: Builder theme selector (Builder keeps fixed amber/navy)
- ADD: Blueprint theme (default), removed Nord theme
- MOVE: Theme selector to right side of header
- ADD: Code Sim Loop feature (⟳ button, auto-replay on effect expiry)
- FIX: Config panel height — hides Table View/Anim Sim when config expands
- FIX: Corner radius on floating panels
- ADD: Code Sim hidden when switching to Builder view
- REMOVE: IndexedDB session cache (reverted — unreliable)

## v13.12.0
- ADD: Strip 1px toggle mode
- ADD: Dynamic section building from Config30 headers (later reverted in v13.13.21)

## Pre-v13.12.0 (Simulator Core)
- Complete LED matrix rendering with shapes, color fills, sparkle
- Strip rendering with 5-strip cabinet support
- RGB toy panel with dynamic toy indicators
- Physical toy panel with checkbox activation
- Code Sim with M/L buttons and multi-target output
- Animation Simulator with GIF decoding, PUP database, spreadsheet grid
- Trigger system with inspector
- Code Monitor (editable, real-time)
- Output mapping persistence
- 137 DOF named colors
- Complete DOF effect parameter parsing (AT/AH/AW/AL/AS/AD/FU/FD/F/Blink/BPW/M/Max/W/L/AFDEN/AFMIN/AFMAX/SHP)
