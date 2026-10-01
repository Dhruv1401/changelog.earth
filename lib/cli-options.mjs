// Option parsing for the offline scripts. Both classification scripts take the same --key=value
// flags, and a typo must fail before the run starts rather than quietly changing what runs:
// this one spends money per batch.
export function parseOptions(argv = []) {
 const options = new Map();
 for (const argument of argv) {
  const [key, value = 'true'] = argument.replace(/^--/, '').split('=');
  if (!key || argument.startsWith('-') && !argument.startsWith('--')) throw new Error(`Invalid option: ${argument}`);
  options.set(key, value);
 }
 return options;
}

export function readNumber(options, key, fallback, {min = 0, max = Number.MAX_SAFE_INTEGER, integer = true} = {}) {
 const raw = options.get(key);
 if (raw === undefined) return fallback;
 const value = Number(raw);
 if (!Number.isFinite(value) || value < min || value > max || integer && !Number.isInteger(value)) throw new Error(`Invalid --${key}: ${raw}`);
 return value;
}

export function readFlag(options, key) {
 return options.has(key);
}