'use client';
import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, Search, AlertTriangle, ImageIcon, Film, Calendar, 
  Music, Rocket, CheckCircle, CheckSquare, BookOpen, 
  Copy, ClipboardCheck, X, Users, Camera, Video, UserCheck, HardDrive, Download, Lock, ShoppingBag, CreditCard
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { 
  COLLECTION_NAME, STRIPE_PRIORITY_LINK, STRIPE_RAW_LINK, STRIPE_ARCHIVE_RESTORE_LINK,
  PHOTO_STEPS, VIDEO_STEPS, ALBUM_STATUSES, Project 
} from '../lib/config';
import ChatBox from './ChatSystem';

const formatDateFR = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

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

  const confirmPhoto = async () => {
      if(!foundProject || !confirm("⚠️ ATTENTION :\n\nEn confirmant, vous certifiez avoir téléchargé TOUS vos fichiers photos sur un disque dur personnel.\n\nConfirmer la bonne réception ?")) return;
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { deliveryConfirmedPhoto: true, deliveryConfirmedPhotoDate: serverTimestamp() });
  };

  const confirmVideo = async () => {
      if(!foundProject || !confirm("⚠️ ATTENTION :\n\nEn confirmant, vous certifiez avoir téléchargé votre film sur un disque dur personnel.\n\nConfirmer la bonne réception ?")) return;
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { deliveryConfirmedVideo: true, deliveryConfirmedVideoDate: serverTimestamp() });
  };

  const copyProdEmail = () => {
    navigator.clipboard.writeText('irzzenproductions@gmail.com');
    setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000);
  };

  if (foundProject) {
    // LOGIQUE DE VERROUILLAGE (LA RÈGLE STRICTE)
    const now = Date.now();
    // On définit la date de livraison (Photo ou Vidéo)
    const deliveryDatePhoto = foundProject.estimatedDeliveryPhoto ? new Date(foundProject.estimatedDeliveryPhoto).getTime() : null;
    const deliveryDateVideo = foundProject.estimatedDeliveryVideo ? new Date(foundProject.estimatedDeliveryVideo).getTime() : null;
    
    // Règle : Si livré depuis plus de 60 jours (2 mois)
    const SIX_MONTHS_MS = 60 * 24 * 60 * 60 * 1000; // 60 jours pour commencer
    
    const isPhotoExpired = deliveryDatePhoto && (now > deliveryDatePhoto + SIX_MONTHS_MS);
    const isVideoExpired = deliveryDateVideo && (now > deliveryDateVideo + SIX_MONTHS_MS);

    const isBlocked = ((foundProject.totalPrice || 0) - (foundProject.depositAmount || 0)) > 0 && (foundProject.totalPrice || 0) > 0;
    
    const canViewGallery = foundProject.statusPhoto === 'delivered' && !isBlocked && foundProject.linkPhoto && foundProject.linkPhoto.length > 5;
    const canViewVideo = foundProject.statusVideo === 'delivered' && !isBlocked && foundProject.linkVideo && foundProject.linkVideo.length > 5;
    
    const hasDelivery = foundProject.statusPhoto === 'delivered' || foundProject.statusVideo === 'delivered';
    const allConfirmed = foundProject.deliveryConfirmedPhoto && foundProject.deliveryConfirmedVideo;

    return (
      <div className="min-h-screen bg-stone-50 pb-20">
        <div className="bg-stone-900 text-white p-10 text-center relative h-[40vh] flex flex-col justify-center items-center overflow-hidden">
             <img src={foundProject.coverImage || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80'} className="absolute inset-0 w-full h-full object-cover opacity-40" />
             <button onClick={onBack} className="absolute top-6 left-6 text-white/70 hover:text-white flex gap-2 items-center z-10 transition-colors"><ChevronRight className="rotate-180 w-4 h-4"/> Retour Accueil</button>
             <h2 className="text-4xl font-serif mb-2 relative z-10">{foundProject.clientNames}</h2>
             <span className="bg-white/20 px-4 py-1 rounded-full text-sm relative z-10 backdrop-blur-md">{formatDateFR(foundProject.weddingDate)} • {foundProject.weddingVenue || foundProject.clientCity || 'Mariage'}</span>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 -mt-16 space-y-8 relative z-10">
          
          {hasDelivery && !allConfirmed && (
              <div className="bg-red-600 text-white p-6 rounded-2xl shadow-xl border-2 border-red-400 flex flex-col md:flex-row gap-4 items-start animate-fade-in">
                  <div className="bg-white/20 p-3 rounded-full shrink-0"><HardDrive className="w-8 h-8 text-white" /></div>
                  <div>
                      <h3 className="font-bold text-xl uppercase tracking-wide mb-2 flex items-center gap-2">⚠️ Sauvegarde Obligatoire</h3>
                      <p className="text-white/90 leading-relaxed mb-4">
                          <strong>Vous disposez de 2 mois</strong> après livraison pour effectuer vos copies de sécurité. 
                          Passé ce délai, les fichiers sont archivés sur serveur froid ("Cold Storage") et leur restauration sera facturée <strong>290 €</strong>.
                      </p>
                      <div className="text-xs font-bold bg-black/20 inline-block px-3 py-1 rounded text-red-100">Confirmez la réception pour valider votre garantie.</div>
                  </div>
              </div>
          )}

          {isBlocked && (
              <div className="bg-stone-800 text-white border border-stone-700 rounded-xl p-6 flex items-center gap-4 shadow-md">
                   <AlertTriangle className="w-8 h-8 shrink-0 text-amber-500" />
                   <div><h3 className="font-bold text-lg text-amber-500">Paiement en attente</h3><p className="text-sm text-stone-300">Le téléchargement sera débloqué une fois le solde réglé.</p></div>
              </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
              {/* CARTE PHOTO */}
              {foundProject.statusPhoto !== 'none' && (
                <div className="bg-white rounded-2xl p-6 shadow-md border border-stone-100 flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-4"><div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center"><ImageIcon className="w-6 h-6"/></div><h3 className="font-bold text-xl">Photos</h3></div>
                  <div className="mb-4 flex-1">
                      <div className="flex justify-between text-sm font-bold text-stone-500 mb-1"><span>Progression</span><span>{foundProject.progressPhoto}%</span></div>
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${foundProject.progressPhoto}%` }} /></div>
                      <p className="text-right text-xs mt-1 text-stone-400">{(PHOTO_STEPS as any)[foundProject.statusPhoto]?.label || foundProject.statusPhoto}</p>
                  </div>
                  
                  <div className="space-y-3 mt-auto pt-4 border-t border-stone-50">
                      {canViewGallery ? (
                          isPhotoExpired ? (
                              <div className="text-center space-y-3">
                                  <div className="bg-stone-100 p-4 rounded-xl text-stone-500 text-sm flex flex-col items-center gap-2">
                                      <Lock className="w-6 h-6 text-stone-400"/>
                                      <span>Archive verrouillée (Délai dépassé)</span>
                                  </div>
                                  <a href={STRIPE_ARCHIVE_RESTORE_LINK} className="block w-full bg-stone-900 text-white py-3 rounded-xl font-bold hover:bg-black transition flex items-center justify-center gap-2">Débloquer l'archive (290€)</a>
                              </div>
                          ) : (
                              <>
                                <a href={foundProject.linkPhoto} target="_blank" className="block w-full bg-stone-900 text-white text-center py-3 rounded-xl font-bold hover:bg-stone-800 transition shadow-lg flex items-center justify-center gap-2"><Download className="w-4 h-4"/> Accéder à la Galerie</a>
                                {!foundProject.deliveryConfirmedPhoto ? (
                                    <button onClick={confirmPhoto} className="w-full bg-white border-2 border-green-500 text-green-600 py-3 rounded-xl font-bold hover:bg-green-50 transition flex items-center justify-center gap-2 text-sm"><CheckSquare className="w-4 h-4"/> Confirmer bonne réception</button>
                                ) : <div className="flex items-center justify-center gap-2 text-green-600 text-xs font-bold bg-green-50 p-2 rounded-lg border border-green-100"><CheckCircle className="w-4 h-4"/> Réception confirmée</div>}
                              </>
                          )
                      ) : foundProject.statusPhoto === 'delivered' ? <button disabled className="block w-full bg-stone-200 text-stone-400 text-center py-3 rounded-xl font-bold cursor-not-allowed">Lien en cours de génération...</button> : null}
                  </div>
              </div>
              )}

              {/* CARTE VIDEO */}
              {foundProject.statusVideo !== 'none' && (
                <div className="bg-white rounded-2xl p-6 shadow-md border border-stone-100 flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-4"><div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center"><Film className="w-6 h-6"/></div><h3 className="font-bold text-xl">Vidéo</h3></div>
                  <div className="mb-4 flex-1">
                      <div className="flex justify-between text-sm font-bold text-stone-500 mb-1"><span>Progression</span><span>{foundProject.progressVideo}%</span></div>
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${foundProject.progressVideo}%` }} /></div>
                      <p className="text-right text-xs mt-1 text-stone-400">{(VIDEO_STEPS as any)[foundProject.statusVideo]?.label || foundProject.statusVideo}</p>
                  </div>

                  <div className="space-y-3 mt-auto pt-4 border-t border-stone-50">
                      {canViewVideo ? (
                          isVideoExpired ? (
                              <div className="text-center space-y-3">
                                  <div className="bg-stone-100 p-4 rounded-xl text-stone-500 text-sm flex flex-col items-center gap-2">
                                      <Lock className="w-6 h-6 text-stone-400"/>
                                      <span>Archive verrouillée (Délai dépassé)</span>
                                  </div>
                                  <a href={STRIPE_ARCHIVE_RESTORE_LINK} className="block w-full bg-stone-900 text-white py-3 rounded-xl font-bold hover:bg-black transition flex items-center justify-center gap-2">Débloquer l'archive (290€)</a>
                              </div>
                          ) : (
                              <>
                                  <a href={foundProject.linkVideo} target="_blank" className="block w-full bg-stone-900 text-white text-center py-3 rounded-xl font-bold hover:bg-stone-800 transition shadow-lg flex items-center justify-center gap-2"><Download className="w-4 h-4"/> Télécharger le Film</a>
                                  {!foundProject.deliveryConfirmedVideo ? (
                                    <button onClick={confirmVideo} className="w-full bg-white border-2 border-green-500 text-green-600 py-3 rounded-xl font-bold hover:bg-green-50 transition flex items-center justify-center gap-2 text-sm"><CheckSquare className="w-4 h-4"/> Confirmer bonne réception</button>
                                  ) : <div className="flex items-center justify-center gap-2 text-green-600 text-xs font-bold bg-green-50 p-2 rounded-lg border border-green-100"><CheckCircle className="w-4 h-4"/> Réception confirmée</div>}
                              </>
                          )
                      ) : foundProject.statusVideo === 'delivered' ? <button disabled className="block w-full bg-stone-200 text-stone-400 text-center py-3 rounded-xl font-bold cursor-not-allowed">Lien en cours de génération...</button> : null}
                  </div>
                </div>
              )}
          </div>
          
          {/* BOUTIQUE / OPTIONS (NIVEAU 2) */}
          <div className="space-y-6">
              <h3 className="font-serif text-2xl text-stone-800 flex items-center gap-2 border-b pb-4"><ShoppingBag className="w-6 h-6"/> Boutique & Options</h3>
              
              <div className="grid md:grid-cols-3 gap-6">
                  {/* Option 1: Fast Track */}
                  {!foundProject.isPriority && (
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col">
                          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4"><Rocket className="w-6 h-6"/></div>
                          <h4 className="font-bold text-lg mb-2">Fast Track ⚡️</h4>
                          <p className="text-sm text-stone-500 mb-6 flex-1">Coupez la file d'attente. Vos médias traités en priorité et livrés sous 14 jours ouvrés.</p>
                          <a href={STRIPE_PRIORITY_LINK} className="w-full bg-stone-900 text-white py-3 rounded-xl font-bold text-center hover:bg-black transition text-sm">Activer (290 €)</a>
                      </div>
                  )}
                  
                  {/* Option 2: Fichiers RAW */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col">
                      <div className="w-12 h-12 bg-stone-100 text-stone-600 rounded-xl flex items-center justify-center mb-4"><HardDrive className="w-6 h-6"/></div>
                      <h4 className="font-bold text-lg mb-2">Pack RAW + Rushes</h4>
                      <p className="text-sm text-stone-500 mb-6 flex-1">L'intégralité des fichiers bruts (vidéo et photo) non retouchés. Idéal pour une sécurité patrimoniale.</p>
                      <a href={STRIPE_RAW_LINK} className="w-full border-2 border-stone-900 text-stone-900 py-3 rounded-xl font-bold text-center hover:bg-stone-50 transition text-sm">Commander (490 €)</a>
                  </div>

                  {/* Option 3: Albums */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col">
                      <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4"><BookOpen className="w-6 h-6"/></div>
                      <h4 className="font-bold text-lg mb-2">Livre d'Art</h4>
                      <p className="text-sm text-stone-500 mb-6 flex-1">Un livre photo premium 30x30cm, couverture lin, papier Fine Art. Mise en page incluse.</p>
                      <button onClick={() => alert("Pour commander un album, merci d'utiliser le chat ci-dessous.")} className="w-full border-2 border-stone-200 text-stone-400 py-3 rounded-xl font-bold text-center hover:bg-stone-50 transition text-sm">Sur devis</button>
                  </div>
              </div>
          </div>

          {/* ... BLOC ALBUMS EXISTANT (S'IL Y A DES COMMANDES EN COURS) ... */}
          {foundProject.albums && foundProject.albums.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-md">
                  <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2 mb-4"><BookOpen className="w-5 h-5"/> Commandes en cours</h3>
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
              </div>
          )}

          {foundProject.statusVideo !== 'none' && (
             <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 shadow-md">
                <h3 className="font-bold text-purple-900 flex items-center gap-2 mb-4"><Music/> Brief Montage & Musique</h3>
                <textarea className="w-full p-4 rounded-xl border border-purple-200 mb-3 focus:ring-2 ring-purple-500 outline-none min-h-[100px]" rows={3} placeholder="Ex: Musique d'ouverture..." value={musicInstructions} onChange={e => setMusicInstructions(e.target.value)}/>
                <input className="w-full p-4 rounded-xl border border-purple-200 mb-4 focus:ring-2 ring-purple-500 outline-none" placeholder="Lien Spotify..." value={musicLinks} onChange={e => setMusicLinks(e.target.value)}/>
                <button onClick={handleSaveMusic} disabled={savingMusic} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg disabled:opacity-50">Enregistrer</button>
             </div>
          )}
          
          <ChatBox project={foundProject} userType="client" />
        </div>
      </div>
    );
  }

  // ... (Le retour du LOGIN reste identique)
  return (
    <div className="h-screen flex items-center justify-center bg-stone-100 p-4 relative">
       <button onClick={onBack} className="absolute top-6 left-6 p-3 bg-white rounded-full shadow-md text-stone-500 hover:text-stone-900 hover:scale-105 transition-all z-20"><X className="w-6 h-6"/></button>
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