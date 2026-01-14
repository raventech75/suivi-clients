'use client';
import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, Search, AlertTriangle, ImageIcon, Film, Calendar, 
  Music, Rocket, CheckCircle, CheckSquare, BookOpen, 
  Copy, ClipboardCheck, X
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { 
  COLLECTION_NAME, STRIPE_PRIORITY_LINK, PHOTO_STEPS, 
  VIDEO_STEPS, ALBUM_STATUSES, Project 
} from '../lib/config';
import ChatBox from './ChatSystem';

export default function ClientPortal({ projects, onBack }: { projects: Project[], onBack: () => void }) {
  const [searchCode, setSearchCode] = useState('');
  const [foundProject, setFoundProject] = useState<Project | null>(null);
  const [musicLinks, setMusicLinks] = useState('');
  const [musicInstructions, setMusicInstructions] = useState('');
  const [savingMusic, setSavingMusic] = useState(false);
  const [error, setError] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    if (projects.length === 1 && projects[0].id) setFoundProject(projects[0]);
    else if (foundProject) { const live = projects.find(p => p.id === foundProject.id); if(live) setFoundProject(live); }
  }, [projects, foundProject]);

  useEffect(() => { if(foundProject) { setMusicLinks(foundProject.musicLinks || ''); setMusicInstructions(foundProject.musicInstructions || ''); } }, [foundProject]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = projects.find(p => p.code === searchCode.trim().toUpperCase());
    if (p) { setFoundProject(p); setError(''); } else setError('Code introuvable. Vérifiez les majuscules.');
  };

  const handleSaveMusic = async () => {
      if(!foundProject) return;
      setSavingMusic(true);
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { musicLinks, musicInstructions, lastUpdated: serverTimestamp() });
      alert("Vos choix musicaux ont été enregistrés !");
      setSavingMusic(false);
  };

  const confirmDelivery = async () => {
      if(!foundProject || !confirm("Confirmez-vous avoir bien récupéré tous vos fichiers ?")) return;
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { deliveryConfirmed: true, deliveryConfirmationDate: serverTimestamp() });
  };

  const copyProdEmail = () => {
    navigator.clipboard.writeText('irzzenproductions@gmail.com');
    setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000);
  };

  // --- ECRAN PROJET (Connecté) ---
  if (foundProject) {
    const isBlocked = ((foundProject.totalPrice || 0) - (foundProject.depositAmount || 0)) > 0 && (foundProject.totalPrice || 0) > 0;
    const defaultImage = 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80';
    
    return (
      <div className="min-h-screen bg-stone-50 pb-20">
        <div className="bg-stone-900 text-white p-10 text-center relative h-[40vh] flex flex-col justify-center items-center overflow-hidden">
             <img src={foundProject.coverImage || defaultImage} className="absolute inset-0 w-full h-full object-cover opacity-40" />
             <button onClick={onBack} className="absolute top-6 left-6 text-white/70 hover:text-white flex gap-2 items-center z-10 transition-colors"><ChevronRight className="rotate-180 w-4 h-4"/> Retour Accueil</button>
             <h2 className="text-4xl font-serif mb-2 relative z-10">{foundProject.clientNames}</h2>
             <span className="bg-white/20 px-4 py-1 rounded-full text-sm relative z-10 backdrop-blur-md">{new Date(foundProject.weddingDate).toLocaleDateString()} • {foundProject.clientCity || 'Mariage'}</span>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 -mt-16 space-y-8 relative z-10">
          
          {/* CONFIRMATION LIVRAISON */}
          {(foundProject.statusPhoto === 'delivered' || foundProject.statusVideo === 'delivered') && !foundProject.deliveryConfirmed && !isBlocked && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg animate-fade-in">
                  <div>
                      <h3 className="font-bold text-green-900 text-lg flex items-center gap-2"><CheckCircle className="w-5 h-5"/> Confirmation de réception</h3>
                      <p className="text-green-800 text-sm">Avez-vous bien téléchargé et sauvegardé vos fichiers ?</p>
                  </div>
                  <button onClick={confirmDelivery} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-md flex items-center gap-2">
                      <CheckSquare className="w-5 h-5"/> Je confirme la bonne réception
                  </button>
              </div>
          )}

          {foundProject.deliveryConfirmed && (
              <div className="bg-stone-100 border border-stone-200 rounded-xl p-4 flex items-center justify-center gap-2 text-stone-500 text-sm italic">
                  <CheckCircle className="w-4 h-4"/> Réception confirmée le {new Date(foundProject.deliveryConfirmationDate?.seconds * 1000).toLocaleDateString()}
              </div>
          )}

          {isBlocked && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-4 text-red-800 shadow-md">
                   <AlertTriangle className="w-8 h-8 shrink-0" />
                   <div><h3 className="font-bold text-lg">Paiement en attente</h3><p className="text-sm">Le téléchargement sera débloqué une fois le solde réglé.</p></div>
              </div>
          )}

          {/* CARTES PHOTO / VIDEO */}
          <div className="grid md:grid-cols-2 gap-6">
              {foundProject.statusPhoto !== 'none' && (
                <div className="bg-white rounded-2xl p-6 shadow-md border border-stone-100">
                  <div className="flex items-center gap-4 mb-4"><div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center"><ImageIcon className="w-6 h-6"/></div><h3 className="font-bold text-xl">Photos</h3></div>
                  <div className="mb-4">
                      <div className="flex justify-between text-sm font-bold text-stone-500 mb-1"><span>Progression</span><span>{foundProject.progressPhoto}%</span></div>
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${foundProject.progressPhoto}%` }} /></div>
                      <p className="text-right text-xs mt-1 text-stone-400">{PHOTO_STEPS[foundProject.statusPhoto].label}</p>
                  </div>
                  {foundProject.estimatedDeliveryPhoto && <div className="mb-4 bg-amber-50 text-amber-800 text-xs p-3 rounded-lg flex items-center gap-2"><Calendar className="w-4 h-4"/> Livraison estimée : <strong>{new Date(foundProject.estimatedDeliveryPhoto).toLocaleDateString()}</strong></div>}
                  {foundProject.statusPhoto === 'delivered' && !isBlocked && <a href={foundProject.linkPhoto} target="_blank" className="block w-full bg-stone-900 text-white text-center py-3 rounded-xl font-bold hover:bg-stone-800 transition shadow-lg transform active:scale-95">Voir la Galerie</a>}
              </div>
              )}

              {foundProject.statusVideo !== 'none' && (
                <div className="bg-white rounded-2xl p-6 shadow-md border border-stone-100">
                  <div className="flex items-center gap-4 mb-4"><div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center"><Film className="w-6 h-6"/></div><h3 className="font-bold text-xl">Vidéo</h3></div>
                  <div className="mb-4">
                      <div className="flex justify-between text-sm font-bold text-stone-500 mb-1"><span>Progression</span><span>{foundProject.progressVideo}%</span></div>
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${foundProject.progressVideo}%` }} /></div>
                      <p className="text-right text-xs mt-1 text-stone-400">{VIDEO_STEPS[foundProject.statusVideo].label}</p>
                  </div>
                  {foundProject.estimatedDeliveryVideo && <div className="mb-4 bg-blue-50 text-blue-800 text-xs p-3 rounded-lg flex items-center gap-2"><Calendar className="w-4 h-4"/> Livraison estimée : <strong>{new Date(foundProject.estimatedDeliveryVideo).toLocaleDateString()}</strong></div>}
                  {foundProject.statusVideo === 'delivered' && !isBlocked && <a href={foundProject.linkVideo} target="_blank" className="block w-full bg-stone-900 text-white text-center py-3 rounded-xl font-bold hover:bg-stone-800 transition shadow-lg transform active:scale-95">Télécharger le Film</a>}
                </div>
              )}
          </div>

          {/* ALBUMS */}
          {foundProject.albums && foundProject.albums.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-md">
                  <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2 mb-4"><BookOpen className="w-5 h-5"/> Commandes Albums</h3>
                  <div className="space-y-3">
                      {foundProject.albums.map((album, i) => (
                          <div key={i} className="bg-stone-50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                              <div><div className="font-bold">{album.name}</div><div className="text-xs text-stone-500">{album.format} - {ALBUM_STATUSES[album.status as keyof typeof ALBUM_STATUSES]}</div></div>
                              <div>
                                  {!album.paid && album.stripeLink ? (<a href={album.stripeLink} target="_blank" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm">Payer {album.price}€</a>) : album.paid ? (<span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">Payé</span>) : <span className="text-xs text-stone-400">Lien en attente</span>}
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-stone-100"><p className="text-sm text-stone-500 mb-2">Envoyez votre sélection photo à :</p><div className="flex items-center gap-2 bg-stone-100 p-3 rounded-lg"><code className="flex-1 text-sm font-mono text-stone-700">irzzenproductions@gmail.com</code><button onClick={copyProdEmail} className="p-2 bg-white rounded-md shadow-sm hover:bg-stone-50">{emailCopied ? <ClipboardCheck className="w-4 h-4 text-green-500"/> : <Copy className="w-4 h-4"/>}</button></div></div>
              </div>
          )}

          {foundProject.statusVideo !== 'none' && (
             <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 shadow-md">
                <h3 className="font-bold text-purple-900 flex items-center gap-2 mb-4"><Music/> Musique & Montage</h3>
                <textarea className="w-full p-4 rounded-xl border border-purple-200 mb-3 focus:ring-2 ring-purple-500 outline-none" rows={3} placeholder="Collez vos liens Youtube / Spotify ici..." value={musicLinks} onChange={e => setMusicLinks(e.target.value)}/>
                <input className="w-full p-4 rounded-xl border border-purple-200 mb-4 focus:ring-2 ring-purple-500 outline-none" placeholder="Instructions particulières..." value={musicInstructions} onChange={e => setMusicInstructions(e.target.value)}/>
                <button onClick={handleSaveMusic} disabled={savingMusic} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg disabled:opacity-50">Enregistrer mes choix</button>
             </div>
          )}
          <ChatBox project={foundProject} userType="client" />
          
          {!foundProject.isPriority && (
              <div className="bg-stone-900 text-white p-8 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl">
                  <div><h4 className="font-bold text-2xl flex items-center gap-2 text-amber-400"><Rocket/> Option Fast Track</h4><p className="text-stone-400">Passez en priorité et recevez vos images en 1 semaine.</p></div>
                  <a href={STRIPE_PRIORITY_LINK} className="bg-amber-500 text-stone-900 px-8 py-4 rounded-full font-black hover:scale-105 transition-transform shadow-lg shadow-amber-500/20">Activer (290 €)</a>
              </div>
          )}
        </div>
      </div>
    );
  }

  // --- ECRAN DE CONNEXION (LOGIN) ---
  return (
    <div className="h-screen flex items-center justify-center bg-stone-100 p-4 relative">
       {/* BOUTON RETOUR AJOUTÉ ICI 👇 */}
       <button onClick={onBack} className="absolute top-6 left-6 p-3 bg-white rounded-full shadow-md text-stone-500 hover:text-stone-900 hover:scale-105 transition-all z-20">
          <X className="w-6 h-6"/>
       </button>

       <div className="bg-white p-10 rounded-[2rem] shadow-2xl w-full max-w-md text-center relative z-10">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6"><Search className="w-6 h-6 text-stone-400"/></div>
          <h2 className="text-3xl font-serif mb-2 text-stone-800">Accès Mariés</h2>
          <p className="text-stone-500 mb-8 text-sm">Entrez votre code personnel pour accéder à votre espace.</p>
          <form onSubmit={handleSearch} className="space-y-4">
             <input className="w-full p-5 border-2 rounded-2xl text-center text-xl uppercase tracking-widest font-bold focus:border-stone-900 outline-none transition-colors" placeholder="EX: JULIE-884" value={searchCode} onChange={e => setSearchCode(e.target.value)}/>
             <button className="w-full bg-stone-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-black transition-transform active:scale-95 shadow-xl">Voir l'avancement</button>
          </form>
          {error && <div className="mt-6 font-bold bg-red-50 text-red-500 p-4 rounded-xl flex items-center justify-center gap-2 animate-pulse"><AlertTriangle className="w-5 h-5"/> {error}</div>}
       </div>
    </div>
  );
}