import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { preparePdfStoryPages, type PdfGenerationContext, type PdfStoryPage } from "@/lib/pdfBookPages";
import type { LoreBook } from "@/lib/types";

const PAGE_PADDING = 18;
const A4_PAGE_HEIGHT_PT = 842;
const A4_PAGE_WIDTH_PT = 595;
const TEXT_PAGE_PADDING_PT = 14;
const TEXT_FRAME_PADDING_PT = 14;
const TEXT_INNER_FRAME_PADDING_H = 22;
const TEXT_INNER_FRAME_PADDING_TOP = 12;
const TEXT_INNER_FRAME_PADDING_BOTTOM = 10;
const TEXT_HEADER_RESERVED_PT = 92;

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
    marginBottom: 6,
  },
  pageLabel: {
    fontSize: 10,
    letterSpacing: 2.8,
    textTransform: "uppercase",
    color: palette.pageLabel,
    textAlign: "center",
    marginBottom: 5,
  },
  title: {
    fontFamily: "Times-Bold",
    fontSize: 27,
    lineHeight: 1.18,
    color: palette.title,
    textAlign: "center",
    marginBottom: 6,
  },
  rule: {
    height: 1,
    backgroundColor: palette.rule,
    marginBottom: 8,
    width: "34%",
    alignSelf: "center",
  },
  bodyBox: {
    flexGrow: 1,
    flexDirection: "column",
    justifyContent: "flex-start",
  },
  body: {
    color: palette.body,
    textAlign: "justify",
  },
});

type TextPageTypography = {
  fontSize: number;
  lineHeight: number;
  textBoxHeight: number;
  bodyJustify: "flex-start" | "center";
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
  const avgCharWidth = fontSize * 0.5;
  const charsPerLine = Math.max(18, Math.floor(maxWidth / avgCharWidth));
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
    { fontSize: 24, lineHeight: 1.58 },
    { fontSize: 23, lineHeight: 1.55 },
    { fontSize: 22, lineHeight: 1.52 },
    { fontSize: 21, lineHeight: 1.5 },
    { fontSize: 20, lineHeight: 1.47 },
    { fontSize: 19, lineHeight: 1.44 },
    { fontSize: 18, lineHeight: 1.4 },
  ];

  for (const candidate of candidates) {
    const lines = estimateWrappedLines(text, candidate.fontSize, textBoxWidth);
    let lineHeight = candidate.lineHeight;
    let requiredHeight = lines * candidate.fontSize * lineHeight;

    if (requiredHeight <= textBoxHeight) {
      const fillRatio = requiredHeight / textBoxHeight;
      if (fillRatio < 0.78 && lines >= 1) {
        const targetHeight = textBoxHeight * 0.82;
        const expandedLineHeight = targetHeight / (lines * candidate.fontSize);
        lineHeight = Math.min(Math.max(expandedLineHeight, candidate.lineHeight), 1.9);
        requiredHeight = lines * candidate.fontSize * lineHeight;
      }

      if (requiredHeight <= textBoxHeight) {
        return {
          fontSize: candidate.fontSize,
          lineHeight,
          textBoxHeight,
          bodyJustify: requiredHeight < textBoxHeight * 0.72 ? "center" : "flex-start",
        };
      }
    }
  }

  const fallbackLines = estimateWrappedLines(text, 17, textBoxWidth);
  const fallbackLineHeight = Math.min(1.38, textBoxHeight / Math.max(fallbackLines, 1) / 17);

  return {
    fontSize: 17,
    lineHeight: fallbackLineHeight,
    textBoxHeight,
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
    pageHeightUsage: "84%",
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
                height: typography.textBoxHeight,
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
