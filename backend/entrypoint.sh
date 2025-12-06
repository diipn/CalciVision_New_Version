#!/bin/bash

echo "Script entrypoint.sh do backend iniciado."

echo "Aplicando as migrações do Django..."
python manage.py migrate --noinput

echo "Coletando arquivos estáticos..."
python manage.py collectstatic --noinput

echo "Iniciando o worker do Celery..."
celery -A backend worker --loglevel=INFO --concurrency=1 --pool=solo  &

echo "Worker do Celery em execução!"

echo "Iniciando o servidor ASGI Daphne (para WebSockets e Channels)"
daphne -b 0.0.0.0 -p 8001 backend.asgi:application &

echo "Iniciando o servidor de desenvolvimento do Django (para arquivos estáticos)"
python manage.py runserver 0.0.0.0:8000 &

echo "Container inicializado com sucesso!"

# Impede que o container se desligue depois de executar todos os comandos
tail -f /dev/null