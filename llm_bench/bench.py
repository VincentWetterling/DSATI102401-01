"""
Benchmark-Utilities: Führt Messungen pro Provider/Model/Prompt durch und sammelt Ergebnisse.
"""
import time
from typing import Dict


def run_single_benchmark(client, model: str, prompt_key_or_text: str, prompt_text: str, timeout: int = 60) -> Dict:
    """Führt einen Messlauf für `client` + `model` mit `prompt_text` aus.

    Rückgabe enthält Felder: provider, model, prompt_key_or_text, ttft_s, total_time_s, chars, status, error, output_excerpt, timestamp
    """
    tstamp = time.strftime("%Y-%m-%d %H:%M:%S")
    res = client.generate_and_measure(prompt_text, model, timeout=timeout)
    text = res.get("text", "") or ""
    out = {
        "timestamp": tstamp,
        "provider": client.name,
        "model": model,
        "prompt_key_or_text": prompt_key_or_text,
        "ttft_s": round(res.get("ttft_s") or 0, 4) if res.get("ttft_s") is not None else "",
        "total_time_s": round(res.get("total_time_s") or 0, 4),
        "output_chars": res.get("chars", 0),
        "status": res.get("status", "error"),
        "error": res.get("error", ""),
        "output_excerpt": (text[:300] + ("..." if len(text) > 300 else "")),
    }
    return out
