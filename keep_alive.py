"""
Mantiene despierto el servicio gratuito de Render (se duerme tras 15 min sin peticiones).

Un solo proceso hace peticiones GET ligeras y publicas a intervalos aleatorios de 4-10 min
durante MAX_RUNTIME segundos. Al terminar, el workflow de GitHub Actions lanza la siguiente
ejecucion (cadena) y el cron horario la retoma si alguna vez se corta (ver keep_alive.yml).

- La ultima peticion se hace justo al final del bucle, asi el hueco hasta la primera peticion de
  la siguiente ejecucion es solo lo que tarda en arrancar el runner (segundos), no hasta 11 min.
- Si una peticion falla (servicio arrancando o caido) se reintenta cada 30 s en vez de esperar
  a la siguiente pausa larga.
- Si al final el servicio lleva un buen rato sin responder, el proceso termina con codigo 1 para
  que la ejecucion salga en rojo en GitHub (la cadena sigue igualmente).

Variables de entorno:
  RENDER_URL   URL base del API (por defecto https://skatemap.onrender.com)
  MAX_RUNTIME  segundos que dura el bucle (por defecto 5 h 40 min)
"""
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE_URL = os.environ.get("RENDER_URL", "https://skatemap.onrender.com").rstrip("/")
MAX_RUNTIME = int(os.environ.get("MAX_RUNTIME", str(5 * 3600 + 40 * 60)))
MIN_PAUSE, MAX_PAUSE = 240, 600  # muy por debajo de los 15 min de Render, aunque una peticion tarde
RETRY_PAUSE = 30
TIMEOUT = 120  # un arranque en frio de Spring Boot en Render tarda ~60 s o mas
FAILED_TO_REPORT = 6  # tantos fallos seguidos al final (~15 min sin respuesta) = ejecucion en rojo

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
        print(f"[{now()}] {url} -> sin respuesta en {time.monotonic() - started:.0f}s: {e}", flush=True)
        return None
    print(f"[{now()}] {url} -> HTTP {status} en {time.monotonic() - started:.1f}s", flush=True)
    return status


def is_up(status):
    return status is not None and status < 500


def main():
    deadline = time.monotonic() + MAX_RUNTIME
    print(f"Keep-alive para {BASE_URL} durante {MAX_RUNTIME // 60} min", flush=True)
    failures = 0
    while True:
        status = ping(BASE_URL + random_endpoint())
        # Caido o arrancando: reintentar a menudo (sin pasarse del final del bucle)
        while not is_up(status):
            failures += 1
            if time.monotonic() >= deadline:
                break
            time.sleep(RETRY_PAUSE)
            status = ping(BASE_URL + "/actuator/health")
        if is_up(status):
            failures = 0

        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        # La ultima pausa se recorta para que la ultima peticion caiga justo al final
        pause = min(random.uniform(MIN_PAUSE, MAX_PAUSE), remaining)
        print(f"    siguiente en {pause / 60:.1f} min", flush=True)
        time.sleep(pause)

    if failures >= FAILED_TO_REPORT:
        print(f"[{now()}] El servicio no responde ({failures} fallos seguidos). Revisar Render.", flush=True)
        sys.exit(1)
    print(f"[{now()}] Fin del bucle; la siguiente ejecucion la lanza el workflow.", flush=True)


if __name__ == "__main__":
    main()
