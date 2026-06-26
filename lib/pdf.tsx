import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { preparePdfStoryPages, type PdfGenerationContext, type PdfStoryPage } from "@/lib/pdfBookPages";
import type { LoreBook } from "@/lib/types";

const PAGE_PADDING = 18;
const A4_PAGE_HEIGHT_PT = 842;
const A4_PAGE_WIDTH_PT = 595;
const TEXT_PAGE_PADDING_PT = 14;
const TEXT_FRAME_PADDING_PT = 14;
const TEXT_INNER_FRAME_PADDING_H = 24;
const TEXT_INNER_FRAME_PADDING_V = 18;
const TEXT_HEADER_RESERVED_PT = 68;
const TEXT_AREA_HEIGHT_RATIO = 0.76;

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
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: "column",
    justifyContent: "flex-start",
  },
  header: {
    flexShrink: 0,
    marginBottom: 10,
  },
  pageLabel: {
    fontSize: 8,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: palette.pageLabel,
    textAlign: "center",
    marginBottom: 6,
  },
  title: {
    fontFamily: "Times-Bold",
    fontSize: 20,
    lineHeight: 1.2,
    color: palette.title,
    textAlign: "center",
    marginBottom: 8,
  },
  rule: {
    height: 1,
    backgroundColor: palette.rule,
    marginBottom: 10,
    width: "30%",
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
};

function getTextBoxDimensions() {
  const pageInnerHeight = A4_PAGE_HEIGHT_PT - TEXT_PAGE_PADDING_PT * 2;
  const frameHeight = pageInnerHeight - TEXT_FRAME_PADDING_PT * 2 - 2;
  const innerFrameHeight = frameHeight - TEXT_INNER_FRAME_PADDING_V * 2 - 2;
  const textBoxHeight = Math.round(
    Math.max(innerFrameHeight - TEXT_HEADER_RESERVED_PT, innerFrameHeight * TEXT_AREA_HEIGHT_RATIO),
  );
  const textBoxWidth =
    A4_PAGE_WIDTH_PT -
    TEXT_PAGE_PADDING_PT * 2 -
    TEXT_FRAME_PADDING_PT * 2 -
    TEXT_INNER_FRAME_PADDING_H * 2 -
    4;

  return { textBoxHeight, textBoxWidth };
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
  const candidates: TextPageTypography[] = [
    { fontSize: 21, lineHeight: 1.5, textBoxHeight },
    { fontSize: 20, lineHeight: 1.48, textBoxHeight },
    { fontSize: 19, lineHeight: 1.45, textBoxHeight },
    { fontSize: 18, lineHeight: 1.42, textBoxHeight },
    { fontSize: 17, lineHeight: 1.38, textBoxHeight },
  ];

  for (const candidate of candidates) {
    const lines = estimateWrappedLines(text, candidate.fontSize, textBoxWidth);
    const requiredHeight = lines * candidate.fontSize * candidate.lineHeight;

    if (requiredHeight <= textBoxHeight) {
      return candidate;
    }
  }

  return { fontSize: 17, lineHeight: 1.35, textBoxHeight };
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
    textBoxHeight: typography.textBoxHeight,
    pageHeightUsage: "75%",
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
          <View style={[textStyles.bodyBox, { minHeight: typography.textBoxHeight }]}>
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
