import MainLayout from "../layouts/MainLayout.jsx";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from '../api';

export default function ManualAnnotationSetup() {
    
    const [patients, setPatients] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState("");
    const [selectedEchoId, setSelectedEchoId] = useState("");
    
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPatients = async () => {
            const response = await api.get('/api/patients-with-ecos/')
            setPatients(response.data)
            console.log(response.data)
        }

        fetchPatients()
    }, [])

    // Se o paciente e a ecocardiografia estiverem no URL, preenche automaticamente os campos
    useEffect(() => {
        const patientParam = searchParams.get('patient')
        const echoParam = searchParams.get('echo')
        patientParam && setSelectedPatientId(patientParam)
        echoParam && setSelectedEchoId(echoParam)
    }, [searchParams])

    const handleSubmit = () => {
        if(selectedPatientId && selectedEchoId)
            navigate(`/analyse_aortic_valve/${selectedPatientId}/${selectedEchoId}`)
    }

    return (
        <MainLayout pageTitle="Start Annotation - CalciVision">
            <h3 className='mb-4'>Select an echocardiography to analyse</h3>
            <p className='text-lg mb-4'>Select the patient you want to work on and choose the registed echocardiography to analyse.</p>

            <div className="flex flex-col items-start mb-3">
                <label htmlFor="patient">Patient</label>
                <select 
                    name="patient" 
                    className="px-4 py-2 border-2 border-green-dark w-fit"
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    value={selectedPatientId}
                >
                    <option value="">--- Select a patient ---</option>
                    {patients.map(patient =>
                        <option key={patient.id} value={patient.id}>
                            {patient.name}
                        </option>
                    )}
                </select>
            </div>

            {selectedPatientId && (
                <div className="flex flex-col items-start mb-3">
                    <label htmlFor="echocardiogram">Echocardiography</label>
                    <select
                        name="echocardiogram" 
                        className="px-4 py-2 border-2 border-green-dark w-fit"
                        onChange={(e) => setSelectedEchoId(e.target.value)}
                        value={selectedEchoId}
                    >
                        <option value="">--- Select an echocardiogram ---</option>
                        {patients.find(patient => patient.id == selectedPatientId)?.echocardiograms.map(echo => 
                            <option key={echo.id} value={echo.id}>
                                {echo.description || `Echocardiography ${echo.id}`}
                            </option>
                        )}
                    </select>
                </div>
            )}

            <button 
                onClick={handleSubmit} 
                className={`rounded-lg mt-8 py-1 px-4 text-m text-white ${selectedPatientId && selectedEchoId ? 'bg-green-dark' : 'bg-gray-medium'}`}
            >
                Continue
            </button>

        </MainLayout>
    )
}
