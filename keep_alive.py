"""
Mantiene despierto el servicio gratuito de Render (se duerme tras 15 min sin peticiones).

Un solo proceso hace peticiones GET ligeras y publicas a intervalos aleatorios de 4-11 min
durante MAX_RUNTIME segundos. El workflow de GitHub Actions lo relanza cada 3 horas y cancela
la ejecucion anterior, asi que siempre hay exactamente un bucle activo aunque el cron se retrase.

Variables de entorno:
  RENDER_URL   URL base del API (por defecto https://skatemap.onrender.com)
  MAX_RUNTIME  segundos que dura el bucle (por defecto 5 h 40 min)
"""
import os
import random
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE_URL = os.environ.get("RENDER_URL", "https://skatemap.onrender.com").rstrip("/")
MAX_RUNTIME = int(os.environ.get("MAX_RUNTIME", str(5 * 3600 + 40 * 60)))
MIN_PAUSE, MAX_PAUSE = 240, 660  # siempre por debajo de los 15 min de Render
TIMEOUT = 120  # un arranque en frio de Spring Boot en Render tarda ~60 s o mas

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
]


def random_endpoint():
    """Endpoint GET publico y ligero, con parametros aleatorios."""
    spot_id = random.randint(1, 30)
    lat = round(random.uniform(42.7625, 42.8625), 6)  # alrededores de Pamplona
    lng = round(random.uniform(-1.6958, -1.5958), 6)
    dist = random.choice([1000, 2000, 3000, 5000])
    return random.choice([
        "/actuator/health",
        f"/api/spots/nearby?lat={lat}&lng={lng}&dist={dist}",
        f"/api/spots/{spot_id}",
        f"/api/spots/{spot_id}/comments?limit=10",
    ])


def now():
    return datetime.now(timezone.utc).strftime("%H:%M:%S")


def ping(url):
    """Devuelve el codigo HTTP (o None si no hubo respuesta)."""
    req = urllib.request.Request(url, headers={
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "application/json",
    })
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            resp.read()
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code  # 404 de un spot inexistente tambien despierta el servicio
    except Exception as e:  # timeout, DNS, conexion
        print(f"[{now()}] {url} -> error: {e}", flush=True)
        return None
    print(f"[{now()}] {url} -> HTTP {status} en {time.monotonic() - started:.1f}s", flush=True)
    return status


def main():
    deadline = time.monotonic() + MAX_RUNTIME
    print(f"Keep-alive para {BASE_URL} durante {MAX_RUNTIME // 60} min", flush=True)
    while True:
        status = ping(BASE_URL + random_endpoint())
        if status is None or status >= 500:
            time.sleep(30)
            ping(BASE_URL + "/actuator/health")

        pause = random.uniform(MIN_PAUSE, MAX_PAUSE)
        if time.monotonic() + pause > deadline:
            break
        print(f"    siguiente en {pause / 60:.1f} min", flush=True)
        time.sleep(pause)
    print(f"[{now()}] Fin del bucle; el siguiente lo lanza el cron.", flush=True)


if __name__ == "__main__":
    main()
