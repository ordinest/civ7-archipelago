(function() {
    const out = {};
    // Set a tiny payload directly
    const payload = JSON.stringify({"TEST_NODE": {item: "Test Item", player: "Tester", classification: "useful"}});
    const setResult = Game.AP_SetLocationInfo(payload);
    out.set_result = JSON.parse(setResult);

    // Immediately read back
    out.entries_after_set = Object.keys(Game._AP_LOCATION_INFO || {}).length;
    out.lookup_result = JSON.parse(Game.AP_GetLocationInfo("TEST_NODE"));
    out.status_field = JSON.parse(Game.AP_Status()).locationInfoEntries;
    return JSON.stringify(out);
})()
