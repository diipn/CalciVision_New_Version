import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { UserProvider } from './contexts/UserContext'
import Home from "./pages/Home";
import Patients from "./pages/Patients";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import ManualAnnotationSetup from "./pages/ManualAnnotationSetup";
import ManualAnnotation from "./pages/ManualAnnotation";
import Backoffice from "./pages/BackOffice";
import Reports from "./pages/Reports";
import Records from "./pages/Records";
import AnalysisReview from "./pages/AnalysisReview";

function Logout() {
  localStorage.clear();
  return <Navigate to="/login" />;
}

function RegisterAndLogout() {
  localStorage.clear();
  return <Register />;
}

function App() {
  return (
    <Router>
      <div className="app">
        <UserProvider>
          <Routes>
            <Route path="/" element={<ProtectedRoute><Home/></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<RegisterAndLogout />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/patients" element={<ProtectedRoute><Patients/></ProtectedRoute>} />
            <Route path="/records" element={<ProtectedRoute><Records/></ProtectedRoute>} />
            <Route path="/select_echo" element={<ProtectedRoute><ManualAnnotationSetup/></ProtectedRoute>} />
            <Route path="/analyse_aortic_valve/:patientId/:echoId" element={<ProtectedRoute><ManualAnnotation/></ProtectedRoute>} />
            <Route path="/analysis_review" element={<ProtectedRoute><AnalysisReview/></ProtectedRoute>} />
            <Route path="/backoffice" element={<ProtectedRoute><Backoffice></Backoffice></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports></Reports></ProtectedRoute>} />
            <Route path="*" element={<NotFound/>} />
          </Routes>
        </UserProvider>
      </div>
    </Router>
  );
}

export default App;
