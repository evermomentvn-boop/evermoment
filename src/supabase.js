import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://kcawjumetvrdbupjayrq.supabase.co";

const supabaseKey = "sb_publishable_d2PLGwyvQHAc5j0aKVT5_g_oIueFllU";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);