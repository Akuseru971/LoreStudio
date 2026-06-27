import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { preparePdfStoryPages, type PdfGenerationContext, type PdfStoryPage } from "@/lib/pdfBookPages";
import type { LoreBook } from "@/lib/types";

const PAGE_PADDING = 18;
const A4_PAGE_HEIGHT_PT = 842;
const A4_PAGE_WIDTH_PT = 595;
const TEXT_PAGE_PADDING_PT = 10;
const TEXT_FRAME_PADDING_PT = 10;
const TEXT_INNER_FRAME_PADDING_H = 14;
const TEXT_INNER_FRAME_PADDING_TOP = 8;
const TEXT_INNER_FRAME_PADDING_BOTTOM = 8;
const TEXT_HEADER_RESERVED_PT = 76;
const TARGET_TEXT_FILL_RATIO = 0.9;

const palette = {
  darkBackground: "#0f0b07",
  imageWell: "#120d07",
  frameBorder: "#d9bd78",
  frameBorderMuted: "#6b5530",
  pageLabel: "#d9bd78",
  title: "#f7ebce",
  body: "#e8dcc0",
  rule: "#6b5530",
  placeholder: "#9a7d58",
};

const imageStyles = StyleSheet.create({
  page: {
    backgroundColor: palette.imageWell,
    padding: PAGE_PADDING,
  },
  canvas: {
    flex: 1,
    backgroundColor: palette.darkBackground,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: palette.frameBorderMuted,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  placeholderLabel: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: palette.placeholder,
    textAlign: "center",
  },
});

const textStyles = StyleSheet.create({
  page: {
    backgroundColor: palette.darkBackground,
    padding: TEXT_PAGE_PADDING_PT,
    fontFamily: "Times-Roman",
    color: palette.body,
  },
  frame: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.frameBorderMuted,
    backgroundColor: palette.imageWell,
    padding: TEXT_FRAME_PADDING_PT,
    flexDirection: "column",
  },
  innerFrame: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.frameBorder,
    paddingHorizontal: TEXT_INNER_FRAME_PADDING_H,
    paddingTop: TEXT_INNER_FRAME_PADDING_TOP,
    paddingBottom: TEXT_INNER_FRAME_PADDING_BOTTOM,
    flexDirection: "column",
    justifyContent: "flex-start",
  },
  header: {
    flexShrink: 0,
    marginBottom: 4,
  },
  pageLabel: {
    fontSize: 9,
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: palette.pageLabel,
    textAlign: "center",
    marginBottom: 3,
  },
  title: {
    fontFamily: "Times-Bold",
    fontSize: 26,
    lineHeight: 1.12,
    color: palette.title,
    textAlign: "center",
    marginBottom: 4,
  },
  rule: {
    height: 1,
    backgroundColor: palette.rule,
    marginBottom: 5,
    width: "28%",
    alignSelf: "center",
  },
  bodyBox: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-start",
    width: "100%",
  },
  body: {
    color: palette.body,
    textAlign: "left",
    width: "100%",
  },
});

type TextPageTypography = {
  fontSize: number;
  lineHeight: number;
  textBoxHeight: number;
  bodyJustify: "flex-start" | "center" | "space-between";
  fillRatio: number;
};

function getTextBoxDimensions() {
  const pageInnerHeight = A4_PAGE_HEIGHT_PT - TEXT_PAGE_PADDING_PT * 2;
  const frameHeight = pageInnerHeight - TEXT_FRAME_PADDING_PT * 2 - 2;
  const innerFrameHeight =
    frameHeight - TEXT_INNER_FRAME_PADDING_TOP - TEXT_INNER_FRAME_PADDING_BOTTOM - 2;
  const textBoxHeight = Math.round(innerFrameHeight - TEXT_HEADER_RESERVED_PT);
  const textBoxWidth =
    A4_PAGE_WIDTH_PT -
    TEXT_PAGE_PADDING_PT * 2 -
    TEXT_FRAME_PADDING_PT * 2 -
    TEXT_INNER_FRAME_PADDING_H * 2 -
    4;

  return { textBoxHeight, textBoxWidth, innerFrameHeight };
}

function estimateWrappedLines(text: string, fontSize: number, maxWidth: number) {
  const avgCharWidth = fontSize * 0.48;
  const charsPerLine = Math.max(20, Math.floor(maxWidth / avgCharWidth));
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return 1;
  }

  let lines = 1;
  let currentLineLength = 0;

  for (const word of words) {
    const wordLength = word.length;
    const nextLength = currentLineLength === 0 ? wordLength : currentLineLength + 1 + wordLength;

    if (nextLength > charsPerLine) {
      lines += 1;
      currentLineLength = wordLength;
    } else {
      currentLineLength = nextLength;
    }
  }

  return lines;
}

function resolveTextPageTypography(text: string): TextPageTypography {
  const { textBoxHeight, textBoxWidth } = getTextBoxDimensions();
  const candidates: Array<{ fontSize: number; lineHeight: number }> = [
    { fontSize: 28, lineHeight: 1.62 },
    { fontSize: 27, lineHeight: 1.6 },
    { fontSize: 26, lineHeight: 1.58 },
    { fontSize: 25, lineHeight: 1.55 },
    { fontSize: 24, lineHeight: 1.52 },
    { fontSize: 23, lineHeight: 1.5 },
    { fontSize: 22, lineHeight: 1.48 },
    { fontSize: 21, lineHeight: 1.45 },
    { fontSize: 20, lineHeight: 1.42 },
    { fontSize: 19, lineHeight: 1.38 },
    { fontSize: 18, lineHeight: 1.34 },
  ];

  for (const candidate of candidates) {
    const lines = estimateWrappedLines(text, candidate.fontSize, textBoxWidth);
    let lineHeight = candidate.lineHeight;
    let requiredHeight = lines * candidate.fontSize * lineHeight;

    if (requiredHeight <= textBoxHeight) {
      const initialFillRatio = requiredHeight / textBoxHeight;
      if (initialFillRatio < TARGET_TEXT_FILL_RATIO && lines >= 1) {
        const targetHeight = textBoxHeight * TARGET_TEXT_FILL_RATIO;
        const expandedLineHeight = targetHeight / (lines * candidate.fontSize);
        lineHeight = Math.min(Math.max(expandedLineHeight, candidate.lineHeight), 2.08);
        requiredHeight = lines * candidate.fontSize * lineHeight;
      }

      if (requiredHeight <= textBoxHeight) {
        const fillRatio = requiredHeight / textBoxHeight;
        return {
          fontSize: candidate.fontSize,
          lineHeight,
          textBoxHeight,
          fillRatio,
          bodyJustify: fillRatio < 0.68 ? "center" : "flex-start",
        };
      }
    }
  }

  const fallbackFontSize = 17;
  const fallbackLines = estimateWrappedLines(text, fallbackFontSize, textBoxWidth);
  const fallbackLineHeight = Math.min(
    1.36,
    (textBoxHeight * TARGET_TEXT_FILL_RATIO) / Math.max(fallbackLines, 1) / fallbackFontSize,
  );

  return {
    fontSize: fallbackFontSize,
    lineHeight: fallbackLineHeight,
    textBoxHeight,
    fillRatio: (fallbackLines * fallbackFontSize * fallbackLineHeight) / textBoxHeight,
    bodyJustify: "flex-start",
  };
}

function ImagePdfPage({ page }: { page: PdfStoryPage }) {
  return (
    <Page size="A4" style={imageStyles.page}>
      <View style={imageStyles.canvas}>
        {page.imageSrc ? (
          <Image src={page.imageSrc} style={imageStyles.image} />
        ) : (
          <View style={imageStyles.imagePlaceholder}>
            <Text style={imageStyles.placeholderLabel}>Illustration reserved</Text>
          </View>
        )}
      </View>
    </Page>
  );
}

function TextPdfPage({ page }: { page: PdfStoryPage }) {
  const typography = resolveTextPageTypography(page.text);

  console.log("[PDF_TEXT_PAGE_LAYOUT]", {
    storyPage: page.pageNumber,
    fontSize: typography.fontSize,
    lineHeight: typography.lineHeight,
    textBoxHeight: typography.textBoxHeight,
    fillRatio: typography.fillRatio.toFixed(2),
    pageHeightUsage: "90%",
    textAlign: "left",
  });

  return (
    <Page size="A4" style={textStyles.page}>
      <View style={textStyles.frame}>
        <View style={textStyles.innerFrame}>
          <View style={textStyles.header}>
            <Text style={textStyles.pageLabel}>Page {page.pageNumber}</Text>
            <Text style={textStyles.title}>{page.title}</Text>
            <View style={textStyles.rule} />
          </View>
          <View
            style={[
              textStyles.bodyBox,
              {
                minHeight: typography.textBoxHeight,
                justifyContent: typography.bodyJustify,
              },
            ]}
          >
            <Text
              style={[
                textStyles.body,
                {
                  fontSize: typography.fontSize,
                  lineHeight: typography.lineHeight,
                },
              ]}
            >
              {page.text}
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

function BookPdfDocument({
  storyPages,
  bookTitle,
  characterName,
}: {
  storyPages: PdfStoryPage[];
  bookTitle: string;
  characterName: string;
}) {
  return (
    <Document title={bookTitle} author={characterName}>
      {storyPages.flatMap((page) => [
        <ImagePdfPage key={`image-${page.pageNumber}`} page={page} />,
        <TextPdfPage key={`text-${page.pageNumber}`} page={page} />,
      ])}
    </Document>
  );
}

export async function generateBookPdf(book: LoreBook, context: PdfGenerationContext = {}): Promise<Buffer> {
  const storyPages = await preparePdfStoryPages(book, context);

  if (storyPages.length !== FULL_BOOK_PAGE_COUNT) {
    console.warn(
      `[PDF_GENERATION] Expected ${FULL_BOOK_PAGE_COUNT} story pages, received ${storyPages.length}.`,
    );
  }

  console.log("[PDF_LAYOUT_MODE]", "alternating_image_text_pages");
  console.log("[PDF_TOTAL_PAGES_EXPECTED]", FULL_BOOK_PAGE_COUNT * 2);

  for (const page of storyPages) {
    console.log("[PDF_ADD_IMAGE_PAGE]", { storyPage: page.pageNumber });
    console.log("[PDF_ADD_TEXT_PAGE]", { storyPage: page.pageNumber });
  }

  const buffer = await renderToBuffer(
    <BookPdfDocument
      storyPages={storyPages}
      bookTitle={book.title}
      characterName={book.characterBible.name}
    />,
  );

  return Buffer.from(buffer);
}
