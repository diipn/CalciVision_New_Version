import { Link, useNavigate } from "react-router-dom";
import { useUser } from '../contexts/UserContext'
import avatar from "@assets/img/doctorImage.png";

export default function Header() {
  
  const { user } = useUser()
  const navigate = useNavigate()

  return (
    <header className="relative left-0 top-0 text-gray-dark">
      <div className='w-dvw h-[var(--header-height)] flex items-center bg-green-soft border-b-gray-medium border-b-[1px] px-5'>
        <Link to="/">
          <div className="flex items-center gap-4">
            <img src="/calcivision_logo.png" alt="CalciVision" role="img" width={48}/>
            <h1 className='text-2xl font-normal'>CalciVision</h1>
          </div>
        </Link>
        <div className='ml-auto flex flex-row-reverse items-stretch max-h-[calc(80px-36px)] h-full mr-10'>
          <button 
            className="ml-6 px-2 cursor-pointer" 
            onClick={() => navigate('/logout')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}><path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"></path><path d="M9 12h12l-3-3m0 6l3-3"></path></g></svg>
          </button>
          <div className='grid items-center grid-cols-[auto_1fr] grid-rows-2 gap-x-3 max-w-xs'>
            <div className='row-start-1 row-span-2 aspect-square h-full border-2 border-green rounded-full object-cover object-center overflow-clip'>
              <img 
                src={avatar} 
                alt="user" 
                role='img' 
                className='h-full'
              />
            </div>
            <h5 className='col-start-2 text-lg font-semibold overflow-hidden'>
              {user && `Dr. ${user.first_name} ${user.last_name}` || 'Doctor'}
            </h5>
            <small className='col-start-2 row-start-2 text-gray-medium'>
              {user && user.medical_speciality || 'Doctor'}
            </small>
          </div>
        </div>
      </div>
    </header>
  );
}

