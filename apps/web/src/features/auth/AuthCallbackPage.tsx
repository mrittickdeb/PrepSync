import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { setAccessToken } from '@/services/api';
import { Spinner } from '@/components/ui';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const fetchUser = useAuthStore((s) => s.fetchUser);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');

    if (token) {
      setAccessToken(token);
      fetchUser()
        .then(() => {
          const redirect = localStorage.getItem('authRedirect');
          if (redirect) localStorage.removeItem('authRedirect');
          navigate(redirect || '/dashboard', { replace: true });
        })
        .catch(() => {
          navigate('/login', { replace: true });
        });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate, fetchUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-4" />
        <h2 className="text-heading text-text-primary font-sans">Authenticating...</h2>
      </div>
    </div>
  );
}
