import { Link, useNavigate } from "react-router-dom";
import { useUser } from '../contexts/UserContext'
import avatar from "@assets/img/doctorImage.png";

export default function Header({ isNavigationOpen, onToggleNavigation }) {
  
  const { user } = useUser()
  const navigate = useNavigate()

  return (
    <header className="relative z-50 shrink-0 text-gray-dark">
      <div className='flex h-[var(--header-height)] w-full items-center border-b border-b-gray-medium bg-green-soft px-3 sm:px-5'>
        <button
          type="button"
          className="mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-green-pale md:hidden"
          onClick={onToggleNavigation}
          aria-label={isNavigationOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={isNavigationOpen}
        >
          {isNavigationOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
        <Link to="/">
          <div className="flex items-center gap-2 sm:gap-4">
            <img src="/calcivision_logo.png" alt="CalciVision" role="img" className="h-10 w-10 sm:h-12 sm:w-12" />
            <h1 className='hidden text-xl font-normal min-[430px]:block sm:text-2xl'>CalciVision</h1>
          </div>
        </Link>
        <div className='ml-auto flex h-11 flex-row-reverse items-stretch sm:mr-2 lg:mr-6'>
          <button
            className="ml-2 px-2 cursor-pointer sm:ml-4"
            onClick={() => navigate('/logout')}
            aria-label="Terminar sessão"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}><path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"></path><path d="M9 12h12l-3-3m0 6l3-3"></path></g></svg>
          </button>
          <div className='grid min-w-0 items-center grid-cols-[auto_1fr] grid-rows-2 gap-x-2 sm:gap-x-3'>
            <div className='row-span-2 h-full aspect-square overflow-clip rounded-full border-2 border-green object-cover object-center'>
              <img 
                src={avatar} 
                alt="user" 
                role='img' 
                className='h-full'
              />
            </div>
            <h5 className='col-start-2 hidden max-w-48 truncate text-base font-semibold sm:block lg:text-lg'>
              {user && `Dr. ${user.first_name} ${user.last_name}` || 'Doctor'}
            </h5>
            <small className='col-start-2 row-start-2 hidden max-w-48 truncate text-gray-medium sm:block'>
              {user && user.medical_speciality || 'Doctor'}
            </small>
          </div>
        </div>
      </div>
    </header>
  );
}
