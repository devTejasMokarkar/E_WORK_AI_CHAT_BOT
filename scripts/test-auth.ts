import './polyfill';

import { getWorkById } from '../src/lib/database';
import type { EworkUser } from '../src/types';

async function testAuth() {
  const blockUser: EworkUser = {
    mobile_number: '+919888888888',
    name: 'Rajesh Kumar',
    role: 'Block User',
    user_level: 'Block',
    district: 'Jaipur',
    block: 'Virat Nagar',
    gram_panchayat: '',
    agency: 'Block Office',
    status: 'Active'
  } as any;
  
  const result = await getWorkById('2026-27/3333', blockUser);
  console.log("Authorized:", result.authorized);
  console.log("Error:", result.error);
  console.log("Work found:", !!result.work);
}
testAuth();
