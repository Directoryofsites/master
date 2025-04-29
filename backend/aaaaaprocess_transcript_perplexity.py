#!/usr/bin/env python
# process_transcript_perplexity.py

import os
import sys
import argparse
import requests
import json
import time

def process_transcript_with_perplexity(transcript_path, api_key, custom_prompt=None, output_path=None):
    """
    Procesa un archivo de transcripcion usando la API de Perplexity
    y guarda el resultado en un nuevo archivo.
    
    Args:
        transcript_path (str): Ruta del archivo de transcripcion
        api_key (str): API Key de Perplexity
        custom_prompt (str, optional): Prompt personalizado para la IA
        output_path (str, optional): Ruta para guardar el resultado
    
    Returns:
        str: Ruta del archivo de salida
    """
    # Verificar que el archivo de transcripcion existe
    if not os.path.exists(transcript_path):
        print(f"Error: El archivo {transcript_path} no existe")
        sys.exit(1)
    
    # Leer el contenido del archivo
    try:
        with open(transcript_path, 'r', encoding='utf-8') as file:
            transcript_content = file.read()
    except Exception as e:
        print(f"Error al leer el archivo: {e}")
        sys.exit(1)
    
    # Crear prompt si no se proporciona uno personalizado
    if not custom_prompt:
        custom_prompt = """
        Tienes una transcripcion de una asamblea que necesita ser formateada profesionalmente como un acta formal. 
        Por favor, organiza la informacion en el siguiente formato:
        
        # ACTA DE ASAMBLEA
        
        ## Fecha y Hora
        [Extrae la fecha y hora de la transcripcion o usa un formato como "Fecha: [fecha], Hora de inicio: [hora], Hora de finalizacion: [hora]"]
        
        ## Asistentes
        [Lista de participantes mencionados en la transcripcion]
        
        ## Orden del dia
        [Enumera los temas principales tratados]
        
        ## Desarrollo de la sesion
        [Resume los principales puntos discutidos, organizados por tema]
        
        ## Acuerdos y resoluciones
        [Detalla los acuerdos alcanzados]
        
        ## Cierre
        [Informacion sobre el cierre de la sesion]
        
        Usa un tono formal y profesional. No agregues informacion que no este presente en la transcripcion original.
        Formatea claramente los encabezados con markdown.
        
        Aqui esta la transcripcion:
        """
    
    # Preparar el prompt completo
    full_prompt = f"{custom_prompt}\n\n{transcript_content}"
    
    # Preparar la llamada a la API de Perplexity
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "model": "llama-3-sonar-small-32k-online",  # Modelo de Perplexity
        "messages": [
            {
                "role": "system",
                "content": "Eres un asistente experto en formatear transcripciones de reuniones en actas formales."
            },
            {
                "role": "user",
                "content": full_prompt
            }
        ],
        "temperature": 0.5,  # Valor mas bajo para resultados mas consistentes
        "max_tokens": 4000
    }
    
    # URL de la API de Perplexity
    api_url = "https://api.perplexity.ai/chat/completions"
    
    # Realizar la llamada a la API
    print("Llamando a la API de Perplexity...")
    try:
        response = requests.post(api_url, headers=headers, json=payload)
        response.raise_for_status()  # Lanzar excepcion si hay error HTTP
    except requests.exceptions.RequestException as e:
        print(f"Error al llamar a la API de Perplexity: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Codigo de estado: {e.response.status_code}")
            print(f"Respuesta: {e.response.text}")
        sys.exit(1)
    
    # Procesar la respuesta
    try:
        result = response.json()
        formatted_transcript = result['choices'][0]['message']['content']
    except (KeyError, json.JSONDecodeError) as e:
        print(f"Error al procesar la respuesta de la API: {e}")
        print(f"Respuesta recibida: {response.text}")
        sys.exit(1)
    
    # Determinar la ruta de salida si no se proporciona
    if not output_path:
        base_dir = os.path.dirname(transcript_path)
        base_name = os.path.splitext(os.path.basename(transcript_path))[0]
        output_path = os.path.join(base_dir, f"{base_name}_acta_formatada.txt")
    
    # Guardar la respuesta en un archivo
    try:
        with open(output_path, 'w', encoding='utf-8') as file:
            file.write(formatted_transcript)
        print(f"Acta formatada guardada en: {output_path}")
    except Exception as e:
        print(f"Error al guardar el archivo de salida: {e}")
        sys.exit(1)
    
    return output_path

def main():
    # Configurar el parser de argumentos
    parser = argparse.ArgumentParser(description='Procesa una transcripcion con la API de Perplexity')
    parser.add_argument('transcript_path', help='Ruta del archivo de transcripcion')
    parser.add_argument('--api_key', help='API Key de Perplexity')
    parser.add_argument('--prompt', help='Prompt personalizado para la IA')
    parser.add_argument('--output', help='Ruta para guardar el resultado')
    
    args = parser.parse_args()
    
    # Verificar API Key
    api_key = args.api_key or os.environ.get('PERPLEXITY_API_KEY')
    if not api_key:
        print("Error: Se requiere API Key de Perplexity. Proporcione --api_key o configure PERPLEXITY_API_KEY en las variables de entorno")
        sys.exit(1)
    
    # Procesar la transcripcion
    try:
        output_file = process_transcript_with_perplexity(
            args.transcript_path, 
            api_key,
            args.prompt,
            args.output
        )
        print(f"Procesamiento completado con exito. Archivo guardado en: {output_file}")
        sys.exit(0)
    except Exception as e:
        print(f"Error durante el procesamiento: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()