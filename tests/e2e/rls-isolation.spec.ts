import {test,expect,APIRequestContext} from "@playwright/test";

const supabaseUrl=process.env.SUPABASE_URL!;
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ownerEmail=process.env.TEST_USER_EMAIL!;
const ownerPassword=process.env.TEST_USER_PASSWORD!;
const publishableKey="sb_publishable_o3SjG1KCygJ99RuamTJdsQ_RIkHJ-gX";

async function expectOk(response:any,label:string){
 const body=await response.text();
 expect(response.ok(),label+" failed: "+response.status()+" "+body).toBeTruthy();
 return body?JSON.parse(body):null;
}
async function signIn(request:APIRequestContext,email:string,password:string){
 const response=await request.post(supabaseUrl+"/auth/v1/token?grant_type=password",{
  headers:{apikey:publishableKey,"Content-Type":"application/json"},
  data:{email,password}
 });
 const session=await expectOk(response,"Sign in "+email);
 expect(session.access_token,"Auth response must include an access token").toBeTruthy();
 return session;
}
function userHeaders(token:string){
 return {apikey:publishableKey,Authorization:"Bearer "+token,"Content-Type":"application/json",Prefer:"return=representation"};
}
async function rest(request:APIRequestContext,token:string,table:string,method:string,query:string,data?:unknown){
 return request.fetch(supabaseUrl+"/rest/v1/"+table+(query?"?"+query:""),{
  method,headers:userHeaders(token),...(data===undefined?{}:{data})
 });
}

test("RLS isolates financial and profile data between two authenticated users",async({request})=>{
 test.skip(!serviceKey||!supabaseUrl||!ownerEmail||!ownerPassword,"Supabase E2E credentials are required.");
 const marker="E2E-RLS-"+Date.now();
 const secondaryEmail="e2e-rls-"+Date.now()+"@payables-test.invalid";
 const secondaryPassword="RlsTest!"+Date.now()+"aA9";
 let secondaryUserId:string|undefined;
 let ownerToken:string|undefined;
 let secondaryToken:string|undefined;
 let secondaryBankId:string|undefined;
 const created:{table:string;id:string}[]=[];
 try{
  const createUser=await request.post(supabaseUrl+"/auth/v1/admin/users",{
   headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"},
   data:{email:secondaryEmail,password:secondaryPassword,email_confirm:true,user_metadata:{e2e_test:true}}
  });
  const newUser=await expectOk(createUser,"Create disposable secondary auth user");
  secondaryUserId=newUser.id;

  const [ownerSession,secondarySession]=await Promise.all([
   signIn(request,ownerEmail,ownerPassword),
   signIn(request,secondaryEmail,secondaryPassword)
  ]);
  ownerToken=ownerSession.access_token;
  secondaryToken=secondarySession.access_token;
  const ownerId=ownerSession.user.id;
  expect(secondarySession.user.id).not.toBe(ownerId);

  const records=[
   {table:"bank_accounts",payload:{user_id:ownerId,account_name:marker+" bank",institution_name:"E2E",account_type:"bank",notes:marker}},
   {table:"payment_cards",payload:{user_id:ownerId,card_name:marker+" card",issuer:"E2E",notes:marker}},
   {table:"people",payload:{user_id:ownerId,name:marker+" person",notes:marker}},
   {table:"emi_schedules",payload:{user_id:ownerId,lender_name:"E2E",loan_name:marker+" emi",installment_amount:10,first_due_date:"2026-12-01",notes:marker}}
  ];
  for(const item of records){
   const response=await rest(request,ownerToken,item.table,"POST","select=id",item.payload);
   const rows=await expectOk(response,"Owner insert into "+item.table);
   expect(rows).toHaveLength(1);
   created.push({table:item.table,id:rows[0].id});
  }

  // User B must not read any User A rows in the core personal-data tables.
  for(const item of records){
   const filterColumn=({bank_accounts:"account_name",payment_cards:"card_name",people:"name",emi_schedules:"loan_name"} as Record<string,string>)[item.table];
   const response=await rest(request,secondaryToken,item.table,"GET","select=*&"+filterColumn+"=like.*"+encodeURIComponent(marker)+"*");
   const rows=await expectOk(response,"Cross-user read check for "+item.table);
   expect(rows,"Other user must not see "+item.table+" rows").toEqual([]);
  }

  // User B cannot update or delete User A's bank account by guessing its UUID.
  const bank=created.find(x=>x.table==="bank_accounts")!;
  const update=await rest(request,secondaryToken,"bank_accounts","PATCH","id=eq."+bank.id,{account_name:marker+" compromised"});
  const updated=await expectOk(update,"Cross-user update attempt");
  expect(updated,"Cross-user update must affect zero rows").toEqual([]);
  const deletion=await rest(request,secondaryToken,"bank_accounts","DELETE","id=eq."+bank.id);
  const deleted=await expectOk(deletion,"Cross-user delete attempt");
  expect(deleted,"Cross-user delete must affect zero rows").toEqual([]);

  // Even with a valid authenticated token, User B cannot create a row owned by User A.
  const spoof=await rest(request,secondaryToken,"bank_accounts","POST","select=id",{user_id:ownerId,account_name:marker+" spoof",account_type:"bank"});
  expect(spoof.status(),"Spoofed user_id insert must be rejected by RLS").toBe(403);

  // User B can still create and read their own data.
  const own=await rest(request,secondaryToken,"bank_accounts","POST","select=id,account_name",{user_id:secondarySession.user.id,account_name:marker+" user-b",account_type:"bank"});
  const ownRows=await expectOk(own,"User B own-row insert");
  expect(ownRows).toHaveLength(1);
  expect(ownRows[0].account_name).toBe(marker+" user-b");
  secondaryBankId=ownRows[0].id;
  const ownRead=await rest(request,secondaryToken,"bank_accounts","GET","select=id,account_name&account_name=eq."+encodeURIComponent(marker+" user-b"));
  const ownReadRows=await expectOk(ownRead,"User B own-row read");
  expect(ownReadRows).toHaveLength(1);
 }finally{
  if(ownerToken){
   for(const item of created){
    await rest(request,ownerToken,item.table,"DELETE","id=eq."+item.id).catch(()=>undefined);
   }
  }
  if(secondaryToken&&secondaryBankId){
   await rest(request,secondaryToken,"bank_accounts","DELETE","id=eq."+secondaryBankId).catch(()=>undefined);
  }
  if(secondaryUserId){
   await request.delete(supabaseUrl+"/auth/v1/admin/users/"+secondaryUserId,{
    headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey}
   }).catch(()=>undefined);
  }
 }
});
