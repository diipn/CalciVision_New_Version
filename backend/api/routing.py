from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/model/(?P<task_id>[^/]+)/$', consumers.AlgorithmConsumer.as_asgi()),
]