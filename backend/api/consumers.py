from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.conf import settings
from .utils import get_screening_progress_key
import redis
import json
import logging
import asyncio

logger = logging.getLogger(__name__)

class AlgorithmConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        
        # Obtém o task_id da URL
        self.task_id = self.scope['url_route']['kwargs']['task_id']
        
        # O nome do grupo corresponde ao id da task do Celery
        self.group_name = f"task_{self.task_id}"
        
        # Adiciona o WebSocket ao grupo
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        
        # Aceita a conexão WebSocket
        await self.accept()
        
        logger.info(f"WebSocket conectado ao grupo {self.group_name}")
        self._poll_task = asyncio.create_task(self._poll_progress())
    
    async def disconnect(self, close_code):
        # Remove o WebSocket do grupo ao desconectar
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if hasattr(self, "_poll_task"):
            self._poll_task.cancel()
        logger.info(f"WebSocket desconectado do grupo {self.group_name}")
    
    async def send_update(self, event):
        # Envia a mensagem recebido do grupo para o frontend
        logger.info(f"WebSocket send_update {self.group_name}: {event.get('data', {})}")
        await self.send(text_data=json.dumps(event['data']))
        
    async def receive(self, text_data):
        """
        Manipula mensagens recebidas do frontend via WebSocket.

        Responde ao tipo 'get_status' buscando o progresso da task no Redis
        (chave 'screening_progress:task_<uuid>') e enviando imediatamente o estado atual
        de volta ao frontend. Isso permite que o frontend obtenha o progresso do screening
        mais recente sob demanda.

        Args:
            text_data (str): Mensagem recebida do frontend (JSON).
        """
        data: dict = json.loads(text_data)
        if data.get("type") == "get_status":
            r = redis.Redis.from_url(settings.REDIS_URL)
            data = r.get(get_screening_progress_key(self.task_id))
            if data:
                await self.send(text_data=data)
                return
            # Caso não haja progresso salvo, nada é enviado (poderia ser customizado)

    async def _poll_progress(self):
        r = redis.Redis.from_url(settings.REDIS_URL)
        last_payload = None
        while True:
            try:
                payload = r.get(get_screening_progress_key(self.task_id))
                if payload and payload != last_payload:
                    await self.send(text_data=payload)
                    last_payload = payload
                    try:
                        parsed = json.loads(payload)
                        status = parsed.get("status")
                        if status in ("done", "error"):
                            return
                    except json.JSONDecodeError:
                        pass
                await asyncio.sleep(0.3)
            except asyncio.CancelledError:
                return
