import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { getPatientExams, getPatients } from '../api';

const formatVo = (vo) => (vo !== null && vo !== undefined ? `${Math.round(vo * 100)}%` : 'N/A');

const CompareExams = () => {
  const { patientId, examIdA, examIdB } = useParams();
  const [exams, setExams] = useState([]);
  const [patientName, setPatientName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const [patientExams, patients] = await Promise.all([
        getPatientExams(patientId),
        getPatients(),
      ]);
      setExams(patientExams || []);
      const patient = patients.find((item) => item.id === Number(patientId));
      setPatientName(patient?.name || 'Paciente');
    };
    fetchData();
  }, [patientId]);

  const examA = useMemo(
    () => exams.find((exam) => exam.id === Number(examIdA)),
    [exams, examIdA]
  );
  const examB = useMemo(
    () => exams.find((exam) => exam.id === Number(examIdB)),
    [exams, examIdB]
  );

  const voA = examA?.vo ?? 0;
  const voB = examB?.vo ?? 0;
  const diff = Math.abs(voB - voA);
  const diffPercent = voA ? ((diff / voA) * 100).toFixed(1) : '0.0';
  const trend = voB > voA ? 'pioria' : voB < voA ? 'melhoria' : 'estável';

  return (
    <MainLayout pageTitle="Comparar Exames">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="mb-2">Comparação longitudinal</h3>
          <p className="text-gray-medium-dark">
            {patientName} · Exames {examIdA} vs {examIdB}
          </p>
        </div>
        <button
          className="bg-green-dark text-white px-4 py-2 rounded"
          onClick={() => navigate(-1)}
        >
          Voltar
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {[examA, examB].map((exam, index) => (
          <div key={exam?.id || index} className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold">Exame {index === 0 ? 'A' : 'B'}</h4>
                <p className="text-sm text-gray-medium-dark">{exam?.description || '—'}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                VO {formatVo(exam?.vo)}
              </span>
            </div>
            <div className="aspect-video bg-green-soft rounded-lg flex items-center justify-center overflow-hidden">
              {exam?.frames?.[0] ? (
                <img src={exam.frames[0]} alt={`Frame do exame ${exam?.id}`} className="object-contain w-full h-full" />
              ) : (
                <span className="text-gray-medium-dark">Sem imagem</span>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-700">
              <p><strong>Data:</strong> {exam?.date ? new Date(exam.date).toLocaleDateString('pt-PT') : '—'}</p>
              <p><strong>Tipo:</strong> {exam?.type || '—'}</p>
              <p><strong>Status:</strong> {exam?.status || '—'}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-green-light rounded-xl p-6">
        <h4 className="mb-4">Diferença de VO</h4>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white rounded-lg p-4">
            <p className="text-gray-medium-dark">Diferença absoluta</p>
            <p className="text-xl font-semibold">{(diff * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-gray-medium-dark">Diferença percentual</p>
            <p className="text-xl font-semibold">{diffPercent}%</p>
          </div>
          <div className="bg-white rounded-lg p-4 flex items-center gap-3">
            <div className={`text-2xl ${trend === 'pioria' ? 'text-red' : trend === 'melhoria' ? 'text-green-dark' : 'text-gray-medium-dark'}`}>
              {trend === 'pioria' ? '↑' : trend === 'melhoria' ? '↓' : '→'}
            </div>
            <div>
              <p className="text-gray-medium-dark">Tendência</p>
              <p className="text-lg font-semibold capitalize">{trend}</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default CompareExams;
