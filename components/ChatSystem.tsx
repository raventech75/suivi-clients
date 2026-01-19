'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Loader2, User, ShieldCheck } from 'lucide-react';
import { doc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore'; 
import { db, appId } from '../lib/firebase';
import { COLLECTION_NAME, MAKE_WEBHOOK_URL, Project, Message } from '../lib/config';

export default function ChatBox({ project, userType, disabled = false }: { project: Project, userType: 'admin' | 'client', disabled?: boolean }) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>(project.messages || []);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Écoute temps réel
  useEffect(() => {
    const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
    const unsub = onSnapshot(doc(db, colPath, project.id), (doc) => {
        if (doc.exists()) {
            const data = doc.data() as Project;
            if (data.messages) {
                setLocalMessages(data.messages);
            }
        }
    });
    return () => unsub();
  }, [project.id]);

  // 2. Scroll automatique
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    setSending(true);
    const msgText = newMessage.trim();
    
    // Définition de l'auteur (Côté Admin c'est le Studio, Côté Client ce sont les mariés)
    const authorName = userType === 'admin' ? 'RavenTech Studio' : project.clientNames;
    
    const msg: Message = {
        id: Date.now().toString(),
        author: authorName,
        text: msgText,
        date: new Date().toISOString(),
        isStaff: userType === 'admin'
    };

    // Optimistic UI (Affichage immédiat)
    setLocalMessages(prev => [...prev, msg]);
    setNewMessage(''); 

    try {
        const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
        
        // A. Sauvegarde BDD
        await updateDoc(doc(db, colPath, project.id), {
            messages: arrayUnion(msg)
        });

        // B. Webhook Make
        // On vérifie que les emails existent pour éviter l'erreur Make "Missing parameter"
        const payload = {
            type: 'chat',
            projectCode: project.code,
            clientNames: project.clientNames,
            author: authorName,
            text: msgText,
            url: window.location.href,
            // On envoie des chaînes vides "" si l'info manque, pour ne pas casser le JSON
            clientEmail: project.clientEmail || "",
            managerEmail: project.managerEmail || "",
            photographerEmail: project.photographerEmail || "",
            videographerEmail: project.videographerEmail || ""
        };

        fetch(MAKE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(err => console.error("Webhook error (non bloquant):", err));

    } catch (error) {
        console.error("Erreur sauvegarde:", error);
    } finally {
        setSending(false);
    }
  };

  // Fonction de date sécurisée pour éviter "Invalid Date"
  const formatTime = (iso: string) => {
      try {
          if (!iso) return "";
          const d = new Date(iso);
          // Si la date est invalide, on retourne l'heure actuelle ou vide
          if (isNaN(d.getTime())) return ""; 
          return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour:'2-digit', minute:'2-digit' });
      } catch (e) {
          return "";
      }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* En-tête */}
        <div className="bg-white p-4 border-b border-stone-100 flex justify-between items-center shadow-sm z-10">
            <h4 className="font-serif font-bold text-stone-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-500"/> 
                {userType === 'admin' ? `Discussion : ${project.clientNames}` : "Discussion avec le Studio"}
            </h4>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-stone-400">
                <ShieldCheck className="w-3 h-3"/> Sécurisé
            </div>
        </div>
        
        {/* Zone de messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50">
            {localMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-stone-400 space-y-2">
                    <MessageSquare className="w-8 h-8 opacity-20"/>
                    <p className="text-sm italic">Aucun message pour le moment.</p>
                </div>
            )}
            
            {localMessages.map((msg, index) => {
                // EST-CE MOI ? 
                // Si je suis admin, "isStaff" c'est moi. 
                // Si je suis client, "!isStaff" c'est moi.
                const isMe = (userType === 'admin' && msg.isStaff) || (userType === 'client' && !msg.isStaff);
                
                return (
                    <div key={index} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                            
                            {/* Nom et Date */}
                            <div className="flex items-center gap-2 mb-1 px-1">
                                {!isMe && (
                                    <span className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
                                        {msg.isStaff ? <ShieldCheck className="w-3 h-3 text-amber-500"/> : <User className="w-3 h-3"/>}
                                        {msg.author}
                                    </span>
                                )}
                                <span className="text-[10px] text-stone-300">{formatTime(msg.date)}</span>
                            </div>

                            {/* Bulle de message */}
                            <div className={`p-4 text-sm leading-relaxed shadow-sm relative group transition-all
                                ${isMe 
                                    ? 'bg-stone-900 text-white rounded-2xl rounded-tr-none' 
                                    : 'bg-white border border-stone-200 text-stone-700 rounded-2xl rounded-tl-none'
                                }`}
                            >
                                {msg.text}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Zone de saisie */}
        <form onSubmit={sendMessage} className="p-4 bg-white border-t border-stone-100 flex gap-3 items-center">
            <input 
                disabled={disabled}
                className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all placeholder-stone-400" 
                placeholder="Écrivez votre message..." 
                value={newMessage} 
                onChange={e => setNewMessage(e.target.value)}
            />
            <button 
                disabled={disabled || sending || !newMessage.trim()} 
                className="bg-stone-900 hover:bg-black text-white p-3 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:shadow-none hover:scale-105 transform active:scale-95"
            >
                {sending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5" />}
            </button>
        </form>
    </div>
  );
}