import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { jwtDecode } from 'jwt-decode';

const TOKEN_KEY = 'pds_token';
const AuthContext = createContext(null);

const parseToken = (token) => {
  if (!token) {
    return null;
  }

  try {
    const decoded = jwtDecode(token);

    if (!decoded?.exp || decoded.exp * 1000 <= Date.now()) {
      return null;
    }

    return {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email || '',
      name: decoded.name || '',
    };
  } catch (error) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const parsedUser = parseToken(savedToken);

    if (!parsedUser) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setIsReady(true);
      return;
    }

    setToken(savedToken);
    setUser(parsedUser);
    setIsReady(true);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setIsReady(true);
    };

    window.addEventListener('pds:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('pds:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = (nextToken) => {
    const parsedUser = parseToken(nextToken);

    if (!parsedUser) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      return null;
    }

    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(parsedUser);
    return parsedUser;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isReady,
      login,
      logout,
    }),
    [isReady, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
