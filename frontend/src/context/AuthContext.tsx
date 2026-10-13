import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

export interface User {
  id: number;
  email: string;
  is_active: boolean;
  full_name?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  updateProfile: (full_name: string, role?: string) => Promise<void>;
  updatePassword: (current_password: string, new_password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('data_agent_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Set default auth header whenever token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('data_agent_token', token);
      fetchUserProfile();
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('data_agent_token');
      setUser(null);
      setIsLoading(false);
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/auth/me');
      setUser(res.data);
    } catch (err) {
      console.error('Session expired or invalid token', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await axios.post('http://localhost:8000/api/v1/auth/login', { email, password });
    const { access_token, user: loggedUser } = res.data;
    setToken(access_token);
    setUser(loggedUser);
  };

  const register = async (email: string, password: string) => {
    const res = await axios.post('http://localhost:8000/api/v1/auth/register', { email, password });
    const { access_token, user: newUser } = res.data;
    setToken(access_token);
    setUser(newUser);
  };

  const updateProfile = async (full_name: string, role?: string) => {
    const res = await axios.put('http://localhost:8000/api/v1/auth/profile', {
      full_name,
      role: role || user?.role || "Data Analyst"
    });
    setUser(res.data);
  };

  const updatePassword = async (current_password: string, new_password: string) => {
    await axios.put('http://localhost:8000/api/v1/auth/password', {
      current_password,
      new_password
    });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('data_agent_token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, updateProfile, updatePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
