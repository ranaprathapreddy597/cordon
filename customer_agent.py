from __future__ import annotations

import random
import time

from sdk.cordon import ChaosInjectedError, CordonSession, FinOpsKillSwitchTriggered


FAKE_TICKETS = [
    "Customer wants a refund after duplicate billing.",
    "Customer cannot connect their calendar integration.",
    "Customer reports a slow nightly sync job.",
    "Customer asks whether Cordon stores raw secrets.",
]


def fake_tool_lookup(ticket: str) -> str:
    time.sleep(0.2)
    return f"Knowledge base match found for: {ticket}"


def run_agent() -> None:
    with CordonSession(
        agent_name="Customer Support Copilot",
        provider="openai",
        model="gpt-4.1-mini",
        tags=["demo", "support"],
        metadata={"owner": "local-dev", "workflow": "customer_support"},
    ) as session:
        session.record_note(
            "Agent boot",
            response="Customer Support Copilot started and waiting for tickets.",
        )

        for index in range(1, 7):
            ticket = random.choice(FAKE_TICKETS)
            session.record_note(
                f"Ticket {index} received",
                prompt=ticket,
                response="Queued for analysis.",
                metadata={"ticket_number": index},
            )

            try:
                session.maybe_inject_tool_fault("knowledge_base.search", ticket)
                tool_start = time.perf_counter()
                lookup_result = fake_tool_lookup(ticket)
                session.record_tool_call(
                    "knowledge_base.search",
                    input_text=ticket,
                    output_text=lookup_result,
                    latency_ms=int((time.perf_counter() - tool_start) * 1000),
                )

                llm_prompt = (
                    f"Customer issue: {ticket}\n"
                    f"Internal context: {lookup_result}\n"
                    "Write a short safe response and flag any data risk."
                )
                llm_start = time.perf_counter()
                completion = session.trace(
                    llm_prompt,
                    response="Suggested response drafted. No refund abuse signals detected.",
                    provider="openai",
                    model="gpt-4.1-mini",
                    latency_ms=int((time.perf_counter() - llm_start) * 1000) + 180,
                    metadata={"ticket_number": index},
                )

                if "secrets" in ticket.lower():
                    session.record_guardrail(
                        "Potential secret handling query",
                        prompt=llm_prompt,
                        response=completion,
                        risk_label="data_access",
                    )

                print(f"[ticket {index}] completed")
            except ChaosInjectedError as exc:
                session.record_error(
                    "Chaos test triggered",
                    response=str(exc),
                    prompt=ticket,
                    metadata={"ticket_number": index},
                )
                print(f"[ticket {index}] chaos event: {exc}")
            except FinOpsKillSwitchTriggered:
                print("Cordon halted the agent after a policy breach.")
                raise

            time.sleep(0.4)


if __name__ == "__main__":
    run_agent()
