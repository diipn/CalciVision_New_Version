import React from 'react';
import Form from "@components/Form";
import loginImage from '@images/login_image.png';
import { useNavigate } from 'react-router-dom';


function Login() {
    const navigate = useNavigate();

    const handleCreateAccountClick = () => {
        navigate('/register');
    }

    return (
        <div className="login-page">
            <div>
                <div className="flex items-center ml-30 mt-15 mb-20 gap-3 h-[80px]">
                    <img src="/calcivision_logo.png" alt="CalciVision" role="img" width={65} />
                    <h1 className='text-1xl font-normal'><strong>CalciVision</strong></h1>
                </div>
                <div className="items-center mt-15 -mb-10 w-195 ml-auto">
                    <p className="text-4xl">Welcome back</p>
                    <br />
                    <p className="justify-content-left -mt-3">Please enter your account details</p>
                </div>
                <Form route="/api/token/" method="login" />
                <div className="flex justify-center">
                    <div className='items-center inline-block w-100 border-t-[1px] border-gray-medium' />
                </div>
                <p className="text-black items-center mt-8 w-190 ml-auto">Don't have an account yet?&nbsp;
                    <strong onClick={handleCreateAccountClick} style={{ cursor: 'pointer' }}>
                        Create Account
                    </strong>
                </p>
            </div>
            <img src={loginImage} alt="Login" className="flex w-200 ml-auto" />
        </div>
    );
}

export default Login;