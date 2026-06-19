export type BookFormInput = {
  name: string;
  gender: "man" | "woman" | "creature" | "unknown";
  characterType: string;
  runeterraRegion:
    | "Auto"
    | "Demacia"
    | "Noxus"
    | "Ionia"
    | "Piltover"
    | "Zaun"
    | "Shurima"
    | "Freljord"
    | "Bilgewater"
    | "Targon"
    | "Ixtal"
    | "Shadow Isles"
    | "Bandle City"
    | "The Void";
};

export type BookPage = {
  pageNumber: number;
  chapter: string;
  title: string;
  text: string;
  continuityNote?: string;
  visualDirection: {
    sceneType: string;
    cameraShot: string;
    characterAction: string;
    environment: string;
    keyObjects: string[];
    mood: string;
    lighting: string;
  };
  imagePrompt: string;
  imageUrl?: string;
  audioUrl?: string | null;
};

export type LoreBook = {
  title: string;
  subtitle: string;
  mainRegion: string;
  storyEngine: string;
  protagonistRole: string;
  coreConflict: string;
  distinctiveHook: string;
  narratorIntro: string;
  characterBible: {
    name: string;
    gender: string;
    characterType: string;
    legendaryTitle: string;
    region: string;
    socialRole: string;
    visualIdentity: string;
    clothing: string;
    faceAndBody: string;
    aura: string;
    symbolicObject: string;
    colorPalette: string;
    worldRules: string;
    runeterraLoreAnchor: string;
  };
  pages: BookPage[];
  biographyArc?: {
    startingSituation: string;
    incitingEvent: string;
    championConnectionPage5: string;
    page5Cliffhanger: string;
    finalState: string;
  };
  championConnection?: {
    championName: string;
    connectionType: string;
    connectionSummary: string;
    canonSafetyNote: string;
  };
  originalityProfile?: {
    specificRole: string;
    dailyReality: string;
    regionalPressure: string;
    unusualStoryElement: string;
    repetitionAvoided: string[];
  };
};

export type AudioSettings = {
  musicEnabled: boolean;
  voiceEnabled: boolean;
};

export type BookStatus = "free" | "checkout_started" | "paid" | "generating" | "ready" | "failed";

export type StoredBook = {
  id: string;
  access_token: string;
  email: string | null;
  status: BookStatus;
  form_input: BookFormInput;
  free_book: LoreBook | null;
  full_book: LoreBook | null;
  free_pages: BookPage[] | null;
  premium_pages: BookPage[] | null;
  images: Record<string, string>;
  audio: Record<string, string>;
  pdf_url: string | null;
  pdf_storage_path: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
};
