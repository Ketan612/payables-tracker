(() => {
 const PREFIX="payables-tracker:last-activity:";
 const isInstalledApp=()=>((typeof window.matchMedia==="function")&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
 const getAuthStorage=()=>isInstalledApp()?window.localStorage:window.sessionStorage;
 const getIdleTimeoutMs=()=>isInstalledApp()?15*24*60*60*1000:30*60*1000;
 let client=null,userId=null,lastActivityAt=0,timer=null,activityKey=null,activityStorage=null,listenersInstalled=false;
 const clearTimer=()=>{if(timer)window.clearTimeout(timer);timer=null};
 const signOut=async()=>{if(!client||!userId)return;clearTimer();try{const{error}=await client.auth.signOut({scope:"local"});if(error)console.error("Automatic sign out returned an error:",error)}catch(error){console.error("Automatic sign out failed:",error)}finally{try{activityStorage?.removeItem(activityKey)}catch(_){}}};
 const schedule=()=>{clearTimer();if(!userId||!lastActivityAt)return;const remaining=getIdleTimeoutMs()-(Date.now()-lastActivityAt);if(remaining<=0){signOut();return}timer=setTimeout(signOut,remaining)};
 const record=()=>{if(!userId)return;const now=Date.now();if(lastActivityAt&&now-lastActivityAt>=getIdleTimeoutMs()){signOut();return}lastActivityAt=now;try{activityStorage.setItem(activityKey,String(now))}catch(error){console.warn("Unable to save inactivity timestamp:",error)}schedule()};
 const install=()=>{if(listenersInstalled)return;listenersInstalled=true;["pointerdown","keydown","touchstart","scroll","wheel","click","input"].forEach(type=>window.addEventListener(type,record,{passive:true}));window.addEventListener("storage",event=>{if(!userId||event.key!==activityKey||!event.newValue)return;const ts=Number(event.newValue);if(Number.isFinite(ts)){lastActivityAt=ts;schedule()}});document.addEventListener("visibilitychange",()=>{if(document.visibilityState!=="visible"||!userId)return;if(Date.now()-lastActivityAt>=getIdleTimeoutMs())signOut();else schedule()})};
 const start=(authClient,id)=>{if(!authClient||!id)return;if(client===authClient&&userId===id){schedule();return}clearTimer();client=authClient;userId=id;activityKey=PREFIX+id;activityStorage=getAuthStorage();let stored=0;try{stored=Number(activityStorage.getItem(activityKey))||0}catch(_){}lastActivityAt=stored||Date.now();install();if(Date.now()-lastActivityAt>=getIdleTimeoutMs()){signOut();return}if(!stored){try{activityStorage.setItem(activityKey,String(lastActivityAt))}catch(_){}}schedule()};
 const stop=()=>{clearTimer();if(activityKey){try{localStorage.removeItem(activityKey)}catch(_){}}client=null;userId=null;lastActivityAt=0;activityKey=null};
 window.payablesAuthStorage=getAuthStorage;window.payablesSessionPolicy={start,stop,isInstalledApp,getIdleTimeoutMs};
})();