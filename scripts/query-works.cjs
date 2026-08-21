require('dotenv').config({ path: '.env.local' });
globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function queryWorks() {
  const { data, error } = await supabase.from('works').select('work_id').limit(5);
  if (error) console.error(error);
  else console.log(data);
}
queryWorks();
