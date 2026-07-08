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
        <form onSubmit={handleSubmit} className="mx-auto my-8 flex w-full max-w-md flex-col rounded-xl bg-green-light p-5 shadow-sm sm:p-6">
            <input
                className="bg-green-pale p-2 my-3 h-10 rounded-md border border-black w-full focus:outline-none"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
            />

            <input
                className="bg-green-pale p-2 my-3 h-10 rounded-md border border-black text-green-dark w-full focus:outline-none"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
            />

            {method === "register" && ( // Se register for verdadeiro, então exibe os campos abaixo
                <>
                    <input
                        className="bg-green-pale p-2 my-3 h-10 rounded-md border border-black text-green-dark w-full focus:outline-none"
                        type="text"
                        value={medical_speciality}
                        onChange={(e) => setMedical_speciality(e.target.value)}
                        placeholder="Medical Speciality"
                    />

                    <input
                        className="bg-green-pale p-2 my-3 h-10 rounded-md border border-black text-green-dark w-full focus:outline-none"
                        type="text"
                        value={doctor_number}
                        onChange={(e) => setDoctor_number(e.target.value)}
                        placeholder="Doctor Number"
                    />
                </>
            )}

            <div className="flex justify-center">
                <br />
                <button className="mt-5 h-11 w-full rounded-md bg-green px-6 uppercase text-white sm:w-50" type="submit" disabled={loading}>
                    {name}
                </button>
            </div>
        </form>
    );
}

export default Form;
