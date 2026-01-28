import React, { useState } from "react";
import { createPatient } from "../api";

const PatientRegister = ({ onClose }) => {
  const [form, setForm] = useState({
    name: "",
    birth_date: "",
    age: "",
    gender: "",
    address: "",
    phone: "",
    email: "",
    occupation: "",
    health_plan: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === "age") {
          formData.append(key, parseInt(value, 10));
        } else {
          formData.append(key, value);
        }
      });
      await createPatient(formData, true);
      setSuccess(true);
      setForm({
        name: "",
        birth_date: "",
        age: "",
        gender: "",
        address: "",
        phone: "",
        email: "",
        occupation: "",
        health_plan: false,
      });
    } catch (err) {
      setError("Erro ao registar o doente. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className='fixed w-full h-full z-100' role="menu">
      <div className='fixed top-0 left-0 w-dvw h-dvh bg-black/20' onClick={handleClose} />
      <form
        onSubmit={handleSubmit}
        className="fixed top-1/2 left-1/2 -translate-1/2 w-4/5 max-w-220 bg-gray-50 pl-10 m-5 p-10"
      >
        <h2 className="text-center font-bold mb-6">Adicionar doente</h2>
        <div className="flex justify-center">
          <div className="items-center inline-block w-300 border-t-[3px] border-green-dark" />
        </div>

        <div className="relative">
          <input
            className="bg-gray-soft p-1 my-3 mt-8 rounded-md border w-full focus:outline-none pl-10 placeholder-black"
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="Nome completo"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            className="absolute left-2 top-1/2 transform -translate-y-1/25"
          >
            <g fill="none" stroke="#000" strokeWidth="1.5">
              <circle cx="12" cy="6" r="4" />
              <path d="M20 17.5c0 2.485 0 4.5-8 4.5s-8-2.015-8-4.5S7.582 13 12 13s8 2.015 8 4.5Z" />
            </g>
          </svg>
        </div>

        <div className="flex justify-between gap-4">
          <div className="relative w-2/5">
            <input
              className="bg-gray-soft w-full p-1 my-3 rounded-md border focus:outline-none pl-10"
              type="date"
              name="birth_date"
              value={form.birth_date}
              onChange={handleChange}
              required
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="absolute left-2 top-1/2 transform -translate-y-1/2"
            >
              <g fill="none" stroke="#000" strokeWidth="1.5">
                <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9zm0-6h18v4H3V3zm4 0V1m10 2V1" />
              </g>
            </svg>
          </div>

          <div className="relative w-3/10">
            <input
              className="bg-gray-soft w-full p-1 my-3 rounded-md border focus:outline-none pl-10 placeholder-black"
              type="number"
              name="age"
              value={form.age}
              onChange={handleChange}
              required
              min="0"
              placeholder="Idade"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="absolute left-2 top-1/2 transform -translate-y-1/2"
            >
              <g fill="none" stroke="#000" strokeWidth="1.5">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-6v-4m0-4v.5" />
              </g>
            </svg>
          </div>

          <div className="relative w-3/10">
            <select
              className="bg-gray-soft w-full p-1 my-3 rounded-md border focus:outline-none pl-10 appearance-none placeholder-black"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              required
            >
              <option value="">Sexo</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </select>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="absolute left-2 top-1/2 transform -translate-y-1/2"
            >
              <g fill="none" stroke="#000" strokeWidth="1.5">
                <circle cx="12" cy="6" r="4" />
                <path d="M20 17.5c0 2.485 0 4.5-8 4.5s-8-2.015-8-4.5S7.582 13 12 13s8 2.015 8 4.5Z" />
              </g>
            </svg>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none"
            >
              <path fill="currentColor" d="m7 10l5 5l5-5z" />
            </svg>
          </div>
        </div>
        <div className="flex justify-between gap-4">
          <div className="relative w-3/5">
            <input
              className="bg-gray-soft w-full p-1 my-3 rounded-md border focus:outline-none pl-10 placeholder-black"
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              required
              placeholder="Morada"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="absolute left-2 top-1/2 transform -translate-y-1/2"
            >
              <g fill="none" stroke="#000" strokeWidth="1.5">
                <path d="M12 12a3 3 0 1 0 0-6a3 3 0 0 0 0 6Z" />
                <path d="M12 2c-3.866 0-7 3.13-7 6.995c0 5.25 7 13 7 13s7-7.75 7-13C19 5.129 15.866 2 12 2Z" />
              </g>
            </svg>
          </div>

          <div className="relative w-2/5">
            <input
              className="bg-gray-soft w-full p-1 my-3 rounded-md border focus:outline-none pl-10 placeholder-black"
              type="text"
              name="occupation"
              value={form.occupation}
              onChange={handleChange}
              placeholder="Profissão"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="absolute left-2 top-1/2 transform -translate-y-1/2"
            >
              <g fill="none" stroke="#000" strokeWidth="1.5">
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m0 0v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7m6 0H8" />
              </g>
            </svg>
          </div>
        </div>
        <div className="flex justify-between gap-4">
          <div className="relative w-3/5">
            <input
              className="bg-gray-soft w-full p-1 my-3 rounded-md border focus:outline-none pl-10 placeholder-black"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Email"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="absolute left-2 top-1/2 transform -translate-y-1/2"
            >
              <g fill="none" stroke="#000" strokeWidth="1.5">
                <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
                <path d="m4 7l6.5 4.5a2 2 0 0 0 3 0L20 7" />
              </g>
            </svg>
          </div>

          <div className="relative w-2/5">
            <input
              className="bg-gray-soft w-full p-1 my-3 rounded-md border focus:outline-none pl-10 placeholder-black"
              type="text"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              required
              placeholder="Telefone"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="absolute left-2 top-1/2 transform -translate-y-1/2"
            >
              <g fill="none" stroke="#000" strokeWidth="1.5">
                <path d="M8 4h3.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm5 0h3a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm-5 9h3.5a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zm5 0h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z" />
              </g>
            </svg>
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button
            className="bg-green h-10 w-40 uppercase text-white rounded-md"
            type="submit"
            disabled={loading}
          >
            {loading ? "A guardar..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="bg-gray-300 h-10 w-40 uppercase text-black rounded-md hover:bg-gray-400"
          >
            Fechar
          </button>

          {success && (
            <p className='text-green-500'>Doente registado com sucesso!</p>
          )}
          {error && <p className='text-red'>{error}</p>}
        </div>
      </form>
    </div>
  );
};

export default PatientRegister;
