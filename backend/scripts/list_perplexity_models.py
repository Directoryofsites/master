import requests
import sys

# La clave API se pasa como primer argumento
if len(sys.argv) < 2:
    print("Error: Debes proporcionar la clave API como primer argumento")
    sys.exit(1)

api_key = sys.argv[1]
print(f"Usando clave API: {api_key[:5]}...{api_key[-5:]}")

# URL de la API de Perplexity para listar modelos
api_url = "https://api.perplexity.ai/models"

# Encabezados para la solicitud
headers = {
    "accept": "application/json",
    "authorization": f"Bearer {api_key}"
}

# Hacer la solicitud
try:
    print("Consultando modelos disponibles en Perplexity API...")
    response = requests.get(api_url, headers=headers)
    print(f"Código de estado: {response.status_code}")
    
    # Imprimir la respuesta
    if response.status_code == 200:
        result = response.json()
        print("\nModelos disponibles:")
        for model in result['data']:
            print(f"- {model['id']}")
    else:
        print(f"Error en la respuesta: {response.text}")
        
except Exception as e:
    print(f"Error al conectar con la API: {str(e)}")