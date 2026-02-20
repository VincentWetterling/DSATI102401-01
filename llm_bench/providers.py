"""
Einfache Provider-Clients mit minimaler Logik zum "Check Models" und zur Messung
von TTFT / total time / output length.

Hinweis: Diese Implementierungen sind bewusst tolerant und nutzen Umgebungsvariablen
wenn kein offizieller List-Endpoint vorhanden ist. Fülle `.env` entsprechend.
"""
import os
import time
import json
import requests
from typing import List, Dict, Optional


def _first_text_from_chunk(payload: Dict) -> str:
    """Versucht, Text aus unterschiedlichen Antwort-Formaten zu extrahieren."""
    # OpenAI-style
    try:
        for ch in (payload.get("choices") or []):
            delta = ch.get("delta") or {}
            if "content" in delta:
                return delta["content"]
            # fallback
            if "text" in ch:
                return ch["text"]
    except Exception:
        pass
    # Anthropic-style
    if "completion" in payload:
        return payload.get("completion") or ""
    # generic
    for k in ("text", "content", "response", "output"):
        if k in payload:
            v = payload[k]
            if isinstance(v, str):
                return v
            if isinstance(v, dict) and "text" in v:
                return v["text"]
    return ""


class ProviderBase:
    """Basisklasse. Subklassen sollten `generate_and_measure` implementieren.

    check_models liest standardmässig ENV VAR {NAME}_MODELS (kommagetrennt).
    """

    name = "base"

    def __init__(self):
        self.env_models = os.environ.get(f"{self.name.upper()}_MODELS")

    def check_models(self) -> List[str]:
        """Gibt eine Liste von Modellnamen zurück (wenn ENV gesetzt)."""
        if self.env_models:
            return [m.strip() for m in self.env_models.split(",") if m.strip()]
        return []

    def generate_and_measure(self, prompt: str, model: str, timeout: int = 60) -> Dict:
        """Sollte von Subklassen implementiert werden.

        Rückgabe: dict mit keys: text, ttft_s, total_time_s, chars, status, error
        """
        raise NotImplementedError


class OllamaClient(ProviderBase):
    name = "ollama"

    def __init__(self):
        super().__init__()
        self.base = os.environ.get("OLLAMA_API_URL", "http://localhost:11434").rstrip("/")

    def check_models(self) -> List[str]:
        """Versucht Ollama /models abzufragen, sonst ENV zurückgeben."""
        try:
            r = requests.get(f"{self.base}/models", timeout=5)
            if r.ok:
                data = r.json()
                return [m.get("name") or m.get("model") for m in data]
        except Exception:
            pass
        return super().check_models()

    def generate_and_measure(self, prompt: str, model: str, timeout: int = 60) -> Dict:
        url = f"{self.base}/api/generate"
        payload = {"model": model, "prompt": prompt, "stream": True}
        headers = {"Content-Type": "application/json"}
        t0 = time.perf_counter()
        try:
            with requests.post(url, json=payload, headers=headers, stream=True, timeout=timeout) as resp:
                resp.raise_for_status()
                text = ""
                ttft = None
                for raw in resp.iter_lines(decode_unicode=True):
                    if not raw:
                        continue
                    # Ollama sendet JSON-chunks per line
                    try:
                        chunk = json.loads(raw)
                        c = _first_text_from_chunk(chunk)
                        if c:
                            if ttft is None:
                                ttft = time.perf_counter() - t0
                            text += c
                    except Exception:
                        # fallback: treat raw as text
                        if ttft is None:
                            ttft = time.perf_counter() - t0
                        text += raw
                total = time.perf_counter() - t0
                return {
                    "text": text,
                    "ttft_s": ttft or total,
                    "total_time_s": total,
                    "chars": len(text),
                    "status": "ok",
                    "error": "",
                }
        except Exception as e:
            total = time.perf_counter() - t0
            return {"text": "", "ttft_s": None, "total_time_s": total, "chars": 0, "status": "error", "error": str(e)}


class OpenAIClient(ProviderBase):
    name = "openai"

    def __init__(self):
        super().__init__()
        self.api_key = os.environ.get("OPENAI_API_KEY")

    def check_models(self) -> List[str]:
        """Listet Modelle über OpenAI /v1/models wenn API-Key vorhanden."""
        if not self.api_key:
            return super().check_models()
        try:
            r = requests.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {self.api_key}"}, timeout=6)
            if r.ok:
                data = r.json().get("data", [])
                return [m.get("id") for m in data if m.get("id")]
        except Exception:
            pass
        return super().check_models()

    def generate_and_measure(self, prompt: str, model: str, timeout: int = 60) -> Dict:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0, "stream": True}
        t0 = time.perf_counter()
        try:
            with requests.post(url, headers=headers, json=payload, stream=True, timeout=timeout) as resp:
                resp.raise_for_status()
                text = ""
                ttft = None
                for line in resp.iter_lines(decode_unicode=True):
                    if not line:
                        continue
                    # OpenAI uses SSE style: lines like "data: {json}"
                    try:
                        s = line.decode() if isinstance(line, bytes) else line
                    except Exception:
                        s = line
                    if s.startswith("data:"):
                        body = s[len("data:"):].strip()
                        if body == "[DONE]":
                            break
                        try:
                            obj = json.loads(body)
                            # extract text delta
                            delta = obj.get("choices", [])[0].get("delta", {})
                            c = delta.get("content") or obj.get("choices", [])[0].get("text")
                            if c:
                                if ttft is None:
                                    ttft = time.perf_counter() - t0
                                text += c
                        except Exception:
                            # fallback - try to append body
                            if ttft is None:
                                ttft = time.perf_counter() - t0
                            text += body
                    else:
                        # sometimes the provider returns raw JSON per line
                        try:
                            obj = json.loads(s)
                            c = _first_text_from_chunk(obj)
                            if c:
                                if ttft is None:
                                    ttft = time.perf_counter() - t0
                                text += c
                        except Exception:
                            if ttft is None:
                                ttft = time.perf_counter() - t0
                            text += s
                total = time.perf_counter() - t0
                return {"text": text, "ttft_s": ttft or total, "total_time_s": total, "chars": len(text), "status": "ok", "error": ""}
        except Exception as e:
            total = time.perf_counter() - t0
            return {"text": "", "ttft_s": None, "total_time_s": total, "chars": 0, "status": "error", "error": str(e)}


class AnthropicClient(ProviderBase):
    name = "anthropic"

    def __init__(self):
        super().__init__()
        self.api_key = os.environ.get("ANTHROPIC_API_KEY")
        self.base = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip('/')

    def check_models(self) -> List[str]:
        if not self.api_key:
            return super().check_models()
        try:
            r = requests.get(f"{self.base}/v1/models", headers={"x-api-key": self.api_key}, timeout=6)
            if r.ok:
                data = r.json().get("models") or r.json().get("data")
                return [m.get("id") for m in data if isinstance(m, dict) and m.get("id")]
        except Exception:
            pass
        return super().check_models()

    def generate_and_measure(self, prompt: str, model: str, timeout: int = 60) -> Dict:
        url = f"{self.base}/v1/complete"
        headers = {"x-api-key": self.api_key, "Content-Type": "application/json"}
        payload = {"model": model, "prompt": prompt, "max_tokens_to_sample": 512, "stream": True}
        t0 = time.perf_counter()
        try:
            with requests.post(url, headers=headers, json=payload, stream=True, timeout=timeout) as resp:
                resp.raise_for_status()
                text = ""
                ttft = None
                for line in resp.iter_lines(decode_unicode=True):
                    if not line:
                        continue
                    try:
                        s = line.decode() if isinstance(line, bytes) else line
                    except Exception:
                        s = line
                    if s.startswith("data:"):
                        body = s[len("data:"):].strip()
                        if body == "[DONE]":
                            break
                        try:
                            obj = json.loads(body)
                            c = obj.get("completion") or _first_text_from_chunk(obj)
                            if c:
                                if ttft is None:
                                    ttft = time.perf_counter() - t0
                                text += c
                        except Exception:
                            if ttft is None:
                                ttft = time.perf_counter() - t0
                            text += body
                    else:
                        try:
                            obj = json.loads(s)
                            c = _first_text_from_chunk(obj)
                            if c:
                                if ttft is None:
                                    ttft = time.perf_counter() - t0
                                text += c
                        except Exception:
                            if ttft is None:
                                ttft = time.perf_counter() - t0
                            text += s
                total = time.perf_counter() - t0
                return {"text": text, "ttft_s": ttft or total, "total_time_s": total, "chars": len(text), "status": "ok", "error": ""}
        except Exception as e:
            total = time.perf_counter() - t0
            return {"text": "", "ttft_s": None, "total_time_s": total, "chars": 0, "status": "error", "error": str(e)}


class GenericHTTPClient(ProviderBase):
    name = "generic"

    def __init__(self, env_prefix: str):
        super().__init__()
        self.env_prefix = env_prefix.upper()
        self.base = os.environ.get(f"{self.env_prefix}_BASE_URL")
        self.api_key = os.environ.get(f"{self.env_prefix}_API_KEY")
        self.env_models = os.environ.get(f"{self.env_prefix}_MODELS")

    def check_models(self) -> List[str]:
        if self.base:
            # try /models
            try:
                r = requests.get(f"{self.base.rstrip('/')}/models", timeout=5)
                if r.ok:
                    j = r.json()
                    if isinstance(j, list):
                        return [m.get("id") or m.get("name") or str(m) for m in j]
            except Exception:
                pass
        return super().check_models()

    def generate_and_measure(self, prompt: str, model: str, timeout: int = 60) -> Dict:
        if not self.base:
            return {"text": "", "ttft_s": None, "total_time_s": 0, "chars": 0, "status": "error", "error": "no base URL configured"}
        # try some common endpoints
        candidates = ["/v1/complete", "/v1/chat/completions", "/generate", "/complete"]
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers.update({"Authorization": f"Bearer {self.api_key}"})
        for p in candidates:
            url = self.base.rstrip('/') + p
            payload = {"model": model, "prompt": prompt, "stream": True}
            t0 = time.perf_counter()
            try:
                with requests.post(url, headers=headers, json=payload, stream=True, timeout=timeout) as resp:
                    if not resp.ok:
                        continue
                    text = ""
                    ttft = None
                    for line in resp.iter_lines(decode_unicode=True):
                        if not line:
                            continue
                        try:
                            s = line.decode() if isinstance(line, bytes) else line
                        except Exception:
                            s = line
                        # try to parse JSON chunk
                        try:
                            obj = json.loads(s)
                            c = _first_text_from_chunk(obj)
                            if c:
                                if ttft is None:
                                    ttft = time.perf_counter() - t0
                                text += c
                        except Exception:
                            if ttft is None:
                                ttft = time.perf_counter() - t0
                            text += s
                    total = time.perf_counter() - t0
                    return {"text": text, "ttft_s": ttft or total, "total_time_s": total, "chars": len(text), "status": "ok", "error": ""}
            except Exception:
                continue
        return {"text": "", "ttft_s": None, "total_time_s": 0, "chars": 0, "status": "error", "error": "no usable endpoint responded"}
