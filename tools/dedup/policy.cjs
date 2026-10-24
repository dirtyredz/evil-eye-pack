'use strict';
// Ordered retired item ids; hiddenOnly entries remain a separate policy class.
function retiredIds(policy) {
  return [...Object.keys(policy.replacements), ...policy.disabled];
}
module.exports = { retiredIds };
