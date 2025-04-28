# check_dependencies.py
try:
    import speech_recognition
    print("✓ speech_recognition está instalado correctamente")
except ImportError:
    print("✗ speech_recognition NO está instalado")
    print("  Instálalo con: pip install SpeechRecognition")

try:
    import pydub
    print("✓ pydub está instalado correctamente")
except ImportError:
    print("✗ pydub NO está instalado")
    print("  Instálalo con: pip install pydub")

# Verificar dependencias adicionales para pydub
if 'pydub' in locals():
    print("\nVerificando dependencias para conversión de archivos MP3:")
    import subprocess
    import shutil
    
    # Verificar FFmpeg
    ffmpeg_installed = shutil.which('ffmpeg') is not None
    print(f"{'✓' if ffmpeg_installed else '✗'} FFmpeg: {'Instalado' if ffmpeg_installed else 'NO instalado'}")
    if not ffmpeg_installed:
        print("  Necesitas instalar FFmpeg: https://ffmpeg.org/download.html")