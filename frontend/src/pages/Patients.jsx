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

export default function Patients() {

  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);

  const [searchTerm, setSearchTerm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const { startScreening } = usePatientScreening();

  const [searchParams] = useSearchParams();

  const pendingPatients = patients.filter(patient => patient.status === 'PENDING' && patient.echocardiograms.length > 0)

  const fetchPatients = async () => {
    try {
      const data = await getPatients()
      setPatients(data)
      setFilteredPatients(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatients()
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredPatients(patients)
      return
    }
    setFilteredPatients(() =>
      patients.filter(patient => patient.name.toLowerCase().includes(searchTerm))
    )
  }, [searchTerm])

  const handleSearchType = (e) => {
    setSearchTerm(e.target.value !== '' ? e.target.value.toLowerCase() : null)
  }

  const handlePatientScreening = async () => {
    try {
      await startScreening()
    } catch(error) {
      console.error('Error during patient screening:', error)
    }
  }

  return (
    <MainLayout pageTitle="Patients - CalciVision">
      
      {showRegister && (
        <PatientRegister onClose={() => setShowRegister(false)} />
      )}

      <h3 className='mb-4'>Patients</h3>
      <p className='text-lg mb-8'>On this page you can manage all your patients, view echocardiograms and access aortic valve analysis reports.</p>
      <div className='flex justify-start items-center mb-5'>
        <div className='mr-auto flex items-center gap-4'>
          <button
            className='w-fit py-1 px-3 flex items-center gap-2 rounded-lg bg-green text-white'
            onClick={() => setShowRegister(true)}
          >
            Add New Patient
            <img className='w-5 h-5 object-contain' src={addIcon} alt="Add" role="icon" />
          </button>

          <AlertDialogMenu
            heading='Patient Screening Preview'
            content={
              pendingPatients.length === 0 ? (
                <p className='text-red'>No patients with pending echocardiographic assessments.</p>
              ) : (
                <div className='flex flex-col gap-2'>
                  <p>You are about to initiate automated analysis for all patients with pending echocardiographic assessments.</p>
                  {pendingPatients.length <= 3 ? (
                    <p>A total of <strong>{pendingPatients.length} patient(s)</strong> have been selected: {pendingPatients.map(p => p.name).join(', ')}.</p>
                  ) : (
                    <p>A total of <strong>{pendingPatients.length} patients</strong> have been selected, including {pendingPatients.slice(0, 3).map(p => p.name).join(', ')} and {pendingPatients.length - 3} additional individuals.</p>
                  )}
                  <p>Would you like to proceed?</p>
                </div>
              )}
            onConfirm={handlePatientScreening}
          >
            <button className='w-fit py-1 px-3 flex items-center gap-2 rounded-lg bg-green text-white'>
              Patient Screening
              <img className='w-5 h-5 object-contain' src={patientScreeningIcon} alt="Patient Screening" role="icon" />
            </button>
          </AlertDialogMenu>
        </div>
        <div className='w-fit px-3 mr-4 flex items-center rounded-lg outline-1 bg-white outline-gray-medium-dark'>
          <button className='w-4 h-4 mr-2 grid place-items-center bg-transparent cursor-pointer'>
            <img className='w-full h-full object-contain' src={magnifyingGlassIcon} alt="Search" role="icon" />
          </button>
          <input
            id='search-input'
            type='search'
            autoComplete='on'
            role='input'
            placeholder='Search'
            className='w-48 grow p-1 outline-none'
            onChange={handleSearchType}
          />
        </div>
        <button className='w-fit py-1 px-3 flex items-center gap-2 rounded-lg outline-1 outline-gray-dark'>
          <img className='w-4 h-4 object-contain' src={filterIcon} alt="Search" role="icon" />
          <span>Add Filter</span>
        </button>
      </div>
      {loading ? (
        <div>Fetching patients...</div>
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
