(function() {
    const out = {};
    try {
        out.PlayerOperationTypes_keys = Object.keys(PlayerOperationTypes).sort();
    } catch (e) { out.pot_err = String(e); }
    try {
        // Specific candidates we care about
        out.GRANT_TREE_NODE = PlayerOperationTypes.GRANT_TREE_NODE;
        out.BUILD = PlayerOperationTypes.BUILD;
        out.GRANT_BUILDING = PlayerOperationTypes.GRANT_BUILDING;
        out.PLACE_BUILDING = PlayerOperationTypes.PLACE_BUILDING;
        out.GRANT_PRODUCTION = PlayerOperationTypes.GRANT_PRODUCTION;
        out.COMPLETE_BUILDING = PlayerOperationTypes.COMPLETE_BUILDING;
        out.PRODUCE_IMMEDIATELY = PlayerOperationTypes.PRODUCE_IMMEDIATELY;
    } catch (e) { out.candidate_err = String(e); }
    return JSON.stringify(out);
})()
