'use client';
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Lock, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function AdminLogin({ onLogin, onBack }: { onLogin: () => void, onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin(); // Redirection vers le Dashboard gérée par le parent
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("Identifiants incorrects.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Trop de tentatives. Réessayez plus tard.");
      } else {
        setError("Erreur de connexion. Vérifiez votre réseau.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md relative animate-fade-in border border-stone-200">
        
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 text-stone-400 hover:text-stone-800 transition p-2 rounded-full hover:bg-stone-50"
          title="Retour à l'accueil"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center mb-8 mt-2">
          <div className="w-16 h-16 bg-stone-900 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-stone-800">Accès Studio</h2>
          <p className="text-stone-500 text-sm">Identifiez-vous pour accéder au backoffice.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1 ml-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none transition-all"
              placeholder="admin@raventech.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1 ml-1">Mot de passe</label>
            <input 
              type="password" 
              required
              className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0"/> {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition-all transform active:scale-95 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : "Se connecter"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-stone-400">Accès réservé au personnel autorisé.</p>
        </div>
      </div>
    </div>
  );
}