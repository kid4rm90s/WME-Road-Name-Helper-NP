// ==UserScript==
// @name            WME Road Name Helper NP Beta
// @description     Check suffix and common word abbreviations without leaving WME
// @version         2026.06.13.03
// @author          Kid4rm90s
// @license         MIT
// @match           *://*.waze.com/*editor*
// @exclude         *://*.waze.com/user/editor*
// @connect         greasyfork.org
// @grant           GM_xmlhttpRequest
// @grant           GM_addStyle
// @connect         translate.googleapis.com
// @connect         raw.githubusercontent.com
// @connect         docs.google.com
// @namespace       https://greasyfork.org/users/1087400
// @require         https://greasyfork.org/scripts/560385/code/WazeToastr.js
// @downloadURL     https://raw.githubusercontent.com/kid4rm90s/WME-Road-Name-Helper-NP/Beta/WME-Road-Name-Helper-NP-Beta.user.js
// @updateURL       https://raw.githubusercontent.com/kid4rm90s/WME-Road-Name-Helper-NP/Beta/WME-Road-Name-Helper-NP-Beta.user.js

// ==/UserScript==
/*Script is forked from WME Standard Suffix Abbreviations (https://greasyfork.org/en/scripts/493429-wme-standard-suffix-abbreviations) with the approval of the original author brandon28au */

(function () {
  ('use strict');
  const updateMessage = `
Version 2026.06.01.01:
<strong>New Features & Fixes:</strong><br>
- Fix for East-West and North-South hyphenated words to be properly title-cased (e.g., "East-west" → "East-West").<br>
- Temporary disablement of "Road" to "Rd" abbreviation due to common usage of "Road" in Nepal and potential confusion with "Rd" abbreviation.<br>
- Various bug fixes and improvements.<br>
`;
  const scriptVersion = GM_info.script.version.toString();
  const scriptName = GM_info.script.name;
												  
  const downloadUrl = 'https://raw.githubusercontent.com/kid4rm90s/WME-Road-Name-Helper-NP/Beta/WME-Road-Name-Helper-NP-Beta.user.js';
  const forumURL = 'https://github.com/kid4rm90s/WME-Road-Name-Helper-NP/issues';
  const SCRIPT_ID = 'wme-road-name-helper-np-beta';
  const SPREADSHEET_ID = '1v5oktSBohAGIc_yAs2XBT2xK8oZ9FFR9tT5rT_hL_C8';
  const SHEET_CACHE_KEY_PREFIX = 'wme-rnh-data-';
  // const SHEET_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  const SHEET_CACHE_TTL_MS = 0; // Fetch fresh on every page load (for testing)
  const SCAN_DEBOUNCE_DELAY = 200; // 200ms delay after map movement stops
  const PROGRESS_UPDATE_THROTTLE = 10; // Update progress every N segments
  const RESCAN_DELAY_AFTER_FIX = 300; // Delay before rescanning after fix
  const MAX_SEGMENTS_TO_DISPLAY = 100; // Limit displayed segments for performance
  const LAYER_NAME = `${scriptName}`; // Layer name for highlighting

  // Nepali translation special rules (pre-translation, applied before Google Translate)
  const NEPALI_TRANSLATION_RULES = [
    { regex: /\bRing\s*(Rd|Road)\b/gi, replace: 'चक्रपथ' },      // Ring Rd/Ring Road → चक्रपथ
    { regex: /\b(Rd|Road)\b/gi, replace: 'सडक' },                  // Rd/Road → सडक
    { regex: /\b(Marg|Marga)\b/gi, replace: 'मार्ग' }               // Marg/Marga → मार्ग
    // Add more rules here: { regex: /pattern/gi, replace: 'replacement' }
  ];

  let sdk;
  let activeCountryCode = 'NP';
  // Button label synced from GoogleTranslate sheet during loadCountryData()
  // Initialized to placeholder; will be populated from sheet Column D before UI is created
  let translateBtnLabel = '...';
  let currentMapExtent = null;
  let scanTimeout;
  let scannedSegments = [];
  let isScanning = false;
  let eventSubscriptions = [];
  let previewEnabled = localStorage.getItem('wme-rnh-preview-enabled') === 'true';

  // Cached UI elements
  const cachedElements = {
    scanCounter: null,
    fixAllButton: null,
    resultsContainer: null,
    progressBar: null,
    spinner: null,
  };

  // Suffix Abbreviation Data — loaded dynamically from Google Sheets
  let wmernh_approvedAbbr = {};

  // Suffix Suggestion Data — loaded dynamically from Google Sheets
  let wmernh_suggestedAbbr = {};

  // Preserve Case Words — loaded dynamically from Google Sheets
  let wmernh_preserveCaseWords = [];

  // Highway Exact Match Data — loaded dynamically from Google Sheets
  let wmernh_suggestedHwyAbbr = {};

  // Suffixes with No Standard Abbreviation — loaded dynamically from Google Sheets
  let wmernh_knownNoAbbr = [];

  // General Word Suggestion Data — loaded dynamically from Google Sheets
  let wmernh_generalWordSuggestions = {};

  // General Word Approved Abbreviation Data — loaded dynamically from Google Sheets
  let wmernh_generalWordApprovedAbbr = {};

  // Translation Settings — loaded from GoogleTranslate sheet
  let translationActive = false; // Only show/do translation if Active=TRUE in sheet
  let translationTargetLanguage = 'ne'; // Nepali by default
  let translationSourceLanguage = 'auto'; // Auto-detect by default
  let translationSpecialRules = []; // Array of { regex, replace } rules (pre-translation)
  let translationPostRules = []; // Array of { regex, replace } rules (post-translation corrections)
  let translationButtonLabel = 'ने.'; // Default button label

  // ========== GOOGLE SHEETS DATA LOADING ==========

  /**
   * Parse the gviz JSON response from Google Sheets.
   * Strips the /*O_o* / wrapper and returns the rows array.
   * Each row is an array of cell values (string | boolean | null).
   */
  function parseGvizJson(responseText) {
    // Strip the JSONP wrapper: /*O_o*/google.visualization.Query.setResponse({...});
    const match = responseText.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
    if (!match) throw new Error('[WMERNH] Could not parse gviz response');
    const parsed = JSON.parse(match[1]);
    const rows = parsed.table.rows || [];
    return rows.map((row) => row.c.map((cell) => (cell ? cell.v : null)));
  }

  /**
   * Build all 7 data objects from a flat rows array.
   * Row format: [DataType, Key, Value, Disabled, Notes]
   * Rows with Disabled=true or null Key are skipped.
   */
  function buildDataObjects(rows) {
    const approvedAbbr = {};
    const suggestedAbbr = {};
    const preserveCaseWords = [];
    const suggestedHwyAbbr = {};
    const knownNoAbbr = [];
    const generalWordSuggestions = {};
    const generalWordApprovedAbbr = {};

    for (const row of rows) {
      const [dataType, key, value, disabled] = row;
      if (!dataType || !key || disabled === true) continue;

      switch (dataType) {
        case 'approvedAbbr':
          if (value) approvedAbbr[key] = value;
          break;
        case 'suggestedAbbr':
          if (value) suggestedAbbr[key] = value;
          break;
        case 'preserveCase':
          preserveCaseWords.push(key);
          break;
        case 'hwy_exact':
          if (value) suggestedHwyAbbr[key] = value;
          break;
        case 'no_abbr':
          knownNoAbbr.push(key);
          break;
        case 'general_suggestion':
          if (value) generalWordSuggestions[key] = value;
          break;
        case 'general_approved':
          if (value) generalWordApprovedAbbr[key] = value;
          break;
      }
    }

    wmernh_approvedAbbr = approvedAbbr;
    wmernh_suggestedAbbr = suggestedAbbr;
    wmernh_preserveCaseWords = preserveCaseWords;
    wmernh_suggestedHwyAbbr = suggestedHwyAbbr;
    wmernh_knownNoAbbr = knownNoAbbr;
    wmernh_generalWordSuggestions = generalWordSuggestions;
    wmernh_generalWordApprovedAbbr = generalWordApprovedAbbr;

    console.log(`[WMERNH] Data loaded: approvedAbbr=${Object.keys(approvedAbbr).length}, suggestedAbbr=${Object.keys(suggestedAbbr).length}, preserveCase=${preserveCaseWords.length}, hwyExact=${Object.keys(suggestedHwyAbbr).length}, noAbbr=${knownNoAbbr.length}, generalSugg=${Object.keys(generalWordSuggestions).length}, generalAppr=${Object.keys(generalWordApprovedAbbr).length}`);
  }

  /**
   * Load translation settings from the GoogleTranslate sheet.
   * Sheet columns: Country Code | Country Name | Active | Translate Button Label | Source Language | Target Language | ISO-639-1 Code
   * Example:
   *   NP | Nepal | TRUE | ने.' | English | Nepali | ne
   *   IN | India | TRUE | हि.' | English | Hindi | hi
   *   AU | Australia | FALSE | | | |
   */
  async function loadTranslationSettings(countryCode) {
    try {
      const rows = await fetchSheetRows('GoogleTranslate');
      // Find the row matching the current country code
      const countryRow = rows.find((r) => r[0] && r[0].toUpperCase() === countryCode.toUpperCase());
      if (countryRow) {
        const countryName = countryRow[1] || countryCode; // Column B: Country Name
        const isActive = countryRow[2]; // Column C: Active (TRUE/FALSE - boolean from gviz JSON)
        // Only enable translation if Active column is TRUE
        translationActive = isActive === true || isActive === 'TRUE';
        translationButtonLabel = countryRow[3] || countryCode; // Column D: Translate Button Label
        translationSourceLanguage = countryRow[4] ? 'auto' : 'auto'; // Column E: Source Language (always 'auto' for auto-detect)
        translationTargetLanguage = countryRow[6] || 'ne'; // Column G: ISO-639-1 Code (e.g., 'ne', 'hi')
        
        // Set up pre-translation special rules for Nepali
        translationSpecialRules = [];
        if (countryCode.toUpperCase() === 'NP') {
          translationSpecialRules.push(...NEPALI_TRANSLATION_RULES);
        }
        
        console.log(`[WMERNH] Translation settings loaded for "${countryCode}" (${countryName}): active=${translationActive}, targetLang="${translationTargetLanguage}", sourceLang="${translationSourceLanguage}", buttonLabel="${translationButtonLabel}", specialRules=${translationSpecialRules.length}`);
      } else {
        console.warn(`[WMERNH] Country "${countryCode}" not found in GoogleTranslate sheet, translation disabled`);
        translationActive = false;
        translationTargetLanguage = 'ne';
        translationSourceLanguage = 'auto';
        translationButtonLabel = countryCode;
        translationSpecialRules = [];
        translationPostRules = [];
      }
    } catch (e) {
      console.error(`[WMERNH] Failed to fetch GoogleTranslate sheet:`, e);
      translationActive = false;
      translationTargetLanguage = 'ne';
      translationSourceLanguage = 'auto';
      translationButtonLabel = countryCode;
      // Initialize Nepali special rules as fallback
      translationSpecialRules = [];
      if (countryCode.toUpperCase() === 'NP') {
        translationSpecialRules.push(...NEPALI_TRANSLATION_RULES);
      }
      translationPostRules = [];
    }
  }

  /**
   * Fetch a sheet from Google Sheets as gviz JSON using GM_xmlhttpRequest.
   * Returns a Promise that resolves with the parsed rows array.
   */
  function fetchSheetRows(sheetName) {
    return new Promise((resolve, reject) => {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload(response) {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`[WMERNH] HTTP ${response.status} fetching sheet "${sheetName}"`));
            return;
          }
          try {
            resolve(parseGvizJson(response.responseText));
          } catch (e) {
            reject(e);
          }
        },
        onerror(err) {
          reject(new Error(`[WMERNH] Network error fetching sheet "${sheetName}": ${JSON.stringify(err)}`));
        },
      });
    });
  }

  /**
   * Load country data from Google Sheets.
   * Uses SDK's getTopCountry() to detect the current country, then fetches the matching sheet.
   * Checks sessionStorage first (TTL-based cache); fetches from Sheets if missing/expired.
   * Steps:
   *   1. Detect active country via wmeSDK.DataModel.Countries.getTopCountry()
   *   2. Fetch Countries sheet to map country code → sheet name + button label
   *   3. Fetch country's data sheet → buildDataObjects
   */
  async function loadCountryData() {
    // Step 0: Detect country from WME SDK
    let detectedCountryCode = 'NP'; // fallback
    let detectedCountryName = 'Nepal'; // fallback
    let detectedCountryAbbr = 'नेपा'; // fallback
    try {
      const topCountry = sdk.DataModel.Countries.getTopCountry();
      if (topCountry && topCountry.abbr) {
        detectedCountryCode = topCountry.abbr;  // Use abbr (IN, NP) not id (101, 123)
        detectedCountryName = topCountry.name;  // e.g., "India"
        detectedCountryAbbr = topCountry.abbr;  // e.g., "IN"
        console.log(`[WMERNH] Detected country from SDK: "${detectedCountryCode}" (${detectedCountryName})`);
        WazeToastr.Alerts.info(scriptName, `Detected country: ${detectedCountryName} (${detectedCountryAbbr})`);
      }
    } catch (e) {
      console.warn('[WMERNH] Could not detect country from SDK, defaulting to "NP":', e);
    }
    
    // Step 1: Fetch Countries sheet to map country code → sheet name
    let countryCode = detectedCountryCode;
    let sheetName = detectedCountryCode;
    try {
      const countryRows = await fetchSheetRows('Countries');
      console.log(`[WMERNH] Countries sheet has ${countryRows.length} entries:`, countryRows.map(r => r[0]).join(', '));
      // Columns: Country Code | Sheet Name | (other columns)
      // Match the detected country code (case-insensitive)
      const matchedRow = countryRows.find((r) => r[0] && r[0].toUpperCase() === detectedCountryCode.toUpperCase());
      if (matchedRow) {
        countryCode = matchedRow[0] || detectedCountryCode;
        sheetName = matchedRow[1] || countryCode;
        console.log(`[WMERNH] Found country mapping: ${countryCode} → sheet "${sheetName}"`);
      } else {
        console.warn(`[WMERNH] Country "${detectedCountryCode}" not found in Countries sheet, using defaults`);
        countryCode = detectedCountryCode;
        sheetName = detectedCountryCode;
        btnLabel = `${detectedCountryName} (${detectedCountryAbbr})`;
      }
    } catch (e) {
      console.error(`[WMERNH] Failed to fetch Countries sheet, using defaults:`, e);
      countryCode = detectedCountryCode;
      sheetName = detectedCountryCode;
    }

    activeCountryCode = countryCode;
    
    // Load translation settings from GoogleTranslate sheet (includes button label)
    await loadTranslationSettings(countryCode);
    // Sync button label: translationButtonLabel (from sheet) → translateBtnLabel (used in UI)
    translateBtnLabel = translationButtonLabel; // Column D: Translate Button Label (e.g., 'ने.', 'हि.')
    
    // Use country-specific cache key (was: shared key that didn't change per country)
    const cacheKey = SHEET_CACHE_KEY_PREFIX + countryCode;
    
    try {
      // Check cache for THIS country
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { ts, rows } = JSON.parse(cached);
        if (Date.now() - ts < SHEET_CACHE_TTL_MS) {
          buildDataObjects(rows);
          console.log(`[WMERNH] Using cached data for country "${activeCountryCode}"`);
          return;
        }
      }
    } catch (e) {
      // Ignore corrupt cache
      console.warn('[WMERNH] Cache read error, re-fetching:', e);
    }

    console.log(`[WMERNH] Loading fresh data for "${activeCountryCode}" from sheet "${sheetName}"...`);

    // Step 2: Fetch country data sheet
    try {
      const rows = await fetchSheetRows(sheetName);
      buildDataObjects(rows);
      console.log(`[WMERNH] Data loaded for country "${activeCountryCode}": approvedAbbr=${Object.keys(wmernh_approvedAbbr).length}, suggestedAbbr=${Object.keys(wmernh_suggestedAbbr).length}`);

      // Save to country-specific cache
      try {
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ ts: Date.now(), rows }),
        );
      } catch (e) {
        console.warn('[WMERNH] Cache write error:', e);
      }
    } catch (e) {
      console.error(`[WMERNH] Failed to fetch country sheet "${sheetName}". Script will run with empty data:`, e);
      if (typeof WazeToastr !== 'undefined' && WazeToastr?.Alerts) {
        WazeToastr.Alerts.error(scriptName, 'Could not load abbreviation data from Google Sheets. Check your internet connection.');
      }
    }
  }

  // ========== END GOOGLE SHEETS DATA LOADING ==========

  function wmernh_titleCase(str) {
    return str
      .split(/\s+/)
      .map(function (txt) {
        // If word matches a preserve-case word (case-insensitive), use the preserved version
        const preserve = wmernh_preserveCaseWords.find((w) => w.toLowerCase() === txt.toLowerCase());
        if (preserve) return preserve;
        // Handle hyphenated words
        if (txt.includes('-')) {
          const parts = txt.split('-');
          const firstPart = parts[0];
          const rest = parts.slice(1).join('-');
          // Road code: only when starts with 'NH', 'MDR', or 'SH' and second part contains digits (e.g., NH-125A, MDR-123, SH-45B)
          if (/^(nh|mdr|sh)$/i.test(firstPart) && /\d/.test(rest)) {
            return txt.replace(/^([A-Za-z]+)-(.+)$/i, (match, p1, p2) => p1.toUpperCase() + '-' + p2.toUpperCase());
          }
          // For all other hyphenated words (e.g., East-west → East-West, Chandrapur-Gaur → Chandrapur-Gaur), title case each part
          return parts.map((part) => part.charAt(0).toUpperCase() + part.substr(1).toLowerCase()).join('-');
        }
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      })
      .join(' ');
  }

  let wmernh_valueObserver;

  // Add styles for sidebar panel
  function addSidebarStyles() {
    const styles = [
      '.rnh-container { margin: 10px 5px; }',
      '.rnh-title { font-weight: bold; margin-bottom: 10px; }',
      '.rnh-scan-counter { color: #666; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }',
      '.rnh-spinner { animation: rnh-spin 0.5s infinite linear; }',
      '@keyframes rnh-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }',
      '.rnh-progress-bar { width: 1%; height: 8px; background-color: #4CAF50; margin-bottom: 10px; border: 1px solid #333; transition: width 0.3s ease; display: none; }',
      '.rnh-results { max-height: 400px; overflow-y: auto; }',
      '.rnh-segment-item { padding: 8px; margin-bottom: 5px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; cursor: pointer; }',
      '.rnh-segment-item:hover { background: #f0f0f0; border-color: #999; }',
      '.rnh-segment-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }',
      '.rnh-segment-id { font-size: 11px; color: #666; cursor: pointer; }',
      '.rnh-segment-id:hover { color: #0066cc; text-decoration: underline; }',
      '.rnh-road-type { font-size: 11px; color: #666; background: #e0e0e0; padding: 2px 6px; border-radius: 3px; }',
      '.rnh-name-row { margin-bottom: 3px; font-size: 12px; }',
      '.rnh-name-label { font-weight: bold; color: #555; min-width: 40px; display: inline-block; }',
      '.rnh-current-name { color: #d32f2f; }',
      '.rnh-suggested-name { color: #388e3c; }',
      '.rnh-fix-button { padding: 4px 8px; font-size: 11px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; }',
      '.rnh-fix-button:hover { background: #45a049; }',
      '.rnh-fix-button:disabled { background: #ccc; cursor: not-allowed; }',
      '.rnh-fix-all-button { width: 100%; padding: 8px; margin-bottom: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }',
      '.rnh-fix-all-button:hover { background: #1976D2; }',
      '.rnh-fix-all-button:disabled { background: #ccc; cursor: not-allowed; }',
      '.rnh-no-issues { text-align: center; color: #4CAF50; padding: 20px; font-weight: bold; }',
      '.rnh-alt-names { margin-top: 5px; padding-left: 10px; border-left: 2px solid #ddd; }',
      '.rnh-complete-icon { color: #4CAF50; }',
      '.rnh-button-container { margin-bottom: 10px; }',
      '.rnh-preview-container { margin-bottom: 10px; display: flex; align-items: center; gap: 5px; }',
      '.rnh-preview-checkbox { margin: 0; }',
      '.rnh-preview-label { margin: 0; font-size: 13px; cursor: pointer; }',
    ].join('\n');

    GM_addStyle(styles);
  }

  function wmernh_init() {
    // Initialize sidebar panel
    initSidebarPanel();

    const observer = new MutationObserver((mutationsList) => {
      mutationsList.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (node.classList && node.classList.contains('address-edit-card')) {
              if (wmernh_valueObserver) {
                wmernh_valueObserver.disconnect();
              }
            }
          });

          mutation.addedNodes.forEach((node) => {
            if (node.classList && node.classList.contains('address-edit-card')) {
              setTimeout(() => {
                // Main street name
                const streetNameInput = node.querySelector('wz-autocomplete.street-name');
                if (streetNameInput && streetNameInput.shadowRoot) {
                  const wzTextInput = streetNameInput.shadowRoot.querySelector('wz-text-input');
                  if (wzTextInput) {
                    wmernh_monitor(wzTextInput);
                  } else {
                    console.warn('WMERNH: wz-text-input not found in street-name shadowRoot.');
                  }
                } else {
                  console.warn('WMERNH: street-name input or its shadowRoot not found.');
                }
                // Alt street name(s)
                const altStreetInputs = node.querySelectorAll('wz-autocomplete.alt-street-name');
                altStreetInputs.forEach((altInput) => {
                  if (altInput && altInput.shadowRoot) {
                    const altWzTextInput = altInput.shadowRoot.querySelector('wz-text-input');
                    if (altWzTextInput) {
                      wmernh_monitor(altWzTextInput);
                    } else {
                      console.warn('WMERNH: wz-text-input not found in alt-street-name shadowRoot.');
                    }
                  } else {
                    console.warn('WMERNH: alt-street-name input or its shadowRoot not found.');
                  }
                });
              }, 250);
            }
          });
        }
      });
    });
    const editPanel = document.getElementById('edit-panel');
    if (editPanel) {
      observer.observe(editPanel, { childList: true, subtree: true });
    } else {
      console.warn('WMERNH: Edit panel not found for observer.');
    }																														
  }

  // Also observe for alt street card (for alt names)
  const altStreetPanelObserver = new MutationObserver((mutationsList) => {
    mutationsList.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.classList && node.classList.contains('edit-alt-street-card')) {
            setTimeout(() => {
              const altStreetInput = node.querySelector('wz-autocomplete.alt-street-name');
              if (altStreetInput && altStreetInput.shadowRoot) {
                const altWzTextInput = altStreetInput.shadowRoot.querySelector('wz-text-input');
                if (altWzTextInput) {
                  wmernh_monitor(altWzTextInput);
                } else {
                  console.warn('WMERNH: wz-text-input not found in alt-street-name shadowRoot (alt card).');
                }
              } else {
                console.warn('WMERNH: alt-street-name input or its shadowRoot not found (alt card).');
              }
            }, 250);
          }
        });
      }
    });
  });
  // Observe the whole document for alt street cards
  altStreetPanelObserver.observe(document.body, { childList: true, subtree: true });

  function wmernh_monitor(element) {
    let abbrContainer = document.createElement('div');
    abbrContainer.id = 'WMERNH_container';

    // Build button HTML conditionally: only show translate button if translation is active for this country
    let translateBtnHtml = '';
    if (translationActive) {
      translateBtnHtml = `<button id="WMERNH_translate_btn" title="This will add translated name as Alt name." style="margin-left:8px;display:flex;align-items:center;gap:2px;padding:2px 6px;font-size:13px;border:1px solid #bbb;border-radius:4px;cursor:pointer;">
        <i class="fa fa-language" aria-hidden="true" style="font-size:14px;"></i>
        ${translateBtnLabel}
      </button>`;
    }
    abbrContainer.innerHTML =
      '<div class="WMERNH_icon" title="WME Standard Suffix Abbreviations"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M4.5 2A2.5 2.5 0 0 0 2 4.5v2.879a2.5 2.5 0 0 0 .732 1.767l4.5 4.5a2.5 2.5 0 0 0 3.536 0l2.878-2.878a2.5 2.5 0 0 0 0-3.536l-4.5-4.5A2.5 2.5 0 0 0 7.38 2H4.5ZM5 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" /></svg></div>' +
      '<div id="WMERNH_output">Loading...</div>' +
      translateBtnHtml;
    const statusTextContainer = element.shadowRoot.querySelector('.status-text-container');
    if (!statusTextContainer) {
      console.warn('WMERNH: .status-text-container not found. UI will not be displayed.');
      return;
    }
    statusTextContainer.insertBefore(abbrContainer, statusTextContainer.firstChild);


    let abbrOutput = abbrContainer.querySelector('#WMERNH_output');
    let translateBtn = abbrContainer.querySelector('#WMERNH_translate_btn');


    // --- Translation logic using Google Translate API, preserving tokens/placeholders ---
    async function translateToNepali(text) {
              console.log('[WMERNH] Translation requested:', { input: text, active: translationActive });
            // Skip translation if not active for this country
            if (!translationActive) {
              console.log('[WMERNH] Translation disabled for this country, returning original text');
              return text;
            }
            // Use translation rules loaded from GoogleTranslate sheet
            let specialText = text;
            let specialMatched = false;
            for (const rule of translationSpecialRules) {
              try {
                const regex = new RegExp(rule.regex, 'gi');
                if (regex.test(specialText)) {
                  specialText = specialText.replace(regex, rule.replace);
                  specialMatched = true;
                }
              } catch (e) {
                console.warn('[WMERNH] Invalid regex in translation rule:', rule, e);
              }
            }
            if (specialMatched) {
              console.log('[WMERNH] Special-case translation:', { input: text, output: specialText });
              // Recursively translate the special-case output if it changed
              if (specialText !== text) {
                return await translateToNepali(specialText);
              }
              return specialText;
            }
      if (!text.trim()) {
        console.log('[WMERNH] Empty input, skipping translation.');
        return text;
      }
      // Simple token preservation: skip translation for {...} and [signal] blocks
      const tokenRegex = /({[^}]+}|\[signal\][^\[]*\[\/signal\])/g;
      let tokens = [];
      let replaced = text.replace(tokenRegex, (m) => {
        tokens.push(m);
        return `__TOKEN_${tokens.length - 1}__`;
      });

      // Expand common abbreviations before translation (e.g., Rd -> Road)
      // Use the wmernh_approvedAbbr mapping
      replaced = replaced.replace(/\b([A-Za-z]{2,5})\b/g, (match) => {
        // Only expand if in the abbreviation list and not all uppercase (to avoid e.g. NH for highways)
        if (wmernh_approvedAbbr[match] && match !== match.toUpperCase()) {
          return wmernh_approvedAbbr[match];
        }
        return match;
      });
      const hasLatin = /[A-Za-z]/.test(replaced);
      const hasDevanagari = /[\u0900-\u097F]/.test(replaced);
      
      // Use source language from GoogleTranslate sheet; if 'auto' then detect
      let sourceLang = translationSourceLanguage;
      if (sourceLang === 'auto') {
        if (hasLatin && !hasDevanagari) {
          sourceLang = 'en';
        } else if (hasDevanagari && !hasLatin) {
          sourceLang = translationTargetLanguage;
        }
      }
      
      // Google Translate API (unofficial, public endpoint)
      console.log('[WMERNH] Translation API call:', { replaced, sourceLang, targetLang: translationTargetLanguage });
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${translationTargetLanguage}&dt=t&q=${encodeURIComponent(replaced)}`;
        console.debug('WMERNH translate request', {
          originalText: text,
          translatedInput: replaced,
          sourceLang,
          targetLang: translationTargetLanguage,
          url,
        });
        return await new Promise((resolve) => {
          GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            responseType: 'json',
            onload: function(response) {
              if (response.status < 200 || response.status >= 300) {
                console.error('WMERNH translate HTTP error', {
                  status: response.status,
                  statusText: response.statusText,
                  url,
                  responseText: response.responseText,
                });
                resolve(text);
                return;
              }
              let res = response.response;
              console.log('[WMERNH] Translation API response:', { url, response: res });
              if (typeof res === 'string') {
                try { res = JSON.parse(res); } catch {}
              }
              let translated = Array.isArray(res) && Array.isArray(res[0]) ? res[0].map(seg => Array.isArray(seg) ? seg[0] : '').join('') : (res?.[0]?.[0]?.[0] ?? replaced);
              // Restore tokens
              translated = translated.replace(/__TOKEN_(\d+)__/g, (_, i) => tokens[+i] || '');

              // Ensure spaces before and after hyphens, matching English style
              // Only if the original input had ' - ' (space-hyphen-space), enforce it in the output
              if (/\s-\s/.test(text)) {
                // Remove any existing spaces around hyphens, then add single spaces
                translated = translated.replace(/\s*-\s*/g, ' - ');
              }

              console.log('[WMERNH] Translation result:', { input: text, replaced, output: translated });
              
              // Apply post-translation correction rules (e.g., Nepali: मार्गा → मार्ग)
              for (const rule of translationPostRules) {
                try {
                  if (rule.regex && rule.replace) {
                    // For regex string patterns, create RegExp with global flag
                    const regex = rule.regex instanceof RegExp ? rule.regex : new RegExp(rule.regex, 'g');
                    if (regex.test(translated)) {
                      const before = translated;
                      translated = translated.replace(regex, rule.replace);
                      console.log(`[WMERNH] Post-translation correction applied:`, { rule: rule.regex, before, after: translated });
                    }
                  }
                } catch (e) {
                  console.warn('[WMERNH] Invalid post-translation rule:', rule, e);
                }
              }
              
              resolve(translated);
            },
            onerror: function(error) {
              console.error('[WMERNH] Translation API error:', { error, url, input: text, replaced, sourceLang });
              console.error('WMERNH translate request failed', { error, url, originalText: text, translatedInput: replaced, sourceLang });
              resolve(text);
            }
          });
        });
      } catch (e) {
        console.error('[WMERNH] Translation exception:', { error: e, input: text, replaced, sourceLang });
        return text;
      }
    }


    // --- Inline Nepali suggestion element (async) ---
    let nepaliSuggestion = document.createElement('span');
    nepaliSuggestion.id = 'WMERNH_nepali_suggestion';
    nepaliSuggestion.style.cssText = 'margin-left:10px;color:#1565c0;font-size:0.95em;font-style:italic;';
    abbrContainer.appendChild(nepaliSuggestion);

    let lastSuggestValue = '';
    async function updateNepaliSuggestion() {
      const currentValue = element.value.trim();
      if (!currentValue || !translationActive) {
        nepaliSuggestion.textContent = '';
        lastSuggestValue = '';
        return;
      }
      // Avoid duplicate requests for same value
      if (currentValue === lastSuggestValue) return;
      lastSuggestValue = currentValue;
      nepaliSuggestion.textContent = 'Translating...';
      const translated = await translateToNepali(currentValue);
      if (translated && translated !== currentValue) {
        nepaliSuggestion.textContent = `${translated}`;
      } else {
        nepaliSuggestion.textContent = '';
      }
    }

    // Update suggestion on input (debounced async)
    let suggestTimeout;
    element.addEventListener('input', () => {
      clearTimeout(suggestTimeout);
      suggestTimeout = setTimeout(updateNepaliSuggestion, 350);
    });
    // Initial update
    updateNepaliSuggestion();

    // --- Add translation button click handler (async) ---
    if (translateBtn) {
      translateBtn.addEventListener('click', async function() {
        const currentValue = element.value.trim();
        if (!currentValue) return;
        translateBtn.disabled = true;
        translateBtn.textContent = 'Translating...';
        const translated = await translateToNepali(currentValue);
        translateBtn.textContent = 'ने.';
        translateBtn.disabled = false;

        // --- SDK-based alt name update ---
        try {
          // Get selected segments from SDK
          const selection = sdk.Editing.getSelection();
          if (!selection || !selection.ids || selection.ids.length === 0) {
            alert('No segment selected!');
            return;
          }
          const segmentId = selection.ids[0];
          const segment = sdk.DataModel.Segments.getById({ segmentId });
          if (!segment) {
            alert('Selected segment not found!');
            return;
          }
          // Get cityId from primary street
          const primaryStreet = sdk.DataModel.Streets.getById({ streetId: segment.primaryStreetId });
          const cityId = primaryStreet && primaryStreet.cityId ? primaryStreet.cityId : null;
          if (!cityId) {
            alert('Could not determine city for alt name.');
            return;
          }
          // Check if alt street with this name already exists
          let altStreet = sdk.DataModel.Streets.getStreet({ cityId, streetName: translated });
          if (!altStreet) {
            altStreet = sdk.DataModel.Streets.addStreet({ streetName: translated, cityId });
          }
          // Add to alternateStreetIds if not already present
          let alternateStreetIds = Array.isArray(segment.alternateStreetIds) ? [...segment.alternateStreetIds] : [];
          if (!alternateStreetIds.includes(altStreet.id)) {
            alternateStreetIds.push(altStreet.id);
            await sdk.DataModel.Segments.updateAddress({ segmentId, alternateStreetIds });
            WazeToastr.Alerts.success(`${scriptName}`, `Nepali alt name "${translated}" added successfully!`);
          } else {
            WazeToastr.Alerts.info(`${scriptName}`, `Nepali alt name "${translated}" already present.`);
          }
        } catch (err) {
          console.error(`Failed to add Nepali alt name "${translated}" via SDK:`, err);
          alert(`Failed to add Nepali alt name "${translated}". See console for details.`);
        }

        // --- DOM-based alt name update (deprecated, now commented out) ---
        /*
        // Try to find the alt and primary name fields in the same edit panel as the current element
        let altInput = null;
        let primaryInput = null;
        let root = element.getRootNode();
        if (root && root.host && root.host.closest) {
          let panel = root.host.closest('.edit-panel, .edit-alt-street-card');
          if (panel) {
            // Try all wz-autocomplete.alt-street-name in this panel
            let altComps = panel.querySelectorAll('wz-autocomplete.alt-street-name');
            for (let comp of altComps) {
              if (comp.shadowRoot) {
                let wzInput = comp.shadowRoot.querySelector('wz-text-input');
                if (wzInput) {
                  altInput = wzInput;
                  break;
                }
              }
            }
            // Try all wz-autocomplete.street-name in this panel
            let primaryComps = panel.querySelectorAll('wz-autocomplete.street-name');
            for (let comp of primaryComps) {
              if (comp.shadowRoot) {
                let wzInput = comp.shadowRoot.querySelector('wz-text-input');
                if (wzInput) {
                  primaryInput = wzInput;
                  break;
                }
              }
            }
          }
        }
        // Fallback: try global selectors as before
        if (!altInput) {
          let altComps = document.querySelectorAll('wz-autocomplete.alt-street-name');
          for (let comp of altComps) {
            if (comp.shadowRoot) {
              let wzInput = comp.shadowRoot.querySelector('wz-text-input');
              if (wzInput) {
                altInput = wzInput;
                break;
              }
            }
          }
        }
        if (!primaryInput) {
          let primaryComps = document.querySelectorAll('wz-autocomplete.street-name');
          for (let comp of primaryComps) {
            if (comp.shadowRoot) {
              let wzInput = comp.shadowRoot.querySelector('wz-text-input');
              if (wzInput) {
                primaryInput = wzInput;
                break;
              }
            }
          }
        }
        // Prefer alt if present, else primary
        let targetInput = altInput || primaryInput;
        if (targetInput) {
          targetInput.value = translated;
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          alert('Name field not found!');
        }
        */
      });
    }

    const css = [
      '.status-text-container {width: calc(100% + ' +
        (document.querySelector('#edit-panel .address-edit-card .street-name-row .tts-playback') ? document.querySelector('#edit-panel .address-edit-card .street-name-row .tts-playback').offsetWidth : 0) +
																											   
				
        'px); display: flex; flex-direction: column-reverse;}',
      '#WMERNH_container {display: flex; align-items: center; flex-grow: 1; margin-top: var(--wz-label-margin, 8px); padding: 0 2px; border-radius: 5px; background: #ffffff; color: #ffffff; gap: 5px; cursor: default; transition: background 0.25s linear, color 0.25s linear; font-size: 0.9em;}',
      '#WMERNH_output {color: #000000; white-space: pre-wrap; flex-grow: 1;}',
      '.WMERNH_icon {display: inline-flex; padding: 2px; height: 12px; background: rgba(0,0,0,0.5); border-radius: 3px; flex-shrink: 0; margin-right: 5px;}',
      '.WMERNH_icon svg {height: 100%;}',
      '#WMERNH_container.info {background: #e0f2fe; color: #e0f2fe;}',
      '#WMERNH_container.check {background: #fef3c7; color: #fef3c7; cursor: pointer;}',
      '#WMERNH_container.check:hover {background: #fde68a; color: #fde68a;}',
      '#WMERNH_container.valid {background: #d1fae5; color: #d1fae5;}',
    ].join(' ');
    const styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.textContent = css;
    element.shadowRoot.appendChild(styleElement);

    if (wmernh_valueObserver) {
      wmernh_valueObserver.disconnect();
    }
    wmernh_valueObserver = new MutationObserver((mutationsList, observer) => {
      for (let mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
          wmernh_update(element, abbrContainer, abbrOutput);
        }
      }
    });
    wmernh_valueObserver.observe(element, { attributes: true });

    wmernh_update(element, abbrContainer, abbrOutput);

    // Add Tab key support for applying suggestion
    element.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        const abbrContainer = element.shadowRoot.querySelector('#WMERNH_container');
        if (abbrContainer && abbrContainer.classList.contains('check')) {
          const abbrOutput = abbrContainer.querySelector('#WMERNH_output');
          // Simulate click to apply suggestion
          abbrContainer.click();
          e.preventDefault();
        }
      }
    });
  }

  function wmernh_analyzeSuffix(suffix) {
    const suffixLower = suffix.toLowerCase();
    let result = { status: 'info', message: 'No match for suffix.', proposed: suffix, original: suffix };

    const isKnownNoAbbrExact = (sLower) => wmernh_knownNoAbbr.some((kna) => kna.toLowerCase() === sLower);
    const getKnownNoAbbrCased = (sLower) => wmernh_knownNoAbbr.find((kna) => kna.toLowerCase() === sLower);

    // 0. Exact match for highway abbreviations (special case)
    const hwyKey = Object.keys(wmernh_suggestedHwyAbbr).find((key) => key.toLowerCase() === suffixLower);
    if (hwyKey) {
      const suggestedHwy = wmernh_suggestedHwyAbbr[hwyKey];
      if (suggestedHwy.toLowerCase() !== suffixLower) {
        return { status: 'check', message: `Use ${suggestedHwy} for ${hwyKey}`, proposed: suggestedHwy, original: suffix };
      } else {
        return { status: 'valid', message: `${suggestedHwy}`, proposed: suggestedHwy, original: suffix };
      }
    }

    // 1. Exact match: Typed IS an approved abbreviation (e.g., "Rd")
    if (wmernh_approvedAbbr.hasOwnProperty(suffix)) {
      return { status: 'valid', message: `${suffix} for ${wmernh_approvedAbbr[suffix]}`, proposed: suffix, original: suffix };
    }
    const approvedKeyCi = Object.keys(wmernh_approvedAbbr).find((k) => k.toLowerCase() === suffixLower);
    if (approvedKeyCi) {
      return { status: 'valid', message: `${approvedKeyCi} for ${wmernh_approvedAbbr[approvedKeyCi]}`, proposed: approvedKeyCi, original: suffix };
    }

    // 2. Exact match: Typed IS a known non-abbreviated suffix (e.g., "Lane")
    if (isKnownNoAbbrExact(suffixLower)) {
      const casedNoAbbr = getKnownNoAbbrCased(suffixLower) || suffix;
      return { status: 'valid', message: casedNoAbbr, proposed: casedNoAbbr, original: suffix };
    }

    const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suffixRegex = new RegExp(`^${escapedSuffix}`, 'i');

    // 3. Suggestion: Typed is (prefix of) a full word that should be abbreviated (e.g., "Street" or "Stre" -> "St")
    let suggestFromFullKey = Object.keys(wmernh_suggestedAbbr).find((key) => key.toLowerCase() === suffixLower);
    if (!suggestFromFullKey) {
      suggestFromFullKey = Object.keys(wmernh_suggestedAbbr).find((key) => suffixRegex.test(key));
    }
    if (suggestFromFullKey) {
      const suggestedAbbr = wmernh_suggestedAbbr[suggestFromFullKey];
      if (suggestedAbbr.toLowerCase() !== suffixLower) {
        return { status: 'check', message: `Use ${suggestedAbbr} for ${suggestFromFullKey}`, proposed: suggestedAbbr, original: suffix };
      } else {
        // Typed the same as the suggestion (e.g. typed "Lane", suggested "Lane" because "Ln":"Lane")
        if (isKnownNoAbbrExact(suggestedAbbr.toLowerCase())) {
          const casedNoAbbr = getKnownNoAbbrCased(suggestedAbbr.toLowerCase()) || suggestedAbbr;
          return { status: 'valid', message: casedNoAbbr, proposed: casedNoAbbr, original: suffix };
        }
        const finalApprovedKeyCi = Object.keys(wmernh_approvedAbbr).find((k) => k.toLowerCase() === suggestedAbbr.toLowerCase());
        if (finalApprovedKeyCi) {
          return { status: 'valid', message: `${finalApprovedKeyCi} for ${wmernh_approvedAbbr[finalApprovedKeyCi]}`, proposed: finalApprovedKeyCi, original: suffix };
        }
      }
    }

    // 4. Suggestion: Typed is (prefix of) a known non-abbreviated word (e.g., "Lan" -> "Lane")
    const knownNoAbbrCompletion = wmernh_knownNoAbbr.find((key) => suffixRegex.test(key));
    if (knownNoAbbrCompletion && knownNoAbbrCompletion.toLowerCase() !== suffixLower) {
      return { status: 'check', message: `Use ${knownNoAbbrCompletion}`, proposed: knownNoAbbrCompletion, original: suffix };
    }

    // 5. Suggestion: Typed is (prefix of) an approved abbreviation (e.g., "Al" -> "Ally")
    const approvedAbbrCompletionKey = Object.keys(wmernh_approvedAbbr).find((key) => suffixRegex.test(key));
    if (approvedAbbrCompletionKey && approvedAbbrCompletionKey.toLowerCase() !== suffixLower) {
      return { status: 'check', message: `Use ${approvedAbbrCompletionKey} for ${wmernh_approvedAbbr[approvedAbbrCompletionKey]}`, proposed: approvedAbbrCompletionKey, original: suffix };
    }

    return result;
  }

  function wmernh_update(element, abbrContainer, abbrOutput) {
    abbrContainer.classList.remove('valid', 'check', 'info');
    abbrContainer.onclick = null;
    abbrOutput.innerText = 'Awaiting input...';

    const currentValue = element.value.trim();
    if (!currentValue) {
      return;
    }

    if (currentValue.match(/^The [a-zA-Z0-9\s'-]+$/i) && currentValue.split(/\s+/).length <= 3) {
      // "The x" or "The x y"
      abbrContainer.classList.add('info');
      abbrOutput.innerText = "Do not abbreviate 'The x' names";
      return;
    }

    let currentWords = currentValue.split(/\s+/);
    let proposedWords = [...currentWords];
    let preSuffixChangesMade = false;
    let overallStatus = 'info';
    let messages = [];

    // --- Process Pre-Suffix Words ---
    if (currentWords.length > 1) {
      for (let i = 0; i < currentWords.length - 1; i++) {
        const word = currentWords[i];
        const wordLower = word.toLowerCase();

        const generalApprovedKeyCi = Object.keys(wmernh_generalWordApprovedAbbr).find((k) => k.toLowerCase() === wordLower);
        if (generalApprovedKeyCi) {
          // Word is already an approved general abbreviation
          if (word !== generalApprovedKeyCi) {
            // Correct casing if needed
            proposedWords[i] = generalApprovedKeyCi;
            preSuffixChangesMade = true;
          }
          continue;
        }

        const generalSuggestionKeyCi = Object.keys(wmernh_generalWordSuggestions).find((k) => k.toLowerCase() === wordLower);
        if (generalSuggestionKeyCi) {
          const suggestedGeneralAbbr = wmernh_generalWordSuggestions[generalSuggestionKeyCi];
          if (suggestedGeneralAbbr.toLowerCase() !== wordLower) {
            proposedWords[i] = suggestedGeneralAbbr;
            preSuffixChangesMade = true;
          }
        }
      }
    }

    // --- Process Suffix (last word) ---
    let suffixAnalysis = {
      status: 'info',
      message: currentWords.length > 0 ? 'Awaiting valid suffix.' : 'Awaiting input.',
      proposed: currentWords.length > 0 ? currentWords[currentWords.length - 1] : '',
      original: currentWords.length > 0 ? currentWords[currentWords.length - 1] : '',
    };
    if (currentWords.length > 0) {
      const potentialSuffix = currentWords[currentWords.length - 1];
      suffixAnalysis = wmernh_analyzeSuffix(potentialSuffix);
      proposedWords[currentWords.length - 1] = suffixAnalysis.proposed;
    }

    // --- Combine Results and Determine UI ---
    const finalProposedString = wmernh_titleCase(proposedWords.join(' '));
    const suffixChanged = currentWords.length > 0 && suffixAnalysis.proposed.toLowerCase() !== suffixAnalysis.original.toLowerCase();
    const capitalizationChanged = currentValue !== finalProposedString;
    let anyChangeProposed = preSuffixChangesMade || suffixChanged || capitalizationChanged;

    if (anyChangeProposed) {
      overallStatus = 'check';
      let suggestionDetails = [];
      if (preSuffixChangesMade) suggestionDetails.push('word(s) before suffix');
      if (suffixChanged) suggestionDetails.push('suffix');

      messages.push(`Suggest: "${finalProposedString}"`);
      if (suggestionDetails.length > 0) {
        messages.push(`(Changes to ${suggestionDetails.join(' & ')})`);
      }
      if (suffixChanged && suffixAnalysis.message && suffixAnalysis.message.startsWith('Use ')) {
        messages.push(suffixAnalysis.message); // Add specific suffix suggestion message
      }

      abbrContainer.onclick = function () {
        element.value = finalProposedString;
      };
    } else {
      // No changes proposed, evaluate if current input is valid or just no rules hit
      let allWordsAreStandard = true; // Assume true unless a known full word (that can be abbreviated) is found
      if (currentWords.length > 1) {
        for (let i = 0; i < currentWords.length - 1; i++) {
          const word = currentWords[i];
          const wordLower = word.toLowerCase();
          // Check if it's a full word that *could* be abbreviated, but isn't
          const canBeAbbreviatedKey = Object.keys(wmernh_generalWordSuggestions).find((k) => k.toLowerCase() === wordLower);
          // And it's not already an abbreviation of itself or something else
          const isAbbreviation = Object.keys(wmernh_generalWordApprovedAbbr).find((k) => k.toLowerCase() === wordLower);
          if (canBeAbbreviatedKey && !isAbbreviation) {
            allWordsAreStandard = false;
            break;
          }
        }
      }

      if (suffixAnalysis.status === 'valid' && allWordsAreStandard) {
        overallStatus = 'valid';
        messages.push(suffixAnalysis.message || `"${currentValue}" is standard.`);
      } else {
        overallStatus = 'info'; // Default to info if not perfectly valid or no suggestions
        if (!allWordsAreStandard) {
          messages.push('Consider standard abbreviations for words before suffix.');
        }
        if (suffixAnalysis.status === 'info') {
          messages.push(suffixAnalysis.message || 'Check suffix standards.');
        } else if (suffixAnalysis.status === 'valid' && !allWordsAreStandard) {
          // Suffix is fine, but pre-words are not optimal
          messages.push(`Suffix "${suffixAnalysis.proposed}" is standard.`);
        } else {
          messages.push(suffixAnalysis.message || `Review standards for "${currentValue}"`);
        }
      }
    }

    abbrContainer.classList.add(overallStatus);
    abbrOutput.innerText = messages.filter((m) => m).join('\n') || 'Awaiting input or check standards.';
  }

  // ========== SIDEBAR PANEL FUNCTIONS ==========

  async function initSidebarPanel() {
    try {
      addSidebarStyles();

      const { tabLabel, tabPane } = await sdk.Sidebar.registerScriptTab();

      // Set tab label
      tabLabel.textContent = 'RNH';
      tabLabel.title = `${scriptName}`;

      // Create main container
      const container = document.createElement('div');
      container.className = 'rnh-container';

      // Title
      const title = document.createElement('wz-overline');
      title.textContent = `${scriptName}`;
      title.style.marginBottom = '10px';
      container.appendChild(title);

      // Version
      const version = document.createElement('wz-label');
      version.textContent = `Version ${scriptVersion}`;
      version.style.marginBottom = '10px';
      container.appendChild(version);

      // Detected Country
      const topCountry = sdk.DataModel.Countries.getTopCountry();
      if (topCountry && topCountry.abbr) {
        detectedCountryName = topCountry.name;  // e.g., "India"
      }
      const countryDisplay = document.createElement('wz-label');
      countryDisplay.textContent = `Detected Country: ${detectedCountryName || 'Unknown'}`;
      countryDisplay.style.marginBottom = '10px';
      container.appendChild(countryDisplay);

      // Preview checkbox
      const previewContainer = document.createElement('div');
      previewContainer.className = 'rnh-preview-container';
      const previewCheckbox = document.createElement('input');
      previewCheckbox.type = 'checkbox';
      previewCheckbox.id = 'rnh-preview-checkbox';
      previewCheckbox.className = 'rnh-preview-checkbox';
      previewCheckbox.checked = previewEnabled;
      previewCheckbox.onchange = onPreviewChanged;
      const previewLabel = document.createElement('label');
      previewLabel.htmlFor = 'rnh-preview-checkbox';
      previewLabel.className = 'rnh-preview-label';
      previewLabel.textContent = 'Preview (highlight segments with issues)';
      previewContainer.appendChild(previewCheckbox);
      previewContainer.appendChild(previewLabel);
      container.appendChild(previewContainer);

      // Scan counter
      const scanCounter = document.createElement('div');
      scanCounter.className = 'rnh-scan-counter';
      scanCounter.innerHTML = '<i class="fa fa-check-circle rnh-complete-icon"></i><span>Scanned: 0 segments</span>';
      container.appendChild(scanCounter);
      cachedElements.scanCounter = scanCounter;

      // Progress bar
      const progressBar = document.createElement('div');
      progressBar.className = 'rnh-progress-bar';
      container.appendChild(progressBar);
      cachedElements.progressBar = progressBar;

      // Fix All button
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'rnh-button-container';
      const fixAllButton = document.createElement('button');
      fixAllButton.className = 'rnh-fix-all-button';
      fixAllButton.textContent = 'Fix All Names';
      fixAllButton.disabled = true;
      fixAllButton.onclick = fixAllNames;
      buttonContainer.appendChild(fixAllButton);
      container.appendChild(buttonContainer);
      cachedElements.fixAllButton = fixAllButton;

      // Results container
      const resultsContainer = document.createElement('div');
      resultsContainer.className = 'rnh-results';
      container.appendChild(resultsContainer);
      cachedElements.resultsContainer = resultsContainer;

      tabPane.appendChild(container);

      // Register event handlers and store subscriptions for cleanup
      eventSubscriptions.push(
        sdk.Events.on({
          eventName: 'wme-map-move-end',
          eventHandler: debouncedScan,
        }),
      );

      eventSubscriptions.push(
        sdk.Events.on({
          eventName: 'wme-map-zoom-changed',
          eventHandler: debouncedScan,
        }),
      );

      eventSubscriptions.push(
        sdk.Events.on({
          eventName: 'wme-after-edit',
          eventHandler: debouncedScan,
        }),
      );

      // Initial scan
      debouncedScan();

      // Add cleanup on page unload
      window.addEventListener('beforeunload', cleanup);
    } catch (error) {
      console.error(`${scriptName}: Error initializing sidebar panel:`, error);
    }
  }

  /**
   * Cleanup function to unsubscribe from events and clear timers
   */
  function cleanup() {
    console.log(`${scriptName}: Cleaning up...`);

    // Clear any pending scan timeout
    if (scanTimeout) {
      clearTimeout(scanTimeout);
    }

    // Unsubscribe from all events
    eventSubscriptions.forEach((subscription) => {
      try {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      } catch (err) {
        console.warn(`${scriptName}: Error unsubscribing from event:`, err);
      }
    });
    eventSubscriptions = [];
  }

  /**
   * Debounced scan function to prevent excessive scanning during map movements
   */
  function debouncedScan() {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
      if (!isScanning) {
        scanRoadNames();
      }
    }, SCAN_DEBOUNCE_DELAY);
  }

  function onScreen(geometry) {
    if (!geometry || !currentMapExtent) return false;

    const [left, bottom, right, top] = currentMapExtent;

    if (geometry.type === 'Point') {
      const [lon, lat] = geometry.coordinates;
      return lon >= left && lon <= right && lat >= bottom && lat <= top;
    } else if (geometry.type === 'LineString') {
      return geometry.coordinates.some(([lon, lat]) => lon >= left && lon <= right && lat >= bottom && lat <= top);
    }
    return true;
  }

  /**
   * Scan all on-screen road segments for naming issues
   */
  async function scanRoadNames() {
    if (isScanning) {
      console.log(`${scriptName}: Scan already in progress, skipping...`);
      return;
    }

    isScanning = true;
    try {
      // Get current map extent
      currentMapExtent = sdk.Map.getMapExtent();

      if (!currentMapExtent) {
        throw new Error('Unable to get map extent');
      }

      // Show progress
      updateProgress(true, 1);

      scannedSegments = [];
      const segments = sdk.DataModel.Segments.getAll();
      const onScreenSegments = segments.filter((segment) => onScreen(segment.geometry));

      console.log(`${scriptName}: Scanning ${onScreenSegments.length} on-screen segments...`);

      let processedCount = 0;
      let editableCount = 0;
      const totalCount = onScreenSegments.length;

      for (const segment of onScreenSegments) {
        processedCount++;

        // Check if segment is editable
        if (
          !sdk.DataModel.Segments.hasPermissions({
            permission: 'EDIT_PROPERTIES',
            segmentId: segment.id,
          })
        ) {
          continue;
        }

        editableCount++;
        const issues = [];

        // Get street names from Streets data model using street IDs
        let primaryStreetName = '';
        const altStreetNames = [];

        if (segment.primaryStreetId) {
          try {
            const primaryStreet = sdk.DataModel.Streets.getById({ streetId: segment.primaryStreetId });
            if (primaryStreet?.name) {
              primaryStreetName = primaryStreet.name;

              const analysis = analyzeStreetName(primaryStreet.name);
              if (analysis.needsFix) {
                issues.push({
                  type: 'primary',
                  current: primaryStreet.name,
                  suggested: analysis.suggested,
                  reason: analysis.reason,
                });
              }
            }
          } catch (err) {
            console.warn(`${scriptName}: Error getting primary street ${segment.primaryStreetId}:`, err);
          }
        }

        // Check alternate street names
        if (segment.alternateStreetIds && segment.alternateStreetIds.length > 0) {
          segment.alternateStreetIds.forEach((streetId, index) => {
            try {
              const altStreet = sdk.DataModel.Streets.getById({ streetId });
              if (altStreet?.name) {
                altStreetNames.push(altStreet.name);

                const analysis = analyzeStreetName(altStreet.name);
                if (analysis.needsFix) {
                  issues.push({
                    type: 'alt',
                    index: index,
                    current: altStreet.name,
                    suggested: analysis.suggested,
                    reason: analysis.reason,
                  });
                }
              }
            } catch (err) {
              console.warn(`${scriptName}: Error getting alt street ${streetId}:`, err);
            }
          });
        }

        if (issues.length > 0) {
          scannedSegments.push({
            id: segment.id,
            roadType: segment.roadType,
            primaryStreetId: segment.primaryStreetId,
            alternateStreetIds: segment.alternateStreetIds || [],
            primaryStreetName: primaryStreetName,
            altStreetNames: altStreetNames,
            issues: issues,
          });
        }

        // Update progress periodically
        if (processedCount % PROGRESS_UPDATE_THROTTLE === 0 || processedCount === totalCount) {
          updateProgress(true, (processedCount / totalCount) * 100);
          updateScanCounter(processedCount);
        }
      }

      console.log(`${scriptName}: Scan complete. Total: ${totalCount}, Editable: ${editableCount}, Issues found: ${scannedSegments.length}`);

      // Update UI
      updateProgress(false);
      updateScanCounter(totalCount);
      displayResults();

      // Highlight segments if preview is enabled
      if (previewEnabled) {
        highlightSegments();
      }
    } catch (error) {
      console.error(`${scriptName}: Error scanning road names:`, error);
      updateProgress(false);

      // Show error message to user
      if (cachedElements.resultsContainer) {
        cachedElements.resultsContainer.innerHTML = `<div style="text-align: center; color: #d32f2f; padding: 20px;">⚠️ Error scanning segments. Please try again.</div>`;
      }
    } finally {
      isScanning = false;
    }
  }

  /**
   * Analyze a street name and determine if it needs fixing
   * @param {string} streetName - The street name to analyze
   * @returns {Object} Analysis result with needsFix, suggested, and reason properties
   */
  function analyzeStreetName(streetName) {
    if (!streetName) return { needsFix: false };

    const currentWords = streetName.split(/\s+/);
    let proposedWords = [...currentWords];
    let changed = false;
    let reasons = [];

    // Check for NH-[A-Z0-9] pattern (e.g., "NH-ABC", "NH-125A" should have capital letters)
    const nhLetterPattern = /^(NH)-([a-z0-9]+)(?:\s|$)/i;
    const nhLetterMatch = streetName.match(nhLetterPattern);
    if (nhLetterMatch) {
      // Extract the alphanumeric part and ensure letters are capitalized
      const nhCode = nhLetterMatch[1].toUpperCase(); // NH
      const alphaPart = nhLetterMatch[2].replace(/[a-z]/g, (c) => c.toUpperCase()); // ABC, 125A, etc.
      const rest = streetName.substring(nhLetterMatch[0].length).trim();
      const suggested = rest ? `${nhCode}-${alphaPart} ${rest}` : `${nhCode}-${alphaPart}`;
      
      if (streetName !== suggested) {
        return {
          needsFix: true,
          suggested: suggested,
          reason: `Highway format: Ensure capital letters in NH-[code]`,
        };
      }
      return { needsFix: false };
    }

    // Check for highway patterns first (e.g., "NH41 - रा४१" should become "NH41 - रारा०१")
    const hwyPattern = /^(NH\d{2})\s*-\s*(.+)$/i;
    const hwyMatch = streetName.match(hwyPattern);
    if (hwyMatch) {
      const hwyCode = hwyMatch[1];
      const hwyPart = hwyMatch[2].trim();

      // Preserve highway names ending with approved abbreviations or "Hwy" or "Ring Rd"
      // This includes: "NH41 - Prithvi Hwy", "NH39 - KTM Ring Rd", "NH77 - Bharatpur Ring Rd"
      const approvedSuffixPattern = new RegExp(`\\s+(${Object.keys(wmernh_approvedAbbr).join('|')}|Hwy|Ring\\s+Rd)$`, 'i');
      if (hwyPart.match(approvedSuffixPattern)) {
        return { needsFix: false };
      }

      // Check if the highway part needs fixing (e.g., "Ringroad" -> "Ring Rd")
      const hwyWords = hwyPart.split(/\s+/);
      let hwyProposedWords = [...hwyWords];
      let hwyChanged = false;

      for (let i = 0; i < hwyWords.length; i++) {
        const word = hwyWords[i];
        const wordLower = word.toLowerCase();

        // Check for "Ringroad" -> "Ring Rd"
        if (wordLower === 'ringroad') {
          hwyProposedWords[i] = 'Ring';
          hwyProposedWords.push('Rd');
          hwyChanged = true;
          break;
        }

        // Check general suggestions
        const generalSuggestionKeyCi = Object.keys(wmernh_generalWordSuggestions).find((k) => k.toLowerCase() === wordLower);
        if (generalSuggestionKeyCi) {
          const suggestedGeneralAbbr = wmernh_generalWordSuggestions[generalSuggestionKeyCi];
          if (suggestedGeneralAbbr.toLowerCase() !== wordLower) {
            hwyProposedWords[i] = suggestedGeneralAbbr;
            hwyChanged = true;
          }
        }

        // Check suffix suggestions
        const devanagariSuggestion = wmernh_suggestedAbbr[word];
        if (devanagariSuggestion && devanagariSuggestion !== word) {
          hwyProposedWords[i] = devanagariSuggestion;
          hwyChanged = true;
        }
      }

      if (hwyChanged) {
        const newHwyPart = wmernh_titleCase(hwyProposedWords.join(' '));
        const newSuggestion = `${hwyCode.toUpperCase()} - ${newHwyPart}`;
        if (streetName !== newSuggestion) {
          return {
            needsFix: true,
            suggested: newSuggestion,
            reason: `Highway format: ${hwyPart} → ${newHwyPart}`,
          };
        }
      }

      // Check if exact highway mapping exists
      // Only apply if the highway part is NOT already an English name (i.e., contains no Latin letters)
      const hwyKey = `${hwyCode.toUpperCase()}-`;
      const suggestedHwy = wmernh_suggestedHwyAbbr[hwyKey];

      if (suggestedHwy && streetName !== suggestedHwy && !/[A-Za-z]/.test(hwyPart)) {
        return {
          needsFix: true,
          suggested: suggestedHwy,
          reason: `Highway format: ${streetName} → ${suggestedHwy}`,
        };
      }
    }

    // Check for standalone Devanagari abbreviations in any position
    for (let i = 0; i < currentWords.length; i++) {
      const word = currentWords[i];
      const devanagariSuggestion = wmernh_suggestedAbbr[word];
      if (devanagariSuggestion && devanagariSuggestion !== word) {
        proposedWords[i] = devanagariSuggestion;
        changed = true;
        reasons.push(`${word} → ${devanagariSuggestion}`);
      }
    }

    // Process pre-suffix words
    if (currentWords.length > 1) {
      for (let i = 0; i < currentWords.length - 1; i++) {
        const word = currentWords[i];
        const wordLower = word.toLowerCase();

        // Skip if already processed as Devanagari
        if (proposedWords[i] !== currentWords[i]) continue;

        const generalSuggestionKeyCi = Object.keys(wmernh_generalWordSuggestions).find((k) => k.toLowerCase() === wordLower);
        if (generalSuggestionKeyCi) {
          const suggestedGeneralAbbr = wmernh_generalWordSuggestions[generalSuggestionKeyCi];
          if (suggestedGeneralAbbr.toLowerCase() !== wordLower) {
            proposedWords[i] = suggestedGeneralAbbr;
            changed = true;
            reasons.push(`${word} → ${suggestedGeneralAbbr}`);
          }
        }
      }
    }

    // Process suffix (last word) - only if not already processed
    if (currentWords.length > 0 && proposedWords[proposedWords.length - 1] === currentWords[currentWords.length - 1]) {
      const potentialSuffix = currentWords[currentWords.length - 1];
      const suffixAnalysis = wmernh_analyzeSuffix(potentialSuffix);

      if (suffixAnalysis.status === 'check' && suffixAnalysis.proposed.toLowerCase() !== potentialSuffix.toLowerCase()) {
        proposedWords[currentWords.length - 1] = suffixAnalysis.proposed;
        changed = true;
        reasons.push(suffixAnalysis.message || `${potentialSuffix} → ${suffixAnalysis.proposed}`);
      }
    }

    const finalProposed = wmernh_titleCase(proposedWords.join(' '));
    const capitalizationChanged = streetName !== finalProposed;

    if (changed || capitalizationChanged) {
      return {
        needsFix: true,
        suggested: finalProposed,
        reason: reasons.length > 0 ? reasons.join(', ') : 'Capitalization',
      };
    }

    return { needsFix: false };
  }

  function updateProgress(show, percent = 1) {
    const progressBar = cachedElements.progressBar;
    const scanCounter = cachedElements.scanCounter;

    if (!progressBar || !scanCounter) return;

    const spinner = scanCounter.querySelector('i');

    if (show) {
      progressBar.style.display = 'block';
      progressBar.style.width = Math.max(percent, 1) + '%';
      if (spinner) {
        spinner.className = 'fa fa-spinner rnh-spinner';
      }
    } else {
      progressBar.style.display = 'none';
      if (spinner) {
        spinner.className = 'fa fa-check-circle rnh-complete-icon';
      }
    }
  }

  function updateScanCounter(count) {
    const scanCounter = cachedElements.scanCounter;
    if (!scanCounter) return;

    const span = scanCounter.querySelector('span');
    if (span) {
      span.textContent = `Scanned: ${count} segments`;
    }
  }

  /**
   * Display scan results in the sidebar
   */
  function displayResults() {
    const resultsContainer = cachedElements.resultsContainer;
    const fixAllButton = cachedElements.fixAllButton;

    if (!resultsContainer) return;

    resultsContainer.innerHTML = '';

    if (scannedSegments.length === 0) {
      resultsContainer.innerHTML = '<div class="rnh-no-issues">✓ No issues found!</div>';
      if (fixAllButton) fixAllButton.disabled = true;
      return;
    }

    if (fixAllButton) fixAllButton.disabled = false;

    // Limit displayed segments for performance
    const displaySegments = scannedSegments.slice(0, MAX_SEGMENTS_TO_DISPLAY);
    const hiddenCount = scannedSegments.length - displaySegments.length;

    if (hiddenCount > 0) {
      const warningDiv = document.createElement('div');
      warningDiv.style.cssText = 'text-align: center; color: #ff9800; padding: 10px; background: #fff3e0; margin-bottom: 10px; border-radius: 4px; font-size: 12px;';
      warningDiv.textContent = `⚠️ Showing ${displaySegments.length} of ${scannedSegments.length} segments (limited for performance). Fix these first, then rescan.`;
      resultsContainer.appendChild(warningDiv);
    }

    displaySegments.forEach((segment) => {
      const item = document.createElement('div');
      item.className = 'rnh-segment-item';

      // Add hover event listeners for highlighting
      item.onmouseenter = () => highlightSegmentOnHover(segment.id);
      item.onmouseleave = () => clearHoverHighlight();

      // Header with segment ID and road type
      const header = document.createElement('div');
      header.className = 'rnh-segment-header';

      const segmentId = document.createElement('span');
      segmentId.className = 'rnh-segment-id';
      segmentId.textContent = `Segment #${segment.id}`;
      segmentId.title = 'Click to select segment';
      segmentId.onclick = () => selectSegment(segment.id);

      const roadType = document.createElement('span');
      roadType.className = 'rnh-road-type';
      const roadTypeObj = sdk.DataModel.Segments.getRoadTypes().find((rt) => rt.id === segment.roadType);
      roadType.textContent = roadTypeObj ? roadTypeObj.localizedName : 'Unknown';

      header.appendChild(segmentId);
      header.appendChild(roadType);
      item.appendChild(header);

      // Display issues
      segment.issues.forEach((issue) => {
        const nameRow = document.createElement('div');
        nameRow.className = 'rnh-name-row';

        const label = document.createElement('span');
        label.className = 'rnh-name-label';
        label.textContent = issue.type === 'primary' ? 'Name:' : `Alt ${issue.index + 1}:`;

        const current = document.createElement('span');
        current.className = 'rnh-current-name';
        current.textContent = issue.current;

        const arrow = document.createElement('span');
        arrow.textContent = ' → ';

        const suggested = document.createElement('span');
        suggested.className = 'rnh-suggested-name';
        suggested.textContent = issue.suggested;

        nameRow.appendChild(label);
        nameRow.appendChild(current);
        nameRow.appendChild(arrow);
        nameRow.appendChild(suggested);

        item.appendChild(nameRow);
      });

      // Fix button
      const fixButton = document.createElement('button');
      fixButton.className = 'rnh-fix-button';
      fixButton.textContent = 'Fix';
      fixButton.onclick = () => fixSegmentNames(segment);
      item.appendChild(fixButton);

      resultsContainer.appendChild(item);
    });
  }

  async function selectSegment(segmentId) {
    try {
      const segment = sdk.DataModel.Segments.getById({ segmentId: segmentId });
      if (!segment) {
        console.warn(`${scriptName}: Segment ${segmentId} not found`);
        WazeToastr.Alerts.info(scriptName, `Segment ${segmentId} not found. It may have been deleted.`);
        return;
      }

      // First, select the segment in WME
      sdk.Editing.setSelection({ selection: { ids: [segmentId], objectType: 'segment' } });

      // Then try to center the map on it
      if (!segment.geometry || !segment.geometry.coordinates) {
        console.warn(`${scriptName}: Segment ${segmentId} has no geometry, but selected in editor`);
        return;
      }

      // Calculate center of segment geometry
      if (segment.geometry.type === 'LineString' && segment.geometry.coordinates.length > 0) {
        const coords = segment.geometry.coordinates;

        // Validate the coordinates array
        if (!coords || coords.length === 0) {
          console.warn(`${scriptName}: Segment ${segmentId} has empty coordinates array`);
          return;
        }

        const midIndex = Math.floor(coords.length / 2);
        const centerPoint = coords[midIndex];

        // Validate coordinates
        if (!centerPoint || !Array.isArray(centerPoint) || centerPoint.length < 2) {
          console.error(`${scriptName}: Invalid coordinate format for segment ${segmentId}:`, centerPoint);
          return;
        }

        // Ensure coordinates are numbers (geometry coordinates might be strings)
        const lon = Number(centerPoint[0]);
        const lat = Number(centerPoint[1]);

        // Validate lon/lat are valid numbers
        if (isNaN(lon) || isNaN(lat)) {
          console.error(`${scriptName}: Invalid lon/lat values for segment ${segmentId}: lon=${centerPoint[0]}, lat=${centerPoint[1]}`);
          return;
        }

        console.log(`${scriptName}: Centering map on segment ${segmentId} at [${lon}, ${lat}]`);
        sdk.Map.setMapCenter({ lonLat: { lon, lat } });

        // Zoom to a good level to see the segment
        const currentZoom = sdk.Map.getZoomLevel();
        if (currentZoom < 4) {
          sdk.Map.setZoomLevel({ zoomLevel: 4 });
        }
      }
    } catch (error) {
      console.error(`${scriptName}: Error selecting segment ${segmentId}:`, error);
      // Don't show alert here since the segment is likely still selected in the editor
    }
  }

  /**
   * Fix naming issues for a single segment
   * @param {Object} segment - Segment object with issues to fix
   */
  async function fixSegmentNames(segment) {
    try {
      // Get the current city from the segment's existing streets (preserve city)
      const getCityForStreet = (streetId) => {
        if (!streetId) return null;
        const street = sdk.DataModel.Streets.getById({ streetId });
        return street && street.cityId ? street.cityId : null;
      };

      let newPrimaryStreetId = null;
      const altStreetUpdates = {}; // Only store streets that need updating
      let hasChanges = false;

      // Process each issue
      segment.issues.forEach((issue) => {
        if (issue.type === 'primary') {
          // Get the city from current primary street to preserve it
          const cityId = getCityForStreet(segment.primaryStreetId);
          if (!cityId) {
            console.warn(`${scriptName}: Cannot determine city for primary street, skipping`);
            return;
          }

          // Get or create street with suggested name in the same city
          let street = sdk.DataModel.Streets.getStreet({
            cityId: cityId,
            streetName: issue.suggested,
          });

          if (!street) {
            street = sdk.DataModel.Streets.addStreet({
              streetName: issue.suggested,
              cityId: cityId,
            });
          }

          newPrimaryStreetId = street.id;
          hasChanges = true;
          console.log(`${scriptName}: Primary street "${issue.current}" → "${issue.suggested}" (ID: ${street.id})`);
        } else if (issue.type === 'alt') {
          // Get the city from current alt street to preserve it
          const currentAltStreetId = segment.alternateStreetIds[issue.index];
          const cityId = getCityForStreet(currentAltStreetId);
          if (!cityId) {
            console.warn(`${scriptName}: Cannot determine city for alt street ${issue.index}, skipping`);
            return;
          }

          // Get or create alt street with suggested name in the same city
          let altStreet = sdk.DataModel.Streets.getStreet({
            cityId: cityId,
            streetName: issue.suggested,
          });

          if (!altStreet) {
            altStreet = sdk.DataModel.Streets.addStreet({
              streetName: issue.suggested,
              cityId: cityId,
            });
          }

          altStreetUpdates[issue.index] = altStreet.id;
          hasChanges = true;
          console.log(`${scriptName}: Alt street ${issue.index} "${issue.current}" → "${issue.suggested}" (ID: ${altStreet.id})`);
        }
      });

      // Only update if there are changes
      if (hasChanges) {
        // Build update parameters - only include what actually changed
        const updateParams = {
          segmentId: segment.id,
        };

        // Only include primaryStreetId if it changed
        if (newPrimaryStreetId) {
          updateParams.primaryStreetId = newPrimaryStreetId;
        }

        // Only include alternateStreetIds if at least one alt street changed
        if (Object.keys(altStreetUpdates).length > 0) {
          const newAlternateStreetIds = [...(segment.alternateStreetIds || [])];
          Object.keys(altStreetUpdates).forEach((index) => {
            newAlternateStreetIds[parseInt(index)] = altStreetUpdates[index];
          });
          updateParams.alternateStreetIds = newAlternateStreetIds;
        }

        console.log(`${scriptName}: Updating segment ${segment.id}:`, updateParams);
        await sdk.DataModel.Segments.updateAddress(updateParams);
        console.log(`${scriptName}: Successfully updated segment ${segment.id}`);
      } else {
        console.warn(`${scriptName}: No changes to apply for segment ${segment.id}`);
      }

      // Clear highlight and rescan after update
      if (previewEnabled) {
        sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER_NAME });
      }
      setTimeout(() => debouncedScan(), RESCAN_DELAY_AFTER_FIX);
    } catch (error) {
      console.error(`${scriptName}: Error fixing segment ${segment.id}:`, error);
      WazeToastr.Alerts.error(scriptName, `Failed to update segment ${segment.id}. Check console for details.`);
    }
  }

  /**
   * Fix naming issues for all scanned segments
   */
  async function fixAllNames() {
    const fixAllButton = cachedElements.fixAllButton;

    try {
      updateProgress(true, 1);
      if (fixAllButton) {
        fixAllButton.disabled = true;
        fixAllButton.textContent = 'Fixing...';
      }

      let processed = 0;
      let failed = 0;
      const total = scannedSegments.length;

      for (const segment of scannedSegments) {
        try {
          await fixSegmentNames(segment);
          processed++;
        } catch (err) {
          failed++;
          console.error(`${scriptName}: Failed to fix segment ${segment.id}:`, err);
        }
        updateProgress(true, (processed / total) * 100);
      }

      updateProgress(false);

      if (failed > 0) {
        console.warn(`${scriptName}: Fixed ${processed} segments, ${failed} failed`);
      }

      // Rescan to update results
      setTimeout(() => {
        debouncedScan();
      }, RESCAN_DELAY_AFTER_FIX);
    } catch (error) {
      console.error(`${scriptName}: Error fixing all names:`, error);
      updateProgress(false);
    } finally {
      if (fixAllButton) {
        fixAllButton.textContent = 'Fix All Names';
      }
    }
  }

  /**
   * Initialize the highlight layer for previewing segments
   */
  function initLayer() {
    try {
      sdk.Map.addLayer({
        layerName: LAYER_NAME,
        styleRules: [
          {
            style: {
              strokeColor: '#ff8800',
              strokeDashstyle: 'solid',
              strokeWidth: 35,
            },
          },
        ],
      });

      const zIndex = sdk.Map.getLayerZIndex({ layerName: 'roads' }) - 3;
      sdk.Map.setLayerZIndex({ layerName: LAYER_NAME, zIndex });
      sdk.Map.setLayerOpacity({ layerName: LAYER_NAME, opacity: 0.6 });

      // HACK to prevent layer z-index from drifting above roads layer
      const checkLayerZIndex = () => {
        const currentZIndex = sdk.Map.getLayerZIndex({ layerName: LAYER_NAME });
        if (currentZIndex !== zIndex) {
          sdk.Map.setLayerZIndex({ layerName: LAYER_NAME, zIndex });
        }
      };
      setInterval(() => {
        checkLayerZIndex();
      }, 100);
      // END HACK

      console.log(`${scriptName}: Highlight layer initialized`);
    } catch (error) {
      console.error(`${scriptName}: Error initializing layer:`, error);
    }
  }

  /**
   * Highlight a single segment on hover
   * @param {number} segmentId - Segment ID to highlight
   */
  function highlightSegmentOnHover(segmentId) {
    try {
      const segment = sdk.DataModel.Segments.getById({ segmentId });
      if (!segment || !segment.geometry) return;

      const features = [
        {
          type: 'Feature',
          id: 0,
          geometry: segment.geometry,
        },
      ];

      sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER_NAME });
      sdk.Map.addFeaturesToLayer({ layerName: LAYER_NAME, features });
    } catch (error) {
      console.error(`${scriptName}: Error highlighting segment on hover:`, error);
    }
  }

  /**
   * Clear hover highlight and restore preview highlights if enabled
   */
  function clearHoverHighlight() {
    if (previewEnabled) {
      // Restore all highlights if preview is enabled
      highlightSegments();
    } else {
      // Clear all highlights
      sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER_NAME });
    }
  }

  /**
   * Highlight segments with issues on the map
   */
  function highlightSegments() {
    try {
      if (!previewEnabled) {
        sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER_NAME });
        return;
      }

      const features = scannedSegments.map((segment) => {
        const seg = sdk.DataModel.Segments.getById({ segmentId: segment.id });
        return {
          type: 'Feature',
          id: 0,
          geometry: seg.geometry,
        };
      });

      sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER_NAME });
      sdk.Map.addFeaturesToLayer({ layerName: LAYER_NAME, features });

      console.log(`${scriptName}: Highlighted ${features.length} segments`);
    } catch (error) {
      console.error(`${scriptName}: Error highlighting segments:`, error);
    }
  }

  /**
   * Handle preview checkbox change
   */
  function onPreviewChanged(event) {
    previewEnabled = event.target.checked;
    localStorage.setItem('wme-rnh-preview-enabled', previewEnabled);
    console.log(`${scriptName}: Preview ${previewEnabled ? 'enabled' : 'disabled'}`);

    if (previewEnabled) {
      highlightSegments();
    } else {
      sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER_NAME });
    }
  }

  /**
   * Set up listener to detect country changes and reload data.
   * Watches for 'wme-map-move-end' events; if the top country changes, reloads spreadsheet data.
   */
  function setupCountryChangeListener() {
    sdk.Events.on({
      eventName: 'wme-map-move-end',
      eventHandler: async () => {
        try {
          const topCountry = sdk.DataModel.Countries.getTopCountry();
          if (topCountry && topCountry.abbr && topCountry.abbr !== activeCountryCode) {
            console.log(`[WMERNH] Country changed from "${activeCountryCode}" to "${topCountry.abbr}", reloading data...`);
            await loadCountryData();
          }
        } catch (e) {
          console.warn('[WMERNH] Error checking for country change:', e);
        }
      }
    });
  }

  async function wmernh_bootstrap() {
    const wmeSdk = getWmeSdk({ scriptId: `${SCRIPT_ID}`, scriptName: `${scriptName}` });
    sdk = wmeSdk;
    sdk.Events.once({ eventName: 'wme-ready' }).then(async () => {
      initLayer();
      scriptupdatemonitor();
      await loadCountryData();
      wmernh_init();
      setupCountryChangeListener();
    });
  }

  function waitForWME() {
    if (!unsafeWindow.SDK_INITIALIZED) {
      setTimeout(waitForWME, 500);
      return;
    }
    unsafeWindow.SDK_INITIALIZED.then(wmernh_bootstrap);
  }
  waitForWME();

  function scriptupdatemonitor() {
    if (WazeToastr?.Ready) {
      // Create and start the ScriptUpdateMonitor
      // For GitHub raw URLs, we need to specify metaUrl explicitly (same as downloadUrl for GitHub)
      const updateMonitor = new WazeToastr.Alerts.ScriptUpdateMonitor(
        scriptName,
        scriptVersion,
        downloadUrl,
        GM_xmlhttpRequest,
        downloadUrl, // metaUrl - for GitHub, use the same URL as it contains the @version tag
        /@version\s+(.+)/i, // metaRegExp - extracts version from @version tag
      );
      updateMonitor.start(2, true); // Check every 2 hours, check immediately

      // Show the update dialog for the current version
      WazeToastr.Interface.ShowScriptUpdate(scriptName, scriptVersion, updateMessage, downloadUrl, forumURL);
    } else {
      setTimeout(scriptupdatemonitor, 250);
    }
  }
  /*
Changelog:
Version 2026.04.11.01:
- Now it will detect NH-[A-Z0-9] patterns and ensure capital letters.<br>
- Now it will detect MDR-[A-Z0-9] patterns and ensure capital letters.<br>
-Temporary disablement of "Road" to "Rd" abbreviation due to common usage of "Road" in Nepal and potential confusion with "Rd" abbreviation.<br>
Version 2026.02.24.02:
<strong>New Features & Fixes:</strong><br>
- The "नेपा." button now uses the WME SDK to add the translated Nepali name as an alternative name for the selected segment (no more DOM manipulation).<br>
- The previous DOM-based alt name update logic is commented out for reference.<br>
- Translation logic now ensures that if the original text contains " - " (space-hyphen-space), the translated Nepali output will also have spaces before and after the hyphen, matching the English style.<br>
- Various bug fixes and improvements.<br>
Version 2026.02.24.01:
<strong>New Features:</strong><br> - Added a "Translate to Nepali" button in the UI that translates the current road name to Nepali using Google Translate API, with special handling for certain keywords like "Road" and "Ring Road".<br> - The translation function includes special-case rules for common road-related terms to ensure more accurate translations (e.g., "Ring Road" becomes "चक्रपथ").<br> - If a special-case translation is applied, it will recursively check if further translation is needed, allowing for multi-step translations (e.g., "Ring Road" -> "चक्रपथ" without leaving any English words untranslated).<br>
Version 2026.01.18.01:
- Fixed name checking for NH39 - KTM Ring Rd.
- Fixed for wrong suggestion for KTM Ring Rd.
- Fixed for NH77 - Bharatpur Ringroad now suggested as NH77 - Bharatpur Ring Rd.
Version 2026.01.16.01:
 - Fixed name checking for NH39 - KTM Ring Rd.
 - Fixed for wrong suggestion for KTM.
2026.01.16.01
- Temporary fix for alerts not displaying properly.
2025.12.02.01
- Added sidebar panel "RNH" (Road Name Helper) for scanning road names
- Automatically scan on-screen segments while panning around
- Display road names with issues including alt names
- One-click fix for individual segments or all at once
- Added Devanagari number mappings from रा१० through रा८०

2025.06.18.01
- Restored AH02 to AH2.

2025.06.15.02
- Added: Typing "AH2" now suggests "AH02"
- Added: Typing "NH01 - रा१" or using suffix "रा१" now suggests "NH01 - रारा०१"
- Improved: Custom suffix and highway code mapping logic for Nepali and highway abbreviations
- Fixed: Suffix suggestion logic for Nepali abbreviations
*/
})();
