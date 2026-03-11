from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

app = FastAPI(title="Cordon API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🛑 PASTE YOUR SUPABASE URL AND ANON KEY HERE
SUPABASE_URL = "https://jaezgnvmwmleniaqmzpb.supabase.co"
SUPABASE_KEY = "sb_publishable_SlAQdh4SDr0rFi5Dco33SQ_iT7HuIly"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class LogPayload(BaseModel):
    run_id: str
    event_type: str
    prompt: str
    response: str
    cost: float

# Security Middleware: Verifies the developer's API Key
def verify_api_key(x_api_key: str = Header(...)):
    org_res = supabase.table("organizations").select("*").eq("api_key", x_api_key).execute()
    # FIX: Check if the list is empty
    if not org_res.data or len(org_res.data) == 0:
        raise HTTPException(status_code=401, detail="Invalid Cordon API Key")
    # FIX: Return the first dictionary in the list
    return org_res.data[0]

@app.post("/v1/runs/start")
def start_run(agent_name: str, org: dict = Depends(verify_api_key)):
    run_res = supabase.table("agent_runs").insert({
        "org_id": org['id'], 
        "agent_name": agent_name
    }).execute()
    # FIX: Extract ID from the first item in the list
    return {"run_id": run_res.data[0]['id']}

@app.post("/v1/logs/ingest")
def ingest_log(payload: LogPayload, org: dict = Depends(verify_api_key)):
    supabase.table("agent_logs").insert({
        "run_id": payload.run_id,
        "event_type": payload.event_type,
        "prompt": payload.prompt,
        "response": payload.response,
        "cost": payload.cost
    }).execute()
    
    run_res = supabase.table("agent_runs").select("total_cost").eq("id", payload.run_id).execute()
    current_cost = run_res.data[0].get('total_cost', 0.0) if run_res.data else 0.0
    new_cost = current_cost + payload.cost
    
    # FinOps Auto-Kill Switch
    if new_cost > org.get('budget_limit', 5.00):
        supabase.table("agent_runs").update({
            "status": "KILLED_BY_CORDON", 
            "total_cost": new_cost
        }).eq("id", payload.run_id).execute()
        return {"status": "KILLED", "reason": "Budget limit exceeded."}
        
    supabase.table("agent_runs").update({
        "total_cost": new_cost
    }).eq("id", payload.run_id).execute()
    
    return {"status": "SUCCESS"}