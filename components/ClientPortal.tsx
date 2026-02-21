'use client';
import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, ChevronLeft, Search, AlertTriangle, ImageIcon, Film, Calendar, 
  Music, Rocket, CheckCircle, CheckSquare, BookOpen, 
  Copy, ClipboardCheck, X, Users, Camera, Video, UserCheck, HardDrive, Download, Lock, ShoppingBag, Palette, PlayCircle, Heart, ZoomIn, MapPin, Clock, Phone, ClipboardList, CheckCircle2
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
  
  // États de l'Espace Créatif
  const [musicLinks, setMusicLinks] = useState('');
  const [musicInstructions, setMusicInstructions] = useState('');
  const [moodLink, setMoodLink] = useState('');
  const [savingMusic, setSavingMusic] = useState(false);
  
  // États de la Feuille de Route
  const [prepAddress, setPrepAddress] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [ceremonyAddress, setCeremonyAddress] = useState('');
  const [ceremonyTime, setCeremonyTime] = useState('');
  const [partyAddress, setPartyAddress] = useState('');
  const [partyTime, setPartyTime] = useState('');
  const [witness1Name, setWitness1Name] = useState('');
  const [witness1Phone, setWitness1Phone] = useState('');
  const [witness2Name, setWitness2Name] = useState('');
  const [witness2Phone, setWitness2Phone] = useState('');
  const [savingQuest, setSavingQuest] = useState(false);

  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (projects.length === 1 && projects[0].id) {
        setFoundProject(projects[0]);
    } else if (foundProject) { 
        const live = projects.find(p => p.id === foundProject.id); 
        if(live) setFoundProject(live); 
    }
  }, [projects, foundProject]);

  useEffect(() => { 
      if(foundProject) { 
          // Préférences artistiques
          setMusicLinks(foundProject.musicLinks || ''); 
          setMusicInstructions(foundProject.musicInstructions || '');
          setMoodLink(foundProject.moodboardLink || ''); 
          setSelectedPhotos(foundProject.selectedImages || []); 
          
          // Questionnaire
          setPrepAddress(foundProject.prepAddress || '');
          setPrepTime(foundProject.prepTime || '');
          setCeremonyAddress(foundProject.ceremonyAddress || '');
          setCeremonyTime(foundProject.ceremonyTime || '');
          setPartyAddress(foundProject.partyAddress || '');
          setPartyTime(foundProject.partyTime || '');
          setWitness1Name(foundProject.witness1Name || '');
          setWitness1Phone(foundProject.witness1Phone || '');
          setWitness2Name(foundProject.witness2Name || '');
          setWitness2Phone(foundProject.witness2Phone || '');
      } 
  }, [foundProject]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (previewIndex === null || !foundProject?.galleryImages) return;
          if (e.key === 'Escape') setPreviewIndex(null);
          if (e.key === 'ArrowRight') setPreviewIndex((prev) => (prev! + 1) % foundProject.galleryImages!.length);
          if (e.key === 'ArrowLeft') setPreviewIndex((prev) => (prev! - 1 + foundProject.galleryImages!.length) % foundProject.galleryImages!.length);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIndex, foundProject]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = projects.find(p => p.code === searchCode.trim().toUpperCase());
    if (p) { setFoundProject(p); setError(''); } else setError('Code introuvable. Vérifiez les majuscules.');
  };

  const handleSaveMusic = async () => {
      if(!foundProject) return;
      setSavingMusic(true);
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { 
          musicLinks, musicInstructions, moodboardLink: moodLink, lastUpdated: serverTimestamp() 
      });
      alert("Vos choix artistiques ont été enregistrés !");
      setSavingMusic(false);
  };

  const handleSaveQuestionnaire = async () => {
      if(!foundProject) return;
      setSavingQuest(true);
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { 
          prepAddress, prepTime, 
          ceremonyAddress, ceremonyTime, 
          partyAddress, partyTime, 
          witness1Name, witness1Phone, 
          witness2Name, witness2Phone,
          questionnaireFilled: true,
          lastUpdated: serverTimestamp() 
      });
      alert("Votre feuille de route a bien été transmise à notre équipe !");
      setSavingQuest(false);
  };

  const confirmPhoto = async () => {
      if(!foundProject || !confirm("⚠️ ATTENTION :\n\nEn confirmant, vous certifiez avoir téléchargé TOUS vos fichiers.")) return;
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { deliveryConfirmedPhoto: true, deliveryConfirmedPhotoDate: serverTimestamp() });
  };

  const confirmVideo = async () => {
      if(!foundProject || !confirm("⚠️ ATTENTION :\n\nEn confirmant, vous certifiez avoir téléchargé votre film.")) return;
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { deliveryConfirmedVideo: true, deliveryConfirmedVideoDate: serverTimestamp() });
  };

  const togglePhoto = async (filename: string) => {
      if(!foundProject || foundProject.selectionValidated) return;
      let newSel = [...selectedPhotos];
      if (newSel.includes(filename)) { newSel = newSel.filter(f => f !== filename); } 
      else {
          if (foundProject.maxSelection && newSel.length >= foundProject.maxSelection) { alert(`Vous avez atteint la limite de ${foundProject.maxSelection} photos pour votre album.`); return; }
          newSel.push(filename);
      }
      setSelectedPhotos(newSel); 
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { selectedImages: newSel });
  };

  const validateGallery = async () => {
      if(!foundProject || !confirm("Êtes-vous sûr(e) de vouloir valider cette sélection ?\nVous ne pourrez plus la modifier.")) return;
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { selectionValidated: true, lastUpdated: serverTimestamp() });
      alert("Félicitations ! Votre sélection a été envoyée au Studio pour la création de votre Album.");
  };

  if (foundProject) {
    const now = Date.now();
    const deliveryDatePhoto = foundProject.estimatedDeliveryPhoto ? new Date(foundProject.estimatedDeliveryPhoto).getTime() : null;
    const deliveryDateVideo = foundProject.estimatedDeliveryVideo ? new Date(foundProject.estimatedDeliveryVideo).getTime() : null;
    const SIX_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;
    
    const isPhotoExpired = deliveryDatePhoto && (now > deliveryDatePhoto + SIX_MONTHS_MS);
    const isVideoExpired = deliveryDateVideo && (now > deliveryDateVideo + SIX_MONTHS_MS);
    const isBlocked = ((foundProject.totalPrice || 0) - (foundProject.depositAmount || 0)) > 0 && (foundProject.totalPrice || 0) > 0;
    
    const canViewGallery = foundProject.statusPhoto === 'delivered' && !isBlocked && foundProject.linkPhoto && foundProject.linkPhoto.length > 5;
    const canViewVideo = (foundProject.statusVideo === 'delivered' || foundProject.statusVideo === 'partial') && !isBlocked && foundProject.linkVideo && foundProject.linkVideo.length > 5;
    const isPartialVideo = foundProject.statusVideo === 'partial';
    
    const hasDelivery = foundProject.statusPhoto === 'delivered' || foundProject.statusVideo === 'delivered';
    const allConfirmed = foundProject.deliveryConfirmedPhoto && foundProject.deliveryConfirmedVideo;

    const fastTrackLink = `${STRIPE_PRIORITY_LINK}?client_reference_id=${foundProject.id}`;
    const rawLink = `${STRIPE_RAW_LINK}?client_reference_id=${foundProject.id}`;
    const archiveLink = `${STRIPE_ARCHIVE_RESTORE_LINK}?client_reference_id=${foundProject.id}`;

    const bgImage = (foundProject.coverImage && foundProject.coverImage.length > 10) 
        ? foundProject.coverImage 
        : 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80';

    return (
      <div className="min-h-screen bg-stone-50 pb-20">
        
        {/* VISIONNEUSE PLEIN ÉCRAN */}
        {previewIndex !== null && foundProject.galleryImages && (
            <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-fade-in backdrop-blur-sm">
                <div className="flex justify-between items-center p-4 md:p-6 text-white absolute top-0 w-full z-10 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="text-sm font-mono bg-black/50 px-3 py-1 rounded-lg border border-white/10">{foundProject.galleryImages[previewIndex].filename}</div>
                    <button onClick={() => setPreviewIndex(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6"/></button>
                </div>
                <div className="flex-1 relative flex items-center justify-center p-4">
                    <button onClick={(e) => { e.stopPropagation(); setPreviewIndex((previewIndex - 1 + foundProject.galleryImages!.length) % foundProject.galleryImages!.length); }} className="absolute left-2 md:left-8 p-3 bg-black/50 hover:bg-black text-white rounded-full transition z-10 hidden md:block"><ChevronLeft className="w-8 h-8"/></button>
                    <img src={foundProject.galleryImages[previewIndex].url} className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl" alt="Aperçu plein écran" />
                    <button onClick={(e) => { e.stopPropagation(); setPreviewIndex((previewIndex + 1) % foundProject.galleryImages!.length); }} className="absolute right-2 md:right-8 p-3 bg-black/50 hover:bg-black text-white rounded-full transition z-10 hidden md:block"><ChevronRight className="w-8 h-8"/></button>
                </div>
                <div className="p-6 md:p-8 bg-gradient-to-t from-black to-transparent flex justify-center items-center gap-6 absolute bottom-0 w-full">
                    <button onClick={() => setPreviewIndex((previewIndex - 1 + foundProject.galleryImages!.length) % foundProject.galleryImages!.length)} className="md:hidden p-3 bg-white/10 text-white rounded-full"><ChevronLeft className="w-6 h-6"/></button>
                    <button disabled={foundProject.selectionValidated} onClick={() => togglePhoto(foundProject.galleryImages![previewIndex].filename)} className={`px-8 py-4 rounded-full font-bold text-lg transition-all shadow-2xl flex items-center gap-3 ${selectedPhotos.includes(foundProject.galleryImages[previewIndex].filename) ? 'bg-green-500 text-white hover:bg-green-600 scale-105' : 'bg-white text-stone-900 hover:bg-stone-200'}`}>
                        {selectedPhotos.includes(foundProject.galleryImages[previewIndex].filename) ? <><CheckCircle className="w-6 h-6"/> Photo Sélectionnée</> : <><Heart className="w-6 h-6"/> Ajouter à l'Album</>}
                    </button>
                    <button onClick={() => setPreviewIndex((previewIndex + 1) % foundProject.galleryImages!.length)} className="md:hidden p-3 bg-white/10 text-white rounded-full"><ChevronRight className="w-6 h-6"/></button>
                </div>
            </div>
        )}

        <div className="bg-stone-900 text-white p-10 text-center relative h-[40vh] flex flex-col justify-center items-center overflow-hidden">
             <img src={bgImage} className="absolute inset-0 w-full h-full object-cover opacity-40" />
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
                      <p className="text-white/90 leading-relaxed mb-4"><strong>Vous disposez de 2 mois</strong> après livraison finale pour effectuer vos copies de sécurité.</p>
                      <div className="text-xs font-bold bg-black/20 inline-block px-3 py-1 rounded text-red-100">Veuillez confirmer la réception finale ci-dessous.</div>
                  </div>
              </div>
          )}

          {isBlocked && (<div className="bg-stone-800 text-white border border-stone-700 rounded-xl p-6 flex items-center gap-4 shadow-md"><AlertTriangle className="w-8 h-8 shrink-0 text-amber-500" /><div><h3 className="font-bold text-lg text-amber-500">Paiement en attente</h3><p className="text-sm text-stone-300">Le téléchargement sera débloqué une fois le solde réglé.</p></div></div>)}

          {(foundProject.managerName || foundProject.photographerName || foundProject.videographerName) && (
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-md">
                  <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-amber-500"/> Votre Équipe RavenTech</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                      {foundProject.managerName && (<div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100"><div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><UserCheck className="w-5 h-5"/></div><div><div className="text-xs text-stone-400 font-bold uppercase">Suivi Dossier</div><div className="font-bold text-stone-800">{foundProject.managerName}</div></div></div>)}
                      {foundProject.photographerName && (<div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100"><div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center"><Camera className="w-5 h-5"/></div><div><div className="text-xs text-stone-400 font-bold uppercase">Photographe</div><div className="font-bold text-stone-800">{foundProject.photographerName}</div></div></div>)}
                      {foundProject.videographerName && (<div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100"><div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Video className="w-5 h-5"/></div><div><div className="text-xs text-stone-400 font-bold uppercase">Vidéaste</div><div className="font-bold text-stone-800">{foundProject.videographerName}</div></div></div>)}
                  </div>
              </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
              {foundProject.statusPhoto !== 'none' && (
                <div className="bg-white rounded-2xl p-6 shadow-md border border-stone-100 flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-4"><div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center"><ImageIcon className="w-6 h-6"/></div><h3 className="font-bold text-xl">Photos</h3></div>
                  <div className="mb-4 flex-1">
                      <div className="flex justify-between text-sm font-bold text-stone-500 mb-1"><span>Progression</span><span>{foundProject.progressPhoto}%</span></div>
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${foundProject.progressPhoto}%` }} /></div>
                      <p className="text-right text-xs mt-1 text-stone-400">{(PHOTO_STEPS as any)[foundProject.statusPhoto]?.label || foundProject.statusPhoto}</p>
                      {foundProject.estimatedDeliveryPhoto && <div className="mt-4 bg-amber-50 text-amber-800 text-xs p-3 rounded-lg flex items-center gap-2"><Calendar className="w-4 h-4"/> Livraison estimée : <strong>{formatDateFR(foundProject.estimatedDeliveryPhoto)}</strong></div>}
                  </div>
                  <div className="space-y-3 mt-auto pt-4 border-t border-stone-50">
                      {canViewGallery ? (isPhotoExpired ? (<div className="text-center space-y-3"><div className="bg-stone-100 p-4 rounded-xl text-stone-500 text-sm flex flex-col items-center gap-2"><Lock className="w-6 h-6 text-stone-400"/><span>Archive verrouillée</span></div><a href={archiveLink} className="block w-full bg-stone-900 text-white py-3 rounded-xl font-bold">Débloquer (290€)</a></div>) : (<><a href={foundProject.linkPhoto} target="_blank" className="block w-full bg-stone-900 text-white text-center py-3 rounded-xl font-bold hover:bg-stone-800 transition shadow-lg flex items-center justify-center gap-2"><Download className="w-4 h-4"/> Accéder à la Galerie</a>{!foundProject.deliveryConfirmedPhoto ? (<button onClick={confirmPhoto} className="w-full bg-white border-2 border-green-500 text-green-600 py-3 rounded-xl font-bold hover:bg-green-50 transition flex items-center justify-center gap-2 text-sm"><CheckSquare className="w-4 h-4"/> Confirmer réception</button>) : <div className="flex items-center justify-center gap-2 text-green-600 text-xs font-bold bg-green-50 p-2 rounded-lg border border-green-100"><CheckCircle className="w-4 h-4"/> Reçu</div>}</>)) : foundProject.statusPhoto === 'delivered' ? <button disabled className="block w-full bg-stone-200 text-stone-400 text-center py-3 rounded-xl font-bold cursor-not-allowed">Lien en cours...</button> : null}
                  </div>
              </div>
              )}

              {foundProject.statusVideo !== 'none' && (
                <div className="bg-white rounded-2xl p-6 shadow-md border border-stone-100 flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-4"><div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center"><Film className="w-6 h-6"/></div><h3 className="font-bold text-xl">Vidéo</h3></div>
                  <div className="mb-4 flex-1">
                      <div className="flex justify-between text-sm font-bold text-stone-500 mb-1"><span>Progression</span><span>{foundProject.progressVideo}%</span></div>
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${foundProject.progressVideo}%` }} /></div>
                      <p className="text-right text-xs mt-1 text-stone-400">{(VIDEO_STEPS as any)[foundProject.statusVideo]?.label || foundProject.statusVideo}</p>
                      {foundProject.estimatedDeliveryVideo && <div className="mt-4 bg-blue-50 text-blue-800 text-xs p-3 rounded-lg flex items-center gap-2"><Calendar className="w-4 h-4"/> Livraison estimée : <strong>{formatDateFR(foundProject.estimatedDeliveryVideo)}</strong></div>}
                  </div>
                  <div className="space-y-3 mt-auto pt-4 border-t border-stone-50">
                      {canViewVideo ? (
                          isVideoExpired ? (
                              <div className="text-center space-y-3"><div className="bg-stone-100 p-4 rounded-xl text-stone-500 text-sm flex flex-col items-center gap-2"><Lock className="w-6 h-6 text-stone-400"/><span>Archive verrouillée</span></div><a href={archiveLink} className="block w-full bg-stone-900 text-white py-3 rounded-xl font-bold">Débloquer (290€)</a></div>
                          ) : (
                              <>
                                  <a href={foundProject.linkVideo} target="_blank" className={`block w-full text-white text-center py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 ${isPartialVideo ? 'bg-blue-600 hover:bg-blue-700' : 'bg-stone-900 hover:bg-stone-800'}`}>
                                      {isPartialVideo ? <PlayCircle className="w-4 h-4"/> : <Download className="w-4 h-4"/>} 
                                      {isPartialVideo ? 'Voir le Clip (Teaser)' : 'Télécharger le Film'}
                                  </a>
                                  {!isPartialVideo && (
                                      !foundProject.deliveryConfirmedVideo ? (
                                          <button onClick={confirmVideo} className="w-full bg-white border-2 border-green-500 text-green-600 py-3 rounded-xl font-bold hover:bg-green-50 transition flex items-center justify-center gap-2 text-sm"><CheckSquare className="w-4 h-4"/> Confirmer réception</button>
                                      ) : (
                                          <div className="flex items-center justify-center gap-2 text-green-600 text-xs font-bold bg-green-50 p-2 rounded-lg border border-green-100"><CheckCircle className="w-4 h-4"/> Réception confirmée</div>
                                      )
                                  )}
                                  {isPartialVideo && <div className="text-center text-xs text-stone-400 italic">La livraison complète du film est en cours de finition.</div>}
                              </>
                          )
                      ) : foundProject.statusVideo === 'delivered' ? <button disabled className="block w-full bg-stone-200 text-stone-400 text-center py-3 rounded-xl font-bold cursor-not-allowed">Lien en cours...</button> : null}
                  </div>
                </div>
              )}
          </div>

          {/* FEUILLE DE ROUTE (J-30) */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xl relative overflow-hidden">
              {foundProject.questionnaireFilled && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white px-4 py-1.5 rounded-bl-xl font-bold text-xs flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="w-3 h-3"/> Transmis à l'équipe
                  </div>
              )}
              
              <div className="mb-6">
                  <h3 className="font-serif text-2xl text-stone-800 flex items-center gap-2 mb-2"><ClipboardList className="w-6 h-6 text-indigo-500"/> Feuille de Route (Jour J)</h3>
                  <p className="text-sm text-stone-500">Pour assurer le bon déroulement de votre mariage, veuillez nous communiquer ces informations logistiques dès que possible.</p>
              </div>

              <div className="space-y-6">
                  {/* Lieux et Horaires */}
                  <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                          <h4 className="font-bold text-sm text-stone-700 flex items-center gap-1 mb-3"><MapPin className="w-4 h-4 text-stone-400"/> Préparatifs</h4>
                          <div className="space-y-3">
                              <div><label className="text-[10px] uppercase font-bold text-stone-400">Heure d'arrivée de l'équipe</label><input type="time" className="w-full p-2 border rounded-lg bg-white text-sm focus:ring-2 outline-none mt-1" value={prepTime} onChange={e => setPrepTime(e.target.value)} /></div>
                              <div><label className="text-[10px] uppercase font-bold text-stone-400">Adresse exacte</label><input className="w-full p-2 border rounded-lg bg-white text-sm focus:ring-2 outline-none mt-1" placeholder="N°, Rue, Code Postal, Ville" value={prepAddress} onChange={e => setPrepAddress(e.target.value)} /></div>
                          </div>
                      </div>
                      
                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                          <h4 className="font-bold text-sm text-stone-700 flex items-center gap-1 mb-3"><MapPin className="w-4 h-4 text-stone-400"/> Cérémonie</h4>
                          <div className="space-y-3">
                              <div><label className="text-[10px] uppercase font-bold text-stone-400">Heure de début</label><input type="time" className="w-full p-2 border rounded-lg bg-white text-sm focus:ring-2 outline-none mt-1" value={ceremonyTime} onChange={e => setCeremonyTime(e.target.value)} /></div>
                              <div><label className="text-[10px] uppercase font-bold text-stone-400">Adresse de la cérémonie</label><input className="w-full p-2 border rounded-lg bg-white text-sm focus:ring-2 outline-none mt-1" placeholder="Mairie ou Église ou Domaine..." value={ceremonyAddress} onChange={e => setCeremonyAddress(e.target.value)} /></div>
                          </div>
                      </div>

                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                          <h4 className="font-bold text-sm text-stone-700 flex items-center gap-1 mb-3"><MapPin className="w-4 h-4 text-stone-400"/> Soirée</h4>
                          <div className="space-y-3">
                              <div><label className="text-[10px] uppercase font-bold text-stone-400">Heure d'arrivée à la salle</label><input type="time" className="w-full p-2 border rounded-lg bg-white text-sm focus:ring-2 outline-none mt-1" value={partyTime} onChange={e => setPartyTime(e.target.value)} /></div>
                              <div><label className="text-[10px] uppercase font-bold text-stone-400">Lieu de réception</label><input className="w-full p-2 border rounded-lg bg-white text-sm focus:ring-2 outline-none mt-1" placeholder="Nom du domaine, Ville..." value={partyAddress} onChange={e => setPartyAddress(e.target.value)} /></div>
                          </div>
                      </div>
                  </div>

                  {/* Contacts Témoins */}
                  <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                      <h4 className="font-bold text-sm text-stone-700 flex items-center gap-1 mb-1"><Phone className="w-4 h-4 text-stone-400"/> Personnes de Confiance (Témoins / Wedding Planner)</h4>
                      <p className="text-[10px] text-stone-500 mb-4">Pour éviter de vous déranger le jour J en cas de question logistique (parking, surprise, etc.).</p>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                          <div className="flex gap-2">
                              <input className="w-1/2 p-2 border rounded-lg bg-white text-sm focus:ring-2 outline-none" placeholder="Prénom (Témoin 1)" value={witness1Name} onChange={e => setWitness1Name(e.target.value)} />
                              <input className="w-1/2 p-2 border rounded-lg bg-white text-sm focus:ring-2 outline-none" placeholder="Numéro de téléphone" value={witness1Phone} onChange={e => setWitness1Phone(e.target.value)} />
                          </div>
                          <div className="flex gap-2">
                              <input className="w-1/2 p-2 border rounded-lg bg-white text-sm focus:ring-2 outline-none" placeholder="Prénom (Témoin 2)" value={witness2Name} onChange={e => setWitness2Name(e.target.value)} />
                              <input className="w-1/2 p-2 border rounded-lg bg-white text-sm focus:ring-2 outline-none" placeholder="Numéro de téléphone" value={witness2Phone} onChange={e => setWitness2Phone(e.target.value)} />
                          </div>
                      </div>
                  </div>

                  <button 
                      onClick={handleSaveQuestionnaire} 
                      disabled={savingQuest}
                      className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold hover:bg-black transition shadow-lg disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
                  >
                      {savingQuest ? 'Transmission en cours...' : 'Transmettre à l\'équipe'}
                  </button>
              </div>
          </div>

          {/* GALERIE DE SÉLECTION ALBUM NATIVE */}
          {foundProject.galleryImages && foundProject.galleryImages.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xl overflow-hidden relative">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b pb-6">
                      <div>
                          <h3 className="font-serif text-2xl text-stone-800 flex items-center gap-2 mb-2"><ImageIcon className="w-6 h-6 text-amber-500"/> Sélection pour votre Album</h3>
                          <p className="text-sm text-stone-500">Cliquez sur une photo pour l'ajouter, ou sur la loupe pour l'agrandir. {foundProject.selectionValidated && <strong className="text-green-600">Sélection envoyée.</strong>}</p>
                      </div>
                      
                      <div className="bg-stone-50 px-6 py-3 rounded-xl border border-stone-200 text-center shadow-sm">
                          <div className="text-3xl font-bold text-stone-900">
                              <span className={selectedPhotos.length === foundProject.maxSelection ? "text-green-600" : "text-amber-500"}>{selectedPhotos.length}</span> 
                              <span className="text-stone-300 text-lg"> / {foundProject.maxSelection || '∞'}</span>
                          </div>
                          <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Sélectionnées</div>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[600px] overflow-y-auto pr-2 pb-4">
                      {foundProject.galleryImages.map((img, i) => {
                          const isSelected = selectedPhotos.includes(img.filename);
                          return (
                              <div 
                                key={i} 
                                onClick={() => togglePhoto(img.filename)}
                                className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group transition-all duration-300 ${isSelected ? 'ring-4 ring-amber-500 scale-95 shadow-lg' : 'hover:opacity-90'}`}
                              >
                                  <img src={img.url} alt={img.filename} loading="lazy" className="w-full h-full object-cover" />
                                  <button onClick={(e) => { e.stopPropagation(); setPreviewIndex(i); }} className="absolute top-2 right-2 bg-black/50 hover:bg-black text-white p-1.5 rounded-full shadow-md backdrop-blur-sm transition-colors z-10" title="Agrandir la photo"><ZoomIn className="w-4 h-4"/></button>
                                  <div className={`absolute inset-0 transition-opacity flex items-center justify-center pointer-events-none ${isSelected ? 'bg-black/20 opacity-100' : 'bg-black/0 opacity-0 group-hover:opacity-100 group-hover:bg-black/10'}`}>
                                      {isSelected ? <div className="bg-amber-500 text-white p-2 rounded-full shadow-lg transform scale-110 transition-transform"><CheckCircle className="w-6 h-6"/></div> : <div className="bg-white/90 text-stone-400 p-2 rounded-full shadow-sm"><Heart className="w-6 h-6"/></div>}
                                  </div>
                              </div>
                          );
                      })}
                  </div>

                  {!foundProject.selectionValidated && (
                      <div className="mt-6 pt-4 border-t border-stone-100 flex justify-end">
                          <button onClick={validateGallery} disabled={selectedPhotos.length === 0} className="bg-stone-900 text-white px-8 py-4 rounded-xl font-bold shadow-xl hover:bg-black transition-all disabled:opacity-50 disabled:shadow-none transform hover:scale-105">Valider définitivement ma sélection ({selectedPhotos.length})</button>
                      </div>
                  )}
              </div>
          )}
          
          <div className="space-y-6">
              <h3 className="font-serif text-2xl text-stone-800 flex items-center gap-2 border-b pb-4"><ShoppingBag className="w-6 h-6"/> Boutique & Options</h3>
              <div className="grid md:grid-cols-3 gap-6">
                  {!foundProject.isPriority && (<div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col"><div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4"><Rocket className="w-6 h-6"/></div><h4 className="font-bold text-lg mb-2">Fast Track ⚡️</h4><p className="text-sm text-stone-500 mb-6 flex-1">Vos médias traités en priorité.</p><a href={fastTrackLink} className="w-full bg-stone-900 text-white py-3 rounded-xl font-bold text-center hover:bg-black transition text-sm">Activer (290 €)</a></div>)}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col"><div className="w-12 h-12 bg-stone-100 text-stone-600 rounded-xl flex items-center justify-center mb-4"><HardDrive className="w-6 h-6"/></div><h4 className="font-bold text-lg mb-2">Pack RAW + Rushes</h4><p className="text-sm text-stone-500 mb-6 flex-1">Fichiers bruts non retouchés.</p><a href={rawLink} className="w-full border-2 border-stone-900 text-stone-900 py-3 rounded-xl font-bold text-center hover:bg-stone-50 transition text-sm">Commander (490 €)</a></div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col"><div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4"><BookOpen className="w-6 h-6"/></div><h4 className="font-bold text-lg mb-2">Livre d'Art</h4><p className="text-sm text-stone-500 mb-6 flex-1">Livre photo premium 30x30cm.</p><button onClick={() => alert("Utilisez le chat ci-dessous.")} className="w-full border-2 border-stone-200 text-stone-400 py-3 rounded-xl font-bold text-center hover:bg-stone-50 transition text-sm">Sur devis</button></div>
              </div>
          </div>
          
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
             <div className="grid md:grid-cols-2 gap-6">
                 <div className="bg-pink-50 p-6 rounded-2xl border border-pink-100 shadow-md">
                    <h3 className="font-bold text-pink-900 flex items-center gap-2 mb-4"><Palette className="w-5 h-5"/> Inspirations & Moodboard</h3>
                    <p className="text-sm text-pink-700 mb-3 font-medium">Un tableau Pinterest ? Un compte Instagram ?</p>
                    <input className="w-full p-4 rounded-xl border border-pink-200 mb-4 focus:ring-2 ring-pink-500 outline-none bg-white placeholder-pink-200" placeholder="Ex: https://pinterest.com/..." value={moodLink} onChange={e => setMoodLink(e.target.value)}/>
                 </div>
                 <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 shadow-md">
                    <h3 className="font-bold text-purple-900 flex items-center gap-2 mb-4"><Music className="w-5 h-5"/> Musique & Montage</h3>
                    <p className="text-sm text-purple-700 mb-3 font-medium">Vos choix musicaux.</p>
                    <textarea className="w-full p-4 rounded-xl border border-purple-200 mb-3 focus:ring-2 ring-purple-500 outline-none min-h-[80px]" rows={2} placeholder="Ex: Musique d'ouverture..." value={musicInstructions} onChange={e => setMusicInstructions(e.target.value)}/>
                    <input className="w-full p-4 rounded-xl border border-purple-200 mb-4 focus:ring-2 ring-purple-500 outline-none" placeholder="Lien Spotify..." value={musicLinks} onChange={e => setMusicLinks(e.target.value)}/>
                 </div>
             </div>
          )}
          
          {foundProject.statusVideo !== 'none' && (
              <button onClick={handleSaveMusic} disabled={savingMusic} className="w-full bg-stone-900 hover:bg-black text-white py-4 rounded-xl font-bold transition shadow-lg disabled:opacity-50 mt-4 flex items-center justify-center gap-2">{savingMusic ? 'Enregistrement...' : 'Enregistrer mes préférences artistiques'}</button>
          )}
          
          <ChatBox project={foundProject} userType="client" />
        </div>
      </div>
    );
  }

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