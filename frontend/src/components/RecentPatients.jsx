import React, { useState, useEffect } from 'react';
import { getPatients } from '../api';
import userPatient from "@images/userPatient.png";
import userMen from "@images/userMen.png";
import userWomen from "@images/userWomen.png";
import userOther from "@images/userOther.png";
import { useNavigate } from 'react-router-dom';

const RecentPatients = () => {
    const [patients, setPatients] = useState([]);
    const navigate = useNavigate()

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const data = await getPatients({ limit: 3 });
                setPatients(data);
            } catch (error) {
                console.error('Failed to fetch patients:', error);
            }
        };
        fetchPatients();
    }, []);

    return (
        <div>
            <div className='flex items-center justify-between'>
                <h4>Doentes recentes</h4>
                <button
                    className="ml-6 px-2 cursor-pointer"
                    onClick={() => navigate('/patients')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path strokeDasharray="20" strokeDashoffset="20" d="M3 3v18"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.2s" values="20;0" /></path><path strokeDasharray="16" strokeDashoffset="16" d="M7 12h13.5"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.3s" dur="0.2s" values="16;0" /></path><path strokeDasharray="12" strokeDashoffset="12" d="M21 12l-7 7M21 12l-7 -7"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.5s" dur="0.2s" values="12;0" /></path></g></svg>
                </button>
            </div>
            <ul>
                {patients.map((patient) => {
                    const gender = patient.gender || patient.sex;
                    const statusLabel =
                        patient.status === 'EVALUATED'
                            ? 'Avaliado'
                            : patient.status === 'UNDER_REVIEW'
                            ? 'Em revisão'
                            : 'Pendente';
                    return (
                    <li 
                        key={patient.id} 
                        className={`${patient.status === 'EVALUATED' ? 'bg-green-200' : patient.status === 'PENDING' ? 'bg-green-soft' : 'bg-orange-200'} mt-4 rounded-lg p-4 shadow-md flex items-center gap-4`}
                    >                        <div className='border-2 border-green rounded-full overflow-clip w-14 h-14'>
                            <img
                                src={gender === 'M' ? userMen : gender === 'F' ? userWomen : gender === 'O' ? userOther : userPatient}
                                alt={patient.name}
                                role='img'
                                className='w-full h-full object-cover'
                            />
                        </div>
                        <div className='flex flex-col justify-between h-full'>
                            <h5 className='text-lg font-semibold'>{patient.name}</h5>
                            <div className='flex items-center gap-1 text-sm text-gray-medium-dark'>
                                <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="M14.25 2.5a.25.25 0 0 0-.25-.25H7A2.75 2.75 0 0 0 4.25 5v14A2.75 2.75 0 0 0 7 21.75h10A2.75 2.75 0 0 0 19.75 19V9.147a.25.25 0 0 0-.25-.25H15a.75.75 0 0 1-.75-.75zm.75 9.75a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1 0-1.5zm0 4a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1 0-1.5z" clipRule="evenodd"></path><path fill="currentColor" d="M15.75 2.824c0-.184.193-.301.336-.186q.182.147.323.342l3.013 4.197c.068.096-.006.22-.124.22H16a.25.25 0 0 1-.25-.25z"></path></svg>
                                <span className='mr-3'>{statusLabel}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"><path fill="currentColor" d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V1m-1 11h-5v5h5z"></path></svg>
                                <span>{new Date(patient.updated_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                            </div>
                        </div>
                        <button 
                            className='grid place-items-center rounded-full bg-white p-1 ml-auto mr-2' 
                            onClick={() => navigate(`/patients?patient=${patient.id}`)}
                            role='button'
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m10 17l5-5m0 0l-5-5"></path></svg>
                        </button>
                    </li>
                )})}
            </ul>
        </div>
    );
};

export default RecentPatients;
