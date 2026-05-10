// Civ 7 Archipelago in-game runtime.
//
// Loads after `ap_item_map.js`, which has populated `Game._AP_ITEM_TO_NODE`
// with the full apworld item table. Runs in Civ 7's UI/gameplay JS isolate
// with access to `Game`, `Players`, `GameInfo`, `engine`, `GameContext`.
//
// The Python `TunerClient` polls this script over the FireTuner socket
// for two purposes:
//   1. Pull the queue of recently-completed location checks
//      (`Game.AP_GetUnsentCheckedLocations()` returns + clears).
//   2. Push received items via `Game.AP_HandleReceiveItem(itemName)`,
//      which resolves the item to its kind and dispatches the right
//      runtime call.
//
// Event mechanisms confirmed via FireTuner probing against Civ 7 1.x
// (see tests/probe_in_game.py + tests/_probe_*.js for the methodology).

(function () {
    "use strict";

    // -------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------

    // Per-Age progressive-slot caps for caps 5, 7, 8, 9. Match the
    // apworld definitions in apworld/data/civ_uniques.py and
    // apworld/data/extras.py.
    const WONDER_SLOT_CAP = 3;
    const DISCOVERY_SLOT_CAP = 5;
    const RELIGION_BELIEF_SLOT_CAP = 4;
    const CIVIC_TREE_SLOT_CAP = 4;        // matches CIVIC_TREE_SLOTS_PER_AGE

    // Notification type hash for discovery reward selection. Resolved
    // via probing: GameInfo.Types lookup of
    // "NOTIFICATION_CHOOSE_DISCOVERY_STORY_DIRECTION".
    const NOTIFICATION_TYPE_DISCOVERY = 1287223640;

    // -------------------------------------------------------------
    // State
    // -------------------------------------------------------------

    const unsentLocations = [];
    const grantedNodes = new Set();
    let attributePointsEarned = 0;
    let progressiveAgeReceived = 0;
    const pendingItems = [];

    // Per-Age counters. Keyed on Age display name ("Antiquity" /
    // "Exploration" / "Modern").
    const wonderCountByAge = { Antiquity: 0, Exploration: 0, Modern: 0 };
    const discoveryCountByAge = { Antiquity: 0, Exploration: 0, Modern: 0 };
    const civicTreeCountByAge = { Antiquity: 0, Exploration: 0, Modern: 0 };
    let religionBeliefCount = 0;

    // Dedupe sets: WonderCompleted fires twice per wonder; we only want
    // to fire one AP check.
    const wondersAlreadyFired = new Set();

    // -------------------------------------------------------------
    // Logging
    // -------------------------------------------------------------

    function log(msg) {
        try { console.log("[AP] " + msg); } catch (e) { /* no-op */ }
    }

    // -------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------

    /** Returns the local player's current Age display name as it
     *  appears in AP location names ("Antiquity" / "Exploration" /
     *  "Modern"). Resolves `player.Ages.age` (hash) via
     *  `GameInfo.Ages.lookup(hash).AgeType` ("AGE_ANTIQUITY", etc.).
     */
    function currentAgeDisplay() {
        try {
            const p = Players.get(GameContext.localPlayerID);
            if (!p || !p.Ages) return "Antiquity";
            const ageHash = p.Ages.age;
            const def = GameInfo.Ages.lookup(ageHash);
            if (!def || !def.AgeType) return "Antiquity";
            const s = String(def.AgeType).toUpperCase();
            if (s.indexOf("ANTIQUITY") !== -1) return "Antiquity";
            if (s.indexOf("EXPLORATION") !== -1) return "Exploration";
            if (s.indexOf("MODERN") !== -1) return "Modern";
            return "Antiquity";
        } catch (e) {
            log("currentAgeDisplay error: " + e);
            return "Antiquity";
        }
    }

    /** Returns the local player's civilization's unique civic tree hash
     *  for the current Age, or null if it cannot be resolved.
     *  Used to distinguish civ-unique civic completions (cap 5) from
     *  shared civic completions (cap 1).
     */
    function currentCivUniqueTreeHash() {
        try {
            const p = Players.get(GameContext.localPlayerID);
            if (!p) return null;
            const civDef = GameInfo.Civilizations.lookup(p.civilizationType);
            if (!civDef || !civDef.UniqueCultureProgressionTree) return null;
            const tree = GameInfo.ProgressionTrees.lookup(
                civDef.UniqueCultureProgressionTree
            );
            return tree ? tree.$hash : null;
        } catch (e) {
            log("currentCivUniqueTreeHash error: " + e);
            return null;
        }
    }

    // -------------------------------------------------------------
    // Event listeners: in-game events -> location queue
    // -------------------------------------------------------------

    /** TechNodeCompleted / CultureNodeCompleted carry
     *  `{player, tree, activeNode, nodeDepth, completionType,
     *   previousNodeCompleted}`. The same event fires twice for masterable
     *  nodes: once with nodeDepth=1 (base) and once with nodeDepth=2
     *  (mastery).
     *
     *  Dispatch:
     *    nodeDepth=1, common civic tree     -> base check (queue node id)
     *    nodeDepth=2, common civic tree     -> mastery check (queue "MASTERY:<id>")
     *    nodeDepth=1, civ-unique civic tree -> cap-5 civic slot check
     */
    function onProgressionNodeCompleted(treeKind, data) {
        try {
            if (data.player !== GameContext.localPlayerID) return;
            const node = GameInfo.ProgressionTreeNodes.lookup(data.activeNode);
            if (!node) return;
            const nodeId = node.ProgressionTreeNodeType;
            const depth = data.nodeDepth;

            // Cap 5: civ-unique civic tree node completion. Detect by
            // matching the event's tree hash to the player's civ-unique
            // tree hash.
            if (treeKind === "civic" && depth === 1) {
                const civTreeHash = currentCivUniqueTreeHash();
                if (civTreeHash !== null && data.tree === civTreeHash) {
                    const age = currentAgeDisplay();
                    if (civicTreeCountByAge[age] !== undefined
                        && civicTreeCountByAge[age] < CIVIC_TREE_SLOT_CAP) {
                        civicTreeCountByAge[age] += 1;
                        const apName = age + " Civ Civic Tree Slot "
                            + civicTreeCountByAge[age] + " Completed";
                        unsentLocations.push(apName);
                        log("queued civ-civic slot: " + apName + " (node " + nodeId + ")");
                    }
                    return;
                }
            }

            if (depth === 1) {
                unsentLocations.push(nodeId);
                log("queued " + treeKind + " base check: " + nodeId);
            } else if (depth === 2) {
                const synthetic = "MASTERY:" + nodeId;
                unsentLocations.push(synthetic);
                log("queued " + treeKind + " mastery check: " + synthetic);
            }
        } catch (e) {
            log("onProgressionNodeCompleted error: " + e);
        }
    }

    function onTechNodeCompleted(data) {
        onProgressionNodeCompleted("tech", data);
    }
    function onCultureNodeCompleted(data) {
        onProgressionNodeCompleted("civic", data);
    }

    /** Legacy Path milestone completion. */
    function onLegacyPathMilestoneCompleted(data) {
        try {
            if (data.player !== GameContext.localPlayerID) return;
            const m = GameInfo.AgeProgressionMilestones.lookup(data.milestone);
            if (!m) return;
            unsentLocations.push(m.AgeProgressionMilestoneType);
            log("queued legacy milestone: " + m.AgeProgressionMilestoneType);
        } catch (e) {
            log("onLegacyPathMilestoneCompleted error: " + e);
        }
    }

    /** Attribute-point milestone crossings. */
    function onAttributePointsChanged(data) {
        try {
            if (data.player !== GameContext.localPlayerID) return;
            const player = Players.get(GameContext.localPlayerID);
            if (!player || !player.Identity) return;
            let earned;
            if (typeof player.Identity.getNumAttributePointsEarned === "function") {
                earned = player.Identity.getNumAttributePointsEarned();
            } else {
                earned = (typeof data.value === "number") ? data.value : 0;
            }
            while (attributePointsEarned < earned) {
                attributePointsEarned += 1;
                const id = "AP_ATTRIBUTE_POINT_" + attributePointsEarned;
                unsentLocations.push(id);
                log("queued attribute-point milestone: " + id);
            }
        } catch (e) {
            log("onAttributePointsChanged error: " + e);
        }
    }

    /** Cap 6: pantheon founded. Confirmed payload: {belief, player}. */
    function onPantheonFounded(data) {
        try {
            if (data.player !== GameContext.localPlayerID) return;
            unsentLocations.push("Pantheon Founded");
            log("queued Pantheon Founded");
        } catch (e) { log("onPantheonFounded error: " + e); }
    }

    /** Cap 7: religion founded. Canonical event per gamecore-events.xml. */
    function onReligionFounded(data) {
        try {
            if (data && data.player !== undefined
                && data.player !== GameContext.localPlayerID) return;
            unsentLocations.push("Religion Founded");
            log("queued Religion Founded");
        } catch (e) { log("onReligionFounded error: " + e); }
    }

    /** Cap 7: belief adopted. Canonical event per gamecore-events.xml.
     *  Each fire advances the next slot up to the cap.
     */
    function onBeliefAdded(data) {
        try {
            if (data && data.player !== undefined
                && data.player !== GameContext.localPlayerID) return;
            if (religionBeliefCount >= RELIGION_BELIEF_SLOT_CAP) return;
            religionBeliefCount += 1;
            const apName = "Religious Belief Adopted Slot " + religionBeliefCount;
            unsentLocations.push(apName);
            log("queued " + apName);
        } catch (e) { log("onBeliefAdded error: " + e); }
    }

    /** Cap 8: wonder built. WonderCompleted fires TWICE per wonder
     *  (verified live), so we dedupe on constructibleType.
     *  Payload: {constructibleType, constructible: {owner}, location, ...}.
     */
    function onWonderCompleted(data) {
        try {
            if (!data.constructible || data.constructible.owner !== GameContext.localPlayerID) return;
            if (wondersAlreadyFired.has(data.constructibleType)) return;
            wondersAlreadyFired.add(data.constructibleType);

            const age = currentAgeDisplay();
            if (wonderCountByAge[age] === undefined) return;
            if (wonderCountByAge[age] >= WONDER_SLOT_CAP) return;
            wonderCountByAge[age] += 1;
            const apName = age + " Wonder Built Slot " + wonderCountByAge[age];
            unsentLocations.push(apName);
            log("queued " + apName + " (wonder hash " + data.constructibleType + ")");
        } catch (e) { log("onWonderCompleted error: " + e); }
    }

    /** Cap 9: discovery (goody hut equivalent in Civ 7). Discoveries are
     *  narrative stories presented through a notification; the local
     *  player is the only one whose notification with type hash
     *  NOTIFICATION_CHOOSE_DISCOVERY_STORY_DIRECTION (1287223640) is
     *  dismissed.
     */
    function onNotificationDismissed(data) {
        try {
            if (!data.id || data.id.owner !== GameContext.localPlayerID) return;
            if (data.type !== NOTIFICATION_TYPE_DISCOVERY) return;
            const age = currentAgeDisplay();
            if (discoveryCountByAge[age] === undefined) return;
            if (discoveryCountByAge[age] >= DISCOVERY_SLOT_CAP) return;
            discoveryCountByAge[age] += 1;
            const apName = age + " Discovery Found Slot " + discoveryCountByAge[age];
            unsentLocations.push(apName);
            log("queued " + apName);
        } catch (e) { log("onNotificationDismissed error: " + e); }
    }

    function onPlayerAgeTransitionComplete(data) {
        try {
            if (data.player !== GameContext.localPlayerID) return;
            log("age transition complete; flushing buffered items");
            flushPendingItems();
        } catch (e) { log("onPlayerAgeTransitionComplete error: " + e); }
    }

    // -------------------------------------------------------------
    // Item granting: AP delivery -> in-game runtime API
    // -------------------------------------------------------------

    function grantTreeNode(nodeTypeName) {
        if (grantedNodes.has(nodeTypeName)) {
            log("grantTreeNode: already granted " + nodeTypeName + ", skipping");
            return "ok";
        }
        const info = GameInfo.ProgressionTreeNodes.lookup(nodeTypeName);
        if (!info) {
            log("grantTreeNode: deferred until later Age (" + nodeTypeName + ")");
            return "deferred";
        }
        const args = { ProgressionTreeNodeType: info.$index, FullyUnlock: 1 };
        Game.PlayerOperations.sendRequest(
            GameContext.localPlayerID,
            PlayerOperationTypes.GRANT_TREE_NODE,
            args
        );
        grantedNodes.add(nodeTypeName);
        log("granted tree node: " + nodeTypeName);
        return "ok";
    }

    /** Grant a second depth tier (mastery) on an existing tree node.
     *  Uses GRANT_TREE_NODE again with FullyUnlock=0 (advance one tier).
     */
    function grantTreeNodeMastery(nodeTypeName) {
        const info = GameInfo.ProgressionTreeNodes.lookup(nodeTypeName);
        if (!info) {
            log("grantTreeNodeMastery: deferred until later Age (" + nodeTypeName + ")");
            return "deferred";
        }
        const args = { ProgressionTreeNodeType: info.$index, FullyUnlock: 0 };
        Game.PlayerOperations.sendRequest(
            GameContext.localPlayerID,
            PlayerOperationTypes.GRANT_TREE_NODE,
            args
        );
        log("granted mastery on " + nodeTypeName);
        return "ok";
    }

    /** Grant the Nth-tier node of the player's chosen ideology. */
    function grantIdeologyTier(tier) {
        const player = Players.get(GameContext.localPlayerID);
        if (!player || !player.Culture) {
            log("grantIdeologyTier: no player.Culture");
            return false;
        }
        const ideology = player.Culture.getChosenIdeology();
        if (!ideology) {
            log("grantIdeologyTier: no ideology chosen yet; deferring tier=" + tier);
            return false;
        }
        const treeType = ideology.ProgressionTreeType;
        const tree = Game.ProgressionTrees.getTree(GameContext.localPlayerID, treeType);
        if (!tree || !tree.nodes || tree.nodes.length < tier) {
            log("grantIdeologyTier: tree has fewer than " + tier + " nodes");
            return false;
        }
        const node = tree.nodes[tier - 1];
        if (!node) return false;
        return grantTreeNode(node.nodeType) === "ok";
    }

    /** Advance a legacy path by one milestone. Confirmed API. */
    function grantLegacyPath(legacyPathId) {
        try {
            const player = Players.get(GameContext.localPlayerID);
            if (!player || !player.LegacyPaths) {
                log("grantLegacyPath: no player.LegacyPaths");
                return "error";
            }
            if (typeof player.LegacyPaths.addLegacyPathEvent === "function") {
                player.LegacyPaths.addLegacyPathEvent(legacyPathId, 1);
                log("granted legacy path event: " + legacyPathId);
                return "ok";
            }
            log("grantLegacyPath: addLegacyPathEvent API missing");
            return "error";
        } catch (e) {
            log("grantLegacyPath error: " + e);
            return "error";
        }
    }

    /** Cap 5: grant the Nth node of the local player's civ-unique civic
     *  tree for the named Age. The mod resolves the Nth node at
     *  delivery time and issues GRANT_TREE_NODE on it.
     *
     *  Pre-condition: player is in (or has passed) the named Age. If
     *  the tree's not lookup-able yet (cross-Age delivery), defer.
     */
    function grantCivCivicSlot(age, slot) {
        try {
            const currentAge = currentAgeDisplay();
            if (currentAge !== age) {
                log("grantCivCivicSlot: deferred (item Age " + age
                    + " != current " + currentAge + ")");
                return "deferred";
            }
            const p = Players.get(GameContext.localPlayerID);
            if (!p) return "error";
            const civDef = GameInfo.Civilizations.lookup(p.civilizationType);
            if (!civDef || !civDef.UniqueCultureProgressionTree) {
                log("grantCivCivicSlot: no UniqueCultureProgressionTree for civ");
                return "error";
            }
            const treeType = civDef.UniqueCultureProgressionTree;
            // Enumerate the tree's nodes via GameInfo.ProgressionTreeNodes
            // filtered by ProgressionTree field.
            const nodes = [];
            for (let i = 0; i < GameInfo.ProgressionTreeNodes.length; i++) {
                const n = GameInfo.ProgressionTreeNodes[i];
                if (n && n.ProgressionTree === treeType) nodes.push(n);
            }
            if (nodes.length < slot) {
                log("grantCivCivicSlot: civ has fewer than " + slot
                    + " civic-tree nodes; no-op");
                return "ok";  // soft success — civs with fewer slots
            }
            const target = nodes[slot - 1];
            return grantTreeNode(target.ProgressionTreeNodeType);
        } catch (e) {
            log("grantCivCivicSlot error: " + e);
            return "error";
        }
    }

    function grantAttributePoint() {
        const player = Players.get(GameContext.localPlayerID);
        if (!player || !player.Identity) {
            log("grantAttributePoint: no player.Identity");
            return false;
        }
        if (typeof player.Identity.addWildcardAttributePoints !== "function") {
            log("grantAttributePoint: addWildcardAttributePoints API missing");
            return false;
        }
        player.Identity.addWildcardAttributePoints(1);
        log("granted wildcard attribute point");
        return true;
    }

    function recordProgressiveAge() {
        progressiveAgeReceived += 1;
        log("recorded Progressive Age item (#" + progressiveAgeReceived + ")");
        return true;
    }

    function handleReceiveItem(itemName) {
        const entry = (Game._AP_ITEM_TO_NODE || {})[itemName];
        if (!entry) {
            log("handleReceiveItem: unknown item " + itemName);
            return "error";
        }
        switch (entry.kind) {
            case "tree_node": {
                const status = grantTreeNode(entry.node_id);
                if (status === "deferred") pendingItems.push(itemName);
                return status;
            }
            case "tree_node_mastery": {
                const status = grantTreeNodeMastery(entry.node_id);
                if (status === "deferred") pendingItems.push(itemName);
                return status;
            }
            case "ideology_tier": {
                const ok = grantIdeologyTier(entry.tier);
                if (!ok) {
                    pendingItems.push(itemName);
                    return "deferred";
                }
                return "ok";
            }
            case "legacy_path": {
                const status = grantLegacyPath(entry.legacy_path_id);
                if (status === "deferred") pendingItems.push(itemName);
                return status;
            }
            case "civ_civic_slot": {
                const status = grantCivCivicSlot(entry.age, entry.slot);
                if (status === "deferred") pendingItems.push(itemName);
                return status;
            }
            case "attribute_point": return grantAttributePoint() ? "ok" : "error";
            case "progressive_age": return recordProgressiveAge() ? "ok" : "error";
            default:
                log("handleReceiveItem: unknown kind " + entry.kind);
                return "error";
        }
    }

    function flushPendingItems() {
        if (pendingItems.length === 0) return;
        log("flushing " + pendingItems.length + " pending items");
        const carry = [];
        while (pendingItems.length) {
            const itemName = pendingItems.shift();
            const result = handleReceiveItem(itemName);
            if (result !== "ok") carry.push(itemName);
        }
        for (const item of carry) pendingItems.push(item);
    }

    // -------------------------------------------------------------
    // Public API exposed on `Game.AP_*`
    // -------------------------------------------------------------

    Game.AP_GetUnsentCheckedLocations = function () {
        const drained = unsentLocations.splice(0, unsentLocations.length);
        return JSON.stringify(drained);
    };

    Game.AP_HandleReceiveItem = function (itemName) {
        const status = handleReceiveItem(itemName);
        return JSON.stringify({
            ok: status === "ok" || status === "deferred",
            status: status,
            item: itemName,
        });
    };

    Game.AP_IsInGame = function () {
        try {
            const id = GameContext.localPlayerID;
            return JSON.stringify({ inGame: id !== undefined && id >= 0 });
        } catch (e) {
            return JSON.stringify({ inGame: false });
        }
    };

    Game.AP_Status = function () {
        return JSON.stringify({
            mod: "civ7-archipelago",
            version: "0.4.0",
            queueLength: unsentLocations.length,
            grantedCount: grantedNodes.size,
            pendingCount: pendingItems.length,
            attributePointsEarned: attributePointsEarned,
            progressiveAgeReceived: progressiveAgeReceived,
            currentAge: currentAgeDisplay(),
            wondersFired: wondersAlreadyFired.size,
            religionBeliefCount: religionBeliefCount,
            civicTreeByAge: civicTreeCountByAge,
            wonderByAge: wonderCountByAge,
            discoveryByAge: discoveryCountByAge,
            itemTableSize: Object.keys(Game._AP_ITEM_TO_NODE || {}).length,
        });
    };

    // -------------------------------------------------------------
    // Bootstrap
    // -------------------------------------------------------------

    engine.on("TechNodeCompleted", onTechNodeCompleted);
    engine.on("CultureNodeCompleted", onCultureNodeCompleted);
    engine.on("LegacyPathMilestoneCompleted", onLegacyPathMilestoneCompleted);
    engine.on("AttributePointsChanged", onAttributePointsChanged);
    engine.on("PlayerAgeTransitionComplete", onPlayerAgeTransitionComplete);
    engine.on("PantheonFounded", onPantheonFounded);
    engine.on("ReligionFounded", onReligionFounded);
    engine.on("BeliefAdded", onBeliefAdded);
    engine.on("WonderCompleted", onWonderCompleted);
    engine.on("NotificationDismissed", onNotificationDismissed);

    log("civ7-archipelago runtime v0.4.0 loaded; "
        + "item table size = " + Object.keys(Game._AP_ITEM_TO_NODE || {}).length);
})();
