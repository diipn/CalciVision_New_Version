import { useState } from "react";
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
    if(currentHour < 12) return 'Bom dia,'
    else if(currentHour < 18) return 'Boa tarde,'
    else if(currentHour < 22) return 'Boa noite,'
    else return 'Boa noite,'
  })
  const { user } = useUser()

  return (
    <MainLayout pageTitle="Início - CalciVision">
      
      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] xl:gap-10">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex w-full flex-col rounded-xl bg-gradient-to-r from-red to-red-dark px-5 py-6 font-light text-white shadow-lg sm:flex-row sm:px-8 lg:px-10">
            <div className="flex flex-col gap-2 pr-4">
              <p className="text-lg mb-2">
                {greeting && greeting || 'Bem-vindo de volta,'}
              </p>
              <strong className="text-3xl font-semibold">
                {user && `Dr. ${user.first_name} ${user.last_name}` || 'Médico'}
              </strong>
              <p className="text-gray-pale text-md">
                Hospital de Santa Maria
              </p>
              <div className="flex flex-col gap-2 mt-5">
                <p className="text-lg">
                  Eis o que aconteceu entretanto:
                </p>
                <ul className="list-disc list-inside">
                  <li className="py-1">
                    <span className="text-yellow">Novas imagens de RM</span> foram carregadas (12)
                  </li>
                  <li className="py-1">
                    <span className="text-yellow">Deteção de calcificação</span> concluída (5)
                  </li>
                  <li className="py-1">Doentes a aguardar relatórios (10)</li>
                </ul>
              </div>
            </div>
            <div className="mx-auto mt-4 w-40 shrink-0 sm:ml-auto sm:mt-0 sm:w-2/5 sm:max-w-72">
              <img
                src={welcomeImage}
                alt="Boas-vindas"
                role="img"
                className="object-contain w-full h-full"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="bg-green rounded-lg shadow-lg overflow-hidden">
              <img src={AIDetectionImage} alt="Classificação por IA" role="img" className="object-cover w-full h-36" />
              <div className="px-6 py-4 text-white">
                <h4 className="font-medium mb-2">Classificação por IA</h4>
                <p className="font-light text-sm text-gray-soft">Ferramenta automática de anotação ecocardiográfica e deteção de calcificação com apoio dos nossos modelos de IA.</p>
                <div role="button" className="w-full max-w-30 m-auto py-2 mt-4 text-center rounded-sm text-lg font-medium bg-green-dark">
                  <Link to="/select_echo" target="_blank">
                    Iniciar
                  </Link>
                </div>
              </div>
            </div>
            <div className="bg-gray-light rounded-lg shadow-lg overflow-hidden">
              <img src={ReportsImage} alt="Relatórios automáticos" role="img" className="object-cover w-full h-36" />
              <div className="px-6 py-4 text-gray-dark">
                <h4 className="font-medium mb-2">Relatórios automáticos</h4>
                <p className="font-light text-sm text-gray-dark">Gere relatórios ecocardiográficos completos da válvula aórtica com apoio da IA.</p>
                <div role="button" className="w-full max-w-30 m-auto py-2 mt-4 text-center rounded-sm text-lg font-medium bg-green-dark text-white">
                  <Link to="/reports" target="_blank">
                    Iniciar
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* CONTEÚDO LATERAL */}
        <aside className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 xl:flex xl:flex-col">
          
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
