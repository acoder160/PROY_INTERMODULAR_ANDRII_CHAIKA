import time
import random
import requests
from datetime import datetime

BASE_URL = "https://skatemap.onrender.com"

def get_random_endpoint():
    """
    Selecciona un endpoint de la API y genera parametros dinamicos 
    para simular una consulta de usuario real.
    """
    spot_id = random.randint(1, 10)
    
    # Generacion de coordenadas en el area de Pamplona con variacion aleatoria
    lat = round(random.uniform(42.7625, 42.8625), 6)
    lng = round(random.uniform(-1.6958, -1.5958), 6)

    endpoints = [
        "/api/spots",
        f"/api/spots/nearby?lat={lat}&lng={lng}&radius=5000",
        f"/api/spots/{spot_id}/my-rating",
        f"/api/spots/{spot_id}/comments"
    ]
    
    return random.choice(endpoints)

def main():
    """
    Punto de entrada principal. Controla la ventana horaria de ejecucion
    y gestiona la conexion con el host remoto.
    """
    # La ventana 06:00 - 24:00 UTC 
    now = datetime.now()
    
    if 6 <= now.hour <= 24:
        # Retraso aleatorio inicial (1 a 300 segundos) para evitar patrones fijos
        initial_delay = random.randint(1, 300)
        print(f"Instancia iniciada. Esperando {initial_delay}s para ejecucion asincrona...")
        time.sleep(initial_delay)

        endpoint = get_random_endpoint()
        url = f"{BASE_URL}{endpoint}"
        
        try:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Iniciando peticion GET: {url}")
            response = requests.get(url, timeout=30)
            print(f"Respuesta recibida - HTTP {response.status_code}")
            
        except requests.exceptions.RequestException as e:
            print(f"Fallo en la conexion: {e}")
    else:
        print(f"[{now.strftime('%H:%M:%S')} UTC] Fuera de ventana operativa. Abortando proceso.")

if __name__ == "__main__":
    main()