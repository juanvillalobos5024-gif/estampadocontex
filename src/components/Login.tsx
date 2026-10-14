import { useState } from 'react';
import { Palette, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface LoginProps {
  onLogin: (username: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      // Iniciar sesión con Firebase
      const userCredential = await signInWithEmailAndPassword(auth, username, password);
      onLogin(userCredential.user.email || username);
    } catch (error: any) {
      console.error('Error de autenticación:', error);
      setErrorMsg('Usuario o contraseña incorrectos.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-50 flex items-center justify-center font-sans bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-slate-50">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-8 mx-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 mb-4 flex items-center justify-center rounded-2xl overflow-hidden shadow-sm border border-slate-100">
            <img src="/logo.jpeg" alt="Contex Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Bienvenido</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-sm font-semibold text-slate-900"
                placeholder="ejemplo@correo.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-sm font-semibold text-slate-900"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !username || !password}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3.5 text-sm font-bold transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              <>
                Ingresar al Sistema
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
