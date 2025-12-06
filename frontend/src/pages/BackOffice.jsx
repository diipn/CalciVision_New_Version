import React from 'react'
import MainLayout from "../layouts/MainLayout";

import VI from "@images/VI.png";
import CS from "@images/CS.png";
import Model from "@images/Model.png";
import TR from "@images/TR.png";
import SC from "@images/SC.png";

const Backoffice = () => {
    return (
        <MainLayout pageTitle="BackOffice - CalciVision">
            <div className="min-h-screen">
                <h3 className='mb-3'>Dashboard - BackOffice</h3>
                <p className="mb-10 text-lg">On this page you can find graphs that demonstrate different types of metrics compared to the Calcivision platform.</p>                {/* Container principal otimizado para 1920x1200 */}
                <div className="w-full max-w-screen-2xl mx-auto px-8">
                    {/* Primeira linha - 2 imagens grandes mais juntas */}
                    <div className="flex justify-center items-center mb-8 gap-4">
                        <img className="w-[571px] h-auto" src={VI} alt="Manual Annotation" role="img"/>
                        <img className="w-[571px] h-auto" src={SC} alt="Manual Annotation" role="img"/>             
                    </div>
                    
                    {/* Segunda linha - 3 imagens menores */}
                    <div className="flex justify-between items-center gap-8">
                        <img className="w-[353px] h-auto" src={TR} alt="Manual Annotation" role="img"/>
                        <img className="w-[353px] h-auto" src={CS} alt="Manual Annotation" role="img"/>
                        <img className="w-[263px] h-auto" src={Model} alt="Manual Annotation" role="img"/>             
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}

export default Backoffice