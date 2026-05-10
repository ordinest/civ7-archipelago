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
//      which resolves the item to its kind (tree_node, ideology_tier,
//      progressive_age, attribute_point) and dispatches the right
//      runtime call.

(function () {
    "use strict";

    // -------------------------------------------------------------
    // State
    // -------------------------------------------------------------

    /** Queue of locations the player has hit but the Python client
     *  has not yet pulled. Each entry is the Civ 7 internal node ID
     *  (or synthetic milestone ID for Legacy Paths / attribute points).
     */
    const unsentLocations = [];

    /** Set of node IDs already granted via AP delivery. Defensive only;
     *  the Python side dedupes too. */
    const grantedNodes = new Set();

    /** Cumulative attribute points earned. Threshold milestones queue a
     *  synthetic location ID for each one crossed. */
    let attributePointsEarned = 0;

    /** Number of Progressive Age items received. Tracked for diagnostics;
     *  no in-game effect (region transitions are AP-side). */
    let progressiveAgeReceived = 0;

    /** Items delivered by AP that we could not grant immediately because
     *  the target node is not in the current Age's progression tree.
     *  Drained and retried on PlayerAgeTransitionComplete. */
    const pendingItems = [];

    // -------------------------------------------------------------
    // Logging
    // -------------------------------------------------------------

    function log(msg) {
        try { console.log("[AP] " + msg); } catch (e) { /* no-op */ }
    }

    // -------------------------------------------------------------
    // Listeners: in-game events -> location queue
    // -------------------------------------------------------------

    /** Tech and civic node completions share `data.{player, activeNode}`.
     *  `activeNode` resolves via `GameInfo.ProgressionTreeNodes.lookup`
     *  to a node with `.ProgressionTreeNodeType` (string ID).
     *
     *  Mastery completion fires this same event (vanilla Civ 7 has no
     *  separate `MasteryCompleted`); we differentiate by the node's
     *  current depth on the player's tree at completion time. The
     *  current implementation queues the same internal node ID for
     *  both base and mastery; the AP server uses the location ID
     *  mapping to dispatch correctly because base and mastery are
     *  distinct AP locations on the same Civ 7 node.
     */
    function onProgressionNodeCompleted(treeKind, data) {
        try {
            if (data.player !== GameContext.localPlayerID) return;
            const node = GameInfo.ProgressionTreeNodes.lookup(data.activeNode);
            if (!node) return;
            unsentLocations.push(node.ProgressionTreeNodeType);
            log("queued " + treeKind + " check: " + node.ProgressionTreeNodeType);
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

    /** Legacy Path milestone completion. Source: shipped
     *  `model-victory-progress.chunk.js`. Payload `{player, milestone}`
     *  where `milestone` is looked up via
     *  `GameInfo.AgeProgressionMilestones.lookup` to a definition with
     *  `.AgeProgressionMilestoneType` (e.g. "ANTIQUITY_SCIENCE_MILESTONE_1").
     */
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

    /** Attribute points changed: payload `{player, ...}`. We re-query the
     *  total attribute-points-earned and queue threshold-milestone
     *  locations as the player crosses each one. The synthetic location
     *  ID is "AP_ATTRIBUTE_POINT_<N>" so the AP server can map it.
     */
    function onAttributePointsChanged(data) {
        try {
            if (data.player !== GameContext.localPlayerID) return;
            const player = Players.get(GameContext.localPlayerID);
            if (!player || !player.Identity) return;
            // The total attribute points earned across all attributes.
            // Most builds expose `player.Identity.getNumAttributePointsEarned`
            // or similar; if absent, fall back to summing per-attribute points.
            let earned;
            if (typeof player.Identity.getNumAttributePointsEarned === "function") {
                earned = player.Identity.getNumAttributePointsEarned();
            } else {
                // Best-effort: use the current `data.value` if provided.
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

    /** Age transition complete: clears `grantedNodes` because deliveries
     *  for the new Age may use the same set of internal node IDs as the
     *  previous Age (they don't, but defensive in case any synthetic
     *  IDs collide).
     */
    function onPlayerAgeTransitionComplete(data) {
        try {
            if (data.player !== GameContext.localPlayerID) return;
            log("age transition complete; flushing buffered items");
            flushPendingItems();
        } catch (e) {
            log("onPlayerAgeTransitionComplete error: " + e);
        }
    }

    // -------------------------------------------------------------
    // Item granting: AP delivery -> in-game runtime API
    // -------------------------------------------------------------

    /** Grant a tree node. Returns "ok", "deferred" (cross-Age buffer),
     *  or "error". `GameInfo.ProgressionTreeNodes.lookup` only resolves
     *  nodes from the player's current Age — Antiquity nodes during
     *  Antiquity, etc. — so receiving a later-Age item early is normal
     *  AP behaviour and must defer.
     */
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
        const args = {
            ProgressionTreeNodeType: info.$index,
            FullyUnlock: 1,
        };
        Game.PlayerOperations.sendRequest(
            GameContext.localPlayerID,
            PlayerOperationTypes.GRANT_TREE_NODE,
            args
        );
        grantedNodes.add(nodeTypeName);
        log("granted tree node: " + nodeTypeName + " ($index=" + info.$index + ")");
        return "ok";
    }

    /** Grant the Nth-tier node of the player's chosen ideology. The
     *  apworld emits 3 generic Modern Ideology Tier items; this maps
     *  each to the actual node on whichever ideology branch the player
     *  picked. Pre-condition: player has researched Political Theory
     *  and selected an ideology.
     */
    function grantIdeologyTier(tier) {
        const player = Players.get(GameContext.localPlayerID);
        if (!player || !player.Culture) {
            log("grantIdeologyTier: no player.Culture");
            return false;
        }
        const ideology = player.Culture.getChosenIdeology();
        if (!ideology) {
            log("grantIdeologyTier: no ideology chosen yet (player must research "
                + "Political Theory and pick an ideology first); buffering not "
                + "yet implemented, dropping tier=" + tier);
            return false;
        }
        // Map tier index to the corresponding branch node. Branch node
        // ordering follows the shipped XML's tier sequence (Tier 1 is the
        // ideology's starter node, 2 is mid, 3 is final).
        // Determine the ideology's node type set from the branch tree.
        const treeType = ideology.ProgressionTreeType;
        const tree = Game.ProgressionTrees.getTree(GameContext.localPlayerID, treeType);
        if (!tree || !tree.nodes || tree.nodes.length < tier) {
            log("grantIdeologyTier: tree has fewer than " + tier + " nodes");
            return false;
        }
        const node = tree.nodes[tier - 1];
        if (!node) {
            log("grantIdeologyTier: no node at tier " + tier);
            return false;
        }
        const nodeTypeName = node.nodeType;
        return grantTreeNode(nodeTypeName);
    }

    /** Grant a wildcard attribute point. Verified API from the shipped
     *  `Player.ltp` tuner panel: `player.Identity.addWildcardAttributePoints(N)`.
     */
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

    /** Progressive Age: AP-side region marker. No in-game effect; the
     *  player advances Ages via the normal Civ 7 progression. */
    function recordProgressiveAge() {
        progressiveAgeReceived += 1;
        log("recorded Progressive Age item (#" + progressiveAgeReceived + ")");
        return true;
    }

    /** Returns one of "ok", "deferred", "error" so the Python client
     *  can distinguish "applied" from "buffered for later" from "broken".
     */
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
            case "ideology_tier": {
                // Ideology tier requires the player to have chosen an
                // ideology. Defer if not chosen yet.
                const ok = grantIdeologyTier(entry.tier);
                if (!ok) {
                    pendingItems.push(itemName);
                    return "deferred";
                }
                return "ok";
            }
            case "attribute_point": return grantAttributePoint() ? "ok" : "error";
            case "progressive_age": return recordProgressiveAge() ? "ok" : "error";
            default:
                log("handleReceiveItem: unknown kind " + entry.kind);
                return "error";
        }
    }

    /** Attempt to grant every buffered item. Items that still cannot be
     *  granted (still wrong Age, no ideology yet) stay in the buffer. */
    function flushPendingItems() {
        if (pendingItems.length === 0) return;
        log("flushing " + pendingItems.length + " pending items");
        const carry = [];
        while (pendingItems.length) {
            const itemName = pendingItems.shift();
            const result = handleReceiveItem(itemName);
            if (result !== "ok") {
                carry.push(itemName);
            }
        }
        // Restore items that couldn't be granted yet.
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
            version: "0.3.0",
            queueLength: unsentLocations.length,
            grantedCount: grantedNodes.size,
            pendingCount: pendingItems.length,
            attributePointsEarned: attributePointsEarned,
            progressiveAgeReceived: progressiveAgeReceived,
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

    log("civ7-archipelago runtime v0.3.0 loaded; "
        + "item table size = " + Object.keys(Game._AP_ITEM_TO_NODE || {}).length);
})();
