/**
 * Lightweight parameter validation for ML routes.
 *
 * Defense-in-depth: the Python sandbox (securePythonExecutor) already blocks
 * dangerous payloads, but these guards reject malformed identifiers early and
 * return a clear 400 instead of failing deeper in the bridge.
 */

// Identifiers (model_id, version_id, experiment_name, etc.): non-empty,
// bounded length, restricted to a safe filesystem/path-friendly charset.
const SAFE_IDENTIFIER = /^[A-Za-z0-9 ._:-]+$/;
const MAX_IDENTIFIER_LENGTH = 200;

function isValidIdentifier(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    SAFE_IDENTIFIER.test(value)
  );
}

/**
 * Validates that each named field is a valid identifier.
 * Returns null when valid, or an error message string when invalid.
 *
 * @param {Object} fields - map of fieldName -> value
 */
function validateIdentifiers(fields) {
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') {
      return `${name} is required`;
    }
    if (!isValidIdentifier(value)) {
      return `${name} must be a string (max ${MAX_IDENTIFIER_LENGTH} chars, alphanumeric and . _ : - only)`;
    }
  }
  return null;
}

module.exports = { isValidIdentifier, validateIdentifiers };
