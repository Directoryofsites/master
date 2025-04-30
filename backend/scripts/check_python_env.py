#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Script para verificar el entorno de Python y sus dependencias.
Utilizado para diagnosticar problemas en Railway.
"""

import sys
import os
import platform

def check_dependencies():
    """Verificar dependencias instaladas y sus versiones."""
    print("=== VERIFICACIÓN DE DEPENDENCIAS PYTHON ===")
    print(f"Python versión: {sys.version}")
    print(f"Sistema operativo: {platform.system()} {platform.release()}")
    print(f"Directorio de trabajo: {os.getcwd()}")
    print(f"Path de Python: {sys.executable}")
    
    # Lista de dependencias a verificar
    dependencies = [
        "python-docx", "requests", "openai"
    ]
    
    for dep in dependencies:
        try:
            module = __import__(dep.replace("-", "_"))
            print(f"✓ {dep}: {getattr(module, '__version__', 'Instalado (versión desconocida)')}")
        except ImportError:
            print(f"✗ {dep}: No instalado")
    
    # Verificar variables de entorno importantes
    print("\n=== VARIABLES DE ENTORNO ===")
    env_vars = ["PERPLEXITY_API_KEY", "RAILWAY_PROJECT_ID", "PATH"]
    for var in env_vars:
        value = os.environ.get(var)
        if value:
            if var.endswith("_KEY") or var.endswith("_SECRET"):
                print(f"{var}: [PROTEGIDO]")
            else:
                print(f"{var}: {value[:50]}{'...' if len(value) > 50 else ''}")
        else:
            print(f"{var}: No definido")

if __name__ == "__main__":
    check_dependencies()
    print("\nDiagnóstico completado.")