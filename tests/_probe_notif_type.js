(function() {
    const out = {};
    const targetHash = 1287223640;

    // Try direct lookup
    try {
        for (let i = 0; i < GameInfo.Types.length; i++) {
            const t = GameInfo.Types[i];
            if (t && t.Hash === targetHash) {
                out.hash_match = {Type: t.Type, Kind: t.Kind};
                break;
            }
        }
    } catch (e) { out.h_err = String(e); }

    // Find all notification types
    try {
        const notifs = [];
        for (let i = 0; i < GameInfo.Types.length; i++) {
            const t = GameInfo.Types[i];
            if (!t) continue;
            const s = String(t.Type);
            if (s.startsWith("NOTIFICATION_")) {
                notifs.push({Type: t.Type, Hash: t.Hash, Kind: t.Kind});
            }
        }
        out.notification_types_count = notifs.length;
        out.notification_types = notifs;
    } catch (e) { out.n_err = String(e); }

    return JSON.stringify(out);
})()
