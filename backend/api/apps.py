from django.apps import AppConfig
from typing import Optional
import onnxruntime as ort
import os
import tensorflow as tf
from keras.utils import CustomObjectScope
import logging

logger = logging.getLogger(__name__)

# Usar um carregador singleton (uma única instância por worker Celery) para carregar o modelo
# Carregar o modelo em todas as tasks Celery consome memória desnecessária.
class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
    _yolo_model: Optional[ort.InferenceSession] = None
    _keras_model: Optional[tf.keras.Model] = None
    
    # Importa o signals.py na app
    def ready(self):
        import api.signals
    
    @property
    def yolo_model(self) -> ort.InferenceSession:
        if self._yolo_model is None:
            self._yolo_model = ort.InferenceSession(
                os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ai_models', 'valve', 'best.onnx'),
                providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
            )
        return self._yolo_model
    
    @property
    def keras_model(self) -> tf.keras.Model:
        if self._keras_model is None:
            self._keras_model = tf.keras.models.load_model(
                os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ai_models', 'calcium')
            )
        
        tf.keras.backend.set_floatx('float32') # Reduz precisão se possível 
        return self._keras_model
