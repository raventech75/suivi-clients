// ---------------------------------------------------------------------------
// CONFIGURATION GLOBALE DU PROJET
// ---------------------------------------------------------------------------

export const COLLECTION_NAME = "wedding_projects";
export const SETTINGS_COLLECTION = "settings";

// 👇 VOS URLS
export const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/xnuln15n6zggpfk18p78o7olikrd8a99"; 
export const STRIPE_PRIORITY_LINK = "https://buy.stripe.com/fZu4gz07eaPzcRt54Y5gc0c";
export const STRIPE_RAW_LINK = "https://buy.stripe.com/cNi5kD5rye1L2cP2WQ5gc0d";
export const STRIPE_ARCHIVE_RESTORE_LINK = "https://buy.stripe.com/fZu00j3jq4rb5p140U5gc0e";

/// Annuaire
export const STAFF_DIRECTORY: Record<string, string> = {
    'Yunus': 'yunus34@hotmail.fr',
    'Serife': 'serifevideography@gmail.com',
    'Volkan': 'mariages.paris.productions@gmail.com',
    'Feridun': 'feridun.kizgin@gmail.com',
};

// 👇 NOUVEAU : DÉFINITION DES TASKS (CHECKLISTS)
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

// On garde ça pour l'affichage client simplifié
export const PHOTO_STEPS = {
    'none': { label: 'En attente', percent: 0 },
    'waiting': { label: 'En attente des fichiers', percent: 10 },
    'culling': { label: 'Tri & Sélection', percent: 30 },
    'editing': { label: 'Développement', percent: 60 },
    'retouching': { label: 'Finitions', percent: 80 },
    'delivered': { label: 'Livraison Finale', percent: 100 }
};

export const VIDEO_STEPS = {
    'none': { label: 'En attente', percent: 0 },
    'waiting': { label: 'En attente des fichiers', percent: 10 },
    'cutting': { label: 'Montage en cours', percent: 40 },
    'grading': { label: 'Etalonnage', percent: 70 },
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

// --- INTERFACES ---

export interface HistoryLog {
    date: string;
    user: string;
    action: string;
}

export interface Album {
    id: string;
    name: string;
    format: string;
    price: number;
    status: string;
    paid: boolean;
    stripeLink?: string;
}

export interface Message {
    id: string;
    author: string;
    text: string;
    date: string;
    isStaff: boolean;
}

export interface InternalMessage {
    id: string;
    author: string;
    role: string;
    text: string;
    date: string;
}

export interface Project {
    id: string;
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

    // Staff
    managerName?: string;
    managerEmail?: string;
    photographerName?: string;
    photographerEmail?: string;
    videographerName?: string;
    videographerEmail?: string;

    // Production
    hasPhoto: boolean;
    hasVideo: boolean;
    statusPhoto: string;
    statusVideo: string;
    progressPhoto: number;
    progressVideo: number;
    
    // 👇 NOUVEAU : Checklists détaillées
    checkListPhoto?: Record<string, boolean>;
    checkListVideo?: Record<string, boolean>;

    // Dates & Livraisons
    estimatedDeliveryPhoto?: string;
    estimatedDeliveryVideo?: string;
    deliveryConfirmedPhoto?: boolean;
    deliveryConfirmedVideo?: boolean;
    deliveryConfirmedPhotoDate?: any;
    deliveryConfirmedVideoDate?: any;

    // Liens
    linkPhoto?: string;
    linkVideo?: string;
    moodboardLink?: string;
    musicLinks?: string;
    musicInstructions?: string;
    coverImage?: string;

    // Options
    isPriority: boolean;
    isArchived: boolean;
    fastTrackActivationDate?: string;
    usbAddress?: string;
    usbStatus?: string;

    // Données complexes
    albums: Album[];
    messages: Message[];
    internalChat: InternalMessage[];
    history: HistoryLog[];
    
    // Meta
    inviteCount?: number;
    lastAdminRead?: string; // Ajouté précédemment
    createdAt?: any;
    lastUpdated?: any;
    
    // Financier
    totalPrice?: number;
    depositAmount?: number;
}