import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { deletePatient } from '../api';
import AlertDialogMenu from './AlertDialogMenu';

export default function PatientList({ patients, defaultPatient, reloadTable }) {
  const [rowsPerView, setRowsPerView] = useState(10);
  const [firstRow, setFirstRow] = useState(1);

  const handleNextView = () => firstRow + rowsPerView <= patients.length && setFirstRow(firstRow + rowsPerView);

  const handlePreviousView = () => firstRow - rowsPerView > 0 && setFirstRow(Math.max(0, firstRow - rowsPerView));

  const handleBackToFirstView = () => firstRow > 1 && setFirstRow(1);

  const handleChangeRowsPerView = (e) => {
    if (e.target.value !== '') setRowsPerView(Math.min(Math.max(0, e.target.value), 99));
    else setRowsPerView(10);
  };

  return (
    <div>
      <table className='w-full table-fixed'>
        <thead className='border-b-2'>
          <tr>
            <th className='w-1/20' />
            <th className='w-1/6 px-4 py-2 text-left'>Doente</th>
            <th className='w-1/9 px-4 py-2 text-left'>Atualizado</th>
            <th className='w-1/8 px-4 py-2 text-left'>Estado</th>
            <th className='w-1/6 px-4 py-2 text-left'>Morada</th>
            <th className='w-1/5 px-4 py-2 text-left'>Email</th>
            <th className='1/6 px-4 py-2 text-left'>Exames</th>
            <th className='w-1/20' />
          </tr>
        </thead>
        <tbody>
          {patients
            .map((patient) => (
              <PatientRow
                key={patient.id}
                patient={patient}
                defaultState={defaultPatient == patient.id}
                reloadTable={reloadTable}
              />
            ))
            .slice(firstRow - 1, firstRow + rowsPerView - 1)}
        </tbody>
      </table>
      <div className='flex justify-between mt-5'>
        <div className='flex items-center gap-2'>
          <span>Mostrar</span>
          <input
            type='number'
            defaultValue={10}
            className='w-10 h-5 p-1 text-sm outline-2 rounded-sm'
            onChange={handleChangeRowsPerView}
          />
          <span>por página</span>
        </div>
        <div className='flex gap-2'>
          <button
            className={`mr-4 cursor-pointer ${firstRow > 1 ? 'opacity-100' : 'opacity-500'}`}
            onClick={handleBackToFirstView}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24"><path fill="currentColor" d="M17.59 18L19 16.59L14.42 12L19 7.41L17.59 6l-6 6z"></path><path fill="currentColor" d="m11 18l1.41-1.41L7.83 12l4.58-4.59L11 6l-6 6z"></path></svg>
          </button>
          <button
            className={`rotate-180 cursor-pointer ${firstRow - rowsPerView > 0 ? 'opacity-100' : 'opacity-50'}`}
            onClick={handlePreviousView}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={12} height={20} viewBox="0 0 12 24"><path fillRule="evenodd" d="M10.157 12.711L4.5 18.368l-1.414-1.414l4.95-4.95l-4.95-4.95L4.5 5.64l5.657 5.657a1 1 0 0 1 0 1.414"></path></svg>
          </button>
          <button
            className={`rotate-0 cursor-pointer ${firstRow + rowsPerView <= patients.length ? 'opacity-100' : 'opacity-50'}`}
            onClick={handleNextView}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={12} height={20} viewBox="0 0 12 24"><path fillRule="evenodd" d="M10.157 12.711L4.5 18.368l-1.414-1.414l4.95-4.95l-4.95-4.95L4.5 5.64l5.657 5.657a1 1 0 0 1 0 1.414"></path></svg>
          </button>
          <span>
            {firstRow} - {Math.min(patients.length, firstRow + rowsPerView - 1)} de {patients.length}
          </span>
        </div>
      </div>
    </div>
  );
}

function PatientRow({ patient, defaultState, reloadTable }) {
  const [isOpen, setIsOpen] = useState(defaultState);
  const toggleState = () => setIsOpen(!isOpen);

  const handleDeletePatient = async (patientId) => {
    try {
      await deletePatient(patientId);
      reloadTable();
    } catch (error) {
      console.error('Erro ao eliminar doente:', error);
      alert('Erro ao eliminar doente.');
    }
  };

  return (
    <>
      <tr onClick={toggleState}>
        <td className='px-4 py-3 text-left flex justify-center items-center min-w-10! cursor-pointer'>
          <span className={`transition-transform ease-out duration-500 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 48 48"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M36 18L24 30L12 18"></path></svg>
          </span>
        </td>
        <td className='px-4 py-3 text-left min-w-8 truncate'>{patient.name}</td>
        <td className='px-4 py-3 text-left min-w-8 truncate'>{new Date(patient.updated_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
        <td className='px-4 py-3 text-left min-w-8 truncate'>
          <div className={`w-full py-1 text-white text-center text-sm rounded-md ${patient.status === 'EVALUATED' ? 'bg-green-600' : patient.status === 'UNDER_REVIEW' ? 'bg-amber-600' : 'bg-red'}`}>
            {formatStatus(patient.status)}
          </div>
        </td>
        <td className='px-4 py-3 text-left min-w-8 truncate'>{patient.address}</td>
        <td className='px-4 py-3 text-left min-w-8 truncate'>{patient.email}</td>
        <td className='px-4 py-3 text-left min-w-8 truncate'>{patient.echocardiograms.length}</td>
        <td>
          <AlertDialogMenu
            heading='Eliminar doente'
            content={`Tem a certeza de que pretende eliminar o doente "${patient.name}"? Esta ação não pode ser anulada.`}
            onConfirm={() => handleDeletePatient(patient.id)}
          >
            <button onClick={(event) => event.stopPropagation()}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 12 12"><path fill="#000" d="M5 3h2a1 1 0 0 0-2 0M4 3a2 2 0 1 1 4 0h2.5a.5.5 0 0 1 0 1h-.441l-.443 5.17A2 2 0 0 1 7.623 11H4.377a2 2 0 0 1-1.993-1.83L1.941 4H1.5a.5.5 0 0 1 0-1zm3.5 3a.5.5 0 0 0-1 0v2a.5.5 0 0 0 1 0zM5 5.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5M3.38 9.085a1 1 0 0 0 .997.915h3.246a1 1 0 0 0 .996-.915L9.055 4h-6.11z" /></svg>
            </button>
          </AlertDialogMenu>
        </td>
      </tr>
      <tr className='bg-green-light'>
        <td colSpan={7} className='p-0! text-left min-w-8'>
          <div className={`patient-row-menu transition-[height] ease-out duration-500 overflow-hidden ${isOpen ? 'h-auto' : 'h-0'}`}>
            <div className="px-15! py-4! border-b-2 border-b-gray-medium">
              <h6 className='mb-3'>Ecocardiogramas</h6>
              {patient.echocardiograms?.length > 0 ? (
                <EchocardiogramsTable patient={patient} reloadTable={reloadTable} />
              ) : (
                <em>Sem ecocardiogramas.</em>
              )}
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

function EchocardiogramsTable({ patient, reloadTable }) {
  const navigate = useNavigate();
  const [selectedExams, setSelectedExams] = useState([]);

  const reportsByExam = useMemo(() => {
    const map = {};
    patient.reports?.forEach((report) => {
      if (!map[report.examId]) {
        map[report.examId] = report;
      }
    });
    return map;
  }, [patient.reports]);

  const handleToggleExam = (examId) => {
    setSelectedExams((prev) => {
      if (prev.includes(examId)) {
        return prev.filter((id) => id !== examId);
      }
      if (prev.length >= 2) {
        return prev;
      }
      return [...prev, examId];
    });
  };

  const handleDeleteEchocardiogram = async (echo) => {
    try {
      await api.delete(`/api/patient/${patient.id}/echocardiogram/${echo.id}/delete/`);
      reloadTable();
    } catch (error) {
      console.error('Erro ao eliminar ecocardiograma', error);
    }
  };

  return (
    <div>
      <div className='flex items-center justify-between mb-3 text-sm text-gray-medium-dark'>
        <span>Selecione dois exames para comparar.</span>
        <button
          className='bg-green-dark text-white px-3 py-1 rounded disabled:opacity-50'
          onClick={() => navigate(`/patients/${patient.id}/compare/${selectedExams[0]}/${selectedExams[1]}`)}
          disabled={selectedExams.length !== 2}
        >
          Comparar exames
        </button>
      </div>
      <table className='table-fixed w-full border-collapse'>
        <thead>
          <tr>
            <th className="w-1/10 px-4 py-1 text-left truncate border-b-2">Comparar</th>
            <th className="w-1/4 px-4 py-1 text-left truncate border-b-2">Exame</th>
            <th className="w-1/6 px-4 py-1 text-left truncate border-b-2">Data</th>
            <th className="w-1/8 px-4 py-1 text-left truncate border-b-2">
              <span className="inline-flex items-center gap-2">
                VO
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-semibold"
                  title="A VO representa o grau estimado de calcificação e serve para comparar exames ao longo do tempo."
                >
                  ?
                </span>
              </span>
            </th>
            <th className="w-1/6 px-4 py-1 text-left truncate border-b-2">Risco</th>
            <th className="w-1/4 px-4 py-1 text-left truncate border-b-2">Relatório</th>
            <th className="w-1/10 pl-8 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {patient.echocardiograms?.map((echo, index) => {
            const risk = getRiskBadge(echo.vo);
            const report = reportsByExam[echo.id];
            return (
              <tr key={index}>
                <td className="px-4 py-1">
                  <input
                    type="checkbox"
                    checked={selectedExams.includes(echo.id)}
                    onChange={() => handleToggleExam(echo.id)}
                    disabled={!selectedExams.includes(echo.id) && selectedExams.length >= 2}
                  />
                </td>
                <td className="px-4 py-1"><strong>{echo.description}</strong></td>
                <td className="px-4 py-1"><em>{new Date(echo.date || echo.uploaded_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</em></td>
                <td className="px-4 py-1">{echo.vo !== undefined ? `${Math.round(echo.vo * 100)}%` : '—'}</td>
                <td className="px-4 py-1">
                  {risk && (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${risk.className}`}>
                      {risk.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-1">
                  {report ? (
                    <button
                      className='text-green-dark underline'
                      onClick={() => window.open(report.report_url)}
                    >
                      {report.pdf_name || 'Relatório.pdf'}
                    </button>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td>
                  <div className='flex justify-end gap-2'>
                    <button
                      className='block bg-green rounded-lg p-[6px] text-white text-sm'
                      onClick={() => window.open(`/analyse_aortic_valve/${patient.id}/${echo.id}`, '_blank')}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="m18.988 2.012l3 3L19.701 7.3l-3-3zM8 16h3l7.287-7.287l-3-3L8 13z"/><path fill="currentColor" d="M19 19H8.158c-.026 0-.053.01-.079.01c-.033 0-.066-.009-.1-.01H5V5h6.847l2-2H5c-1.103 0-2 .896-2 2v14c0 1.104.897 2 2 2h14a2 2 0 0 0 2-2v-8.668l-2 2z"/></svg>
                    </button>
                    <AlertDialogMenu
                      heading='Eliminar ecocardiograma'
                      content={`Tem a certeza de que pretende eliminar o ecocardiograma "${echo.description}"? Esta ação não pode ser anulada.`}
                      onConfirm={() => handleDeleteEchocardiogram(echo)}
                    >
                      <button className='block bg-red rounded-lg p-[6px] text-white text-sm'>
                        <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="M8.106 2.553A1 1 0 0 1 9 2h6a1 1 0 0 1 .894.553L17.618 6H20a1 1 0 1 1 0 2h-1v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8H4a1 1 0 0 1 0-2h2.382zM14.382 4l1 2H8.618l1-2zM11 11a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0zm4 0a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0z" clipRule="evenodd"></path></svg>
                      </button>
                    </AlertDialogMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const formatStatus = (text) => {
  return text
    .replace('_', ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getRiskBadge = (vo) => {
  if (vo === undefined || vo === null) return null;
  if (vo < 0.33) {
    return { label: 'Baixo', className: 'bg-green-600 text-white' };
  }
  if (vo < 0.66) {
    return { label: 'Médio', className: 'bg-orange-500 text-white' };
  }
  return { label: 'Alto', className: 'bg-red text-white' };
};
