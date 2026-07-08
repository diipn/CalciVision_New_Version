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
                <h3 className='mb-3 text-2xl sm:text-3xl'>Dashboard - BackOffice</h3>
                <p className="mb-10 text-base sm:text-lg">On this page you can find graphs that demonstrate different types of metrics compared to the Calcivision platform.</p>
                <div className="mx-auto w-full max-w-screen-2xl">
                    {/* Primeira linha - 2 imagens grandes mais juntas */}
                    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <img className="h-auto w-full" src={VI} alt="Manual Annotation" role="img"/>
                        <img className="h-auto w-full" src={SC} alt="Manual Annotation" role="img"/>
                    </div>
                    
                    {/* Segunda linha - 3 imagens menores */}
                    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <img className="h-auto w-full" src={TR} alt="Manual Annotation" role="img"/>
                        <img className="h-auto w-full" src={CS} alt="Manual Annotation" role="img"/>
                        <img className="h-auto w-full sm:col-span-2 xl:col-span-1" src={Model} alt="Manual Annotation" role="img"/>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}

export default Backoffice
