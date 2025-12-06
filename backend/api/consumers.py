from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.conf import settings
import redis
import json
import logging

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
    
    async def disconnect(self, close_code):
        # Remove o WebSocket do grupo ao desconectar
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
    
    async def send_update(self, event):
        # Envia a mensagem recebido do grupo para o frontend
        await self.send(text_data=json.dumps(event['data']))
        
    async def receive(self, text_data):
        """
        Manipula mensagens recebidas do frontend via WebSocket.

        Responde ao tipo 'get_status' buscando o progresso da task no Redis
        (chave 'screening_progress:{task_id}') e enviando imediatamente o estado atual
        de volta ao frontend. Isso permite que o frontend obtenha o progresso do screening
        mais recente sob demanda.

        Args:
            text_data (str): Mensagem recebida do frontend (JSON).
        """
        data: dict = json.loads(text_data)
        if data.get("type") == "get_status":
            r = redis.Redis.from_url(settings.REDIS_URL)
            data = r.get(f"screening_progress:{self.task_id}")
            if data:
                await self.send(text_data=data)
                return
            # Caso não haja progresso salvo, nada é enviado (poderia ser customizado)
