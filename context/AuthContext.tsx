import React, { createContext, useContext, useState } from 'react';
import { AuthModal } from '@/components/AuthModal';

interface AuthContextType {
  isLoggedIn: boolean;
  requestAuth: () => void;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  requestAuth: () => {},
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  function requestAuth() {
    if (!isLoggedIn) setModalVisible(true);
  }

  function login() {
    console.log('[Auth] mock login');
    setIsLoggedIn(true);
    setModalVisible(false);
  }

  function logout() {
    console.log('[Auth] mock logout');
    setIsLoggedIn(false);
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, requestAuth, login, logout }}>
      {children}
      <AuthModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        onLogin={login}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
