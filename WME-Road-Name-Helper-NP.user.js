// ==UserScript==
// @name            WME Road Name Helper NP
// @description     Check suffix and common word abbreviations without leaving WME
// @version         2025.06.03.01
// @author          Kid4rm90s
// @license         MIT
// @match           *://*.waze.com/*editor*
// @exclude         *://*.waze.com/user/editor*
// @connect         greasyfork.org
// @grant           GM_xmlhttpRequest
// @namespace       https://greasyfork.org/users/1087400
// @require         https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @downloadURL     https://update.greasyfork.org/scripts/538171/WME%20Road%20Name%20Helper%20NP.user.js
// @updateURL  https://update.greasyfork.org/scripts/538171/WME%20Road%20Name%20Helper%20NP.meta.js

// ==/UserScript==
/* Thanks to its Original author Brandon28AU (https://greasyfork.org/en/scripts/493429-wme-standard-suffix-abbreviations) for this script*/

/* global WazeWrap */

(function() {
    'use strict';
    const updateMessage = 'New update!';
    const SCRIPT_VERSION = GM_info.script.version.toString();
    const SCRIPT_NAME = GM_info.script.name;
    const DOWNLOAD_URL = GM_info.script.downloadURL;
    let sdk;
	
    // Suffix Abbreviation Data (Abbreviation: FullWord)
    const wmessa_approvedAbbr = {"Ally": "Alley", "App": "Approach", "Arc": "Arcade", "Av": "Avenue", "Bwlk": "Boardwalk", "Bvd": "Boulevard", "Brk": "Break", "Bypa": "Bypass", "Ch": "Chase", "Cct": "Circuit", "Cl": "Close", "Con": "Concourse", "Ct": "Court", "Cr": "Crescent", "Crst": "Crest", "Dr": "Drive", "Ent": "Entrance", "Esp": "Esplanade", "Exp": "Expressway", "Ftrl": "Firetrail", "Fwy": "Freeway", "Glde": "Glade", "Gra": "Grange", "Gr": "Grove", "Hwy": "Highway", "Mwy": "Motorway", "Pde": "Parade", "Pwy": "Parkway", "Psge": "Passage", "Pl": "Place", "Plza": "Plaza", "Prom": "Promenade", "Qys": "Quays", "Rtt": "Retreat", "Rdge": "Ridge", "Rd": "Road", "Sq": "Square", "Stps": "Steps", "St": "Street", "Sbwy": "Subway", "Tce": "Terrace", "Trk": "Track", "Trl": "Trail", "Vsta": "Vista"};

    // Suffix Suggestion Data (UserTyped/FullWord: CorrectAbbreviation)
    const wmessa_suggestedAbbr = {"Alley": "Ally", "Approach": "App", "Arcade": "Arc", "Avenue": "Av", "Boardwalk": "Bwlk", "Boulevard": "Bvd", "Blvd": "Bvd", "Break": "Brk", "Bypass": "Bypa", "Chase": "Ch", "Circuit": "Cct", "Close": "Cl", "Concourse": "Con", "Court": "Ct", "Crescent": "Cr", "Crest": "Crst", "Drive": "Dr", "Entrance": "Ent", "Esplanade": "Esp", "Expressway": "Exp", "Firetrail": "Ftrl", "Freeway": "Fwy", "Glade": "Glde", "Grange": "Gra", "Grove": "Gr", "Highway": "Hwy", "Ln": "Lane", "Marg": "Marga", "Motorway": "Mwy", "Parade": "Pde", "Parkway": "Pwy", "Passage": "Psge", "Place": "Pl", "Plaza": "Plza", "Promenade": "Prom", "Quays": "Qys", "Retreat": "Rtt", "Ridge": "Rdge", "Road": "Rd", "Square": "Sq", "Steps": "Stps", "Street": "St", "Subway": "Sbwy", "Terrace": "Tce", "Track": "Trk", "Trail": "Trl", "Vista": "Vsta"};

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
    // --- END OF NEW DATA ---
    function wmessa_titleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
   }

    let wmessa_valueObserver;


    function wmessa_init() {
        const observer = new MutationObserver((mutationsList, observer) => {
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
		
        WazeWrap.Interface.ShowScriptUpdate("WME Road Name Helper NP", GM_info.script.version, updateMessage, "https://greasyfork.org/en/scripts/538171-wme-road-name-helper-np", "https://github.com/kid4rm90s/WME-Road-Name-Helper-NP");
    }

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
    }

    function wmessa_analyzeSuffix(suffix) {
        const suffixLower = suffix.toLowerCase();
        let result = { status: 'info', message: 'No match for suffix.', proposed: suffix, original: suffix };

        const isKnownNoAbbrExact = (sLower) => wmessa_knownNoAbbr.some(kna => kna.toLowerCase() === sLower);
        const getKnownNoAbbrCased = (sLower) => wmessa_knownNoAbbr.find(kna => kna.toLowerCase() === sLower);

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