(function() {
    const out = {};
    // Visible-context probe: change body bg to red. If you DON'T see red,
    // this context is not the visible UI view.
    try {
        document.body.style.outline = "10px solid magenta";
        document.body.style.outlineOffset = "-10px";
        out.applied_outline = true;
    } catch (e) { out.outline_err = String(e); }

    // What other context-bridging APIs exist?
    out.has_engine_call = typeof engine !== "undefined" && typeof engine.call === "function";
    out.has_engine_trigger = typeof engine !== "undefined" && typeof engine.trigger === "function";

    if (typeof engine !== "undefined") {
        const keys = [];
        for (const k in engine) keys.push(k);
        out.engine_keys = keys;
    }

    // Multi-view: cohtml stuff
    out.has_cohtml = typeof cohtml !== "undefined";
    out.has_window_frames = typeof window !== "undefined" && window.frames ? window.frames.length : null;

    return JSON.stringify(out);
})()
