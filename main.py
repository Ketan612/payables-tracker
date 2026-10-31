import os
from fastapi import FastAPI,Header,HTTPException
from supabase import create_client
app=FastAPI(title="Payables Tracker read-only API")
url=os.getenv("SUPABASE_URL");key=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
db=create_client(url,key) if url and key else None
def owner(authorization):
 if not db: raise HTTPException(503,"Database not configured")
 if not authorization or not authorization.startswith("Bearer "): raise HTTPException(401,"Bearer token required")
 try:
  u=db.auth.get_user(authorization[7:]).user
  return u.id
 except Exception: raise HTTPException(401,"Invalid token")
@app.get("/health")
def health(): return {"ok":True,"database_configured":db is not None}
@app.get("/v1/payables")
def payables(authorization:str|None=Header(default=None),month:str|None=None):
 uid=owner(authorization);q=db.table("payables").select("*").eq("owner_id",uid)
 if month:q=q.eq("payment_month",month)
 return q.execute().data
@app.get("/v1/summary")
def summary(authorization:str|None=Header(default=None),month:str|None=None):
 uid=owner(authorization);q=db.table("payables").select("amount,payable_type,status,payment_month").eq("owner_id",uid)
 if month:q=q.eq("payment_month",month)
 r=[x for x in q.execute().data if x["status"] not in("Paid","Settled")]
 p=round(sum(float(x["amount"]) for x in r if x["payable_type"]=="Personal"),2);c=round(sum(float(x["amount"]) for x in r if x["payable_type"]=="Common"),2)
 return {"currency":"INR","month":month or "all","personal_pending":p,"common_pending":c,"total_pending":round(p+c,2),"pending_items":len(r)}
