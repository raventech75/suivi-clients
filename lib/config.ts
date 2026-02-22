// ---------------------------------------------------------------------------
// CONFIGURATION GLOBALE DU PROJET (VERSION SAAS READY)
// ---------------------------------------------------------------------------

export const COLLECTION_NAME = "wedding_projects";
export const SETTINGS_COLLECTION = "settings";
export const USERS_COLLECTION = "users";

// 👇 IDENTIFIANT DE VOTRE STUDIO (À RENDRE DYNAMIQUE LORS DE L'INSCRIPTION)
export const CURRENT_STUDIO_ID = "irzzen_prod";

// Webhooks et Liens Stripe par défaut (seront écrasés par les réglages Firebase)
export const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/xnuln15n6zggpfk18p78o7olikrd8a99"; 
export const STRIPE_PRIORITY_LINK = "https://buy.stripe.com/fZu4gz07eaPzcRt54Y5gc0c";
export const STRIPE_RAW_LINK = "https://buy.stripe.com/cNi5kD5rye1L2cP2WQ5gc0d";
export const STRIPE_ARCHIVE_RESTORE_LINK = "https://buy.stripe.com/fZu00j3jq4rb5p140U5gc0e";

// Annuaire de l'équipe (Historique - sera géré par la collection USERS)
export const STAFF_DIRECTORY: Record<string, string> = {
    'Yunus': 'yunus34@hotmail.fr',
    'Serife': 'serifevideography@gmail.com',
    'Volkan': 'mariages.paris.productions@gmail.com',
    'Feridun': 'feridun.kizgin@gmail.com',
};

// --- FORMULES ET OPTIONS PAR DÉFAUT ---
export const FORMULAS = [
    { id: 'essentielle', name: 'Formule 1 : Essentielle', price: 1800, details: ['Prises de vue à la mairie', 'Séance photo de couple', 'Vidéo des moments clés', '1 Caméraman', 'Montage vidéo complet', 'Album photo numérique', 'Clef USB'] },
    { id: 'prestige', name: 'Formule 2 : Prestige', price: 2800, details: ['Prises de vue à la mairie', 'Séance photo de couple', 'Vidéo des moments clés', '1 Caméraman', 'Montage vidéo complet', 'Album photo numérique et imprimé (30x30)', 'Prestations drone', 'Clef USB'] },
    { id: 'excellence', name: 'Formule 3 : Excellence', price: 3800, details: ['Shooting préparatifs', 'Prises de vue à la mairie', 'Séance photo de couple', 'Vidéo des moments clés', '2 Caméramans', 'Montage vidéo complet', 'Album photo numérique et imprimé de luxe (40x30)', 'Prestations drone', 'Projection vidéos sur écran (soirée)', 'Clef USB'] },
    { id: 'luxe', name: 'Formule 4 : Luxe', price: 4800, details: ['Shooting préparatifs', 'Prises de vue à la mairie', 'Séance photo de couple', 'Vidéo des moments clés', '2 Caméramans', 'Montage vidéo complet', 'Album photo numérique et imprimé de luxe (40x30 + 15x21 x2)', 'Prestations drone', 'Diffusion direct sur Youtube', 'Projection photos/vidéos (soirée)', 'Projection meilleurs moments', 'Clef USB'] }
];

export const FORMULA_OPTIONS = [
    { id: 'preparatifs', name: 'Shooting des préparatifs', price: 200 },
    { id: 'drone', name: 'Drone', price: 400 },
    { id: 'usb', name: 'Clef USB supplémentaire', price: 50 },
    { id: 'projection', name: 'Projection Jour J', price: 300 },
    { id: 'kina', name: 'Kina / Henne (Lundi au Jeudi)', price: 1500 }
];

// --- LOGIQUE DE PRODUCTION ---
export const CHECKLIST_PHOTO = [
    { id: 'backup', label: 'Sauvegarde Cartes', weight: 10 },
    { id: 'culling', label: 'Tri & Sélection', weight: 20 },
    { id: 'editing', label: 'Colorimétrie (Lr)', weight: 30 },
    { id: 'retouch', label: 'Retouches (Ps)', weight: 20 },
    { id: 'export', label: 'Export JPG', weight: 10 },
    { id: 'gallery', label: 'Mise en ligne Galerie', weight: 10 }
];

export const CHECKLIST_VIDEO = [
    { id: 'backup', label: 'Sauvegarde Rushes', weight: 10 },
    { id: 'music', label: 'Choix Musiques', weight: 10 },
    { id: 'derush', label: 'Dérushage', weight: 20 },
    { id: 'cutting', label: 'Montage (Ours)', weight: 30 },
    { id: 'grading', label: 'Étalonnage & Mix', weight: 20 },
    { id: 'export', label: 'Export 4K & Upload', weight: 10 }
];

export const PHOTO_STEPS = {
    'none': { label: 'En attente', percent: 0 },
    'waiting': { label: 'En attente des fichiers', percent: 10 },
    'culling': { label: 'Tri & Sélection', percent: 30 },
    'editing': { label: 'Développement (Lr)', percent: 60 },
    'retouching': { label: 'Retouches (Ps)', percent: 80 },
    'export': { label: 'Export Final', percent: 90 },
    'delivered': { label: 'Livraison Finale', percent: 100 }
};

export const VIDEO_STEPS = {
    'none': { label: 'En attente', percent: 0 },
    'waiting': { label: 'En attente des fichiers', percent: 10 },
    'rushes': { label: 'Dérushage', percent: 25 },
    'cutting': { label: 'Montage en cours', percent: 50 },
    'grading': { label: 'Etalonnage & Mixage', percent: 75 },
    'partial': { label: 'Livraison Partielle (Clip)', percent: 85 },
    'rendering': { label: 'Export Final', percent: 90 },
    'delivered': { label: 'Livraison Finale', percent: 100 }
};

export const ALBUM_STATUSES = {
    'pending': 'En attente choix',
    'design': 'En cours de design',
    'validation': 'En attente validation',
    'printing': 'En impression',
    'sent': 'Expédié'
};

export const USB_STATUSES = {
    'none': 'Non requis',
    'preparing': 'En préparation',
    'sent': 'Expédiée',
    'delivered': 'Livrée / Remise'
};

export const ALBUM_FORMATS = [
    "30x30", "40x30", "25x25", "20x30", "Coffret Luxe", "Livre Parents (20x20)"
];

// --- INTERFACES TYPESCRIPT ---

export interface UserProfile {
    uid?: string;
    email: string;
    displayName: string;
    role: 'superadmin' | 'admin' | 'staff';
    studioId: string;
    isActive: boolean;
}

export interface HistoryLog { date: string; user: string; action: string; }
export interface Album { id: string; name: string; format: string; price: number; status: string; paid: boolean; stripeLink?: string; }
export interface Message { id: string; author: string; text: string; date: string; isStaff: boolean; }
export interface InternalMessage { id: string; author: string; role: string; text: string; date: string; }
export interface TeamPayment { id: string; recipient: string; amount: number; date: string; note?: string; }

export interface Project {
    id: string;
    studioId: string; // Désormais requis pour le SaaS
    code: string;
    clientNames: string;
    clientEmail: string;
    clientEmail2?: string;
    clientPhone?: string;
    clientPhone2?: string;
    weddingDate: string;
    weddingVenue?: string;
    weddingVenueZip?: string;
    clientCity?: string;

    managerName?: string;
    managerEmail?: string;
    photographerName?: string;
    photographerEmail?: string;
    videographerName?: string;
    videographerEmail?: string;

    hasPhoto: boolean;
    hasVideo: boolean;
    statusPhoto: string;
    statusVideo: string;
    progressPhoto: number;
    progressVideo: number;
    
    checkListPhoto?: Record<string, boolean>;
    checkListVideo?: Record<string, boolean>;

    galleryImages?: { url: string, filename: string }[];
    selectedImages?: string[];
    selectionValidated?: boolean;
    maxSelection?: number;

    estimatedDeliveryPhoto?: string;
    estimatedDeliveryVideo?: string;
    deliveryConfirmedPhoto?: boolean;
    deliveryConfirmedVideo?: boolean;
    deliveryConfirmedPhotoDate?: any;
    deliveryConfirmedVideoDate?: any;

    linkPhoto?: string;
    linkVideo?: string;
    moodboardLink?: string;
    musicLinks?: string;
    musicInstructions?: string;
    coverImage?: string;

    isPriority: boolean;
    isArchived: boolean;
    fastTrackActivationDate?: string;
    
    usbAddress?: string;
    usbStatus?: string;

    albums: Album[];
    messages: Message[];
    internalChat: InternalMessage[];
    history: HistoryLog[];
    teamPayments?: TeamPayment[];
    
    inviteCount?: number;
    lastAdminRead?: string;
    createdAt?: any;
    lastUpdated?: any;
    totalPrice?: number;
    depositAmount?: number;

    prepAddressBride?: string;
    prepTimeBride?: string;
    prepAddressGroom?: string;
    prepTimeGroom?: string;
    ceremonyAddress?: string;
    ceremonyTime?: string;
    partyAddress?: string;
    partyTime?: string;
    witness1Name?: string;
    witness1Phone?: string;
    witness2Name?: string;
    witness2Phone?: string;
    questionnaireFilled?: boolean;

    contractSigned?: boolean;
    contractSignatureData?: string;
    contractSignedDate?: string;
    
    selectedFormula?: string;
    selectedOptions?: string[];
}