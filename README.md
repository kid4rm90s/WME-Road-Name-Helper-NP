# WME Road Name Helper NP

## Description

WME Road Name Helper NP is a Tampermonkey/Greasemonkey userscript for the Waze Map Editor (WME). It assists editors by checking road name suffixes and common preceding words against standard abbreviations, providing real-time feedback and suggestions directly within the WME interface.

This script aims to improve data consistency and accuracy in Waze map data by guiding users to use official or community-agreed-upon abbreviations.

## Features

*   **Real-time Suffix Analysis:** As you type a road name, the script analyzes the last word (potential suffix).
    *   Validates if the typed suffix is an approved abbreviation (e.g., "Rd" for "Road").
    *   Validates if the typed suffix is a known word that should not be abbreviated (e.g., "Lane").
    *   Suggests correct abbreviations if a full word is typed (e.g., "Street" -> "St").
    *   Suggests completions for partially typed abbreviations or full words (e.g., "Str" -> "St", "Ave" -> "Av").
*   **General Word Abbreviation:** Checks words *before* the suffix for common abbreviations.
    *   Suggests abbreviations for common words (e.g., "Mount" -> "Mt", "Saint" -> "St").
    *   Validates existing abbreviations for these words.
*   **Title Case Normalization:** Suggests proper title casing for the entire road name.
*   **Integrated UI:**
    *   Displays feedback directly below the street name input field in the address edit card.
    *   Uses color-coded status indicators:
        *   **Green (Valid):** The current input is standard.
        *   **Yellow (Check):** A suggestion is available. Clicking the helper applies the suggestion.
        *   **Blue (Info):** General information or no specific rule matched.
    *   Provides clear messages about the status or suggested changes.
*   **"The X" Name Handling:** Recognizes "The [Name]" or "The [Name] [Suffix]" patterns (e.g., "The Esplanade") and advises against abbreviating them.

## Installation

1.  Ensure you have a userscript manager extension installed in your browser (e.g., Tampermonkey for Chrome/Edge/Firefox, or Greasemonkey for Firefox).
2.  Navigate to the script's page on Greasy Fork.
3.  Click the "Install" button provided by your userscript manager.
4.  The script will automatically run when you are on the Waze Map Editor page.


## Credits

Based on the original "WME Standard Suffix Abbreviations" script by Brandon28AU. This version ("Mod") includes enhancements for general word abbreviations and other refinements.

## License

MIT
