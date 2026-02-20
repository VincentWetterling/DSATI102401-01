#!/usr/bin/env python3
"""
CLI-Entrypoint für LLM-Vergleiche.

Start: python main.py

Interaktiv: Auswahl Anbieter / Modelle / Prompt → führt Benchmarks aus → speichert CSV
"""
import os
import sys
import json
from typing import List
from utils import load_dotenv_if_exists, timestamp_str, save_results_csv
from providers import OpenAIClient, OllamaClient, AnthropicClient, GenericHTTPClient
from bench import run_single_benchmark


def pick_from_list(prompt: str, options: List[str], multiselect: bool = False) -> List[str]:
    print(f"\n{prompt}")
    for i, o in enumerate(options, start=1):
        print(f"  {i}) {o}")
    if multiselect:
        s = input("Wähle Nummern (Komma getrennt) oder 'all': ").strip()
        if s.lower() == "all":
            return options
        picks = []
        for p in s.split(","):
            try:
                idx = int(p.strip()) - 1
                if 0 <= idx < len(options):
                    picks.append(options[idx])
            except Exception:
                continue
        return picks
    else:
        s = input("Wähle Nummer (z.B. 1): ").strip()
        try:
            idx = int(s) - 1
            return [options[idx]]
        except Exception:
            return []


def load_prompts():
    if os.path.exists("prompts.json"):
        with open("prompts.json", "r", encoding="utf-8") as f:
            return json.load(f)
    return {"default": "Schreibe einen kurzen Absatz über Künstliche Intelligenz."}


def detect_providers():
    providers = []
    # instantiate clients if environment seems configured
    oll = OllamaClient()
    providers.append(oll)
    openai = OpenAIClient()
    providers.append(openai)
    anth = AnthropicClient()
    providers.append(anth)
    # generic placeholders for IONOS/AWS/GEMINI via GenericHTTPClient
    for prefix in ("IONOS", "AWS", "GEMINI"):
        g = GenericHTTPClient(prefix)
        providers.append(g)
    return providers


def show_models_for(provider):
    print(f"\nModel-Check für {provider.name} ...")
    try:
        ms = provider.check_models()
        if not ms:
            print("  (keine Modelle gefunden - bitte .env prüfen)")
        else:
            for m in ms:
                print(f"  - {m}")
        return ms
    except Exception as e:
        print("  Fehler beim Abfragen:", e)
        return []


def main():
    load_dotenv_if_exists()
    prompts = load_prompts()
    providers = detect_providers()

    print("LLM-Benchmark — Auswahl:\n")
    print("1) Check available models")
    print("2) Run comparison (single / multiple / all)")
    choice = input("Wähle Option (1/2): ").strip()
    if choice == "1":
        # list models per provider
        for p in providers:
            show_models_for(p)
        print("\nFertig.")
        return

    # run comparison
    mode = input("Vergleichsmodus — 'single', 'multiple' oder 'all' (default all): ").strip().lower() or "all"
    candidates = []
    if mode == "single":
        names = [p.name for p in providers]
        sel = pick_from_list("Wähle einen Anbieter:", names, multiselect=False)
        candidates = [p for p in providers if p.name == sel[0]] if sel else []
    elif mode == "multiple":
        names = [p.name for p in providers]
        sel = pick_from_list("Wähle Anbieter (mehrere möglich):", names, multiselect=True)
        candidates = [p for p in providers if p.name in sel]
    else:
        candidates = providers

    # per provider: choose models
    to_run = []  # tuples (client, model)
    for p in candidates:
        models = show_models_for(p)
        if not models:
            usr = input(f"Keine Modelle für {p.name} gefunden. Modellname manuell eingeben (oder leer skip): ").strip()
            if usr:
                models = [usr]
            else:
                continue
        if len(models) == 1:
            sel_models = models
        else:
            s = input(f"Für {p.name}: 'single' Modell wählen, 'multiple' auswählen, oder 'all' (default all): ").strip().lower() or "all"
            if s == "single":
                sel = pick_from_list(f"Wähle ein Modell für {p.name}:", models, multiselect=False)
                sel_models = sel
            elif s == "multiple":
                sel = pick_from_list(f"Wähle Modelle für {p.name}:", models, multiselect=True)
                sel_models = sel
            else:
                sel_models = models
        for m in sel_models:
            to_run.append((p, m))

    if not to_run:
        print("Keine Modelle zum Testen ausgewählt — Abbruch.")
        return

    # prompt selection
    print("\nVerfügbare Prompts:")
    keys = list(prompts.keys())
    for i, k in enumerate(keys, start=1):
        print(f"  {i}) {k} — {prompts[k]}")
    print(f"  {len(keys)+1}) Eigener Prompt eingeben")
    idx = input("Wähle Prompt (Nummer): ").strip()
    try:
        idxn = int(idx)
        if 1 <= idxn <= len(keys):
            prompt_key = keys[idxn-1]
            prompt_text = prompts[prompt_key]
        else:
            prompt_key = "custom"
            prompt_text = input("Gib deinen Prompt ein: ")
    except Exception:
        prompt_key = "custom"
        prompt_text = input("Gib deinen Prompt ein: ")

    results = []
    print(f"\nStarte Benchmarks für {len(to_run)} Kombinationen...")
    for client, model in to_run:
        print(f"\n→ {client.name} :: {model}")
        out = run_single_benchmark(client, model, prompt_key, prompt_text)
        results.append(out)
        print(f"   status={out['status']} ttft={out['ttft_s']}s total={out['total_time_s']}s chars={out['output_chars']}")

    # save CSV
    fname = os.path.join("results", f"llm_bench_{timestamp_str()}.csv")
    save_results_csv(results, fname)
    print(f"\nErgebnisse gespeichert: {fname}")


if __name__ == '__main__':
    main()
