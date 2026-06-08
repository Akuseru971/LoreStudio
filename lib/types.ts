export type BookFormInput = {
  name: string;
  gender: "man" | "woman" | "creature" | "unknown";
  archetype: string;
  tone: string;
  universeStyle: string;
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
  strength: string;
  weakness: string;
};

export type BookPage = {
  pageNumber: number;
  chapter: string;
  title: string;
  text: string;
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
  narratorIntro: string;
  characterBible: {
    name: string;
    legendaryTitle: string;
    region: string;
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
};

export type AudioSettings = {
  musicEnabled: boolean;
  voiceEnabled: boolean;
};
