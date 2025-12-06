import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants";
import "../styles/Form.css";

function Form({ route, method }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [medical_speciality, setMedical_speciality] = useState("");
    const [doctor_number, setDoctor_number] = useState("");

    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const name = method === "login" ? "Login" : "Register";

    const handleSubmit = async (e) => {
        setLoading(true);
        e.preventDefault();

        try {
            const res = await api.post(route, { username, password });
            if (method === "login") {
                localStorage.setItem(ACCESS_TOKEN, res.data.access);
                localStorage.setItem(REFRESH_TOKEN, res.data.refresh);
                navigate("/");
            } else {
                navigate("/login");
            }
        } catch (error) {
            alert(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col m-15 mx-100 p-5 w-100 bg-red-light">
            <input
                className="bg-red-pale p-2 my-3 h-10 rounded-md border border-black w-full focus:outline-none"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
            />

            <input
                className="bg-red-pale p-2 my-3 h-10 rounded-md border border-black text-red-dark w-full focus:outline-none"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
            />

            {method === "register" && ( // Se register for verdadeiro, então exibe os campos abaixo
                <>
                    <input
                        className="bg-red-pale p-2 my-3 h-10 rounded-md border border-black text-red-dark w-full focus:outline-none"
                        type="text"
                        value={medical_speciality}
                        onChange={(e) => setMedical_speciality(e.target.value)}
                        placeholder="Medical Speciality"
                    />

                    <input
                        className="bg-red-pale p-2 my-3 h-10 rounded-md border border-black text-red-dark w-full focus:outline-none"
                        type="text"
                        value={doctor_number}
                        onChange={(e) => setDoctor_number(e.target.value)}
                        placeholder="Doctor Number"
                    />
                </>
            )}

            <div className="flex justify-center">
                <br />
                <button className="mt-7 items-center bg-red h-10 w-50 uppercase text-white rounded-md" type="submit">
                    {name}
                </button>
            </div>
        </form>
    );
}

export default Form;