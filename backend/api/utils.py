# Funções auxiliares gerais

from django.core.files.base import ContentFile
from django.conf import settings

import os
import numpy as np
import json
from PIL import Image
from io import BytesIO

try:
    import cv2
except ModuleNotFoundError:
    cv2 = None

OBJECTIVE_VARIABLE_BLACK_THRESHOLD = 10
OBJECTIVE_VARIABLE_GRAY_THRESHOLD = 120
OBJECTIVE_VARIABLE_WHITE_THRESHOLD = 200


def _require_cv2():
    if cv2 is None:
        raise ModuleNotFoundError("OpenCV (cv2) is required for DICOM/frame processing.")
    return cv2


def _normalize_task_id(task_id: str) -> str:
    if not task_id:
        return "task_unknown"
    return task_id if task_id.startswith("task_") else f"task_{task_id}"


def get_screening_progress_key(task_id: str) -> str:
    normalized = _normalize_task_id(task_id)
    return f"screening_progress:{normalized}"


def set_screening_progress(task_id: str, data: dict) -> None:
    """
    Salva o progresso atual de uma task de screening no Redis.

    Args:
        task_id (str): Identificador único do grupo da task (formato 'task_<uuid>').
        data (dict): Dicionário com o progresso, status, resultados parciais, etc.

    O progresso é salvo na chave 'screening_progress:task_<uuid>' e pode ser recuperado
    por outros processos (ex: views, consumers) para fornecer feedback imediato ao frontend.
    """
    import redis

    r = redis.Redis.from_url(settings.REDIS_URL)
    r.set(get_screening_progress_key(task_id), json.dumps(data))


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
    if not frames:
        echo.delete()
        raise ValueError("Nenhum frame extraído do DICOM.")
    
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
    return echo
    

##### PROCESSAMENTO DICOM #####

def ler_dicom(dicom_path):
    """Lê um DICOM e extrai a imagem como array numpy"""
    import pydicom

    dicom = pydicom.dcmread(dicom_path, force=True)

    transfer_syntax = getattr(getattr(dicom, "file_meta", None), "TransferSyntaxUID", None)
    sop_class_uid = getattr(dicom, "SOPClassUID", None)
    modality = getattr(dicom, "Modality", None)

    def _contexto_dicom() -> str:
        ts_value = str(transfer_syntax) if transfer_syntax else "Unknown"
        sop_value = str(sop_class_uid) if sop_class_uid else "Unknown"
        modality_value = str(modality) if modality else "Unknown"
        return f"TransferSyntaxUID={ts_value} | SOPClassUID={sop_value} | Modality={modality_value}"

    is_compressed = False
    if transfer_syntax is not None:
        try:
            is_compressed = bool(transfer_syntax.is_compressed)
        except Exception:
            is_compressed = False

    if is_compressed:
        try:
            dicom.decompress()
        except Exception as exc:
            raise ValueError(
                f"Falha ao descomprimir o DICOM. {_contexto_dicom()}. Erro: {exc}"
            ) from exc

    if "PixelData" not in dicom:
        raise ValueError(
            f"O DICOM não contém PixelData. {_contexto_dicom()}."
        )
    
    # Tenta obter a imagem
    if hasattr(dicom, 'pixel_array'):
        try:
            img_array = dicom.pixel_array
        except Exception as exc:
            raise ValueError(
                f"Falha ao ler pixel_array do DICOM. {_contexto_dicom()}. Erro: {exc}"
            ) from exc
        
        # Algumas imagens vêm em modo monocromático invertido (negativo)
        if getattr(dicom, "PhotometricInterpretation", "") == "MONOCHROME1":
            img_array = np.max(img_array) - img_array
        
        # Normaliza para 0-255 se for necessário
        if img_array.dtype != np.uint8:
            min_val = np.min(img_array)
            max_val = np.max(img_array)
            if max_val == min_val:
                img_array = np.zeros_like(img_array, dtype=np.uint8)
            else:
                img_array = ((img_array - min_val) / (max_val - min_val) * 255).astype(np.uint8)
        
        return dicom, img_array
    else:
        raise ValueError(
            f"O DICOM não contém dados de imagem válidos. {_contexto_dicom()}."
        )
         

def extrair_frames(dicom_path) -> list[tuple[np.ndarray, int]]:
    """
    Extrai e processa os frames do DICOM sem salvá-los no disco.
    Retorna uma lista de tuplos: (frame_em_numpy, índice).
    """
    cv2_lib = _require_cv2()
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
                raise ValueError("Formato de frames inesperado.")

            frame = cv2_lib.cvtColor(frame, cv2_lib.COLOR_GRAY2RGB)
            frame = cortar_margens(frame)
            frame = padronizar_frame(frame)

            if frame.shape[0] == 0 or frame.shape[1] == 0:
                continue

            output.append((frame, idx + 1))

    else:
        frame = img_array
        if frame.ndim == 2:
            frame = cv2_lib.cvtColor(frame, cv2_lib.COLOR_GRAY2RGB)
        frame = cortar_margens(frame)
        frame = padronizar_frame(frame)
        output.append((frame, 1))
    
    if not output:
        raise ValueError("Nenhum frame extraído do DICOM.")

    return output
        

def cortar_margens(img_array: np.ndarray, limiar=5):
    """Corta margens pretas da imagem"""
    cv2_lib = _require_cv2()
    if img_array.ndim == 2:
        gray = img_array
    else:
        gray = cv2_lib.cvtColor(img_array, cv2_lib.COLOR_RGB2GRAY)
    _, thresh = cv2_lib.threshold(gray, limiar, 255, cv2_lib.THRESH_BINARY)
    coords = cv2_lib.findNonZero(thresh)
    
    if coords is not None:
        x, y, w, h = cv2_lib.boundingRect(coords)
        img_cortada = img_array[y:y+h, x:x+w]
        return img_cortada
    else:
        return img_array
    

def padronizar_frame(img_array, target_size=(640, 640)):
    """Redimensiona a imagem mantendo proporção e adiciona padding para 640x640"""
    cv2_lib = _require_cv2()
    old_h, old_w = img_array.shape[:2]
    target_w, target_h = target_size

    # Escala mantendo proporção
    scale = min(target_w / old_w, target_h / old_h)
    new_w, new_h = int(old_w * scale), int(old_h * scale)

    resized = cv2_lib.resize(img_array, (new_w, new_h), interpolation=cv2_lib.INTER_AREA)

    # Cria imagem preta com tamanho alvo
    new_img = np.zeros((target_h, target_w, 3), dtype=np.uint8)

    # Calcula margens para centralizar
    x_offset = (target_w - new_w) // 2
    y_offset = (target_h - new_h) // 2

    # Coloca imagem redimensionada no centro
    new_img[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = resized

    return new_img


def _load_grayscale_image(image_source) -> np.ndarray:
    """
    Carrega uma imagem em escala de cinzentos a partir de um caminho no disco
    ou de um array numpy já existente.
    """
    if isinstance(image_source, np.ndarray):
        image_array = image_source.copy()
    else:
        with Image.open(image_source) as image:
            image_array = np.array(image.convert('L'))

    if image_array.ndim == 3:
        if cv2 is not None:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
        else:
            image_array = np.mean(image_array[:, :, :3], axis=2).astype(np.uint8)

    return image_array.astype(np.uint8)


def _normalize_bbox(rect: dict, width: int, height: int) -> dict | None:
    """
    Normaliza e limita a bbox às dimensões da imagem.
    """
    try:
        x = float(rect['x'])
        y = float(rect['y'])
        rect_width = float(rect['width'])
        rect_height = float(rect['height'])
    except (KeyError, TypeError, ValueError):
        return None

    if rect_width <= 0 or rect_height <= 0:
        return None

    x1 = max(0, min(width - 1, int(np.floor(x))))
    y1 = max(0, min(height - 1, int(np.floor(y))))
    x2 = max(x1 + 1, min(width, int(np.ceil(x + rect_width))))
    y2 = max(y1 + 1, min(height, int(np.ceil(y + rect_height))))

    if x2 <= x1 or y2 <= y1:
        return None

    return {
        'x1': x1,
        'y1': y1,
        'x2': x2,
        'y2': y2,
        'width': x2 - x1,
        'height': y2 - y1,
    }


def summarize_objective_variable(white_pixel_count: int, gray_pixel_count: int, valid_pixel_count: int, frame_count: int = 1) -> dict | None:
    """
    Resume a VO a partir das contagens agregadas.
    """
    if valid_pixel_count <= 0:
        return None

    vo = (white_pixel_count + 0.5 * gray_pixel_count) / valid_pixel_count
    vo = float(np.clip(vo, 0.0, 1.0))

    return {
        'vo': vo,
        'vo_percentage': round(vo * 100, 2),
        'white_pixel_count': int(white_pixel_count),
        'gray_pixel_count': int(gray_pixel_count),
        'valid_pixel_count': int(valid_pixel_count),
        'frame_count': int(frame_count),
    }


def aggregate_objective_variable_metrics(metrics: list[dict]) -> dict | None:
    """
    Agrega métricas de múltiplos frames num único valor de VO.
    """
    usable_metrics = [
        metric for metric in metrics
        if metric and metric.get('valid_pixel_count')
    ]
    if not usable_metrics:
        return None

    total_white = sum(int(metric.get('white_pixel_count', 0)) for metric in usable_metrics)
    total_gray = sum(int(metric.get('gray_pixel_count', 0)) for metric in usable_metrics)
    total_valid = sum(int(metric.get('valid_pixel_count', 0)) for metric in usable_metrics)

    return summarize_objective_variable(
        white_pixel_count=total_white,
        gray_pixel_count=total_gray,
        valid_pixel_count=total_valid,
        frame_count=len(usable_metrics),
    )


def quantify_objective_variable(image_source, rect: dict) -> dict | None:
    """
    Quantifica a VO numa região anotada, contabilizando pixeis brancos e cinzentos
    após normalização local da intensidade.
    """
    image_array = _load_grayscale_image(image_source)
    height, width = image_array.shape[:2]
    bbox = _normalize_bbox(rect, width=width, height=height)

    if bbox is None:
        return None

    roi = image_array[bbox['y1']:bbox['y2'], bbox['x1']:bbox['x2']]
    if roi.size == 0:
        return None

    if cv2 is not None:
        roi = cv2.GaussianBlur(roi, (5, 5), 0)

    valid_mask = roi > OBJECTIVE_VARIABLE_BLACK_THRESHOLD
    valid_pixels = roi[valid_mask]

    if valid_pixels.size == 0:
        return {
            'vo': 0.0,
            'vo_percentage': 0.0,
            'white_pixel_count': 0,
            'gray_pixel_count': 0,
            'valid_pixel_count': 0,
            'bbox': bbox,
        }

    lower_bound = float(np.percentile(valid_pixels, 5))
    upper_bound = float(np.percentile(valid_pixels, 95))

    normalized_roi = np.zeros_like(roi, dtype=np.uint8)

    if upper_bound - lower_bound < 1:
        normalized_roi[valid_mask] = valid_pixels.astype(np.uint8)
    else:
        normalized_values = np.clip(
            (valid_pixels.astype(np.float32) - lower_bound) * 255.0 / (upper_bound - lower_bound),
            0,
            255,
        ).astype(np.uint8)
        normalized_roi[valid_mask] = normalized_values

    white_mask = valid_mask & (normalized_roi >= OBJECTIVE_VARIABLE_WHITE_THRESHOLD)
    gray_mask = (
        valid_mask
        & (normalized_roi >= OBJECTIVE_VARIABLE_GRAY_THRESHOLD)
        & (normalized_roi < OBJECTIVE_VARIABLE_WHITE_THRESHOLD)
    )

    white_pixel_count = int(np.count_nonzero(white_mask))
    gray_pixel_count = int(np.count_nonzero(gray_mask))
    valid_pixel_count = int(valid_pixels.size)

    summary = summarize_objective_variable(
        white_pixel_count=white_pixel_count,
        gray_pixel_count=gray_pixel_count,
        valid_pixel_count=valid_pixel_count,
    )

    if summary is None:
        return None

    return {
        **summary,
        'bbox': bbox,
    }

    
# Testar com um DICOM e destino da pasta
#dicom_path = "C:/Users/david/Downloads/IMG-0001-00006 (1).dcm"
#output_folder = "backend/media/frames"

#extrair_frames(dicom_path)
