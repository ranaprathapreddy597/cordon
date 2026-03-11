from cordon import CordonClient
import time

# 🛑 PASTE YOUR ORGANIZATION API KEY FROM YOUR SUPABASE TABLE HERE
cordon = CordonClient(api_key="407481af-5688-4fd2-8c4c-5dc20d7a9058")
cordon.start_session(agent_name="Customer_Support_Agent_V1")

while True:
    try:
        time.sleep(1.5)
        response = cordon.wrap_llm_call("Process user refund...")
        print("Agent executed successfully.")
    except Exception as e:
        print(f"Agent caught an error: {e}. Retrying...")