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

export type VisualDirection = {
  sceneType: string;
  cameraShot: string;
  characterAction: string;
  environment: string;
  keyObjects: string[];
  mood: string;
  lighting: string;
};

export type BookPage = {
  pageNumber: number;
  chapter: string;
  title: string;
  text: string;
  imagePrompt: string;
  visualDirection?: VisualDirection;
  imageUrl?: string;
  audioUrl?: string | null;
};

export type StoryEngine = {
  archetype: string;
  centralIrony: string;
  publicReputation: string;
  privateTruth: string;
  socialPressure: string;
  irreversibleEvent: string;
  championConnectionType: string;
  finalContradiction: string;
};

export type ChampionConnection = {
  championName: string;
  connectionType: string;
  connectionSummary: string;
  whyItMatters: string;
  canonSafetyNote: string;
};

export type VisualBible = {
  appearance: string;
  clothing: string;
  regionAtmosphere: string;
  colorPalette: string;
  recurringVisualMotif: string;
};

/** Derived for image/audio/PDF consumers that still expect the legacy shape. */
export type CharacterBible = {
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

export type LoreBook = {
  title: string;
  subtitle: string;
  region: string;
  genre: string;
  storyEngine: StoryEngine;
  championConnection: ChampionConnection;
  visualBible: VisualBible;
  pages: BookPage[];
  /** Legacy alias used across the app. */
  mainRegion: string;
  /** Legacy compatibility object derived during normalization. */
  characterBible: CharacterBible;
};

export type AudioSettings = {
  musicEnabled: boolean;
  voiceEnabled: boolean;
};

export type BookStatus = "free" | "checkout_started" | "paid" | "generating" | "ready" | "failed";

export type Mp3Status = "not_started" | "generating" | "ready" | "failed";

export type PdfStatus = "not_started" | "waiting_for_images" | "generating" | "ready" | "failed";

export type ImagePageStatus = "not_started" | "generating" | "ready" | "failed";

export type PageImageState = {
  status: ImagePageStatus;
  url?: string | null;
};

export type ConfirmationEmailStatus = "not_started" | "sending" | "sent" | "failed" | "skipped";

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
  image_status: Record<string, ImagePageStatus>;
  audio: Record<string, string>;
  pdf_url: string | null;
  pdf_storage_path: string | null;
  pdf_status: PdfStatus;
  pdf_generated_at: string | null;
  mp3_storage_path: string | null;
  mp3_generated_at: string | null;
  mp3_status: Mp3Status;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  confirmation_email_sent_at: string | null;
  confirmation_email_status: ConfirmationEmailStatus;
  confirmation_email_error: string | null;
  created_at: string;
  updated_at: string;
};

export function getCharacterName(book: LoreBook) {
  return book.characterBible.name || book.title;
}
