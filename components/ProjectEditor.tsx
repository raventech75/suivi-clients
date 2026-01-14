'use client';
import React, { useState, useEffect } from 'react';
import { 
  Camera, Video, Ban, ChevronRight, Rocket, Mail, 
  BookOpen, Trash2, Image as ImageIcon, CheckSquare, 
  Upload, Loader2 
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, appId } from '../lib/firebase';
import { 
  COLLECTION_NAME, MAKE_WEBHOOK_URL, PHOTO_STEPS, 
  VIDEO_STEPS, ALBUM_FORMATS, ALBUM_STATUSES, Project 
} from '../lib/config';

// 👇 IMPORT MIS A JOUR (Nouveau nom de fichier)
import ChatBox from './ChatSystem'; 

export default function ProjectEditor({ project, isSuperAdmin, staffList, user }: { project: Project, isSuperAdmin: boolean, staffList: string[], user: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localData, setLocalData] = useState(project);
  const [hasChanges, setHasChanges] = useState(false);
  const [newAlbum, setNewAlbum] = useState({ name: 'Album', format: '30x30', price: 0 });
  const [uploading, setUploading] = useState(false);

  const isManager = user?.email && project.managerEmail && user.email.toLowerCase() === project.managerEmail.toLowerCase();
  const canEdit = isSuperAdmin || isManager;

  // --- LOGIQUE ETAT COULEURS ---
  const now = Date.now();
  const wedDate = new Date(project.weddingDate).getTime();
  const isFinished = (project.statusPhoto === 'delivered' || project.statusPhoto === 'none') && (project.statusVideo === 'delivered' || project.statusVideo === 'none');
  const isUrgent = !isFinished && now > wedDate + (60 * 24 * 3600 * 1000); // 2 mois
  const isLate = !isFinished && !isUrgent && now > wedDate + (15 * 24 * 3600 * 1000); // 15 jours

  let borderColor = 'border-stone-200';
  if (isUrgent) borderColor = 'border-red-500 border-2';
  else if (isLate) borderColor = 'border-orange-400 border-2';
  else if (isExpanded) borderColor = 'border-blue-400 ring-1 ring-blue-100';

  useEffect(() => { if (!hasChanges) setLocalData(project); }, [project, hasChanges]);

  const updateField = (k: keyof Project, v: any) => { 
    if(!canEdit) return;
    setLocalData(p => {
        const newState = { ...p, [k]: v };
        if(k === 'statusPhoto') newState.progressPhoto = PHOTO_STEPS[v as keyof typeof PHOTO_STEPS].percent;
        if(k === 'statusVideo') newState.progressVideo = VIDEO_STEPS[v as keyof typeof VIDEO_STEPS].percent;
        return newState;
    });
    setHasChanges(true); 
  };

  // --- GESTION ALBUMS ---
  const addAlbum = () => {
      const albums = localData.albums || [];
      updateField('albums', [...albums, { id: Date.now().toString(), ...newAlbum, status: 'pending', paid: false }]);
      setNewAlbum({ name: 'Album', format: '30x30', price: 0 });
  };

  const updateAlbum = (idx: number, field: string, val: any) => {
      const albums = [...(localData.albums || [])];
      albums[idx] = { ...albums[idx], [field]: val };
      updateField('albums', albums);
  };

  // --- UPLOAD COUVERTURE ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0]; if (!file) return;
    try {
      setUploading(true);
      let storageRef = ref(storage, `covers/${project.id}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updateField('coverImage', url);
    } catch (error: any) { alert(`Erreur: ${error.message}`); } finally { setUploading(false); }
  };

  // --- SAUVEGARDE & ACTIONS ---
  const save = async () => {
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, project.id), { ...localData, lastUpdated: serverTimestamp() });
      
      if (localData.statusPhoto !== project.statusPhoto || localData.statusVideo !== project.statusVideo) {
          fetch(MAKE_WEBHOOK_URL, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'step_update', clientName: localData.clientNames, clientEmail: localData.clientEmail, stepName: localData.statusPhoto !== project.statusPhoto ? PHOTO_STEPS[localData.statusPhoto].label : VIDEO_STEPS[localData.statusVideo].label, url: window.location.origin })
          }).catch(console.error);
      }
      setHasChanges(false); setIsExpanded(false);
  };

  const invite = async () => {
      fetch(MAKE_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:'invite', clientName: localData.clientNames, clientEmail: localData.clientEmail, projectCode: localData.code, url: window.location.origin }) });
      alert("Invitation envoyée !");
  };

  const handleDelete = async () => {
    if(!confirm('Supprimer définitivement ce dossier ?')) return;
    const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
    await deleteDoc(doc(db, colPath, project.id));
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border transition-all ${borderColor} mb-4`}>
        <div className="p-4 flex justify-between cursor-pointer items-center" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex gap-4 items-center">
                <div className={`w-1.5 h-10 rounded-full ${project.statusPhoto === 'delivered' ? 'bg-green-500' : 'bg-blue-500'}`} />
                <div>
                    <h3 className="font-bold flex items-center gap-2 text-stone-800">
                        {project.clientNames}
                        {isUrgent && <span className="bg-red-100 text-red-600 text-[10px] px-2 rounded-full font-bold animate-pulse">URGENT +2M</span>}
                        {isLate && <span className="bg-orange-100 text-orange-600 text-[10px] px-2 rounded-full font-bold">ATTENTION +15J</span>}
                    </h3>
                    <p className="text-xs text-stone-500">{new Date(project.weddingDate).toLocaleDateString()} - {project.managerName}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {project.deliveryConfirmed && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckSquare className="w-3 h-3"/> Reçu</span>}
                {!canEdit && <span className="text-xs bg-stone-100 px-2 py-1 rounded flex items-center gap-1"><Ban className="w-3 h-3"/> Lecture seule</span>}
                <ChevronRight className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </div>
        </div>

        {isExpanded && (
            <div className="p-6 border-t bg-stone-50/30 space-y-6">
                {project.deliveryConfirmed && (
                    <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-sm text-green-800 flex items-center gap-3">
                        <CheckSquare className="w-5 h-5"/> 
                        <strong>Preuve de livraison :</strong> Validé le {new Date(project.deliveryConfirmationDate?.seconds * 1000).toLocaleString()}.
                    </div>
                )}

                <div className="flex justify-between">
                    <div className="flex gap-2">
                        <label className={`text-xs font-bold px-3 py-2 rounded border cursor-pointer ${localData.isPriority ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white'}`}><input disabled={!canEdit} type="checkbox" className="hidden" checked={localData.isPriority||false} onChange={e=>updateField('isPriority', e.target.checked)}/> <Rocket className="w-3 h-3 inline"/> Fast Track</label>
                        <button onClick={invite} className="text-xs bg-white border px-3 py-2 rounded flex items-center gap-1 hover:bg-stone-50"><Mail className="w-3 h-3"/> Inviter</button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border space-y-3">
                    <h4 className="font-bold text-xs text-stone-400 uppercase tracking-wide">Contacts</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <input disabled={!canEdit} className="p-2 border rounded text-sm" value={localData.clientEmail} onChange={e=>updateField('clientEmail', e.target.value)} placeholder="Email 1" />
                        <input disabled={!canEdit} className="p-2 border rounded text-sm" value={localData.clientPhone} onChange={e=>updateField('clientPhone', e.target.value)} placeholder="Tel 1" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input disabled={!canEdit} className="p-2 border rounded text-sm" value={localData.clientEmail2 || ''} onChange={e=>updateField('clientEmail2', e.target.value)} placeholder="Email 2" />
                        <input disabled={!canEdit} className="p-2 border rounded text-sm" value={localData.clientPhone2 || ''} onChange={e=>updateField('clientPhone2', e.target.value)} placeholder="Tel 2" />
                    </div>
                </div>

                {/* ALBUMS INCREMENTAUX */}
                <div className="bg-white p-4 rounded-xl border space-y-4">
                    <h4 className="font-bold text-xs text-stone-400 uppercase tracking-wide flex items-center gap-2"><BookOpen className="w-4 h-4"/> Commandes Albums</h4>
                    {(localData.albums || []).map((album, idx) => (
                        <div key={idx} className="flex flex-wrap gap-2 items-center bg-stone-50 p-2 rounded-lg border border-stone-100">
                            <div className="flex-1 text-sm font-bold min-w-[150px]">{album.name} <span className="font-normal text-stone-500">({album.format})</span></div>
                            <select disabled={!canEdit} value={album.status} onChange={e => updateAlbum(idx, 'status', e.target.value)} className="text-xs p-1.5 border rounded bg-white">
                                {Object.entries(ALBUM_STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            <input disabled={!canEdit} placeholder="Lien Stripe" value={album.stripeLink || ''} onChange={e => updateAlbum(idx, 'stripeLink', e.target.value)} className="text-xs p-1.5 border rounded w-32"/>
                            <button disabled={!canEdit} onClick={() => updateAlbum(idx, 'paid', !album.paid)} className={`px-2 py-1 text-[10px] rounded font-bold ${album.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{album.paid ? 'PAYÉ' : 'IMPAYÉ'}</button>
                            {canEdit && <button onClick={() => { const a = [...(localData.albums||[])]; a.splice(idx, 1); updateField('albums', a); }} className="text-red-400 hover:bg-red-50 p-1 rounded"><Trash2 className="w-3 h-3"/></button>}
                        </div>
                    ))}
                    {canEdit && (
                        <div className="flex gap-2 items-center pt-2 border-t mt-2">
                            <input className="p-2 border rounded text-xs" placeholder="Nom (ex: Album Parents)" value={newAlbum.name} onChange={e => setNewAlbum({...newAlbum, name: e.target.value})} />
                            <select className="p-2 border rounded text-xs bg-white" value={newAlbum.format} onChange={e => setNewAlbum({...newAlbum, format: e.target.value})}>{ALBUM_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}</select>
                            <input type="number" className="p-2 border rounded text-xs w-20" placeholder="Prix €" value={newAlbum.price} onChange={e => setNewAlbum({...newAlbum, price: parseFloat(e.target.value)})} />
                            <button onClick={addAlbum} className="bg-stone-800 text-white px-3 py-2 rounded text-xs hover:bg-black transition">Ajouter</button>
                        </div>
                    )}
                </div>

                <div className="mt-4">
                    <label className="text-xs font-bold text-stone-400 uppercase mb-2 block">Photo de couverture</label>
                    <div className="flex items-center gap-4">
                        {localData.coverImage ? <img src={localData.coverImage} className="w-16 h-16 rounded object-cover border" /> : <div className="w-16 h-16 bg-stone-100 rounded border flex items-center justify-center text-stone-300"><ImageIcon/></div>}
                        <label className={`cursor-pointer bg-white border px-3 py-2 rounded text-xs font-bold hover:bg-stone-50 ${!canEdit?'opacity-50':''}`}>
                            {uploading ? '...' : 'Changer'} <input disabled={!canEdit} type="file" className="hidden" onChange={handleImageUpload}/>
                        </label>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded-xl border">
                        <h4 className="font-bold mb-3 flex items-center gap-2 text-amber-600"><Camera className="w-4 h-4"/> Photo</h4>
                        <div className="space-y-3">
                            <select disabled={!canEdit} className="w-full p-2 border rounded text-sm bg-stone-50 font-medium" value={localData.statusPhoto} onChange={e=>updateField('statusPhoto', e.target.value)}>{Object.entries(PHOTO_STEPS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
                            
                            <select disabled={!canEdit} className="w-full p-2 border rounded text-sm bg-stone-50 font-medium" value={localData.photographerName} onChange={e=>updateField('photographerName', e.target.value)}>
                                <option value="">Choisir Photographe...</option>
                                {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            <div><label className="text-[10px] font-bold text-stone-400 uppercase">Livraison Prévue</label><input disabled={!canEdit} type="date" className="w-full p-2 border rounded text-sm" value={localData.estimatedDeliveryPhoto || ''} onChange={e=>updateField('estimatedDeliveryPhoto', e.target.value)} /></div>
                            <input disabled={!canEdit} className="w-full p-2 border rounded text-sm" placeholder="Lien Galerie" value={localData.linkPhoto} onChange={e=>updateField('linkPhoto', e.target.value)}/>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border">
                        <h4 className="font-bold mb-3 flex items-center gap-2 text-blue-600"><Video className="w-4 h-4"/> Vidéo</h4>
                        <div className="space-y-3">
                            <select disabled={!canEdit} className="w-full p-2 border rounded text-sm bg-stone-50 font-medium" value={localData.statusVideo} onChange={e=>updateField('statusVideo', e.target.value)}>{Object.entries(VIDEO_STEPS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
                            
                            <select disabled={!canEdit} className="w-full p-2 border rounded text-sm bg-stone-50 font-medium" value={localData.videographerName} onChange={e=>updateField('videographerName', e.target.value)}>
                                <option value="">Choisir Vidéaste...</option>
                                {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            <div><label className="text-[10px] font-bold text-stone-400 uppercase">Livraison Prévue</label><input disabled={!canEdit} type="date" className="w-full p-2 border rounded text-sm" value={localData.estimatedDeliveryVideo || ''} onChange={e=>updateField('estimatedDeliveryVideo', e.target.value)} /></div>
                            <input disabled={!canEdit} className="w-full p-2 border rounded text-sm" placeholder="Lien Film" value={localData.linkVideo} onChange={e=>updateField('linkVideo', e.target.value)}/>
                        </div>
                    </div>
                </div>

                <ChatBox project={project} userType="admin" disabled={!canEdit} />

                {canEdit && (
                    <div className="flex justify-between pt-4 border-t items-center">
                        {isSuperAdmin ? <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-xs flex gap-1 items-center"><Trash2 className="w-3 h-3"/> Supprimer</button> : <div/>}
                        <button onClick={save} disabled={!hasChanges} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:shadow-none">Enregistrer</button>
                    </div>
                )}
            </div>
        )}
    </div>
  );
}