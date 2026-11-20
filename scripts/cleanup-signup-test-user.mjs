const base=(process.env.SUPABASE_URL||"https://magxbczgrxeypryjborr.supabase.co").replace(/\/$/,"");
const key=process.env.SUPABASE_SERVICE_ROLE_KEY,email=process.env.TEST_SIGNUP_EMAIL;
if(!key)throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to clean up disposable signup test users.");
const headers={apikey:key,Authorization:`Bearer ${key}`};
const list=await fetch(`${base}/auth/v1/admin/users?page=1&per_page=1000`,{headers});
if(!list.ok)throw new Error(`Could not list Auth users for signup cleanup (${list.status}): ${await list.text()}`);
const payload=await list.json();
const testEmailPatterns=[
  /^payables-e2e-signup-\d+@example\.com$/i,
  /^playwrighte2e\+payables-e2e-\d+@gmail\.com$/i
];
const users=(payload.users||[]).filter(user=>{
  const address=String(user.email||"");
  return (email && address.toLowerCase()===email.toLowerCase()) ||
    testEmailPatterns.some(pattern=>pattern.test(address));
});
if(!users.length){console.log("No disposable signup test users found; nothing to clean up.");process.exit(0);}
for(const user of users){
  const removed=await fetch(`${base}/auth/v1/admin/users/${user.id}`,{method:"DELETE",headers});
  if(!removed.ok)throw new Error(`Could not remove disposable signup test user (${removed.status}): ${await removed.text()}`);
}
console.log(`Removed ${users.length} disposable signup test user(s).`);
