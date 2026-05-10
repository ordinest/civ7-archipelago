(function() {
    const out = {};

    // Resolve specific hashes seen in events
    try {
        out.hash_952183771 = null;
        for (let i = 0; i < GameInfo.Types.length; i++) {
            const t = GameInfo.Types[i];
            if (t && t.Hash === 952183771) {
                out.hash_952183771 = {Type: t.Type, Kind: t.Kind};
                break;
            }
        }
    } catch (e) { out.h_err = String(e); }

    // Enumerate all KIND_CONSTRUCTIBLE types whose Type matches goody-hut /
    // discovery / ruins / tents patterns.
    try {
        const goody = [];
        for (let i = 0; i < GameInfo.Types.length; i++) {
            const t = GameInfo.Types[i];
            if (!t || t.Kind !== "KIND_CONSTRUCTIBLE") continue;
            const s = String(t.Type);
            if (/IMPROVEMENT_(TENTS|RUINS|DISCOVERY|GOODYHUT|BARBARIAN|RICHES|SEER|HUT|VILLAGE|SETTLEMENT|RELIC|MARKER)/i.test(s)
                || /^DISCOVERY_/.test(s)
                || /GOODY/i.test(s)) {
                goody.push({Type: t.Type, Hash: t.Hash});
            }
        }
        out.goody_hut_candidates = goody;
    } catch (e) { out.g_err = String(e); }

    // Enumerate all wonder hashes (so the mod can build a filter set).
    try {
        const wonders = [];
        for (let i = 0; i < GameInfo.Types.length; i++) {
            const t = GameInfo.Types[i];
            if (!t || t.Kind !== "KIND_CONSTRUCTIBLE") continue;
            if (/^WONDER_/.test(String(t.Type))) {
                wonders.push({Type: t.Type, Hash: t.Hash});
            }
        }
        out.wonder_hashes_count = wonders.length;
        out.wonder_hashes_sample = wonders.slice(0, 5);
    } catch (e) { out.w_err = String(e); }

    // Find the constructibleClass hash for WONDER vs BUILDING by looking up
    // WONDER_GREAT_STELE row in GameInfo.Constructibles.
    try {
        for (let i = 0; i < GameInfo.Constructibles.length; i++) {
            const c = GameInfo.Constructibles[i];
            if (!c) continue;
            if (c.ConstructibleType === "WONDER_GREAT_STELE") {
                out.wonder_constructible_class_string = c.ConstructibleClass;
            }
            if (c.ConstructibleType === "BUILDING_BASILICA") {
                out.building_constructible_class_string = c.ConstructibleClass;
            }
            if (c.ConstructibleType === "IMPROVEMENT_TENTS") {
                out.improvement_constructible_class_string = c.ConstructibleClass;
            }
        }
    } catch (e) { out.cc_err = String(e); }

    // Find the hash for the ConstructibleClass strings via Types.
    try {
        const classStrings = ["WONDER", "BUILDING", "IMPROVEMENT", "DISTRICT",
            "CONSTRUCTIBLE_CLASS_WONDER", "CONSTRUCTIBLE_CLASS_BUILDING",
            "CONSTRUCTIBLE_CLASS_IMPROVEMENT"];
        out.class_string_hashes = {};
        for (const s of classStrings) {
            for (let i = 0; i < GameInfo.Types.length; i++) {
                const t = GameInfo.Types[i];
                if (t && t.Type === s) {
                    out.class_string_hashes[s] = {Hash: t.Hash, Kind: t.Kind};
                    break;
                }
            }
        }
    } catch (e) { out.cs_err = String(e); }

    return JSON.stringify(out);
})()
