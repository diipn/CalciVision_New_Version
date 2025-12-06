import { useState } from 'react';
import UploadDicomFiles from '@components/UploadDicomFiles';
import api, { deletePatient, deleteReport } from '../api';
import AlertDialogMenu from './AlertDialogMenu';
import pdfIcon from '../assets/img/pdf_icon.png'
import ReportDropdown from './ReportDropdown';

export default function PatientList({ patients, defaultPatient, reloadTable }) {

    const [rowsPerView, setRowsPerView] = useState(10)
    const [firstRow, setFirstRow] = useState(1)

    const handleNextView = () => firstRow + rowsPerView <= patients.length && setFirstRow(firstRow + rowsPerView)

    const handlePreviousView = () => firstRow - rowsPerView > 0 && setFirstRow(Math.max(0, firstRow - rowsPerView))

    const handleBackToFirstView = () => firstRow > 1 && setFirstRow(1)

    const handleChangeRowsPerView = (e) => {
        if (e.target.value !== '')
            setRowsPerView(Math.min(Math.max(0, e.target.value), 99))
        else
            setRowsPerView(10)
    }

    return (
        <div>
            <table className='w-full table-fixed'>
                <thead className='border-b-2'>
                    <tr>
                        <th className='w-1/20' />
                        <th className='w-1/6 px-4 py-2 text-left'>Patient</th>
                        <th className='w-1/9 px-4 py-2 text-left'>Updated</th>
                        <th className='w-1/8 px-4 py-2 text-left'>Review Status</th>
                        <th className='w-1/6 px-4 py-2 text-left'>Address</th>
                        <th className='w-1/5 px-4 py-2 text-left'>Email</th>
                        <th className='1/6 px-4 py-2 text-left'>Echos</th>
                        <th className='w-1/20' />
                    </tr>
                </thead>
                <tbody>
                    {patients.map(patient => 
                        <PatientRow 
                            key={patient.id} 
                            patient={patient} 
                            defaultState={defaultPatient == patient.id}
                            reloadTable={reloadTable} 
                        />
                    ).slice(firstRow - 1, firstRow + rowsPerView - 1)}
                </tbody>
            </table>
            <div className='flex justify-between mt-5'>
                <div className='flex items-center gap-2'>
                    <span>Show</span>
                    <input
                        type='number'
                        defaultValue={10}
                        className='w-10 h-5 p-1 text-sm outline-2 rounded-sm'
                        onChange={handleChangeRowsPerView}
                    />
                    <span>per view</span>
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
                        {firstRow} - {Math.min(patients.length, firstRow + rowsPerView - 1)} of {patients.length}
                    </span>
                </div>
            </div>
        </div>
    );
}

function PatientRow({ patient, defaultState, reloadTable }) {

    const [isOpen, setIsOpen] = useState(defaultState)
    const toggleState = () => setIsOpen(!isOpen)

    const handleDeletePatient = async (patientId) => {
        try {
            await deletePatient(patientId);
            reloadTable()
        } catch (error) {
            console.error('Erro ao deletar paciente:', error);
            alert('Erro ao deletar paciente.');
        }
    };

    const handleDeleteReport = async (reportId) => {
        try {
            await deleteReport(reportId);
            reloadTable()
        } catch (error) {
            console.error('Erro ao deletar relatório:', error);
            alert('Erro ao deletar relatório.');
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
                        heading='Delete Patient'
                        content={`Are you sure you want to delete patient "${patient.name}"? This action cannot be undone.`}
                        onConfirm={(e) => handleDeletePatient(patient.id)}
                    >
                        <button onClick={(e) => e.stopPropagation()}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 12 12"><path fill="#000" d="M5 3h2a1 1 0 0 0-2 0M4 3a2 2 0 1 1 4 0h2.5a.5.5 0 0 1 0 1h-.441l-.443 5.17A2 2 0 0 1 7.623 11H4.377a2 2 0 0 1-1.993-1.83L1.941 4H1.5a.5.5 0 0 1 0-1zm3.5 3a.5.5 0 0 0-1 0v2a.5.5 0 0 0 1 0zM5 5.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5M3.38 9.085a1 1 0 0 0 .997.915h3.246a1 1 0 0 0 .996-.915L9.055 4h-6.11z" /></svg>
                        </button>
                    </AlertDialogMenu>
                </td>
            </tr>
            <tr className='bg-red-light'>
                <td colSpan={7} className='p-0! text-left min-w-8'>
                    <div className={`patient-row-menu transition-[height] ease-out duration-500 overflow-hidden ${isOpen ? 'h-auto' : 'h-0'}`}>
                        <div className="grid xl:grid-cols-[60%_40%] xl:grid-rows-1 grid-rows-2 gap-12 px-15! py-4! border-b-2 border-b-gray-medium">
                            <div>
                                <h6 className='mb-3'>Echocardiograms</h6>
                                {patient.echocardiograms?.length > 0 ? (
                                    <EchocardiogramsTable patient={patient} reloadTable={reloadTable} />
                                ) : (
                                    <em>No echocardiograms found.</em>
                                )}
                                {patient && <UploadDicomFiles patientId={patient.id} reloadTable={reloadTable} />}
                            </div>
                            <div>
                                <h6 className='mb-3'>Reports</h6>
                                {patient.reports?.length > 0 ? (
                                    <ul className='flex flex-col gap-2'>
                                        {patient.reports.map((report, idx) =>
                                            <li key={idx} className='relative grid grid-cols-[auto_1fr] items-center gap-2 w-full p-3 bg-white rounded-md'>
                                                <img src={pdfIcon} alt='pdf' className='size-8'/>
                                                <div onClick={() => window.open(report.report_url)} className='flex flex-col justify-between cursor-pointer' role='button'>
                                                    <strong className='text-large font-semibold'>{report.pdf_name}</strong>
                                                    <p className='text-sm text-gray-medium-dark'>{report.pdf_size} KB</p>
                                                </div>
                                                <ReportDropdown report={report} handleDeleteReport={handleDeleteReport}>
                                                    <button className='absolute right-3 top-1/2 -translate-y-1/2'>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0m0-6a2 2 0 1 0 4 0a2 2 0 0 0-4 0m0 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0"></path></svg>
                                                    </button>
                                                </ReportDropdown>
                                            </li>
                                        )}
                                    </ul>
                                ) : (
                                    <em>No reports found.</em>
                                )}
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        </>
    )
}

function EchocardiogramsTable({ patient, reloadTable }) {

    const handleDeleteEchocardiogram = async (echo) => {
        try {
            await api.delete(`/api/patient/${patient.id}/echocardiogram/${echo.id}/delete/`)
            reloadTable()
        } catch(error) {
            console.error('Error deleting echocardiogram', error)
        }
    }
    
    return (
        <table className='table-fixed w-full border-collapse'>
            <thead>
                <tr className=''>
                    <th className="w-2/7 px-4 py-1 text-left truncate border-b-2">Name</th>
                    <th className="w-1/5 px-4 py-1 text-left truncate border-b-2">Status</th>
                    <th className="w-1/4 px-4 py-1 text-left truncate border-b-2">Uploaded</th>
                    <th className="w-1/8 pl-8 py-1"></th>
                </tr>
            </thead>
            <tbody>
                {patient.echocardiograms?.map((echo, index) =>
                    <tr key={index}>
                        <td className="px-4 py-1"><strong>{echo.description}</strong></td>
                        <td className="px-4 py-1">
                            <div className={`w-28 py-[3px] text-sm bg-white text-center rounded-md ${echo.status === 'EVALUATED' ? 'text-green-600' : echo.status === 'IN_PROGRESS' ? 'text-amber-600' : 'text-red'}`}>
                                {formatStatus(echo.status)}
                            </div>
                        </td>
                        <td className="px-4 py-1"><em>{new Date(echo.uploaded_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</em></td>
                        <td>
                            <div className='flex justify-end gap-2'>
                                <button 
                                    className='block bg-blue-500 rounded-lg p-[6px] text-white text-sm'
                                    onClick={() => window.open(`/analyse_aortic_valve/${patient.id}/${echo.id}`, '_blank')}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="m18.988 2.012l3 3L19.701 7.3l-3-3zM8 16h3l7.287-7.287l-3-3L8 13z"/><path fill="currentColor" d="M19 19H8.158c-.026 0-.053.01-.079.01c-.033 0-.066-.009-.1-.01H5V5h6.847l2-2H5c-1.103 0-2 .896-2 2v14c0 1.104.897 2 2 2h14a2 2 0 0 0 2-2v-8.668l-2 2z"/></svg>
                                </button>
                                <AlertDialogMenu
                                    heading='Delete Echocardiogram'
                                    content={`Are you sure you want to delete echocariogram "${echo.description}"? This action cannot be undone.`}
                                    onConfirm={() => handleDeleteEchocardiogram(echo)}
                                >
                                    <button className='block bg-red rounded-lg p-[6px] text-white text-sm'>
                                        <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="M8.106 2.553A1 1 0 0 1 9 2h6a1 1 0 0 1 .894.553L17.618 6H20a1 1 0 1 1 0 2h-1v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8H4a1 1 0 0 1 0-2h2.382zM14.382 4l1 2H8.618l1-2zM11 11a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0zm4 0a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0z" clipRule="evenodd"></path></svg>
                                    </button>
                                </AlertDialogMenu>
                            </div>
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    )
}

const formatStatus = (text) => {
    return text.replace('_', ' ').toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}