(function() {
    const out = {};

    // Player.Modifiers — what's on it?
    try {
        const p = Players.get(GameContext.localPlayerID);
        if (p.Modifiers) {
            const keys = [];
            for (const k in p.Modifiers) keys.push(k);
            out.player_modifiers_keys = keys;
            // Try common method names
            const candidates = ["addModifier", "removeModifier", "applyModifier",
                "getModifiers", "hasModifier", "getAllModifiers"];
            out.modifier_candidates = {};
            for (const m of candidates) {
                out.modifier_candidates[m] = typeof p.Modifiers[m];
            }
        } else {
            out.no_player_modifiers = true;
        }
    } catch (e) { out.pm_err = String(e); }

    // Game.Modifiers — separate world-level modifier system?
    try {
        if (typeof Game.Modifiers !== "undefined") {
            const keys = [];
            for (const k in Game.Modifiers) keys.push(k);
            out.game_modifiers_keys = keys;
        } else {
            out.no_game_modifiers = true;
        }
    } catch (e) { out.gm_err = String(e); }

    // Check for Modifiers / GameInfo.Modifiers tables
    try {
        if (GameInfo.Modifiers) {
            out.GameInfo_Modifiers_count = GameInfo.Modifiers.length;
            const sample = GameInfo.Modifiers[0];
            if (sample) {
                const s = {};
                for (const k in sample) {
                    try { const v = sample[k]; if (typeof v !== "function") s[k] = v; } catch (e) {}
                }
                out.modifier_sample = s;
            }
        }
    } catch (e) { out.gim_err = String(e); }

    // Tree-card DOM presence: is there a way to find current tree-card elements?
    try {
        if (typeof document !== "undefined") {
            out.has_document = true;
            const cards = document.querySelectorAll("tree-card");
            out.tree_cards_in_dom = cards ? cards.length : 0;
            // Sample one
            if (cards && cards[0]) {
                out.first_card_type = cards[0].getAttribute("type");
            }
        } else {
            out.has_document = false;
        }
    } catch (e) { out.dom_err = String(e); }

    // UI panel registration — what's available?
    try {
        out.has_UI = typeof UI !== "undefined";
        if (typeof UI !== "undefined") {
            const keys = [];
            for (const k in UI) keys.push(k);
            out.UI_keys = keys.slice(0, 50);
        }
        out.has_ContextManager = typeof ContextManager !== "undefined";
    } catch (e) { out.ui_err = String(e); }

    // Can the gameplay JS isolate see the UI engine.on events?
    try {
        // The tree-card-hovered is a CustomEvent dispatched on the DOM.
        // engine.on probably doesn't see it. window.addEventListener would.
        out.has_window = typeof window !== "undefined";
    } catch (e) {}

    // PlayerOperations grant modifier?
    try {
        out.PlayerOpTypes_with_MODIFIER = [];
        for (const k of Object.keys(PlayerOperationTypes)) {
            if (/MOD|MODIFIER|UNLOCK|GRANT|LOCK|DISABLE|ENABLE/i.test(k)) {
                out.PlayerOpTypes_with_MODIFIER.push(k);
            }
        }
    } catch (e) {}

    return JSON.stringify(out);
})()
