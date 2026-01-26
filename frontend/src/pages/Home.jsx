import React, { useState } from "react";
import MainLayout from "../layouts/MainLayout";
import Calendar from "@components/Calendar";
import { useUser } from "../contexts/UserContext";

import welcomeImage from "@images/welcome_heart.png";
import AIDetectionImage from "@images/ai_detection.png";
import ReportsImage from "@images/ReportsImage.png";
import { Link } from "react-router-dom";

import RecentPatients from "../components/RecentPatients";

const Home = () => {

  const [greeting] = useState(() => {
    const currentHour = new Date().getHours()
    if(currentHour < 12) return 'Good Morning,'
    else if(currentHour < 18) return 'Good Afternoon,'
    else if(currentHour < 22) return 'Good Evening,'
    else return 'Good Night,'
  })
  const { user } = useUser()

  return (
    <MainLayout pageTitle="Home - CalciVision">
      
      <div className="grid grid-cols-[1fr_24rem] gap-10">
        <div className="flex flex-col gap-4">
          <div className="flex w-full min-w-150 bg-gradient-to-r from-red to-red-dark rounded-xl px-10 py-6 shadow-lg text-white font-light">
            <div className="flex flex-col gap-2 pr-4">
              <p className="text-lg mb-2">
                {greeting && greeting || 'Welcome back,'}
              </p>
              <strong className="text-3xl font-semibold">
                {user && `Dr. ${user.first_name} ${user.last_name}` || 'Doctor'}
              </strong>
              <p className="text-gray-pale text-md">
                Hospital de Santa Maria
              </p>
              <div className="flex flex-col gap-2 mt-5">
                <p className="text-lg">
                  Here’s what happened while you’ve been out:
                </p>
                <ul className="list-disc list-inside">
                  <li className="py-1">
                    <span className="text-yellow">New MRI images</span> were uploaded (12)
                  </li>
                  <li className="py-1">
                    <span className="text-yellow">Valve Calcification Detection</span> completed (5)
                  </li>
                  <li className="py-1">Patients awaiting reports (10)</li>
                </ul>
              </div>
            </div>
            <div className="w-2/5 ml-auto aspect-square">
              <img
                src={welcomeImage}
                alt="Welcome back"
                role="img"
                className="object-contain w-full h-full"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-green rounded-lg shadow-lg overflow-hidden">
              <img src={AIDetectionImage} alt="AI Detection" role="img" className="object-cover w-full h-36" />
              <div className="px-6 py-4 text-white">
                <h4 className="font-medium mb-2">AI Classification</h4>
                <p className="font-light text-sm text-gray-soft">Automated Echocardiographic and MRI Annotation and Valve Calcification Detection Tool powered by our AI models.</p>
                <div role="button" className="w-full max-w-30 m-auto py-2 mt-4 text-center rounded-sm text-lg font-medium bg-green-dark">
                  <Link to="/select_echo" target="_blank">
                    Start
                  </Link>
                </div>
              </div>
            </div>
            <div className="bg-gray-light rounded-lg shadow-lg overflow-hidden">
              <img src={ReportsImage} alt="Automatic Reports" role="img" className="object-cover w-full h-36" />
              <div className="px-6 py-4 text-gray-dark">
                <h4 className="font-medium mb-2">Automatic Reports</h4>
                <p className="font-light text-sm text-gray-dark">Generate complete echocardiographic reports regarding aortic valve clasification for any patient with our AI.</p>
                <div role="button" className="w-full max-w-30 m-auto py-2 mt-4 text-center rounded-sm text-lg font-medium bg-green-dark text-white">
                  <Link to="/reports" target="_blank">
                    Start
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* CONTEÚDO LATERAL */}
        <aside className="flex flex-col gap-6">
          
          {/* Calendário */}
          <Calendar />
          {/* Pacientes Recentes */}
          <RecentPatients />
          
        </aside>
      </div>
    </MainLayout>
  );
};

export default Home;
