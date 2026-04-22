from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
from .tasks import run_calcium_model, run_valve_model, batch_valve_detection, crop_valve_image, save_frame_from_patient_screening
from .utils import (
    aggregate_objective_variable_metrics,
    get_screening_progress_key,
    process_echocardiogram,
    quantify_objective_variable,
)
from celery import chain
import redis

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAuthenticated
from .models import Patient, EchoFrame, EchoFrameData, Echocardiogram, ReportPdf
from .serializers import PatientSerializer, PatientWithEchocardiogramSerializer, EcoFrameSerializer, FrameResultsSerializer, EchoFrameDataSerializer, ReportPdfSerializer

import logging
import json
import uuid

logger = logging.getLogger(__name__)

### VIEWS DOS MODELOS DA CALCIVISION ###

def hello(request: HttpRequest):
    return Response({ "message": "Hello from Django!" })


def _extract_primary_rect(rects: list[dict]) -> dict | None:
    if not rects:
        return None

    rect = rects[0]
    return {
        'x': rect.get('x'),
        'y': rect.get('y'),
        'width': rect.get('width'),
        'height': rect.get('height'),
    }


def _build_vo_metadata(summary: dict | None, source: str) -> dict:
    if not summary:
        return {
            'source': source,
            'version': 1,
            'frame_count': 0,
        }

    return {
        'source': source,
        'version': 1,
        'frame_count': int(summary.get('frame_count', 0)),
        'vo_percentage': float(summary.get('vo_percentage', 0.0)),
    }

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def patient_screening_status(request: HttpRequest, task_id: str):
    r = redis.Redis.from_url(settings.REDIS_URL)  # Ajustar REDIS_URL
    data = r.get(get_screening_progress_key(task_id))
    if data:
        return Response(json.loads(data), status=status.HTTP_200_OK)
    return Response({ "error": "Patient Screening not found or not started" }, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def predict_calcium(request: HttpRequest):
    """
    View de classificação da válvula aórtica quanto à calcificação.
    
    Suporta dois fluxos:
    - `detect_only`: A imagem já está recortada (apenas detecção de cálcio).
    - `full`: A imagem é inteira e requer recorte baseado em `bbox` antes da detecção.

    Args:
        request (HttpRequest): Requisição HTTP com:
            - FILES['image']: Imagem binária (recortada ou inteira).
            - POST['action']: 'detect_only' ou 'full'.
            - POST['bbox']: Coordenadas no formato "x1,y1,x2,y2" (opcional para 'full').

    Returns:
        Response:
            - Sucesso: { "message": str, "task_id": str } (ID da task Celery).
            - Erro: { "error": str } com status HTTP 4xx/5xx.
    
    """
    
    # Verifica se a imagem foi recebida na requisição
    if "image" not in request.FILES:
        return Response({ 'error': 'Image was not sent' }, status=status.HTTP_400_BAD_REQUEST)
        
    # Carrega a imagem recebida
    image_file = request.FILES["image"]
    image_bytes = image_file.read()
    image_name = image_file.name
        
    # Acessa os campos action e bbox
    action = request.POST.get('action', default='detect_only')
    bbox_data = request.POST.get('bbox')
    
    task_id = str(uuid.uuid4())
    group_name = f"task_{task_id}"
        
    if bbox_data:
        try:
            bbox = json.loads(bbox_data)
            annotation_data = {
                'x1': float(bbox['x']),
                'y1': float(bbox['y']),
                'x2': float(bbox['x']) + float(bbox['width']),
                'y2': float(bbox['y']) + float(bbox['height']),
            }
        except (json.JSONDecodeError, KeyError) as e:
            return Response({ 'error': f'Invalid bbox format: {str(e)}' }, status=status.HTTP_400_BAD_REQUEST)
        
    # Se o fluxo for apenas de detação do cálcio, executa assincronamente a task correspondente
    if action == 'detect_only':
        run_calcium_model.delay({
            'image_bytes': image_bytes,
            'image_name': image_name,
            'group_name': group_name,
        })
    # Se o fluxo for recorte + deteção do cálcio, cria uma cadeia de processamento
    elif action == 'full' and bbox_data:
        chain(
            crop_valve_image.s({
                'image_bytes': image_bytes,
                'bbox': annotation_data,
                'image_name': image_name,
                'group_name': group_name,
                'chain_context': { 'step': 1, 'steps': 2 }
            }),
            run_calcium_model.s()
        ).apply_async()
    else:
        return Response({ 'error': 'Invalid parameters' }, status=status.HTTP_400_BAD_REQUEST)
        
    return Response({ 'message': 'The task was added to the queue.', 'task_id': task_id }, status=status.HTTP_202_ACCEPTED)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def identify_valve(request: HttpRequest):
    """
    View de identificação da área de interesse (válvula aórtica). Cria e executa assincronamente uma task do Celery para fazer essa identificação.
    """
    # Verifica se a imagem foi recebida na requisição
    if "image" not in request.FILES:
        return Response({ 'error': 'Image was not sent' }, status=status.HTTP_400_BAD_REQUEST)
        
    # Carrega a imagem recebida no formato binário
    image_file = request.FILES["image"]
    image_bytes = image_file.read()
    image_name = image_file.name
        
    # Adiciona a previsão do modelo à fila do Celery
    task = run_valve_model.delay({
        'image_bytes': image_bytes,
        'image_name': image_name,
    })

    logger.info(
        "identify_valve task queued",
        extra={
            "task_id": task.task_id,
            "user": getattr(request.user, "id", None),
            "image_name": image_name,
            "image_size_bytes": len(image_bytes),
        },
    )
        
    return Response({ 'message': 'The task was added to the queue.', 'task_id': task.task_id }, status=status.HTTP_202_ACCEPTED)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def batch_identify_valves(request: HttpRequest):
    
    if not request.FILES.getlist('images'):
        return Response({ 'error': 'No images were sent' }, status=status.HTTP_400_BAD_REQUEST)
    
    images = request.FILES.getlist('images')
    bboxs = request.POST.getlist('bboxs')

    image_data = []
    bbox_data = []

    for idx, img_file in enumerate(images):
        image_data.append({
            'name': img_file.name,
            'bytes': img_file.read(),
        })

        try:
            # Tenta carregar a lista de bboxes associada à imagem
            bbox_list = json.loads(bboxs[idx]) if idx < len(bboxs) else []
            
            if len(bbox_list) > 0:
                bbox = bbox_list[0]
                
                # Verifica as chaves obrigatórias
                if not all(k in bbox for k in ['x', 'y', 'width', 'height']):
                    raise KeyError("Missing keys in bbox")

                annotation_data = {
                    'x1': float(bbox['x']),
                    'y1': float(bbox['y']),
                    'x2': float(bbox['x']) + float(bbox['width']),
                    'y2': float(bbox['y']) + float(bbox['height']),
                }
                bbox_data.append(annotation_data)
            else:
                bbox_data.append(None)

        except (json.JSONDecodeError, KeyError, ValueError, IndexError) as e:
            return Response({ 'error': f'Invalid bbox at index {idx}: {str(e)}' }, status=status.HTTP_400_BAD_REQUEST)

    # Inicia a task do Celery para processamento em batch
    batch = batch_valve_detection.delay(images_bytes=image_data, bboxs=bbox_data)

    return Response({ 'message': 'Batch task started', 'task_id': batch.id }, status=status.HTTP_202_ACCEPTED)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def patient_screening(request: HttpRequest):
    
    logger.info(f"Starting patient screening")

    patients = Patient.objects.exclude(status=Patient.Status.EVALUATED).filter(doctor=request.user).all()
    screening_batches = []

    for patient in patients:
        
        unfinished_echos = Echocardiogram.objects.filter(patient=patient).exclude(status=Echocardiogram.Status.EVALUATED).order_by('-uploaded_at')
        if not unfinished_echos.exists():
            continue

        for echo in unfinished_echos:
            frames = EchoFrame.objects.filter(echocardiogram=echo)
            
            if not frames.exists():
                continue
        
            for frame in frames:
                task_id = str(uuid.uuid4())
                group_name = f"task_{task_id}"

                with open(frame.image.path, 'rb') as f:
                    image_bytes = f.read()

                data = EchoFrameData.objects.filter(frame=frame, doctor=request.user).first()
                if not data:
                    bbox = None
                else:
                    bbox = {
                        'x1': float(data.x),
                        'y1': float(data.y),
                        'x2': float(data.x) + float(data.width),
                        'y2': float(data.y) + float(data.height),
                    }
                
                if not bbox:
                    # Pipeline: detecção válvula -> crop -> cálcio -> salvar
                    chain(
                        run_valve_model.s({
                            'image_bytes': image_bytes,
                            'image_name': frame.image.name,
                            'group_name': group_name,
                            'chain_context': { 'step': 1, 'steps': 3 },
                        }),
                        crop_valve_image.s(),
                        run_calcium_model.s(),
                        #save_frame_from_patient_screening.s({
                        #    'echo_id': echo.pk,
                        #    'doctor_id': request.user.pk,
                        #    'frame_id': frame.pk,
                        #})
                    ).apply_async()
                else:
                    # Pipeline: crop -> cálcio -> salvar
                    chain(
                        crop_valve_image.s({
                            'image_bytes': image_bytes,
                            'bbox': bbox,
                            'image_name': frame.image.name,
                            'group_name': group_name,
                            'chain_context': { 'step': 1, 'steps': 2 }
                        }),
                        run_calcium_model.s(),
                        #save_frame_from_patient_screening.s({
                        #    'echo_id': echo.pk,
                        #    'doctor_id': request.user.pk,
                        #    'frame_id': frame.pk,
                        #})
                    ).apply_async()

                screening_batches.append({
                    'patient': { 'id': patient.pk, 'name': patient.name },
                    'echo': { 'id': echo.pk, 'description': echo.description },
                    'frame_id': frame.pk,
                    'task_id': task_id,
                })
    
    return Response({ 
        'message': 'Screening task started for all patients', 
        'batches': screening_batches 
    }, status=status.HTTP_202_ACCEPTED)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def save_patient_screening_results(request: HttpRequest):
    """
    Guarda os resultados do screening de múltiplos pacientes/frames após confirmação do utilizador.
    Espera uma lista de objetos com dados de cada frame envolvido no patient screening.
    """
    results: list[dict] = request.data.get('results', [])
    if not results or not isinstance(results, list):
        return Response({ 'error': 'Invalid or missing results' }, status=status.HTTP_400_BAD_REQUEST)
    
    touched_echo_ids = set()

    for frame_data in results:
        patient_id = frame_data.get('patient_id')
        echo_id = frame_data.get('echo_id')
        frame_id = frame_data.get('frame_id')
        rect: dict = frame_data.get('rect', {})
        is_calcified = frame_data.get('is_calcified')
        classification = frame_data.get('classification', 0.0)
        confidence = frame_data.get('confidence', 0.0)
        
        if not all([patient_id, echo_id, frame_id]):
            continue  # Ignora frames com dados incompletos
        
        try:
            patient = Patient.objects.get(id=patient_id, doctor=request.user)
            echocardiogram = Echocardiogram.objects.get(id=echo_id, patient=patient)
            frame = EchoFrame.objects.get(id=frame_id, echocardiogram=echocardiogram)
        except (Patient.DoesNotExist, Echocardiogram.DoesNotExist, EchoFrame.DoesNotExist):
            continue  # Ignora frames com pacientes ou ecocardiogramas inexistentes

        touched_echo_ids.add(echocardiogram.id)

        quantification_rect = None
        if all(key in rect for key in ['x1', 'y1', 'x2', 'y2']):
            quantification_rect = {
                'x': rect.get('x1'),
                'y': rect.get('y1'),
                'width': rect.get('x2') - rect.get('x1'),
                'height': rect.get('y2') - rect.get('y1'),
            }

        objective_metrics = quantify_objective_variable(frame.image.path, quantification_rect) if quantification_rect else None
        
        existing_data = EchoFrameData.objects.filter(frame=frame, doctor=request.user).first()
        if existing_data:
            # Atualiza os dados existentes
            existing_data.x = rect.get('x1')
            existing_data.y = rect.get('y1')
            existing_data.width = rect.get('x2') - rect.get('x1')
            existing_data.height = rect.get('y2') - rect.get('y1')
            existing_data.is_calcified = is_calcified
            existing_data.is_calcification_generated = True
            existing_data.confidence = confidence
            existing_data.objective_variable = objective_metrics['vo'] if objective_metrics else None
            existing_data.white_pixel_count = objective_metrics['white_pixel_count'] if objective_metrics else None
            existing_data.gray_pixel_count = objective_metrics['gray_pixel_count'] if objective_metrics else None
            existing_data.valid_pixel_count = objective_metrics['valid_pixel_count'] if objective_metrics else None
            existing_data.save()
        else:
            EchoFrameData.objects.create(
                frame=frame,
                doctor=request.user,
                x=rect.get('x1'),
                y=rect.get('y1'),
                width=rect.get('x2') - rect.get('x1'),
                height=rect.get('y2') - rect.get('y1'),
                is_calcified=is_calcified,
                confidence=confidence,
                is_annotation_generated=True,
                is_calcification_generated=True,
                objective_variable=objective_metrics['vo'] if objective_metrics else None,
                white_pixel_count=objective_metrics['white_pixel_count'] if objective_metrics else None,
                gray_pixel_count=objective_metrics['gray_pixel_count'] if objective_metrics else None,
                valid_pixel_count=objective_metrics['valid_pixel_count'] if objective_metrics else None,
            )
        
        if echocardiogram.status != Echocardiogram.Status.EVALUATED:
            echocardiogram.status = Echocardiogram.Status.EVALUATED
            echocardiogram.save()
        
        all_echos = Echocardiogram.objects.filter(patient=patient)
        if all_echos.exclude(status=Echocardiogram.Status.EVALUATED).count() == 0:
            patient.status = Patient.Status.EVALUATED
            patient.updated_at = timezone.now()
            patient.save()

    for echo_id in touched_echo_ids:
        echocardiogram = Echocardiogram.objects.filter(id=echo_id, patient__doctor=request.user).first()
        if echocardiogram is None:
            continue

        stored_metrics = EchoFrameData.objects.filter(
            frame__echocardiogram=echocardiogram,
            doctor=request.user,
        )

        objective_summary = aggregate_objective_variable_metrics([
            {
                'white_pixel_count': data.white_pixel_count,
                'gray_pixel_count': data.gray_pixel_count,
                'valid_pixel_count': data.valid_pixel_count,
            }
            for data in stored_metrics
        ])

        echocardiogram.vo = objective_summary['vo'] if objective_summary else None
        echocardiogram.vo_frame_count = objective_summary['frame_count'] if objective_summary else 0
        echocardiogram.vo_white_pixels = objective_summary['white_pixel_count'] if objective_summary else 0
        echocardiogram.vo_gray_pixels = objective_summary['gray_pixel_count'] if objective_summary else 0
        echocardiogram.vo_roi_pixels = objective_summary['valid_pixel_count'] if objective_summary else 0
        echocardiogram.vo_metadata = _build_vo_metadata(objective_summary, source='patient_screening')
        echocardiogram.save(update_fields=[
            'vo',
            'vo_frame_count',
            'vo_white_pixels',
            'vo_gray_pixels',
            'vo_roi_pixels',
            'vo_metadata',
        ])
                   
    return Response({ 'message': 'Screening results saved successfully' }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def crop_image_area(request: HttpRequest):
    """
    View de recorte de imagens anotadas.
    """
    try:
        # Verifica se a imagem foi recebida na requisição
        if 'image' not in request.FILES:
            return Response({ 'error': 'Image was not sent' }, status=status.HTTP_400_BAD_REQUEST)
            
        bbox_data = request.POST.get('bbox')
            
        # Verifica se as dimensões da anotação foram recebidas na requisição
        if not bbox_data:
            return Response({ 'error': 'Coordinates were not sent (bbox)' }, status=status.HTTP_400_BAD_REQUEST)
                
        # Carregar a imagem
        image_file = request.FILES["image"]
        image_bytes = image_file.read()
        image_name = image_file.name
            
        try:
            bbox = json.loads(bbox_data)
            annotation_data = {
                'x1': float(bbox['x']),
                'y1': float(bbox['y']),
                'x2': float(bbox['x']) + float(bbox['width']),
                'y2': float(bbox['y']) + float(bbox['height']),
            }
        except (json.JSONDecodeError, KeyError) as e:
            return Response({ 'error': f'Invalid bbox format: {str(e)}' }, status=status.HTTP_400_BAD_REQUEST)
                
        # Inicia a task do Celery
        task = crop_valve_image.delay({
            'image_bytes': image_bytes,
            'bbox': annotation_data,
            'image_name': image_name,
        })
                    
        return Response({ 'message': 'The task was added to the queue.', 'task_id': task.id }, status=status.HTTP_202_ACCEPTED)
                
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 


### VIEWS DOS PACIENTES ###

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_patient(request: HttpRequest, patient_id: int):
    """
    Retorna todas as informações de um paciente pelo seu id
    """
    try:
        patient = Patient.objects.get(id=patient_id, doctor=request.user)
        serializer = PatientSerializer(patient, context={'request': request}) # O contexto é passado para os serializers aninhados que precisam dele (reports)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Patient.DoesNotExist:
        return Response({ 'error': 'Patient not found or unauthorized'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def patient_list(request: HttpRequest):
    """
    Lista todos os pacientes do médico
    """
    limit = request.GET.get('limit')
    patients = Patient.objects.filter(doctor=request.user).order_by('-updated_at')

    if limit:
        patients = patients[:int(limit)]
    
    serializer = PatientSerializer(patients, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def create_patient(request: HttpRequest):
    """
    Cria um novo paciente associado ao médico
    """
    patient_serializer = PatientSerializer(data=request.data, context={'request': request})
    if patient_serializer.is_valid():
        patient: Patient = patient_serializer.save(doctor=request.user)
        
        dicom = request.FILES.get('echoDicom')
        if dicom:
            try:
                process_echocardiogram(dicom, patient)
            except Exception as e:
                return Response({
                    'message': 'Patient created but DICOM processing failed',
                    'error': str(e),
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({ 'message': 'Patient created successfully' }, status=status.HTTP_201_CREATED)
    
    return Response(patient_serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def delete_patient(request: HttpRequest, patient_id: int):
    """
    Elimina um paciente associado ao médico
    """
    try:
        patient = Patient.objects.get(pk=patient_id, doctor=request.user)
        patient.delete()
        return Response({ 'message': 'Patient deleted successfully' }, status=status.HTTP_204_NO_CONTENT)
    except Patient.DoesNotExist:
        return Response({ 'error': 'Patient not found' }, status=status.HTTP_404_NOT_FOUND)
    

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def patient_with_ecos(request: HttpRequest):
    """
    Lista todos os pacientes do médico que têm ecocardiografias registadas
    """
    patients = Patient.objects.filter(doctor=request.user).prefetch_related('echocardiograms').all()
    serializer = PatientWithEchocardiogramSerializer(patients, many=True)
    return Response(serializer.data)


### VIEWS DOS REPORTS ###

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def create_report(request: HttpRequest, patient_id: int):
    try:
        patient = Patient.objects.get(id=patient_id, doctor=request.user)
    except Patient.DoesNotExist:
        return Response({ 'error': 'Patient not found or unauthorized' }, status=status.HTTP_403_FORBIDDEN)

    if 'pdf_file' not in request.FILES:
        return Response({ 'error': 'PDF file not provided' }, status=status.HTTP_400_BAD_REQUEST)
    
    # Criar novo relatório usando o modelo ReportPdf
    report = ReportPdf.objects.create(
        patient=patient,
        doctor=request.user,
        pdf_file=request.FILES['pdf_file']
    )
    
    # Atualiza o campo para indicar que o paciente já tem um relatório
    patient.has_report = True
    patient.save()

    return Response({ 
        'success': 'Report saved successfully',
        'report_id': report.id
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_report(request: HttpRequest, patient_id: int):
    """
    Obtém o relatório PDF de um paciente específico
    """
    try:
        patient = Patient.objects.get(id=patient_id, doctor=request.user)
    except Patient.DoesNotExist:
        return Response({ 'error': 'Patient not found or unauthorized' }, status=status.HTTP_403_FORBIDDEN)
    
    reports = ReportPdf.objects.filter(patient=patient)

    if not reports.exists():
        return Response({ 'error': 'No reports found for this patient' }, status=status.HTTP_404_NOT_FOUND)
    
    serializer = ReportPdfSerializer(reports, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def delete_report(request: HttpRequest, report_id: int):
    """
    Elimina um relatório associado ao médico.
    """
    try:
        report = ReportPdf.objects.get(pk=report_id, doctor=request.user)
        
        # Apaga o report da base de dados e dispara automaticamente o signal que removerá o ficheiro físico do sistema
        report.delete()
        
        return Response({ 'message': 'Report deleted successfully' }, status=status.HTTP_204_NO_CONTENT)
    except ReportPdf.DoesNotExist:
        return Response({ 'error': 'Report not found' }, status=status.HTTP_404_NOT_FOUND)

### VIEWS DOS ECOCARDIOGRAMAS ###

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def add_echocardiogram(request: HttpRequest, patient_id: int):
    try:
        patient = Patient.objects.get(pk=patient_id, doctor=request.user)
    except Patient.DoesNotExist:
        return Response({ 'error': 'Patient not found' }, status=status.HTTP_404_NOT_FOUND)
    
    # Obtem os DICOMs recebidos do frontend
    dicom_files = request.FILES.getlist('echoDicom')
    if not dicom_files:
        return Response({ 'error': 'No DICOM files provided' }, status=status.HTTP_400_BAD_REQUEST)
    
    processed = 0
    failed = []
    created_echos = []
    
    # Processa cada um dos DICOMs recebidos
    for dicom in dicom_files:
        try:
            echo = process_echocardiogram(dicom, patient)
            if echo:
                created_echos.append(echo)
            processed += 1
        except Exception as e:
            failed.append({ 'filename': dicom.name, 'error': str(e) })
    
    if processed == 0:
        first_error = failed[0].get('error') if failed else None
        return Response({
            'error': f'Não foi possível processar os DICOMs enviados.{f" {first_error}" if first_error else ""}',
            'errors': failed,
        }, status=status.HTTP_400_BAD_REQUEST)

    # Atualiza a data de modificação do paciente
    if processed > 0:
        echos = Echocardiogram.objects.filter(patient=patient)
        all_progress_echos = echos.exclude(status=Echocardiogram.Status.REVIEW_NEEDED).count()
        # Se todas as ecocardiografias ainda não tiverem sido iniciadas, o paciente está pendente
        if all_progress_echos == 0:
            patient.status = Patient.Status.PENDING
        # Caso contrário, o paciente está em revisão
        else:
            patient.status = Patient.Status.UNDER_REVIEW
        
        patient.updated_at = timezone.now()
        patient.save(update_fields=['status', 'updated_at'])
        
    created_ids = [echo.id for echo in created_echos]
    return Response({
        'message': f'{processed} DICOMs processed successfully',
        'errors': failed,
        'echo_ids': created_ids,
        'echo_id': created_ids[-1] if created_ids else None,
    }, status=status.HTTP_207_MULTI_STATUS if failed else status.HTTP_201_CREATED)
    
    
@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_frames_for_echocardiogram(request: HttpRequest, patient_id: int, echo_id: int):
    """
    Obtem todos os frames de um ecocardiograma, incluindo as áreas anotadas e resultados de calcificação se existirem
    """
    try:
        patient = Patient.objects.get(id=patient_id, doctor=request.user)
    except Patient.DoesNotExist:
        return Response({ 'error': 'Patient not found or unauthorized' }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        echo = Echocardiogram.objects.get(id=echo_id, patient_id=patient.pk)
    except Echocardiogram.DoesNotExist:
        return Response({ 'error': f'Echocardiogram not found for patient {patient.name}' }, status=status.HTTP_404_NOT_FOUND)
    
    frames = EchoFrame.objects.filter(echocardiogram=echo.pk).prefetch_related('data').order_by('frame_index')
    serializer = EcoFrameSerializer(frames, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def quantify_echocardiogram_objective_variable(request: HttpRequest, patient_id: int, echo_id: int):
    """
    Calcula a VO com base nos frames e nas bboxes atualmente anotadas, sem persistir o resultado.
    """
    serializer = FrameResultsSerializer(data=request.data.get('results'), many=True)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        patient = Patient.objects.get(id=patient_id, doctor=request.user)
    except Patient.DoesNotExist:
        return Response({ 'error': 'Patient not found or unauthorized' }, status=status.HTTP_403_FORBIDDEN)

    try:
        echocardiogram = Echocardiogram.objects.get(id=echo_id, patient=patient)
    except Echocardiogram.DoesNotExist:
        return Response({ 'error': 'Echocardiogram not found' }, status=status.HTTP_404_NOT_FOUND)

    frame_metrics = []

    for frame_data in serializer.validated_data:
        frame = get_object_or_404(EchoFrame, id=frame_data['frame_id'], echocardiogram=echocardiogram)
        primary_rect = _extract_primary_rect(frame_data.get('rects', []))
        if primary_rect is None:
            continue

        metrics = quantify_objective_variable(frame.image.path, primary_rect)
        if metrics is None:
            continue

        frame_metrics.append({
            'frame_id': frame.id,
            'objective_variable': metrics['vo'],
            'objective_variable_percentage': metrics['vo_percentage'],
            'white_pixel_count': metrics['white_pixel_count'],
            'gray_pixel_count': metrics['gray_pixel_count'],
            'valid_pixel_count': metrics['valid_pixel_count'],
            'bbox': metrics['bbox'],
        })

    summary = aggregate_objective_variable_metrics(frame_metrics)

    if summary is None:
        return Response(
            { 'error': 'Nenhuma ROI válida foi encontrada para calcular a VO.' },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({
        'vo': summary['vo'],
        'vo_percentage': summary['vo_percentage'],
        'white_pixel_count': summary['white_pixel_count'],
        'gray_pixel_count': summary['gray_pixel_count'],
        'valid_pixel_count': summary['valid_pixel_count'],
        'frame_count': summary['frame_count'],
        'frames': frame_metrics,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def create_or_update_echocardiogram_data(request: HttpRequest, patient_id: int, echo_id: int):
    """
    Cria ou atualiza os dados da posição da válvula aórtica e calcificação (EcoFrameData) para cada frame de um ecocardiograma
    """       

    # Verifica a validade dos dados recebidos do frontend com o serializer
    serializer = FrameResultsSerializer(data=request.data.get('results'), many=True)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    # Acessa os dados válidos
    frames: list[dict] = serializer.validated_data
    
    # Verifica se o paciente existe e se o médico está autorizado para trabalhar com ele
    try:
        patient = Patient.objects.get(id=patient_id, doctor=request.user)
    except Patient.DoesNotExist:
        return Response({ 'error': 'Patient not found or unauthorized' }, status=status.HTTP_403_FORBIDDEN)
    
    # Verifica se o ecocardiograma existe
    try:
        echocardiogram = Echocardiogram.objects.get(id=echo_id, patient=patient)
    except Echocardiogram.DoesNotExist:
        return Response({ 'error': 'Echocardiogram not found' }, status=status.HTTP_404_NOT_FOUND)
    
    if request.data.get('echoName'):
        echocardiogram.description = request.data.get('echoName')
        
    # Atualiza o status da ecocardiografia
    if request.data.get('completed'):
        echocardiogram.status = Echocardiogram.Status.EVALUATED
        echocardiogram.save()
        echos = Echocardiogram.objects.filter(patient=patient)
        all_progress_echos = echos.filter(status=Echocardiogram.Status.IN_PROGRESS).count()
        all_pending_echos = echos.exclude(status=Echocardiogram.Status.EVALUATED).count()
        # Se todas as ecocardiografias já tiverem sido submetidas, o paciente está avaliado
        if all_pending_echos == 0:
            patient.status = Patient.Status.EVALUATED
        # Se pelo menos uma das ecocardiografias do paciente já tiver sido iniciada
        elif all_progress_echos > 0:
            patient.status = Patient.Status.UNDER_REVIEW
        patient.save()
    else:
        echocardiogram.status = Echocardiogram.Status.IN_PROGRESS
        echocardiogram.save()
    
    frame_metrics = []

    for frame_data in frames:
        frame_id = frame_data.get('frame_id')
        rects = frame_data.get('rects', [])
        is_calcified = frame_data.get('is_calcified')
        generated_calcium = frame_data.get('generated_calcium')

        frame = get_object_or_404(EchoFrame, id=frame_id, echocardiogram=echocardiogram)
        primary_rect = _extract_primary_rect(rects)

        if primary_rect is None:
            EchoFrameData.objects.filter(frame=frame, doctor=request.user).delete()
            continue

        objective_metrics = quantify_objective_variable(frame.image.path, primary_rect)
        existing_data = EchoFrameData.objects.filter(frame=frame, doctor=request.user).first()

        payload = {
            'x': primary_rect['x'],
            'y': primary_rect['y'],
            'width': primary_rect['width'],
            'height': primary_rect['height'],
            'is_calcified': is_calcified,
            'is_annotation_generated': rects[0]['is_annotation_generated'],
            'is_calcification_generated': generated_calcium,
            'objective_variable': objective_metrics['vo'] if objective_metrics else None,
            'white_pixel_count': objective_metrics['white_pixel_count'] if objective_metrics else None,
            'gray_pixel_count': objective_metrics['gray_pixel_count'] if objective_metrics else None,
            'valid_pixel_count': objective_metrics['valid_pixel_count'] if objective_metrics else None,
        }

        if existing_data:
            for field, value in payload.items():
                setattr(existing_data, field, value)
            existing_data.save()
        else:
            EchoFrameData.objects.create(
                frame=frame,
                doctor=request.user,
                **payload,
            )

        if objective_metrics:
            frame_metrics.append(objective_metrics)

    objective_summary = aggregate_objective_variable_metrics(frame_metrics)
    echocardiogram.vo = objective_summary['vo'] if objective_summary else None
    echocardiogram.vo_frame_count = objective_summary['frame_count'] if objective_summary else 0
    echocardiogram.vo_white_pixels = objective_summary['white_pixel_count'] if objective_summary else 0
    echocardiogram.vo_gray_pixels = objective_summary['gray_pixel_count'] if objective_summary else 0
    echocardiogram.vo_roi_pixels = objective_summary['valid_pixel_count'] if objective_summary else 0
    echocardiogram.vo_metadata = _build_vo_metadata(objective_summary, source='manual_annotation')
    echocardiogram.save()

    patient.updated_at = timezone.now()
    patient.save()
    
    return Response({ 'message': 'Annotations saved successfully' }, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_echocardiogram_data_by_patient(request: HttpRequest, patient_id: int):
    echo_data = EchoFrameData.objects.filter(
        frame__echocardiogram__patient__doctor=request.user,
        frame__echocardiogram__patient_id=patient_id
    )

    echo_id = request.GET.get('echo_id')
    if echo_id:
        echo_data = echo_data.filter(frame__echocardiogram_id=echo_id)

    serializer = EchoFrameDataSerializer(echo_data, many=True)
    return Response(serializer.data)

@api_view(['DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def delete_echocardiogram(request: HttpRequest, patient_id: int, echo_id: int):
    """
    Remove um ecocardiograma da base de dados e do sistema de ficheiros
    """
    try:
        patient = Patient.objects.get(id=patient_id, doctor=request.user)
        echo = Echocardiogram.objects.get(id=echo_id, patient=patient)
        
        # Remove o ecocardiograma da base de dados, removendo todos os dados associados por on_delete=CASCADE
        # Dispara automaticamente os signals para remover os ficheiros físicos também
        echo.delete()
        
        # Atualiza o status da ecocardiografia
        echos = Echocardiogram.objects.filter(patient=patient)
        all_evaluated_echos = echos.filter(status=Echocardiogram.Status.EVALUATED).count()
        all_pending_echos = echos.exclude(status=Echocardiogram.Status.EVALUATED).count()
        all_reports = ReportPdf.objects.filter(patient=patient).count()
        # Se não houver quaisquer ecocardiografias associadas ao paciente, o paciente está pendente
        if echos.count() == 0:
            patient.status = Patient.Status.PENDING
        # Se todas as ecocardiografias já tiverem sido submetidas, o paciente está avaliado
        elif all_pending_echos == 0:
            patient.status = Patient.Status.EVALUATED
        # Se nenhuma ecocardiografia do paciente tem progressos, o paciente está pending
        elif all_evaluated_echos == 0:
            patient.status = Patient.Status.PENDING
        
        if all_reports == 0:
            patient.has_report = False
            
        patient.save()
        
        return Response({ 'message': 'Echocardiogram and associated data successfully deleted'}, status=status.HTTP_200_OK)
    
    except Patient.DoesNotExist:
        return Response({ 'message': 'You don\'t have permission to modify this patient or it does not exist' }, status=status.HTTP_404_NOT_FOUND)
    except Echocardiogram.DoesNotExist:
        return Response({ 'message': 'Echocardiogram not found'}, status=status.HTTP_404_NOT_FOUND)
    
