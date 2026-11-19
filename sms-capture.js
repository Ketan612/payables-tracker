const sb=supabase.createClient("https://magxbczgrxeypryjborr.supabase.co","sb_publishable_o3SjG1KCygJ99RuamTJdsQ_RIkHJ-gX");const $=id=>document.getElementById(id);let user,accounts=[],latestToken="";
const esc=s=>String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=v=>"₹"+Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2});
async function forceLocalLogout(){
 try{const {error}=await sb.auth.signOut({scope:"local"});if(error)console.warn("Remote/local sign-out returned an error:",error.message)}catch(error){console.warn("Sign-out request failed; clearing this browser session locally:",error)}
 try{localStorage.removeItem("sb-magxbczgrxeypryjborr-auth-token")}catch(_){}
 location.replace("index.html");
}
async function auth(){
 const {data:{session},error:sessionError}=await sb.auth.getSession();
 if(sessionError||!session?.access_token){location.replace("index.html");return false}
 const {data:{user:verifiedUser},error:userError}=await sb.auth.getUser(session.access_token);
 if(userError||!verifiedUser){await sb.auth.signOut();location.replace("index.html");return false}
 user=verifiedUser;
 $("signedInEmail").textContent=user.email||"Authenticated user";
 $("smsLogout").onclick=forceLocalLogout;
 sb.auth.onAuthStateChange((event,nextSession)=>{
  if(event==="SIGNED_OUT"||!nextSession)location.replace("index.html");else if(nextSession.user?.id!==user.id)location.replace("index.html");
 });
 return true;
}
async function loadAccounts(){
 const status=$("accountLoadStatus");
 status.textContent="Loading Cash Book accounts…";status.className="status";
 const {data,error}=await sb.from("bank_accounts").select("id,account_name").eq("user_id",user.id).eq("is_active",true);
 if(error){status.textContent="Account loading failed: "+error.message;status.className="status error";$("mapAccount").innerHTML='<option value="">Unable to load accounts</option>';$("senderAccount").innerHTML='<option value="">Unable to load accounts</option>';throw error}
 accounts=data||[];
 const options=accounts.map(a=>'<option value="'+a.id+'">'+esc(a.account_name)+'</option>').join("");
 const empty='<option value="">'+(accounts.length?"Select account":"No Cash Book accounts found for this login")+'</option>';
 $("mapAccount").innerHTML=empty+options;$("senderAccount").innerHTML=empty+options;
 status.textContent=accounts.length?accounts.length+" Cash Book account(s) loaded.":"No Cash Book accounts found for the current login.";
 status.className=accounts.length?"status success":"status error";
}

async function loadTokens(){
 const {data,error}=await sb.from("sms_capture_tokens").select("id,label,is_active,created_at").eq("user_id",user.id).order("created_at",{ascending:false});
 if(error)throw error;
 $("tokens").innerHTML=(data||[]).map(t=>'<div class="item"><b>'+esc(t.label)+' · '+(t.is_active?"Active":"Revoked")+'</b><small>'+new Date(t.created_at).toLocaleString()+'</small>'+(t.is_active?'<button data-revoke="'+t.id+'">Revoke token</button>':'')+'</div>').join("")||'<p class="muted">No tokens yet.</p>';
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
 const senderRules=rules.filter(r=>!r.account_identifier&&r.sender&&!r.sender.startsWith("__account__:"));
 $("mappings").innerHTML=identifierRules.map(r=>'<div class="item"><b>'+esc(r.account_identifier)+'</b><span>'+esc(accounts.find(a=>a.id===r.account_id)?.account_name||"⚠ Linked account not found")+'</span><button data-delmap="'+r.id+'">Remove</button></div>').join("")||'<p class="muted">No identifier rules configured.</p>';
 $("senderMappings").innerHTML=senderRules.map(r=>'<div class="item"><b>'+esc(r.sender)+'</b><span>Default account: '+esc(accounts.find(a=>a.id===r.account_id)?.account_name||"⚠ Linked account not found")+'</span><button data-delmap="'+r.id+'">Remove</button></div>').join("")||'<p class="muted">No sender defaults configured.</p>';
 document.querySelectorAll("[data-delmap]").forEach(b=>b.onclick=async()=>{
  if(!confirm("Remove this mapping?"))return;
  const r=await sb.from("sms_capture_account_rules").delete().eq("id",b.dataset.delmap).eq("user_id",user.id);
  if(r.error)alert("Mapping removal failed: "+r.error.message);else await loadMappings()
 });
}

function reportActionError(action,error){alert(action+" could not be fully confirmed: "+(error?.message||String(error))+". Refresh the inbox and check Cash Book before retrying.")}
async function loadInbox(){
 const [pending,locked,duplicates]=await Promise.all([
  sb.from("sms_capture_inbox").select("*").eq("user_id",user.id).eq("status","needs_review").order("received_at",{ascending:false}).limit(50),
  sb.from("sms_capture_inbox").select("*").eq("user_id",user.id).eq("status","posted").is("movement_id",null).order("received_at",{ascending:false}).limit(50),
  sb.from("sms_capture_inbox").select("*").eq("user_id",user.id).eq("status","duplicate").order("received_at",{ascending:false}).limit(50)
 ]);
 if(pending.error)throw pending.error;if(locked.error)throw locked.error;if(duplicates.error)throw duplicates.error;
 const data=[...(pending.data||[]),...(locked.data||[]),...(duplicates.data||[])].sort((x,y)=>Date.parse(y.received_at||0)-Date.parse(x.received_at||0)).slice(0,50);
 const reviewHtml=data.map(r=>{
  const isLocked=r.status==="posted",isDuplicate=r.status==="duplicate";
  return '<article class="item"><b>'+esc(r.parsed_description||"SMS transaction")+'</b><span>'+esc(r.parsed_date||"Date unknown")+' · '+esc(r.parsed_direction||"Unknown")+' · '+fmt(r.parsed_amount)+'</span><span>Identifier: '+esc(r.account_identifier||"not detected")+' | Ref: '+esc(r.reference_number||"none")+'</span>'+(isDuplicate?'<p class="warn"><b>Duplicate blocked.</b> This SMS/reference has already been captured. No second Cash Book entry was created.</p>':isLocked?'<p class="warn">Posting is locked or its outcome is uncertain. Check Cash Book before any manual recovery; do not retry.</p>':'<label>Post to account<select data-inbox-account="'+r.id+'">'+accounts.map(a=>'<option value="'+a.id+'" '+(a.id===r.account_id?"selected":"")+'>'+esc(a.account_name)+'</option>').join("")+'</select></label>')+'<small>'+esc(r.parse_reason||"Please review")+'</small><div class="row">'+(isDuplicate?'': '<button data-approve="'+r.id+'" '+(isLocked?"disabled":"")+'>Approve & post</button><button data-reject="'+r.id+'" '+(isLocked?"disabled":"")+'>'+ 'Reject</button>')+'</div></article>';
 }).join("");
 $("inbox").innerHTML=reviewHtml||'<p class="muted">Review inbox is clear.</p>';
 document.querySelectorAll("[data-approve]").forEach(b=>b.onclick=()=>{b.disabled=true;approve(b.dataset.approve).catch(e=>reportActionError("Approval",e)).finally(()=>{b.disabled=false})});
 document.querySelectorAll("[data-reject]").forEach(b=>b.onclick=()=>{b.disabled=true;reject(b.dataset.reject).catch(e=>reportActionError("Rejection",e)).finally(()=>{b.disabled=false})});
}
function escapeLikePattern(value){return String(value??"").replace(/[\\%_]/g,"\\$&")}
async function findCashMovementDuplicate(referenceNumber){const safeReference=escapeLikePattern(referenceNumber);const [bySmsReference,byReferenceNote]=await Promise.all([sb.from("cash_movements").select("id").eq("user_id",user.id).eq("sms_reference_number",referenceNumber).limit(1),sb.from("cash_movements").select("id").eq("user_id",user.id).ilike("reference_note","%Ref "+safeReference+" ·%").limit(1)]);if(bySmsReference.error)return {data:null,error:bySmsReference.error};if(byReferenceNote.error)return {data:null,error:byReferenceNote.error};return {data:(bySmsReference.data?.length?bySmsReference.data:(byReferenceNote.data||[])),error:null}}
async function restoreClaim(id,reason){const r=await sb.from("sms_capture_inbox").update({status:"needs_review",parse_reason:reason}).eq("id",id).eq("user_id",user.id).eq("status","posted").select("id").maybeSingle();if(!r.error&&!r.data)r.error={message:"No claimed inbox row was restored; it may remain locked."};try{await loadInbox()}catch(e){console.error("SMS Capture inbox refresh after restore",e);r.refreshError=e}return r}
async function approve(id){
 let {data:r,error}=await sb.from("sms_capture_inbox").select("*").eq("id",id).eq("user_id",user.id).single();if(error)return alert(error.message);
 if(r.status!=="needs_review")return alert("This SMS is already posted, ignored, or being processed.");
 if(!r.parsed_amount||Number(r.parsed_amount)<=0||!["in","out"].includes(r.parsed_direction))return alert("Amount or debit/credit direction is missing. Reject or re-forward the SMS.");
 if(r.reference_number){let {data:dup,error:dupErr}=await sb.from("sms_capture_inbox").select("id,status,movement_id").eq("user_id",user.id).eq("reference_number",r.reference_number).neq("id",id).in("status",["needs_review","posted"]).limit(1);if(dupErr)return alert("Inbox duplicate check failed: "+dupErr.message);if(dup?.length)return alert("This reference number already exists. Cannot post duplicate.");const {data:movementDup,error:movementDupErr}=await findCashMovementDuplicate(r.reference_number);if(movementDupErr)return alert("Cash Book duplicate check failed: "+movementDupErr.message);if(movementDup?.length)return alert("This reference number is already recorded in Cash Book. Cannot post duplicate.");}
 const selectEl=Array.from($("inbox").querySelectorAll("[data-inbox-account]")).find(el=>el.dataset.inboxAccount===id);
 const accountId=selectEl?.value||r.account_id;if(!accountId)return alert("Select a Cash Book account to approve this transaction.");
 const claim=await sb.from("sms_capture_inbox").update({status:"posted",parse_reason:"Manual approval in progress"}).eq("id",id).eq("user_id",user.id).eq("status","needs_review").select("id").single();if(claim.error)return alert("This item is already being processed or is no longer awaiting review.");
 if(r.reference_number){const {data:claimDup,error:claimDupErr}=await sb.from("sms_capture_inbox").select("id,status").eq("user_id",user.id).eq("reference_number",r.reference_number).neq("id",id).in("status",["needs_review","posted"]).limit(1);if(claimDupErr){const restore=await restoreClaim(id,"Duplicate-check failed after claim; no movement posted.");return alert("Duplicate-check failed after claim. No movement was created. "+(restore.error?"Inbox status could not be restored: "+restore.error.message:claimDupErr.message))}if(claimDup?.length){const restore=await restoreClaim(id,"Duplicate reference detected during approval; no movement posted.");return alert("Another SMS with this reference is present. No movement was posted; reject the duplicate inbox item."+(restore.error?" Status restoration failed: "+restore.error.message:""))}const {data:movementDupAfterClaim,error:movementDupAfterClaimErr}=await findCashMovementDuplicate(r.reference_number);if(movementDupAfterClaimErr){const restore=await restoreClaim(id,"Cash Book duplicate-check failed after claim; no movement posted.");return alert("Cash Book duplicate-check failed after claim. No movement was created. "+(restore.error?"Inbox status could not be restored: "+restore.error.message:movementDupAfterClaimErr.message))}if(movementDupAfterClaim?.length){const restore=await restoreClaim(id,"Cash Book reference duplicate detected after claim; no movement posted.");return alert("This reference number appeared in Cash Book during approval. No movement was posted."+(restore.error?" Inbox status restoration failed: "+restore.error.message:""))}}
 const ins=await sb.from("cash_movements").insert({user_id:user.id,account_id:accountId,movement_date:r.parsed_date||new Date().toISOString().slice(0,10),direction:r.parsed_direction,amount:r.parsed_amount,movement_type:"sms_auto",sms_reference_number:r.reference_number||null,description:r.parsed_description||"SMS transaction",reference_note:"SMS manual approval · Ref "+(r.reference_number||"N/A")+" · "+(r.account_identifier||"")}).select("id").single();
 if(ins.error){if(ins.error.code==="23505"&&r.reference_number){const marked=await sb.from("sms_capture_inbox").update({status:"duplicate",parse_reason:"This SMS reference is already recorded in Cash Book; no second movement was created."}).eq("id",id).eq("user_id",user.id).eq("status","posted").select("id").maybeSingle();await loadInbox();return alert("Duplicate blocked: this reference number is already recorded in Cash Book."+(marked.error||!marked.data?" Inbox status could not be updated; do not retry until checked.":""))}const insertFailure=ins.error.message||String(ins.error);const lock=await sb.from("sms_capture_inbox").update({parse_reason:"Cash Book insert returned an error; outcome is unconfirmed. Check Cash Book before retrying."}).eq("id",id).eq("user_id",user.id).eq("status","posted").select("id").maybeSingle();let refreshWarning="";try{await loadInbox()}catch(refreshError){refreshWarning=" Inbox refresh failed: "+(refreshError?.message||String(refreshError))+"."}return alert("Cash Book insert returned an error: "+insertFailure+". The inbox item remains locked because the write outcome cannot be safely assumed. Check Cash Book before retrying."+(lock.error||!lock.data?" The lock could not be confirmed; do not retry until Cash Book and inbox are checked.":"")+refreshWarning);}
 const upd=await sb.from("sms_capture_inbox").update({movement_id:ins.data.id,parse_reason:"Manually approved"}).eq("id",id).eq("user_id",user.id).eq("status","posted").select("id").maybeSingle();
 if(upd.error||!upd.data){const updateFailure=upd.error?.message||"The claimed inbox row was not updated.";const rollback=await sb.from("cash_movements").delete().eq("id",ins.data.id).eq("user_id",user.id).select("id").maybeSingle();if(rollback.error||!rollback.data){const lock=await sb.from("sms_capture_inbox").update({parse_reason:"Movement may exist; rollback failed. Item remains locked to prevent repeat posting. Check Cash Book before taking action."}).eq("id",id).eq("user_id",user.id).eq("status","posted");return alert("Inbox update failed ("+updateFailure+") and movement rollback could not be confirmed. The item remains locked to avoid a duplicate. Check Cash Book before taking action."+(lock.error?" Inbox warning could not be saved: "+lock.error.message:""));}const restored=await sb.from("sms_capture_inbox").update({status:"needs_review",parse_reason:"Inbox update failed; movement was rolled back."}).eq("id",id).eq("user_id",user.id).eq("status","posted").select("id").maybeSingle();return alert("Inbox update failed ("+updateFailure+"). The inserted movement was rolled back."+(restored.error||!restored.data?" Inbox status could not be restored; refresh or contact an administrator.":""));}
 await loadInbox();
}
async function reject(id){const r=await sb.from("sms_capture_inbox").update({status:"ignored",parse_reason:"Rejected by user"}).eq("id",id).eq("user_id",user.id).eq("status","needs_review").select("id").maybeSingle();if(r.error){alert("Reject failed: "+r.error.message);return}if(!r.data){alert("This item is no longer awaiting review. The inbox will refresh.");await loadInbox();return}await loadInbox()}
$("generateToken").onclick=async()=>{const btn=$("generateToken"),status=$("tokenStatus");btn.disabled=true;btn.textContent="Generating…";status.textContent="Checking session…";status.className="status";try{const {data,error}=await sb.auth.getSession();if(error)throw new Error("Session lookup failed: "+error.message);const session=data.session;if(!session?.access_token)throw new Error("No active login session. Sign out and log in again.");status.textContent="Registering token with server…";latestToken="pt_sms_"+Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,"0")).join("");const response=await fetch("https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/register",{method:"POST",headers:{apikey:"sb_publishable_o3SjG1KCygJ99RuamTJdsQ_RIkHJ-gX",Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({token:latestToken,label:"iPhone Shortcut"})});const raw=await response.text();let result;try{result=JSON.parse(raw)}catch{result={error:raw||"Empty server response"}}if(!response.ok||!result.ok)throw new Error("HTTP "+response.status+": "+(result.error||raw||"Registration rejected"));$("tokenValue").value=latestToken;$("tokenBox").hidden=false;status.textContent="Token generated successfully. Copy it now—the plaintext is shown only once.";status.className="status success";try{await loadTokens()}catch(refreshError){status.textContent="Token was generated successfully, and is displayed below. Token list refresh failed: "+(refreshError?.message||String(refreshError));status.className="status success"}}catch(e){latestToken="";$("tokenBox").hidden=true;status.textContent="Token generation failed: "+(e?.message||String(e));status.className="status error";console.error("SMS Capture token registration",e)}finally{btn.disabled=false;btn.textContent="Generate new token"}}
$("copyToken").onclick=async()=>{await navigator.clipboard.writeText($("tokenValue").value);alert("Copied token. Store it safely.")};
$("mappingForm").onsubmit=async e=>{e.preventDefault();const identifier=$("identifier").value.trim().toUpperCase(),account_id=$("mapAccount").value;if(!identifier||!account_id)return;const ruleSender="__account__:"+identifier;const r=await sb.from("sms_capture_account_rules").upsert({user_id:user.id,sender:ruleSender,account_identifier:identifier,account_id},{onConflict:"user_id,sender"});if(r.error)alert("Identifier mapping save failed: "+r.error.message);else{$("identifier").value="";await loadMappings()}};$("senderMappingForm").onsubmit=async e=>{e.preventDefault();const sender=$("senderId").value.trim().toUpperCase(),account_id=$("senderAccount").value;if(!sender||!account_id)return;if(sender.startsWith("__ACCOUNT__:"))return alert("That sender ID is reserved for account-identifier rules.");const r=await sb.from("sms_capture_account_rules").upsert({user_id:user.id,sender,account_identifier:null,account_id},{onConflict:"user_id,sender"});if(r.error)alert("Sender mapping save failed: "+r.error.message);else{$("senderId").value="";await loadMappings()}};
(async()=>{if(!await auth())return;const acct=await Promise.allSettled([loadAccounts()]);if(acct[0].status==="rejected")console.error("SMS Capture accounts load",acct[0].reason);const tasks=await Promise.allSettled([loadTokens(),loadMappings(),loadInbox()]);if(tasks[0].status==="rejected")$("tokenStatus").textContent="Token list failed to load: "+(tasks[0].reason?.message||String(tasks[0].reason));if(tasks[1].status==="rejected")$("mappings").innerHTML='<p class="warn">Mapping list failed to load: '+esc(tasks[1].reason?.message||String(tasks[1].reason))+'</p>';if(tasks[2].status==="rejected")$("inbox").innerHTML='<p class="warn">Review inbox failed to load: '+esc(tasks[2].reason?.message||String(tasks[2].reason))+'</p>'})().catch(e=>{console.error("SMS Capture initialization",e);alert("SMS Capture initialization failed: "+(e?.message||String(e))) });