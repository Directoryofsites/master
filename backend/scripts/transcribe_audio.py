# Modificación al script original para que reciba parámetros por línea de comandos
import speech_recognition as sr
from pydub import AudioSegment
from pydub.utils import make_chunks
import os
import time
import sys
import codecs

def transcribe_audio_file(audio_path, start_fragment=0, end_fragment=None, chunk_length_ms=30000, language="es-ES"):
    """
    Transcribe un archivo de audio dividido en fragmentos pequeños
    Permite transcribir un rango específico de fragmentos
    """
    print(f"Procesando archivo: {audio_path}")
    start_time = time.time()
    
    # Crear carpeta para fragmentos temporales
    temp_folder = "temp_audio_chunks"
    if not os.path.exists(temp_folder):
        os.makedirs(temp_folder)
    
    # Cargar el archivo de audio
    print("Cargando archivo de audio...")
    try:
        file_extension = os.path.splitext(audio_path)[1].lower()
        
        if file_extension in ['.mp4', '.m4a']:
            sound = AudioSegment.from_file(audio_path, format="m4a")
            print("Archivo M4A/MP4 cargado correctamente")
        elif file_extension == '.mp3':
            sound = AudioSegment.from_mp3(audio_path)
            print("Archivo MP3 cargado correctamente")
        elif file_extension == '.wav':
            sound = AudioSegment.from_wav(audio_path)
            print("Archivo WAV cargado correctamente")
        else:
            sound = AudioSegment.from_file(audio_path)
            print(f"Archivo de formato {file_extension} cargado correctamente")
    except Exception as e:
        print(f"Error al cargar el archivo de audio: {e}")
        return ""
    
    # Obtener duración en segundos
    duration_s = len(sound) / 1000
    print(f"Duracion del audio: {duration_s:.2f} segundos ({duration_s/60:.2f} minutos)")
    
    # Dividir en fragmentos
    chunks = make_chunks(sound, chunk_length_ms)
    total_chunks = len(chunks)
    
    # Ajustar end_fragment si es None o mayor que el total de fragmentos
    if end_fragment is None or end_fragment > total_chunks:
        end_fragment = total_chunks
    
    print(f"Archivo dividido en {total_chunks} fragmentos de {chunk_length_ms/1000} segundos")
    print(f"Procesando desde el fragmento {start_fragment+1} hasta el {end_fragment}")
    
    # Inicializar reconocedor
    recognizer = sr.Recognizer()
    
    # Archivo para guardar la transcripción
    output_dir = os.path.dirname(audio_path)  # Directorio del archivo de audio
    output_basename = os.path.splitext(os.path.basename(audio_path))[0] + "_transcripcion.txt"
    output_file = os.path.join(output_dir, output_basename)  # Ruta completa
    
    # Verificar si estamos continuando una transcripción
    if start_fragment == 0:
        # Iniciar nuevo archivo con BOM UTF-8
        with codecs.open(output_file, "w", "utf-8-sig") as f:
            f.write("Transcripcion de: " + audio_path + "\n")
            f.write("Fecha: " + time.strftime('%Y-%m-%d %H:%M:%S') + "\n\n")
        all_text = ""
    else:
        # Leer el archivo existente para continuar
        try:
            with codecs.open(output_file, "r", "utf-8-sig") as f:
                content = f.read()
            print(f"Archivo de transcripcion existente encontrado. Continuando...")
            all_text = ""  # Reconstruiremos después
        except:
            print("No se encontro archivo previo o hubo un error al leerlo. Creando nuevo archivo.")
            with codecs.open(output_file, "w", "utf-8-sig") as f:
                f.write("Transcripcion de: " + audio_path + "\n")
                f.write("Fecha: " + time.strftime('%Y-%m-%d %H:%M:%S') + "\n\n")
            all_text = ""
    
    # Procesar fragmentos desde el punto de inicio hasta el punto final
    for i in range(start_fragment, end_fragment):
        # Guardar fragmento como WAV temporal
        chunk_name = os.path.join(temp_folder, f"chunk_{i}.wav")
        print(f"Procesando fragmento {i+1}/{total_chunks}...")
        chunks[i].export(chunk_name, format="wav")
        
        # Reconocimiento de voz
        try:
            with sr.AudioFile(chunk_name) as source:
                audio_data = recognizer.record(source)
                text = recognizer.recognize_google(audio_data, language=language)
                
                # Añadir texto al resultado
                all_text += text + " "
                
                # Guardar progreso parcial
                with codecs.open(output_file, "a", "utf-8-sig") as f:
                    f.write("[Fragmento " + str(i+1) + "] " + text + "\n\n")
                
                print(f"  - Fragmento {i+1} completado ({len(text)} caracteres)")
        except sr.UnknownValueError:
            print(f"  - No se pudo entender el audio en el fragmento {i+1}")
            with codecs.open(output_file, "a", "utf-8-sig") as f:
                f.write("[Fragmento " + str(i+1) + "] [No se pudo transcribir]\n\n")
        except sr.RequestError as e:
            print(f"  - Error en solicitud a la API: {e}")
            with codecs.open(output_file, "a", "utf-8-sig") as f:
                f.write("[Fragmento " + str(i+1) + "] [Error: " + str(e) + "]\n\n")
        except Exception as e:
            print(f"  - Error inesperado: {e}")
        
        # Eliminar archivo temporal
        try:
            os.remove(chunk_name)
        except:
            pass
    
    # Solo reconstruimos la transcripción completa si hemos llegado al final
    if end_fragment == total_chunks:
        try:
            with codecs.open(output_file, "r", "utf-8-sig") as f:
                content = f.read()
            
            # Eliminar la sección de transcripción completa si existe
            if "--- TRANSCRIPCION COMPLETA ---" in content:
                content = content.split("--- TRANSCRIPCION COMPLETA ---")[0]
            
            # Extraer todas las partes de texto de los fragmentos
            import re
            fragments = re.findall(r'\[Fragmento \d+\] (.*?)(?=\n\n|\Z)', content, re.DOTALL)
            reconstructed_text = " ".join([f for f in fragments if not f.startswith("[No se pudo") and not f.startswith("[Error:")])
            
            # Añadir la transcripción completa al final
            with codecs.open(output_file, "a", "utf-8-sig") as f:
                f.write("\n\n--- TRANSCRIPCION COMPLETA ---\n\n")
                f.write(reconstructed_text)
            
            print("\nSe ha generado la transcripcion completa")
        except Exception as e:
            print(f"Error al reconstruir la transcripcion completa: {e}")
    else:
        print("\nProceso parcial completado. No se ha generado la transcripcion completa aun.")
    
    total_time = time.time() - start_time
    print(f"\nProceso completado en {total_time:.2f} segundos")
    print(f"Transcripcion guardada en: {output_file}")
    
    # Limpiar carpeta temporal
    try:
        os.rmdir(temp_folder)
    except:
        pass
    
    return all_text

if __name__ == "__main__":
    # Verificar si se proporcionó un argumento de línea de comandos
    if len(sys.argv) > 1:
        # Usar el primer argumento como ruta del archivo de audio
        archivo_audio = sys.argv[1]
        
        # Verificar si la ruta existe
        if not os.path.exists(archivo_audio):
            print(f"Error! El archivo {archivo_audio} no existe.")
            sys.exit(1)
        else:
            # Transcribir con parámetros predeterminados
            transcribe_audio_file(
                archivo_audio, 
                start_fragment=0, 
                end_fragment=None, 
                chunk_length_ms=30000, 
                language="es-ES"
            )
            sys.exit(0)
    else:
        # Si no hay argumentos, solicitar la ruta al usuario
        archivo_audio = input("Introduce la ruta completa del archivo de audio (mp4, m4a, mp3, wav): ")
        
        # Verificar si la ruta existe
        if not os.path.exists(archivo_audio):
            print(f"Error! El archivo {archivo_audio} no existe.")
        else:
            # Solicitar fragmento de inicio
            try:
                fragmento_inicio = int(input("Desde que fragmento deseas comenzar? (0 para inicio): "))
            except:
                fragmento_inicio = 0
            
            # Solicitar fragmento final
            try:
                fragmento_fin_input = input("Hasta que fragmento deseas procesar? (deja en blanco para procesar hasta el final): ")
                fragmento_fin = int(fragmento_fin_input) if fragmento_fin_input.strip() else None
            except:
                fragmento_fin = None
            
            # Solicitar el idioma
            codigo_idioma = input("Introduce el codigo del idioma (es-ES para espanol, en-US para ingles, deja en blanco para espanol): ")
            if not codigo_idioma:
                codigo_idioma = "es-ES"
            
            # Transcribir
            transcribe_audio_file(archivo_audio, 
                                start_fragment=fragmento_inicio, 
                                end_fragment=fragmento_fin, 
                                chunk_length_ms=30000, 
                                language=codigo_idioma)