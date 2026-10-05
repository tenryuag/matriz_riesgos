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
      // El rol vive en app_metadata (solo el servidor lo escribe); user_metadata
      // lo puede editar el propio usuario y NO debe usarse para esto.
      const role = currentUser?.app_metadata?.role || 'user';

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
