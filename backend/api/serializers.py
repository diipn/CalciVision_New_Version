from rest_framework import serializers
from .models import Patient, Echocardiogram, EchoFrame, EchoFrameData, ReportPdf
from authentication.serializers import UserSerializer
from django.http import HttpRequest


class EchocardiogramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Echocardiogram
        fields = [
            'id',
            'patient',
            'uploaded_at',
            'description',
            'status',
            'vo',
            'vo_frame_count',
            'vo_white_pixels',
            'vo_gray_pixels',
            'vo_roi_pixels',
            'vo_metadata',
        ]

class ReportPdfSerializer(serializers.ModelSerializer):
    doctor = UserSerializer(read_only=True)
    report_url = serializers.SerializerMethodField() # Atributo cujo valor é atribuído pela função "get_report_url"
    
    class Meta:
        model = ReportPdf
        fields = ['id', 'patient', 'doctor', 'report_url', 'pdf_name', 'pdf_size']
    
    # Constrói o caminho absoluto do pdf_file
    def get_report_url(self, obj):
        request: HttpRequest = self.context.get('request')
        return request.build_absolute_uri(obj.pdf_file.url)
    
class PatientSerializer(serializers.ModelSerializer):
    doctor = UserSerializer(read_only=True)
    echocardiograms = EchocardiogramSerializer(many=True, read_only=True)
    reports = ReportPdfSerializer(many=True, read_only=True)
    
    class Meta:
        model = Patient
        fields = '__all__'
        extra_kwargs = {
            'doctor': {'read_only': True},
            'echocardiograms': {'read_only': True},
            'reports': {'read_only': True},
        }
    
class PatientWithEchocardiogramSerializer(serializers.ModelSerializer):
    echocardiograms = EchocardiogramSerializer(many=True, read_only=True)
    
    class Meta:
        model = Patient
        fields = ['id', 'name', 'echocardiograms']

class EcoFrameDataSerializer(serializers.ModelSerializer):
    doctor = UserSerializer(read_only=True)
    
    class Meta:
        model = EchoFrameData
        fields = [
            'doctor',
            'frame',
            'x',
            'y',
            'width',
            'height',
            'is_calcified',
            'confidence',
            'is_annotation_generated',
            'is_calcification_generated',
            'objective_variable',
            'white_pixel_count',
            'gray_pixel_count',
            'valid_pixel_count',
        ]

class EcoFrameSerializer(serializers.ModelSerializer):
    data = EcoFrameDataSerializer(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = EchoFrame
        fields = ['id', 'frame_index', 'image_url', 'data']
        
    def get_image_url(self, obj):
        request: HttpRequest = self.context.get('request')
        return request.build_absolute_uri(obj.image.url)

# Dados de uma anotação (retângulo) que identifica a posição da válvula
class AnnotationSerializer(serializers.Serializer):
    x = serializers.FloatField()
    y = serializers.FloatField()
    width = serializers.FloatField()
    height = serializers.FloatField()
    id = serializers.CharField()
    is_annotation_generated = serializers.BooleanField()

# Resultados de um frame individual
class FrameResultsSerializer(serializers.Serializer):
    frame_id = serializers.IntegerField()
    rects = AnnotationSerializer(many=True)
    is_calcified = serializers.BooleanField(allow_null=True, required=False)
    generated_calcium = serializers.BooleanField(allow_null=True, required=False)

class EchoFrameDataSerializer(serializers.ModelSerializer):
    # Campo calculado para agrupar as coordenadas
    rects = serializers.SerializerMethodField()
    
    class Meta:
        model = EchoFrameData
        fields = [
            'frame',
            'rects',
            'is_calcified',
            'confidence',
            'objective_variable',
            'white_pixel_count',
            'gray_pixel_count',
            'valid_pixel_count',
        ]

    def get_rects(self, obj):
        # Retorna as coordenadas como um objeto
        return {
            "x": obj.x,
            "y": obj.y,
            "width": obj.width,
            "height": obj.height
        }
