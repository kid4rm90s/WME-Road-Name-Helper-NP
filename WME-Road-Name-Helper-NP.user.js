// ==UserScript==
// @name            WME Road Name Helper NP
// @description     Check suffix and common word abbreviations without leaving WME
// @version         2025.06.06.04
// @author          Kid4rm90s
// @license         MIT
// @match           *://*.waze.com/*editor*
// @exclude         *://*.waze.com/user/editor*
// @connect         greasyfork.org
// @grant           GM_xmlhttpRequest
// @namespace       https://greasyfork.org/users/1087400
// @require         https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @downloadURL    https://update.greasyfork.org/scripts/538171/WME%20Road%20Name%20Helper%20NP.user.js
// @updateURL      https://update.greasyfork.org/scripts/538171/WME%20Road%20Name%20Helper%20NP.meta.js

// ==/UserScript==
/* Thanks to its Original author Brandon28AU (https://greasyfork.org/en/scripts/493429-wme-standard-suffix-abbreviations) for allowing me to modify his script*/

/* global WazeWrap */

(function() {
    'use strict';
    const updateMessage = `
- Highway suggestions (e.g. NH01 - रारा०१) now only appear on exact match (e.g. "NH01-")<br>
- Tab key support: Press Tab to accept a suggestion when available<br>
- Improved capitalization for highway codes (e.g. "nh01" auto-capitalizes to "NH01")<br>
- Internal refactor: highway suggestions separated from standard suffix suggestions
`;
    const SCRIPT_VERSION = GM_info.script.version.toString();
    const SCRIPT_NAME = GM_info.script.name;
    const DOWNLOAD_URL = GM_info.script.downloadURL;
    const GreasyFork_URL = "https://greasyfork.org/en/scripts/538171-wme-road-name-helper-np";
    const forumURL = "https://greasyfork.org/en/scripts/538171-wme-road-name-helper-np/feedback";
    let sdk;
	
    // Suffix Abbreviation Data (Abbreviation: FullWord)
    // This is for suffixes that have standard abbreviations
    const wmessa_approvedAbbr = {"Ally": "Alley", "App": "Approach", "Arc": "Arcade", "Av": "Avenue", "Bwlk": "Boardwalk", "Bvd": "Boulevard", "Brk": "Break", "Bypa": "Bypass", "Ch": "Chase", "Cct": "Circuit", "Cl": "Close", "Con": "Concourse", "Ct": "Court", "Cr": "Crescent", "Crst": "Crest", "Dr": "Drive", "Ent": "Entrance", "Esp": "Esplanade", "Exp": "Expressway", "Ftrl": "Firetrail", "Fwy": "Freeway", "Glde": "Glade", "Gra": "Grange", "Gr": "Grove", "Hwy": "Highway", "Mwy": "Motorway", "Pde": "Parade", "Pwy": "Parkway", "Psge": "Passage", "Pl": "Place", "Plza": "Plaza", "Prom": "Promenade", "Qys": "Quays", "Rtt": "Retreat", "Rdge": "Ridge", "Rd": "Road", "Sq": "Square", "Stps": "Steps", "St": "Street", "Sbwy": "Subway", "Tce": "Terrace", "Trk": "Track", "Trl": "Trail", "Vsta": "Vista"};

    // Suffix Suggestion Data (UserTyped/FullWord: CorrectAbbreviation)
    // This is for suffixes that have specific suggestions
    const wmessa_suggestedAbbr = {
    "Alley": "Ally", "Approach": "App", "Arcade": "Arc", "Avenue": "Av", "Boardwalk": "Bwlk", "Boulevard": "Bvd", "Blvd": "Bvd", "Break": "Brk", "Bypass": "Bypa", "Chase": "Ch", "Circuit": "Cct", "Close": "Cl", "Concourse": "Con", "Court": "Ct", "Crescent": "Cr", "Crest": "Crst", "Drive": "Dr", "Entrance": "Ent", "Esplanade": "Esp", "Expressway": "Exp", "Firetrail": "Ftrl", "Freeway": "Fwy", "Glade": "Glde", "Grange": "Gra", "Grove": "Gr", "Highway": "Hwy", "Ln": "Lane", "Marg": "Marga", "Motorway": "Mwy", "Parade": "Pde", "Parkway": "Pwy", "Passage": "Psge", "Place": "Pl", "Plaza": "Plza", "Promenade": "Prom", "Quays": "Qys", "Retreat": "Rtt", "Ridge": "Rdge", "Road": "Rd", "Square": "Sq", "Steps": "Stps", "Street": "St", "Subway": "Sbwy", "Terrace": "Tce", "Track": "Trk", "Trail": "Trl", "Vista": "Vsta"};

    // Suffixes that should be preserved in title case (case-insensitive)
    // These words will not be converted to lowercase in title case
    // This is useful for words that are proper nouns or have specific casing requirements.
    const wmessa_preserveCaseWords = [
        "NH01", "NH02", "NH03", "NH04", "NH05", "NH06", "NH07", "NH08", "NH09", "NH10",
        "NH11", "NH12", "NH13", "NH14", "NH15", "NH16", "NH17", "NH18", "NH19", "NH20",
        "NH21", "NH22", "NH23", "NH24", "NH25", "NH26", "NH27", "NH28", "NH29", "NH30",
        "NH31", "NH32", "NH33", "NH34", "NH35", "NH36", "NH37", "NH38", "NH39", "NH40",
        "NH41", "NH42", "NH43", "NH44", "NH45", "NH46", "NH47", "NH48", "NH49", "NH50",
        "NH51", "NH52", "NH53", "NH54", "NH55", "NH56", "NH57", "NH58", "NH59", "NH60",
        "NH61", "NH62", "NH63", "NH64", "NH65", "NH66", "NH67", "NH68", "NH69", "NH70",
        "NH71", "NH72", "NH73", "NH74", "NH75", "NH76", "NH77", "NH78", "NH79", "NH80"
    ];

    // Highway Suffix Suggestion Data (EXACT match only)
    // This is for highway abbreviations that have specific suggestions
    const wmessa_suggestedHwyAbbr = {
    "NH01-": "NH01 - रारा०१", "NH02-": "NH02 - रारा०२", "NH03-": "NH03 - रारा०३", "NH04-": "NH04 - रारा०४", "NH05-": "NH05 - रारा०५", "NH06-": "NH06 - रारा०६", "NH07-": "NH07 - रारा०७", "NH08-": "NH08 - रारा०८", "NH09-": "NH09 - रारा०९", "NH10-": "NH10 - रारा१०", 
    "NH11-": "NH11 - रारा११   ", "NH12-": "NH12 - रारा१२", "NH13-": "NH13 - रारा१३", "NH14-": "NH14 - रारा१४", "NH15-": "NH15 - रारा१५", "NH16-": "NH16 - रारा१६", "NH17-": "NH17 - रारा१७", "NH18-": "NH18 - रारा१८", "NH19-": "NH19 - रारा१९", "NH20-": "NH20 - रारा२०", "NH21-": "NH21 - रारा२१", "NH22-": "NH22 - रारा२२", "NH23-": "NH23 - रारा२३", "NH24-": "NH24 - रारा२४", "NH25-": "NH25 - रारा२५", "NH26-": "NH26 - रारा२६", "NH27-": "NH27 - रारा२७", "NH28-": "NH28 - रारा२८", "NH29-": "NH29 - रारा२९", "NH30-": "NH30 - रारा३०", "NH31-": "NH31 - रारा३१", "NH32-": "NH32 - रारा३२", "NH33-": "NH33 - रारा३३", "NH34-": "NH34 - रारा३४", "NH35-": "NH35 - रारा३५", "NH36-": "NH36 - रारा३६", "NH37-": "NH37 - रारा३७", "NH38-": "NH38 - रारा३८", "NH39-": "NH39 - रारा३९", "NH40-": "NH40 - रारा४०", "NH41-": "NH41 - रारा४१", "NH42-": "NH42 - रारा४२", "NH43-": "NH43 - रारा४३", "NH44-": "NH44 - रारा४४", "NH45-": "NH45 - रारा४५", "NH46-": "NH46 - रारा४६", "NH47-": "NH47 - रारा४७", "NH48-": "NH48 - रारा४८", "NH49-": "NH49 - रारा४९", "NH50-": "NH50 - रारा५०", "NH51-": "NH51 - रारा५१", "NH52-": "NH52 - रारा५२", "NH53-": "NH53 - रारा५३", "NH54-": "NH54 - रारा५४", "NH55-": "NH55 - रारा५५", "NH56-": "NH56 - रारा५६", "NH57-": "NH57 - रारा५७", "NH58-": "NH58 - रारा५८", "NH59-": "NH59 - रारा५९", "NH60-": "NH60 - रारा६०", "NH61-": "NH61 - रारा६१", "NH62-": "NH62 - रारा६२", "NH63-": "NH63 - रारा६३", "NH64-": "NH64 - रारा६४", "NH65-": "NH65 - रारा६५", "NH66-": "NH66 - रारा६६", "NH67-": "NH67 - रारा६७", "NH68-": "NH68 - रारा६८", "NH69-": "NH69 - रारा६९", "NH70-": "NH70 - रारा७०", "NH71-": "NH71 - रारा७१", "NH72-": "NH72 - रारा७२", "NH73-": "NH73 - रारा७३", "NH74-": "NH74 - रारा७४", "NH75-": "NH75 - रारा७५", "NH76-": "NH76 - रारा७६", "NH77-": "NH77 - रारा७७", "NH78-": "NH78 - रारा७८", "NH79-": "NH79 - रारा७९", "NH80-": "NH80 - रारा८०"
    };

    // Suffixes with No Standard Abbreviation
    const wmessa_knownNoAbbr = ["Lane", "Loop", "Mall", "Mews", "Path", "Ramp", "Rise", "View", "Walk", "Way"];

    // --- NEW DATA FOR GENERAL WORDS (PRE-SUFFIX) ---
    // General Word Suggestion Data (WordToAbbreviate: Abbreviation)
    const wmessa_generalWordSuggestions = {
        "Mount": "Mt",
        "Saint": "St", // Note: "St" for Saint. Suffix logic handles "St" for Street.
        "Fort": "Ft",
        "Marg": "Marga" // Example: "Marg Bryant Drive" -> "Marga Bryant Dr"
        // Add other common words like "North": "N", "South": "S", etc., if standard for pre-suffix words.
    };

    // General Word Approved Abbreviation Data (Abbreviation: FullWord) - for validation
    const wmessa_generalWordApprovedAbbr = {
        "Mt": "Mount",
        "St": "Saint",
        "Ft": "Fort",
        "Marga": "Marg"
        // e.g. "N": "North", "S": "South"
    };


    function wmessa_titleCase(str) {
    return str.split(/\s+/).map(function(txt) {
        // If word matches a preserve-case word (case-insensitive), use the preserved version
        const preserve = wmessa_preserveCaseWords.find(w => w.toLowerCase() === txt.toLowerCase());
        if (preserve) return preserve;
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }).join(' ');
   }

    let wmessa_valueObserver;


    function wmessa_init() {
        const observer = new MutationObserver((mutationsList) => {
            mutationsList.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.removedNodes.forEach(node => {
                        if (node.classList && node.classList.contains('address-edit-card')) {
                            if (wmessa_valueObserver) {
                                wmessa_valueObserver.disconnect();
                            }
                        }
                    });

                    mutation.addedNodes.forEach(node => {
                        if (node.classList && node.classList.contains('address-edit-card')) {
                            setTimeout(() => {
                                // Main street name								
                                const streetNameInput = node.querySelector('wz-autocomplete.street-name');
                                if (streetNameInput && streetNameInput.shadowRoot) {
                                     const wzTextInput = streetNameInput.shadowRoot.querySelector('wz-text-input');
                                     if (wzTextInput) {
                                         wmessa_monitor(wzTextInput);
                                     } else {
                                        console.warn("WMESSA: wz-text-input not found in street-name shadowRoot.");
                                     }
                                } else {
                                    console.warn("WMESSA: street-name input or its shadowRoot not found.");
                                }
                                // Alt street name(s)
                                const altStreetInputs = node.querySelectorAll('wz-autocomplete.alt-street-name');
                                altStreetInputs.forEach(altInput => {
                                    if (altInput && altInput.shadowRoot) {
                                        const altWzTextInput = altInput.shadowRoot.querySelector('wz-text-input');
                                        if (altWzTextInput) {
                                            wmessa_monitor(altWzTextInput);
                                        } else {
                                            console.warn("WMESSA: wz-text-input not found in alt-street-name shadowRoot.");
                                        }
                                    } else {
                                        console.warn("WMESSA: alt-street-name input or its shadowRoot not found.");
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
            console.warn("WMESSA: Edit panel not found for observer.");
        }
		
        WazeWrap.Interface.ShowScriptUpdate("WME Road Name Helper NP", GM_info.script.version, updateMessage, GreasyFork_URL, forumURL);
    }

    // Also observe for alt street card (for alt names)
    const altStreetPanelObserver = new MutationObserver((mutationsList) => {
        mutationsList.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.classList && node.classList.contains('edit-alt-street-card')) {
                        setTimeout(() => {
                            const altStreetInput = node.querySelector('wz-autocomplete.alt-street-name');
                            if (altStreetInput && altStreetInput.shadowRoot) {
                                const altWzTextInput = altStreetInput.shadowRoot.querySelector('wz-text-input');
                                if (altWzTextInput) {
                                    wmessa_monitor(altWzTextInput);
                                } else {
                                    console.warn("WMESSA: wz-text-input not found in alt-street-name shadowRoot (alt card).");
                                }
                            } else {
                                console.warn("WMESSA: alt-street-name input or its shadowRoot not found (alt card).");
                            }
                        }, 250);
                    }
                });
            }
        });
    });
    // Observe the whole document for alt street cards
    altStreetPanelObserver.observe(document.body, { childList: true, subtree: true });

    function wmessa_monitor(element) {
        let abbrContainer = document.createElement('div');
        abbrContainer.id = 'WMESSA_container';
        abbrContainer.innerHTML =
            '<div class="WMESSA_icon" title="WME Standard Suffix Abbreviations"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M4.5 2A2.5 2.5 0 0 0 2 4.5v2.879a2.5 2.5 0 0 0 .732 1.767l4.5 4.5a2.5 2.5 0 0 0 3.536 0l2.878-2.878a2.5 2.5 0 0 0 0-3.536l-4.5-4.5A2.5 2.5 0 0 0 7.38 2H4.5ZM5 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" /></svg></div>' +
            '<div id="WMESSA_output">Loading...</div>';
        
        const statusTextContainer = element.shadowRoot.querySelector('.status-text-container');
        if (!statusTextContainer) {
            console.warn("WMESSA: .status-text-container not found. UI will not be displayed.");
            return; 
        }
        statusTextContainer.insertBefore(abbrContainer, statusTextContainer.firstChild);

        let abbrOutput = abbrContainer.querySelector('#WMESSA_output');

        const css = [
            '.status-text-container {width: calc(100% + ' + (document.querySelector('#edit-panel .address-edit-card .street-name-row .tts-playback') ? document.querySelector('#edit-panel .address-edit-card .street-name-row .tts-playback').offsetWidth : 0) + 'px); display: flex; flex-direction: column-reverse;}',
            '#WMESSA_container {display: flex; align-items: center; flex-grow: 1; margin-top: var(--wz-label-margin, 8px); padding: 0 2px; border-radius: 5px; background: #ffffff; color: #ffffff; gap: 5px; cursor: default; transition: background 0.25s linear, color 0.25s linear; font-size: 0.9em;}',
            '#WMESSA_output {color: #000000; white-space: pre-wrap; flex-grow: 1;}',
            '.WMESSA_icon {display: inline-flex; padding: 2px; height: 12px; background: rgba(0,0,0,0.5); border-radius: 3px; flex-shrink: 0; margin-right: 5px;}',
            '.WMESSA_icon svg {height: 100%;}',
            '#WMESSA_container.info {background: #e0f2fe; color: #e0f2fe;}',
            '#WMESSA_container.check {background: #fef3c7; color: #fef3c7; cursor: pointer;}',
            '#WMESSA_container.check:hover {background: #fde68a; color: #fde68a;}',
            '#WMESSA_container.valid {background: #d1fae5; color: #d1fae5;}'
        ].join(' ');
        const styleElement = document.createElement('style');
        styleElement.type = 'text/css';
        styleElement.textContent = css;
        element.shadowRoot.appendChild(styleElement);


        if (wmessa_valueObserver) {
            wmessa_valueObserver.disconnect();
        }
        wmessa_valueObserver = new MutationObserver((mutationsList, observer) => {
            for(let mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                    wmessa_update(element, abbrContainer, abbrOutput);
                }
            }
        });
        wmessa_valueObserver.observe(element, { attributes: true });

        wmessa_update(element, abbrContainer, abbrOutput);

        // Add Tab key support for applying suggestion
        element.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                const abbrContainer = element.shadowRoot.querySelector('#WMESSA_container');
                if (abbrContainer && abbrContainer.classList.contains('check')) {
                    const abbrOutput = abbrContainer.querySelector('#WMESSA_output');
                    // Simulate click to apply suggestion
                    abbrContainer.click();
                    e.preventDefault();
                }
            }
        });
    }

    function wmessa_analyzeSuffix(suffix) {
        const suffixLower = suffix.toLowerCase();
        let result = { status: 'info', message: 'No match for suffix.', proposed: suffix, original: suffix };

        const isKnownNoAbbrExact = (sLower) => wmessa_knownNoAbbr.some(kna => kna.toLowerCase() === sLower);
        const getKnownNoAbbrCased = (sLower) => wmessa_knownNoAbbr.find(kna => kna.toLowerCase() === sLower);

        // 0. Exact match for highway abbreviations (special case)
        const hwyKey = Object.keys(wmessa_suggestedHwyAbbr).find(key => key.toLowerCase() === suffixLower);
        if (hwyKey) {
            const suggestedHwy = wmessa_suggestedHwyAbbr[hwyKey];
            if (suggestedHwy.toLowerCase() !== suffixLower) {
                return { status: 'check', message: `Use ${suggestedHwy} for ${hwyKey}`, proposed: suggestedHwy, original: suffix };
            } else {
                return { status: 'valid', message: `${suggestedHwy}`, proposed: suggestedHwy, original: suffix };
            }
        }

        // 1. Exact match: Typed IS an approved abbreviation (e.g., "Rd")
        if (wmessa_approvedAbbr.hasOwnProperty(suffix)) {
            return { status: 'valid', message: `${suffix} for ${wmessa_approvedAbbr[suffix]}`, proposed: suffix, original: suffix };
        }
        const approvedKeyCi = Object.keys(wmessa_approvedAbbr).find(k => k.toLowerCase() === suffixLower);
        if (approvedKeyCi) {
             return { status: 'valid', message: `${approvedKeyCi} for ${wmessa_approvedAbbr[approvedKeyCi]}`, proposed: approvedKeyCi, original: suffix };
        }

        // 2. Exact match: Typed IS a known non-abbreviated suffix (e.g., "Lane")
        if (isKnownNoAbbrExact(suffixLower)) {
            const casedNoAbbr = getKnownNoAbbrCased(suffixLower) || suffix;
            return { status: 'valid', message: casedNoAbbr, proposed: casedNoAbbr, original: suffix };
        }

        const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const suffixRegex = new RegExp(`^${escapedSuffix}`, 'i');

        // 3. Suggestion: Typed is (prefix of) a full word that should be abbreviated (e.g., "Street" or "Stre" -> "St")
        let suggestFromFullKey = Object.keys(wmessa_suggestedAbbr).find(key => key.toLowerCase() === suffixLower);
        if (!suggestFromFullKey) {
            suggestFromFullKey = Object.keys(wmessa_suggestedAbbr).find(key => suffixRegex.test(key));
        }
        if (suggestFromFullKey) {
            const suggestedAbbr = wmessa_suggestedAbbr[suggestFromFullKey];
            if (suggestedAbbr.toLowerCase() !== suffixLower) {
                return { status: 'check', message: `Use ${suggestedAbbr} for ${suggestFromFullKey}`, proposed: suggestedAbbr, original: suffix };
            } else { // Typed the same as the suggestion (e.g. typed "Lane", suggested "Lane" because "Ln":"Lane")
                if (isKnownNoAbbrExact(suggestedAbbr.toLowerCase())) {
                    const casedNoAbbr = getKnownNoAbbrCased(suggestedAbbr.toLowerCase()) || suggestedAbbr;
                    return { status: 'valid', message: casedNoAbbr, proposed: casedNoAbbr, original: suffix };
                }
                const finalApprovedKeyCi = Object.keys(wmessa_approvedAbbr).find(k => k.toLowerCase() === suggestedAbbr.toLowerCase());
                if (finalApprovedKeyCi) {
                    return { status: 'valid', message: `${finalApprovedKeyCi} for ${wmessa_approvedAbbr[finalApprovedKeyCi]}`, proposed: finalApprovedKeyCi, original: suffix };
                }
            }
        }

        // 4. Suggestion: Typed is (prefix of) a known non-abbreviated word (e.g., "Lan" -> "Lane")
        const knownNoAbbrCompletion = wmessa_knownNoAbbr.find(key => suffixRegex.test(key));
        if (knownNoAbbrCompletion && knownNoAbbrCompletion.toLowerCase() !== suffixLower) {
            return { status: 'check', message: `Use ${knownNoAbbrCompletion}`, proposed: knownNoAbbrCompletion, original: suffix };
        }

        // 5. Suggestion: Typed is (prefix of) an approved abbreviation (e.g., "Al" -> "Ally")
        const approvedAbbrCompletionKey = Object.keys(wmessa_approvedAbbr).find(key => suffixRegex.test(key));
         if (approvedAbbrCompletionKey && approvedAbbrCompletionKey.toLowerCase() !== suffixLower) {
            return { status: 'check', message: `Use ${approvedAbbrCompletionKey} for ${wmessa_approvedAbbr[approvedAbbrCompletionKey]}`, proposed: approvedAbbrCompletionKey, original: suffix };
        }
        
        return result;
    }


    function wmessa_update(element, abbrContainer, abbrOutput) {
        abbrContainer.classList.remove('valid', 'check', 'info');
        abbrContainer.onclick = null;
        abbrOutput.innerText = 'Awaiting input...';

        const currentValue = element.value.trim();
        if (!currentValue) {
            return;
        }

        if (currentValue.match(/^The [a-zA-Z0-9\s'-]+$/i) && currentValue.split(/\s+/).length <= 3) { // "The x" or "The x y"
            abbrContainer.classList.add('info');
            abbrOutput.innerText = 'Do not abbreviate \'The x\' names';
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

                const generalApprovedKeyCi = Object.keys(wmessa_generalWordApprovedAbbr).find(k => k.toLowerCase() === wordLower);
                if (generalApprovedKeyCi) { // Word is already an approved general abbreviation
                    if (word !== generalApprovedKeyCi) { // Correct casing if needed
                        proposedWords[i] = generalApprovedKeyCi;
                        preSuffixChangesMade = true;
                    }
                    continue;
                }

                const generalSuggestionKeyCi = Object.keys(wmessa_generalWordSuggestions).find(k => k.toLowerCase() === wordLower);
                if (generalSuggestionKeyCi) {
                    const suggestedGeneralAbbr = wmessa_generalWordSuggestions[generalSuggestionKeyCi];
                    if (suggestedGeneralAbbr.toLowerCase() !== wordLower) {
                        proposedWords[i] = suggestedGeneralAbbr;
                        preSuffixChangesMade = true;
                    }
                }
            }
        }

        // --- Process Suffix (last word) ---
        let suffixAnalysis = { status: 'info', message: (currentWords.length > 0 ? 'Awaiting valid suffix.' : 'Awaiting input.'), proposed: (currentWords.length > 0 ? currentWords[currentWords.length -1] : ''), original: (currentWords.length > 0 ? currentWords[currentWords.length -1] : '') };
        if (currentWords.length > 0) {
            const potentialSuffix = currentWords[currentWords.length - 1];
            suffixAnalysis = wmessa_analyzeSuffix(potentialSuffix);
            proposedWords[currentWords.length - 1] = suffixAnalysis.proposed;
        }

        // --- Combine Results and Determine UI ---
        const finalProposedString = wmessa_titleCase(proposedWords.join(' '));
        const suffixChanged = currentWords.length > 0 && suffixAnalysis.proposed.toLowerCase() !== suffixAnalysis.original.toLowerCase();
        const capitalizationChanged = currentValue !== finalProposedString;
        let anyChangeProposed = preSuffixChangesMade || suffixChanged || capitalizationChanged;

        if (anyChangeProposed) {
            overallStatus = 'check';
            let suggestionDetails = [];
            if (preSuffixChangesMade) suggestionDetails.push("word(s) before suffix");
            if (suffixChanged) suggestionDetails.push("suffix");
            
            messages.push(`Suggest: "${finalProposedString}"`);
            if (suggestionDetails.length > 0) {
                 messages.push(`(Changes to ${suggestionDetails.join(' & ')})`);
            }
            if (suffixChanged && suffixAnalysis.message && suffixAnalysis.message.startsWith("Use ")) {
                messages.push(suffixAnalysis.message); // Add specific suffix suggestion message
            }


            abbrContainer.onclick = function() {
                element.value = finalProposedString;
            };
        } else { // No changes proposed, evaluate if current input is valid or just no rules hit
            let allWordsAreStandard = true; // Assume true unless a known full word (that can be abbreviated) is found
            if (currentWords.length > 1) {
                for (let i = 0; i < currentWords.length - 1; i++) {
                    const word = currentWords[i];
                    const wordLower = word.toLowerCase();
                    // Check if it's a full word that *could* be abbreviated, but isn't
                    const canBeAbbreviatedKey = Object.keys(wmessa_generalWordSuggestions).find(k => k.toLowerCase() === wordLower);
                    // And it's not already an abbreviation of itself or something else
                    const isAbbreviation = Object.keys(wmessa_generalWordApprovedAbbr).find(k => k.toLowerCase() === wordLower);
                    if (canBeAbbreviatedKey && !isAbbreviation) {
                        allWordsAreStandard = false; break;
                    }
                }
            }

            if (suffixAnalysis.status === 'valid' && allWordsAreStandard) {
                overallStatus = 'valid';
                messages.push(suffixAnalysis.message || `"${currentValue}" is standard.`);
            } else {
                overallStatus = 'info'; // Default to info if not perfectly valid or no suggestions
                if (!allWordsAreStandard) {
                    messages.push("Consider standard abbreviations for words before suffix.");
                }
                if (suffixAnalysis.status === 'info') {
                     messages.push(suffixAnalysis.message || "Check suffix standards.");
                } else if (suffixAnalysis.status === 'valid' && !allWordsAreStandard){
                    // Suffix is fine, but pre-words are not optimal
                    messages.push(`Suffix "${suffixAnalysis.proposed}" is standard.`);
                } else {
                    messages.push(suffixAnalysis.message || `Review standards for "${currentValue}"`);
                }
            }
        }
        
        abbrContainer.classList.add(overallStatus);
        abbrOutput.innerText = messages.filter(m => m).join('\n') || 'Awaiting input or check standards.';
    }

        function wmessa_bootstrap() {
        const wmeSdk = getWmeSdk({ scriptId: 'wme-road-name-helper-np', scriptName: 'WME Road Name Helper NP' });
        sdk = wmeSdk;
        sdk.Events.once({ eventName: 'wme-ready' }).then(() => {
            loadScriptUpdateMonitor();
            wmessa_init();
        });
    }

    function waitForWME() {
        if (!unsafeWindow.SDK_INITIALIZED) {
            setTimeout(waitForWME, 500);
            return;
        }
        unsafeWindow.SDK_INITIALIZED.then(wmessa_bootstrap);
    }
        waitForWME();
           
    function loadScriptUpdateMonitor() {
        try {
            const updateMonitor = new WazeWrap.Alerts.ScriptUpdateMonitor(SCRIPT_NAME, SCRIPT_VERSION, DOWNLOAD_URL, GM_xmlhttpRequest);
            updateMonitor.start();
        } catch (ex) {
            // Report, but don't stop if ScriptUpdateMonitor fails.
            console.error(`${SCRIPT_NAME}:`, ex);
        }
    }

})();