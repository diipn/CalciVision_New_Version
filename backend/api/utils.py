# Funções auxiliares gerais

from django.core.files.base import ContentFile
from django.conf import settings

import os
import numpy as np
import pydicom
import redis
import json
from PIL import Image
from io import BytesIO
import cv2


def set_screening_progress(task_id: str, data: dict) -> None:
    """
    Salva o progresso atual de uma task de screening no Redis.

    Args:
        task_id (str): Identificador único do grupo da task (formato 'task_<uuid>').
        data (dict): Dicionário com o progresso, status, resultados parciais, etc.

    O progresso é salvo na chave 'screening_progress:{task_id}' e pode ser recuperado
    por outros processos (ex: views, consumers) para fornecer feedback imediato ao frontend.
    """
    r = redis.Redis.from_url(settings.REDIS_URL)
    r.set(f"screening_progress:{task_id}", json.dumps(data))


def frame_image_upload_path(instance, filename: str):
    """
    Cria um nome único para um determinado frame ser salvo no sistema de ficheiros.
    Usa uma combinação dos ids do paciente, ecocardiograma e index com a data atual.
    """
    ext = filename.split('.')[-1]
    dicom_name = instance.echocardiogram.dicom_file.name.split('/')[-1].split('.')[0]
    filename = f"FRM-{instance.echocardiogram.pk}-{instance.frame_index:03d}.{ext}"
    
    return os.path.join('frames', dicom_name, filename)


def process_echocardiogram(dicom, patient):
    from api.models import Echocardiogram, EchoFrame
    
    dicom_index = Echocardiogram.objects.filter(patient=patient).count() + 1
    dicom_name = f'DCM-{patient.pk}-{dicom_index}.dcm'
            
    # Recria o ficheiro com um nome diferente
    dicom_file = ContentFile(dicom.read(), name=dicom_name)
            
    echo = Echocardiogram.objects.create(
        patient=patient,
        dicom_file=dicom_file,
        description=f'Echocardiogram #{dicom_index}',
    )
            
    dicom_path = os.path.join(settings.MEDIA_ROOT, str(echo.dicom_file))
            
    frames = extrair_frames(dicom_path)
    
    for frame_array, idx in frames:
        # Converte para JPEG em memória
        img_io = BytesIO()
        Image.fromarray(frame_array).save(img_io, format='JPEG')
        img_content = ContentFile(img_io.getvalue(), name=f"FRM-{echo.pk}-{idx:03d}.jpg")
        
        # Cria o EchoFrame - o Django salvará com o path correto via upload_to
        EchoFrame.objects.create(
            echocardiogram=echo,
            image=img_content,
            frame_index=idx,
        )
    

##### PROCESSAMENTO DICOM #####

def ler_dicom(dicom_path):
    """Lê um DICOM e extrai a imagem como array numpy"""
    dicom = pydicom.dcmread(dicom_path)
    
    # Tenta obter a imagem
    if hasattr(dicom, 'pixel_array'):
        img_array = dicom.pixel_array
        
        # Algumas imagens vêm em modo monocromático invertido (negativo)
        if dicom.PhotometricInterpretation == "MONOCHROME1":
            img_array = np.max(img_array) - img_array
        
        # Normaliza para 0-255 se for necessário
        if img_array.dtype != np.uint8:
            img_array = ((img_array - np.min(img_array)) / (np.max(img_array) - np.min(img_array)) * 255).astype(np.uint8)
        
        return dicom, img_array
    else:
        raise ValueError("O DICOM não contém dados de imagem válidos.")
         

def extrair_frames(dicom_path) -> list[tuple[np.ndarray, int]]:
    """
    Extrai e processa os frames do DICOM sem salvá-los no disco.
    Retorna uma lista de tuplos: (frame_em_numpy, índice).
    """
    try:
        dicom, img_array = ler_dicom(dicom_path)
        num_frames = getattr(dicom, "NumberOfFrames", None)
        output = []

        if len(img_array.shape) == 3 and num_frames and num_frames > 1:
            print(f"Extraindo {num_frames} frames de {dicom_path}")
            for idx in range(num_frames):
                if img_array.shape[0] == num_frames:
                    frame = img_array[idx]
                elif img_array.shape[2] == num_frames:
                    frame = img_array[:, :, idx]
                else:
                    print("Formato de frames inesperado.")
                    continue

                frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2RGB)
                frame = cortar_margens(frame)
                frame = padronizar_frame(frame)

                if frame.shape[0] == 0 or frame.shape[1] == 0:
                    print(f"Frame {idx} está vazio após cortar margens.")
                    continue

                output.append((frame, idx + 1))

        else:
            frame = img_array
            frame = cortar_margens(frame)
            frame = padronizar_frame(frame)
            output.append((frame, 1))
        
        return output
        
    except Exception as e:
        print(f"Erro ao processar DICOM {dicom_path}: {e}")
        return []
        

def cortar_margens(img_array: np.ndarray, limiar=5):
    """Corta margens pretas da imagem"""
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    _, thresh = cv2.threshold(gray, limiar, 255, cv2.THRESH_BINARY)
    coords = cv2.findNonZero(thresh)
    
    if coords is not None:
        x, y, w, h = cv2.boundingRect(coords)
        img_cortada = img_array[y:y+h, x:x+w]
        return img_cortada
    else:
        return img_array
    

def padronizar_frame(img_array, target_size=(640, 640)):
    """Redimensiona a imagem mantendo proporção e adiciona padding para 640x640"""
    old_h, old_w = img_array.shape[:2]
    target_w, target_h = target_size

    # Escala mantendo proporção
    scale = min(target_w / old_w, target_h / old_h)
    new_w, new_h = int(old_w * scale), int(old_h * scale)

    resized = cv2.resize(img_array, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # Cria imagem preta com tamanho alvo
    new_img = np.zeros((target_h, target_w, 3), dtype=np.uint8)

    # Calcula margens para centralizar
    x_offset = (target_w - new_w) // 2
    y_offset = (target_h - new_h) // 2

    # Coloca imagem redimensionada no centro
    new_img[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = resized

    return new_img

    
# Testar com um DICOM e destino da pasta
#dicom_path = "C:/Users/david/Downloads/IMG-0001-00006 (1).dcm"
#output_folder = "backend/media/frames"

#extrair_frames(dicom_path)
