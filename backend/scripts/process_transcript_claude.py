import os
import sys
import argparse
import json
import time
import anthropic

def process_with_claude(transcript_file, anthropic_key, custom_prompt=None):
    """
    Procesa un archivo de transcripción con Claude usando un prompt personalizado
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
    
    # Crear el prompt para Claude
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

A continuación te presento una transcripción que debes transformar según estas instrucciones.
"""
    
    # Configurar el cliente de Claude
    client = anthropic.Anthropic(api_key=anthropic_key)
    
    # Mensaje completo para enviar a Claude
    system_prompt = custom_prompt
    user_prompt = transcript_content
    
    # Llamar a la API de Claude con reintentos
    max_retries = 3
    retry_delay = 5  # segundos
    
    for attempt in range(max_retries):
        try:
            print(f"Llamando a la API de Claude (intento {attempt+1}/{max_retries})...")
            
            # Crear la solicitud a Claude
            response = client.messages.create(
                model="claude-3-sonnet-20240229",  # Puedes ajustar al modelo adecuado
                max_tokens=4000,
                temperature=0.5,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            # Extraer el contenido de la respuesta
            improved_text = response.content[0].text
            
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
        
        except Exception as e:
            print(f"Error en la llamada a Claude: {e}")
            if attempt < max_retries - 1:
                print(f"Reintentando en {retry_delay} segundos...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Backoff exponencial
            else:
                print("Excedido el número máximo de reintentos.")
                return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Procesa transcripciones con Claude para formatear actas de asambleas')
    parser.add_argument('transcript_file', help='Ruta al archivo de transcripción')
    parser.add_argument('--api_key', help='API Key de Anthropic', required=True)
    parser.add_argument('--prompt', help='Prompt personalizado para Claude')
    parser.add_argument('--output', help='Ruta de salida para el archivo formateado')
    
    args = parser.parse_args()
    
    result_file = process_with_claude(args.transcript_file, args.api_key, args.prompt)
    if result_file and args.output:
        # Si se especificó una ruta de salida, actualizar el nombre del archivo
        try:
            import shutil
            shutil.copy(result_file, args.output)
            print(f"Archivo copiado a: {args.output}")
        except Exception as e:
            print(f"Error al copiar el archivo a la ruta especificada: {e}")
    
    sys.exit(0 if result_file else 1)