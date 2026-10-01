// Structured vocabulary for Earth events. One place defines what can be classified,
// so collection, the archive, the API and every page agree on the same taxonomy.
export const DOMAINS = [
 {id:'life',label:'Life & biology',symbol:'🧬',topics:['New species','Extinctions','Evolution','Genetics','Microbiology','Conservation genetics']},
 {id:'earth',label:'Earth & geology',symbol:'🌍',topics:['Geology','Earthquakes','Volcanoes','Minerals','Continents','Geophysics']},
 {id:'oceans',label:'Oceans',symbol:'🌊',topics:['Coral reefs','Sea level','Currents','Deep sea','Fisheries','Ice']},
 {id:'atmosphere',label:'Atmosphere & climate',symbol:'🌡️',topics:['Climate','Emissions','Air quality','Ozone','Weather extremes','Forests']},
 {id:'ecology',label:'Ecology & biodiversity',symbol:'🌿',topics:['Biodiversity','Pollinators','Rewilding','Invasive species','Habitats','Wildlife']},
 {id:'science',label:'Science',symbol:'🔬',topics:['Physics','Chemistry','Materials','Mathematics','Research methods','Earth observation']},
 {id:'space',label:'Space',symbol:'🚀',topics:['Missions','Exoplanets','Launches','Space debris','Astronomy','Satellites']},
 {id:'energy',label:'Energy',symbol:'⚡',topics:['Renewables','Nuclear','Storage','Grid','Fossil fuels','Hydrogen']},
 {id:'technology',label:'Technology',symbol:'🛠️',topics:['Computing','Artificial intelligence','Robotics','Manufacturing','Telecommunications']},
 {id:'health',label:'Health',symbol:'🩺',topics:['Disease','Public health','Nutrition','Mental health','Medicine','Vaccination']},
 {id:'transport',label:'Transport',symbol:'✈️',topics:['Aviation','Rail','Shipping','Roads','Electric vehicles']},
 {id:'infrastructure',label:'Infrastructure',symbol:'🏗️',topics:['Cities','Bridges','Buildings','Dams','Water supply']},
 {id:'agriculture',label:'Agriculture & food',symbol:'🌾',topics:['Crops','Livestock','Soil','Food security','Aquaculture']},
 {id:'archaeology',label:'Archaeology & anthropology',symbol:'🏺',topics:['Archaeology','Anthropology','Prehistory','Heritage','Human evolution']},
 {id:'society',label:'Society',symbol:'👥',topics:['Demographics','Policy','Education','Migration','Languages']},
];

export const CHANGE_TYPES = [
 {id:'DISCOVERED',label:'Discovered',symbol:'+',definition:'Something previously unknown entered the record.'},
 {id:'CREATED',label:'Created',symbol:'+',definition:'Something new came into existence or was built.'},
 {id:'DEPLOYED',label:'Deployed',symbol:'+',definition:'Something reached real-world use at scale.'},
 {id:'MEASURED',label:'Measured',symbol:'~',definition:'A quantity or baseline was quantified.'},
 {id:'OBSERVED',label:'Observed',symbol:'~',definition:'An existing condition was witnessed or recorded.'},
 {id:'UNDERSTOOD',label:'Understood',symbol:'~',definition:'Existing knowledge changed about how or why something works.'},
 {id:'CONFIRMED',label:'Confirmed',symbol:'~',definition:'A previously provisional finding became established.'},
 {id:'REVISED',label:'Revised',symbol:'↻',definition:'An earlier claim, model or plan changed.'},
 {id:'ONGOING',label:'Ongoing',symbol:'~',definition:'Work, recovery or deployment continues without a clear end state.'},
 {id:'EXPANDED',label:'Expanded',symbol:'+',definition:'Coverage, capacity or range grew.'},
 {id:'IMPROVED',label:'Improved',symbol:'↑',definition:'A demonstrated performance or outcome got better.'},
 {id:'RESTORED',label:'Restored',symbol:'↑',definition:'Something damaged or lost returned to a working state.'},
 {id:'PROTECTED',label:'Protected',symbol:'⛨',definition:'Something gained formal or practical protection.'},
 {id:'DECLINED',label:'Declined',symbol:'↓',definition:'A measured quantity fell.'},
 {id:'DAMAGED',label:'Damaged',symbol:'↓',definition:'A known asset or system lost integrity or quality.'},
 {id:'LOST',label:'Lost',symbol:'-',definition:'Something that existed disappeared.'},
];

export const SCOPES = [
 {id:'local',label:'Local'},
 {id:'regional',label:'Regional'},
 {id:'global',label:'Global'},
 {id:'planetary',label:'Planetary'},
];

export const SIGNIFICANCE = [
 {id:'epochal',label:'Epochal',definition:'Exceptionally rare changes that alter our understanding or trajectory.',criteria:'A civilisational or planet-scale turning point. It changes what large numbers of people, or the biosphere, can rely on long term.'},
 {id:'major',label:'Major',definition:'Substantial real-world or scientific significance.',criteria:'A substantial and lasting change to a system, a population or shared scientific understanding.'},
 {id:'notable',label:'Notable',definition:'Meaningful within its field or community.',criteria:'A meaningful change worth recording within its field, region or community.'},
 {id:'minor',label:'Minor',definition:'Interesting but narrow.',criteria:'An interesting but limited change.'},
];
export const CONFIDENCE_IDS = ['high','medium','low'];

export const EVIDENCE_STATUS = [
 {id:'confirmed',label:'Confirmed',symbol:'✓',definition:'Reported as an established finding.'},
 {id:'preliminary',label:'Preliminary',symbol:'?',definition:'Early result, preprint or single reporting.'},
 {id:'conflicting',label:'Conflicting',symbol:'⚠',definition:'Sources disagree or the finding is disputed.'},
 {id:'revised',label:'Revised',symbol:'↻',definition:'A later report corrected or narrowed the claim.'},
 {id:'retracted',label:'Retracted',symbol:'✕',definition:'The claim was withdrawn.'},
];

export const DOMAIN_IDS = DOMAINS.map(domain => domain.id);
export const CHANGE_TYPE_IDS = CHANGE_TYPES.map(change => change.id);
export const SCOPE_IDS = SCOPES.map(scope => scope.id);
export const SIGNIFICANCE_IDS = SIGNIFICANCE.map(level => level.id);
export const EVIDENCE_IDS = EVIDENCE_STATUS.map(status => status.id);
// Sets, built once: validation runs per story and per stored record, so it cannot allocate.
const domainIds = new Set(DOMAIN_IDS), changeTypeIds = new Set(CHANGE_TYPE_IDS), scopeIds = new Set(SCOPE_IDS), significanceIds = new Set(SIGNIFICANCE_IDS), evidenceIds = new Set(EVIDENCE_IDS);
export const isDomain = value => domainIds.has(value);
export const isChangeType = value => changeTypeIds.has(value);
export const isScope = value => scopeIds.has(value);
export const isSignificance = value => significanceIds.has(value);
export const isEvidenceStatus = value => evidenceIds.has(value);
export const isPlainText = (value, max = 400) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export const isSlug = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value);

// Feed categories are editorial shortcuts. They map onto a domain without a model.
const CATEGORY_DOMAINS = new Map([
 ['science & nature','science'],['science','science'],['space','space'],['technology','technology'],['aviation','transport'],
 ['health','health'],['environment','ecology'],['energy','energy'],['positive news','ecology'],['world','society'],
]);
const providerDomain = provider => /space|spaceflight|nasa|esa/i.test(provider ?? '') ? 'space' : null;

// Ordered so the first match wins. These run against the headline and the publisher text of a
// story, and only unambiguous wording counts: a pattern that matches "bleaching resistance"
// labels a study about resilience as damage, which is worse than missing the story entirely.
// A withdrawal is deliberately absent: that happened to a paper, not to Earth, and the evidence
// status below is where it belongs.
const CHANGE_PATTERNS = [
 ['DAMAGED',/\b(destroyed|derelict|oil spill|wildfires? (?:burn|bare|strike)|deforestation|felled|contaminated|poisoned|crashed)\b/i],
 ['LOST',/\b(went extinct|declared extinct|died off|last known population of|extinction (?:of|confirmed)|disappeared entirely)\b/i],
 ['DECLINED',/\b(declined \d|decline[sd]? \d|fell \d|dropped \d|plummet\w*|shrank|shut down permanently|lowest (?:on record|since))\b/i],
 ['RESTORED',/\b(restored|restoration of|recolonis\w+|rewild\w+|reintroduced|back in the wild)\b/i],
 ['PROTECTED',/\b(designated|protected area|marine protected|sanctuary|protected under|conservation status (?:changed|improved))\b/i],
 ['CONFIRMED',/\b(confirmed|proves|proven to|validated by|now confirmed)\b/i],
 ['REVISED',/\b(revised|reassessment|rethink\w+|corrects? (?:earlier|a previous)|downgrad\w+)\b/i],
 ['DISCOVERED',/\b(new species|newly discovered|newly identified|previously unknown|scientifically described|discovered a new|first time ever recorded)\b/i],
 ['MEASURED',/\b(survey(?:s|ed)?|census|measured|record(?:ed|s)? the (?:highest|lowest)|study (?:found|reports|shows)|new (?:data|estimate|baseline|record))\b/i],
 ['EXPANDED',/\b(expanded|expansion of|increase[sd]? \d|grew by|grew \d|more than \d+%|doubled)\b/i],
 ['DEPLOYED',/\b(launched|deployed|commissioned|entered service|inaugurated|opened to the public|first (?:commercial )?(?:flight|operation)|goes? live)\b/i],
 ['IMPROVED',/\b(improv\w+|more efficient|breakthrough|reduced (?:emissions|deaths|costs) by)\b/i],
 ['UNDERSTOOD',/\b(how \w+ work|mechanism|first evidence|new insight|explains? why|now understood)\b/i],
 ['CREATED',/\b(built|created|developed|unveiled|introduced|invented|engineered|designed)\b/i],
];
// Domain words win over the feed category so 'Science & nature' does not swallow life and climate.
const DOMAIN_PATTERNS = [
 ['space',/\b(spacecraft|satellite|orbit|rocket|launch(?:es|ed)?|nasa|esa\b|roscosmos|ispace|mars|lunar|the moon|exoplanet|telescope|space station|astronom)\b/i],
 ['oceans',/\b(ocean|sea level|seabed|deep sea|coral reef|reef|marine|fisheries|whale|shark|krill|currents?)\b/i],
 ['life',/\b(species|genetic|genome|mutation|evolution|dna\b|protein|cell(?:ular)?|bacteria|microbiome|fertil\w+|breeding)\b/i],
 ['ecology',/\b(biodiversity|wildlife|conservation|rewild|endangered|extinct|pollinator|forest|rainforest|habitat|rewilding|rewilded|invasive species)\b/i],
 ['atmosphere',/\b(climate|emissions?|carbon|greenhouse|ozone|air quality|atmospher\w+|global warming|co2|so2|pm2\.5)\b/i],
 ['energy',/\b(solar|wind farm|wind power|renewable|battery|batteries|grid|nuclear|reactor|power plant|energy storage|hydrogen|fossil fuel|oil price|gas pipeline)\b/i],
 ['health',/\b(patient|patients|vaccine|disease|infection|cancer|tumou?r|hospital|clinical|therap\w+|mental health|malaria|outbreak|healthcare)\b/i],
 ['transport',/\b(airline|aircraft|airport|aviation|flight|railway|rail\b|train|shipping|vessel|ship\b|cargo fleet|trucking|electric vehicle)\b/i],
 ['agriculture',/\b(farm(?:er|ing|s)?\b|crop|harvest|livestock|wheat|rice|maize|soil|food security|aquaculture|fertili[sz]er)\b/i],
 ['archaeology',/\b(archaeolog\w+|ancient|excavat\w+|artifact|artefact|homini\w*|prehistor\w+|heritage site|fossil)\b/i],
 ['infrastructure',/\b(infrastructure|bridge|dam\b|water supply|city|urban|housing|building|road network|sewer)\b/i],
 ['technology',/\b(algorithm|artificial intelligence|\bai\b|chip|quantum comput\w+|robot\w*|software|open-?source|computing|cybersecurity|processor)\b/i],
 ['earth',/\b(earthquake|volcan\w+|mineral|mantle|tectonic|geomagnetic|seism\w+)\b/i],
];
// Existing patch labels remain the fallback so pre-taxonomy stories keep a sensible change type.
const KIND_CHANGE_TYPES = {Added:'CREATED',Unlocked:'UNDERSTOOD',Updated:'ONGOING',Changed:'ONGOING',Buffed:'IMPROVED',Improved:'IMPROVED',Nerfed:'DECLINED',Fixed:'RESTORED',Removed:'LOST',Patched:'IMPROVED'};
const SCOPE_PATTERNS = [
 ['planetary',/\b(globally|worldwide|global|planet-?wide|planetary|earth-?wide|across the world|every country)\b/i],
 ['regional',/\b(european|europe|african|africa|asia pacific|regional|continent-?wide)\b/i],
 ['local',/\b(a (?:single|local) (?:site|region|county|city|town)|locally)\b/i],
];
const EVIDENCE_PATTERNS = [
 ['retracted',/\b(retract(?:ed|ion)|withdrawn|journal (?:has )?(?:pulled|retracted)|paper pulled)\b/i],
 ['conflicting',/\b(contradict\w+|disput\w+|disagree\w+|debate[sd]? over)\b/i],
 ['revised',/\b(revised|correction|clarification|earlier report|updated? (?:story|report|findings))\b/i],
 ['preliminary',/\b(preliminary|early (?:data|results|stages?)|preprint|not yet peer|small (?:study|sample)|lab(?:oratory)?[- ]only|mouse (?:study|model)|mice studies|prototype|proposal)\b/i],
];

function inferDomain(text, category, provider) {
 for (const [id, pattern] of DOMAIN_PATTERNS) if (pattern.test(text)) return id;
 return CATEGORY_DOMAINS.get((category ?? '').toLowerCase()) ?? providerDomain(provider) ?? 'science';
}

function inferChangeType(text, kind) {
 for (const [id, pattern] of CHANGE_PATTERNS) if (pattern.test(text)) return id;
 return KIND_CHANGE_TYPES[kind] ?? 'OBSERVED';
}
function inferScope(text, worldwide) {
 for (const [id, pattern] of SCOPE_PATTERNS) if (pattern.test(text)) return id;
 return worldwide === true ? 'global' : 'local';
}
function inferEvidenceStatus(text, hasSummary) {
 for (const [id, pattern] of EVIDENCE_PATTERNS) if (pattern.test(text)) return id;
 // A bare headline is weaker evidence than a reported summary, so it stays provisional.
 return hasSummary ? 'confirmed' : 'preliminary';
}
// Editorial framework: how much of Earth is affected, how structural the change is,
// and whether independent reporting backs it. Not a numerical score, just a consistent ladder.
const KNOWLEDGE_CHANGES = new Set(['DISCOVERED','CONFIRMED','REVISED','LOST','DAMAGED','MEASURED']);
function inferSignificance({changeType, scope, sourceCount, evidenceStatus}) {
 const scopeWeight = scope === 'planetary' ? 3 : scope === 'global' ? 2 : scope === 'regional' ? 1 : 0;
 const changeWeight = KNOWLEDGE_CHANGES.has(changeType) ? 2 : changeType === 'OBSERVED' || changeType === 'ONGOING' ? 0 : 1;
 if (evidenceStatus === 'retracted' || evidenceStatus === 'conflicting') return 'minor';
 const score = scopeWeight + changeWeight + (sourceCount > 1 ? 1 : 0);
 if (score >= 6) return 'epochal';
 if (score >= 4) return 'major';
 if (score >= 2) return 'notable';
 return 'minor';
}

// Stories saved before the taxonomy existed carry no structured fields. They are classified from
// the same headline and the same bounded publisher text the classifier is given, so inferred and
// stored records rest on comparable evidence rather than on a headline alone.
export function classifyArticle(article, {sourceCount = 1} = {}) {
 const body = (article.summary || article.note || '').slice(0, 600);
 const text = `${article.originalTitle ?? ''} ${article.title} ${body}`;
 const stored = [article.domain, article.changeType, article.scope, article.significance, article.evidenceStatus].filter(Boolean).length;
 const domain = isDomain(article.domain) ? article.domain : inferDomain(text, article.category, article.provider);
 const changeType = isChangeType(article.changeType) ? article.changeType : inferChangeType(text, article.kind);
 const scope = isScope(article.scope) ? article.scope : inferScope(text, article.worldwide);
 const evidenceStatus = isEvidenceStatus(article.evidenceStatus) ? article.evidenceStatus : inferEvidenceStatus(text, Boolean(body.trim()));
 const significance = isSignificance(article.significance) ? article.significance : inferSignificance({changeType, scope, sourceCount, evidenceStatus});
 return {domain, changeType, scope, significance, evidenceStatus, inferred: stored === 0};
}