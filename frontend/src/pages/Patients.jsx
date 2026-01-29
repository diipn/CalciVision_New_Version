import { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import PatientList from '../components/PatientList';
import PatientRegister from '../components/PatientRegister';
import { getPatients } from '../api';
import magnifyingGlassIcon from "@assets/icons/magnifying_glass.svg";
import filterIcon from "@assets/icons/filter.svg";
import addIcon from "@assets/icons/add.svg";
import patientScreeningIcon from "@assets/icons/patient_screening.svg";
import { useSearchParams } from 'react-router-dom';
import AlertDialogMenu from '../components/AlertDialogMenu';
import { usePatientScreening } from '../hooks/usePatientScreening';

const getRiskLabel = (vo) => {
  if (vo === undefined || vo === null) return null;
  if (vo < 0.33) return 'Baixo';
  if (vo < 0.66) return 'Médio';
  return 'Alto';
};

const getLocalVoOverride = (echoId) => {
  if (!echoId) return null;
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(`exam-settings-${echoId}`);
    if (!raw) return null;
    const settings = JSON.parse(raw);
    if (!settings?.voOverrideEnabled) return null;
    const value = Number(settings.voOverrideValue);
    if (!Number.isFinite(value)) return null;
    return value > 1 ? value / 100 : value;
  } catch {
    return null;
  }
};

const applyLocalVoOverrides = (patients) =>
  (patients || []).map((patient) => ({
    ...patient,
    echocardiograms: (patient.echocardiograms || []).map((echo) => {
      const overrideVo = getLocalVoOverride(echo?.id);
      if (overrideVo === null || overrideVo === undefined) return echo;
      return { ...echo, vo: overrideVo };
    }),
  }));

export default function Patients() {

  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const { startScreening } = usePatientScreening();

  const [searchParams] = useSearchParams();

  const pendingPatients = patients.filter(patient => patient.status === 'PENDING' && patient.echocardiograms.length > 0);

  const fetchPatients = async () => {
    try {
      const data = await getPatients();
      const hydrated = applyLocalVoOverrides(data);
      setPatients(hydrated);
      setFilteredPatients(hydrated);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = patients.filter((patient) => {
      const matchesName = normalizedSearch
        ? patient.name.toLowerCase().includes(normalizedSearch)
        : true;

      const matchesRisk = riskFilter
        ? patient.echocardiograms?.some((echo) => getRiskLabel(echo.vo) === riskFilter)
        : true;

      const matchesDate =
        dateFrom || dateTo
          ? patient.echocardiograms?.some((echo) => {
              const echoDate = new Date(echo.date || echo.uploaded_at);
              const fromOk = dateFrom ? echoDate >= new Date(dateFrom) : true;
              const toOk = dateTo ? echoDate <= new Date(dateTo) : true;
              return fromOk && toOk;
            })
          : true;

      return matchesName && matchesRisk && matchesDate;
    });

    setFilteredPatients(filtered);
  }, [patients, searchTerm, riskFilter, dateFrom, dateTo]);

  const handlePatientScreening = async () => {
    try {
      await startScreening();
    } catch (error) {
      console.error('Erro durante a triagem automática:', error);
    }
  };

  return (
    <MainLayout pageTitle="Doentes - CalciVision">

      {showRegister && (
        <PatientRegister onClose={() => setShowRegister(false)} />
      )}

      <h3 className='mb-4'>Doentes</h3>
      <p className='text-lg mb-8'>Nesta página pode gerir todos os doentes, consultar ecocardiogramas e aceder a relatórios da válvula aórtica.</p>
      <div className='flex flex-wrap justify-start items-center mb-5 gap-4'>
        <div className='mr-auto flex items-center gap-4 flex-wrap'>
          <button
            className='w-fit py-1 px-3 flex items-center gap-2 rounded-lg bg-green text-white'
            onClick={() => setShowRegister(true)}
          >
            Adicionar doente
            <img className='w-5 h-5 object-contain' src={addIcon} alt="Adicionar" role="icon" />
          </button>

          <AlertDialogMenu
            heading='Pré-visualização da triagem'
            content={
              pendingPatients.length === 0 ? (
                <p className='text-red'>Não existem doentes com avaliações pendentes.</p>
              ) : (
                <div className='flex flex-col gap-2'>
                  <p>Vai iniciar a análise automática para todos os doentes com ecocardiogramas pendentes.</p>
                  {pendingPatients.length <= 3 ? (
                    <p>Foram selecionados <strong>{pendingPatients.length} doente(s)</strong>: {pendingPatients.map(p => p.name).join(', ')}.</p>
                  ) : (
                    <p>Foram selecionados <strong>{pendingPatients.length} doentes</strong>, incluindo {pendingPatients.slice(0, 3).map(p => p.name).join(', ')} e mais {pendingPatients.length - 3} adicionais.</p>
                  )}
                  <p>Deseja continuar?</p>
                </div>
              )
            }
            onConfirm={handlePatientScreening}
          >
            <button className='w-fit py-1 px-3 flex items-center gap-2 rounded-lg bg-green text-white'>
              Triagem automática
              <img className='w-5 h-5 object-contain' src={patientScreeningIcon} alt="Triagem automática" role="icon" />
            </button>
          </AlertDialogMenu>
        </div>
        <div className='w-fit px-3 mr-4 flex items-center rounded-lg outline-1 bg-white outline-gray-medium-dark'>
          <button className='w-4 h-4 mr-2 grid place-items-center bg-transparent cursor-pointer'>
            <img className='w-full h-full object-contain' src={magnifyingGlassIcon} alt="Pesquisar" role="icon" />
          </button>
          <input
            id='search-input'
            type='search'
            autoComplete='on'
            role='input'
            placeholder='Pesquisar doente'
            className='w-48 grow p-1 outline-none'
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className='flex items-center gap-2'>
          <img className='w-4 h-4 object-contain' src={filterIcon} alt="Filtro" role="icon" />
          <select
            className='px-2 py-1 rounded-lg border border-gray-medium-dark'
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value)}
          >
            <option value=''>Risco (todos)</option>
            <option value='Baixo'>Baixo</option>
            <option value='Médio'>Médio</option>
            <option value='Alto'>Alto</option>
          </select>
          <input
            type='date'
            className='px-2 py-1 rounded-lg border border-gray-medium-dark'
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <input
            type='date'
            className='px-2 py-1 rounded-lg border border-gray-medium-dark'
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <div>A carregar doentes...</div>
      ) : (
        <PatientList
          patients={filteredPatients}
          defaultPatient={searchParams.get('patient')}
          reloadTable={fetchPatients}
        />
      )}
    </MainLayout>
  );
}
