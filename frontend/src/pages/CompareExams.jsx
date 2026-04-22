import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import api, { getPatientExams, getPatients } from '../api';

const normalizeVo = (vo) => {
  if (vo === null || vo === undefined) return null;
  return vo > 1 ? vo / 100 : vo;
};

const formatVo = (vo) => {
  const normalized = normalizeVo(vo);
  return normalized !== null ? `${Math.round(normalized * 100)}%` : 'N/A';
};

const getRiskBadge = (vo) => {
  const normalized = normalizeVo(vo);
  if (normalized === null) return null;
  if (normalized < 0.33) {
    return { label: 'Baixo', className: 'bg-green-600 text-white' };
  }
  if (normalized < 0.66) {
    return { label: 'Médio', className: 'bg-orange-500 text-white' };
  }
  return { label: 'Alto', className: 'bg-red text-white' };
};

const CompareExams = () => {
  const { patientId, examIdA, examIdB } = useParams();
  const [exams, setExams] = useState([]);
  const [patientName, setPatientName] = useState('');
  const [previewFrames, setPreviewFrames] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const [patientExams, patients, framesAResponse, framesBResponse] = await Promise.all([
        getPatientExams(patientId),
        getPatients(),
        api
          .get(`/api/patient/${patientId}/echocardiogram/${examIdA}/frames/`)
          .catch(() => ({ data: [] })),
        api
          .get(`/api/patient/${patientId}/echocardiogram/${examIdB}/frames/`)
          .catch(() => ({ data: [] })),
      ]);
      setExams(patientExams || []);
      const patient = patients.find((item) => item.id === Number(patientId));
      setPatientName(patient?.name || 'Paciente');
      setPreviewFrames({
        [examIdA]: framesAResponse?.data?.[0]?.image_url || null,
        [examIdB]: framesBResponse?.data?.[0]?.image_url || null,
      });
    };
    fetchData();
  }, [patientId, examIdA, examIdB]);

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
              {previewFrames[exam?.id] ? (
                <img
                  src={previewFrames[exam?.id]}
                  alt={`Frame do exame ${exam?.id}`}
                  className="object-contain w-full h-full"
                />
              ) : (
                <span className="text-gray-medium-dark">Pré-visualização indisponível</span>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-700">
              <p><strong>Data:</strong> {(exam?.date || exam?.uploaded_at) ? new Date(exam.date || exam.uploaded_at).toLocaleDateString('pt-PT') : '—'}</p>
              <p>
                <strong>Risco:</strong>{' '}
                {getRiskBadge(exam?.vo) ? (
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskBadge(exam?.vo).className}`}>
                    {getRiskBadge(exam?.vo).label}
                  </span>
                ) : (
                  '—'
                )}
              </p>
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
