import requests
import sys
import json

# La clave API se pasa como primer argumento
if len(sys.argv) < 2:
    print("Error: Debes proporcionar la clave API como primer argumento")
    sys.exit(1)

api_key = sys.argv[1]
print(f"Usando clave API: {api_key[:5]}...{api_key[-5:]}")

# URL de la API de Perplexity
api_url = "https://api.perplexity.ai/chat/completions"

# Encabezados para la solicitud
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    "authorization": f"Bearer {api_key}"
}

# Intentar con modelo incorrecto a propósito para ver el mensaje de error completo
data = {
    "model": "INCORRECT_MODEL_NAME",
    "messages": [
        {
            "role": "system",
            "content": "Eres un asistente útil."
        },
        {
            "role": "user",
            "content": "¿Qué modelos están disponibles?"
        }
    ]
}

# Hacer la solicitud
try:
    print("Enviando solicitud a Perplexity API con modelo incorrecto para ver el error completo...")
    response = requests.post(api_url, headers=headers, json=data)
    print(f"Código de estado: {response.status_code}")
    
    # Formatear y mostrar la respuesta completa
    if response.text:
        try:
            json_response = json.loads(response.text)
            print("Respuesta completa:")
            print(json.dumps(json_response, indent=2))
        except:
            print(f"Texto de respuesta sin formato: {response.text}")
    else:
        print("No se recibió respuesta")
        
except Exception as e:
    print(f"Error al conectar con la API: {str(e)}")