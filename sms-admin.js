const sb=supabase.createClient("https://magxbczgrxeypryjborr.supabase.co","sb_publishable_o3SjG1KCygJ99RuamTJdsQ_RIkHJ-gX");
const ADMIN_EMAIL="ketansoni8@gmail.com";
const $=id=>document.getElementById(id);
const OUTCOME_CLASSES=new Set(["posted","duplicate","needs_review","invalid_token","cashbook_write_failed","invalid_request","missing_token","invalid_message"]);
let all=[],reviews=[];

const esc=value=>String(value??"—").replace(/[&<>"']/g,char=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[char]));

async function logout(){
 try{await sb.auth.signOut({scope:"local"})}catch(error){console.warn("Local sign-out failed",error)}
 try{localStorage.removeItem("sb-magxbczgrxeypryjborr-auth-token")}catch(error){console.warn("Could not clear cached auth token",error)}
 location.replace("index.html");
}

async function guard(){
 const {data:{session},error}=await sb.auth.getSession();
 if(error||!session?.access_token){location.replace("index.html");return false}
 const {data:{user},error:userError}=await sb.auth.getUser(session.access_token);
 if(userError||!user){location.replace("index.html");return false}
 if((user.email||"").toLowerCase()!==ADMIN_EMAIL){
  document.body.innerHTML="<main><section class='panel'><h2>Access denied</h2><p>This page is restricted to the configured administrator.</p><a href='index.html'>Return to dashboard</a></section></main>";
  return false;
 }
 $("email").textContent=user.email||"Administrator";
 $("logout").onclick=logout;
 sb.auth.onAuthStateChange((event,nextSession)=>{
  if(event==="SIGNED_OUT"||!nextSession||(nextSession.user?.email||"").toLowerCase()!==ADMIN_EMAIL)location.replace("index.html");
 });
 return true;
}

function fmtAmount(value,direction){
 if(value===null||value===undefined||value==="")return "—";
 const amount=Number(value);
 if(!Number.isFinite(amount))return "—";
 return (direction==="out"?"−":"+")+"₹"+amount.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
}

function draw(){
 const selected=$("outcome").value;
 const rows=all.filter(item=>selected==="all"||item.outcome===selected);
 $("total").textContent=all.length;
 $("posted").textContent=all.filter(item=>item.outcome==="posted").length;
 $("duplicates").textContent=all.filter(item=>item.outcome==="duplicate").length;
 $("failures").textContent=all.filter(item=>["invalid_token","missing_token","invalid_request","invalid_message","cashbook_write_failed"].includes(item.outcome)).length;
 $("rows").innerHTML=rows.map(item=>{
  const time=new Date(item.created_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"});
  const outcome=String(item.outcome??"unknown");
  const outcomeClass=OUTCOME_CLASSES.has(outcome)?outcome:"unknown";
  return "<tr><td>"+esc(time)+"</td><td><span class='pill "+outcomeClass+"'>"+esc(outcome.replace(/_/g," "))+"</span></td><td>"+esc(item.user_id)+"</td><td>"+esc(item.sender)+"</td><td>"+esc(item.account_identifier)+"</td><td>"+esc(fmtAmount(item.amount,item.direction))+"</td><td>"+esc(item.reference_number)+"</td><td>"+esc(item.http_status)+"</td><td>"+esc(item.detail)+"</td></tr>";
 }).join("")||"<tr><td colspan='9' class='empty'>No events found for this filter.</td></tr>";
 const reviewRows=reviews.map(item=>{
  const time=new Date(item.reviewed_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"});
  const accepted=item.status==="posted";
  return "<tr><td>"+esc(time)+"</td><td><span class='pill "+(accepted?"posted":"rejected")+"'>"+(accepted?"accepted":"rejected")+"</span></td><td>"+esc(item.user_id)+"</td><td>"+esc(item.sms_sender)+"</td><td>"+esc(item.account_identifier)+"</td><td>"+esc(fmtAmount(item.parsed_amount,item.parsed_direction))+"</td><td>"+esc(item.reference_number)+"</td><td colspan='2'>"+esc(item.parse_reason||"Reviewed transaction")+"</td></tr>";
 }).join("");
 $("reviewRows").innerHTML=reviewRows||"<tr><td colspan='8' class='empty'>No reviewed transactions in this period.</td></tr>";
}

async function load(){
 $("status").textContent="Loading integration events…";
 const hours=Number($("period").value);
 const since=new Date(Date.now()-hours*3600000).toISOString();
 const {data,error}=await sb.from("sms_capture_events")
  .select("id,user_id,event_type,outcome,request_id,sender,account_identifier,reference_number,amount,direction,http_status,detail,created_at")
  .gte("created_at",since).order("created_at",{ascending:false}).limit(500);
 if(error){$("status").textContent="Could not load events: "+error.message;return}
 all=data||[];
 const reviewResult=await sb.from("sms_capture_inbox")
  .select("id,user_id,sms_sender,account_identifier,reference_number,parsed_amount,parsed_direction,status,parse_reason,reviewed_at")
  .not("reviewed_at","is",null).gte("reviewed_at",since).order("reviewed_at",{ascending:false}).limit(500);
 if(reviewResult.error){$("status").textContent="Integration events loaded, but review decisions failed to load: "+reviewResult.error.message;reviews=[];draw();return}
 reviews=reviewResult.data||[];
 draw();
 $("status").textContent=all.length+" integration event(s) and "+reviews.length+" review decision(s) loaded. Last refreshed "+new Date().toLocaleTimeString("en-IN");
}

$("refresh").onclick=()=>load().catch(error=>{$("status").textContent="Could not load events: "+(error?.message||String(error))});
$("period").onchange=()=>load().catch(error=>{$("status").textContent="Could not load events: "+(error?.message||String(error))});
$("outcome").onchange=draw;
(async()=>{if(await guard())await load()})().catch(error=>{$("status").textContent="SMS monitor initialization failed: "+(error?.message||String(error))});
