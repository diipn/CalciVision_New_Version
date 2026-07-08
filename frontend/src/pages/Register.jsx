import Form  from '../components/Form';
import loginImage from '@images/register_image.png';
import { useNavigate } from 'react-router-dom';

function Register() {
    const navigate = useNavigate();

    const handleCreateAccountClick = () => {
        navigate('/login');
    }

    return (
        <div className="login-page grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,42%)]">
            <main className="flex min-w-0 flex-col px-5 py-6 sm:px-10 lg:px-16 xl:px-24">
                <div className="mb-10 flex h-14 items-center gap-3 sm:mb-14">
                    <img src="/calcivision_logo.png" alt="CalciVision" role="img" className="h-14 w-14" />
                    <h1 className='text-2xl font-normal'><strong>CalciVision</strong></h1>
                </div>
                <div className="mx-auto w-full max-w-md">
                    <p className="text-3xl font-semibold sm:text-4xl">Create your account</p>
                    <p className="mt-3 text-gray-medium-dark">Please fill out the following form according to your medical information</p>
                </div>
                <Form route="/api/user/register/" method="register" />
                <div className="mx-auto flex w-full max-w-md justify-center">
                    <div className='w-full border-t border-gray-medium' />
                </div>
                <p className="mx-auto mt-6 w-full max-w-md text-center text-black sm:text-left">Already have an account?&nbsp;
                    <strong onClick={handleCreateAccountClick} className="cursor-pointer text-green-dark">
                    Login to your Account
                    </strong>
                </p>
            </main>
            <div className="hidden min-h-0 overflow-hidden lg:block">
                <img src={loginImage} alt="Register" className="h-full w-full object-cover" />
            </div>
        </div>
    );
}

export default Register;
