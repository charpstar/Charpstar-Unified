import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testSchema() {
    // Try to get one record to see what columns exist
    const { data, error } = await supabase
        .from('assets')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Sample record from assets table:');
    console.log(JSON.stringify(data, null, 2));

    if (data && data.length > 0) {
        console.log('\nAvailable columns:');
        console.log(Object.keys(data[0]).join(', '));
    }
}

testSchema();
