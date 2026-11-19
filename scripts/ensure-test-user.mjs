const base=(process.env.SUPABASE_URL||"https://magxbczgrxeypryjborr.supabase.co").replace(/\/$/,"");
const key=process.env.SUPABASE_SERVICE_ROLE_KEY,email=process.env.TEST_USER_EMAIL,password=process.env.TEST_USER_PASSWORD;
if(!key||!email||!password)throw new Error("Set SUPABASE_SERVICE_ROLE_KEY, TEST_USER_EMAIL and TEST_USER_PASSWORD.");
const headers={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
const list=await fetch(`${base}/auth/v1/admin/users?page=1&per_page=1000`,{headers});
if(!list.ok)throw new Error(`Could not list Auth users (${list.status}): ${await list.text()}`);
const payload=await list.json(),found=(payload.users||[]).find(u=>String(u.email||"").toLowerCase()===email.toLowerCase());
if(!found){const r=await fetch(`${base}/auth/v1/admin/users`,{method:"POST",headers,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:"Payables Tracker E2E Test User",test_account:true}})});if(!r.ok)throw new Error(`Could not create test user (${r.status}): ${await r.text()}`);console.log("Created dedicated E2E test user.");}
else{const r=await fetch(`${base}/auth/v1/admin/users/${found.id}`,{method:"PUT",headers,body:JSON.stringify({password,email_confirm:true,user_metadata:{...(found.user_metadata||{}),full_name:"Payables Tracker E2E Test User",test_account:true}})});if(!r.ok)throw new Error(`Could not reset dedicated test user's password (${r.status}): ${await r.text()}`);console.log("Dedicated E2E test user exists; password refreshed.");}