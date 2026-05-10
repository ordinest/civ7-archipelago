(function() {
    const out = {};

    // UniqueQuarters: likely has CivilizationType + BuildingTypes linkage
    try {
        const u = GameInfo.UniqueQuarters[0];
        if (u) {
            const sample = {};
            for (const k in u) {
                try { const v = u[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.unique_quarter_sample = sample;
            out.unique_quarters_count = GameInfo.UniqueQuarters.length;
        }

        // Find ROME's unique quarter if any
        for (let i = 0; i < GameInfo.UniqueQuarters.length; i++) {
            const u = GameInfo.UniqueQuarters[i];
            if (!u) continue;
            const s = {};
            for (const k in u) {
                try { const v = u[k]; if (typeof v !== "function") s[k] = v; } catch (e) {}
            }
            if (JSON.stringify(s).indexOf("ROME") !== -1) {
                out.rome_unique_quarter = s;
                break;
            }
        }
    } catch (e) { out.uq_err = String(e); }

    // ConstructibleModifiers: links constructibles to modifiers (which carry traits)
    try {
        const c = GameInfo.ConstructibleModifiers[0];
        if (c) {
            const sample = {};
            for (const k in c) {
                try { const v = c[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.constructible_modifier_sample = sample;
            out.constructible_modifiers_count = GameInfo.ConstructibleModifiers.length;
        }
    } catch (e) { out.cm_err = String(e); }

    // TraitModifiers TraitType matches: find all distinct traits Rome's civ has, then their modifiers
    try {
        const romeTraits = [];
        for (let i = 0; i < GameInfo.CivilizationTraits.length; i++) {
            const r = GameInfo.CivilizationTraits[i];
            if (r && r.CivilizationType === "CIVILIZATION_ROME") {
                romeTraits.push(r.TraitType);
            }
        }
        out.rome_traits = romeTraits;
    } catch (e) { out.rt_err = String(e); }

    // The Types table — may carry classification
    try {
        const t = GameInfo.Types[0];
        if (t) {
            const sample = {};
            for (const k in t) {
                try { const v = t[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.type_sample = sample;
            out.types_count = GameInfo.Types.length;
        }
        // Find BUILDING_BASILICA's type entry
        for (let i = 0; i < GameInfo.Types.length; i++) {
            const t = GameInfo.Types[i];
            if (t && t.Type === "BUILDING_BASILICA") {
                const s = {};
                for (const k in t) {
                    try { const v = t[k]; if (typeof v !== "function") s[k] = v; } catch (e) {}
                }
                out.basilica_type = s;
                break;
            }
        }
    } catch (e) { out.t_err = String(e); }

    // Look at the candidate ProgressionTree for Rome
    try {
        const tree = GameInfo.ProgressionTrees.lookup("TREE_CIVICS_AQ_ROME");
        if (tree) {
            const sample = {};
            for (const k in tree) {
                try { const v = tree[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.rome_civic_tree = sample;
        }
        // Find all nodes whose ProgressionTree == TREE_CIVICS_AQ_ROME
        const nodes = [];
        for (let i = 0; i < GameInfo.ProgressionTreeNodes.length; i++) {
            const n = GameInfo.ProgressionTreeNodes[i];
            if (n && n.ProgressionTree === "TREE_CIVICS_AQ_ROME") {
                nodes.push({
                    nodeType: n.ProgressionTreeNodeType,
                    name: n.Name,
                    UILayoutRow: n.UILayoutRow,
                    UILayoutColumn: n.UILayoutColumn
                });
            }
        }
        out.rome_civic_nodes = nodes;
    } catch (e) { out.rct_err = String(e); }

    // Look for TypeTags that involve Rome
    try {
        const romeTags = [];
        for (let i = 0; i < GameInfo.TypeTags.length; i++) {
            const tt = GameInfo.TypeTags[i];
            if (!tt) continue;
            if (String(tt.Tag).indexOf("ROME") !== -1 || String(tt.Type).indexOf("ROME") !== -1) {
                romeTags.push({Tag: tt.Tag, Type: tt.Type});
            }
        }
        out.rome_type_tags = romeTags;
    } catch (e) { out.rtt_err = String(e); }

    // BUILDINGS table — might be Civ 7's equivalent of unique-building registry
    try {
        const b = GameInfo.Buildings[0];
        if (b) {
            const sample = {};
            for (const k in b) {
                try { const v = b[k]; if (typeof v !== "function") sample[k] = v; } catch (e) {}
            }
            out.building_sample = sample;
            out.buildings_count = GameInfo.Buildings.length;
        }
        // BUILDING_BASILICA row
        for (let i = 0; i < GameInfo.Buildings.length; i++) {
            const b = GameInfo.Buildings[i];
            if (b && b.ConstructibleType === "BUILDING_BASILICA") {
                const s = {};
                for (const k in b) {
                    try { const v = b[k]; if (typeof v !== "function") s[k] = v; } catch (e) {}
                }
                out.basilica_building_row = s;
                break;
            }
        }
    } catch (e) { out.bld_err = String(e); }

    return JSON.stringify(out);
})()
