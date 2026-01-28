from celery import Task, chain, shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.apps import apps
from django.conf import settings
from api.apps import ApiConfig
from .utils import set_screening_progress

import tensorflow as tf
from PIL import Image
import numpy as np
import logging
import base64
import cv2
import io

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, soft_time_limit=30, time_limit=60)
def run_calcium_model(self: Task, data: dict):
    logger.info('Calcification Analysis Starting')
    
    channel_layer = get_channel_layer()
    app_config: ApiConfig = apps.get_app_config('api')
    
    cropped_bytes = data['image_bytes']
    group_name = data.get('group_name', f'task_{self.request.id}')
    image_name = data.get('image_name')
    bbox = data.get('bbox')
    chain_context = data.get('chain_context')
    
    is_chain = bool(chain_context)
    
    try:
        # FASE 1 : PREPARAR OS DADOS
        
        if is_chain:
            update_status(
                self, 
                channel_layer, 
                group_name, 
                image_name=image_name,
                status='PROGRESS', 
                progress=int(100 * ((2 * chain_context['step'] - 1)/chain_context['steps']) / 2), 
                phase='Detecting calcium in the identified area', 
            )
        else:
            update_status(self, channel_layer, group_name, image_name=image_name, status='PROGRESS', progress=15, phase='Preprocessing the input data')
        
        if cropped_bytes is None:
            raise ValueError("No image bytes received from previous task.")
        
        image = Image.open(io.BytesIO(cropped_bytes))
        image = image.resize((224, 224))
            
        image = np.array(image) / 255.0  # Normalizar os valores para [0,1]
        image = np.expand_dims(image, axis=0)  # Adicionar dimensão do batch
        
        # FASE 2: CARREGAR O MODELO
        
        if not is_chain:
            update_status(self, channel_layer, group_name, image_name=image_name, status='PROGRESS', progress=40, phase='Loading the model')
        
        keras_model = app_config.keras_model

        # FASE 3: FAZER PREVISÕES
        
        if not is_chain:
            update_status(self, channel_layer, group_name, image_name=image_name, status='PROGRESS', progress=75, phase='Detecting calcium in the identified area')
        
        prediction = keras_model.predict(image)
        
        chain_results = {
            'image_bytes': cropped_bytes,
            'results': {
                'is_calcified': int(prediction[0][0] > 0.5),  # 0 ou 1
                'x1': bbox[0] if bbox else None,
                'y1': bbox[1] if bbox else None,
                'x2': bbox[2] if bbox else None,
                'y2': bbox[3] if bbox else None,
            },
            'image_name': image_name,
            'group_name': group_name,
            'chain_context': { 'step': 2, 'steps': chain_context['steps'] }
        }

        ws_results = {
            'binary_classification': int(prediction[0][0] > 0.5),  # 0 ou 1
            'classification': float(prediction[0][0]),  # Probabilidade bruta
            'confidence': f"{float(prediction[0][0])*100:.2f}%",  # Porcentagem
            'is_calcification_generated': 1,
            'bbox': {
                'x1': bbox[0] if bbox else None,
                'y1': bbox[1] if bbox else None,
                'x2': bbox[2] if bbox else None,
                'y2': bbox[3] if bbox else None,
            }
        }

        if is_chain:
            update_status(
                self, 
                channel_layer, 
                group_name, 
                image_name=image_name,
                status='SUCCESS' if chain_context['step']/chain_context['steps'] == 1.0 else 'PROGRESS', 
                progress=int(100 * (chain_context['step']/chain_context['steps'])), 
                phase='Detecting calcium in the identified area', 
                results=ws_results
            )
        if not is_chain:
            update_status(self, channel_layer, group_name, status='SUCCESS', progress=100, phase='Calcium measurement completed', image_name=image_name, results=ws_results)
    
    finally:
        tf.keras.backend.clear_session()
    
    return chain_results if is_chain else ws_results


@shared_task(bind=True, max_retries=3, soft_time_limit=30, time_limit=60)
def run_valve_model(self: Task, data: dict):
    logger.info('Valve Detection Analysis Starting')

    channel_layer = get_channel_layer()
    app_config: ApiConfig = apps.get_app_config('api')

    image_bytes = data['image_bytes']
    image_name = data.get('image_name')
    group_name = data.get('group_name')
    chain_context = data.get('chain_context')

    is_chain = bool(chain_context)

    if not group_name:
        group_name = f"task_{self.request.id}"

    logger.info(
        "run_valve_model starting",
        extra={"task_id": self.request.id, "group_name": group_name, "image_name": image_name},
    )

    try:
        update_status(self, channel_layer, group_name, status='PROGRESS', progress=0, phase='Starting valve detection', image_name=image_name)

        # FASE 1: Carregar modelo
        if is_chain:
            update_status(
                self,
                channel_layer,
                group_name,
                status='PROGRESS',
                progress=int(100 * (chain_context['step']/chain_context['steps'])/2),
                phase='Performing valve position inference',
                image_name=image_name,
            )
        else:
            update_status(self, channel_layer, group_name, status='PROGRESS', progress=15, phase='Loading the model', image_name=image_name)

        yolo_model = app_config.yolo_model
        update_status(self, channel_layer, group_name, status='PROGRESS', progress=20, phase='Model loaded', image_name=image_name)

        # FASE 2: Pré-processamento aprimorado
        if not is_chain:
            update_status(self, channel_layer, group_name, status='PROGRESS', progress=25, phase='Preprocessing the echocardiography', image_name=image_name)

        def preprocess(image_bytes, image_size=640):
            img = Image.open(io.BytesIO(image_bytes))
            orig_width, orig_height = img.size

            # Cálculo do scale factor
            scale = min(image_size / orig_width, image_size / orig_height)
            new_width, new_height = int(orig_width * scale), int(orig_height * scale)

            # Redimensionamento com mesma interpolação
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # Cálculo exato do padding
            pad_x = (image_size - new_width) // 2
            pad_y = (image_size - new_height) // 2

            # Cria imagem quadrada com bordas azuis
            new_img = Image.new('RGB', (image_size, image_size), (29, 108, 219))
            new_img.paste(img, (pad_x, pad_y))

            # Conversão para array numpy normalizado
            img_array = np.array(new_img) / 255.0
            img_array = img_array.transpose(2, 0, 1)  # HWC to CHW
            img_array = np.expand_dims(img_array, axis=0).astype(np.float32)

            return {
                'tensor': img_array,
                'metadata': {
                    'original_size': (orig_width, orig_height),
                    'new_size': (new_width, new_height),
                    'scale': scale,
                    'padding': (pad_x, pad_y)
                }
            }

        # Pré-processamento
        preprocessed = preprocess(image_bytes)
        img_array = preprocessed['tensor']
        meta = preprocessed['metadata']

        # Logs de Pré-Processamento
        logger.info(f"""
            Pré-processamento:
            Original: {meta['original_size']}
            Redimensionado: {meta['new_size']}
            Scale: {meta['scale']}
            Padding: {meta['padding']}
        """)

        # FASE 3: Inferência
        if not is_chain:
            update_status(self, channel_layer, group_name, status='PROGRESS', progress=40, phase='Performing valve position inference', image_name=image_name)

        outputs = yolo_model.run(None, {'images': img_array})[0]

        # FASE 4: Pós-processamento
        if not is_chain:
            update_status(self, channel_layer, group_name, status='PROGRESS', progress=90, phase='Postprocessing the resulting image', image_name=image_name)

        def postprocess(predictions, meta):
            if len(predictions) == 0:
                return []

            # Extrai as dimensões originais
            orig_width, orig_height = meta['original_size']
            scale = meta['scale']
            pad_x, pad_y = meta['padding']

            # Converte para formato [x_center, y_center, width, height, conf, class]
            preds = predictions.copy()
            preds[:, 0] = (preds[:, 0] - pad_x) / scale  # x_center
            preds[:, 1] = (preds[:, 1] - pad_y) / scale  # y_center
            preds[:, 2] = preds[:, 2] / scale            # width
            preds[:, 3] = preds[:, 3] / scale            # height

            # Converte para [x1, y1, x2, y2]
            preds[:, 0] = preds[:, 0] - preds[:, 2] / 2  # x1
            preds[:, 1] = preds[:, 1] - preds[:, 3] / 2  # y1
            preds[:, 2] = preds[:, 0] + preds[:, 2]      # x2
            preds[:, 3] = preds[:, 1] + preds[:, 3]      # y2

            # Clip e filtro de confiança
            preds = preds[preds[:, 4] > 0.25]
            preds[:, [0, 2]] = np.clip(preds[:, [0, 2]], 0, orig_width)
            preds[:, [1, 3]] = np.clip(preds[:, [1, 3]], 0, orig_height)

            return preds

        detections = postprocess(outputs[0], meta)

        # FASE 5: Formatação dos resultados
        nparr = np.frombuffer(image_bytes, np.uint8)
        original_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        ws_results = None
        chain_results = None

        if len(detections) > 0:
            best_idx = np.argmax(detections[:, 4])
            x1, y1, x2, y2, conf, cls = detections[best_idx]

            # Conversão para inteiros
            x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])

            # Desenho do bounding box (BGR)
            output_image = original_image.copy()
            cv2.rectangle(output_image, (x1, y1), (x2, y2), (219, 108, 29), 2)

            success, encoded_image = cv2.imencode('.png', output_image)
            image_with_bbox = f"data:image/png;base64,{base64.b64encode(encoded_image.tobytes()).decode('utf-8')}"

            ws_results = {
                'image_name': image_name,
                'bbox': [float(x1), float(y1), float(x2), float(y2)],
                'confidence': float(conf),
                'class': int(cls),
                'image_with_bbox': image_with_bbox,
            }

            if is_chain:
                chain_results = {
                    'image_bytes': image_bytes,
                    'bbox': { 'x1': float(x1), 'y1': float(y1), 'x2': float(x2), 'y2': float(y2) },
                    'image_name': image_name,
                    'group_name': group_name,
                    'chain_context': { 'step': 2, 'steps': chain_context['steps'] }
                }
        else:
            ws_results = {
                'image_name': image_name,
                'bbox': None,
                'confidence': None,
                'class': None,
                'image_with_bbox': None,
            }

        update_status(self, channel_layer, group_name, status='PROGRESS', progress=95, phase='Prediction ready', image_name=image_name)

        if is_chain:
            update_status(
                self,
                channel_layer,
                group_name,
                status='PROGRESS',
                progress=int(100 * (chain_context['step']/chain_context['steps'])),
                phase='Performing valve position inference',
                image_name=image_name,
                results=ws_results
            )
        else:
            update_status(self, channel_layer, group_name, status='SUCCESS', progress=100, phase='Aortic valve detection completed', image_name=image_name, results=ws_results)

        logger.info(
            "run_valve_model completed",
            extra={"task_id": self.request.id, "group_name": group_name, "image_name": image_name},
        )

        # Se a task estiver integrada numa chain, retorna os resultados para a próxima task, caso contrário retorna os resultados finais para o frontend
        return chain_results if is_chain else ws_results
    except Exception as exc:
        logger.exception("run_valve_model failed")
        set_screening_progress(
            group_name,
            {
                "status": "error",
                "progress": 100,
                "phase": "Valve detection failed",
                "error": str(exc),
                "image_name": image_name,
                "status_detail": "FAILURE",
            },
        )
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "send.update",
                "data": {
                    "status": "FAILURE",
                    "progress": 100,
                    "phase": "Valve detection failed",
                    "error": str(exc),
                    "image_name": image_name,
                },
            },
        )
        raise

@shared_task(bind=True)
def save_frame_from_patient_screening(self: Task, frame_results: dict, context: dict):
    from api.models import Patient, Echocardiogram, EchoFrame, EchoFrameData
    logger.info('Saving Echocardiogram from Patient Screening')

    echo_id: int = context.get('echo_id')
    doctor_id: int = context.get('doctor_id')
    frame_id: int = context.get('frame_id')
    results: dict = frame_results.get('results', {})

    if not echo_id or not results:
        raise ValueError('Echo ID and frames data are required.')
    
    try:
        echo = Echocardiogram.objects.get(pk=echo_id)
        frame = EchoFrame.objects.get(pk=frame_id)
        data_obj, created = EchoFrameData.objects.get_or_create(
            frame=frame,
            doctor_id=doctor_id,
            defaults={
                'x': results.get('x1'),
                'y': results.get('y1'),
                'width': results.get('x2') - results.get('x1'),
                'height': results.get('y2') - results.get('y1'),
                'is_calcified': bool(results.get('is_calcified')),
                'is_annotation_generated': True,
                'is_calcification_generated': True,
            }
        )
        if not created:
            data_obj.x = results.get('x1')
            data_obj.y = results.get('y1')
            data_obj.width = results.get('x2') - results.get('x1')
            data_obj.height = results.get('y2') - results.get('y1')
            data_obj.is_calcified = results.get('is_calcified')
            data_obj.is_annotation_generated = True
            data_obj.is_calcification_generated = True
            data_obj.save()

        echo.status = Echocardiogram.Status.EVALUATED
        echo.save()

        # Atualiza status do paciente se todos os echos estiverem avaliados
        if not Echocardiogram.objects.filter(patient=echo.patient).exclude(status=Echocardiogram.Status.EVALUATED).exists():
            echo.patient.status = Patient.Status.EVALUATED
            echo.patient.save()

        return True

    except Exception as e:
        logger.error(f'Error saving echocardiogram data: {str(e)}')
        return False


@shared_task(bind=True)
def crop_valve_image(self: Task, data: dict):
    logger.info('Cropping Valve Image')
    
    channel_layer = get_channel_layer()
    
    image_bytes = data['image_bytes']
    bbox = data['bbox']
    group_name = data.get('group_name', f'task_{self.request.id}')
    image_name = data.get('image_name')
    chain_context = data.get('chain_context')
    
    is_chain = bool(chain_context)
    
    try:
        if is_chain:
            update_status(
                self, 
                channel_layer, 
                group_name, 
                image_name=image_name, 
                status='PROGRESS', 
                progress=int(100 * (chain_context['step']/chain_context['steps'])), 
                phase='Performing the cropping operation', 
            )
        else:
            update_status(self, channel_layer, group_name, image_name=image_name, status='PROGRESS', progress=25, phase='Loading the annotated echocardiography image')
    
        # Carrega a imagem original
        image = Image.open(io.BytesIO(image_bytes))
        orig_width, orig_height = image.size
        
        # Acessa as coordenadas da box, convertendo para inteiros
        x1 = int(bbox['x1'])
        y1 = int(bbox['y1'])
        x2 = int(bbox['x2'])
        y2 = int(bbox['y2'])
        
        # Aplica uma margem de segurança (5%) e recalcula as coordenadas
        margin = int(min(x2 - x1, y2 - y1) * 0.05)
        x1, y1 = max(0, x1 - margin), max(0, y1 - margin)
        x2, y2 = min(orig_width, x2 + margin), min(orig_height, y2 + margin)
        
        if not is_chain:
            update_status(self, channel_layer, group_name, image_name=image_name, status='PROGRESS', progress=40, phase='Performing the cropping operation')
        
        # Executa o recorte
        cropped_image = image.crop((x1, y1, x2, y2))
        
        # Converte para bytes PNG (sem perda) 
        buffer = io.BytesIO()
        cropped_image.save(buffer, format='PNG')
        cropped_bytes = buffer.getvalue()
        
        if is_chain:
            chain_results = {
                'image_bytes': cropped_bytes,
                'image_name': image_name,
                'bbox': [x1, y1, x2, y2],
                'cropped_image': buffer.getvalue(),
                'group_name': group_name,
                'chain_context': { 'step': 3, 'steps': chain_context['steps'] }
            }
        
        ws_results = {
            'image_name': image_name,
            'bbox': [x1, y1, x2, y2],
        }
        
        if not is_chain:
            update_status(self, channel_layer, group_name, image_name=image_name, status='PROGRESS', progress=100, phase='Cropping completed', results=ws_results)
        
        return chain_results if is_chain else ws_results
    
    except Exception as e:
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'send.update',
                'data': {
                    'error': str(e),
                    'status': 'FAILURE',
                }
            }
        )
        raise self.retry(exc=e)
    
    
@shared_task(bind=True, max_retries=3)
def batch_valve_detection(self: Task, images_bytes: list, bboxs: list[dict]):
    logger.info('Batch Valve Detection Analysis Starting')
    
    channel_layer = get_channel_layer()
    group_name = f"task_{self.request.id}"

    for idx, image in enumerate(images_bytes):
        try:
            image_name = image['name']
            image_content = image['bytes']
            bbox = bboxs[idx]
            
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    'type': 'send.update',
                    'data': {
                        'image_name': image_name,
                        'status': 'PROGRESS',
                        'progress': 0,
                        'message': f'Processing frame ({idx+1}/{len(images_bytes)})',
                    }
                }
            )
            
            # Processa a task de forma assíncrona no loop; chain faz com que cada task envie apenas a mensagem websocket final para reduzir o tráfego
            # Identificação da válvula + recorte + medição do cálcio
            if not bbox:
                # Pipeline com deteção automática da válvula (identificação + recorte + medição do cálcio)
                chain(
                    run_valve_model.s({
                        'image_bytes': image_content,
                        'image_name': image_name,
                        'group_name': group_name,
                        'chain_context': { 'step': 1, 'steps': 3 }
                    }),
                    crop_valve_image.s(),
                    run_calcium_model.s()
                ).apply_async()
            else:
                # Pipeline com recorte direto e medição do cálcio
                chain(
                    crop_valve_image.s({
                        'image_bytes': image_content,
                        'bbox': { 
                            'x1': float(bbox['x']), 
                            'y1': float(bbox['y']), 
                            'x2': float(bbox['x']) + float(bbox['width']),
                            'y2': float(bbox['y']) + float(bbox['height']), 
                        },
                        'image_name': image_name,
                        'group_name': group_name,
                        'chain_context': { 'step': 1, 'steps': 2 }
                    }),
                    run_calcium_model.s()
                ).apply_async()

        except Exception as e:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    'type': 'send.update',
                    'data': {
                        'image_name': image.get('name', 'unknown'),
                        'error': str(e),
                        'status': 'FAILURE',
                    }
                }
            )
    
    logger.info('Batch Valve Detection Analysis Completed')


# Atualizar estado via Websocket
def update_status(task: Task, channel_layer, group_name, status, progress, phase, results=None, image_name=None):
    
    task.update_state(state=status, meta={'progress': progress, 'phase': phase})
    
    data = { 'status': status, 'progress': progress, 'phase': phase }
    if results is not None:
        data.update({ 'results': results })
    if image_name is not None:
        data.update({ 'image_name': image_name })

    def _map_status(raw_status: str) -> str:
        if raw_status in ("SUCCESS",):
            return "done"
        if raw_status in ("FAILURE", "REVOKED"):
            return "error"
        return "running"

    # Guarda em memória no Redis
    set_screening_progress(group_name, {
        'status': _map_status(status),
        'status_detail': status,
        'progress': progress,
        'phase': phase,
        'results': results,
        'image_name': image_name,
    })
    
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'send.update',
            'data': data
        }
    )
    
