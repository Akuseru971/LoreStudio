export type BookFormInput = {
  name: string;
  gender: "man" | "woman" | "creature" | "unknown";
  archetype: string;
  tone: string;
  universeStyle: string;
  strength: string;
  weakness: string;
};

export type BookPage = {
  pageNumber: number;
  chapter: string;
  title: string;
  text: string;
  imagePrompt: string;
  imageUrl?: string;
  audioUrl?: string;
};

export type LoreBook = {
  title: string;
  subtitle: string;
  narratorIntro: string;
  characterBible: {
    name: string;
    legendaryTitle: string;
    visualIdentity: string;
    clothing: string;
    faceAndBody: string;
    aura: string;
    symbolicObject: string;
    colorPalette: string;
    worldRules: string;
  };
  pages: BookPage[];
};

export type AudioSettings = {
  musicEnabled: boolean;
  voiceEnabled: boolean;
};
