function loginRedirectForCurrentPage() {
 const requested = location.pathname.split("/").filter(Boolean).pop() + location.search + location.hash;
 location.replace("index.html?returnTo=" + encodeURIComponent(requested));
}
const $=id=>document.getElementById(id);let user,accounts=[],latestToken="";const SUPABASE_URL="https://magxbczgrxeypryjborr.supabase.co",SUPABASE_KEY="sb_publishable_o3SjG1KCygJ99RuamTJdsQ_RIkHJ-gX";if(!window.supabase?.createClient){const el=$("signedInEmail");if(el)el.textContent="Supabase SDK failed to load. Check connection and refresh.";throw new Error("Supabase JavaScript SDK unavailable");}const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:"sb-magxbczgrxeypryjborr-auth-token",storage:window.payablesAuthStorage(),persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const esc=s=>String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=v=>"₹"+Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2});
async function forceLocalLogout(){
 window.payablesSessionPolicy.stop();
 try{const {error}=await sb.auth.signOut({scope:"local"});if(error)console.warn("Remote/local sign-out returned an error:",error.message)}catch(error){console.warn("Sign-out request failed; clearing this browser session locally:",error)}
 try{localStorage.removeItem("sb-magxbczgrxeypryjborr-auth-token");sessionStorage.removeItem("sb-magxbczgrxeypryjborr-auth-token")}catch(_){}
 location.replace("index.html");
}
async function auth(){
 const status=$("signedInEmail");
 const setStatus=(message,type="")=>{status.textContent=message;status.dataset.state=type};
 setStatus("Restoring saved session…");
 $("smsLogout").onclick=forceLocalLogout;
 const timeout=(promise,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(label+" timed out after 12 seconds")),12000))]);
 try{
  const {data,error}=await timeout(sb.auth.getSession(),"Session restoration");
  if(error)throw error;
  let session=data?.session||null;
  if(!session?.access_token){setStatus("No active session. Returning to login…","error");loginRedirectForCurrentPage();return false;}
  setStatus("Verifying signed-in user…");
  let verified;
  try{
   const result=await timeout(sb.auth.getUser(session.access_token),"User verification");
   if(result.error)throw result.error;
   verified=result.data?.user;
  }catch(firstError){
   // Refresh once when a stored access token is expired or stale.
   const refreshed=await timeout(sb.auth.refreshSession(),"Session refresh");
   if(refreshed.error||!refreshed.data?.session)throw firstError;
   session=refreshed.data.session;
   const retry=await timeout(sb.auth.getUser(session.access_token),"User verification retry");
   if(retry.error)throw retry.error;
   verified=retry.data?.user;
  }
  if(!verified)throw new Error("Supabase did not return an authenticated user.");
  user=verified;
  window.payablesSessionPolicy.start(sb,user.id);
  setStatus(user.email||"Authenticated user","success");
  sb.auth.onAuthStateChange((event,nextSession)=>{
   if(event==="SIGNED_OUT"||(nextSession?.user?.id&&nextSession.user.id!==user.id)){
    setStatus("Session ended. Returning to login…","error");
    loginRedirectForCurrentPage();
   }
  });
  return true;
 }catch(error){
  console.error("SMS Capture authentication failed",error);
  setStatus("Session verification failed: "+(error?.message||String(error))+". Use Log out, sign in again, then reopen SMS Capture.","error");
  return false;
 }
}
async function loadAccounts(){
 const status=$("accountLoadStatus");
 status.textContent="Loading Cash Book accounts…";status.className="status";
 const {data,error}=await sb.from("bank_accounts").select("id,account_name").eq("user_id",user.id).eq("is_active",true);
 if(error){status.textContent="Account loading failed: "+error.message;status.className="status error";$("mapAccount").innerHTML='<option value="">Unable to load accounts</option>';throw error}
 accounts=data||[];
 const options=accounts.map(a=>'<option value="'+a.id+'">'+esc(a.account_name)+'</option>').join("");
 const empty='<option value="">'+(accounts.length?"Select account":"No Cash Book accounts found for this login")+'</option>';
 $("mapAccount").innerHTML=empty+options;
 status.textContent=accounts.length?accounts.length+" active Cash Book account(s) loaded.":"No active Cash Book accounts found for the current login.";
 status.className=accounts.length?"status success":"status error";
}

async function loadReminderPreference(){
 const toggle=$("emailReminderEnabled"),save=$("saveEmailReminder"),status=$("emailReminderStatus");
 status.textContent="Loading reminder preference…";toggle.disabled=true;save.disabled=true;
 const {data,error}=await sb.from("sms_review_reminder_settings").select("enabled").eq("user_id",user.id).maybeSingle();
 if(error)throw error;if(!data)throw new Error("Reminder settings are not configured for this account.");
 toggle.checked=!!data.enabled;toggle.disabled=false;save.disabled=false;
 status.textContent=data.enabled?"Email reminders are enabled.":"Email reminders are disabled.";
 status.className="status "+(data.enabled?"success":"");
}
$("saveEmailReminder").onclick=async()=>{
 const toggle=$("emailReminderEnabled"),save=$("saveEmailReminder"),status=$("emailReminderStatus");
 save.disabled=true;toggle.disabled=true;status.textContent="Saving preference…";status.className="status";
 try{const {data,error}=await sb.from("sms_review_reminder_settings").update({enabled:toggle.checked,updated_at:new Date().toISOString()}).eq("user_id",user.id).select("enabled").maybeSingle();if(error)throw error;if(!data)throw new Error("No reminder setting was updated. Refresh and try again.");status.textContent=data.enabled?"Email reminders enabled. You’ll receive an email only when items need review.":"Email reminders disabled. No scheduled reminder emails will be sent.";status.className="status success";}
 catch(error){status.textContent="Could not save preference: "+(error?.message||String(error));status.className="status error";try{await loadReminderPreference()}catch(_){}}
 finally{save.disabled=false;toggle.disabled=false}
};
async function loadTokens(){
 const {data,error}=await sb.from("sms_capture_tokens").select("id,label,is_active,created_at").eq("user_id",user.id).eq("is_active",true).order("created_at",{ascending:false});
 if(error)throw error;
 $("tokens").innerHTML=(data||[]).map(t=>'<div class="item"><b>'+esc(t.label)+' · Active</b><small>Created: '+new Date(t.created_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})+'</small><button data-revoke="'+t.id+'">Revoke token</button></div>').join("")||'<p class="muted">No active capture token. Generate a new token to connect your automation.</p>';
 document.querySelectorAll("[data-revoke]").forEach(button=>button.onclick=async()=>{
  if(!confirm("Revoke this capture token?"))return;
  button.disabled=true;button.textContent="Revoking…";
  try{
   const {data:revoked,error:revokeError}=await sb.from("sms_capture_tokens").update({is_active:false}).eq("id",button.dataset.revoke).eq("user_id",user.id).eq("is_active",true).select("id,is_active").maybeSingle();
   if(revokeError)throw revokeError;
   if(!revoked||revoked.is_active!==false)throw new Error("No active token was changed. Refresh the token list and try again.");
   const status=$("tokenStatus");
   try{await loadTokens();status.textContent="Token revoked successfully.";status.className="status success"}
   catch(refreshError){status.textContent="Token was revoked, but the token list could not refresh: "+(refreshError?.message||String(refreshError));status.className="status error"}
  }catch(e){button.disabled=false;button.textContent="Revoke token";alert("Token revocation failed: "+(e?.message||String(e)))}
 });
}
async function loadMappings(){
 const {data,error}=await sb.from("sms_capture_account_rules").select("id,account_identifier,account_id,sender").eq("user_id",user.id).order("created_at");
 if(error)throw error;
 const rules=data||[];
 const identifierRules=rules.filter(r=>r.account_identifier);
 $("mappings").innerHTML=identifierRules.map(r=>'<div class="item"><b>'+esc(r.account_identifier)+'</b><span>'+esc(accounts.find(a=>a.id===r.account_id)?.account_name||"⚠ Linked account not found")+'</span><button data-delmap="'+r.id+'">Remove</button></div>').join("")||'<p class="muted">No identifier rules configured.</p>';
 document.querySelectorAll("[data-delmap]").forEach(b=>b.onclick=async()=>{
  if(!confirm("Remove this mapping?"))return;
  const r=await sb.from("sms_capture_account_rules").delete().eq("id",b.dataset.delmap).eq("user_id",user.id);
  if(r.error)alert("Mapping removal failed: "+r.error.message);else await loadMappings()
 });
}

function cleanParticular(description,direction,accountIdentifier){const raw=String(description||"").replace(/\s+/g," ").trim();if(!raw)return direction==="in"?"Bank Credit":"Bank Debit";const merchantMatch=raw.match(/(?:at|to|towards|for)\s+([A-Za-z0-9 &.'*-]{2,50}?)(?=\s+(?:on|dated|ref(?:erence)?|upi|txn|transaction|\*|\d{2}[/-])|[.,;]|$)/i);if(merchantMatch){const merchant=merchantMatch[1].trim().replace(/\s+/g," ");if(merchant&&!/^(your account|account|a\/c|the account)$/i.test(merchant))return merchant;}const looksLikeFullBankAlert=/^(dear customer[, ]*)?(your )?(account|a\/c)\s*[*x\d-]+/i.test(raw)&&/\b(credited|debited|credit|debit)\b/i.test(raw);if(looksLikeFullBankAlert||raw.length>65)return direction==="in"?"Bank Credit":"Bank Debit";return raw;}
function reportActionError(action,error){alert(action+" could not be fully confirmed: "+(error?.message||String(error))+". Refresh the inbox and check Cash Book before retrying.")}
$("clearReviewInbox").onclick=clearReviewInbox;
async function loadInbox(){
 const [pending,locked,duplicates,rejected]=await Promise.all([
  sb.from("sms_capture_inbox").select("*").eq("user_id",user.id).eq("status","needs_review").order("received_at",{ascending:false}).limit(100),
  sb.from("sms_capture_inbox").select("*").eq("user_id",user.id).eq("status","posted").is("movement_id",null).order("received_at",{ascending:false}).limit(100),
  sb.from("sms_capture_inbox").select("*").eq("user_id",user.id).eq("status","duplicate").order("received_at",{ascending:false}).limit(100),
  sb.from("sms_capture_inbox").select("*").eq("user_id",user.id).eq("status","ignored").eq("review_decision","rejected").order("reviewed_at",{ascending:false}).limit(100)
 ]);
 for(const result of [pending,locked,duplicates,rejected])if(result.error)throw result.error;
 const data=[...(pending.data||[]),...(locked.data||[]),...(duplicates.data||[]),...(rejected.data||[])].sort((x,y)=>Date.parse(y.received_at||y.reviewed_at||0)-Date.parse(x.received_at||x.reviewed_at||0)).slice(0,100);
 await reconcileInboxCashBookDuplicates(data);
 const counts={pending:data.filter(r=>r.status==="needs_review").length,duplicates:data.filter(r=>r.status==="duplicate").length,rejected:data.filter(r=>r.status==="ignored"&&r.review_decision==="rejected").length,locked:data.filter(r=>r.status==="posted"&&!r.movement_id).length};
 const summary=$("inboxSummary");
 if(summary)summary.innerHTML='<span class="review-count">Needs review: <b>'+counts.pending+'</b></span><span class="review-count">Duplicates: <b>'+counts.duplicates+'</b></span><span class="review-count">Rejected: <b>'+counts.rejected+'</b></span><span class="review-count">Uncertain: <b>'+counts.locked+'</b></span>';
 const reviewHtml=data.map(r=>{
  const isLocked=r.status==="posted",isDuplicate=r.status==="duplicate",isRejected=r.status==="ignored"&&r.review_decision==="rejected";
  const badge=isDuplicate?"Duplicate":isRejected?"Rejected":isLocked?"Posting uncertain":"Needs review";
  const received=r.received_at?new Date(r.received_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}):"Unknown";
  const original=r.raw_message?'<details><summary>Original SMS</summary><p class="sms-raw">'+esc(r.raw_message)+'</p></details>':"";
  const account=accounts.find(a=>a.id===r.account_id)?.account_name||"Not linked";
  const controls=isRejected?'<small>This message was rejected and retained for audit.</small>':isLocked?'<p class="warn">Posting outcome is uncertain. Check Cash Book before any recovery; do not retry.</p>':isDuplicate?'<p class="warn"><b>Duplicate detected.</b> Accepting acknowledges it without creating another Cash Book entry.</p>':'<label>Post to account<select data-inbox-account="'+r.id+'"><option value="">Select account</option>'+accounts.map(a=>'<option value="'+a.id+'" '+(a.id===r.account_id?"selected":"")+'>'+esc(a.account_name)+'</option>').join("")+'</select></label>';
  const referenceField="";
  const actions=isRejected?'<button data-restore="'+r.id+'">Move back to review</button>':isLocked?'':('<button data-approve="'+r.id+'">'+(isDuplicate?"Acknowledge duplicate":"Approve & post")+'</button><button data-reject="'+r.id+'">Reject</button>');
  return '<article class="item"><div class="review-card-head"><b>'+esc(r.parsed_description||"SMS transaction")+'</b><span class="review-badge '+(isDuplicate?"duplicate":isRejected?"rejected":isLocked?"uncertain":"pending")+'">'+badge+'</span></div><span><b>'+fmt(r.parsed_amount)+'</b> · '+esc(r.parsed_direction||"Unknown")+' · Transaction date: '+esc(r.parsed_date||"Unknown")+'</span><span>Account identifier: '+esc(r.account_identifier||"Not detected")+' · Linked account: '+esc(account)+'</span><span>Reference: '+esc(r.reference_number||"Not detected")+' · Sender: '+esc(r.sms_sender||"Unknown")+'</span><small>Received: '+esc(received)+'</small>'+controls+referenceField+'<small>'+esc(r.parse_reason||"No additional review notes")+'</small>'+original+'<div class="row">'+actions+'</div></article>';
 }).join("");
 $("inbox").innerHTML=reviewHtml||'<p class="muted">No messages found in Needs review, Duplicates, Rejected or Uncertain.</p>';
 document.querySelectorAll("[data-approve]").forEach(b=>b.onclick=()=>{b.disabled=true;approve(b.dataset.approve).catch(e=>reportActionError("Approval",e)).finally(()=>{b.disabled=false})});
 document.querySelectorAll("[data-reject]").forEach(b=>b.onclick=()=>{b.disabled=true;reject(b.dataset.reject).catch(e=>reportActionError("Rejection",e)).finally(()=>{b.disabled=false})});
 document.querySelectorAll("[data-restore]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{const result=await sb.from("sms_capture_inbox").update({status:"needs_review",review_decision:null,reviewed_at:null,parse_reason:"Returned to review by user"}).eq("id",b.dataset.restore).eq("user_id",user.id).eq("status","ignored").eq("review_decision","rejected").select("id").maybeSingle();if(result.error)throw result.error;if(!result.data)throw new Error("Record was not updated; refresh and retry.");await loadInbox()}catch(error){alert("Could not return message to review: "+(error?.message||String(error)))}finally{b.disabled=false}});
}
async function reconcileInboxCashBookDuplicates(rows){
 const candidates=(rows||[]).filter(r=>r.status==="needs_review"&&r.parsed_amount&&r.parsed_direction&&r.parsed_date);
 if(!candidates.length)return;
 const dates=[...new Set(candidates.map(r=>r.parsed_date))],directions=[...new Set(candidates.map(r=>r.parsed_direction))],amounts=[...new Set(candidates.map(r=>Number(r.parsed_amount)))];
 const {data:movements,error}=await sb.from("cash_movements").select("id,account_id,movement_date,direction,amount,sms_reference_number,reference_note").eq("user_id",user.id).in("movement_date",dates).in("direction",directions).in("amount",amounts).limit(1000);
 if(error)throw new Error("Cash Book duplicate reconciliation failed: "+error.message);
 for(const row of candidates){
  const exactRef=row.reference_number?(movements||[]).filter(m=>m.sms_reference_number===row.reference_number||String(m.reference_note||"").includes("Ref "+row.reference_number+" ·")):[];
  const composite=!row.reference_number&&row.account_id?(movements||[]).filter(m=>m.account_id===row.account_id&&m.movement_date===row.parsed_date&&m.direction===row.parsed_direction&&Number(m.amount)===Number(row.parsed_amount)):[];
  const matches=exactRef.length?exactRef:composite,unique=[...new Map(matches.map(m=>[m.id,m])).values()];
  if(unique.length!==1)continue;
  const movement=unique[0],patch={status:"duplicate",movement_id:movement.id,review_decision:null,parse_reason:"Matching Cash Book entry already exists; this SMS was classified as a duplicate. No second movement was created."};
  let update=sb.from("sms_capture_inbox").update(patch).eq("id",row.id).eq("user_id",user.id);
  if(row.status==="needs_review")update=update.eq("status","needs_review");else update=update.eq("status","ignored").eq("review_decision","rejected");
  const result=await update.select("id").maybeSingle();
  if(result.error)throw new Error("Could not mark matching SMS as duplicate: "+result.error.message);
  if(result.data){row.status="duplicate";row.movement_id=movement.id;row.review_decision=null;row.parse_reason=patch.parse_reason}
 }
}
async function clearReviewInbox(){
 if(!confirm("Clear all records currently shown in the SMS review inbox? This closes review records only. Existing Cash Book transactions will NOT be deleted."))return;
 const button=$("clearReviewInbox"),status=$("clearInboxStatus");
 button.disabled=true;status.textContent="Finding review records…";status.className="status";
 try{
  const [openItems,rejectedItems,uncertainItems]=await Promise.all([
   sb.from("sms_capture_inbox").select("id").eq("user_id",user.id).in("status",["needs_review","duplicate"]),
   sb.from("sms_capture_inbox").select("id").eq("user_id",user.id).eq("status","ignored").eq("review_decision","rejected"),
   sb.from("sms_capture_inbox").select("id").eq("user_id",user.id).eq("status","posted").is("movement_id",null)
  ]);
  for(const result of [openItems,rejectedItems,uncertainItems])if(result.error)throw result.error;
  const ids=[...new Set([...(openItems.data||[]),...(rejectedItems.data||[]),...(uncertainItems.data||[])].map(r=>r.id))];
  if(!ids.length){await loadInbox();status.textContent="No uncleared review records were found. Existing Cash Book entries were not changed.";status.className="status";return}
  status.textContent="Closing "+ids.length+" review record(s)…";
  const patch={status:"ignored",review_decision:"cleared",parse_reason:"Cleared from SMS review inbox by user",reviewed_at:new Date().toISOString()};
  const updated=await sb.from("sms_capture_inbox").update(patch).eq("user_id",user.id).in("id",ids).select("id");
  if(updated.error)throw updated.error;
  const changed=updated.data||[];
  if(changed.length!==ids.length)throw new Error("Only "+changed.length+" of "+ids.length+" records were updated. Refresh the page and retry; no Cash Book entries were deleted.");
  await loadInbox();
  const [stillRejected,stillOpen,stillUncertain]=await Promise.all([
   sb.from("sms_capture_inbox").select("id").eq("user_id",user.id).eq("status","ignored").eq("review_decision","rejected").in("id",ids),
   sb.from("sms_capture_inbox").select("id").eq("user_id",user.id).in("status",["needs_review","duplicate"]).in("id",ids),
   sb.from("sms_capture_inbox").select("id").eq("user_id",user.id).eq("status","posted").is("movement_id",null).in("id",ids)
  ]);
  for(const result of [stillRejected,stillOpen,stillUncertain])if(result.error)throw result.error;
  const remaining=(stillRejected.data?.length||0)+(stillOpen.data?.length||0)+(stillUncertain.data?.length||0);
  if(remaining)throw new Error(remaining+" records are still in the active review queue after refresh.");
  status.textContent=changed.length+" review record(s) cleared and verified, including rejected items. Audit records were retained; Cash Book entries were not changed.";
  status.className="status success";
 }catch(error){status.textContent="Could not clear review records: "+(error?.message||String(error));status.className="status error"}
 finally{button.disabled=false}
}
function escapeLikePattern(value){return String(value??"").replace(/[\\%_]/g,"\\$&")}
async function findCashMovementDuplicate(referenceNumber){const safeReference=escapeLikePattern(referenceNumber);const [bySmsReference,byReferenceNote]=await Promise.all([sb.from("cash_movements").select("id").eq("user_id",user.id).eq("sms_reference_number",referenceNumber).limit(1),sb.from("cash_movements").select("id").eq("user_id",user.id).ilike("reference_note","%Ref "+safeReference+" ·%").limit(1)]);if(bySmsReference.error)return {data:null,error:bySmsReference.error};if(byReferenceNote.error)return {data:null,error:byReferenceNote.error};return {data:(bySmsReference.data?.length?bySmsReference.data:(byReferenceNote.data||[])),error:null}}
async function restoreClaim(id,reason){const r=await sb.from("sms_capture_inbox").update({status:"needs_review",parse_reason:reason}).eq("id",id).eq("user_id",user.id).eq("status","posted").select("id").maybeSingle();if(!r.error&&!r.data)r.error={message:"No claimed inbox row was restored; it may remain locked."};try{await loadInbox()}catch(e){console.error("SMS Capture inbox refresh after restore",e);r.refreshError=e}return r}
async function approve(id){
 let {data:r,error}=await sb.from("sms_capture_inbox").select("*").eq("id",id).eq("user_id",user.id).single();if(error)return alert(error.message);
 if(r.status==="duplicate"){const decision=await sb.from("sms_capture_inbox").update({status:"ignored",review_decision:"accepted_duplicate",parse_reason:"Duplicate reviewed and accepted. Original transaction retained; no second Cash Book entry created.",reviewed_at:new Date().toISOString()}).eq("id",id).eq("user_id",user.id).eq("status","duplicate").select("id").maybeSingle();if(decision.error)return alert("Duplicate review failed: "+decision.error.message);if(!decision.data)return alert("This duplicate has already been reviewed.");await loadInbox();return}if(r.status!=="needs_review")return alert("This SMS is already posted, ignored, or being processed.");
 let referenceNumber=String(r.reference_number||"").trim()||null;
 const referenceWasExtracted=Boolean(referenceNumber);
 const makeGeneratedReference=()=> "SMS-"+new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()).replace(/-/g,"")+"-"+crypto.randomUUID().replace(/-/g,"").slice(0,16).toUpperCase();
 const referenceExists=async value=>{const {data,error}=await sb.from("cash_movements").select("id").eq("user_id",user.id).eq("sms_reference_number",value).limit(1);if(error)throw new Error("Reference uniqueness check failed: "+error.message);return Boolean(data?.length)};
 if(!r.parsed_amount||Number(r.parsed_amount)<=0||!["in","out"].includes(r.parsed_direction))return alert("Amount or debit/credit direction is missing. Reject or re-forward the SMS.");
 if(referenceNumber){let {data:dup,error:dupErr}=await sb.from("sms_capture_inbox").select("id,status,movement_id").eq("user_id",user.id).eq("reference_number",referenceNumber).neq("id",id).in("status",["needs_review","posted"]).limit(1);if(dupErr)return alert("Inbox duplicate check failed: "+dupErr.message);if(dup?.length)return alert("This reference number already exists. Cannot post duplicate.");const {data:movementDup,error:movementDupErr}=await findCashMovementDuplicate(referenceNumber);if(movementDupErr)return alert("Cash Book duplicate check failed: "+movementDupErr.message);if(movementDup?.length)return alert("This reference number is already recorded in Cash Book. Cannot post duplicate.");}
 const selectEl=Array.from($("inbox").querySelectorAll("[data-inbox-account]")).find(el=>el.dataset.inboxAccount===id);
 const accountId=selectEl?.value||r.account_id;if(!accountId)return alert("Select a Cash Book account to approve this transaction.");
 const claim=await sb.from("sms_capture_inbox").update({status:"posted",parse_reason:"Manual approval in progress"}).eq("id",id).eq("user_id",user.id).eq("status","needs_review").select("id").single();if(claim.error)return alert("This item is already being processed or is no longer awaiting review.");
 if(referenceNumber){const {data:claimDup,error:claimDupErr}=await sb.from("sms_capture_inbox").select("id,status").eq("user_id",user.id).eq("reference_number",referenceNumber).neq("id",id).in("status",["needs_review","posted"]).limit(1);if(claimDupErr){const restore=await restoreClaim(id,"Duplicate-check failed after claim; no movement posted.");return alert("Duplicate-check failed after claim. No movement was created. "+(restore.error?"Inbox status could not be restored: "+restore.error.message:claimDupErr.message))}if(claimDup?.length){const restore=await restoreClaim(id,"Duplicate reference detected during approval; no movement posted.");return alert("Another SMS with this reference is present. No movement was posted; reject the duplicate inbox item."+(restore.error?" Status restoration failed: "+restore.error.message:""))}const {data:movementDupAfterClaim,error:movementDupAfterClaimErr}=await findCashMovementDuplicate(referenceNumber);if(movementDupAfterClaimErr){const restore=await restoreClaim(id,"Cash Book duplicate-check failed after claim; no movement posted.");return alert("Cash Book duplicate-check failed after claim. No movement was created. "+(restore.error?"Inbox status could not be restored: "+restore.error.message:movementDupAfterClaimErr.message))}if(movementDupAfterClaim?.length){const restore=await restoreClaim(id,"Cash Book reference duplicate detected after claim; no movement posted.");return alert("This reference number appeared in Cash Book during approval. No movement was posted."+(restore.error?" Inbox status restoration failed: "+restore.error.message:""))}}
 let ins,referenceAttempts=0;
 while(referenceAttempts<6){
  if(!referenceNumber)referenceNumber=makeGeneratedReference();
  if(await referenceExists(referenceNumber)){
   if(referenceWasExtracted)return alert("This bank reference number is already recorded in Cash Book. Duplicate posting was blocked.");
   referenceNumber=null;referenceAttempts++;continue;
  }
  ins=await sb.from("cash_movements").insert({user_id:user.id,account_id:accountId,movement_date:r.parsed_date||new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),direction:r.parsed_direction,amount:r.parsed_amount,movement_type:"sms_auto",sms_reference_number:referenceNumber,description:cleanParticular(r.parsed_description,r.parsed_direction,r.account_identifier),reference_note:"SMS manual approval · Ref "+referenceNumber+" · "+(r.account_identifier||"")}).select("id").single();
  if(!ins.error)break;
  if(ins.error.code==="23505"&&!referenceWasExtracted){referenceNumber=null;referenceAttempts++;continue;}
  break;
 }
 if(!ins||ins.error&&ins.error.code==="23505"&&!referenceWasExtracted)return alert("Could not reserve a unique generated reference after several attempts. No Cash Book entry was created; please retry.");

 if(ins.error){if(ins.error.code==="23505"&&referenceWasExtracted){const {data:confirmedDuplicate,error:confirmDuplicateError}=await findCashMovementDuplicate(referenceNumber);if(!confirmDuplicateError&&confirmedDuplicate?.length){const marked=await sb.from("sms_capture_inbox").update({status:"duplicate",parse_reason:"This SMS reference is already recorded in Cash Book; no second movement was created."}).eq("id",id).eq("user_id",user.id).eq("status","posted").select("id").maybeSingle();let refreshWarning="";try{await loadInbox()}catch(refreshError){refreshWarning=" Inbox refresh failed: "+(refreshError?.message||String(refreshError))+"."}return alert("Duplicate blocked: this reference number is already recorded in Cash Book."+(marked.error||!marked.data?" Inbox status could not be updated; do not retry until checked.":"")+refreshWarning)}const lock=await sb.from("sms_capture_inbox").update({parse_reason:"Cash Book insert returned a uniqueness error, but the matching reference could not be confirmed. Outcome is unconfirmed; check Cash Book before retrying."}).eq("id",id).eq("user_id",user.id).eq("status","posted").select("id").maybeSingle();let refreshWarning="";try{await loadInbox()}catch(refreshError){refreshWarning=" Inbox refresh failed: "+(refreshError?.message||String(refreshError))+"."}return alert("Cash Book insert returned a uniqueness error, but no matching reference could be confirmed. The item remains locked; check Cash Book before retrying."+(confirmDuplicateError?" Duplicate confirmation failed: "+(confirmDuplicateError.message||String(confirmDuplicateError))+".":"")+(lock.error||!lock.data?" Inbox lock could not be confirmed; do not retry until Cash Book and inbox are checked.":"")+refreshWarning)}const insertFailure=ins.error.message||String(ins.error);const lock=await sb.from("sms_capture_inbox").update({parse_reason:"Cash Book insert returned an error; outcome is unconfirmed. Check Cash Book before retrying."}).eq("id",id).eq("user_id",user.id).eq("status","posted").select("id").maybeSingle();let refreshWarning="";try{await loadInbox()}catch(refreshError){refreshWarning=" Inbox refresh failed: "+(refreshError?.message||String(refreshError))+"."}return alert("Cash Book insert returned an error: "+insertFailure+". The inbox item remains locked because the write outcome cannot be safely assumed. Check Cash Book before retrying."+(lock.error||!lock.data?" The lock could not be confirmed; do not retry until Cash Book and inbox are checked.":"")+refreshWarning);}
 const upd=await sb.from("sms_capture_inbox").update({movement_id:ins.data.id,reference_number:referenceNumber,parse_reason:"Accepted and posted to Cash Book",review_decision:"accepted",reviewed_at:new Date().toISOString()}).eq("id",id).eq("user_id",user.id).eq("status","posted").select("id").maybeSingle();
 if(upd.error||!upd.data){const updateFailure=upd.error?.message||"The claimed inbox row was not updated.";const rollback=await sb.from("cash_movements").delete().eq("id",ins.data.id).eq("user_id",user.id).select("id").maybeSingle();if(rollback.error||!rollback.data){const lock=await sb.from("sms_capture_inbox").update({parse_reason:"Movement may exist; rollback failed. Item remains locked to prevent repeat posting. Check Cash Book before taking action."}).eq("id",id).eq("user_id",user.id).eq("status","posted");return alert("Inbox update failed ("+updateFailure+") and movement rollback could not be confirmed. The item remains locked to avoid a duplicate. Check Cash Book before taking action."+(lock.error?" Inbox warning could not be saved: "+lock.error.message:""));}const restored=await sb.from("sms_capture_inbox").update({status:"needs_review",parse_reason:"Inbox update failed; movement was rolled back."}).eq("id",id).eq("user_id",user.id).eq("status","posted").select("id").maybeSingle();return alert("Inbox update failed ("+updateFailure+"). The inserted movement was rolled back."+(restored.error||!restored.data?" Inbox status could not be restored; refresh or contact an administrator.":""));}
 await loadInbox();
}
async function reject(id){const current=await sb.from("sms_capture_inbox").select("id,status,movement_id").eq("id",id).eq("user_id",user.id).maybeSingle();if(current.error){alert("Unable to check this SMS status: "+current.error.message);return}if(!current.data){alert("SMS record not found. Refresh the inbox.");await loadInbox();return}if(current.data.status==="posted"){alert("This SMS is locked because its Cash Book posting outcome must be verified first. Check the Cash Book for the matching amount and date. Do not reject or retry it until confirmed.");await loadInbox();return}if(!["needs_review","duplicate"].includes(current.data.status)){alert("This SMS has already been reviewed. Refreshing the inbox.");await loadInbox();return}const r=await sb.from("sms_capture_inbox").update({status:"ignored",review_decision:"rejected",parse_reason:"Rejected by user",reviewed_at:new Date().toISOString()}).eq("id",id).eq("user_id",user.id).in("status",["needs_review","duplicate"]).select("id").maybeSingle();if(r.error){alert("Reject failed: "+r.error.message);return}if(!r.data){alert("This SMS changed status before rejection. Refreshing the inbox.");await loadInbox();return}await loadInbox()}
$("generateToken").onclick=async()=>{const btn=$("generateToken"),status=$("tokenStatus");btn.disabled=true;btn.textContent="Generating…";status.textContent="Checking session…";status.className="status";try{const {data,error}=await sb.auth.getSession();if(error)throw new Error("Session lookup failed: "+error.message);const session=data.session;if(!session?.access_token)throw new Error("No active login session. Sign out and log in again.");status.textContent="Registering token with server…";latestToken="pt_sms_"+Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,"0")).join("");const response=await fetch("https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/register",{method:"POST",headers:{apikey:"sb_publishable_o3SjG1KCygJ99RuamTJdsQ_RIkHJ-gX",Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({token:latestToken,label:"iPhone Shortcut"})});const raw=await response.text();let result;try{result=JSON.parse(raw)}catch{result={error:raw||"Empty server response"}}if(!response.ok||!result.ok)throw new Error("HTTP "+response.status+": "+(result.error||raw||"Registration rejected"));$("tokenValue").value=latestToken;$("tokenBox").hidden=false;status.textContent="Token generated successfully. Copy it now—the plaintext is shown only once.";status.className="status success";try{await loadTokens()}catch(refreshError){status.textContent="Token was generated successfully, and is displayed below. Token list refresh failed: "+(refreshError?.message||String(refreshError));status.className="status success"}}catch(e){latestToken="";$("tokenBox").hidden=true;status.textContent="Token generation failed: "+(e?.message||String(e));status.className="status error";console.error("SMS Capture token registration",e)}finally{btn.disabled=false;btn.textContent="Generate new token"}}
$("copyToken").onclick=async()=>{await navigator.clipboard.writeText($("tokenValue").value);alert("Copied token. Store it safely.")};
$("mappingForm").onsubmit=async e=>{e.preventDefault();const identifier=($("identifier").value.trim().match(/\d+/g)||[]).join(""),account_id=$("mapAccount").value;if(!identifier||!account_id)return;const ruleSender="__account__:"+identifier;const r=await sb.from("sms_capture_account_rules").upsert({user_id:user.id,sender:ruleSender,account_identifier:identifier,account_id},{onConflict:"user_id,sender"});if(r.error)alert("Identifier mapping save failed: "+r.error.message);else{$("identifier").value="";await loadMappings()}};
(async()=>{
 const inbox=$("inbox");if(inbox)inbox.textContent="Checking your session…";
 if(!await auth())return;
 const acct=await Promise.allSettled([loadAccounts()]);
 if(acct[0].status==="rejected")console.error("SMS Capture accounts load",acct[0].reason);
 const tasks=await Promise.allSettled([loadTokens(),loadMappings(),loadInbox(),loadReminderPreference()]);
 if(tasks[0].status==="rejected")$("tokenStatus").textContent="Token list failed to load: "+(tasks[0].reason?.message||String(tasks[0].reason));
 if(tasks[1].status==="rejected")$("mappings").innerHTML='<p class="warn">Mapping list failed to load: '+esc(tasks[1].reason?.message||String(tasks[1].reason))+'</p>';
 if(tasks[3].status==="rejected")$("emailReminderStatus").textContent="Reminder preference failed to load: "+(tasks[3].reason?.message||String(tasks[3].reason));
 if(tasks[2].status==="rejected")$("inbox").innerHTML='<p class="warn">Review inbox failed to load: '+esc(tasks[2].reason?.message||String(tasks[2].reason))+'</p>';
})().catch(e=>{console.error("SMS Capture initialization",e);const status=$("signedInEmail");if(status)status.textContent="Page initialization failed: "+(e?.message||String(e));});


// Android companion uses its own revocable capture token; it never receives a Supabase user session.
$("generateAndroidToken").onclick=async()=>{
 const btn=$("generateAndroidToken"),status=$("androidTokenStatus");
 btn.disabled=true;btn.textContent="Generating…";status.textContent="Checking signed-in session…";status.className="status";
 try{
  const {data,error}=await sb.auth.getSession();
  if(error)throw new Error("Session lookup failed: "+error.message);
  const session=data.session;
  if(!session?.access_token)throw new Error("Please sign in again before generating a device token.");
  const token="pt_sms_"+Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,"0")).join("");
  const response=await fetch(SUPABASE_URL+"/functions/v1/sms-capture/register",{
   method:"POST",
   headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
   body:JSON.stringify({token,label:"Android Companion"})
  });
  const raw=await response.text();let result;
  try{result=JSON.parse(raw)}catch{result={error:raw||"Empty server response"}}
  if(!response.ok||!result.ok)throw new Error("HTTP "+response.status+": "+(result.error||raw||"Registration rejected"));
  $("tokenValue").value=token;$("tokenBox").hidden=false;
  status.textContent="Android token created. Copy it now and paste it into the Android companion. It cannot be recovered later.";
  status.className="status success";
  try{await loadTokens()}catch(refreshError){status.textContent="Android token was created and is shown below. Token list refresh failed: "+(refreshError?.message||String(refreshError));status.className="status success"}
 }catch(error){
  status.textContent="Android token generation failed: "+(error?.message||String(error));
  status.className="status error";
 }finally{btn.disabled=false;btn.textContent="Generate Android token"}
};
