"use strict";
// Supabase client factory
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupabaseClient = createSupabaseClient;
const supabase_js_1 = require("@supabase/supabase-js");
function createSupabaseClient(url, key) {
    return (0, supabase_js_1.createClient)(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    });
}
