import { useState, useEffect } from 'react';
import { User } from '@/api/entities';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      // Verificar si el usuario es admin
      // Verificamos user_metadata.role o raw_user_meta_data.role
      const role = currentUser?.user_metadata?.role ||
                   currentUser?.raw_user_meta_data?.role ||
                   'user';

      setIsAdmin(role === 'admin');
    } catch (error) {
      console.log("Usuario no autenticado");
      setUser(null);
      setIsAdmin(false);
    }
    setLoading(false);
  };

  return {
    user,
    loading,
    isAdmin,
    refreshUser: loadUser
  };
}
