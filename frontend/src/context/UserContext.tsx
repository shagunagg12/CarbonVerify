import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config';

export interface User {
  id: string;
  name: string;
  role: 'OPERATOR' | 'REVIEWER';
}

interface UserContextType {
  users: User[];
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch users from API (seeded on backend startup)
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_URL}/api/users`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data);
          // Auto-select operator by default
          const stored = localStorage.getItem('currentUser');
          if (stored) {
            const parsed = JSON.parse(stored);
            const exists = data.find((u: User) => u.id === parsed.id);
            if (exists) {
              setCurrentUser(exists);
            } else {
              setCurrentUser(data[0] || null);
            }
          } else {
            setCurrentUser(data[0] || null);
          }
        }
      } catch (err) {
        console.error('Failed to load users from backend', err);
        // Fallback static users for offline/initial state
        const fallbackUsers: User[] = [
          { id: 'sarah-op-uuid', name: 'Sarah Operator (Offline)', role: 'OPERATOR' },
          { id: 'john-rev-uuid', name: 'John Reviewer (Offline)', role: 'REVIEWER' }
        ];
        setUsers(fallbackUsers);
        setCurrentUser(fallbackUsers[0]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleSetCurrentUser = (user: User | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  };

  return (
    <UserContext.Provider value={{ users, currentUser, setCurrentUser: handleSetCurrentUser, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
