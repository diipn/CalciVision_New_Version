import Form  from '../components/Form';
import loginImage from '@images/register_image.png';
import { useNavigate } from 'react-router-dom';

function Register() {
    const navigate = useNavigate();

    const handleCreateAccountClick = () => {
        navigate('/login');
    }

    return (
        <div className="login-page">
            <div>
                <div className="flex items-center ml-30 mt-15 mb-20 gap-3 h-[80px]">
                    <img src="/calcivision_logo.png" alt="CalciVision" role="img" width={65} />
                    <h1 className='text-1xl font-normal'><strong>CalciVision</strong></h1>
                </div>
                <div className="items-center mt-15 -mb-10 w-195 ml-auto">
                    <p class="text-4xl">Create your account</p>
                    <br />
                    <p class="justify-content-left -mt-1">Please fill out the following form according to 
                        <br/>your medical information</p>
                </div>
                <Form route="/api/user/register/" method="register" />
                <div className="flex justify-center">
                    <div className='items-center inline-block w-100 border-t-[1px] border-gray-medium' />
                </div>
                <p class="text-black items-center mt-8 w-190 ml-auto">Already have an account?&nbsp;
                    <strong onClick={handleCreateAccountClick} style={{ cursor: 'pointer' }}>
                    Login to your Account
                    </strong>
                </p>
            </div>
            <img src={loginImage} alt="Login" class="flex w-200 ml-auto" />
        </div>
    );
}

export default Register;