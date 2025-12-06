from .models import CustomUser as User
from rest_framework import serializers

# Serializador para o modelo de utilizador
# Define os campos que serão serializados de python para JSON
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'password', 'medical_speciality', 'doctor_number'] 
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user