export const ALGORITHM = 'swipe-hybrid-v3';
export const WEIGHTS = { cart: 6, save: 4, detail: 2, search_select: 2, qualified: 1, skip: -1, comment: .25, dm: .25 };
export const DAY = 86400000;
export const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
export const vector = value => !value ? null : typeof value === 'string' ? JSON.parse(value) : value;
const words = value => String(value || '').toLocaleLowerCase('tr').match(/[\p{L}\p{N}]+/gu) || [];
export function attributes(p, ai = {}) {
  return [...new Set([`category:${p.category}`, `price:${Math.floor(Math.log2(Math.max(1, p.price / 100)))}`, ...words(p.color).map(x => `color:${x}`), ...words(`${p.title} ${ai.productType || ''} ${(ai.styles || []).join(' ')} ${(ai.contexts || []).join(' ')}`).filter(x => x.length > 2).map(x => `tag:${x}`)])];
}
export function buildProfile(events, products, features, now = Date.now()) {
  const affinities = {}, embedding = Array(768).fill(0); let mass = 0, vectorMass = 0;
  const catalogue = new Map(products.map(p => [p.id, p]));
  for (const e of events) {
    const p = catalogue.get(e.product_id); if (!p) continue;
    const weight = e.weight * 2 ** (-Math.max(0, now - new Date(e.created_at).getTime()) / (7 * DAY));
    const f = features.get(p.id); mass += Math.abs(weight);
    for (const attr of attributes(p, f?.features)) affinities[attr] = (affinities[attr] || 0) + weight;
    const v = vector(f?.embedding);
    if (v?.length === 768) { vectorMass += Math.abs(weight); v.forEach((n, i) => { embedding[i] += n * weight; }); }
  }
  const norm = Math.hypot(...embedding);
  return { affinities, mass, embedding: vectorMass && norm ? embedding.map(x => x / norm) : null };
}
export function rankProducts({ products, features = new Map(), stats = new Map(), profile, recentProfile, exposures = new Map(), seed, personalized = true, followed = new Set(), now = Date.now() }) {
  const tie = id => { let h = 2166136261; for (const c of seed + id) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
  return products.map(p => {
    const f = features.get(p.id), s = stats.get(p.id) || {}, v = vector(f?.embedding);
    const attrs = attributes(p, f?.features);
    const importance = key => key.startsWith('category:') ? 4 : key.startsWith('tag:') ? 2 / Math.max(1, attrs.filter(a => a.startsWith('tag:')).length) : 1;
    const totalImportance = attrs.reduce((sum, key) => sum + importance(key), 0);
    const affinityFor = interest => interest?.mass ? clamp(.5 + attrs.reduce((sum, key) => sum + (interest.affinities[key] || 0) * importance(key), 0) / (Math.max(1, interest.mass) * totalImportance * 2)) : .5;
    const semanticFor = (interest, affinity) => interest?.embedding && v?.length === 768 ? clamp((1 + v.reduce((sum, n, i) => sum + n * interest.embedding[i], 0)) / 2) : affinity;
    const longAffinity = affinityFor(profile), shortAffinity = affinityFor(recentProfile);
    // One accidental swipe has little influence; several intent signals can shift the session.
    const recentMix = .6 * clamp((recentProfile?.mass || 0) / 8);
    const affinity = (1-recentMix)*longAffinity + recentMix*shortAffinity;
    const semantic = (1-recentMix)*semanticFor(profile,longAffinity) + recentMix*semanticFor(recentProfile,shortAffinity);
    const exposure = exposures.get(p.id);
    const fatigue = exposure ? clamp(Number(exposure.count || 0) / 3) * 2 ** (-Math.max(0,now-new Date(exposure.lastSeen).getTime()) / DAY) : 0;
    const quality = clamp((Number(s.intent || 0) + 2) / (Number(s.impressions || 0) + 20));
    const freshness = 2 ** (-Math.max(0, now - (Date.parse(p.createdAt) || now)) / (7 * DAY));
    const trend = clamp((Number(s.recent || 0) + 1) / (Number(s.impressions || 0) + 10));
    const following = personalized && followed.has(p.sellerId);
    const score = personalized ? .35 * semantic + .25 * affinity + .25 * quality + .1 * freshness + .05 * trend + (following ? .12 : 0) - .18 * fatigue : .6 * freshness + .4 * tie(p.id);
    return { product: p, score, fatigue, recentMatch: personalized && recentMix >= .3 && shortAffinity > longAffinity + .05, following, personalized, semanticMatch: !!profile?.embedding && !!v && semantic > .55, categoryMatch: (profile?.affinities[`category:${p.category}`] || 0) >= 1, recent: Number(s.recent || 0), explore: freshness + 1 / (1 + Number(s.impressions || 0)) - (personalized ? .3 * fatigue : 0), trend: trend - (personalized ? .05 * fatigue : 0), tie: tie(p.id) };
  });
}
export function selectPage(candidates, history = [], limit = 20, onSelect = () => {}) {
  const sorts = { personal: [...candidates].sort((a,b) => b.score-a.score || b.tie-a.tie), explore: [...candidates].sort((a,b) => b.explore-a.explore || b.tie-a.tie), trend: [...candidates].sort((a,b) => b.trend-a.trend || b.tie-a.tie) };
  const result = [], used = new Set(history.map(p => p.id)), preceding = [...history];
  for (let i = 0; i < limit; i++) {
    const slot = (history.length + i) % 20;
    const mode = [3,8,13,18].includes(slot) ? 'explore' : [6,16].includes(slot) ? 'trend' : 'personal';
    const choices = sorts[mode].filter(c => !used.has(c.product.id)); if (!choices.length) break;
    const recent = preceding.slice(-9), last = preceding.at(-1);
    const different = choices.filter(c => c.product.sellerId !== last?.sellerId);
    const diverse = different.filter(c => recent.filter(p => p.sellerId === c.product.sellerId).length < 3);
    // Small catalogues relax seller caps, but never repeat a product in a session.
    const pool = diverse.length ? diverse : different.length ? different : choices;
    const categoryCounts = new Map(); recent.forEach(p => categoryCounts.set(p.category, (categoryCounts.get(p.category) || 0) + 1));
    const chosen = [...pool].sort((a,b) => (b[mode === 'personal' ? 'score' : mode] - .025 * (categoryCounts.get(b.product.category) || 0)) - (a[mode === 'personal' ? 'score' : mode] - .025 * (categoryCounts.get(a.product.category) || 0)) || b.tie-a.tie)[0];
    onSelect(chosen, mode); used.add(chosen.product.id); result.push(chosen.product); preceding.push(chosen.product);
  }
  return result;
}

export function explainCandidate(candidate, mode) {
  if (!candidate.personalized) return { code: 'balanced', text: 'Farklı mağaza ve kategorilerden oluşan genel keşif seçkisinde.' };
  if (mode === 'explore') return { code: 'explore', text: 'Yeni veya daha az gösterilmiş parçalara da yer açıyoruz.' };
  if (mode === 'trend' && candidate.recent > 0) return { code: 'trend', text: 'Son 24 saatte beğeni veya çantaya ekleme ilgisi alan parçalardan.' };
  if (mode === 'personal' && candidate.following) return { code: 'following', text: 'Bu seçki hazırlanırken takip ettiğin bir mağazadan olduğu için öncelik aldı.' };
  if (mode === 'personal' && candidate.recentMatch) return { code: 'recent', text: 'Son etkileşimlerinde ilgi gösterdiğin ürün özellikleri bu öneride etkili oldu.' };
  if (mode === 'personal' && candidate.categoryMatch) return { code: 'category', text: `${candidate.product.category} kategorisindeki etkileşimlerin bu öneride etkili oldu.` };
  if (mode === 'personal' && candidate.semanticMatch) return { code: 'similar', text: 'İlgi gösterdiğin parçaların ürün özelliklerine benzerlik taşıyor.' };
  return { code: 'discovery', text: 'Yeni zevkler keşfetmen için farklı parçaları akışına katıyoruz.' };
}
