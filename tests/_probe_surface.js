(function() {
    const p = Players.get(GameContext.localPlayerID);
    const out = {};
    function listKeys(obj) {
        const k = [];
        try { for (const x in obj) k.push(x); } catch (e) { k.push("__err__: " + e); }
        return k;
    }
    try { out.GameContext_keys = Object.keys(GameContext); } catch (e) { out.gck_err = String(e); }
    try { out.GameContext_age = GameContext.currentAge; } catch (e) { out.gca_err = String(e); }
    try {
        out.has_player_Ages = !!p.Ages;
        out.player_Ages_keys = listKeys(p.Ages);
    } catch (e) { out.pa_err = String(e); }
    try { out.player_GoodyHut_keys = listKeys(p.GoodyHut); } catch (e) { out.pgh_err = String(e); }
    try { out.player_Constructibles_keys = listKeys(p.Constructibles); } catch (e) { out.pc_err = String(e); }
    try { out.player_Civilization_keys = listKeys(p.Civilization); } catch (e) { out.pcv_err = String(e); }
    try { out.GameInfo_typeof = typeof GameInfo; } catch (e) {}
    try {
        const tables = ["Wonders", "GoodyHuts", "GoodyHutSubTypes", "Beliefs", "Religions", "Pantheons", "Civilizations", "Ages", "Constructibles", "UniqueBuildings", "LeaderCivics", "CivilizationCivics", "CivilizationProgressionTrees", "ProgressionTrees", "ProgressionTreeNodes", "TraitModifiers", "CivilizationTraits", "TraitProgressionTrees"];
        out.GameInfo_tables_present = {};
        for (const t of tables) {
            try { out.GameInfo_tables_present[t] = !!GameInfo[t]; }
            catch (e) { out.GameInfo_tables_present[t] = "err: " + e; }
        }
    } catch (e) { out.gi_table_err = String(e); }
    try {
        if (GameInfo.Ages) {
            const ages = [];
            for (let i = 0; i < 5; i++) {
                const a = GameInfo.Ages[i];
                if (!a) break;
                ages.push({AgeType: a.AgeType, Name: a.Name});
            }
            out.Ages_sample = ages;
        }
    } catch (e) { out.ages_err = String(e); }
    return JSON.stringify(out);
})()
