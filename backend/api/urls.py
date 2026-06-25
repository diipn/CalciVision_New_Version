from django.urls import path
from . import views

urlpatterns = [
    path('hello/', views.hello, name='hello'),
    path('model/calcium/', views.predict_calcium, name='predict_calcium'),
    path('model/valve/', views.identify_valve, name='identify_valve_area'),
    path('model/valve-batch/', views.batch_identify_valves, name='identify_valves_area_batch'),
    path('model/patient-screening/', views.patient_screening, name='patient_screening'),
    path('model/patient-screening/status/<str:task_id>/', views.patient_screening_status, name='patient_screening_status'),
    path('model/patient-screening/accept/', views.save_patient_screening_results, name='accept_patient_screening'),
    path('crop/', views.crop_image_area, name='crop_image_for_classification'),
    
    path('patients/', views.patient_list, name='get_patients'),
    path('patient/<int:patient_id>/', views.get_patient, name='get_patient'),
    path('patient/create/', views.create_patient, name='create_patient'),
    path('patient/<int:patient_id>/delete/', views.delete_patient, name='delete_patient'),
    path('patient/<int:patient_id>/echocardiogram/add/', views.add_echocardiogram, name='add_echocardiogram'),
    path('patient/<int:patient_id>/echocardiogram/<int:echo_id>/frames/', views.get_frames_for_echocardiogram, name='get_dicom_frames'),
    path('patient/<int:patient_id>/echocardiogram/<int:echo_id>/objective-variable/', views.quantify_echocardiogram_objective_variable, name='quantify_echocardiogram_objective_variable'),
    path('patient/<int:patient_id>/echocardiogram/<int:echo_id>/submit/', views.create_or_update_echocardiogram_data, name='create_or_update_echocardiogram_data'),
    path('patient/<int:patient_id>/echocardiogram/<int:echo_id>/delete/', views.delete_echocardiogram, name='delete_echocardiogram'),
    path('patient/<int:patient_id>/echocardiogram/<int:echo_id>/report/', views.clinical_report_detail, name='clinical_report_detail'),
    path('patient/<int:patient_id>/echodata/', views.get_echocardiogram_data_by_patient, name='echodata-by-patient'),
    path('patients-with-ecos/', views.patient_with_ecos, name='patient_with_ecos'),
    path('patients/temporal-panel/', views.temporal_panel_data, name='temporal_panel_data'),

    path('reports/', views.list_reports, name='list_reports'),
    path('reports/<int:patient_id>/create/', views.create_report, name='create_report'),
    path('reports/<int:patient_id>/', views.get_report, name='get_report'),
    path('report/<int:report_id>/export/', views.export_report_pdf, name='export_report_pdf'),
    path('report/<int:report_id>/delete/', views.delete_report, name='delete_report'),
]
