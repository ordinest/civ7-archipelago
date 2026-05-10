(function() {
    const p = Players.get(GameContext.localPlayerID);
    const out = {};

    // Age accessor
    try { out.player_Ages_age = p.Ages.age; } catch (e) { out.age_err = String(e); }
    try { out.player_Ages_getLastAge = p.Ages.getLastAge ? p.Ages.getLastAge() : null; } catch (e) {}

    // Player civilization identity
    try { out.civilizationType = p.civilizationType; } catch (e) { out.civtype_err = String(e); }
    try { out.civilizationName = p.civilizationName; } catch (e) {}
    try { out.civilizationFullName = p.civilizationFullName; } catch (e) {}
    try { out.leaderName = p.leaderName; } catch (e) {}

    // Wonder list
    try {
        const wonders = p.Constructibles.getWonders ? p.Constructibles.getWonders() : null;
        out.wonders_built = wonders;
    } catch (e) { out.wonders_err = String(e); }

    // Sample of GameInfo.Wonders shape
    try {
        const w = GameInfo.Wonders[0];
        if (w) {
            const sample = {};
            for (const k in w) {
                try { const v = w[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.wonder_sample = sample;
            out.wonder_count = GameInfo.Wonders.length;
        }
    } catch (e) { out.ws_err = String(e); }

    // Sample of GameInfo.Constructibles shape (unique buildings)
    try {
        let foundUnique = null;
        for (let i = 0; i < GameInfo.Constructibles.length; i++) {
            const c = GameInfo.Constructibles[i];
            if (c && c.TraitType) { foundUnique = c; break; }
        }
        if (foundUnique) {
            const sample = {};
            for (const k in foundUnique) {
                try { const v = foundUnique[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.constructible_unique_sample = sample;
        }
        out.constructibles_count = GameInfo.Constructibles.length;
    } catch (e) { out.cs_err = String(e); }

    // Sample of GameInfo.CivilizationTraits shape
    try {
        const t = GameInfo.CivilizationTraits[0];
        if (t) {
            const sample = {};
            for (const k in t) {
                try { const v = t[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.civtrait_sample = sample;
        }
        out.civtraits_count = GameInfo.CivilizationTraits.length;
    } catch (e) { out.ct_err = String(e); }

    // Sample of GameInfo.Civilizations row
    try {
        const c = GameInfo.Civilizations[0];
        if (c) {
            const sample = {};
            for (const k in c) {
                try { const v = c[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.civilization_sample = sample;
        }
        out.civilizations_count = GameInfo.Civilizations.length;
    } catch (e) { out.cv_err = String(e); }

    // Sample of GameInfo.Beliefs shape (pantheon vs religion belief?)
    try {
        const b = GameInfo.Beliefs[0];
        if (b) {
            const sample = {};
            for (const k in b) {
                try { const v = b[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.belief_sample = sample;
        }
        out.beliefs_count = GameInfo.Beliefs.length;
    } catch (e) { out.b_err = String(e); }

    // Sample of GameInfo.GoodyHuts shape
    try {
        const g = GameInfo.GoodyHuts[0];
        if (g) {
            const sample = {};
            for (const k in g) {
                try { const v = g[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.goodyhut_sample = sample;
        }
        out.goodyhuts_count = GameInfo.GoodyHuts.length;
    } catch (e) { out.gh_err = String(e); }

    return JSON.stringify(out);
})()
