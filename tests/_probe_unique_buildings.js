(function() {
    const out = {};

    // Try TraitModifiers shape
    try {
        const t = GameInfo.TraitModifiers && GameInfo.TraitModifiers[0];
        if (t) {
            const sample = {};
            for (const k in t) {
                try { const v = t[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.trait_modifier_sample = sample;
            out.trait_modifiers_count = GameInfo.TraitModifiers.length;
        }
    } catch (e) { out.tm_err = String(e); }

    // Look for tables we haven't tried yet
    const otherTables = ["Buildings", "Improvements", "Units", "Districts",
        "ConstructibleTags", "Tags", "Types", "ConstructibleUniqueRequirements",
        "UniqueAbilities", "UniqueQuarters", "TraitConstructibles",
        "TypeTags", "ConstructibleTypes", "ConstructibleModifiers",
        "CivilizationItems", "LeaderItems", "CivilizationUnlocks", "LeaderUnlocks"];
    out.other_tables = {};
    for (const t of otherTables) {
        try { out.other_tables[t] = !!GameInfo[t]; }
        catch (e) { out.other_tables[t] = "err: " + e; }
    }

    // Sample a TypeTags row if present (this often links constructibles to civs)
    try {
        if (GameInfo.TypeTags) {
            const tt = GameInfo.TypeTags[0];
            if (tt) {
                const sample = {};
                for (const k in tt) {
                    try { const v = tt[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
                }
                out.type_tag_sample = sample;
                out.type_tags_count = GameInfo.TypeTags.length;
            }
            // Find a unique-building tag (TraitType column hopefully)
            let foundUnique = null;
            for (let i = 0; i < GameInfo.TypeTags.length; i++) {
                const r = GameInfo.TypeTags[i];
                if (r && r.Tag && String(r.Tag).indexOf("UNIQUE") !== -1) {
                    foundUnique = r;
                    break;
                }
            }
            if (foundUnique) {
                const sample = {};
                for (const k in foundUnique) {
                    try { const v = foundUnique[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
                }
                out.type_tag_unique_sample = sample;
            }
        }
    } catch (e) { out.tt_err = String(e); }

    // Look at Constructibles row 0 — what fields does it have, fully?
    try {
        const c = GameInfo.Constructibles[0];
        if (c) {
            const sample = {};
            for (const k in c) {
                try { const v = c[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.constructible_sample = sample;
            out.constructible_keys = Object.keys(sample);
        }
    } catch (e) { out.cs_err = String(e); }

    // Look for a known unique building by name (ROMAN BATH, for Rome — but Civ 7 doesn't have that. Try BATH or TEMPLUM)
    try {
        const candidates = ["BUILDING_TEMPLUM", "BUILDING_BASILICA",
            "BUILDING_PAEDOTRIBES", "BUILDING_THERMAE"];
        out.search_constructibles_for_rome = {};
        for (let i = 0; i < GameInfo.Constructibles.length; i++) {
            const c = GameInfo.Constructibles[i];
            if (!c) continue;
            for (const cand of candidates) {
                if (c.ConstructibleType === cand) {
                    const sample = {};
                    for (const k in c) {
                        try { const v = c[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
                    }
                    out.search_constructibles_for_rome[cand] = sample;
                }
            }
        }
    } catch (e) { out.sc_err = String(e); }

    // Resolve our age hash to see if GameInfo.Ages.lookup works on it
    try {
        const p = Players.get(GameContext.localPlayerID);
        const ageHash = p.Ages.age;
        const ageDef = GameInfo.Ages.lookup(ageHash);
        out.age_lookup_with_hash = ageDef ? {
            AgeType: ageDef.AgeType,
            Name: ageDef.Name
        } : "null";
    } catch (e) { out.age_lookup_err = String(e); }

    // Resolve the player's civilization
    try {
        const p = Players.get(GameContext.localPlayerID);
        const civDef = GameInfo.Civilizations.lookup(p.civilizationType);
        if (civDef) {
            const sample = {};
            for (const k in civDef) {
                try { const v = civDef[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.player_civ_def = sample;
        }
    } catch (e) { out.civdef_err = String(e); }

    return JSON.stringify(out);
})()
