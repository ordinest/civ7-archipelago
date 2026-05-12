(function () {
    const out = {};
    function check(key) {
        try {
            out[key] = {
                keyExists: Locale.keyExists(key),
                compose: Locale.compose(key),
            };
        } catch (e) {
            out[key] = { err: String(e) };
        }
    }

    // Base node key Civ 7 ships in vanilla.
    check("LOC_TECH_AGRICULTURE_NAME");
    check("LOC_TECH_WRITING_NAME");
    check("LOC_TECH_POTTERY_NAME");
    // Mastery-tier keys we add via the AP override file.
    check("LOC_TECH_WRITING_NAME_2");
    check("LOC_TECH_POTTERY_NAME_2");
    check("LOC_CIVIC_MYSTICISM_NAME_2");
    // A LOC key Et Cetera definitely sets, if their mod is enabled.
    check("LOC_CIVIC_CODE_OF_LAWS_NAME_2");
    // Mod-introduced sanity key (we never wrote this; should not exist)
    check("LOC_THIS_KEY_DOES_NOT_EXIST_FOO");

    return JSON.stringify(out);
})()
