(function() {
    const out = {};

    // Resolve each constructibleClass that has appeared in event payloads.
    const targetClasses = ["BUILDING", "WONDER", "IMPROVEMENT", "DISTRICT",
        "CONSTRUCTIBLE_CLASS_BUILDING", "CONSTRUCTIBLE_CLASS_WONDER",
        "CONSTRUCTIBLE_CLASS_IMPROVEMENT"];

    try {
        // Sample a few rows from GameInfo.Types to find ConstructibleClass entries
        const classHashes = {};
        for (let i = 0; i < GameInfo.Types.length; i++) {
            const t = GameInfo.Types[i];
            if (!t) continue;
            if (t.Kind === "KIND_CONSTRUCTIBLE_CLASS" || /CLASS/.test(String(t.Type))) {
                classHashes[t.Type] = t.Hash;
            }
        }
        out.class_hashes = classHashes;
    } catch (e) { out.ch_err = String(e); }

    // Direct lookup: types whose Type matches our class candidates
    try {
        const found = {};
        for (let i = 0; i < GameInfo.Types.length; i++) {
            const t = GameInfo.Types[i];
            if (!t) continue;
            for (const cand of targetClasses) {
                if (t.Type === cand) found[cand] = {Type: t.Type, Hash: t.Hash, Kind: t.Kind};
            }
        }
        out.target_class_lookup = found;
    } catch (e) { out.tcl_err = String(e); }

    // Resolve specific constructibleType hashes we saw in events.
    const eventHashes = [168372657, 1001859687, -730988948, -80493497, 1433414340, -767798966, -2128205823];
    out.event_hash_lookup = {};
    for (const h of eventHashes) {
        out.event_hash_lookup[h] = null;
        try {
            for (let i = 0; i < GameInfo.Types.length; i++) {
                const t = GameInfo.Types[i];
                if (t && t.Hash === h) {
                    out.event_hash_lookup[h] = {Type: t.Type, Kind: t.Kind};
                    break;
                }
            }
        } catch (e) { out.event_hash_lookup[h] = "err: " + e; }
    }

    // Probe player.GoodyHut methods by direct invocation guesses.
    try {
        const p = Players.get(GameContext.localPlayerID);
        const g = p.GoodyHut;
        out.goodyhut_methods_test = {};
        const candidateMethods = ["getCount", "getNumCollected", "getNumPopped",
            "getCollectedCount", "getActivated", "getCount", "getNumRewards"];
        for (const m of candidateMethods) {
            try {
                out.goodyhut_methods_test[m] = (typeof g[m] === "function") ?
                    String(g[m]()) : ("not_function: " + typeof g[m]);
            } catch (e) { out.goodyhut_methods_test[m] = "err: " + e; }
        }
        // Try Object.getOwnPropertyNames
        try {
            out.goodyhut_own_names = Object.getOwnPropertyNames(g);
        } catch (e) { out.gh_own_err = String(e); }
        try {
            const proto = Object.getPrototypeOf(g);
            out.goodyhut_proto_names = proto ? Object.getOwnPropertyNames(proto) : null;
        } catch (e) { out.gh_proto_err = String(e); }
    } catch (e) { out.gh_err = String(e); }

    return JSON.stringify(out);
})()
