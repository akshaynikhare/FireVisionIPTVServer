/**
 * Escapes special regex characters in a string so it can be safely used in `new RegExp()`.
 * Prevents ReDoS when user input is used to build regex patterns.
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
