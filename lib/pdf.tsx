import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FULL_BOOK_PAGE_COUNT } from "@/lib/book-config";
import { preparePdfStoryPages, type PdfGenerationContext, type PdfStoryPage } from "@/lib/pdfBookPages";
import type { LoreBook } from "@/lib/types";

const PAGE_PADDING = 18;
const FRAME_PADDING = 20;

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
    padding: PAGE_PADDING,
    fontFamily: "Times-Roman",
    color: palette.body,
  },
  frame: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.frameBorderMuted,
    backgroundColor: palette.imageWell,
    padding: FRAME_PADDING,
    flexDirection: "column",
  },
  innerFrame: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.frameBorder,
    paddingHorizontal: 28,
    paddingVertical: 32,
    flexDirection: "column",
    justifyContent: "center",
  },
  pageLabel: {
    fontSize: 7.5,
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: palette.pageLabel,
    textAlign: "center",
    marginBottom: 10,
  },
  title: {
    fontFamily: "Times-Bold",
    fontSize: 18,
    lineHeight: 1.25,
    color: palette.title,
    textAlign: "center",
    marginBottom: 12,
  },
  rule: {
    height: 1,
    backgroundColor: palette.rule,
    marginBottom: 18,
    width: "32%",
    alignSelf: "center",
  },
  body: {
    fontSize: 11.5,
    lineHeight: 1.72,
    color: palette.body,
    textAlign: "justify",
  },
});

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
  return (
    <Page size="A4" style={textStyles.page}>
      <View style={textStyles.frame}>
        <View style={textStyles.innerFrame}>
          <Text style={textStyles.pageLabel}>Page {page.pageNumber}</Text>
          <Text style={textStyles.title}>{page.title}</Text>
          <View style={textStyles.rule} />
          <Text style={textStyles.body}>{page.text}</Text>
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
