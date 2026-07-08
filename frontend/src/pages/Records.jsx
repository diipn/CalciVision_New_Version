import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import { getReports, getPatients, getEchoResults, deleteReport } from "../api";
import magnifyingGlassIcon from "@assets/icons/magnifying_glass.svg";
import pdfIcon from "../assets/img/pdf_icon.png";
import ReportDropdown from "../components/ReportDropdown";
import { getPatientAge } from "../utils/patientAge";

const Records = () => {
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch todos os pacientes
      const patientsData = await getPatients();
      setPatients(patientsData);
      setFilteredPatients(patientsData);
      setFilteredReports(patientsData.flatMap(patient => patient.reports))

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrar pacientes com base no termo de pesquisa
  useEffect(() => {
    if (!searchTerm) {
      setFilteredPatients(patients);
      setFilteredReports(patients.flatMap(patient => patient.reports))
      return;
    }
    const newPatients = patients.filter((patient) => patient.name.toLowerCase().includes(searchTerm))
    setFilteredPatients(newPatients);
    setFilteredReports(newPatients.flatMap(patient => patient.reports))
  }, [searchTerm]);

  // Função para lidar com a mudança no campo de pesquisa (adicionar de-bounce)
  const handleSearchType = (e) => {
    setSearchTerm(e.target.value !== "" ? e.target.value.toLowerCase() : null);
  };

  const handleDeleteReport = async (reportId) => {
    try {
      await deleteReport(reportId);
      fetchData();
    } catch (error) {
      console.error("Erro ao deletar relatório:", error);
      alert("Erro ao deletar relatório.");
    }
  };

  return (
    <MainLayout pageTitle="Records - CalciVision">
      <h3 className="mb-4 w-full">Records</h3>
      <div className="flex items-center justify-between mb-10">
        <p className="text-lg">This page provides access to all storage reports associated with your patients.</p>
        <div className="w-fit px-3 flex items-center rounded-lg outline-1 bg-white outline-gray-medium-dark">
          <button className="w-4 h-4 grid place-items-center bg-transparent cursor-pointer">
            <img
              className="w-full h-full object-contain"
              src={magnifyingGlassIcon}
              alt="Search"
              role="icon"
            />
          </button>
          <input
            id="search-input"
            type="search"
            autoComplete="on"
            role="input"
            placeholder="Search"
            className="w-50 grow ml-2 p-1 outline-none"
            onChange={handleSearchType}
          />
        </div>
      </div>
      {isLoading ? (
        <p className="text-gray-600">Loading reports...</p>
      ) : filteredPatients.length > 0 ? (
        <table className="w-full table-fixed border border-collapse shadow-md rounded-lg">
          <thead className="bg-green-dark text-white">
            <tr>
              <th className="w-1/3 px-4 py-2 text-left">Report Name</th>
              <th className="w-1/10 px-4 py-2 text-left">Patient ID</th>
              <th className="w-1/6 px-4 py-2 text-left">Name</th>
              <th className="w-1/10 px-4 py-2 text-left">Age</th>
              <th className="w-1/6 px-4 py-2 text-left">Calcification Status</th>
              <th className="w-1/12 text-left" />
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((report) => {
              const reportPatient = patients.find(patient => patient.id === report.patient) || {};

              return (
                <tr key={report.id} className="relative border-b hover:bg-gray-50">
                  <td className="w-full p-3" onClick={() => window.open(report.report_url, "_blank")}>
                    <div className="flex items-center bg-gray-100 p-2 rounded">
                      <button className="mr-3 text-white py-1 px-3 rounded text-s flex items-center">
                        <img src={pdfIcon} alt="pdf" className="size-9" />
                      </button>
                      <span className="text-sm">{report.pdf_name}</span>
                    </div>
                  </td>
                  <td className="text-sm p-3 text-left">{report.patient}</td>
                  <td className="text-sm p-3 text-left">{reportPatient.name || '—'}</td>
                  <td className="text-sm p-3 text-left">{getPatientAge(reportPatient) ?? "N/A"}</td>
                  <td className="p-3 text-center">
                    <div className={`w-full py-3 rounded-lg text-sm ${report.hasCalcification ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                      {report.hasCalcification ? "Calcified" : "Not calcified"}
                    </div>
                  </td>
                  <td className="relative h-full p-3 text-center grid place-items-center">
                    <div className="h-full">
                      <ReportDropdown report={report} handleDeleteReport={handleDeleteReport}>
                        <button className='absolute right-1/2 top-1/2 -translate-x-1/2'>
                          <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0m0-6a2 2 0 1 0 4 0a2 2 0 0 0-4 0m0 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0"></path></svg>
                        </button>
                      </ReportDropdown>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-gray-600">No reports found for "{searchTerm}".</p>
      )}
    </MainLayout>
  );
};

export default Records;
