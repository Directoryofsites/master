import requests
import os
import sys

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

# Datos para la solicitud
data = {
    "model": "sonar",  # Modelo válido según la documentación de Perplexity
    "messages": [
       {
           "role": "system",
           "content": "Eres un asistente útil."
       },
       {
           "role": "user",
           "content": "Hola, ¿cómo estás?"
       }
   ],
   "temperature": 0.7,
   "max_tokens": 100
}

# Hacer la solicitud
try:
    print("Enviando solicitud a Perplexity API...")
    response = requests.post(api_url, headers=headers, json=data)
    print(f"Código de estado: {response.status_code}")
    
    # Imprimir la respuesta
    if response.status_code == 200:
        result = response.json()
        message = result['choices'][0]['message']['content']
        print(f"Respuesta de Perplexity: {message}")
    else:
        print(f"Error en la respuesta: {response.text}")
        
except Exception as e:
    print(f"Error al conectar con la API: {str(e)}")