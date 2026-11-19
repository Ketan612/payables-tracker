const base=(process.env.SUPABASE_URL||"https://magxbczgrxeypryjborr.supabase.co").replace(/\/$/,"");
const key=process.env.SUPABASE_SERVICE_ROLE_KEY,email=process.env.TEST_SIGNUP_EMAIL;
if(!email){console.log("No disposable signup email configured; cleanup skipped.");process.exit(0);}
if(!key)throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to clean up the disposable signup test user.");
const headers={apikey:key,Authorization:`Bearer ${key}`};
const list=await fetch(`${base}/auth/v1/admin/users?page=1&per_page=1000`,{headers});
if(!list.ok)throw new Error(`Could not list Auth users for signup cleanup (${list.status}): ${await list.text()}`);
const payload=await list.json();
const user=(payload.users||[]).find(u=>String(u.email||"").toLowerCase()===email.toLowerCase());
if(!user){console.log("No disposable signup user found; nothing to clean up.");process.exit(0);}
const removed=await fetch(`${base}/auth/v1/admin/users/${user.id}`,{method:"DELETE",headers});
if(!removed.ok)throw new Error(`Could not remove disposable signup user (${removed.status}): ${await removed.text()}`);
console.log("Disposable signup test user removed.");
