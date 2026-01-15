'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, User, ShieldAlert } from 'lucide-react';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { Project, Message, MAKE_WEBHOOK_URL } from '../lib/config';

export default function ChatBox({ project, userType, disabled = false }: { project: Project, userType: 'admin' | 'client', disabled?: boolean }) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand un message arrive
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [project.messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || disabled) return;

    setSending(true);
    const msgText = newMessage.trim();

    try {
      // 1. Sauvegarde dans Firestore (Base de données)
      const messageData: Message = {
        id: Date.now().toString(),
        author: userType,
        text: msgText,
        date: Timestamp.now()
      };

      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/wedding_projects` : 'wedding_projects';
      await updateDoc(doc(db, colPath, project.id), {
        messages: arrayUnion(messageData),
        hasUnreadMessage: true, // Marqueur pour notification visuelle si besoin
        lastUpdated: serverTimestamp()
      });

      // 2. Envoi du Webhook vers Make (C'est ici que ça manquait !)
      // On envoie TOUTES les infos nécessaires pour le routage
      try {
          await fetch(MAKE_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  type: 'chat', // Pour le filtre Make "C'est un Chat"
                  msg: msgText,
                  author: userType === 'admin' ? 'L\'équipe RavenTech' : project.clientNames,
                  
                  // Infos Projet pour le contexte
                  clientName: project.clientNames,
                  projectCode: project.code,
                  
                  // Emails pour le routage (Important !)
                  clientEmail: project.clientEmail || "",
                  managerEmail: project.managerEmail || "",
                  
                  url: window.location.origin 
              })
          });
          console.log("📨 Webhook Chat envoyé avec succès !");
      } catch (err) {
          console.error("Erreur envoi Webhook Chat", err);
          // On ne bloque pas l'utilisateur si Make échoue, le message est déjà en base.
      }

      setNewMessage('');
    } catch (error) {
      console.error("Erreur message:", error);
      alert("Impossible d'envoyer le message.");
    } finally {
      setSending(false);
    }
  };

  // Petit utilitaire pour formater l'heure
  const formatTime = (timestamp: any) => {
      if (!timestamp) return "";
      const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col h-[500px]">
      {/* Header du Chat */}
      <div className="bg-stone-50 p-4 border-b border-stone-100 flex justify-between items-center">
        <div className="flex items-center gap-2 font-bold text-stone-700">
            <MessageSquare className="w-5 h-5"/> 
            Discussion en direct
        </div>
        <div className="text-xs text-stone-400">
            {project.messages?.length || 0} messages
        </div>
      </div>

      {/* Zone des messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/30">
        {(!project.messages || project.messages.length === 0) && (
            <div className="text-center text-stone-400 text-sm py-10 italic">
                Aucun message. Démarrez la conversation !
            </div>
        )}
        
        {project.messages?.map((m) => {
            const isMe = m.author === userType;
            return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${
                        isMe 
                        ? 'bg-stone-800 text-white rounded-tr-none' 
                        : 'bg-white border border-stone-100 text-stone-800 rounded-tl-none'
                    }`}>
                        <div className="mb-1 font-bold text-[10px] opacity-70 flex justify-between gap-4">
                            <span>{m.author === 'admin' ? 'RavenTech' : project.clientNames}</span>
                            <span>{formatTime(m.date)}</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                    </div>
                </div>
            );
        })}
      </div>

      {/* Zone de saisie */}
      <form onSubmit={sendMessage} className="p-3 bg-white border-t border-stone-100 flex gap-2">
        <input 
            className="flex-1 bg-stone-100 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-200 outline-none transition-all"
            placeholder={disabled ? "Chat désactivé (Lecture seule)" : "Écrivez votre message..."}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            disabled={sending || disabled}
        />
        <button 
            disabled={sending || disabled || !newMessage.trim()} 
            className="bg-stone-900 hover:bg-black text-white p-3 rounded-xl transition-all disabled:opacity-50 disabled:scale-95 shadow-md flex items-center justify-center"
        >
            {sending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Send className="w-5 h-5"/>}
        </button>
      </form>
    </div>
  );
}

// Fonction utilitaire manquante dans le fichier original importé, je la rajoute pour éviter les erreurs de build
import { serverTimestamp } from 'firebase/firestore';