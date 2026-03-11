import requests
import random

class CordonClient:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "http://localhost:8000/v1"
        self.headers = {"x-api-key": self.api_key}
        self.run_id = None

    def start_session(self, agent_name):
        try:
            res = requests.post(f"{self.base_url}/runs/start", params={"agent_name": agent_name}, headers=self.headers)
            res.raise_for_status()
            self.run_id = res.json()["run_id"]
            print(f"✅ Cordon Session Started: {self.run_id}")
        except Exception as e:
            raise Exception(f"Failed to connect to Cordon Backend. Ensure server.py is running. Error: {e}")

    def wrap_llm_call(self, prompt):
        if random.random() < 0.15:
            self._send_log("chaos_injected", prompt, "Simulated 500 API Error", 0)
            raise Exception("Cordon Chaos Engine: Simulated Network Failure")
            
        cost = len(prompt) * 0.05 
        status = self._send_log("llm_call", prompt, "Successful AI Response", cost)
        
        if status == "KILLED":
            print("🛑 CORDON ALERT: Agent terminated to prevent budget overrun.")
            exit(1)
            
        return "Successful AI Response"

    def _send_log(self, event_type, prompt, response, cost):
        payload = {
            "run_id": self.run_id,
            "event_type": event_type,
            "prompt": prompt,
            "response": response,
            "cost": cost
        }
        res = requests.post(f"{self.base_url}/logs/ingest", json=payload, headers=self.headers)
        return res.json().get("status")