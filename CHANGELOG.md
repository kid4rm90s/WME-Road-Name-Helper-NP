# Changelog - WME Road Name Helper NP

## Version 2025.12.02.03 (December 2, 2025)

### 🐛 Bug Fixes
- **Fixed layer z-index conflict**: Changed highlight layer z-index from `roads - 2` to `roads - 3` to prevent conflict with WME Segment City Tool which also uses `roads - 2`
- **Fixed highlight layer drift**: Added watchdog interval that checks every 100ms to ensure the layer z-index stays at the correct position and doesn't drift above the roads layer

### 🎨 Visual Changes
- **Changed highlight color**: Updated from yellow (`#ff0`) to orange (`#ff8800`) for better visual distinction from other scripts
- **Increased stroke width**: Changed from 30 to 35 pixels for improved visibility and differentiation

### 🔧 Improvements
- **Layer stability**: Implemented continuous z-index monitoring to prevent layer positioning issues over time
- **Multi-script compatibility**: Better coexistence with other WME scripts that use map overlays

---

## Version 2025.12.02.02 (December 2, 2025)

### 🐛 Bug Fixes
- **Fixed "Fix" button not updating street names**: Refactored `fixSegmentNames()` to use the official WME SDK `updateAddress()` method with proper street ID handling instead of direct name updates
- **Fixed city overwrite issue**: Street names are now updated while preserving the existing city context. The script looks up the current city ID and creates/finds the new street name within that same city
- **Fixed excessive updates**: Implemented granular update logic that only modifies changed fields. Previously, all alternate street names were being "touched" even if unchanged
- **Fixed segment selection crash**: Resolved `ValidationError: Invalid arguments: lonLat must be defined` error when clicking segment IDs
- **Fixed coordinate type conversion**: Added proper number conversion for geometry coordinates that were stored as strings

### ✨ New Features
- **Preview Mode**: Added a "Preview" checkbox that displays a yellow highlight overlay on the map for all segments with naming issues
- **Interactive Hover Highlighting**: Hovering over a segment ID in the results list now highlights that specific segment on the map, independent of the global preview setting
- **Clickable Segment IDs**: Click any segment ID in the results list to:
  - Select the segment in the WME editor
  - Center and zoom the map to that segment's location
  - Automatically highlight it for easy identification

### 🔧 Improvements
- **WME SDK Migration**: Fully migrated to the official WME SDK for all map and data model interactions
  - `sdk.DataModel.Segments` for segment queries
  - `sdk.DataModel.Streets` for street management
  - `sdk.Map` for map layers, highlighting, and navigation
  - `sdk.Editing.setSelection` for segment selection
- **Better Coordinate Validation**: Enhanced coordinate validation logic for LineString geometries to prevent map centering errors
- **Error Handling**: Improved error messages and logging for debugging street name updates and map interactions

### 🎨 UI Enhancements
- Added custom map layer "WME Road Name Helper NP" with configurable styling (yellow stroke, 30px width, 60% opacity)
- Visual feedback when hovering over segment entries in the sidebar
- Smooth map transitions when selecting segments

### 📝 Technical Details
- `updateAddress()` now constructs a precise `updateParams` object containing:
  - Only the `primaryStreetId` if the primary street changed
  - A sparse `alternateStreetIds` array with only modified entries
- Street lookup/creation preserves city context by:
  1. Getting the city ID from the current street
  2. Using `sdk.DataModel.Streets.getStreet()` to find existing streets
  3. Creating new streets with `sdk.DataModel.Streets.addStreet()` in the same city
- Map highlighting uses GeoJSON LineString features with custom styling
- Coordinate conversion handles both number and string geometry formats

---

## Version 2025.12.02.01 (Initial Release)

### Initial Features
- Sidebar panel for scanning road names
- Automatic scan when panning the map
- Detection of suffix abbreviation issues
- Detection of common word abbreviation issues  
- List view of segments with naming problems
- Basic "Fix All" functionality
