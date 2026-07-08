import { useState, useEffect } from 'react';
import { getPatients, getEchoResults, createReport } from '../api';
import MainLayout from "../layouts/MainLayout.jsx";
import ReportPDF from '../components/ReportPDF.jsx';
import { useUser } from '../contexts/UserContext';
import { pdf } from '@react-pdf/renderer';
import { getPatientAge } from "../utils/patientAge";

const Reports = () => {
    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [echoData, setEchoData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [patients, setPatients] = useState([]);
    const { user } = useUser();

    // Fetch patient list
    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const data = await getPatients()

                const evaluatedPatients = data.filter(patient => patient.status === 'EVALUATED' && patient.has_report === false);

                setPatients(evaluatedPatients)
                setFilteredPatients(evaluatedPatients)
            } catch (error) {
                console.error(error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchPatients();
    }, []);

    // Fetch echocardiogram
    useEffect(() => {
        const fetchEchoData = async () => {
            if (selectedPatientId) {
                setIsLoading(true);
                try {
                    const data = await getEchoResults(selectedPatientId);
                    setEchoData(data || []);
                } catch (error) {
                    console.error('Error fetching echo data:', error);
                    setEchoData([]);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        fetchEchoData();
    }, [selectedPatientId]);

    const selectedPatient = patients.find(p => p.id === selectedPatientId);

    const generatePdfBlob = async (echoData, selectedPatient, user) => {
        const doc = <ReportPDF data={echoData} patient={selectedPatient} medico={user} />;
        const asPdf = pdf([]);
        asPdf.updateContainer(doc);
        const blob = await asPdf.toBlob();
        return blob;
    };

    return (
        <MainLayout pageTitle="Medical Reports">
            <div className="">
                <h3 className="font-bold mb-4">AI Reports</h3>
                <p className="mb-10 text-lg">On this page, you will find patients whose echocardiograms have already been analyzed, but whose reports have not yet been generated with the assistance of AI.
                    <br /> Please select a patient to proceed with the report generation.</p>
                {/* Patient List */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Select Patient</h2>
                    <div>
                        <table className="w-full table-fixed bg-green-light shadow-md">
                            <thead className='border-b-2'>
                                <tr>
                                    <th className='w-[9%] p-3 text-center'>Select</th>
                                    <th className='w-[20%] p-3 text-left'>Patient</th>
                                    <th className='w-[15%] p-3 text-left'>Age</th>
                                    <th className='w-[20%] p-3 text-left'>Email</th>
                                    <th className='w-[25%] p-3 text-center'>Review Status</th>
                                    <th className='w-[15%] p-3 text-left'>Echos</th>
                                </tr>
                            </thead>
                            <tbody className="w-full table-fixed">
                                {patients.length > 0 ? (
                                    patients.map(patient => (
                                        <tr key={patient.id}>
                                            <td className="text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPatientId === patient.id}
                                                    onChange={() => setSelectedPatientId(patient.id)}
                                                />
                                            </td>
                                            <td className="p-3 text-left">{patient.name}</td>
                                            <td className="align-middle text-left p-2">{getPatientAge(patient) ?? "N/D"}</td>
                                            <td className="align-middle text-left p-2">{patient.email}</td>
                                            <td className="px-35  ">
                                                <div className={`w-28 py-[4px] text-sm text-white text-center rounded-md bg-green-600`}>
                                                    {patient.status}
                                                </div>
                                            </td>
                                            <td className="align-middle text-left p-2">{patient.echocardiograms.length}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="px-4 py-2 border text-center">
                                            No patients found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Echo Data Preview */}
                {selectedPatientId && (
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <h2 className="text-lg font-semibold mb-4">Dados do ecocardiograma</h2>

                        {isLoading ? (
                            <p>A carregar dados...</p>
                        ) : echoData.length > 0 ? (
                            <>
                                <div className="mb-4 space-y-3">
                                    {echoData.map((item, index) => (
                                        <div key={index} className="bg-white p-8 rounded shadow flex justify-between items-center">
                                            <p><strong>Frame:</strong> {item.frame || 'N/D'}</p>
                                            <p>
                                                <strong>Posição:</strong> X: {item.rects?.x ?? 'N/D'} , Y: {item.rects?.y ?? 'N/D'}
                                            </p>
                                            <p>
                                                <strong>Tamanho:</strong> {item.rects?.width ?? 'N/D'} x {item.rects?.height ?? 'N/D'}
                                            </p>
                                            <p>
                                                <strong>Calcificada:</strong> {item.is_calcified ? 'Sim' : 'Não'}
                                            </p>
                                            <p>
                                                <strong>Confiança:</strong> {item.confidence ?? 'N/D'} %
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    className="bg-green text-white py-2 px-4 rounded"
                                    onClick={async () => {
                                        if (!selectedPatientId) {
                                            alert("Selecione um doente.");
                                            return;
                                        }
                                        try {
                                            const pdfBlob = await generatePdfBlob(echoData, selectedPatient, user);
                                            const formData = new FormData();
                                            formData.append("pdf_file", pdfBlob, `report_${selectedPatientId}.pdf`);

                                            await createReport(formData, selectedPatientId);
                                            alert("Relatório enviado e guardado com sucesso.");
                                        } catch (err) {
                                            console.error("Erro completo:", err);
                                            alert("Erro ao enviar relatório: " + (err.response?.data?.error || err.message));
                                        }
                                    }}
                                >
                                    Gerar relatório
                                </button>
                            </>
                        ) : (
                            <p>Não existem dados disponíveis para este doente.</p>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default Reports;
