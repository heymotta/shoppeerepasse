function terms(text) { return text.toLowerCase().replace(/https?:\/\/\S+/g, '').split(/[^\p{L}\p{N}]+/u).filter(x => x.length > 2); }
function score(source, candidate) { const a = new Set(terms(source)); const b = new Set(terms(candidate)); if (!a.size || !b.size) return 0; let hit = 0; for (const word of a) if (b.has(word)) hit++; return Math.round((hit / Math.max(a.size, b.size)) * 100); }
module.exports = { score };
