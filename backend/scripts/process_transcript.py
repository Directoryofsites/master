import os
import sys
import argparse
import requests
import json
import time

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
    
    # Definir el prompt para asambleas si no se proporciona uno personalizado
    if not custom_prompt:
        custom_prompt = """# 🧭 PROMPT MAESTRO MEJORADO PARA RESUMIR Y FORMATEAR ACTAS DE ASAMBLEAS

🔹 **OBJETIVO DEL PROMPT:**

Transformar el contenido de una reunión de asamblea de miembros (en formato de acta, minuta, grabación de audio o transcripción) en un **resumen narrativo, estructurado, exhaustivo y perfectamente formateado**, de modo que cualquier miembro (presente o ausente) pueda:

-   Conocer los temas tratados.
-   Entender claramente los argumentos discutidos.
-   Saber las decisiones tomadas.
-   Identificar los acuerdos alcanzados.
-   Tener registro de los puntos pendientes.
-   Visualizar las firmas de validación.

Todo presentado en un **documento formal, elegante, ordenado y fiel** al desarrollo real de la reunión.

📝 **INSTRUCCIONES GENERALES:**

-   **Fidelidad absoluta:** No interpretar, añadir ni embellecer el contenido. Respetar hechos, tonos y acuerdos reales.
-   **Redacción clara, directa y formal:** Narrativa fluida en pasado. Sin tecnicismos innecesarios. Sin frases impersonales ("se dice...", "se comenta..."), sino activa y concreta.
-   **Máxima organización narrativa:** Seguir la secuencia lógica de la reunión pero agrupando la información para mejor comprensión.
-   **Contexto y claridad:** Sintetizar, explicar y narrar cada tema con lógica, sin copiar literalmente.
-   **Tono profesional:** Reflejar el ambiente real (cordialidad, tensión, consenso, debate).
-   **Formato obligatorio:** El acta debe entregarse SIEMPRE siguiendo la estructura visual que se describe abajo.

🔧 **FORMATO DE ENTREGA OBLIGATORIO:**

Cada acta/resumen debe estar organizada así:

# 📄 ACTA DE LA ASAMBLEA GENERAL -- [Nombre de la Organización]

## 📅 Fecha: [Fecha] | 🕒 Hora de Inicio: [Hora] | 📍 Modalidad: [Presencial / Virtual / Híbrida]

👤 **Presidente de la Asamblea:** [Nombre]
✍️ **Secretario de Actas:** [Nombre]
👥 **Número de miembros presentes:** [Cantidad]
✅ **Quórum verificado:** [Sí/No]
🕓 **Hora de Cierre:** [Hora]

## ✨ Introducción

[Redacción narrativa que explique el propósito general de la asamblea, motivos de la convocatoria, expectativas, y clima general.]

## 📌 Temas Tratados

### 📌 Tema 1: [Título del Tema]

**Presentación:**
[Quién lo presentó y explicación breve.]

**Debate:**
[Argumentos expuestos a favor y en contra, observaciones, tonos, emociones.]

**Decisión:**
[Conclusión o resolución alcanzada.]

*(Repetir para Tema 2, Tema 3, etc.)*

## 🔥 Temas Controvertidos

[Resumen especial de los temas que causaron más debate, las posturas enfrentadas, emociones expresadas y forma de resolución.]

## 📋 Acuerdos Finales

-   **Acuerdo 1:** [Contenido claro del acuerdo. Responsable. Plazo o fecha de implementación.]
-   **Acuerdo 2:** [Contenido claro. Responsable. Plazo.]
-   *(Y así sucesivamente.)*

## ⏳ Pendientes para Próxima Reunión

-   [Descripción breve de temas pendientes. Motivo de la postergación. Fecha tentativa si aplica.]

## 🎯 Cierre y Reflexión Final

[Descripción narrativa del cierre: valoración del ambiente, avances logrados, mensaje final del presidente o secretario.]

📎 **Apéndice (Opcional): Intervenciones Relevantes**

*(Solo si se detectan participaciones o argumentos especialmente influyentes. Se presentan máximo 3-5 paráfrasis o citas relevantes.)*

## ✍️ FIRMAS

Presidente de la Asamblea:

**[Nombre del Presidente]**

Secretario de Actas:

**[Nombre del Secretario]**

Nota importante: el acta debe terminar con las firmas. Es lo último.

✅ **REGLAS DE ORO INNEGOCIABLES:**

-   **Nunca ignores un acuerdo o pendiente**, aunque parezca menor.
-   **No inflar ni dramatizar**: reflejar solo lo realmente ocurrido.
-   **No usar lenguaje jurídico innecesario.**
-   **Siempre escribir en pasado narrativo.**
-   **Siempre entregar el acta en el formato de secciones formales como arriba.**
-   **Siempre incluir la sección de firmas al final, aunque no haya datos de firmantes.**
-   **Hacer que el lector pueda imaginar que estuvo en la reunión.**

A continuación te presento una transcripción que debes transformar según estas instrucciones. Mantén todas las reglas descritas anteriormente y sigue el formato especificado.
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
    "model": "gpt-3.5-turbo",
    "messages": messages,
    "temperature": 0.7,
    "max_tokens": 2000  # Reducir a 2000 para tener menos carga
}
    
    # Llamar a la API de OpenAI con reintentos
    max_retries = 5
    retry_delay = 10  # segundos
    
    for attempt in range(max_retries):
        try:
            response = requests.post(api_url, headers=headers, data=json.dumps(data))
            if response.status_code == 200:
                result = response.json()
                improved_text = result["choices"][0]["message"]["content"]
                
                # Crear nombre para el archivo mejorado
                base_name = os.path.basename(transcript_file)
                dir_name = os.path.dirname(transcript_file)
                output_file_name = os.path.splitext(base_name)[0] + "_acta_formatada.txt"
                output_file = os.path.join(dir_name, output_file_name)
                
                # Guardar el texto mejorado
                with open(output_file, 'w', encoding='utf-8') as f:
                    f.write(improved_text)
                
                print(f"Acta formateada guardada en: {output_file}")
                return output_file
            elif response.status_code == 429:  # Rate limit exceeded
                if attempt < max_retries - 1:
                    print(f"Límite de tasa excedido. Reintentando en {retry_delay} segundos...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Backoff exponencial
                else:
                    print("Excedido el número máximo de reintentos.")
                    return False
            else:
                print(f"Error al llamar a la API de OpenAI: {response.status_code}")
                print(response.text)
                return False
        except Exception as e:
            print(f"Error en la llamada a ChatGPT: {e}")
            if attempt < max_retries - 1:
                print(f"Reintentando en {retry_delay} segundos...")
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Procesa transcripciones con ChatGPT para formatear actas de asambleas')
    parser.add_argument('transcript_file', help='Ruta al archivo de transcripción')
    parser.add_argument('--api_key', help='API Key de OpenAI', required=True)
    parser.add_argument('--prompt', help='Prompt personalizado para ChatGPT')
    parser.add_argument('--output', help='Ruta de salida para el archivo formateado')
    
    args = parser.parse_args()
    
    result_file = process_with_chatgpt(args.transcript_file, args.api_key, args.prompt)
    if result_file and args.output:
        # Si se especificó una ruta de salida, actualizar el nombre del archivo
        try:
            import shutil
            shutil.copy(result_file, args.output)
            print(f"Archivo copiado a: {args.output}")
        except Exception as e:
            print(f"Error al copiar el archivo a la ruta especificada: {e}")
    
    sys.exit(0 if result_file else 1)