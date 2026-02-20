import os
import csv
import time
from typing import List, Dict


def load_dotenv_if_exists(path: str = ".env") -> None:
    """
    Liest eine `.env`-Datei und setzt die enthaltenen Variablen in os.environ.

    Erwartet einfache `KEY=VALUE`-Zeilen; Kommentare (#...) werden ignoriert.
    """
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for ln in f:
            ln = ln.strip()
            if not ln or ln.startswith("#"):
                continue
            if "=" not in ln:
                continue
            k, v = ln.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            os.environ.setdefault(k, v)


def timestamp_str() -> str:
    return time.strftime("%Y%m%d_%H%M%S")


def save_results_csv(rows: List[Dict], out_path: str) -> None:
    """Speichert Benchmark-Ergebnisse als CSV. Spalten kommen aus dem ersten Dict (geordnet)."""
    if not rows:
        return
    keys = [
        "timestamp",
        "provider",
        "model",
        "prompt_key_or_text",
        "ttft_s",
        "total_time_s",
        "output_chars",
        "status",
        "error",
        "output_excerpt",
    ]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in keys})
