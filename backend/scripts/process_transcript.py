import os
import sys
import argparse
import requests
import json

def process_with_chatgpt(transcript_file, openai_key, custom_prompt=None):
    """
    Procesa un archivo de transcripción con ChatGPT usando un prompt personalizado
    """
    # Leer el archivo de transcripción
    try:
        with open(transcript_file, 'r', encoding='utf-8') as f:
            transcript_text = f.read()
    except Exception as e:
        print(f"Error al leer el archivo de transcripción: {e}")
        return False
    
    # Extraer la sección de transcripción completa
    try:
        if "--- TRANSCRIPCION COMPLETA ---" in transcript_text:
            transcript_content = transcript_text.split("--- TRANSCRIPCION COMPLETA ---")[1].strip()
        else:
            transcript_content = transcript_text
    except Exception as e:
        print(f"Error al extraer la transcripción completa: {e}")
        transcript_content = transcript_text
    
    # Crear el prompt para ChatGPT
    if not custom_prompt:
        custom_prompt = """
        Por favor, mejora esta transcripción de audio:
        1. Corrige errores gramaticales y ortográficos
        2. Añade puntuación apropiada
        3. Organiza el texto en párrafos coherentes
        4. Mantén todo el contenido original
        """
    
    # Mensaje completo para enviar a ChatGPT
    messages = [
        {"role": "system", "content": custom_prompt},
        {"role": "user", "content": transcript_content}
    ]
    
    # Configurar la llamada a la API
    api_url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {openai_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "gpt-4",  # Puedes ajustar el modelo según tus necesidades
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 4000
    }
    
    # Llamar a la API de OpenAI
    try:
        response = requests.post(api_url, headers=headers, data=json.dumps(data))
        if response.status_code == 200:
            result = response.json()
            improved_text = result["choices"][0]["message"]["content"]
            
            # Crear nombre para el archivo mejorado
            output_file = os.path.splitext(transcript_file)[0] + "_mejorado.txt"
            
            # Guardar el texto mejorado
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write("--- TRANSCRIPCIÓN ORIGINAL ---\n\n")
                f.write(transcript_content)
                f.write("\n\n--- TRANSCRIPCIÓN MEJORADA CON IA ---\n\n")
                f.write(improved_text)
            
            print(f"Transcripción mejorada guardada en: {output_file}")
            return output_file
        else:
            print(f"Error al llamar a la API de OpenAI: {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print(f"Error en la llamada a ChatGPT: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Procesa transcripciones con ChatGPT')
    parser.add_argument('transcript_file', help='Ruta al archivo de transcripción')
    parser.add_argument('--api_key', help='API Key de OpenAI', required=True)
    parser.add_argument('--prompt', help='Prompt personalizado para ChatGPT')
    
    args = parser.parse_args()
    
    process_with_chatgpt(args.transcript_file, args.api_key, args.prompt)