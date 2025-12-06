import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

const UserContext = createContext();

export function UserProvider({ children }) {

    const [user, setUser] = useState(null)

    useEffect(() => {
        const fetchUser = async () => {
            const response = await api.get('/me/')
            setUser(response.data)
        }
        fetchUser()
    }, [])
    
    return (
        <UserContext.Provider value={{ user }}>
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    return useContext(UserContext)
}