# WME Road Name Helper NP

## Description

WME Road Name Helper NP is a powerful Tampermonkey/Greasemonkey userscript for the Waze Map Editor (WME). It assists editors by checking road name suffixes and common preceding words against standard abbreviations, providing real-time feedback and automated fixing capabilities.

This script improves data consistency and accuracy in Waze map data by:
- Guiding users to use official or community-agreed-upon abbreviations
- Automatically scanning on-screen segments for naming issues
- Providing one-click fixes for road name problems
- Visualizing segments with issues on the map

---

## Features

### 🎯 Real-Time Naming Analysis
- **Real-time Suffix Analysis:** As you type a road name, the script analyzes the last word (potential suffix)
    - Validates if the typed suffix is an approved abbreviation (e.g., "Rd" for "Road")
    - Validates if the typed suffix is a known word that should not be abbreviated (e.g., "Lane")
    - Suggests correct abbreviations if a full word is typed (e.g., "Street" -> "St")
    - Suggests completions for partially typed abbreviations or full words (e.g., "Str" -> "St", "Ave" -> "Av")
- **General Word Abbreviation:** Checks words *before* the suffix for common abbreviations
    - Suggests abbreviations for common words (e.g., "Mount" -> "Mt", "Saint" -> "St")
    - Validates existing abbreviations for these words
- **Title Case Normalization:** Suggests proper title casing for the entire road name
- **Tab Key Support:** Press Tab to instantly accept a suggestion

### 🛣️ Highway Support
- **Highway Suggestions:** Highway codes (e.g. `NH01 - रारा०१`) are suggested when you type the exact code (like `NH01-`)
- **Auto-Capitalization:** Highway codes like `nh01` are automatically capitalized to `NH01`
- **Devanagari Support:** Full support for Nepali highway numbering (रारा०१ through रारा८०)

### 🔍 Automated Scanning
- **Sidebar Panel:** Dedicated "RNH" (Road Name Helper) tab in the WME sidebar
- **Auto-Scan on Pan:** Automatically scans on-screen segments as you navigate the map
- **Smart Detection:** Identifies issues with primary and alternate street names
- **Permission Aware:** Only scans segments you have permission to edit
- **Performance Optimized:** Debounced scanning with progress tracking

### ⚡ One-Click Fixes
- **Fix Individual Segments:** Click "Fix" button on any segment to update its names
- **Fix All:** Apply corrections to all segments with issues at once
- **City Preservation:** Updates street names while maintaining existing city context
- **Granular Updates:** Only modifies changed fields, preserving unchanged alternate names
- **Smart Updates:** Uses WME SDK's official `updateAddress()` method for reliable changes

### 🗺️ Visual Preview
- **Preview Mode:** Enable preview checkbox to highlight all segments with issues on the map (yellow overlay)
- **Hover Highlighting:** Hover over a segment ID in the list to highlight it individually
- **Clickable Segments:** Click segment IDs to:
  - Select the segment in WME editor
  - Center and zoom the map to that segment's location
  - Automatically highlight it for easy identification
- **Custom Layer:** Uses a dedicated map layer "WME Road Name Helper NP" with configurable styling

### 📊 Smart UI
- **Integrated Feedback:** Displays feedback directly below the street name input field in the address edit card
- **Color-Coded Status:**
    - **Green (Valid):** The current input is standard
    - **Yellow (Check):** A suggestion is available. Click to apply the suggestion
    - **Blue (Info):** General information or no specific rule matched
- **Progress Tracking:** Visual progress bar and segment counters during scans
- **Results List:** Clear display of all segments with issues, showing:
  - Segment ID (clickable)
  - Road type
  - Current vs. suggested names for primary and alternate streets
  - Individual fix buttons

### 🧠 Smart Handling
- **Prefix/Middle/Suffix Correction:** Suggests corrections for abbreviations anywhere in the name (e.g. `Mount Everest Road` → `Mt Everest Rd`)
- **"The X" Name Handling:** Recognizes "The [Name]" patterns (e.g., "The Esplanade") and advises against abbreviating them
- **First Word Capitalization:** Automatically capitalizes the first word in the road name
- **Error Handling:** Comprehensive error handling with informative console logging

---

## Installation

1. Ensure you have a userscript manager extension installed in your browser:
   - **Tampermonkey** (recommended) for Chrome/Edge/Firefox/Safari
   - **Greasemonkey** for Firefox
   - **Violentmonkey** for various browsers

2. Install the script from Greasy Fork:
   - Visit: https://greasyfork.org/en/scripts/538171-wme-road-name-helper-np
   - Click the "Install this script" button
   - Your userscript manager will prompt you to confirm the installation

3. The script will automatically run when you visit the Waze Map Editor

---

## Usage

### Real-Time Editing
1. Select any segment in WME
2. Start typing in the street name field
3. The script will provide instant feedback below the input field
4. Click the suggestion or press Tab to apply it

### Bulk Scanning & Fixing
1. Open the WME sidebar and click the "RNH" tab
2. Pan/zoom the map to your area of interest
3. The script automatically scans visible segments
4. Review the list of segments with issues
5. Options to fix:
   - **Individual Fix:** Click "Fix" button on any segment
   - **Fix All:** Click "Fix All Names" button at the top
6. Enable "Preview" to visualize all problematic segments on the map

### Preview & Navigation
1. Check the "Preview" checkbox to highlight all segments with issues
2. Hover over any segment ID in the list to temporarily highlight it
3. Click a segment ID to:
   - Jump to that segment on the map
   - Select it in the editor
   - See it highlighted

---

## Examples

### Real-Time Suggestions
- Typing `nh01-` → suggests `NH01 - रारा०१`
- Typing `mount everest road` → suggests `Mt Everest Rd`
- Typing `yogikuti marg lane` → suggests `Yogikuti Marga Lane`
- Typing `rara 41` → suggests `रारा४१`

### Bulk Fixing
- Scan shows: `Buddha Road` → `Buddha Rd`
- Scan shows: `NH41 - रा४१` → `NH41 - रारा४१`
- Alt name: `Mount Annapurna Street` → `Mt Annapurna St`

---

## Technical Details

### WME SDK Integration
The script uses the official Waze Map Editor SDK for all interactions:
- `sdk.DataModel.Segments` - Segment queries and permissions
- `sdk.DataModel.Streets` - Street name management and city lookups
- `sdk.Map` - Map layers, highlighting, centering, and zoom
- `sdk.Editing` - Segment selection
- `sdk.Events` - Event handling for map movements and edits
- `sdk.Sidebar` - Custom sidebar tab registration

### Update Strategy
When fixing segment names, the script:
1. Looks up the current city ID from the existing street
2. Searches for or creates the corrected street name within the same city
3. Constructs an update containing only changed fields:
   - `primaryStreetId` (if primary street changed)
   - `alternateStreetIds` (sparse array with only modified entries)
4. Applies changes via `sdk.DataModel.Segments.updateAddress()`

This approach ensures:
- City names are never overwritten
- Unchanged alternate names are not touched
- All changes are properly tracked in WME history

---

## Version History

### v2025.12.02.02 (Latest)
- ✨ Added Preview mode with map highlighting
- ✨ Added hover highlighting for individual segments
- ✨ Added clickable segment IDs for navigation
- 🐛 Fixed "Fix" button to correctly update street names using WME SDK
- 🐛 Fixed city name preservation during updates
- 🐛 Fixed granular updates to avoid touching unchanged fields
- 🐛 Fixed segment selection crashes
- 🔧 Migrated to official WME SDK for all operations
- 🔧 Enhanced coordinate validation and error handling

### v2025.12.02.01
- Added sidebar panel for scanning and fixing
- Automatic scanning on map pan
- One-click fix for segments
- Extended Devanagari support (रारा०१ through रारा८०)

See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

## Credits

Based on the original "WME Standard Suffix Abbreviations" script by Brandon28AU.  
This version includes major enhancements for:
- General word abbreviations
- Automated scanning and fixing
- WME SDK integration
- Visual preview and navigation
- Nepal-specific highway naming

---

## Support

- **Script Page:** https://greasyfork.org/en/scripts/538171-wme-road-name-helper-np
- **Feedback:** https://greasyfork.org/en/scripts/538171-wme-road-name-helper-np/feedback
- **Issues:** Please report bugs or feature requests via the feedback page

---

## License

MIT License - See LICENSE file for details
